// Read-only check usable before and after the platform publishes the committed static export.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../../", import.meta.url),
  base = "https://unlock-v2.imd.site/";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const get = async (path) => {
  const r = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!r.ok) throw Error(`HTTP ${r.status} for ${path}`);
  return {
    status: r.status,
    url: r.url,
    bytes: Buffer.from(await r.arrayBuffer()),
  };
};
const [index, manifest, repair] = await Promise.all([
  get(""),
  get("imd-deployment.json"),
  get("repair-config.json"),
]);
const remote = JSON.parse(manifest.bytes),
  cfg = JSON.parse(repair.bytes),
  expectedCfg = JSON.parse(
    await readFile(new URL("dist/repair-config.json", root), "utf8"),
  );
const assets = [];
for (const asset of remote.assets) {
  if (
    asset.path.startsWith("/") ||
    asset.path.includes("..") ||
    asset.path.includes(":")
  )
    throw Error("Unsafe remote asset path");
  const r = await get(asset.path);
  assets.push({
    path: asset.path,
    status: r.status,
    hashMatches: hash(r.bytes) === asset.sha256,
  });
}
const exportMatches =
  hash(index.bytes) ===
    hash(await readFile(new URL("dist/index.html", root))) &&
  JSON.stringify(remote) ===
    (await readFile(new URL("dist/imd-deployment.json", root), "utf8").then(
      (s) => JSON.stringify(JSON.parse(s)),
    ));
const configMatches = JSON.stringify(cfg) === JSON.stringify(expectedCfg);
const report = {
  mode: "Read-only HTTPS public-site verification. No publishing command, wallet or chain write.",
  checkedAt: new Date().toISOString(),
  url: base,
  httpStatus: index.status,
  https: index.url.startsWith("https:"),
  title: index.bytes.toString().match(/<title>(.*?)<\/title>/s)?.[1],
  assets,
  allPublicAssetsMatchTheirManifest: assets.every((a) => a.hashMatches),
  matchesDeliveredExport: exportMatches,
  matchesDeliveredConfig: configMatches,
  publicationStatus:
    exportMatches && configMatches
      ? "Delivered version is publicly visible"
      : "Existing public version is still different; publication/post-publication verification pending",
  publicConfig: {
    adapter: cfg.adapter?.address ?? null,
    quoter: cfg.quoter?.address ?? null,
    installationReviewed: cfg.installationReviewed,
  },
};
await writeFile(
  new URL("docs/update/public-url.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report.publicationStatus);
console.log(
  `HTTPS ${index.status}; ${assets.length} assets checked; current title: ${report.title}`,
);
