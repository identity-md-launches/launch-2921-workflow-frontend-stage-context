import { chromium } from "playwright";
import { resolve } from "node:path";
import { root } from "./export.mjs";
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;background:#000000;color:#e5e5e5;font-family:monospace"><div style="padding:62px 72px"><div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:32px;border-bottom:1px solid #333333;font-size:22px"><span style="color:#a5f3ce">UNLOCK V2</span><span style="color:#aaaaaa">Ethereum mainnet</span></div><div style="display:grid;grid-template-columns:1fr 300px;gap:60px;margin-top:54px"><div><div style="font-size:52px;line-height:1.15">UNLK2 / IMD</div><p style="font-size:24px;color:#aaaaaa;line-height:1.5">Official pool · Permanent gates</p><div style="margin-top:44px;font-size:20px;color:#a5f3ce;border:1px solid #333333;padding:20px">10 permanent gates · IMD fee rewards</div></div><div style="border:1px solid #333333;padding:30px;display:flex;flex-direction:column;gap:16px">${Array.from({ length: 10 }, (_, i) => `<div style="display:flex;align-items:center;gap:18px;font-size:16px;color:#aaaaaa"><span>${String(i + 1).padStart(2, "0")}</span><div style="height:4px;width:${40 + i * 16}px;background:#a5f3ce"></div></div>`).join("")}</div></div><p style="margin-top:48px;color:#aaaaaa;font-size:17px">Pending owner setup · Irreversible burns · No promised returns</p></div></body></html>`,
  );
  await page.screenshot({ path: resolve(root, "web/public/og-image.png") });
} finally {
  await browser.close();
}
