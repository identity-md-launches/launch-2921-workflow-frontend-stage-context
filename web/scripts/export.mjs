import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, toBytes } from "viem";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
export const abiHash = (a) =>
  keccak256(toBytes(JSON.stringify(canonical(a)))).slice(2);
export async function inventory(dir, prefix = "") {
  const all = [];
  for (const name of (await readdir(dir)).sort()) {
    const path = prefix + name;
    const s = await stat(resolve(dir, name));
    if (s.isDirectory())
      all.push(...(await inventory(resolve(dir, name), path + "/")));
    else if (path !== "imd-deployment.json") {
      if (s.size > 8388608) throw Error("Asset over 8 MiB");
      all.push({
        path,
        sha256: createHash("sha256")
          .update(await readFile(resolve(dir, name)))
          .digest("hex"),
      });
    }
  }
  return all;
}
export async function generate() {
  const d = JSON.parse(
    await readFile(
      resolve(root, "docs/frontend/deployment-handoff.json"),
      "utf8",
    ),
  );
  const n = JSON.parse(
    await readFile(resolve(root, "docs/frontend/network-handoff.json"), "utf8"),
  );
  const contracts = [];
  for (const c of d.contracts) {
    const abiPath = `abi/${c.name}.json`;
    const a = JSON.parse(
      await readFile(resolve(root, "web/site", abiPath), "utf8"),
    );
    const actual = abiHash(a);
    if (actual !== c.abiHash) throw Error(`${c.name} ABI mismatch: ${actual}`);
    contracts.push({
      name: c.name,
      address: c.address,
      abiHash: c.abiHash,
      abiPath,
    });
  }
  const assets = await inventory(resolve(root, "web/site"));
  if (assets.length > 128) throw Error("Too many assets");
  const m = {
    version: 1,
    launchId: d.launchId,
    chainId: d.chainId,
    sourceCommit: d.sourceCommit,
    attestationHash: d.attestationHash,
    contracts,
    ...(d.poolKey ? { poolKey: d.poolKey } : {}),
    network: n.network,
    ...(n.walletAddChain ? { walletAddChain: n.walletAddChain } : {}),
    assets,
  };
  await writeFile(
    resolve(root, "web/site/imd-deployment.json"),
    JSON.stringify(m, null, 2) + "\n",
  );
  console.log(
    `Verified ABIs; wrote deployment manifest with ${assets.length} SHA-256 assets.`,
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await generate();
