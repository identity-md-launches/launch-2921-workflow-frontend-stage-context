import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
export const offlineRoot = new URL("../vendor/offline/", import.meta.url);
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export async function verifyOffline() {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", offlineRoot), "utf8"));
  if (sha256(await readFile(new URL("../../package-lock.json", offlineRoot))) !== manifest.lockSha256)
    throw Error("Offline dependency package does not match package-lock.json; regenerate it.");
  for (const [file, expected] of Object.entries(manifest.assets)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(file)) throw Error("Invalid offline asset path");
    const bytes = await readFile(new URL(file, offlineRoot));
    if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256)
      throw Error(`Offline dependency integrity mismatch: ${file}`);
  }
  return manifest;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await verifyOffline();
  console.log(`Verified ${Object.keys(manifest.assets).length} offline assets against the pinned lockfile.`);
}
