// Render the local, data-free share image from the site's original art and licensed fonts.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root=resolve(new URL('../../',import.meta.url).pathname);
const html=`<!doctype html><html><head><link rel="stylesheet" href="/preview/design-assets.css"><style>
*{box-sizing:border-box}body{margin:0;background:#050807;color:#f2f1e6;font-family:Manrope,sans-serif}main{height:630px;padding:42px 50px;background:radial-gradient(ellipse at 65% 55%,#103a28,transparent 65%)}header{display:flex;align-items:center;gap:16px;border-bottom:1px solid #8b8364;padding-bottom:20px;font:600 28px Cinzel,serif}header img{width:48px;height:48px;object-fit:contain}header span{margin-left:auto;color:#a9b9b1;font:16px Manrope,sans-serif}.grid{display:grid;grid-template-columns:440px 1fr;align-items:center;gap:10px;margin-top:35px}h1{font:600 48px/1.3 Cinzel,serif;margin:0;color:#ecd08c}p{font-size:20px;line-height:1.7;color:#b9cec0}aside{display:flex;align-items:center}aside img{width:200px;height:280px;object-fit:contain;mix-blend-mode:screen;margin-left:-8px}.line{font:16px 'IBM Plex Mono',monospace;border-top:1px solid #35453b;padding-top:18px;margin-top:30px;color:#8fe4dc}
</style></head><body><main><header><img src="/preview/art/brand-mark.webp">UNLOCK V2<span>Ethereum · UNLK2 / IMD</span></header><div class="grid"><section><h1>Ten gates.<br>Permanent progress.</h1><p>Official-pool trading, irreversible burns<br>and weekly IMD fee rewards.</p></section><aside><img src="/preview/art/portal-open.webp"><img src="/preview/art/portal-current.webp"><img src="/preview/art/portal-locked.webp"></aside></div><div class="line">FDV, official volume or community burns. Any one threshold opens the next gate.</div></main></body></html>`;
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/share')return res.setHeader('Content-Type','text/html').end(html);
  if(!path.startsWith('/preview/'))return res.writeHead(404).end();
  const file=resolve(root,'web/public',path.slice(9));
  if(!file.startsWith(resolve(root,'web/public')+'/'))return res.writeHead(403).end();
  res.setHeader('Content-Type',({'.css':'text/css','.webp':'image/webp','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.goto(`http://127.0.0.1:${server.address().port}/share`);
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>im.decode()))});
 await page.screenshot({path:resolve(root,'web/public/og-image.png')});
 console.log('Rendered 1200×630 local share image; no balances, chart data or gate states claimed.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
