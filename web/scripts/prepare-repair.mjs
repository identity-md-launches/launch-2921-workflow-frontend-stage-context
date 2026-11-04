// Read-only owner preparation. No wallet, signer, private key, sendTransaction or broadcast capability.
import { readFile, writeFile } from "node:fs/promises";
import {
  createPublicClient,
  http,
  parseAbi,
  encodeDeployData,
  encodeFunctionData,
  keccak256,
} from "viem";
import { buildAllocations } from "./native-proofs.mjs";
const root = new URL("../../", import.meta.url);
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const deployment = await json("docs/frontend/deployment-handoff.json");
const network = (await json("docs/frontend/network-handoff.json")).network;
const repair = await json("web/public/repair-config.json");
const hook = deployment.contracts.find(
  (c) => c.name === "UnlockV2Hook",
).address;
const token = deployment.contracts.find(
  (c) => c.name === "UnlockV2Token",
).address;
const hookAbi = await json("docs/abi/UnlockV2Hook.json");
const nativeAbi = parseAbi([
  "function roundCount() view returns(uint256)",
  "function token() view returns(address)",
  "function roundOf(uint256) view returns(bytes32,uint256,uint256,uint64)",
]);
const client = createPublicClient({
  transport: http(network.rpcUrls[0], { timeout: 20000, retryCount: 0 }),
});
const block = await client.getBlockNumber();
if ((await client.getChainId()) !== 1) throw Error("Wrong chain");
const runtimeInventory = await json("web/public/contract-runtime.json");
if (runtimeInventory.chainId !== 1) throw Error("Runtime inventory chain mismatch");
for (const item of runtimeInventory.contracts) {
  const code = await client.getCode({address:item.address, blockNumber:block});
  if (!code || code === "0x" || keccak256(code) !== item.runtimeCodeHash)
    throw Error(`Verified deployed code changed: ${item.name}`);
}
const h = (functionName, args = []) =>
  client.readContract({
    address: hook,
    abi: hookAbi,
    functionName,
    args,
    blockNumber: block,
  });
const [owner, activated, vault, bound, routerRegistered, swarm] =
  await Promise.all([
    h("owner"),
    h("activated"),
    h("migrationVault"),
    h("isBound"),
    h("isRouter", [network.uniswapV4.universalRouter]),
    h("swarmDistributor"),
  ]);
if (activated)
  throw Error("Already activated: configuration sealed; no plan generated");
if (!bound) throw Error("Token hook binding invalid");
for (const address of [
  hook,
  token,
  vault,
  repair.nativeDistributor,
  network.uniswapV4.poolManager,
  network.uniswapV4.universalRouter,
])
  if ((await client.getCode({ address, blockNumber: block })) === "0x")
    throw Error("Missing deployed code");
const nativeToken = await client.readContract({
  address: repair.nativeDistributor,
  abi: nativeAbi,
  functionName: "token",
  blockNumber: block,
});
const round = await client.readContract({
  address: repair.nativeDistributor,
  abi: nativeAbi,
  functionName: "roundOf",
  args: [BigInt(repair.nativeRound)],
  blockNumber: block,
});
if (
  nativeToken.toLowerCase() !== token.toLowerCase() ||
  round[0] !== repair.nativeRoot ||
  round[1] !== BigInt(repair.nativeFunded)
)
  throw Error("Native canonical binding mismatch");
const [input, output = "docs/repair/owner-plan.json"] = process.argv.slice(2);
const plan = {
  kind: "UNSIGNED OWNER REVIEW ONLY — no transactions broadcast",
  chainId: 1,
  block: block.toString(),
  owner,
  hook,
  token,
  vault,
  observed: { activated, routerRegistered, swarm },
  siteIdentity: "unlock-v2.identitymd.eth",
  transactions: [],
  pending: [],
  activation:
    "DISABLED: explicit external owner review required; no activation calldata generated",
};
async function add(label, tx) {
  let estimate;
  try {
    estimate = (await client.estimateGas({ ...tx, account: owner })).toString();
  } catch (e) {
    throw Error(`${label} simulation failed: ${e.shortMessage ?? e.message}`);
  }
  plan.transactions.push({
    label,
    from: owner,
    ...tx,
    chainId: 1,
    gasEstimate: estimate,
    value: "0x0",
  });
}
const quoter = await json("docs/repair/package/WalletQuoter.json");
await add("Deploy WalletQuoter (review source + constructor first)", {
  data: encodeDeployData({
    abi: quoter.abi,
    bytecode: quoter.bytecode,
    args: [hook],
  }),
});
if (input) {
  const corpus = buildAllocations(JSON.parse(await readFile(input, "utf8")));
  if (corpus.root !== repair.nativeRoot || BigInt(corpus.total) > round[1])
    throw Error("Full canonical corpus mismatch");
  const artifact = await json("docs/repair/package/NativeSwarmAdapter.json");
  await add(
    "Deploy NativeSwarmAdapter — complete tree verified in constructor",
    {
      data: encodeDeployData({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [
          repair.nativeDistributor,
          hook,
          BigInt(repair.nativeRound),
          corpus.allocations.map((x) => x.account),
          corpus.allocations.map((x) => BigInt(x.amount)),
        ],
      }),
    },
  );
} else
  plan.pending.push(
    "Adapter deployment withheld: full canonical account/amount corpus required, not just an individual claim proof.",
  );
