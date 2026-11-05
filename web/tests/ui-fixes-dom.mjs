// Production JavaScript in a simulated DOM. This does NOT measure layout or replace browser checks.
// Optional test-only dependency: jsdom@26.1.0, selected with IMD_JSDOM; no runtime dependency.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {keccak256} from 'viem';
import {fixture,rpcMock,deployment,adapter,walletQuoter} from './mock.mjs';
const {JSDOM,VirtualConsole}=process.env.IMD_JSDOM?await import(pathToFileURL(process.env.IMD_JSDOM)):await import('jsdom');
const root=new URL('../../',import.meta.url);
const report={mode:'Actual dist JavaScript executed in jsdom. Synthetic RPC, EIP-6963 wallet, modal/scroll browser APIs. No layout, image decoding, font rendering, native dialogs or physical wallets are verified. No real signing/broadcasts.',checks:[],errors:[]};
const virtualConsole=new VirtualConsole();
virtualConsole.on('jsdomError',e=>report.errors.push(e.message));
const dom=new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>',{url:'https://local.invalid/preview/',pretendToBeVisual:true,virtualConsole});
const win=dom.window;
for(const k of ['window','document','location','localStorage','HTMLElement','HTMLDialogElement','Event','CustomEvent','MouseEvent','KeyboardEvent','MutationObserver'])globalThis[k]=k==='window'?win:win[k];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
Object.defineProperty(win.navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);
globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);
win.scrollTo=()=>{};win.HTMLElement.prototype.scrollIntoView=()=>{};
win.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector('button')?.focus();};
win.HTMLDialogElement.prototype.close=function(){this.open=false;};
const s=Object.assign(fixture(),{chain:1,activated:false,lastGateFdv:0n,lastObservation:0n});
const m=rpcMock(s);
const listeners={};
let discovery=false;
const provider={request:m.wallet,on:(n,f)=>(listeners[n]??=[]).push(f),removeListener:(n,f)=>listeners[n]=(listeners[n]??[]).filter(x=>x!==f)};
const announce=()=>discovery&&win.dispatchEvent(new win.CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'ui-fixture',name:'Fixture Wallet',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',rdns:'fixture.wallet'},provider}}));
win.addEventListener('eip6963:requestProvider',announce);
globalThis.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,win.location.href);
  if(deployment.network.rpcUrls.some(r=>url.href.startsWith(r))){
    if(s.failRpc)return new Response('Synthetic RPC outage',{status:503});
    const q=JSON.parse(options.body);
    const result=Array.isArray(q)?await Promise.all(q.map(m.rpc)):await m.rpc(q);
    return Response.json(result);
  }
  if(url.origin!=='https://local.invalid')throw Error('Unmocked network blocked: '+url.origin);
  const path=url.pathname.replace(/^\/preview\//,'');
  if(path.includes('..')||path.startsWith('/'))throw Error('Unsafe asset');
  let body=await readFile(new URL('dist/'+path,root),'utf8');
  if(path==='contract-runtime.json'){
    const inv=JSON.parse(body);inv.contracts.forEach(c=>c.runtimeCodeHash=keccak256('0x60016000'));
    inv.contracts.find(c=>c.name==='MigrationVault').address='0x1111111111111111111111111111111111111111';
    inv.contracts.find(c=>c.name==='RewardPot').address='0x2222222222222222222222222222222222222222';body=JSON.stringify(inv);
  }
  if(path==='repair-config.json'){
    const cfg=JSON.parse(body);cfg.adapter={address:adapter,runtimeCodeHash:keccak256('0x60016000')};cfg.quoter={address:walletQuoter,runtimeCodeHash:keccak256('0x60016000')};body=JSON.stringify(cfg);
  }
  return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
};
const wait=async(fn,label)=>{const until=Date.now()+8000;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out: '+label+'; '+document.querySelector('.read-status')?.textContent);};
const el=selector=>{const result=document.querySelector(selector);assert(result,'Missing '+selector);return result;};
const button=text=>{const result=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert(result,'Missing button '+text);return result;};
const check=async(name,fn)=>{try{await fn();report.checks.push({name,passed:true});console.log('PASS',name);}catch(e){report.checks.push({name,passed:false,error:e.message});throw e;}};
const navigate=async(route)=>{win.location.hash=route;win.dispatchEvent(new win.Event('hashchange'));await wait(()=>document.querySelector(`main[data-screen="${route}"]`),'route '+route);};
const CSSescape=value=>value.replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c);
const input=async(selector,value)=>{const field=el(selector);Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new win.Event('input',{bubbles:true}));field.dispatchEvent(new win.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20));};
const refresh=async()=>{el('.read-status button').click();await wait(()=>el('.read-status button').disabled,'refresh started');await wait(()=>!el('.read-status button').disabled,'refresh completed');};
try{
  const html=await readFile(new URL('dist/index.html',root),'utf8');
  const entry=html.match(/<script type="module" src="([^"]+)"/)[1];
  await import(new URL('dist/'+entry,root).href);
  await wait(()=>document.querySelector('.read-status')?.textContent.includes('Trading closed'),'verified state');
  await check('All nine hash routes retain exactly one heading and their primary controls',async()=>{
    for(const route of ['trade','gates','migrate','my-rights','burn-points','weekly-imd-rewards','golden-vault','rules-contracts','integration-status']){
      await navigate(route);assert.equal(document.querySelectorAll('h1').length,1);assert(document.querySelectorAll('main button,main input,main a').length>0);
    }
    await navigate('trade');assert.equal(document.querySelectorAll('.gate-door').length,10);
  });
  await check('Closed market has honest empty history; log failure/retry never adds demo candles',async()=>{
    await wait(()=>document.querySelector('.chart-empty'),'empty market history');
    assert.match(el('.chart-empty').textContent,/Trading closed/);assert.equal(document.querySelectorAll('.market-canvas canvas').length,0);
    s.failMarket=true;button('Retry / refresh market data').click();
    await wait(()=>el('.chart-panel').textContent.includes('Official-pool history unavailable'),'market RPC failure');
    assert.equal(document.querySelectorAll('.market-canvas canvas').length,0);
    s.failMarket=false;button('Retry / refresh market data').click();await wait(()=>document.querySelector('.chart-empty'),'market retry');
  });
  await check('Successful zero FDV/zero observation is Not yet observed on both gate components',async()=>{
    assert.equal(el('.gate-three progress').getAttribute('aria-valuetext'),'Not yet observed');
    assert.doesNotMatch(el('.gate-three .progress-row').textContent,/0\.0%|\$0/);
    await navigate('gates');assert.equal(el('progress[aria-label="OR · Contract FDV · last processed"]').getAttribute('aria-valuetext'),'Not yet observed');
    assert.match(el('.gate-observation').textContent,/Last processed gate FDV\s*Not yet observed/);
  });
  await check('Failed read and retained stale zero snapshot never impersonate a missing observation; retry recovers',async()=>{
    s.failRpc=true;await refresh();await wait(()=>el('.read-status').textContent.includes('RPC unavailable'),'RPC failure');
    assert.equal(el('.gate-three progress').getAttribute('aria-valuetext'),'Unavailable');
    assert.equal(el('progress[aria-label="OR · Contract FDV · last processed"]').getAttribute('aria-valuetext'),'Unavailable');
    assert.doesNotMatch(el('.gate-observation').textContent,/Not yet observed/);
    assert.doesNotMatch(document.querySelector('main').textContent,/Historical last processed gate FDV:\s*Not yet observed/);
    s.failRpc=false;await refresh();await wait(()=>el('.read-status').textContent.includes('Trading closed'),'retry');
    assert.equal(el('.gate-three progress').getAttribute('aria-valuetext'),'Not yet observed');
  });
  await check('Positive, expired and invalid-price observations are distinct from zero observations',async()=>{
    s.lastGateFdv=80000n*10n**18n;s.lastObservation=BigInt(Math.floor(Date.now()/1000));await refresh();
    assert.equal(el('.gate-three progress').getAttribute('aria-valuetext'),'32.0% completed');
    s.lastObservation=BigInt(Math.floor(Date.now()/1000)-6000);await refresh();assert.equal(el('.gate-three progress').getAttribute('aria-valuetext'),'Unavailable');
    s.lastGateFdv=0n;s.lastObservation=0n;s.invalidUsd=true;await refresh();assert.equal(el('.gate-three progress').getAttribute('aria-valuetext'),'Not yet observed');
    s.invalidUsd=false;await refresh();
  });
  await check('Every portal selects thresholds; contribution and vault previews reach the actual controls',async()=>{
    await navigate('trade');
    for(const portal of document.querySelectorAll('.gate-door')){portal.click();await new Promise(r=>setTimeout(r,10));assert.equal(portal.getAttribute('aria-pressed'),'true');}
    el('.preview-action').click();assert.equal(document.activeElement.id,'active-gate');
    assert(el('#active-gate input').labels.length>0);
    button('Explore Golden Vault →').click();await wait(()=>document.querySelector('main[data-screen="golden-vault"]'),'vault preview');
    await navigate('gates');el('.gate-hall-heading a').click();await wait(()=>document.querySelector('main[data-screen="burn-points"]'),'contribution route');
  });
  await check('Wallet sheet discovers EIP-6963, offers four mobile wallet links and Coinbase, closes and connects',async()=>{
    await navigate('trade');el('.wallet-button').click();await wait(()=>document.querySelector('.wallet-dialog')?.open,'wallet dialog');
    assert.match(el('.wallet-dialog').textContent,/Coinbase Smart Wallet/);
    for(const wallet of ['MetaMask','Coinbase Wallet','Rabby','Phantom'])assert([...el('.wallet-dialog').querySelectorAll('a')].some(a=>a.textContent.includes('Open in '+wallet)));
    discovery=true;announce();await wait(()=>el('.wallet-dialog').textContent.includes('Fixture Wallet'),'EIP-6963 discovery');
    el('[aria-label="Close wallet dialog"]').click();await wait(()=>!el('.wallet-dialog').open,'wallet close');
    el('.wallet-button').click();await wait(()=>el('.wallet-dialog').open,'wallet reopen');
    [...el('.wallet-dialog').querySelectorAll('button')].find(b=>b.textContent.includes('Fixture Wallet')).click();
    await wait(()=>!el('.wallet-dialog').open&&!el('.shortcuts button').disabled,'wallet connected');
    assert.equal(s.sends.length,0);assert(el('.swap-panel .action').disabled,'Closed trading must disable connected swap');
  });
  await check('IMD quote/slippage retains minimum output; unsupported ETH simulation stops on pinned route',async()=>{
    s.activated=true;await refresh();await wait(()=>el('.read-status').textContent.includes('Trading active'),'active mock');
    await input('#swap-amount','1');await wait(()=>el('.swap-panel').textContent.includes('Minimum received'),'IMD quote');
    assert.match(el('.visible-route').textContent,/IMD → UNLK2/);
    assert.match(el('.swap-panel').textContent,/Reward fee · exact/);
    await input('#slippage','0.75');await wait(()=>el('.swap-panel').textContent.includes('Minimum received'),'slippage quote');
    button('ETH').click();await wait(()=>el('.visible-route').textContent.includes('ETH → IMD → UNLK2'),'ETH route');
    await input('#swap-amount','0.001');await wait(()=>el('.swap-panel').textContent.includes('Full-route simulation unavailable'),'unsupported ETH simulation guard');
    assert.doesNotMatch(el('.swap-panel').textContent,/Minimum received/);
    assert(!s.calls.some(c=>c.method==='approve'));
    assert.equal(s.sends.length,0);
    await input('#swap-amount','');await wait(()=>!el('.swap-panel').textContent.includes('Minimum received'),'quote cleared');
    assert.equal(s.sends.length,0);
  });
  await check('IMD percentage shortcuts and sell quota cap remain enforced without signing',async()=>{
    button('IMD').click();await new Promise(r=>setTimeout(r,20));
    el('.shortcuts button').click();await wait(()=>el('#swap-amount').value==='2000','20% IMD balance');
    button('Sell UNLK2').click();await new Promise(r=>setTimeout(r,20));
    const max=[...el('.shortcuts').querySelectorAll('button')].find(b=>b.textContent==='MAX');max.click();
    await wait(()=>el('#swap-amount').value==='200','sell max capped to quota');
    assert.equal(el('#swap-amount').value,'200');assert.equal(s.sends.length,0);
  });
  await check('Burn preview, weekly reward control and Golden Vault locked/open states remain available',async()=>{
    await navigate('burn-points');
    const burnInput=[...document.querySelectorAll('input')].find(i=>[...i.labels??[]].some(l=>l.textContent==='Amount to burn (UNLK2)'));
    assert(burnInput);await input('#'+CSSescape(burnInput.id),'5');
    button('Preview burn and rights').click();await wait(()=>document.querySelector('main').textContent.includes('Onchain burn preview'),'burn preview');
    assert.match(document.querySelector('main').textContent,/Estimated future reward share/);
    await navigate('weekly-imd-rewards');assert(button('Claim matured IMD'));
    await navigate('golden-vault');assert.match(document.querySelector('main').textContent,/Opens at gate 10/);
    s.gates=10;await refresh();assert.match(document.querySelector('main').textContent,/Burn & Points|voluntary/i);
    assert.equal(s.sends.length,0);
  });
  await check('Migration approval review requires acknowledgement and preserves exact amount without signing',async()=>{
    await navigate('migrate');
    const field=[...document.querySelectorAll('input')].find(i=>[...i.labels??[]].some(l=>l.textContent==='V1 amount'));
    assert(field);await input('#'+CSSescape(field.id),'5');
    el('.check input[type=checkbox]').click();
    await wait(()=>!button('Approve V1').disabled,'migration acknowledgement');button('Approve V1').click();
    await wait(()=>document.querySelector('dialog[open]')?.textContent.includes('Approve V1 for migration'),'migration review');
    assert.match(el('dialog[open]').textContent,/5 V1/);assert.equal(s.sends.length,0);
    el('dialog[open] [aria-label="Close review"]').click();
  });
  assert.deepEqual(report.errors,[]);
}catch(e){console.error(e.message);process.exitCode=1;}finally{
  await mkdir(new URL('docs/ui-fixes/',root),{recursive:true});
  report.mockTransactionsSent=s.sends.length;
  await writeFile(new URL('docs/ui-fixes/dom-validation.json',root),JSON.stringify(report,null,2)+'\n');
  win.close();
}
process.exit(process.exitCode??0);
