import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { root, abiHash, inventory } from "./export.mjs";
const read = async (p) => JSON.parse(await readFile(resolve(root, p), "utf8"));
const [m, d, n] = await Promise.all(
  [
    "dist/imd-deployment.json",
    "docs/frontend/deployment-handoff.json",
    "docs/frontend/network-handoff.json",
  ].map(read),
);
const allowed = [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
  "contracts",
  "assets",
  "network",
  "walletAddChain",
  ...(d.poolKey ? ["poolKey"] : []),
];
assert.deepEqual(Object.keys(m).sort(), allowed.sort());
for (const k of [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
])
  assert.deepEqual(m[k], d[k]);
assert.deepEqual(m.network, n.network);
assert.deepEqual(m.walletAddChain, n.walletAddChain);
assert.deepEqual(m.poolKey, d.poolKey);
assert.equal(m.contracts.length, d.contracts.length);
for (const c of d.contracts) {
  const actual = m.contracts.find((x) => x.name === c.name);
  assert.ok(actual);
  for (const k of ["name", "address", "abiHash"]) assert.equal(actual[k], c[k]);
  assert.ok(
    !actual.abiPath.includes("..") &&
      !actual.abiPath.startsWith("/") &&
      !actual.abiPath.includes(":"),
  );
  assert.equal(abiHash(await read("dist/" + actual.abiPath)), c.abiHash);
  assert.equal(
    await readFile(resolve(root, "dist", actual.abiPath), "utf8"),
    await readFile(resolve(root, "web/public", actual.abiPath), "utf8"),
  );
}
assert.deepEqual(m.assets, await inventory(resolve(root, "dist")));
assert.ok(m.assets.length <= 128);
assert.ok(m.assets.some((a) => a.path === "index.html"));
let bytes = 0;
for (const a of m.assets) {
  assert.match(a.sha256, /^[\da-f]{64}$/);
  assert.ok(
    !a.path.includes("..") && !a.path.startsWith("/") && !a.path.includes(":"),
  );
  const s = await stat(resolve(root, "dist", a.path));
  assert.ok(s.size <= 8388608);
  bytes += s.size;
}
assert.ok(bytes < 32 * 1024 * 1024);
console.log(
  JSON.stringify(
    {
      result: "PASS",
      assets: m.assets.length,
      exportBytes: bytes,
      abiHashes: "match handoff",
      network: "exact",
      assetInventory: "complete",
    },
    null,
    2,
  ),
);

// Root export is the hosting deliverable; both build outputs must be byte-identical.
assert.deepEqual(await inventory(resolve(root, "dist")), await inventory(resolve(root, "web/site")));
assert.equal(await readFile(resolve(root,"dist/imd-deployment.json"),"utf8"), await readFile(resolve(root,"web/site/imd-deployment.json"),"utf8"));
