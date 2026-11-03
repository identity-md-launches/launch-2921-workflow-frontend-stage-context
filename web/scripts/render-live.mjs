import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { root } from "./export.mjs";
const folder = resolve(root, "docs/frontend/evidence");
await mkdir(folder, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/preview/")) return res.writeHead(404).end();
    const file = resolve(root, "dist", url.pathname.slice(9) || "index.html");
    if (!file.startsWith(resolve(root, "dist") + "/"))
      return res.writeHead(403).end();
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
const result = {
  observedAt: new Date().toISOString(),
  mode: "Unmodified production export. Actual configured public RPC requests. No injected wallet, mocks, signing or broadcasting.",
  viewports: [],
  screens: [],
  rpcMethods: [],
  consoleErrors: [],
  failedLocalResources: [],
};
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => result.consoleErrors.push(e.message));
  page.on("request", (req) => {
    if (req.method() === "POST") {
      try {
        const body = req.postDataJSON();
        for (const q of Array.isArray(body) ? body : [body])
          if (!result.rpcMethods.includes(q.method))
            result.rpcMethods.push(q.method);
      } catch {}
    }
  });
  page.on("response", (res) => {
    if (res.url().startsWith(url) && res.status() >= 400)
      result.failedLocalResources.push({
        path: res.url().slice(url.length),
        status: res.status(),
      });
  });
  await page.goto(url);
  await page
    .getByText("● Trading closed", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(200);
  assert.equal(await page.getByText(/Live state unavailable/).count(), 0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(overflow.scrollWidth <= width);
    const action = await page.locator(".swap-panel .action").boundingBox();
    if (width === 390) assert.ok(action.y + action.height <= 844);
    result.viewports.push({ ...overflow, mainAction: action });
    if ([320, 390, 1440].includes(width))
      await page.screenshot({
        path: resolve(folder, `live-trade-${width}.png`),
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, slug] of [
    ["Gates", "gates"],
    ["Migrate", "migrate"],
    ["My Rights", "my-rights"],
    ["Burn & Points", "burn-points"],
    ["Weekly IMD Rewards", "weekly-imd-rewards"],
    ["Golden Vault", "golden-vault"],
    ["Rules / Contracts", "rules-contracts"],
    ["Founder setup", "founder-setup"],
  ]) {
    await page.locator("#screen-nav").selectOption(name);
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false, name);
    result.screens.push({ name, overflow });
    if (["Gates", "Founder setup"].includes(name))
      await page.screenshot({
        path: resolve(folder, `live-${slug}-390.png`),
        fullPage: true,
      });
  }
  assert.deepEqual(result.consoleErrors, []);
  assert.deepEqual(result.failedLocalResources, []);
  assert.ok(!result.rpcMethods.some((m) => /send|sign/i.test(m)));
  result.result = "PASS";
} catch (e) {
  result.result = "FAIL";
  result.error = e.message;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    resolve(folder, "live-browser.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
}
