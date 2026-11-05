import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import {
  keccak256,
  toHex,
  formatUnits,
  encodeEventTopics,
  parseAbiItem,
} from "viem";
import {
  fixture,
  rpcMock,
  deployment,
  owner,
  E,
  walletQuoter,
  adapter,
} from "./mock.mjs";
const pw = process.env.IMD_PLAYWRIGHT
  ? await import(pathToFileURL(process.env.IMD_PLAYWRIGHT))
  : await import("playwright");
const root = resolve(new URL("../../", import.meta.url).pathname),
  evidence = resolve(root, "docs/update/evidence");
await mkdir(evidence, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!path.startsWith("/preview/")) return res.writeHead(404).end();
    const file = resolve(root, "dist", path.slice(9) || "index.html");
    if (!file.startsWith(resolve(root, "dist") + "/"))
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
      }[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const engine = process.env.IMD_BROWSER === "webkit" ? "webkit" : "chromium";
const report = {
  engine,
  mode: "Synthetic RPC and wallet interaction tests against the production export. No real signing or mainnet broadcasts.",
  checks: [],
  errors: [],
  screenshots: [],
};
const browser = await pw[engine].launch(
  engine === "chromium" ? { args: ["--no-sandbox"] } : {},
);
let activePage;
async function setup(state = {}, width = 390, wallet = true) {
  const s = Object.assign(fixture(), { chain: 1 }, state),
    m = rpcMock(s);
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    locale: "en-US",
  });
  const p = await context.newPage();
  activePage = p;
  p.on("pageerror", (e) => report.errors.push(e.message));
  await context.route(/^https?:\/\//, async (route) => {
    const req = route.request();
    if (req.url().endsWith("contract-runtime.json")) {
      const inv = JSON.parse(
        await readFile(
          resolve(root, "web/public/contract-runtime.json"),
          "utf8",
        ),
      );
      inv.contracts.forEach(
        (c) => (c.runtimeCodeHash = keccak256("0x60016000")),
      );
      inv.contracts.find((c) => c.name === "MigrationVault").address =
        "0x1111111111111111111111111111111111111111";
      inv.contracts.find((c) => c.name === "RewardPot").address =
        "0x2222222222222222222222222222222222222222";
      return route.fulfill({ json: inv });
    }
    if (req.url().endsWith("repair-config.json")) {
      const cfg = JSON.parse(
        await readFile(resolve(root, "web/public/repair-config.json"), "utf8"),
      );
      cfg.adapter = {
        address: adapter,
        runtimeCodeHash: keccak256("0x60016000"),
      };
      cfg.quoter = {
        address: walletQuoter,
        runtimeCodeHash: keccak256("0x60016000"),
      };
      return route.fulfill({ json: cfg });
    }
    if (req.url().startsWith(url)) return route.continue();
    if (deployment.network.rpcUrls.some((u) => req.url().startsWith(u))) {
      if (s.failRpc)
        return route.fulfill({ status: 503, body: "Synthetic outage" });
      const q = req.postDataJSON();
      return route.fulfill({
        json: Array.isArray(q)
          ? await Promise.all(q.map(m.rpc))
          : await m.rpc(q),
      });
    }
    return route.abort();
  });
  if (wallet) {
    await p.exposeFunction("testRequest", (q) =>
      m
        .wallet(q)
        .then((result) => ({ result }))
        .catch((e) => ({ error: { message: e.message, code: e.code } })),
    );
    await p.addInitScript(() => {
      const listeners = {};
      const provider = {
        request: async (q) => {
          const r = await window.testRequest(q);
          if (r.error) throw Object.assign(new Error(r.error.message), r.error);
          return r.result;
        },
        on: (n, fn) => (listeners[n] ??= []).push(fn),
        removeListener: (n, fn) =>
          (listeners[n] = (listeners[n] ?? []).filter((f) => f !== fn)),
      };
      window.testWallet = {
        emit: (n, v) => (listeners[n] ?? []).forEach((f) => f(v)),
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "test-wallet",
                name: "Test Wallet",
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                rdns: "test.wallet",
              },
              provider,
            },
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    });
  }
  await p.goto(url);
  await p.getByRole("button", { name: /Gate 1:/ }).waitFor();
  await p.waitForFunction(
    () =>
      document.body.innerText.includes("Trading active") ||
      document.body.innerText.includes("Trading closed") ||
      document.body.innerText.includes("RPC unavailable"),
  );
  return { p, s, context };
}
async function connect(p) {
  await p.locator(".wallet-button").click();
  await p.getByRole("button", { name: "Test Wallet", exact: false }).click();
  await p.waitForFunction(
    () => !document.querySelector(".wallet-dialog")?.open,
  );
  await p.waitForTimeout(150);
  await p.waitForFunction(
    () => !document.querySelector(".shortcuts button")?.disabled,
  );
}
async function refresh(p) {
  await p.locator(".read-status button").click();
  await p.waitForFunction(
    () => !document.querySelector(".read-status button")?.disabled,
  );
}
async function check(name, fn) {
  try {
    await fn();
    report.checks.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    report.checks.push({ name, passed: false, error: e.message });
    if (activePage)
      await activePage.screenshot({
        path: resolve(root, "test/scratch/failure.png"),
        fullPage: true,
      });
    throw e;
  }
}
async function shot(p, name) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  await p.waitForTimeout(180);
  if (engine === "webkit") name = name.replace("mock-", "webkit-");
  const path = resolve(evidence, name);
  await p.screenshot({ path, fullPage: false, animations: "disabled" });
  report.screenshots.push("docs/update/evidence/" + name);
}
try {
  await check(
    "Ten onchain doors, independent target progress, mobile primary action, keyboard and disclosure",
    async () => {
      const { p, context } = await setup({}, 390);
      assert.equal(await p.locator(".gate-door").count(), 10);
      assert.equal(
        await p.locator(".gate-door[data-state=Current]").count(),
        1,
      );
      assert.equal(await p.locator(".gate-door[data-state=Locked]").count(), 9);
      assert.equal(await p.locator(".gate-three progress").count(), 3);
      const action = await p.locator(".gate-hall-heading a").boundingBox();
      assert(action.y + action.height <= 844);
      await p.getByRole("button", { name: /Gate 5:/ }).click();
      assert.match(
        await p.locator(".gate-disclosure").innerText(),
        /Gate 5.*Future/s,
      );
      await p.getByRole("button", { name: /Gate 1:/ }).focus();
      await p.keyboard.press("Enter");
      assert.match(
        await p.locator(".gate-disclosure").innerText(),
        /Gate 1.*Current/s,
      );
      await shot(p, "mock-home-390.png");
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await context.close();
    },
  );
  await check(
    "IMD shortcuts floor fresh balance; sell shortcuts use current sell allowance",
    async () => {
      const { p, s, context } = await setup(
        { imdBalance: 7n * E + 3n, balance: 1000n * E },
        390,
      );
      await connect(p);
      for (const [label, n] of [
        ["20%", (s.imdBalance * 20n) / 100n],
        ["50%", (s.imdBalance * 50n) / 100n],
        ["75%", (s.imdBalance * 75n) / 100n],
        ["MAX", s.imdBalance],
      ]) {
        await p
          .locator(".shortcuts")
          .getByRole("button", { name: label, exact: true })
          .click();
        await p.waitForFunction(
          (n) => document.querySelector("#swap-amount")?.value === n,
          formatUnits(n, 18),
        );
        const actual = await p.locator("#swap-amount").inputValue();
        const [whole, frac = ""] = actual.split(".");
        assert.equal(BigInt(whole) * E + BigInt(frac.padEnd(18, "0")), n);
      }
      await p.getByRole("button", { name: "Sell UNLK2", exact: true }).click();
      await p
        .locator(".shortcuts")
        .getByRole("button", { name: "50%", exact: true })
        .click();
      await p.waitForFunction(
        () => document.querySelector("#swap-amount")?.value === "100",
      );
      assert.match(
        await p.locator("#shortcut-context").innerText(),
        /CURRENTLY SELLABLE/,
      );
      await p.locator("#swap-amount").fill("201");
      await p
        .getByText("Amount exceeds your currently sellable UNLK2.", {
          exact: true,
        })
        .waitFor();
      assert.equal(s.sends.length, 0);
      await context.close();
    },
  );
  await check(
    "IMD quote, review, account invalidation and failed signing preserve funds",
    async () => {
      const { p, s, context } = await setup({
        tokenAllowance: 1000n * E,
        permitAllowance: 1000n * E,
        expiry: Math.floor(Date.now() / 1000) + 3600,
      });
      await connect(p);
      await p.locator("#swap-amount").fill("1");
      await p
        .getByRole("button", { name: "Review swap", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "Review swap", exact: true }).click();
      await p
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      s.rejectSend = true;
      await p
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await p
        .getByText(
          "Request declined in your wallet. You can retry when ready.",
          { exact: true },
        )
        .waitFor();
      assert.equal(s.sends.length, 0);
      await p.getByRole("button", { name: "Close", exact: true }).click();
      await p.evaluate(() => window.testWallet.emit("accountsChanged", []));
      await p.waitForFunction(
        () =>
          document.querySelector(".wallet-button")?.textContent ===
          "Connect wallet",
      );
      assert.equal(
        await p
          .getByRole("button", { name: "Review swap", exact: true })
          .count(),
        0,
      );
      await context.close();
    },
  );
  await check(
    "Gate-ten cold load uses voluntary burn and distinct gold visual; failed burn never animates",
    async () => {
      const { p, s, context } = await setup({
        gates: 10,
        failSimulation: true,
      });
      await connect(p);
      await p.locator("#active-gate").scrollIntoViewIfNeeded();
      assert.equal(await p.locator(".energy-scene.gold").count(), 1);
      const field = p.getByLabel("Amount to burn (UNLK2)", { exact: true });
      await field.fill("5");
      await p
        .getByRole("button", { name: "Preview burn and rights", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Burn UNLK2 for points", exact: true })
        .click();
      const dialog = p.getByRole("dialog", { name: "Burn for points" });
      await dialog.getByRole("checkbox").check();
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog.getByRole("alert").waitFor();
      assert.equal(await p.locator(".energy-scene.confirmed").count(), 0);
      assert.equal(s.sends.length, 0);
      assert(s.calls.some((c) => c.method === "burn"));
      assert(!s.calls.some((c) => c.method === "contribute"));
      await p.getByRole("button", { name: "Close", exact: true }).click();
      await p.locator(".energy-scene.gold").scrollIntoViewIfNeeded();
      await shot(p, "mock-golden-390.png");
      await context.close();
    },
  );
  await check(
    "Confirmed burn animates only with matching receipt log; reward share is separate",
    async () => {
      const { p, s, context } = await setup({ gates: 10 });
      await connect(p);
      await p.getByLabel("Amount to burn (UNLK2)", { exact: true }).fill("5");
      await p
        .getByRole("button", { name: "Preview burn and rights", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Burn UNLK2 for points", exact: true })
        .click();
      const dialog = p.getByRole("dialog", { name: "Burn for points" });
      await dialog.getByRole("checkbox").check();
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor();
      assert.equal(await p.locator(".energy-scene.confirmed").count(), 0);
      s.receiptLogs = [
        {
          address: deployment.contracts.find((c) => c.name === "UnlockV2Token")
            .address,
          topics: encodeEventTopics({
            abi: [
              parseAbiItem(
                "event Transfer(address indexed from,address indexed to,uint256 value)",
              ),
            ],
            eventName: "Transfer",
            args: {
              from: owner,
              to: "0x0000000000000000000000000000000000000000",
            },
          }),
          data: toHex(5n * E, { size: 32 }),
          blockNumber: toHex(s.block + 1n),
          blockHash: "0x" + "ef".repeat(32),
          transactionHash: "0x" + "01".padStart(64, "0"),
          transactionIndex: "0x0",
          logIndex: "0x0",
          removed: false,
        },
      ];
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await p.locator(".energy-scene.confirmed").waitFor();
      assert.match(
        await p.locator(".burn-confirmation").innerText(),
        /5 UNLK2 destroyed[\s\S]*5 points earned/,
      );
      await context.close();
    },
  );
  await check(
    "Later gate opening changes doors and announces FDV/volume/burn alternatives without burn success",
    async () => {
      const { p, s, context } = await setup({ gates: 0 });
      s.gates = 1;
      await refresh(p);
      assert.equal(await p.locator(".gate-door[data-state=Open]").count(), 1);
      assert.equal(
        await p.locator(".gate-door[data-state=Current]").count(),
        1,
      );
      assert.match(
        await p.locator(".gate-opening").innerText(),
        /FDV, volume or burn/,
      );
      assert.equal(await p.locator(".energy-scene.confirmed").count(), 0);
      await shot(p, "mock-opened-door-390.png");
      await context.close();
    },
  );
  await check(
    "Closed trading is separate from completed setup and later activation is detected",
    async () => {
      const { p, s, context } = await setup({ activated: false });
      await p.locator(".mobile-nav select").selectOption("Integration status");
      assert.match(
        await p.locator("main").innerText(),
        /Closed; awaiting activation/,
      );
      assert.equal(
        await p
          .getByRole("button", { name: /Activate|Register|Fund migration/ })
          .count(),
        0,
      );
      s.activated = true;
      await refresh(p);
      assert.match(
        await p.locator(".read-status").innerText(),
        /Trading active/,
      );
      await context.close();
    },
  );
  await check(
    "ETH selector stops honestly when full-route RPC is unsupported; no IMD approvals",
    async () => {
      const { p, s, context } = await setup();
      await connect(p);
      await p.getByRole("button", { name: "ETH", exact: true }).click();
      await p.locator("#swap-amount").fill("0.00001");
      await p.getByText(/Full-route simulation unavailable/).waitFor();
      assert.equal(s.sends.length, 0);
      assert(!s.calls.some((c) => c.method === "approve"));
      await context.close();
    },
  );
  await check(
    "Responsive 320, 390, 768 and 1440 layouts, reduced motion and desktop sticky swap",
    async () => {
      const { p, context } = await setup({}, 1440);
      for (const width of [320, 390, 768, 1440]) {
        await p.setViewportSize({ width, height: 900 });
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `overflow at ${width}`,
        );
      }
      assert.equal(
        await p
          .locator(".swap-panel")
          .evaluate((el) => getComputedStyle(el).position),
        "sticky",
      );
      await p.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await p
          .locator(".energy-scene")
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await shot(p, "mock-home-1440.png");
      await context.close();
    },
  );
  await check(
    "Outage keeps first-screen product/action, prices unavailable and wallet keyboard escape restores focus",
    async () => {
      const { p, context } = await setup({ failRpc: true }, 390, false);
      assert.match(
        await p.locator("main").innerText(),
        /Unavailable|unavailable/,
      );
      const box = await p.locator(".gate-hall-heading a").boundingBox();
      assert(box.y < 844);
      await p.locator(".wallet-button").click();
      await p.keyboard.press("Escape");
      assert.equal(
        await p.locator(".wallet-dialog").evaluate((el) => el.open),
        false,
      );
      assert.equal(
        await p
          .locator(".wallet-button")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await context.close();
    },
  );
  await check(
    "Migration allowance, permanent-lock confirmation and weekly reward claim remain usable",
    async () => {
      const { p, s, context } = await setup({ v1Allowance: 10n * E });
      await connect(p);
      await p.locator(".mobile-nav select").selectOption("Migrate");
      await p.getByLabel("V1 amount", { exact: true }).fill("5");
      await p
        .getByLabel("I understand my V1 will be locked forever.", {
          exact: true,
        })
        .check();
      await p
        .getByRole("button", { name: "Review migration", exact: true })
        .click();
      let dialog = p.getByRole("dialog", { name: "Migrate V1 to UNLK2" });
      await dialog.getByRole("checkbox").check();
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirmed", exact: true })
        .waitFor();
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      assert.equal(s.totalMigrated, 5n * E);
      assert.equal(s.backing, s.capacity);
      await p.locator(".mobile-nav select").selectOption("Weekly IMD Rewards");
      await p
        .getByRole("button", { name: "Claim matured IMD", exact: true })
        .click();
      dialog = p.getByRole("dialog", { name: "Claim matured IMD" });
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirmed", exact: true })
        .waitFor();
      assert.equal(s.claimable, 0n);
      assert.equal(s.sends.length, 2);
      await context.close();
    },
  );
  await check(
    "Authentic native proof enters the installed adapter flow and duplicate credit is refused",
    async () => {
      const f = JSON.parse(
        await readFile(
          resolve(root, "test/fixtures/native-mainnet-claim.json"),
          "utf8",
        ),
      );
      const { p, s, context } = await setup({ address: f.account });
      await connect(p);
      await p.locator(".mobile-nav select").selectOption("My Rights");
      await p
        .getByLabel("Original claim amount (UNLK2)", { exact: true })
        .fill(formatUnits(BigInt(f.amount), 18));
      await p
        .getByLabel("Merkle proof (comma or space separated)", { exact: true })
        .fill(f.proof.join(" "));
      await p
        .getByRole("button", { name: "Verify claim evidence", exact: true })
        .click();
      const dialog = p.getByRole("dialog", {
        name: "Verify swarm claim credit",
      });
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirmed", exact: true })
        .waitFor();
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      assert.equal(s.nativeSynced, true);
      assert.equal(s.sends[0].to.toLowerCase(), adapter);
      await p
        .getByRole("button", { name: "Verify claim evidence", exact: true })
        .click();
      await p
        .getByText("This native round/account has already been credited.", {
          exact: true,
        })
        .waitFor();
      assert.equal(s.sends.length, 1);
      await context.close();
    },
  );
  await check(
    "Wrong-network event invalidates trading and the header switches back to Ethereum",
    async () => {
      const { p, s, context } = await setup();
      await connect(p);
      await p.locator("#swap-amount").fill("1");
      await p
        .getByRole("button", { name: "Approve IMD", exact: true })
        .waitFor();
      s.chain = 137;
      await p.evaluate(() => window.testWallet.emit("chainChanged", "0x89"));
      await p
        .getByRole("button", { name: "Switch to Ethereum", exact: true })
        .waitFor();
      assert.equal(await p.locator(".swap-panel .action").isDisabled(), true);
      assert.equal(
        await p
          .getByRole("button", { name: "Approve IMD", exact: true })
          .count(),
        0,
      );
      await p
        .getByRole("button", { name: "Switch to Ethereum", exact: true })
        .click();
      await p.waitForFunction(
        () => !document.querySelector(".shortcuts button")?.disabled,
      );
      assert.equal(s.chain, 1);
      assert.equal(s.sends.length, 0);
      await context.close();
    },
  );
  await check(
    "Quotes expire after 45 seconds; invalid USD stays unavailable instead of zero",
    async () => {
      const { p, s, context } = await setup({ invalidUsd: true });
      await connect(p);
      assert.match(await p.locator(".gate-three").innerText(), /Unavailable/);
      await p.locator("#swap-amount").fill("1");
      await p
        .getByRole("button", { name: "Approve IMD", exact: true })
        .waitFor();
      await p.clock.install();
      await p.clock.fastForward(46000);
      await p
        .getByText("Quote expired. Refresh before trading.", { exact: true })
        .waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: "Review swap", exact: true })
          .count(),
        0,
      );
      assert.equal(s.sends.length, 0);
      await context.close();
    },
  );
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(
    resolve(
      evidence,
      engine === "webkit"
        ? "webkit-browser-report.json"
        : "browser-report.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  server.close();
}
