import { chromium } from "playwright";
import { resolve } from "node:path";
import { root } from "./export.mjs";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;background:#050807;color:#e0eae4;font-family:monospace"><div style="padding:62px 72px"><div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:32px;border-bottom:1px solid #2d4136;font-size:22px"><span style="color:#a5f3ce">UNLOCK V2</span><span style="color:#9aada2">Ethereum mainnet</span></div><div style="display:grid;grid-template-columns:1fr 300px;gap:60px;margin-top:54px"><div><div style="font-size:52px;line-height:1.15">UNLK2 / IMD</div><p style="font-size:24px;color:#9aada2;line-height:1.5">Trade. Migrate. Burn for points.</p><div style="margin-top:44px;font-size:20px;color:#a5f3ce;border:1px solid #2d4136;padding:20px">10 permanent gates · Weekly IMD rewards</div></div><div style="border:1px solid #2d4136;padding:30px;display:flex;flex-direction:column;gap:16px">${Array.from({ length: 10 }, (_, i) => `<div style="display:flex;align-items:center;gap:18px;font-size:16px;color:#9aada2"><span>${String(i + 1).padStart(2, "0")}</span><div style="height:4px;width:${40 + i * 16}px;background:#a5f3ce"></div></div>`).join("")}</div></div><p style="margin-top:48px;color:#9aada2;font-size:17px">Official-pool rules. Irreversible burns. No promised returns.</p></div></body></html>`,
  );
  await page.screenshot({ path: resolve(root, "web/public/og-image.png") });
} finally {
  await browser.close();
}
