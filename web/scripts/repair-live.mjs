import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, http, parseAbi, keccak256 } from "viem";
import { verify } from "./native-proofs.mjs";
const root = new URL("../../", import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const d = await json("docs/frontend/deployment-handoff.json"),
  n = (await json("docs/frontend/network-handoff.json")).network,
  cfg = await json("web/public/repair-config.json");
const c = createPublicClient({
  transport: http(n.rpcUrls[0], { timeout: 20000, retryCount: 0 }),
});
const block = await c.getBlockNumber();
const hook = d.contracts.find((x) => x.name === "UnlockV2Hook").address;
const abi = await json("docs/abi/UnlockV2Hook.json");
const read = (name, args = []) =>
  c.readContract({
    address: hook,
    abi,
    functionName: name,
    args,
    blockNumber: block,
  });
const names = [
  "activated",
  "owner",
  "gatesOpen",
  "swarmDistributor",
  "migrationVault",
  "rewardPot",
  "lastFdvUsd",
  "lastFdvBlock",
  "lastValidObservation",
  "gateImdUsdPrice",
  "fdvUsd",
  "cumulativeVolumeUsd",
  "poolInitialized",
  "isBound",
];
const state = Object.fromEntries(
  await Promise.all(names.map(async (k) => [k, await read(k)])),
);
state.universalRouterRegistered = await read("isRouter", [
  n.uniswapV4.universalRouter,
]);
state.stockQuoterRegistered = await read("isRouter", [n.uniswapV4.quoter]);
const nativeAbi = parseAbi([
  "function roundOf(uint256) view returns(bytes32,uint256,uint256,uint64)",
  "function token() view returns(address)",
  "function claimed(uint256,address) view returns(bool)",
  "function roundCount() view returns(uint256)",
]);
const native = (functionName, args = []) =>
  c.readContract({
    address: cfg.nativeDistributor,
    abi: nativeAbi,
    functionName,
    args,
    blockNumber: block,
  });
const fixture = await json("test/fixtures/native-mainnet-claim.json");
const nativeState = {
  address: cfg.nativeDistributor,
  token: await native("token"),
  roundCount: await native("roundCount"),
  round0: await native("roundOf", [0n]),
  authenticFixtureClaimed: await native("claimed", [0n, fixture.account]),
  fixtureProofValid: verify(
    fixture.account,
    fixture.amount,
    fixture.proof,
    fixture.root,
  ),
};
const compatibility = {};
for (const [label, address, signature, args] of [
  [
    "nativeLegacyRoot",
    cfg.nativeDistributor,
    "function merkleRoot() view returns(bytes32)",
    [],
  ],
  [
    "nativeLegacyClaimed",
    cfg.nativeDistributor,
    "function isClaimed(uint256) view returns(bool)",
    [0n],
  ],
  [
    "stockQuoterMsgSender",
    n.uniswapV4.quoter,
    "function msgSender() view returns(address)",
    [],
  ],
  [
    "routerMsgSender",
    n.uniswapV4.universalRouter,
    "function msgSender() view returns(address)",
    [],
  ],
]) {
  try {
    compatibility[label] = {
      returned: await c.readContract({
        address,
        abi: parseAbi([signature]),
        functionName: signature.split("(")[0].slice(9),
        args,
        blockNumber: block,
      }),
    };
  } catch {
    compatibility[label] = { reverted: true };
  }
}
const contracts = await Promise.all(
  [
    ...d.contracts.map((x) => ({ name: x.name, address: x.address })),
    { name: "nativeDistributor", address: cfg.nativeDistributor },
    { name: "UniversalRouter", address: n.uniswapV4.universalRouter },
    { name: "stockV4Quoter", address: n.uniswapV4.quoter },
  ].map(async (x) => {
    const code = await c.getCode({ address: x.address, blockNumber: block });
    return {
      ...x,
      codeBytes: (code.length - 2) / 2,
      runtimeCodeHash: keccak256(code),
    };
  }),
);
const vaultAbi = await json("docs/abi/MigrationVault.json");
const migration = Object.fromEntries(
  await Promise.all(
    ["remainingBacking", "remainingCapacity", "isFullyFunded"].map(
      async (functionName) => [
        functionName,
        await c.readContract({
          address: state.migrationVault,
          abi: vaultAbi,
          functionName,
          blockNumber: block,
        }),
      ],
    ),
  ),
);
await writeFile(
  new URL("docs/repair/evidence/live-read.json", root),
  JSON.stringify(
    {
      mode: "LIVE READS ONLY — no signer, broadcasts or state overrides",
      checkedAt: new Date().toISOString(),
      chainId: await c.getChainId(),
      block,
      state,
      migration,
      nativeState,
      compatibility,
      contracts,
      auxiliaries: "Pending installation; no auxiliary address supplied",
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n",
);
console.log(`Verified live state at block ${block}; read-only report written.`);
