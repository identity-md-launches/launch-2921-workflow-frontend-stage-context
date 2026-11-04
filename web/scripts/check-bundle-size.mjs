// Conservative upload guard: count full changed/new ordinary files, including evidence.
import { execFileSync } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const baseline = process.argv[2] ?? "5c7b53d40fcd1a323f033a5b1f7b3e496df63040";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const files = [...new Set([
  ...git("diff", "--name-only", "-z", baseline, "--"),
  ...git("ls-files", "--others", "--exclude-standard", "-z"),
])];
const reportPath = "docs/repair/evidence/bundle-size.json";
if (!files.includes(reportPath)) files.push(reportPath);
for (const path of files) {
  if (!/^(src|test|script|docs|web|scripts|artifacts)\//.test(path)) throw Error(`Out-of-scope change: ${path}`);
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
