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
  evidence = resolve(root, "docs/redesign/evidence");
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
  resourceFailures: [],
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
  p.on("requestfailed",req=>{if(req.url().startsWith(url)) report.resourceFailures.push({url:req.url().replace(url,"/preview/"),error:req.failure()?.errorText})});
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

const routes = ["trade", "gates", "migrate", "my-rights", "burn-points", "weekly-imd-rewards", "golden-vault", "rules-contracts", "integration-status"];
try {
  const {p, s, context} = await setup({activated:false}, 1440);
  await check('Desktop reference composition keeps progress, swap action and both previews on the first screen',async()=>{
    await p.setViewportSize({width:1440,height:1000});
    await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})))});
    await p.locator('.chart-empty').waitFor();
    const boxes=await p.evaluate(()=>Object.fromEntries(['.gate-disclosure','.dashboard-grid','.swap-panel .action','.art-panels'].map(sel=>{
      const r=document.querySelector(sel).getBoundingClientRect();
      return [sel,{y:r.y,height:r.height,bottom:r.bottom}];
    })));
    assert(boxes['.gate-disclosure'].height>=60 && boxes['.gate-disclosure'].height<=85,JSON.stringify(boxes));
    assert(boxes['.dashboard-grid'].y>=330 && boxes['.dashboard-grid'].y<=390,JSON.stringify(boxes));
    assert(boxes['.dashboard-grid'].height>=320 && boxes['.dashboard-grid'].height<=400,JSON.stringify(boxes));
    assert(boxes['.swap-panel .action'].bottom<800,JSON.stringify(boxes));
    assert(boxes['.art-panels'].y>=650 && boxes['.art-panels'].y<=725,JSON.stringify(boxes));
    assert(boxes['.art-panels'].bottom<1000,JSON.stringify(boxes));
    assert.equal(await p.locator('.gate-three progress:visible').count(),3);
    assert.equal(await p.locator('.gate-three .progress-row').filter({hasText:'Remaining:'}).count(),3);
    await p.locator('.slippage-setting input').fill('0.75');
    assert.equal(await p.locator('#slippage').inputValue(),'0.75');
    assert.match(await p.locator('.visible-route').innerText(),/IMD → UNLK2/);
    await p.locator('.swap-context summary').click();
    assert.match(await p.locator('.swap-context').innerText(),/three-minute router/);
    assert.match(await p.locator('#shortcut-context').innerText(),/available IMD balance/);
    await p.locator('.swap-context summary').click();
    await p.locator('.observation-details summary').click();
    assert.match(await p.locator('.observation-details').innerText(),/Indicative live FDV/);
    assert.match(await p.locator('.observation-details').innerText(),/Last processed gate FDV/);
    await p.locator('.observation-details summary').click();
    report.desktopComposition=boxes;
  });
  await check("All nine routes: 390/1440, assets, fonts, overflow, heading and keyboard skip", async () => {
    for (const width of [1440,390]) {
      await p.setViewportSize({width,height:width===1440?1000:844});
      for (const route of routes) {
        await p.goto(url+'#'+route);
        await p.locator(`main[data-screen="${route}"]`).waitFor();
        await p.waitForFunction(()=>document.querySelector('.read-status')?.textContent.includes('Trading closed'));
        await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})))});
        assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow: ${route} @ ${width}`);
        assert.equal(await p.locator('h1').count(),1);
        const badImages=await p.evaluate(()=>[...document.images].filter(im=>!im.complete||!im.naturalWidth).map(im=>im.src));
        assert.deepEqual(badImages,[],`Broken images ${route}`);
        assert(await p.evaluate(()=>document.fonts.check('400 16px Manrope')));
        assert(await p.evaluate(()=>document.fonts.check('600 24px Cinzel')));
        const hash=await p.evaluate(()=>location.hash);
        await p.locator('.skip-link').focus();
        await p.keyboard.press('Enter');
        assert.equal(await p.evaluate(()=>location.hash),hash,'Skip changed route');
        assert(await p.locator('main').evaluate(el=>el===document.activeElement));
        await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)});
        if (engine === "chromium" || route === "trade") {
          const prefix = engine === "chromium" ? "mock" : "mock-webkit";
          const path=resolve(evidence,`${prefix}-${route}-${width}.jpg`);
          await p.screenshot({path,fullPage:true,type:'jpeg',quality:67,animations:'disabled'});
          report.screenshots.push(`docs/redesign/evidence/${prefix}-${route}-${width}.jpg`);
        }
        report.checks.push({name:`${route} @ ${width}: heading, loaded artwork/fonts, no overflow, skip focus and route preserved`,passed:true});
      }
    }
  });
  await check('Every portal selects live thresholds on Home and Gates',async()=>{
    for (const route of ['trade','gates']) {
      await p.goto(url+'#'+route);
      await p.locator('.gate-door').first().waitFor();
      assert.equal(await p.locator('.gate-door').count(),10);
      for(let n=1;n<=10;n++) {
        await p.getByRole('button',{name:new RegExp(`Gate ${n}:`)}).click();
        assert.match(await p.locator('.gate-disclosure h3').innerText(),new RegExp(`Gate ${n} ·`));
        assert.equal(await p.locator('.gate-three progress').count(),3);
      }
    }
  });
  await check('Contribute action focuses real form; home previews navigate; closed swaps remain disabled',async()=>{
    await p.goto(url+'#trade');
    await p.locator('.gate-hall-heading a').click();
    assert(await p.locator('#active-gate').evaluate(el=>el===document.activeElement));
    for(const width of [390,1440]) {
      await p.setViewportSize({width,height:width===1440?1000:844});
      assert.match(await p.locator('.preview-action').innerText(),/Contribute UNLK2/);
      await p.locator('.preview-action').focus();
      await p.keyboard.press('Enter');
      assert(await p.locator('#active-gate').evaluate(el=>el===document.activeElement));
      await p.keyboard.press('Tab');
      assert(await p.locator('#active-gate input').first().evaluate(el=>el===document.activeElement));
    }
    await p.getByRole('button',{name:'Explore Golden Vault →',exact:true}).click();
    await p.locator('main[data-screen="golden-vault"]').waitFor();
    assert.match(await p.locator('main').innerText(),/Opens at gate 10/);
    await p.goto(url+'#trade');
    await p.locator('.swap-panel .action').click();
    await p.getByRole('button',{name:'Test Wallet',exact:false}).click();
    await p.waitForFunction(()=>!document.querySelector('.wallet-dialog')?.open);
    await p.waitForTimeout(200);
    assert(await p.locator('.swap-panel .action').isDisabled());
    assert.equal(s.sends.length,0);
  });
  await context.close();
  await check('Gate ten preview names voluntary burning and transfers keyboard focus without signing',async()=>{
    const item=await setup({gates:10,activated:true},390);
    await connect(item.p);
    for(const width of [390,1440]) {
      await item.p.setViewportSize({width,height:width===1440?1000:844});
      assert.equal(await item.p.locator('.preview-action').innerText(),'Burn for points ↓');
      assert.match(await item.p.locator('#active-gate h2').first().innerText(),/Golden Vault · voluntary burning/);
      await item.p.locator('.preview-action').focus();
      await item.p.keyboard.press('Enter');
      assert(await item.p.locator('#active-gate').evaluate(el=>el===document.activeElement));
      await item.p.keyboard.press('Tab');
      assert(await item.p.locator('#active-gate input').first().evaluate(el=>el===document.activeElement));
    }
    assert.equal(item.s.sends.length,0);
    await item.context.close();
  });
  await check("Unavailable chain state on all nine routes at mobile and desktop; no signing enabled", async()=>{
    const outage=await setup({failRpc:true},390);
    await outage.p.locator('.wallet-button').click();
    await outage.p.getByRole('button',{name:'Test Wallet',exact:false}).click();
    await outage.p.waitForFunction(()=>!document.querySelector('.wallet-dialog')?.open);
    for (const width of [390,1440]) {
      await outage.p.setViewportSize({width,height:844});
      for (const route of routes) {
        await outage.p.goto(url+'#'+route);
        await outage.p.locator(`main[data-screen="${route}"]`).waitFor();
        await outage.p.getByText('● RPC unavailable',{exact:true}).waitFor();
        assert(await outage.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await outage.p.locator('button.action:enabled').count(),0,`${route}: unsafe enabled action during RPC failure`);
      }
    }
    assert.equal(outage.s.sends.length,0);
    await outage.context.close();
  });
  await check("Historical burn failure stays unavailable, retry fetches complete history",async()=>{
    const item=await setup({gates:1},390);
    const fail=async(route)=>{
      const req=route.request();
      const raw=req.postDataJSON();
      const qs=Array.isArray(raw)?raw:[raw];
      if(qs.some(q=>q.method==='eth_getLogs' && String(q.params?.[0]?.address).toLowerCase()===deployment.contracts.find(c=>c.name==='UnlockV2Token').address.toLowerCase()))return route.fulfill({status:503,body:'Synthetic event-history outage'});
      return route.fallback();
    };
    await item.context.route(/ethereum-rpc|eth\.drpc/,fail);
    await item.p.getByRole('button',{name:/Gate 1:/}).click();
    await item.p.getByText(/Partial results are discarded/).waitFor();
    assert.equal(await item.p.locator('.gate-three progress').nth(2).getAttribute('aria-valuetext'),'Unavailable');
    await item.context.unroute(/ethereum-rpc|eth\.drpc/,fail);
    await item.p.getByRole('button',{name:'Retry gate history',exact:true}).click();
    await item.p.getByText(/Gate 1 burn total from token Contributed events/).waitFor();
    assert.equal(await item.p.locator('.gate-three progress').nth(2).getAttribute('aria-valuetext'),'0.0% completed');
    await item.context.close();
  });
  await check("Initial loading state, wallet focus trap, navigation-menu Escape and connected rights",async()=>{
    const item=await setup({},1440);
    await item.p.locator('.more-nav summary').click();
    await item.p.keyboard.press('Escape');
    assert.equal(await item.p.locator('.more-nav').getAttribute('open'),null);
    await item.p.locator('.wallet-button').click();
    for(let n=0;n<8;n++) {
      await item.p.keyboard.press('Tab');
      assert(await item.p.locator('.wallet-dialog').evaluate(el=>el.contains(document.activeElement)));
    }
    await item.p.keyboard.press('Escape');
    assert(await item.p.locator('.wallet-button').evaluate(el=>el===document.activeElement));
    let release;
    const gate=new Promise(r=>release=r);
    await item.context.route('**/imd-deployment.json',async route=>{await gate;await route.continue()});
    const navigation=item.p.reload();
    await item.p.getByText('● Loading deployment',{exact:true}).waitFor();
    assert.match(await item.p.locator('main').innerText(),/Loading the attested runtime/);
    release();await navigation;
    await item.p.getByRole('button',{name:/Gate 1:/}).waitFor();
    await item.p.getByText('● Trading active',{exact:true}).waitFor();
    await connect(item.p);
    await item.p.goto(url+'#my-rights');
    await item.p.getByText('Matured buy credits',{exact:true}).waitFor();
    for(const width of [390,1440]) {
      await item.p.setViewportSize({width,height:844});
      const path=resolve(evidence,`mock-connected-rights-${width}.jpg`);
      if(engine==='chromium')await item.p.screenshot({path,fullPage:true,type:'jpeg',quality:67,animations:'disabled'});
    }
    await item.context.close();
  });
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.resourceFailures,[]);
} finally {
 await writeFile(resolve(evidence,`all-routes-${engine}.json`),JSON.stringify(report,null,2)+'\n');
 await browser.close();await new Promise(r=>server.close(r));
}
