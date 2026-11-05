// Read-only public URL/browser check. Public RPC payloads are forwarded unchanged by Node
// because the worker's browser transport cannot POST to the public RPC hosts directly.
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const pw = process.env.IMD_PLAYWRIGHT
  ? await import(pathToFileURL(process.env.IMD_PLAYWRIGHT))
  : await import("playwright");
const root = new URL("../../", import.meta.url),
  network = JSON.parse(
    await readFile(new URL("docs/frontend/network-handoff.json", root), "utf8"),
  ).network;
const browser = await pw.chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  }),
  page = await context.newPage();
const report = {
  mode: "Existing public URL, read-only browser inspection. RPC POST bodies forwarded unchanged through the worker Node transport; no mock data, wallet or signer. This does not publish or establish that the new export is public.",
  url: "https://unlock-v2.imd.site/",
  checkedAt: new Date().toISOString(),
  pageErrors: [],
  failedResources: [],
  viewports: [],
};
page.on("pageerror", (e) => report.pageErrors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400)
    report.failedResources.push({ url: r.url(), status: r.status() });
});
await context.route(
  /^https:\/\/(ethereum-rpc\.publicnode\.com|eth\.drpc\.org)\/?$/,
  async (route) => {
    const req = route.request();
    try {
      const response = await fetch(req.url(), {
        method: req.method(),
        headers: { "Content-Type": "application/json" },
        body: req.postData() ?? undefined,
        signal: AbortSignal.timeout(20000),
      });
      await route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: await response.text(),
      });
    } catch (e) {
      report.failedResources.push({ url: req.url(), error: e.message });
      await route.abort();
    }
  },
);
try {
  const response = await page.goto(report.url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  report.httpStatus = response?.status();
  report.title = await page.title();
  await page.waitForFunction(
    () => {
      const t = document.querySelector(".read-status")?.textContent;
      return t && /Trading closed|Trading active|RPC unavailable/.test(t);
    },
    {},
    { timeout: 45000 },
  );
  report.readStatus = await page.locator(".read-status").innerText();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    report.viewports.push({
      width,
      noHorizontalOverflow: await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    });
  }
  report.result = "Read-only browser inspection finished";
} catch (e) {
  report.result = "Incomplete";
  report.error = e.message.split("\n")[0];
  process.exitCode = 1;
} finally {
  await writeFile(
    new URL("docs/update/public-browser.json", root),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
