// Read-only provenance, runtime and binding checks; never creates a wallet or sends a transaction.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createPublicClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
} from "viem";
const root = new URL("../../", import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const d = await json("docs/frontend/deployment-handoff.json"),
  n = (await json("docs/frontend/network-handoff.json")).network,
  cfg = await json("web/public/repair-config.json");
const c = createPublicClient({
  transport: http(n.rpcUrls[0], { timeout: 20000, retryCount: 1 }),
});
const block = await c.getBlockNumber();
const hook = d.contracts.find((x) => x.name === "UnlockV2Hook").address,
  token = d.contracts.find((x) => x.name === "UnlockV2Token").address,
  abi = await json("docs/abi/UnlockV2Hook.json");
const read = (functionName, args = []) =>
  c.readContract({
    address: hook,
    abi,
    functionName,
    args,
    blockNumber: block,
  });
const state = Object.fromEntries(
  await Promise.all(
    [
      "activated",
      "owner",
      "swarmDistributor",
      "gatesOpen",
      "poolInitialized",
      "isBound",
      "isReferenceAvailable",
      "poolKey",
      "officialPoolId",
      "referencePoolId",
      "migrationVault",
      "rewardPot",
      "imdUsdPrice",
      "tokenPriceInImd",
      "token",
      "imd",
      "poolManager",
      "expectedChainId",
    ].map(async (name) => [name, await read(name)]),
  ),
);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
assert((await c.getChainId()) === 1, "RPC must be Ethereum mainnet");
assert(
  same(state.token, token) &&
    same(state.imd, n.pairToken.address) &&
    same(state.poolManager, n.uniswapV4.poolManager) &&
    state.expectedChainId === 1n,
  "Hook bindings mismatch",
);
state.routerRegistered = await read("isRouter", [n.uniswapV4.universalRouter]);
state.quoterRegistered = await read("isRouter", [cfg.quoter.address]);
const auxabi = parseAbi([
  "function hook() view returns(address)",
  "function poolManager() view returns(address)",
  "function nativeDistributor() view returns(address)",
  "function nativeRound() view returns(uint256)",
  "function nativeRoot() view returns(bytes32)",
  "function nativeFunded() view returns(uint256)",
  "function allocationCount() view returns(uint256)",
]);
const auxiliary = [];
for (const kind of ["adapter", "quoter"]) {
  const target = cfg[kind];
  const code = await c.getCode({ address: target.address, blockNumber: block });
  const actual = keccak256(code);
  assert(actual === target.runtimeCodeHash, kind + " runtime hash mismatch");
  const get = (functionName) =>
    c.readContract({
      address: target.address,
      abi: auxabi,
      functionName,
      blockNumber: block,
    });
  const binding = await get("hook");
  assert(same(binding, hook), kind + " hook mismatch");
  const entry = { kind, ...target, actualCodeHash: actual, hook: binding };
  if (kind === "quoter") {
    entry.poolManager = await get("poolManager");
    assert(
      same(entry.poolManager, n.uniswapV4.poolManager),
      "Quoter manager mismatch",
    );
  } else {
    for (const name of [
      "nativeDistributor",
      "nativeRound",
      "nativeRoot",
      "nativeFunded",
      "allocationCount",
    ])
      entry[name] = await get(name);
    assert(
      same(entry.nativeDistributor, cfg.nativeDistributor) &&
        String(entry.nativeRound) === cfg.nativeRound &&
        entry.nativeRoot === cfg.nativeRoot &&
        String(entry.nativeFunded) === cfg.nativeFunded &&
        entry.allocationCount > 0n,
      "Native proof binding mismatch",
    );
  }
  auxiliary.push(entry);
}
const inventory = await json("web/public/contract-runtime.json");
const core = [];
for (const pinned of inventory.contracts) {
  const code = await c.getCode({ address: pinned.address, blockNumber: block });
  const actual = keccak256(code);
  assert(actual === pinned.runtimeCodeHash, pinned.name + " runtime mismatch");
  core.push({ ...pinned, actualCodeHash: actual });
}
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const abiHashes = [];
for (const contract of d.contracts) {
  const a = await json(`docs/abi/${contract.name}.json`);
  const hash = keccak256(
    new TextEncoder().encode(JSON.stringify(canonical(a))),
  ).slice(2);
  assert(hash === contract.abiHash, contract.name + " ABI hash mismatch");
  abiHashes.push({
    name: contract.name,
    expected: contract.abiHash,
    actual: hash,
  });
}
const vaultAbi = await json("docs/abi/MigrationVault.json");
for (const name of [
  "remainingBacking",
  "remainingCapacity",
  "isFullyFunded",
  "totalMigrated",
])
  state[name] = await c.readContract({
    address: state.migrationVault,
    abi: vaultAbi,
    functionName: name,
    blockNumber: block,
  });
const poolHash = (key) =>
  keccak256(
    encodeAbiParameters(
      parseAbiParameters("address,address,uint24,int24,address"),
      key,
    ),
  );
assert(
  poolHash(state.poolKey) === state.officialPoolId,
  "Official PoolKey hash mismatch",
);
assert(
  poolHash([
    "0x0000000000000000000000000000000000000000",
    n.pairToken.address,
    10000,
    200,
    "0x0000000000000000000000000000000000000000",
  ]) === state.referencePoolId,
  "Reference pool mismatch",
);
assert(
  state.routerRegistered &&
    state.quoterRegistered &&
    same(state.swarmDistributor, cfg.adapter.address),
  "Completed registration differs from reviewed installation",
);
assert(
  state.remainingBacking >= state.remainingCapacity,
  "Migration backing below remaining capacity",
);
const report = {
  mode: "LIVE READ-ONLY. No signer, broadcast, setup, funding or activation. Activation is a separate reported state.",
  checkedAt: new Date().toISOString(),
  chainId: 1,
  block,
  state,
  auxiliary,
  core,
  abiHashes,
};
await writeFile(
  new URL("docs/update/live-state.json", root),
  JSON.stringify(
    report,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n",
);
console.log(
  `Verified runtime hashes, ABI hashes, bindings, both PoolKeys, registrations and migration backing at block ${block}. activated=${state.activated}`,
);
