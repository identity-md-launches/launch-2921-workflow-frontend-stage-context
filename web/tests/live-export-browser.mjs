// Production export + real mainnet READS. Node forwards RPC unchanged to work around
// this worker's direct browser POST transport. No wallet or signer exists in this check.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
const pw = process.env.IMD_PLAYWRIGHT
  ? await import(pathToFileURL(process.env.IMD_PLAYWRIGHT))
  : await import("playwright");
const root = resolve(new URL("../../", import.meta.url).pathname),
  rpcUrls = JSON.parse(
    await readFile(resolve(root, "dist/imd-deployment.json"), "utf8"),
  ).network.rpcUrls;
const server = createServer(async (req, res) => {
  try {
    const p = new URL(req.url, "http://localhost").pathname;
    if (!p.startsWith("/preview/")) return res.writeHead(404).end();
    const f = resolve(root, "dist", p.slice(9) || "index.html");
    if (!f.startsWith(resolve(root, "dist") + "/"))
      return res.writeHead(403).end();
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".html": "text/html",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      }[extname(f)] ?? "application/octet-stream",
    );
    res.end(await readFile(f));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ args: ["--no-sandbox"] }),
  context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
  page = await context.newPage();
const report = {
  mode: "Production dist export at local /preview/ with real mainnet RPC reads forwarded unchanged by Node. No mock data, wallet, signer or broadcast. This is not evidence of public deployment.",
  checkedAt: new Date().toISOString(),
  pageErrors: [],
  resourceFailures: [],
  viewports: [],
};
page.on("pageerror", (e) => report.pageErrors.push(e.message));
await context.route(/^https?:\/\//, async (route) => {
  const req = route.request();
  if (rpcUrls.some((url) => req.url().startsWith(url))) {
    try {
      const r = await fetch(req.url(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: req.postData(),
        signal: AbortSignal.timeout(20000),
      });
      return route.fulfill({
        status: r.status,
        contentType: "application/json",
        body: await r.text(),
      });
    } catch (e) {
      report.resourceFailures.push({ url: req.url(), error: e.message });
      return route.abort();
    }
  }
  return route.continue();
});
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/`);
  await page.waitForFunction(
    () => {
      const t = document.querySelector(".read-status")?.textContent;
      return t && /Trading closed|Trading active|RPC unavailable/.test(t);
    },
    {},
    { timeout: 60000 },
  );
  report.readStatus = await page.locator(".read-status").innerText();
  if (report.readStatus.includes("RPC unavailable"))
    throw Error("Real mainnet reads did not complete");
  report.title = await page.title();
  report.doors = await page.locator(".gate-door").count();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    report.viewports.push({
      width,
      noHorizontalOverflow: await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(root, "docs/update/evidence/live-read-only-390.png"),
    fullPage: false,
  });
  await page.locator(".mobile-nav select").selectOption("Integration status");
  report.integrationStatus = await page.locator("main").innerText();
  report.setupWriteButtons = await page
    .getByRole("button", { name: /Activate|Register|Fund migration/ })
    .count();
  report.result = "PASS";
  if (
    report.pageErrors.length ||
    report.resourceFailures.length ||
    report.viewports.some((v) => !v.noHorizontalOverflow) ||
    report.setupWriteButtons
  )
    throw Error("Live export browser check found a failure");
} catch (e) {
  report.result = "Incomplete";
  report.error = e.message.split("\n")[0];
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(root, "docs/update/live-export-browser.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  server.close();
}
console.log(JSON.stringify(report, null, 2));
