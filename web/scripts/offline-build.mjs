// Network-free source build. The full npm/Vite workflow remains available for typechecking/dev.
import { readFile, writeFile, mkdir, mkdtemp, rm, cp, chmod } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyOffline, offlineRoot, sha256 } from "./offline-verify.mjs";
const manifest = await verifyOffline();
if (process.platform !== manifest.compiler.platform || process.arch !== manifest.compiler.arch)
  throw Error("Offline compiler supports Linux x64. Use the pinned npm/Vite workflow on other platforms.");
const web = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(web, "site");
const temp = await mkdtemp(join(tmpdir(), "unlock-offline-build-"));
try {
  const compiler = join(temp, "esbuild");
  const fd = openSync(compiler, "w", 0o700);
  try { execFileSync("xz", ["-dc", fileURLToPath(new URL("esbuild-linux-x64.xz", offlineRoot))], { stdio: ["ignore", fd, "inherit"] }); }
  finally { closeSync(fd); }
  if (sha256(await readFile(compiler)) !== manifest.compiler.sha256) throw Error("Compiler integrity mismatch");
  await chmod(compiler, 0o700);
  if (execFileSync(compiler, ["--version"], { encoding: "utf8" }).trim() !== manifest.compiler.version)
    throw Error("Unexpected compiler version");
  // Build before replacing the delivered export; compile failures leave it intact.
  const build = join(temp, "site");
  await mkdir(build);
  await cp(resolve(web, "public"), build, { recursive: true });
  const aliases = {
    "viem": "viem.mjs", "react": "react.mjs", "react/jsx-runtime": "react-jsx-runtime.mjs",
    "react-dom/client": "react-dom-client.mjs", "@coinbase/wallet-sdk": "coinbase.mjs",
  };
  execFileSync(compiler, [resolve(web, "src/main.tsx"), "--bundle", "--minify", "--splitting", "--format=esm",
    "--platform=browser", "--target=es2022", "--jsx=automatic", '--define:process.env.NODE_ENV="production"',
    `--outdir=${join(build,"assets")}`, "--entry-names=index-[hash]", "--chunk-names=chunk-[hash]",
    `--metafile=${join(temp,"meta.json")}`,
    ...Object.entries(aliases).map(([name,file]) => `--alias:${name}=${fileURLToPath(new URL(file, offlineRoot))}`),
  ], { cwd: web, stdio: "inherit" });
  const meta = JSON.parse(await readFile(join(temp,"meta.json"), "utf8"));
  const entry = Object.entries(meta.outputs).find(([,v]) => v.entryPoint && resolve(web,v.entryPoint) === resolve(web,"src/main.tsx"));
  if (!entry) throw Error("Missing application entry");
  const assetPath = (path) => "./" + relative(build, resolve(web,path)).split("\\").join("/");
  let html = await readFile(resolve(web,"index.html"), "utf8");
  const tag = '<script type="module" src="/src/main.tsx"></script>';
  if (!html.includes(tag)) throw Error("Unknown HTML entry template");
  html = html.replace(tag, `<script type="module" src="${assetPath(entry[0])}"></script>`);
  if (entry[1].cssBundle) html = html.replace("</head>", `  <link rel="stylesheet" href="${assetPath(entry[1].cssBundle)}" />\n  </head>`);
  await writeFile(join(build,"index.html"), html);
  await rm(output, { recursive: true, force: true });
  await cp(build, output, { recursive: true });
  // export.mjs uses viem; re-execute with the bundled-dependency resolver.
  execFileSync(process.execPath, ["--import", fileURLToPath(new URL("./offline-register.mjs",import.meta.url)),
    fileURLToPath(new URL("./export.mjs",import.meta.url))], { stdio: "inherit" });
  console.log("Offline source build complete. This transpilation does not replace npm run typecheck.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
