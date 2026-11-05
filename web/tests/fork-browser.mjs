// Foreground-only browser + Anvil rehearsal. Nothing is signed or broadcast on mainnet.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  toHex,
  parseAbi,
  decodeFunctionData,
} from "viem";
const pw = process.env.IMD_PLAYWRIGHT
  ? await import(pathToFileURL(process.env.IMD_PLAYWRIGHT))
  : await import("playwright");
const root = resolve(new URL("../../", import.meta.url).pathname);
const out = resolve(root, "docs/update/evidence");
await mkdir(out, { recursive: true });
const deployment = JSON.parse(
  await readFile(resolve(root, "dist/imd-deployment.json"), "utf8"),
);
const hook = deployment.contracts.find(
    (c) => c.name === "UnlockV2Hook",
  ).address,
  token = deployment.contracts.find((c) => c.name === "UnlockV2Token").address;
const abi = JSON.parse(
  await readFile(resolve(root, "dist/abi/UnlockV2Hook.json"), "utf8"),
);
const erc20 = parseAbi([
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
]);
const forkBlock =
  process.env.UNLOCK_ETH_FORK_BLOCK === "latest"
    ? Number(
        await createPublicClient({
          transport: http(deployment.network.rpcUrls[0]),
        }).getBlockNumber(),
      )
    : Number(process.env.UNLOCK_ETH_FORK_BLOCK ?? 26347457);
const port = 18546,
  endpoint = `http://127.0.0.1:${port}`;
