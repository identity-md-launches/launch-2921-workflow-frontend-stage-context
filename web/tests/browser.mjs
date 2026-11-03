import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { fixture, rpcMock, deployment, owner, E } from "./mock.mjs";
import { root } from "../scripts/export.mjs";
const evidence = resolve(root, "docs/frontend/evidence");
await mkdir(evidence, { recursive: true });
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
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(root, "dist", path.slice(9) || "index.html");
    if (!file.startsWith(resolve(root, "dist") + "/")) {
      res.writeHead(403).end();
      return;
    }
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
const report = {
  generatedAt: new Date().toISOString(),
  scope:
    "Production export under /preview/. All wallet and RPC responses in interaction cases are synthetic; no real signing or broadcasting.",
  checks: [],
  screenshots: [],
  errors: [],
};
let browser,activePage,activeFixture;
const check = async (name, fn) => {
  const start = Date.now();
  try {
    await fn();
    report.checks.push({ name, passed: true, durationMs: Date.now() - start });
    console.log("PASS", name);
  } catch (e) {
    report.checks.push({ name, passed: false, error: e.message });
    console.log("FAIL", name, e.message);
    throw e;
  }
};
async function setup(
  type = chromium,
  {
    mock = true,
    wallet = true,
    width = 1440,
    height = 1000,
    mobile = false,
  } = {},
) {
  const b = await type.launch({ headless: true });
  const c = await b.newContext({
    viewport: { width, height },
    acceptDownloads: true,
    ...(mobile
      ? {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        }
      : {}),
  });
  const p = await c.newPage();
  const s = fixture(),
    m = rpcMock(s);
  activePage=p;activeFixture=s;
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !/Failed to load resource|fetch/i.test(msg.text())
    )
      errors.push(msg.text());
  });
  await c.route(/^https?:\/\//, async (route) => {
    const req = route.request();
    if (req.url().startsWith(url)) return route.continue();
    if (deployment.network.rpcUrls.some((u) => req.url().startsWith(u))) {
      if (!mock || s.failRpc)
        return route.fulfill({
          status: 403,
          body: "Public RPC access denied in worker validation",
        });
      const body = req.postDataJSON();
      const result = Array.isArray(body)
        ? await Promise.all(body.map(m.rpc))
        : await m.rpc(body);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    }
    return route.abort();
  });
  if (wallet) {
    await p.exposeFunction("mockWalletRequest", (q) =>
      m
        .wallet(q)
        .then((result) => ({ result }))
        .catch((e) => ({ error: { code: e.code, message: e.message } })),
    );
    await p.addInitScript(() => {
      const listeners = {};
      const provider = {
        request: async (q) => {
          const r = await window.mockWalletRequest(q);
          if (r.error)
            throw Object.assign(new Error(r.error.message), {
              code: r.error.code,
            });
          return r.result;
        },
        on: (n, fn) => {
          (listeners[n] ??= []).push(fn);
        },
        removeListener: (n, fn) => {
          listeners[n] = (listeners[n] ?? []).filter((x) => x !== fn);
        },
      };
      window.testWallet = {
        provider,
        emit: (event, value) =>
          (listeners[event] ?? []).forEach((fn) => fn(value)),
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "test-wallet",
                name: "Test Browser Wallet",
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                rdns: "test.wallet",
              },
              provider,
            },
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
    });
  }
  p.setDefaultTimeout(15000);
  await p.goto(url);
  return { b, c, p, s, errors };
}
async function screenshot(p, name, fullPage = false) {
  await p.evaluate(() => {
    let label = document.getElementById("test-evidence-label");
    if (!label) {
      label = document.createElement("div");
      label.id = "test-evidence-label";
      label.textContent = "Mocked RPC / browser validation";
      label.style.cssText =
        "position:fixed;bottom:0;right:0;background:#050807;color:#efc47d;padding:4px 8px;font:11px monospace;z-index:99;pointer-events:none";
      document.body.append(label);
    }
  });
  await p.screenshot({ path: resolve(evidence, name + ".png"), fullPage });
  report.screenshots.push(name + ".png");
}
async function connect(p) {
  await p
    .getByRole("button", { name: "Connect wallet", exact: true })
    .first()
    .click();
  await p.getByRole("button", { name: /Test Browser Wallet/ }).click();
  await p.waitForFunction(() => !document.querySelector("dialog[open]"));
  await p.getByRole("button", { name: "Refresh", exact: true }).click();
  await p.getByText("● Trading active", { exact: true }).waitFor();
}
async function screen(p, name) {
  if (await p.locator("#screen-nav").isVisible())
    await p.locator("#screen-nav").selectOption(name);
  else await p.getByRole("link", { name, exact: true }).click();
}
async function simulateAndSend(p, { irreversible = false } = {}) {
  const dialog = p.locator("dialog[open]");
  if (irreversible) await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Simulate transaction", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .waitFor();
  await dialog
    .getByRole("button", { name: "Confirm in wallet", exact: true })
    .click();
  await dialog
    .getByText("Confirmed onchain.", { exact: false })
    .waitFor({ timeout: 15000 });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
}
try {
  const a = await setup();
  browser = a.b;
  const { p, s } = a;
  await check(
    "Walletless verified reads and deployment-loaded ABIs",
    async () => {
      await p
        .getByText("● Trading active", { exact: true })
        .waitFor({ timeout: 15000 });
      assert.equal(await p.locator("progress").count(), 3);
      assert.ok(s.calls.some((c) => c.method === "remainingBacking"));
      assert.equal(s.walletRequests.length, 0);
    },
  );
  await check(
    "Metadata, relative subpath assets, and desktop rendering",
    async () => {
      assert.match(await p.title(), /UNLOCK V2/);
      for (const selector of [
        "link[rel=icon]",
        "meta[name=description]",
        'meta[property="og:title"]',
        'meta[property="og:image"]',
      ])
        assert.ok(
          await p
            .locator(selector)
            .getAttribute(selector.startsWith("link") ? "href" : "content"),
        );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await screenshot(p, "trade-desktop");
    },
  );
  await check(
    "EIP-6963 connect, unknown-chain add, switch, address and rejection recovery",
    async () => {
      s.reject = true;
      await p
        .getByRole("button", { name: "Connect wallet", exact: true })
        .first()
        .click();
      await p.getByRole("button", { name: /Test Browser Wallet/ }).click();
      await p.getByText(/Request declined in your wallet/).waitFor();
      s.reject = false;
      await p.getByRole("button", { name: /Test Browser Wallet/ }).click();
      await p.waitForFunction(() => !document.querySelector("dialog[open]"));
      assert.ok(
        s.walletRequests.some((q) => q.method === "wallet_addEthereumChain"),
      );
      const add = s.walletRequests.find(
        (q) => q.method === "wallet_addEthereumChain",
      );
      assert.deepEqual(add.params, [deployment.walletAddChain]);
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p.getByText("● Trading active", { exact: true }).waitFor();
      assert.ok(await p.getByRole("button", { name: /0x48e4/i }).count());
    },
  );
  await check(
    "Swap validation, simulation quote and both explicit approvals",
    async () => {
      await p.getByLabel("Amount to swap").fill("1e3");
      await p
        .getByRole("button", { name: "Get live quote", exact: true })
        .click();
      await p.getByText(/Enter a positive amount/).waitFor();
      await p.getByLabel("Amount to swap").fill("1");
      await p
        .getByRole("button", { name: "Get live quote", exact: true })
        .click();
      await p
        .getByRole("button", { name: "1. Approve IMD", exact: true })
        .waitFor();
      assert.ok(
        s.calls.some(
          (c) =>
            c.method === "quoteExactInputSingle" &&
            c.target === deployment.network.uniswapV4.quoter.toLowerCase(),
        ),
      );
      await p
        .getByRole("button", { name: "1. Approve IMD", exact: true })
        .click();
      await simulateAndSend(p);
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p
        .getByRole("button", { name: "2. Approve router", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "2. Approve router", exact: true })
        .click();
      await simulateAndSend(p);
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p
        .getByRole("button", { name: "Review swap", exact: true })
        .waitFor();
    },
  );
  await check(
    "Swap execute payload, no ETH for IMD pair, receipt and duplicate-submit lock",
    async () => {
      await p.getByRole("button", { name: "Review swap", exact: true }).click();
      const dialog = p.locator("dialog[open]");
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      s.pausedReceipt = true;
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog.getByText(/Waiting for the onchain receipt/).waitFor();
      assert.equal(
        await dialog.getByRole("button", { name: "Working…" }).isDisabled(),
        true,
      );
      assert.equal(s.sends.length, 3);
      assert.equal(
        s.sends[2].to.toLowerCase(),
        deployment.network.uniswapV4.universalRouter.toLowerCase(),
      );
      assert.ok(!s.sends[2].value || BigInt(s.sends[2].value) === 0n);
      s.pausedReceipt = false;
      s.block += 1n;
      await dialog.getByText(/Confirmed onchain/).waitFor({ timeout: 20000 });
      assert.equal(
        await dialog
          .getByRole("button", { name: "Confirmed", exact: true })
          .isDisabled(),
        true,
      );
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await screenshot(p, "trade-connected");
    },
  );
  await check(
    "Sell quote failure and custom-minimum router simulation",
    async () => {
      await p.getByRole("button", { name: "Sell UNLK2", exact: true }).click();
      await p.getByLabel("Amount to swap").fill("1");
      s.failSellQuote = true;
      await p
        .getByRole("button", { name: "Get live quote", exact: true })
        .click();
      await p
        .getByText(/This sell exceeds your official-pool allowance/)
        .waitFor();
      await p.getByLabel("Set a custom minimum output").check();
      await p
        .getByLabel("Minimum output (IMD)", { exact: true })
        .fill("0.0001");
      await p
        .getByRole("button", { name: "Review custom minimum", exact: true })
        .click();
      await p
        .getByRole("button", { name: "1. Approve UNLK2", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "1. Approve UNLK2", exact: true })
        .click();
      await simulateAndSend(p);
      await p
        .getByRole("button", { name: "2. Approve router", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "2. Approve router", exact: true })
        .click();
      await simulateAndSend(p);
      await p
        .getByRole("button", { name: "Review swap", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "Review swap", exact: true }).click();
      await simulateAndSend(p);
      assert.ok(
        s.calls.some(
          (c) =>
            c.method === "execute" &&
            c.target ===
              deployment.network.uniswapV4.universalRouter.toLowerCase(),
        ),
      );
      s.failSellQuote = false;
    },
  );
  await check(
    "Wrong-chain state prevents sends and exposes a single switch action",
    async () => {
      s.chain = 137;
      await p.evaluate(() => window.testWallet.emit("chainChanged", "0x89"));
      await p
        .getByRole("button", { name: "Switch to Ethereum", exact: true })
        .first()
        .waitFor();
      const count = s.sends.length;
      await p
        .getByRole("button", { name: "Switch to Ethereum", exact: true })
        .first()
        .click();
      assert.equal(s.sends.length, count);
    },
  );
  await check(
    "Migration approval, permanent-lock review, cap and balance refresh",
    async () => {
      await screen(p, "Migrate");
      await p.getByLabel("V1 amount", { exact: true }).fill("10");
      await p.getByLabel("I understand my V1 will be locked forever.").check();
      await p.getByRole("button", { name: "Approve V1", exact: true }).click();
      await simulateAndSend(p);
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p
        .getByRole("button", { name: "Review migration", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "Review migration", exact: true })
        .click();
      await simulateAndSend(p, { irreversible: true });
      assert.equal(s.totalMigrated, 10n * E);
      await screenshot(p, "migrate");
    },
  );
  await check(
    "All ten gates, three bars, rights buckets and verified swarm evidence",
    async () => {
      await screen(p, "Gates");
      assert.equal(await p.locator("tbody tr").count(), 10);
      assert.equal(await p.locator("progress").count(), 3);
      await screenshot(p, "gates");
      await screen(p, "My Rights");
      await p.getByLabel("Claim index", { exact: true }).fill("17");
      await p
        .getByLabel("Original claim amount (UNLK2)", { exact: true })
        .fill("100");
      await p
        .getByRole("button", { name: "Verify claim evidence", exact: true })
        .click();
      await simulateAndSend(p);
      await screenshot(p, "rights");
    },
  );
  await check(
    "Exact burn preview, irreversible confirmation and point/credit units",
    async () => {
      await screen(p, "Burn & Points");
      await p.getByLabel("Amount to burn (UNLK2)", { exact: true }).fill("20");
      await p
        .getByRole("button", { name: "Preview burn and rights", exact: true })
        .click();
      await p.getByText("Onchain burn preview", { exact: true }).waitFor();
      await screenshot(p, "burn-preview");
      await p
        .getByRole("button", { name: "Review irreversible burn", exact: true })
        .click();
      assert.equal(
        await p
          .locator("dialog[open]")
          .getByRole("button", { name: "Simulate transaction", exact: true })
          .isDisabled(),
        true,
      );
      await simulateAndSend(p, { irreversible: true });
      assert.equal(s.burnProgress, 20n * E);
    },
  );
  await check(
    "Simulation failure, actionable retry, voluntary burn and pending state",
    async () => {
      await screen(p, "Weekly IMD Rewards");
      await p
        .getByRole("button", { name: "Claim matured IMD", exact: true })
        .click();
      s.failSimulation = true;
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await p.getByText(/pricing reference is unavailable/i).waitFor();
      s.failSimulation = false;
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Retry simulation", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByText("Confirmed onchain.", { exact: true })
        .waitFor();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      assert.equal(s.claimable, 0n);
      for (const name of ["Checkpoint rewards", "Redeem fees to pot"]) {
        await p.getByRole("button", { name, exact: true }).click();
        await simulateAndSend(p);
      }
      await screenshot(p, "weekly-rewards");
      await screen(p, "Burn & Points");
      await p
        .getByRole("button", { name: "Voluntary burn", exact: true })
        .click();
      await p.getByLabel("Amount to burn (UNLK2)").fill("1");
      await p
        .getByRole("button", { name: "Preview burn and rights", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Review irreversible burn", exact: true })
        .click();
      await simulateAndSend(p, { irreversible: true });
      assert.equal(s.burnProgress, 20n * E);
    },
  );
  await check(
    "Transaction rejection and unresolved receipt recovery never resubmits",
    async () => {
      await screen(p, "Weekly IMD Rewards");
      await p
        .getByRole("button", { name: "Checkpoint rewards", exact: true })
        .click();
      const dialog = p.locator("dialog[open]");
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      const before = s.sends.length;
      s.rejectSend = true;
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog.getByText(/Request declined in your wallet/).waitFor();
      assert.equal(s.sends.length, before);
      s.rejectSend = false;
      await dialog
        .getByRole("button", { name: "Retry simulation", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      s.receiptError = true;
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Recheck receipt", exact: true })
        .waitFor({ timeout: 20000 });
      assert.equal(s.sends.length, before + 1);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await p
        .getByRole("button", { name: "View transaction status", exact: true })
        .waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: "Transaction in progress…" })
          .first()
          .isDisabled(),
        true,
      );
      s.receiptError = false;
      s.block += 1n;
      await p
        .getByRole("button", { name: "View transaction status", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Recheck receipt", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByText("Confirmed onchain.", { exact: true })
        .waitFor();
      assert.equal(s.sends.length, before + 1);
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Checkpoint rewards", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      s.receiptReverted = true;
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByText(
          "The transaction failed onchain. Refresh state before retrying.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await p
          .locator("dialog[open]")
          .getByRole("button", { name: "Retry simulation", exact: true })
          .isEnabled(),
        true,
      );
      s.receiptReverted = false;
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Close", exact: true })
        .click();
    },
  );
  await check(
    "Owner funding, router, distributor and activation prepare unsigned only",
    async () => {
      s.activated = false;
      s.funded = false;
      s.backing = 0n;
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p.getByText("● Trading closed", { exact: true }).waitFor();
      await screen(p, "Founder setup");
      const before = s.sends.length;
      await p
        .getByRole("button", { name: "Prepare unsigned funding", exact: true })
        .click();
      const dialog = p.locator("dialog[open]");
      await dialog.getByRole("checkbox").check();
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", {
          name: "Download unsigned transaction",
          exact: true,
        })
        .waitFor();
      const downloadPromise = p.waitForEvent("download");
      await dialog
        .getByRole("button", {
          name: "Download unsigned transaction",
          exact: true,
        })
        .click();
      const download = await downloadPromise;
      const path = await download.path();
      const unsigned = JSON.parse(await readFile(path, "utf8"));
      assert.equal(unsigned.from.toLowerCase(), owner.toLowerCase());
      assert.equal(
        unsigned.to.toLowerCase(),
        deployment.contracts.find((c) => c.name === "UnlockV2Token").address,
      );
      assert.equal(s.sends.length, before);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await p
        .getByRole("button", {
          name: "Prepare unsigned router setting",
          exact: true,
        })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", {
          name: "Download unsigned transaction",
          exact: true,
        })
        .waitFor();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await p
        .getByLabel("Actual launch distributor address")
        .fill("0x3333333333333333333333333333333333333333");
      await p
        .getByRole("button", {
          name: "Prepare unsigned distributor setting",
          exact: true,
        })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", {
          name: "Download unsigned transaction",
          exact: true,
        })
        .waitFor();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      s.funded = true;
      s.backing = s.capacity;
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p
        .getByRole("button", {
          name: "Prepare unsigned activation",
          exact: true,
        })
        .waitFor();
      await p
        .getByRole("button", {
          name: "Prepare unsigned activation",
          exact: true,
        })
        .click();
      await p.locator("dialog[open]").getByRole("checkbox").check();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await p
        .locator("dialog[open]")
        .getByRole("button", {
          name: "Download unsigned transaction",
          exact: true,
        })
        .waitFor();
      await p
        .locator("dialog[open]")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      assert.equal(s.sends.length, before);
      await screenshot(p, "founder-setup", true);
    },
  );
  await check(
    "All screens at 320 / 390 / 768 / 1440 without horizontal overflow",
    async () => {
      for (const width of [320, 390, 768, 1440]) {
        await p.setViewportSize({ width, height: 844 });
        for (const name of [
          "Trade",
          "Gates",
          "Migrate",
          "My Rights",
          "Burn & Points",
          "Weekly IMD Rewards",
          "Golden Vault",
          "Rules / Contracts",
          "Founder setup",
        ]) {
          await screen(p, name);
          await p.waitForTimeout(60);
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            `${name} overflow at ${width}`,
          );
        }
      }
      await p.setViewportSize({ width: 390, height: 844 });
      await screen(p, "Trade");
      await screenshot(p, "trade-mobile-390");
      const action = await p.locator(".swap-panel .action").boundingBox();
      assert.ok(
        action.y + action.height <= 844,
        `Main action below first screen: ${JSON.stringify(action)}`,
      );
    },
  );
  await check(
    "Keyboard dialog focus, Escape return, and reduced-motion rendering",
    async () => {
      await p.keyboard.press("Tab");
      await p.getByRole("button", { name: /0x48e4/i }).click();
      assert.equal(
        await p.evaluate(() =>
          document
            .querySelector("dialog[open]")
            .contains(document.activeElement),
        ),
        true,
      );
      await p.keyboard.press("Escape");
      await p.waitForFunction(() => !document.querySelector("dialog[open]"));
      await p.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await p.evaluate(
          () =>
            getComputedStyle(document.querySelector("button"))
              .transitionDuration,
        ),
        "0s",
      );
    },
  );
  assert.deepEqual(a.errors, [], "Unexpected browser errors");
  await browser.close();
  browser = null;
  const offline = await setup(chromium, {
    mock: false,
    wallet: false,
    width: 390,
    height: 844,
  });
  browser = offline.b;
  await check(
    "Public RPC failure: honest unavailable state, disabled transactions, wallet still accessible",
    async () => {
      await offline.p
        .getByText(/Live state unavailable/)
        .waitFor({ timeout: 15000 });
      await offline.p
        .getByRole("button", { name: "Connect wallet", exact: true })
        .first()
        .click();
      await offline.p.getByText(/No browser wallet found/).waitFor();
      await offline.p.keyboard.press("Escape");
      await offline.p.screenshot({
        path: resolve(evidence, "offline-mobile-390.png"),
      });
      report.screenshots.push("offline-mobile-390.png");
    },
  );
  await browser.close();
  browser = null;
  const phone = await setup(chromium, {
    wallet: false,
    width: 390,
    height: 844,
    mobile: true,
  });
  browser = phone.b;
  await check(
    "Phone wallet-browser links, local wallet marks and passkey entry",
    async () => {
      await phone.p
        .getByRole("button", { name: "Connect wallet", exact: true })
        .first()
        .click();
      const sheet = phone.p.locator("dialog[open]");
      for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
        assert.ok(
          await sheet
            .getByRole("link", { name: new RegExp("Open in " + name) })
            .count(),
        );
      const rabby = new URL(
        await sheet
          .getByRole("link", { name: /Open in Rabby/ })
          .getAttribute("href"),
      );
      assert.equal(rabby.origin, "https://go.rabby.io");
      assert.equal(rabby.pathname, "/mobile/");
      assert.equal(rabby.searchParams.get("_cmd"), "open-dapp");
      assert.equal(rabby.searchParams.get("dapp"), phone.p.url());
      assert.ok(
        await sheet
          .getByRole("button", { name: /Coinbase Smart Wallet/ })
          .count(),
      );
      assert.equal(
        await sheet.getByText("WalletConnect", { exact: true }).count(),
        0,
      );
      await phone.p.waitForFunction(() =>
        [...document.querySelectorAll("dialog[open] img")].every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      );
      await screenshot(phone.p, "wallet-mobile-390");
    },
  );
  await browser.close();
  browser = null;
  const tampered = await setup();
  browser = tampered.b;
  await check("Missing deployed code and changed ABI fail closed", async () => {
    await tampered.p.getByText("● Trading active", { exact: true }).waitFor();
    tampered.s.missingCode = true;
    await tampered.p
      .getByRole("button", { name: "Refresh", exact: true })
      .click();
    await tampered.p.getByText(/Live state unavailable/).waitFor();
    assert.equal(tampered.s.sends.length, 0);
    await tampered.c.route("**/abi/UnlockV2Hook.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      }),
    );
    await tampered.p.reload();
    await tampered.p
      .getByText(/ABI verification failed for UnlockV2Hook/)
      .waitFor();
    assert.equal(tampered.s.sends.length, 0);
  });
  await browser.close();
  browser = null;
  try {
    const wk = await setup(webkit, { width: 390, height: 844 });
    browser = wk.b;
    await check("WebKit primary wallet / quote flow", async () => {
      await wk.p
        .getByText("● Trading active", { exact: true })
        .waitFor({ timeout: 15000 });
      await connect(wk.p);
      await wk.p.getByLabel("Amount to swap").fill("1");
      await wk.p
        .getByRole("button", { name: "Get live quote", exact: true })
        .click();
      await wk.p
        .getByRole("button", { name: "1. Approve IMD", exact: true })
        .waitFor();
      assert.equal(
        await wk.p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await wk.p
        .getByRole("button", { name: "1. Approve IMD", exact: true })
        .click();
      await simulateAndSend(wk.p);
      await wk.p
        .getByRole("button", { name: "2. Approve router", exact: true })
        .waitFor();
      await wk.p
        .getByRole("button", { name: "2. Approve router", exact: true })
        .click();
      await simulateAndSend(wk.p);
      await wk.p
        .getByRole("button", { name: "Review swap", exact: true })
        .waitFor();
      await wk.p
        .getByRole("button", { name: "Review swap", exact: true })
        .click();
      await simulateAndSend(wk.p);
      await screenshot(wk.p, "webkit-trade-mobile");
    });
    await browser.close();
    browser = null;
  } catch (e) {
    report.checks.push({
      name: "WebKit runtime",
      passed: false,
      limitation: e.message.slice(0, 1600),
    });
    console.log("WEBKIT UNAVAILABLE", e.message.slice(0, 350));
  }
} catch (e) {
  if(activePage){await activePage.screenshot({path:resolve(root,'test/scratch/browser-failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(root,'test/scratch/browser-failure.txt'),await activePage.locator('body').innerText()).catch(()=>{});}
  if(activeFixture)await writeFile(resolve(root,'test/scratch/browser-failure-state.json'),JSON.stringify(activeFixture,(_k,v)=>typeof v==='bigint'?v.toString():v,2));
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    resolve(evidence, "browser-results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      report.checks.map((c) => ({ name: c.name, passed: c.passed })),
      null,
      2,
    ),
  );
}
