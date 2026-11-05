// Read-only HTTPS comparison. This cannot publish and never opens a signer.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const base='https://unlock-v2.imd.site/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const expectedManifest=await readFile(new URL('dist/imd-deployment.json',root));
const expected=JSON.parse(expectedManifest);
const report={checkedAt:new Date().toISOString(),mode:'Read-only public HTTPS, no mocks, wallets, signing, chain writes or publication.',url:base,expectedBuildId:'sha256:'+sha(expectedManifest),assets:[],errors:[]};
async function get(path) {
  if(path.startsWith('/')||path.includes('..')||path.includes(':'))throw Error('Unsafe asset path');
  const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(30000),cache:'no-store'});
  return {status:r.status,type:r.headers.get('content-type'),body:Buffer.from(await r.arrayBuffer())};
}
try {
  const current=await get('imd-deployment.json');
  report.manifestStatus=current.status;
  report.publicBuildId='sha256:'+sha(current.body);
  report.matchesDeliveredManifest=sha(current.body)===sha(expectedManifest);
  for(let start=0;start<expected.assets.length;start+=6) {
    await Promise.all(expected.assets.slice(start,start+6).map(async asset=>{
      try {
        const r=await get(asset.path);
        const row={path:asset.path,status:r.status,contentType:r.type,hashMatches:sha(r.body)===asset.sha256};
        if(asset.path.endsWith('.webp'))row.validType=r.type?.split(';')[0]==='image/webp'&&r.body.subarray(0,4).toString()==='RIFF'&&r.body.subarray(8,12).toString()==='WEBP';
        if(asset.path.endsWith('.ttf'))row.validType=/^(font\/ttf|application\/x-font-ttf|application\/font-sfnt)(;|$)/.test(r.type??'')&&r.body.subarray(0,4).toString('hex')==='00010000';
        report.assets.push(row);
      }catch(e){report.assets.push({path:asset.path,error:e.message});}
    }));
  }
  report.assets.sort((a,b)=>a.path.localeCompare(b.path));
  report.allExpectedAssetsMatch=report.assets.every(a=>a.status===200&&a.hashMatches);
  report.allArtworkAndFontsLoad=report.assets.filter(a=>/\.(webp|ttf)$/.test(a.path)).every(a=>a.status===200&&a.hashMatches&&a.validType);
  report.matchesDeliveredExport=report.matchesDeliveredManifest&&report.allExpectedAssetsMatch;
  report.publicationStatus=report.matchesDeliveredExport?'New delivered build is publicly visible':'Public URL differs from delivered build; publication pending';
}catch(e){report.errors.push(e.message);report.publicationStatus='Public comparison incomplete';}
await mkdir(new URL('docs/ui-fixes/',root),{recursive:true});
await writeFile(new URL('docs/ui-fixes/public-url.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({publicationStatus:report.publicationStatus,expectedBuildId:report.expectedBuildId,publicBuildId:report.publicBuildId,assets:report.assets.length,allArtworkAndFontsLoad:report.allArtworkAndFontsLoad,errors:report.errors},null,2));
if(!report.matchesDeliveredExport)process.exitCode=1;
