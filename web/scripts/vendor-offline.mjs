// Regenerate only after a normal npm ci using the pinned web/package-lock.json.
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(web, "vendor/offline");
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const reactNames = Object.keys(require(resolve(web, "node_modules/react/cjs/react.development.js"))).filter(k => k !== "default" && /^[A-Za-z_$][\w$]*$/.test(k));
const entries = {
  viem: 'export * from "viem";',
  react: `import R from "react"; export default R; export const {${reactNames.join(",")}} = R;`,
  "react-jsx-runtime": 'import R from "react/jsx-runtime"; export const {jsx, jsxs, Fragment} = R;',
  "react-dom-client": 'import R from "react-dom/client"; export const {createRoot, hydrateRoot, version} = R;',
  coinbase: 'export * from "@coinbase/wallet-sdk";',
};
const packages = new Map();
const hash = (b) => createHash("sha256").update(b).digest("hex");
for (const [name, contents] of Object.entries(entries)) {
  const result = await build({
    stdin: { contents, resolveDir: web },
    outfile: resolve(out, name + ".mjs"),
    bundle: true, format: "esm", platform: "browser", target: "es2022",
    minify: true, legalComments: "eof", metafile: true,
    external: name === "react-dom-client" ? ["react"] : [],
    banner: name === "react-dom-client" ? {js: 'import ReactExternal from "react"; const require = (name) => { if (name === "react") return ReactExternal; throw new Error("Unexpected external dependency: " + name); };'} : {},
    define: { "process.env.NODE_ENV": '"production"' },
  });
  for (const input of Object.keys(result.metafile.inputs)) {
    if (input === "<stdin>") continue;
    let dir = dirname(resolve(input));
    while (dir.startsWith(resolve(web, "node_modules"))) {
      try {
        const pkg = JSON.parse(await readFile(resolve(dir, "package.json"), "utf8"));
        if (pkg.name && pkg.version) { packages.set(dir, pkg); break; }
      } catch {}
      dir = dirname(dir);
    }
  }
}
// One pinned Linux x64 compiler; no registry metadata, package tarballs or cache.
const binary = await readFile(resolve(web, "node_modules/@esbuild/linux-x64/bin/esbuild"));
await writeFile(resolve(out, "esbuild-linux-x64.xz"), execFileSync("xz", ["-9", "-c"], { input: binary, maxBuffer: 20 * 1024 * 1024 }));
const esbuildDir = resolve(web, "node_modules/@esbuild/linux-x64");
packages.set(esbuildDir, JSON.parse(await readFile(resolve(esbuildDir, "package.json"), "utf8")));
// esbuild's MIT license is published at the pinned source URL below.
let licenses = "Offline dependency bundles — licenses and provenance\n\n";
const versions = [];
for (const [dir, pkg] of [...packages].sort((a,b) => a[1].name.localeCompare(b[1].name))) {
  versions.push({ name: pkg.name, version: pkg.version, license: pkg.license });
  licenses += `\n===== ${pkg.name}@${pkg.version} (${pkg.license}) =====\n`;
  let found = false;
  for (const file of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENSE-MIT", "COPYING"]) {
    try { licenses += await readFile(resolve(dir, file), "utf8"); found = true; break; } catch {}
  }
  if (!found) licenses += `See package license: ${pkg.license}; source ${JSON.stringify(pkg.repository ?? pkg.homepage)}\n`;
}
licenses += "\n===== esbuild@0.25.12 MIT license =====\n" + await readFile(resolve(web, "vendor/ESBUILD-LICENSE"), "utf8");
await writeFile(resolve(out, "LICENSES.txt"), licenses);
const assets = {};
for (const file of [...Object.keys(entries).map(n => n + ".mjs"), "esbuild-linux-x64.xz", "LICENSES.txt"]) {
  const data = await readFile(resolve(out, file));
  assets[file] = { bytes: data.length, sha256: hash(data) };
}
await writeFile(resolve(out, "manifest.json"), JSON.stringify({
  format: 1, compiler: { version: "0.25.12", platform: "linux", arch: "x64", sha256: hash(binary) },
  lockSha256: hash(await readFile(resolve(web,"package-lock.json"))),
  packages: versions, assets,
}, null, 2) + "\n");
