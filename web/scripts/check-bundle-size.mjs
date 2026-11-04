// Conservative upload guard: count full changed/new ordinary files, including evidence.
import { execFileSync } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const baseline = process.argv[2] ?? execFileSync("git", ["rev-parse", "HEAD"], {cwd:root,encoding:"utf8"}).trim();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const files = [...new Set([
  ...git("diff", "--name-only", "-z", baseline, "--"),
  ...git("ls-files", "--others", "--exclude-standard", "-z"),
])];
const currentChanges = new Set([...git("diff", "--name-only", "-z", "HEAD", "--"), ...git("ls-files", "--others", "--exclude-standard", "-z")]);
const reportPath = "docs/repair/evidence/bundle-size.json";
if (!files.includes(reportPath)) files.push(reportPath);
for (const path of files) {
  if (!/^(src|test|script|docs|web|scripts|artifacts|dist)\//.test(path) && !["README.md", "DESIGN.md", ".gitignore"].includes(path)) throw Error(`Out-of-scope change: ${path}`);
  if (/(^|\/)(node_modules|\.cache|\.npm|\.vite|test-results|playwright-report)(\/|$)/.test(path)) throw Error(`Generated dependency/cache in bundle: ${path}`);
  if (currentChanges.has(path) && /^(lib\/|\.git\/|\.github\/)|(^|\/)\.env(?:\.|$)|(^|\/)(package\.json|[^/]*\.lock|[^/]*-lock\.(json|yaml)|pnpm-lock\.yaml|bun\.lockb|remappings\.txt|foundry\.toml|\.gitmodules)$/.test(path)) throw Error(`Protected path changed: ${path}`);
}
const measure = async () => {
  const rows = [];
  for (const path of files) {
    try {
      const st = await lstat(resolve(root, path));
      if (st.isFile()) rows.push({ path, bytes: st.size });
      else if (st.isSymbolicLink()) throw Error(`Unexpected symlink: ${path}`);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  rows.sort((a,b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  return rows;
};
let previous = -1;
let report;
for (let attempt = 0; attempt < 10; attempt++) {
  const rows = await measure();
  const sourceBytes = rows.reduce((sum,row) => sum + row.bytes, 0);
  report = {
    baseline, method: "Full size of every changed/new ordinary file; deleted files count zero. Includes this report.",
    sourceBytes, limitBytes: 8388608, remainingBytes: 8388608 - sourceBytes,
    passed: sourceBytes <= 8388608, ordinaryFileCount: rows.length, largestFiles: rows.slice(0,12),
  };
  await writeFile(resolve(root, reportPath), JSON.stringify(report, null, 2) + "\n");
  if (sourceBytes === previous) break;
  previous = sourceBytes;
  if (attempt === 9) throw Error("Size report did not stabilize");
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