const vaultAbi = await json("docs/abi/MigrationVault.json");
const readVault = (functionName) =>
  client.readContract({
    address: vault,
    abi: vaultAbi,
    functionName,
    blockNumber: block,
  });
const [backing, capacity] = await Promise.all([
  readVault("remainingBacking"),
  readVault("remainingCapacity"),
]);
plan.migration = {
  backing: backing.toString(),
  capacity: capacity.toString(),
  requiredTopUp: (capacity > backing ? capacity - backing : 0n).toString(),
};
if (capacity > backing)
  await add("Fund remaining migration deficit — irreversible transfer", {
    to: token,
    data: encodeFunctionData({
      abi: parseAbi(["function transfer(address,uint256) returns(bool)"]),
      functionName: "transfer",
      args: [vault, capacity - backing],
    }),
  });
await add("Register the verified Universal Router only", {
  to: hook,
  data: encodeFunctionData({
    abi: hookAbi,
    functionName: "setRouter",
    args: [network.uniswapV4.universalRouter, true],
  }),
});
// Future installation records must be independently reviewed, with actual deployed runtime hashes.
for (const kind of ["adapter", "quoter"]) {
  const installed = repair[kind];
  if (!installed) {
    plan.pending.push(
      `${kind} registration withheld until deployment, code verification and installation review`,
    );
    continue;
  }
  if (!repair.installationReviewed) throw Error("Installation is not reviewed");
  const code = await client.getCode({
    address: installed.address,
    blockNumber: block,
  });
  if (!code || keccak256(code) !== installed.runtimeCodeHash)
    throw Error("Installed runtime hash mismatch");
  const a = await json(
    `docs/repair/package/${kind === "adapter" ? "NativeSwarmAdapter" : "WalletQuoter"}.json`,
  );
  const maskRuntime = (hex) => {
    const bytes = hex.slice(2).split("");
    for (const references of Object.values(a.immutableReferences ?? {}))
      for (const { start, length } of references)
        bytes.fill("0", start * 2, (start + length) * 2);
    return bytes.join("").toLowerCase();
  };
  if (maskRuntime(code) !== maskRuntime(a.deployedBytecode))
    throw Error(
      "Installed runtime does not match compiler artifact outside immutable slots",
    );
  const getter = (functionName) =>
    client.readContract({
      address: installed.address,
      abi: a.abi,
      functionName,
      blockNumber: block,
    });
  if (kind === "adapter") {
    if (
      (await getter("nativeDistributor")).toLowerCase() !==
        repair.nativeDistributor.toLowerCase() ||
      (await getter("nativeRound")) !== BigInt(repair.nativeRound) ||
      (await getter("nativeRoot")) !== repair.nativeRoot ||
      (await getter("nativeFunded")) !== BigInt(repair.nativeFunded) ||
      (await getter("allocationCount")) === 0n
    )
      throw Error("Installed adapter canonical configuration mismatch");
  } else if (
    (await getter("poolManager")).toLowerCase() !==
    network.uniswapV4.poolManager.toLowerCase()
  )
    throw Error("Installed quoter manager mismatch");
  const actualHook = await client.readContract({
    address: installed.address,
    abi: a.abi,
    functionName: "hook",
    blockNumber: block,
  });
  if (actualHook.toLowerCase() !== hook.toLowerCase())
    throw Error("Installed auxiliary hook mismatch");
  await add(`Register reviewed ${kind}`, {
    to: hook,
    data: encodeFunctionData({
      abi: hookAbi,
      functionName: kind === "adapter" ? "setSwarmDistributor" : "setRouter",
      args:
        kind === "adapter" ? [installed.address] : [installed.address, true],
    }),
  });
}
await writeFile(output, JSON.stringify(plan, null, 2) + "\n");
console.log(
  `Wrote read-only owner review plan; ${plan.transactions.length} separately simulated unsigned steps. Nothing broadcast.`,
);
