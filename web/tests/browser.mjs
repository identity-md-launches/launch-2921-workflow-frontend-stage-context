import {
  keccak256,
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiItem,
  parseAbiParameters,
  toHex,
} from "viem";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import {
  fixture,
  rpcMock,
  deployment,
  owner,
  E,
  walletQuoter,
} from "./mock.mjs";
import { root } from "../scripts/export.mjs";
const evidence = resolve(root, "docs/repair/evidence");
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
let browser, activePage, activeFixture;
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
    installed = true,
    state = {},
  } = {},
) {
  const b = await type.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({
    locale: "en-US", // Deterministic chart formatting, independent of the host POSIX locale.
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
  Object.assign(s, { chain: 1 }, state);
  activePage = p;
  activeFixture = s;
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
    if (req.url().endsWith("contract-runtime.json")) {
      const inventory = JSON.parse(await readFile(resolve(root,"web/public/contract-runtime.json"),"utf8"));
      inventory.contracts.forEach(row => { row.runtimeCodeHash = keccak256("0x60016000"); });
      // Companion addresses in this fixture are intentionally synthetic.
      inventory.contracts.find(row => row.name === "MigrationVault").address = "0x1111111111111111111111111111111111111111";
      inventory.contracts.find(row => row.name === "RewardPot").address = "0x2222222222222222222222222222222222222222";
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(inventory)});
    }
    if (req.url().endsWith("repair-config.json") && installed) {
      const config = JSON.parse(
        await readFile(resolve(root, "web/public/repair-config.json"), "utf8"),
      );
      config.installationReviewed = true;
      config.quoter = {
        address: walletQuoter,
        runtimeCodeHash: keccak256("0x60016000"),
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(config),
      });
    }
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
      label.textContent = "SYNTHETIC RPC + WALLET · regression fixture";
      label.style.cssText =
        "position:fixed;bottom:0;right:0;background:#050505;color:#efc47d;padding:4px 8px;font:11px monospace;z-index:99;pointer-events:none";
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
    "Home staircase, stored states, three OR tracks and contribution visible",
    async () => {
      await p.getByText("● Trading active", { exact: true }).waitFor();
      assert.equal(await p.locator("progress").count(), 3);
      assert.equal(await p.locator("svg.staircase .gate-node").count(), 10);
      await p
        .getByRole("heading", {
          name: "Contribute UNLK2 to the active gate",
          exact: true,
        })
        .waitFor();
      await p.locator("svg.staircase .gate-node").nth(9).click();
      await p
        .getByText("Gate 10 · Future · 100% unlocked", { exact: true })
        .waitFor();
      await p.getByRole("button",{name:"View gate 3: Future",exact:true}).focus();
      await p.keyboard.press("Enter");
      await p.getByText("Gate 3 · Future · 35% unlocked",{exact:true}).waitFor();
      await p.getByRole("button",{name:"View gate 10: Future",exact:true}).click();
      assert.equal(
        await p.evaluate(() => getComputedStyle(document.body).backgroundColor),
        "rgb(0, 0, 0)",
      );
      s.pendingGates = 4;
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p
        .getByRole("heading", { name: "Active gate 1", exact: true })
        .waitFor();
      assert.match(await p.locator(".gate-detail").innerText(), /Future/);
      await screenshot(p, "desktop-home", true);
    },
  );
  await check(
    "Market tab shows genuine no-trades state, units, source and retry",
    async () => {
      await p.getByRole("tab", { name: "Market Chart", exact: true }).click();
      await p
        .getByText("No official trades in this window", { exact: true })
        .waitFor();
      await p.getByLabel("Market price unit").selectOption("USD");
      await p
        .getByRole("button", {
          name: "Retry / refresh market data",
          exact: true,
        })
        .click();
      await p
        .getByText("No official trades in this window", { exact: true })
        .waitFor();
      await p.getByRole("tab", { name: "Gate Staircase", exact: true }).click();
      await p.getByRole("tab", {name:"Gate Staircase",exact:true}).focus();
      await p.keyboard.press("ArrowRight");
      assert.equal(await p.getByRole("tab",{name:"Market Chart",exact:true}).getAttribute("aria-selected"),"true");
      await p.keyboard.press("Home");
    },
  );
  await check(
    "Wallet connection and automatic caller-bound buy quote",
    async () => {
      await connect(p);
      await p.locator("#swap-amount").fill("1");
      await p.getByText("Minimum received", { exact: true }).waitFor();
      assert.ok(s.calls.some((c) => c.method === "quoteExactInput"));
      assert.equal(
        await p.getByLabel("Set a custom minimum output").count(),
        0,
      );
      await p.getByRole("button", { name: "Approve IMD", exact: true }).click();
      await simulateAndSend(p);
      assert.equal(s.tokenAllowance, E);
      // Refresh after receipts must not broaden the exact approval.
      await p
        .getByRole("button", { name: "Get live quote", exact: true })
        .count();
      if (
        await p
          .getByRole("button", { name: "Get live quote", exact: true })
          .count()
      )
        await p
          .getByRole("button", { name: "Get live quote", exact: true })
          .click();
      await p
        .getByRole("button", { name: "Approve router", exact: true })
        .click();
      await simulateAndSend(p);
      assert.equal(s.permitAllowance, E);
      await p.getByRole("button", { name: "Review swap", exact: true }).click();
      await simulateAndSend(p);
      assert.equal(s.sends.length, 3);
    },
  );
  await check(
    "Automatic sell quote uses same wallet path; failed quotes cannot send",
    async () => {
      await p.getByRole("button", { name: "Sell UNLK2", exact: true }).click();
      await p.locator("#swap-amount").fill("10");
      await p.getByText("Minimum received", { exact: true }).waitFor();
      const calls = s.calls.filter((c) => c.method === "quoteExactInput");
      assert.equal(calls.at(-1).args[0], true);
      const sent = s.sends.length;
      s.failSellQuote = true;
      await p.locator("#swap-amount").fill("11");
      await p
        .getByText(/This sell exceeds your official-pool allowance/)
        .waitFor();
      assert.equal(s.sends.length, sent);
      s.failSellQuote = false;
    },
  );
  await check(
    "Home contribution max is capped and stale target is rejected",
    async () => {
      await p
        .getByRole("button", {
          name: "Max · balance / gate capacity",
          exact: true,
        })
        .click();
      assert.equal(
        await p.getByLabel("Amount to burn (UNLK2)").inputValue(),
        "25000000",
      );
      await p.getByLabel("Amount to burn (UNLK2)").fill("1");
      await p
        .getByRole("button", { name: "Preview burn and rights", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Contribute UNLK2 · gate 1", exact: true })
        .click();
      const dialog = p.locator("dialog[open]");
      await dialog.getByRole("checkbox").check();
      s.gates = 1;
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog.getByText(/Gate changed or capacity reduced/).waitFor();
      assert.equal(s.sends.length, 3);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
    },
  );
  await check(
    "Gate ten exposes Golden Vault voluntary burn on home",
    async () => {
      s.gates = 10;
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p
        .getByRole("heading", {
          name: "Golden Vault · voluntary burning & continuing fee rewards",
          exact: true,
        })
        .waitFor();
      assert.equal(await p.locator("progress").count(), 0);
      await p.getByLabel("Amount to burn (UNLK2)").fill("1");
      await p
        .getByRole("button", { name: "Preview burn and rights", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Burn UNLK2 for points", exact: true })
        .click();
      await simulateAndSend(p, { irreversible: true });
    },
  );
  await check(
    "Quote expiry during final review blocks wallet signing",
    async () => {
      s.gates = 1;
      s.sellTokenAllowance = 1000n * E;
      s.sellPermitAllowance = 1000n * E;
      s.expiry = Math.floor(Date.now() / 1000) + 1800;
      await p.getByRole("button", { name: "Refresh", exact: true }).click();
      await p.locator("#swap-amount").fill("12");
      await p.getByRole("button", { name: "Review swap", exact: true }).click();
      const dialog = p.locator("dialog[open]");
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      const sent = s.sends.length;
      await p.clock.install();
      await p.clock.fastForward(46000);
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog.getByText(/Quote or preview expired/).waitFor();
      assert.equal(s.sends.length, sent);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
    },
  );
  assert.deepEqual(a.errors, []);
  await a.b.close();

  const flows = await setup();
  browser = flows.b;
  await check("Migration approval and immutable vault call, rewards claim and successful sell review", async () => {
    const {p,s} = flows;
    await connect(p);
    await screen(p,"Migrate");
    await p.getByLabel("V1 amount",{exact:true}).fill("12.5");
    await p.getByLabel("I understand my V1 will be locked forever.", {exact:true}).check();
    await p.getByRole("button",{name:"Approve V1",exact:true}).click();
    await simulateAndSend(p);
    assert.equal(s.v1Allowance, 125n * E / 10n);
    await p.getByRole("button",{name:"Review migration",exact:true}).click();
    await simulateAndSend(p,{irreversible:true});
    assert.equal(s.totalMigrated, 125n * E / 10n);
    assert.equal(s.v1Balance, 5000n * E - 125n * E / 10n);
    await screen(p,"Weekly IMD Rewards");
    await p.getByRole("button",{name:"Claim matured IMD",exact:true}).click();
    await simulateAndSend(p);
    assert.equal(s.claimable,0n);
    s.sellTokenAllowance = 1000n * E;
    s.sellPermitAllowance = 1000n * E;
    s.expiry = Math.floor(Date.now()/1000)+1800;
    await screen(p,"Trade");
    await p.getByRole("button",{name:"Sell UNLK2",exact:true}).click();
    await p.locator("#swap-amount").fill("10");
    await p.getByRole("button",{name:"Review swap",exact:true}).click();
    await simulateAndSend(p);
    assert.equal(s.sends.length,4);
  });
  await check("Changed burn rights block the previously reviewed preview", async () => {
    const {p,s} = flows;
    await p.getByLabel("Amount to burn (UNLK2)",{exact:true}).fill("1.000000000000000001");
    await p.getByRole("button",{name:"Preview burn and rights",exact:true}).click();
    await p.getByText(/Burned: 1.000000000000000001 UNLK2/).waitFor();
    await p.getByRole("button",{name:"Contribute UNLK2 · gate 1",exact:true}).click();
    s.previewAllowance=199n * E;
    const dialog=p.locator("dialog[open]");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button",{name:"Simulate transaction",exact:true}).click();
    await dialog.getByText(/Your burn debits or rights changed/).waitFor();
    assert.equal(s.sends.length,4);
    await dialog.getByRole("button",{name:"Close",exact:true}).click();
  });
  assert.deepEqual(flows.errors,[]);
  await flows.b.close();

  const market = await setup();
  browser = market.b;
  await check(
    "Interactive candle/volume canvas renders observed-trade fixture with zoom and crosshair",
    async () => {
      const event = parseAbiItem(
        "event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)",
      );
      market.s.marketLogs = [];
      market.s.blockTimes = {};
      for (let i = 0; i < 3; i++) {
        const block = market.s.block - BigInt(30 - i * 5);
        market.s.blockTimes[toHex(block)] =
          Math.floor(Date.now() / 1000) - 1800 + i * 900;
        market.s.marketLogs.push({
          address: deployment.network.uniswapV4.poolManager,
          topics: encodeEventTopics({
            abi: [event],
            eventName: "Swap",
            args: { id: "0x" + "ab".repeat(32), sender: owner },
          }),
          data: encodeAbiParameters(
            parseAbiParameters("int128,int128,uint160,uint128,int24,uint24"),
            [-1000n * E, (1n + BigInt(i)) * E, 10n ** 27n, 1000n * E, 0, 12500],
          ),
          blockNumber: toHex(block),
          blockHash: "0x" + "ef".repeat(32),
          transactionHash: "0x" + (i + 1).toString(16).padStart(64, "0"),
          transactionIndex: "0x0",
          logIndex: toHex(i),
          removed: false,
        });
      }
      await market.p.getByText("● Trading active", { exact: true }).waitFor();
      await market.p
        .getByRole("tab", { name: "Market Chart", exact: true })
        .click();
      await market.p.locator(".market-chart canvas").first().waitFor();
      const heightBefore = (await market.p.locator(".market-chart").boundingBox()).height;
      await market.p.waitForTimeout(250);
      const heightAfter = (await market.p.locator(".market-chart").boundingBox()).height;
      assert.ok(Math.abs(heightAfter - heightBefore) < 2, "Chart ResizeObserver must not grow its own host");
      await market.p
        .locator(".market-chart canvas")
        .first()
        .hover({ position: { x: 100, y: 100 }, force: true });
      await market.p.mouse.wheel(0, -100);
      await market.p.getByRole("button", { name: "5m", exact: true }).click();
      await market.p.getByLabel("Market price unit").selectOption("USD");
      await market.p.locator(".market-chart canvas").first().waitFor();
      await screenshot(market.p, "synthetic-market-chart", false);
      assert.deepEqual(market.errors, []);
    },
  );
  await check("Market RPC failure retries and invalid historical USD stays unavailable",async()=>{
    const {p,s}=market;
    s.failMarket=true;
    await p.getByRole("button",{name:"Retry / refresh market data",exact:true}).click();
    await p.getByText(/Official-pool history unavailable/).waitFor();
    s.failMarket=false;
    s.invalidUsd=true;
    await p.getByRole("button",{name:"Retry / refresh market data",exact:true}).click();
    await p.getByText("Historical USD reference unavailable; choose IMD.",{exact:true}).waitFor();
    await p.getByLabel("Market price unit").selectOption("IMD");
    await p.locator(".market-chart canvas").first().waitFor();
  });
  await market.b.close();
  const b = await setup(chromium, {
    width: 390,
    height: 844,
    mobile: true,
    installed: false,
    state: {
      activated: false,
      funded: false,
      backing: 0n,
      routerSupported: false,
    },
  });
  browser = b.b;
  await check(
    "Mobile closed trading, pending owner setup and stacked dashboard",
    async () => {
      await b.p.getByText("● Trading closed", { exact: true }).waitFor();
      assert.ok(
        await b.p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await b.p.getByText(/Wallet quoter installation pending/).waitFor();
      const swap = await b.p.locator(".swap-panel").boundingBox();
      const chart = await b.p.locator(".chart-panel").boundingBox();
      const action = await b.p.locator(".swap-panel .action").boundingBox();
      assert.ok(swap.y < chart.y, "Swap must precede chart on mobile");
      assert.ok(action.y + action.height <= 844, "Main action must fit first 390px screen");
      assert.ok(swap.width >= 350, "No implicit mobile grid column");
      await screenshot(b.p, "mobile-closed", true);
      await screenshot(b.p, "mobile-first-screen", false);
      for (const width of [320,768,1440]) {
        await b.p.setViewportSize({width,height:844});
        assert.ok(await b.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
      }
      await b.p.setViewportSize({width:390,height:844});
      await screen(b.p, "Founder setup");
      await b.p.getByRole("button", { name: /Activation disabled/ }).waitFor();
      assert.ok(
        await b.p
          .getByRole("button", { name: /Activation disabled/ })
          .isDisabled(),
      );
    },
  );
  await check(
    "RPC outage marks prior snapshot stale and prevents actions",
    async () => {
      b.s.failRpc = true;
      await b.p.getByRole("button", { name: "Refresh", exact: true }).click();
      await b.p.getByText(/Live state unavailable/).waitFor();
      assert.equal(b.s.sends.length, 0);
      await screenshot(b.p, "mobile-rpc-error", true);
    },
  );
  assert.deepEqual(b.errors, []);
  await b.b.close();

  const phone=await setup(chromium,{wallet:false,width:390,height:844,mobile:true,installed:false,state:{activated:false}});
  browser=phone.b;
  await check("Mobile wallet browser links, passkey option and keyboard dialog return",async()=>{
    const {p}=phone;
    await p.getByText("● Trading closed",{exact:true}).waitFor();
    const trigger=p.getByRole("button",{name:"Connect wallet",exact:true}).first();
    await trigger.click();
    const dialog=p.locator("dialog[open]");
    for(const name of ["MetaMask","Coinbase Wallet","Rabby","Phantom"]){
      const link=dialog.getByRole("link",{name:`Open in ${name}`,exact:false});
      assert.ok((await link.getAttribute("href")).startsWith("https://"));
      assert.ok((await link.boundingBox()).height>=48);
    }
    await dialog.getByRole("button",{name:/Coinbase Smart Wallet/}).waitFor();
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("dialog[open]").count(),0);
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    await screenshot(p,"mobile-wallet-entry",false);
  });
  await check("Initial RPC outage keeps the product and main action on the first phone screen",async()=>{
    const {p,s}=phone;
    s.failRpc=true;
    await p.reload();
    await p.getByText(/Live state unavailable/).waitFor();
    const action=await p.locator(".swap-panel .action").boundingBox();
    assert.ok(action.y+action.height<=844, "No-data error must keep main action above fold");
    await p.getByRole("button",{name:"View gate 10: Unread",exact:true}).click();
    await p.getByText("Gate 10 · Unread · 100% unlocked",{exact:true}).waitFor();
    await screenshot(p,"mobile-initial-rpc-error",false);
  });
  assert.deepEqual(phone.errors,[]);
  await phone.b.close();
} catch (e) {
  report.errors.push(e.stack);
  if (activePage) await screenshot(activePage, "failure", true).catch(() => {});
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.close();
  await writeFile(
    resolve(evidence, "browser-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