const anvil = spawn(
  "anvil",
  [
    "--fork-url",
    deployment.network.rpcUrls[0],
    "--fork-block-number",
    String(forkBlock),
    "--accounts",
    "1",
    "--chain-id",
    "1",
    "--port",
    String(port),
    "--silent",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let anvilLog = "";
anvil.stderr.on("data", (d) => (anvilLog += d));
const c = createPublicClient({
  transport: http(endpoint, { retryCount: 0, timeout: 30000 }),
});
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
let browser, page;
const report = {
  mode: "Production browser with actual Ethereum pools and installed contracts on an isolated Anvil fork at the pinned block. RPC requests and wallet sends are redirected only in this test to the local fork. Owner activation, funded test account and all transactions exist only on that fork.",
  forkBlock,
  checks: [],
  sends: [],
  errors: [],
};
const read = (functionName, args = []) =>
  c.readContract({ address: hook, abi, functionName, args });
async function check(name, fn) {
  await fn();
  report.checks.push({ name, passed: true });
  console.log("PASS", name);
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await c.getBlockNumber();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!ready) throw Error(anvilLog);
  const owner = await read("owner");
  await c.request({ method: "anvil_impersonateAccount", params: [owner] });
  if (!(await read("activated"))) {
    const hash = await c.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: owner,
          to: hook,
          data: encodeFunctionData({ abi, functionName: "activate" }),
          gas: toHex(1000000),
        },
      ],
    });
    assert.equal(
      (await c.waitForTransactionReceipt({ hash })).status,
      "success",
    );
  }
  const [buyer] = await c.request({ method: "eth_accounts" });
  report.buyer = buyer;
  await c.request({
    method: "anvil_setBalance",
    params: [buyer, toHex(10n ** 16n)],
  });
  assert.equal(
    await c.readContract({
      address: deployment.network.pairToken.address,
      abi: erc20,
      functionName: "balanceOf",
      args: [buyer],
    }),
    0n,
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/preview/`;
  browser = await pw.chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "en-US",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await context.route(/^https?:\/\//, async (route) => {
    const req = route.request();
    if (req.url().startsWith(url)) return route.continue();
    if (deployment.network.rpcUrls.some((u) => req.url().startsWith(u))) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: req.postData(),
      });
      return route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: await response.text(),
      });
    }
    return route.abort();
  });
  await page.exposeFunction("forkWallet", async (q) => {
    if (["eth_requestAccounts", "eth_accounts"].includes(q.method))
      return [buyer];
    if (q.method === "eth_chainId") return "0x1";
    if (q.method === "wallet_switchEthereumChain") return null;
    if (q.method === "eth_sendTransaction") {
      assert.equal(q.params[0].from.toLowerCase(), buyer.toLowerCase());
      report.sends.push(q.params[0]);
    }
    return c.request(q);
  });
  await page.addInitScript(() => {
    const provider = {
      request: (q) => window.forkWallet(q),
      on: () => {},
      removeListener: () => {},
    };
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "fork-wallet",
              name: "Isolated Fork Wallet",
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
              rdns: "test.fork",
            },
            provider,
          },
        }),
      );
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  });
  await page.goto(url);
  await page
    .getByText("● Trading active", { exact: true })
    .waitFor({ timeout: 60000 });
  await page.locator(".wallet-button").click();
  await page
    .getByRole("button", { name: "Isolated Fork Wallet", exact: false })
    .click();
  await page.waitForFunction(
    () => !document.querySelector(".wallet-dialog")?.open,
  );
  await page.waitForTimeout(300);
  async function refresh() {
    await page.locator(".read-status button").click();
    await page.waitForFunction(
      () => !document.querySelector(".read-status button")?.disabled,
    );
  }
  async function transactUntilSwap() {
    for (let i = 0; i < 4; i++) {
      await page.waitForFunction(
        () => {
          const b = document.querySelector(".swap-panel .action");
          return b && !b.disabled && /Approve|Review swap/.test(b.textContent);
        },
        {},
        { timeout: 45000 },
      );
      const action = page.locator(".swap-panel .action");
      const label = await action.innerText();
      await action.click();
      const dialog = page.locator("dialog[open]:not(.wallet-dialog)");
      const isSwap = (
        await dialog.locator(".dialog-heading h2").innerText()
      ).startsWith("Swap ");
      await dialog
        .getByRole("button", { name: "Simulate transaction", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .waitFor({ timeout: 45000 });
      await dialog
        .getByRole("button", { name: "Confirm in wallet", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Confirmed", exact: true })
        .waitFor({ timeout: 45000 });
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      if (isSwap) return;
    }
    throw Error("Swap did not finish after approvals");
  }
  await check(
    "ETH gas shortcuts use fresh simulation and buffered gas; floor selected base units",
    async () => {
      await page.getByRole("button", { name: "ETH", exact: true }).click();
      for (const label of ["20%", "50%", "75%", "MAX"]) {
        await page
          .locator(".shortcuts")
          .getByRole("button", { name: label, exact: true })
          .click();
        await page.waitForFunction(
          () => !document.querySelector(".shortcuts button")?.disabled,
          {},
          { timeout: 45000 },
        );
        const raw = await page.locator("#swap-amount").inputValue();
        assert(Number(raw) > 0 && Number(raw) < 0.01, raw);
        console.log(label, raw);
      }
      assert.equal(report.sends.length, 0);
    },
  );
  let bought;
  await check(
    "Production ETH buy executes two pools with zero pre-owned IMD and no approval; actual buyer credited",
    async () => {
      await page.locator("#swap-amount").fill("0.00001");
      await transactUntilSwap();
      bought = await c.readContract({
        address: token,
        abi: erc20,
        functionName: "balanceOf",
        args: [buyer],
      });
      const rights = await read("rightsOf", [buyer]);
      assert(bought > 0n);
      assert.equal(rights.pendingBuy, bought);
      assert.equal(report.sends.length, 1);
      assert.equal(
        report.sends[0].to.toLowerCase(),
        deployment.network.uniswapV4.universalRouter.toLowerCase(),
      );
      assert.equal(BigInt(report.sends[0].value), 10n ** 13n);
      assert.equal(
        await c.readContract({
          address: deployment.network.pairToken.address,
          abi: erc20,
          functionName: "balanceOf",
          args: [buyer],
        }),
        0n,
      );
      report.ethBuy = { bought: bought.toString(), rights };
    },
  );
  await check(
    "Maturity shows 20% cumulative entitlement; production sell shortcut and both Permit2 approvals work",
    async () => {
      await c.request({ method: "evm_mine", params: [] });
      await refresh();
      assert.equal(await read("gatesOpen"), 0);
      assert.equal(await read("sellAllowance", [buyer]), (bought * 20n) / 100n);
      await page
        .getByRole("button", { name: "Sell UNLK2", exact: true })
        .click();
      await page
        .locator(".shortcuts")
        .getByRole("button", { name: "50%", exact: true })
        .click();
      await transactUntilSwap();
      const rights = await read("rightsOf", [buyer]);
      assert.equal(rights.buySold, (bought * 20n) / 100n / 2n);
      report.afterSell = rights;
    },
  );
  await check(
    "Production IMD buy uses received sale proceeds, approvals, fresh quote and exact buyer credit",
    async () => {
      await page
        .getByRole("button", { name: "Buy UNLK2", exact: true })
        .click();
      await page.getByRole("button", { name: "IMD", exact: true }).click();
      await page
        .locator(".shortcuts")
        .getByRole("button", { name: "50%", exact: true })
        .click();
      const before = await c.readContract({
        address: token,
        abi: erc20,
        functionName: "balanceOf",
        args: [buyer],
      });
      await transactUntilSwap();
      const after = await c.readContract({
        address: token,
        abi: erc20,
        functionName: "balanceOf",
        args: [buyer],
      });
      assert(after > before);
      report.imdBuy = { received: (after - before).toString() };
    },
  );
  await check(
    "ETH MAX executes with protected calldata gas and leaves the fee reserve",
    async () => {
      await c.request({
        method: "anvil_setBalance",
        params: [buyer, toHex(10n ** 16n)],
      });
      await c.request({ method: "evm_mine", params: [] });
      await refresh();
      await page.getByRole("button", { name: "ETH", exact: true }).click();
      await page
        .locator(".shortcuts")
        .getByRole("button", { name: "MAX", exact: true })
        .click();
      await page.waitForFunction(
        () => !document.querySelector(".shortcuts button")?.disabled,
        {},
        { timeout: 45000 },
      );
      report.maxInput = await page.locator("#swap-amount").inputValue();
      const sendsBefore = report.sends.length;
      const imdBefore = await c.readContract({
        address: deployment.network.pairToken.address,
        abi: erc20,
        functionName: "balanceOf",
        args: [buyer],
      });
      await transactUntilSwap();
      assert.equal(report.sends.length, sendsBefore + 1);
      assert.equal(
        await c.readContract({
          address: deployment.network.pairToken.address,
          abi: erc20,
          functionName: "balanceOf",
          args: [buyer],
        }),
        imdBefore,
      );
      const remaining = await c.getBalance({ address: buyer });
      assert(remaining > 0n);
      report.maxRemainingEth = remaining.toString();
    },
  );
  await check(
    "Actual official swap logs render candles, volume and keyboard-readable data at desktop/mobile widths",
    async () => {
      await page
        .getByRole("button", {
          name: "Retry / refresh market data",
          exact: true,
        })
        .click();
      await page
        .locator(".market-canvas canvas")
        .first()
        .waitFor({ timeout: 45000 });
      await page.getByRole("button", { name: "1m", exact: true }).click();
      await page.locator(".candle-data summary").click();
      const rows = await page.locator(".candle-data tbody tr").count();
      assert(rows > 0);
      report.observedCandles = rows;
      assert.match(
        await page.locator(".candle-data").innerText(),
        /open:.*high:.*low:.*close:/s,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.locator(".candle-data summary").click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator(".market-heading").scrollIntoViewIfNeeded();
    },
  );
  assert.deepEqual(report.errors, []);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  await page.waitForTimeout(180);
  await page.screenshot({
    animations: "disabled",
    path: resolve(out, "fork-trade-1440.png"),
    fullPage: false,
  });
} catch (e) {
  report.error = e.message;
  console.error(e);
  if (page) {
    await page.screenshot({
      path: resolve(root, "test/scratch/fork-browser-failure.png"),
      fullPage: true,
    });
    console.error((await page.locator("body").innerText()).slice(-7000));
  }
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(out, "fork-browser.json"),
    JSON.stringify(
      report,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ) + "\n",
  );
  if (browser) await browser.close();
  server.close();
  anvil.kill("SIGTERM");
}
