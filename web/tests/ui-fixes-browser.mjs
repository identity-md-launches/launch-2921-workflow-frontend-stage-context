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
  encodeAbiParameters,
  parseAbiParameters,
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
  evidence = resolve(root, "docs/ui-fixes/evidence");
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
        ".webp": "image/webp",
        ".ttf": "font/ttf",
        ".woff2": "font/woff2",
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
    ...(width <= 760 ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" } : {}),
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
const scratch = resolve(root, 'test/scratch/ui-fixes/shots');
await mkdir(scratch, {recursive:true});
async function settle(p) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const family of ['Cinzel','Manrope','IBM Plex Mono'])
      for (const weight of [400,600]) await document.fonts.load(`${weight} 16px "${family}"`);
    await Promise.all([...document.images].map(im => im.decode()));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}
async function shot(p,name,fullPage=false) {
  const path = resolve(evidence,`${engine}-${name}.jpg`);
  await p.screenshot({path,type:'jpeg',quality:76,fullPage,animations:'disabled'});
  report.screenshots.push(`docs/ui-fixes/evidence/${engine}-${name}.jpg`);
}
async function geometry(p) {
  await settle(p);
  return p.evaluate(() => Object.fromEntries(['.chart-panel','.swap-panel','.market-canvas','.market-canvas > div','.market-footer'].map(s => {
    const r=document.querySelector(s)?.getBoundingClientRect();
    return [s,r ? {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom} : null];
  })));
}
function history(s) {
  const token=deployment.contracts.find(c=>c.name==='UnlockV2Token').address;
  const hook=deployment.contracts.find(c=>c.name==='UnlockV2Hook').address;
  const pool=keccak256(encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'),[token,deployment.network.pairToken.address,12500,60,hook]));
  const event=parseAbiItem('event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)');
  s.blockTimes={};
  s.marketLogs=[4n,2n,1n].map((ago,i)=>{
    const block=s.block-ago;
    s.blockTimes[toHex(block)]=Math.floor(Date.now()/1000)-Number(ago)*900;
    return {address:deployment.network.uniswapV4.poolManager,
      topics:encodeEventTopics({abi:[event],eventName:'Swap',args:{id:pool,sender:owner}}),
      data:encodeAbiParameters(parseAbiParameters('int128,int128,uint160,uint128,int24,uint24'),[-E,BigInt(i+1)*10n**15n,2n**96n,E,0,12500]),
      blockNumber:toHex(block),blockHash:'0x'+'ef'.repeat(32),transactionHash:'0x'+String(i+1).padStart(64,'0'),transactionIndex:'0x0',logIndex:'0x0',removed:false};
  });
}
try {
  await check('All nine routes at 320, 390, 768, 1024 and 1440: headings, artwork, all six font faces and reflow',async()=>{
    const {p,s,context}=await setup({activated:false},1440);
    report.routes=[];
    for (const width of [320,390,768,1024,1440]) {
      await p.setViewportSize({width,height:width===1440?1000:844});
      for(const route of routes) {
        await p.goto(url+'#'+route);
        await p.locator(`main[data-screen="${route}"]`).waitFor();
        await p.getByText('● Trading closed',{exact:true}).waitFor();
        await settle(p);
        const details=await p.evaluate(()=>({
          overflow:document.documentElement.scrollWidth>innerWidth,
          images:[...document.images].filter(im=>!im.complete||!im.naturalWidth).map(im=>im.getAttribute('src')),
          fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),
          inputs:[...document.querySelectorAll('input:not([type=checkbox]),select')].filter(el=>el.getBoundingClientRect().width>0).map(el=>({name:el.id||el.getAttribute('aria-label'),size:parseFloat(getComputedStyle(el).fontSize),width:el.getBoundingClientRect().width}))
        }));
        assert(!details.overflow,`${route} @ ${width} overflows`);
        assert.deepEqual(details.images,[]);
        assert.equal(details.fonts.filter(f=>f.status==='loaded').length,6);
        if(width<=760) assert(details.inputs.every(i=>i.size>=16),`${route} @ ${width}: undersized mobile input`);
        assert.equal(await p.locator('h1').count(),1);
        await p.screenshot({path:resolve(scratch,`${engine}-${route}-${width}.jpg`),type:'jpeg',quality:60,fullPage:true,animations:'disabled'});
        report.routes.push({route,width,...details});
        if(route==='trade'&&(width===390||width===1440)) await shot(p,`trade-${width}`);
      }
    }
    assert.equal(s.sends.length,0);
    await context.close();
  });
  await check('390 first screen exposes product, all ten portals and main contribution action; keyboard focus and real navigation',async()=>{
    const {p,s,context}=await setup({activated:false},390);
    await settle(p);
    for(const selector of ['.brand','.wallet-button','h1','.gate-hall-heading a']) {
      const r=await p.locator(selector).boundingBox();
      assert(r.y>=0&&r.y+r.height<=844,`${selector} below first screen: ${JSON.stringify(r)}`);
    }
    assert.equal(await p.locator('.door-art img').count(),10);
    for(const route of ['trade','gates']) {
      await p.goto(url+'#'+route);
      await p.getByText('● Trading closed',{exact:true}).waitFor();
      for(let n=1;n<=10;n++) {
        await p.getByRole('button',{name:new RegExp(`Gate ${n}:`)}).click();
        assert.match(await p.locator('.gate-disclosure h3').innerText(),new RegExp(`Gate ${n} ·`));
      }
    }
    await p.locator('.gate-hall-heading a').click();
    await p.locator('main[data-screen="burn-points"]').waitFor();
    await p.locator('.mobile-nav select').selectOption('Trade');
    await p.locator('.preview-action').focus();await p.keyboard.press('Enter');
    assert(await p.locator('#active-gate').evaluate(el=>el===document.activeElement));
    await p.keyboard.press('Tab');
    assert(await p.getByLabel('Amount to burn (UNLK2)',{exact:true}).evaluate(el=>el===document.activeElement));
    await p.getByRole('button',{name:'Explore Golden Vault →',exact:true}).click();
    await p.locator('main[data-screen="golden-vault"]').waitFor();
    await p.locator('.skip-link').focus();await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(()=>location.hash),'#golden-vault');
    assert(await p.locator('main').evaluate(el=>el===document.activeElement));
    assert.equal(s.sends.length,0);await context.close();
  });
  await check('Fresh zero FDV and zero timestamp say Not yet observed on Home and both Gates progress widgets',async()=>{
    for(const invalidUsd of [false,true]) {
      const {p,s,context}=await setup({lastGateFdv:0n,lastObservation:0n,invalidUsd},1440);
      assert.equal(await p.locator('.gate-three progress').first().getAttribute('aria-valuetext'),'Not yet observed');
      assert.doesNotMatch(await p.locator('.gate-three .progress-row').first().innerText(),/0\.0%|\$0/);
      await p.goto(url+'#gates');await p.getByText('● Trading active',{exact:true}).waitFor();
      const fdv=p.getByRole('progressbar',{name:'OR · Contract FDV · last processed',exact:true});
      assert.equal(await fdv.getAttribute('aria-valuetext'),'Not yet observed');
      await p.locator('.observation-details summary').click();
      assert.match(await p.locator('.gate-observation').innerText(),/Last processed gate FDV\s+Not yet observed/);
      s.failRpc=true;await refresh(p);
      await p.getByText('● RPC unavailable',{exact:true}).waitFor();
      assert.equal(await fdv.getAttribute('aria-valuetext'),'Unavailable');
      assert.doesNotMatch(await p.locator('.gate-disclosure').innerText(),/Not yet observed/);
      assert.doesNotMatch(await p.locator('main').innerText(),/Historical last processed gate FDV:\s+Not yet observed/);
      s.failRpc=false;await refresh(p);
      await p.getByText('● Trading active',{exact:true}).waitFor();
      assert.equal(await fdv.getAttribute('aria-valuetext'),'Not yet observed');
      assert.equal(s.sends.length,0);await context.close();
    }
  });
  await check('RPC failure, expired processed observation and valid positive FDV remain distinct',async()=>{
    const failed=await setup({failRpc:true},390);
    await failed.p.locator('.observation-details summary').click();
    assert.doesNotMatch(await failed.p.locator('.gate-disclosure').innerText(),/Not yet observed/);
    assert.equal(await failed.p.locator('.gate-three progress').first().getAttribute('aria-valuetext'),'Unavailable');
    await failed.context.close();
    const expired=await setup({lastObservation:BigInt(Math.floor(Date.now()/1000)-6000)},390);
    assert.equal(await expired.p.locator('.gate-three progress').first().getAttribute('aria-valuetext'),'Unavailable');
    await expired.context.close();
    const valid=await setup({},390);
    assert.equal(await valid.p.locator('.gate-three progress').first().getAttribute('aria-valuetext'),'32.0% completed');
    assert.match(await valid.p.locator('.gate-three .progress-row').first().innerText(),/80,000/);
    await valid.context.close();
  });
  await check('Chart canvas fills desktop panel as quote appears and clears; mobile keeps usable height',async()=>{
    const state=fixture();state.chain=1;history(state);
    const {p,s,context}=await setup(state,1440);
    await connect(p);await p.locator('.market-canvas canvas').first().waitFor();
    report.chart=[];
    for(const width of [1440]) {
      await p.setViewportSize({width,height:1000});await p.locator('#swap-amount').fill('');
      const before=await geometry(p);
      await p.locator('#swap-amount').fill('1');await p.getByText('Minimum received',{exact:true}).waitFor();
      const quoted=await geometry(p);
      assert(Math.abs(quoted['.chart-panel'].height-quoted['.swap-panel'].height)<2);
      assert(quoted['.market-canvas'].height>before['.market-canvas'].height+40,JSON.stringify({width,before,quoted}));
      assert(Math.abs(quoted['.market-canvas > div'].height-quoted['.market-canvas'].height)<3,'Chart renderer did not resize');
      assert(quoted['.market-footer'].bottom-quoted['.market-canvas'].bottom<140,'Excessive gap below chart');
      if(width===1440)await shot(p,'quoted-chart');
      await p.locator('#swap-amount').fill('');await p.getByText('Minimum received',{exact:true}).waitFor({state:'hidden'});
      const cleared=await geometry(p);
      assert(Math.abs(cleared['.market-canvas'].height-before['.market-canvas'].height)<3);
      report.chart.push({width,before,quoted,cleared});
    }
    await p.setViewportSize({width:390,height:844});const mobile=await geometry(p);
    assert(mobile['.market-canvas'].height>=270);assert(mobile['.swap-panel'].y<mobile['.chart-panel'].y);
    assert.equal(s.sends.length,0);await context.close();
  });
  await check('Desktop contribution spans content width with art beside readable form; mobile stacks',async()=>{
    const {p,s,context}=await setup({activated:false},1440);
    report.contribution=[];
    for(const width of [1440,390,320]) {
      await p.setViewportSize({width,height:1000});await settle(p);
      const boxes=await p.evaluate(()=>Object.fromEntries(['main','#active-gate > .two-col','#active-gate .panel','#active-gate .energy-scene','#active-gate .field','#active-gate input'].map(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return[sel,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}]})));
      assert(boxes['#active-gate .panel'].width>=boxes['#active-gate > .two-col'].width-2,JSON.stringify({width,boxes}));
      if(width>=801) {
        assert(boxes['#active-gate .field'].x>=boxes['#active-gate .energy-scene'].right+10,JSON.stringify({width,boxes}));
        assert(boxes['#active-gate input'].width>=340,JSON.stringify({width,boxes}));
      } else {
        assert(boxes['#active-gate .field'].y>=boxes['#active-gate .energy-scene'].bottom);
        assert(boxes['#active-gate input'].width>=250);
      }
      if(width===1440) {
        await p.locator('#active-gate').scrollIntoViewIfNeeded();await shot(p,'contribution-desktop');
      }
      report.contribution.push({width,boxes});
    }
    assert.equal(s.sends.length,0);await context.close();
  });
  await check('Closed market preserves honest empty history; market RPC errors offer retry without candles',async()=>{
    const {p,s,context}=await setup({activated:false},1440);
    await p.locator('.chart-empty').waitFor();
    assert.match(await p.locator('.chart-empty').innerText(),/Trading closed/);
    assert.equal(await p.locator('.market-canvas canvas').count(),0);
    s.failMarket=true;await p.getByRole('button',{name:'Retry / refresh market data',exact:true}).click();
    await p.locator('.chart-panel .error').waitFor();assert.equal(await p.locator('.market-canvas canvas').count(),0);
    s.failMarket=false;await p.getByRole('button',{name:'Retry / refresh market data',exact:true}).click();
    await p.locator('.chart-empty').waitFor();assert.equal(s.sends.length,0);await context.close();
  });
  await check('Wallet sheet: named EIP-6963 wallet, phone links, Coinbase, focus trap, Escape, rejection and network switch',async()=>{
    const phone=await setup({},390,false);
    await phone.p.locator('.wallet-button').click();
    for(const wallet of ['MetaMask','Coinbase Wallet','Rabby','Phantom']) assert(await phone.p.getByRole('link',{name:`Open in ${wallet}`,exact:false}).isVisible());
    await phone.context.close();
    const {p,s,context}=await setup({chain:137},390);
    await p.locator('.wallet-button').click();
    assert(await p.getByRole('button',{name:'Test Wallet',exact:false}).isVisible());
    assert.match(await p.locator('.wallet-dialog').innerText(),/Coinbase/);
    for(let n=0;n<12;n++){await p.keyboard.press('Tab');assert(await p.locator('.wallet-dialog').evaluate(el=>el.contains(document.activeElement)));}
    await p.keyboard.press('Escape');assert(await p.locator('.wallet-button').evaluate(el=>el===document.activeElement));
    await p.locator('.wallet-button').click();s.reject=true;
    await p.getByRole('button',{name:'Test Wallet',exact:false}).click();
    await p.locator('.wallet-dialog .error').waitFor();s.reject=false;
    await p.getByRole('button',{name:'Test Wallet',exact:false}).click();
    await p.waitForFunction(()=>!document.querySelector('.wallet-dialog')?.open);
    s.chain=137;
    await p.evaluate(()=>window.testWallet.emit('chainChanged','0x89'));
    await p.getByRole('button',{name:'Switch to Ethereum',exact:true}).waitFor();
    await p.getByRole('button',{name:'Switch to Ethereum',exact:true}).click();
    await p.waitForFunction(()=>!document.querySelector('.shortcuts button')?.disabled);
    assert.equal(s.chain,1);assert.equal(s.sends.length,0);await context.close();
  });
  await check('Reduced motion stops core motion and keyboard focus remains visible',async()=>{
    const {p,context}=await setup({},390);
    await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.preview-action').focus();
    const styles=await p.locator('.preview-action').evaluate(el=>({outline:getComputedStyle(el).outlineStyle,width:parseFloat(getComputedStyle(el).outlineWidth)}));
    assert.notEqual(styles.outline,'none');assert(styles.width>=2);
    assert.equal(await p.locator('.core-light').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    await shot(p,'keyboard-focus');await context.close();
  });
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.resourceFailures,[]);
} finally {
  await writeFile(resolve(evidence,`ui-fixes-${engine}.json`),JSON.stringify(report,null,2)+'\n');
  await browser.close();await new Promise(r=>server.close(r));
}
