import {
  createPublicClient,
  fallback,
  http,
  encodeFunctionData,
  keccak256,
  parseAbi,
} from "viem";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { root } from "./export.mjs";
const d = JSON.parse(
  await readFile(resolve(root, "dist/imd-deployment.json"), "utf8"),
);
const load = async (n) =>
  JSON.parse(await readFile(resolve(root, "dist/abi", n + ".json"), "utf8"));
const [hookAbi, tokenAbi, vaultAbi, potAbi] = await Promise.all(
  ["UnlockV2Hook", "UnlockV2Token", "MigrationVault", "RewardPot"].map(load),
);
const hook = d.contracts.find((c) => c.name === "UnlockV2Hook").address,
  token = d.contracts.find((c) => c.name === "UnlockV2Token").address;
const client = createPublicClient({
  transport: fallback(
    d.network.rpcUrls.map((u) =>
      http(u, {
        batch: { batchSize: 100, wait: 30 },
        timeout: 15000,
        retryCount: 0,
      }),
    ),
  ),
});
const h = (name, args = []) =>
  client.readContract({
    address: hook,
    abi: hookAbi,
    functionName: name,
    args,
  });
const output = {
  observedAt: new Date().toISOString(),
  mode: "Public RPC reads and eth_call simulation only. No transaction signing or broadcasting.",
};
try {
  output.chainId = await client.getChainId();
  if (output.chainId !== d.chainId) throw Error("Wrong RPC chain");
  output.block = (await client.getBlockNumber()).toString();
  output.contracts = [];
  for (const c of d.contracts) {
    const code = await client.getCode({ address: c.address });
    if (!code || code === "0x") throw Error("Missing deployed code");
    output.contracts.push({
      name: c.name,
      address: c.address,
      codeBytes: (code.length - 2) / 2,
      runtimeCodeKeccak: keccak256(code),
    });
  }
  const names = [
    "owner",
    "token",
    "imd",
    "poolManager",
    "expectedChainId",
    "migrationVault",
    "rewardPot",
    "activated",
    "poolInitialized",
    "isBound",
    "isReferenceAvailable",
    "swarmDistributor",
    "poolKey",
    "officialPoolId",
    "gatesOpen",
    "pendingGatesOpen",
    "fdvUsd",
    "tokenPriceInImd",
  ];
  const values = await Promise.all(names.map((n) => h(n)));
  output.state = Object.fromEntries(names.map((n, i) => [n, values[i]]));
  const v = (name) =>
    client.readContract({
      address: output.state.migrationVault,
      abi: vaultAbi,
      functionName: name,
    });
  const p = (name) =>
    client.readContract({
      address: output.state.rewardPot,
      abi: potAbi,
      functionName: name,
    });
  output.migration = Object.fromEntries(
    await Promise.all(
      [
        "CAP",
        "remainingCapacity",
        "remainingBacking",
        "isFullyFunded",
        "totalMigrated",
        "v1",
        "v2",
        "hook",
      ].map(async (n) => [n, await v(n)]),
    ),
  );
  output.rewards = Object.fromEntries(
    await Promise.all(
      ["hook", "imd", "totalPoints", "isSolvent", "epochStart", "solvency"].map(
        async (n) => [n, await p(n)],
      ),
    ),
  );
  output.routerSupported = await h("isRouter", [
    d.network.uniswapV4.universalRouter,
  ]);
  output.quoterSupported = await h("isRouter", [d.network.uniswapV4.quoter]);
  output.traderInterfaces = {};
  for (const name of ["universalRouter", "quoter"]) {
    try {
      const result = await client.readContract({
        address: d.network.uniswapV4[name],
        abi: parseAbi(["function msgSender() view returns(address)"]),
        functionName: "msgSender",
      });
      output.traderInterfaces[name] = {
        msgSenderCall: "Succeeded",
        returned: result,
      };
    } catch {
      output.traderInterfaces[name] = {
        msgSenderCall:
          "Reverted. Do not register as a trusted router without a compatible implementation.",
      };
    }
  }
  for (const [name, address] of [
    ["MigrationVault", output.state.migrationVault],
    ["RewardPot", output.state.rewardPot],
  ]) {
    const code = await client.getCode({ address });
    if (!code || code === "0x") throw Error("Missing companion code");
    output.contracts.push({
      name,
      address,
      codeBytes: (code.length - 2) / 2,
      runtimeCodeKeccak: keccak256(code),
    });
  }
  if (
    output.state.token.toLowerCase() !== token.toLowerCase() ||
    output.state.imd.toLowerCase() !==
      d.network.pairToken.address.toLowerCase() ||
    output.state.poolManager.toLowerCase() !==
      d.network.uniswapV4.poolManager.toLowerCase() ||
    output.migration.hook.toLowerCase() !== hook.toLowerCase() ||
    output.rewards.hook.toLowerCase() !== hook.toLowerCase()
  )
    throw Error("Bindings differ");
  const owner = output.state.owner,
    deficit =
      output.migration.remainingCapacity > output.migration.remainingBacking
        ? output.migration.remainingCapacity - output.migration.remainingBacking
        : 0n;
  const tx = (title, address, abi, functionName, args, prerequisites) => ({
    title,
    chainId: d.chainId,
    from: owner,
    to: address,
    value: "0x0",
    data: encodeFunctionData({ abi, functionName, args }),
    method: functionName,
    args,
    prerequisites,
    unsigned: true,
    broadcast: false,
  });
  output.ownerTransactions = [
    tx(
      "Fund actual remaining migration deficit",
      token,
      tokenAbi,
      "transfer",
      [output.state.migrationVault, deficit],
      [
        "Confirm the immutable vault address and owner UNLK2 balance.",
        "Migration principal cannot be withdrawn.",
      ],
    ),
    tx(
      "Register Universal Router",
      hook,
      hookAbi,
      "setRouter",
      [d.network.uniswapV4.universalRouter, true],
      [
        "Before permanent activation.",
        "Verify msgSender() trader attribution.",
      ],
    ),
    tx(
      "Activate and seal permanently",
      hook,
      hookAbi,
      "activate",
      [],
      [
        "Confirm funding transaction and isFullyFunded().",
        "Register the configured Universal Router after checking msgSender().",
        "Set the actual launch MerkleDistributor using owner-provided address in the UI.",
        "Verify binding, initialized pool and valid pricing references.",
        "All owner configuration becomes immutable.",
      ],
    ),
  ];
  for (const tx of output.ownerTransactions) {
    try {
      await client.call({ account: owner, to: tx.to, data: tx.data });
      tx.simulation = "Succeeded at observation time; repeat before signing.";
    } catch (e) {
      tx.simulation =
        "Not currently executable: " +
        (e.shortMessage ?? e.message).slice(0, 200);
    }
  }
  output.result =
    "PASS: chain, nonempty application/companion code, and contract bindings verified.";
} catch (e) {
  output.result = "UNVERIFIED";
  output.error = e.shortMessage ?? e.message;
  process.exitCode = 1;
}
await mkdir(resolve(root, "docs/frontend/evidence"), { recursive: true });
const replacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v);
await writeFile(
  resolve(root, "docs/frontend/evidence/live-chain.json"),
  JSON.stringify(output, replacer, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      result: output.result,
      chainId: output.chainId,
      block: output.block,
      state: output.state,
      migration: output.migration,
      routerSupported: output.routerSupported,
      quoterSupported: output.quoterSupported,
    },
    replacer,
    2,
  ),
);
