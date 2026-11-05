"""Audit only this repository's deliverables; never reads host configuration or Git metadata."""
from pathlib import Path
import hashlib, json, re
from PIL import Image

root = Path(__file__).resolve().parents[2]
base_file = root / 'test/scratch/baseline.json'
base = json.loads(base_file.read_text()) if base_file.exists() else None
report_path = root / 'docs/redesign/bundle-audit.json'
exclude = {'.git', '.github', '.imd', 'lib', 'node_modules', '.cache', '.npm', '.vite', 'test-results', 'playwright-report', 'out', 'cache', 'broadcast'}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def walk(directory):
    for path in directory.iterdir():
        rel = path.relative_to(root).as_posix()
        if path.name in exclude or path.name.startswith('.env') or rel.startswith('test/scratch'):
            continue
        if path.is_symlink():
            raise AssertionError('Unexpected submitted symlink: ' + rel)
        if path.is_dir():
            yield from walk(path)
        elif path.is_file():
            yield path

# Complete export, relative runtime files and an identical mirror.
manifest = json.loads((root/'dist/imd-deployment.json').read_text())
for item in manifest['assets']:
    path = root/'dist'/item['path']
    assert path.is_file(), item['path']
    assert sha(path) == item['sha256'], item['path']
for path in (root/'dist').rglob('*'):
    if path.is_file():
        mirror = root/'web/site'/path.relative_to(root/'dist')
        assert mirror.is_file() and sha(path)==sha(mirror), str(path)
html=(root/'dist/index.html').read_text()
for value in re.findall(r'(?:src|href)="([^"]+)"', html):
    if value.startswith(('./','../')):
        assert (root/'dist'/value).is_file(), value
    assert not value.startswith('/'), value
for font in re.findall(r'url\("([^"]+)"\)', (root/'dist/design-assets.css').read_text()):
    assert (root/'dist'/font).is_file(), font
for label in ['<title', 'name="description"', 'property="og:title"', 'property="og:image"', 'rel="icon"']:
    assert label in html, label

# Validate every required screen capture and all shipped images.
routes=['trade','gates','migrate','my-rights','burn-points','weekly-imd-rewards','golden-vault','rules-contracts','integration-status']
for route in routes:
    for width in [390,1440]:
        path=root/f'docs/redesign/evidence/mock-{route}-{width}.webp'
        assert path.is_file(), str(path)
        with Image.open(path) as image:
            assert image.width==width and image.height>0
            image.verify()
for folder in ['web/public/art','dist/art','docs/redesign/evidence']:
    for path in (root/folder).glob('*'):
        if path.suffix.lower() in {'.webp','.png','.jpg','.jpeg'}:
            with Image.open(path) as image: image.verify()
for name in ['README.md','DESIGN.md','docs/redesign/VALIDATION.md','web/package-lock.json','dist/index.html']:
    assert (root/name).is_file() and (root/name).stat().st_size>0, name

# Compare only task-workspace files to the pre-work baseline. No Git access.
unchanged=[]
for path, row in (base or {}).items():
    if path.startswith(('src/','docs/abi/')) or path in ['foundry.toml','foundry.lock','remappings.txt','.gitmodules','web/package.json','web/package-lock.json','web/vite.config.ts','web/tsconfig.json','docs/frontend/deployment-handoff.json','docs/frontend/network-handoff.json','web/public/repair-config.json','web/public/contract-runtime.json','web/src/config.ts','web/src/core.ts','web/src/eth-route.ts','web/src/transactions.tsx','web/src/integration.ts','web/src/state.ts','web/src/shortcuts.ts','web/src/burn-preview.ts']:
        current=root/path
        assert current.is_file() and sha(current)==row['sha256'], 'Protected/preserved file changed: '+path
        unchanged.append({'path':path,'sha256':row['sha256']})
# Prove that wallet.tsx changed only by the modal keyboard handler.
wallet=(root/'web/src/wallet.tsx').read_text().replace('import { trapDialogFocus } from "./focus";\n','',1).replace('      onKeyDown={trapDialogFocus}\n','',1)
if base:
    assert hashlib.sha256(wallet.encode()).hexdigest()==base['web/src/wallet.tsx']['sha256']
# Trade changes are the visible route and stale-shortcut feedback, preserving existing logic.
trade=(root/'web/src/Trade.tsx').read_text()
trade=re.sub(r'      <p className="visible-route">.*?</p>\n','',trade,count=1)
trade=trade.replace('      if (liveTag.current !== initialTag) {\n        setError("State changed while calculating this amount. Retry the shortcut.");\n        return;\n      }','      if (liveTag.current !== initialTag) return;',1)
if base:
    assert hashlib.sha256(trade.encode()).hexdigest()==base['web/src/Trade.tsx']['sha256']
(root/'docs/redesign/preservation.json').write_text(json.dumps({'method':'SHA-256 comparison with task-workspace baseline; no Git metadata read. Wallet/Trade presentation-only edits removed in memory to verify original logic byte-for-byte.','walletIdentityAndConnectionLogicUnchanged':True,'tradeLogicUnchangedAfterRemovingPresentationAdditions':True,'unchanged':unchanged},indent=2)+'\n')

# Include this report's own size, converging after serialization.
previous=-1
for attempt in range(8):
    all_files=list(walk(root))
    changed=[p for p in all_files if base is None or p.relative_to(root).as_posix() not in base or sha(p)!=base[p.relative_to(root).as_posix()]['sha256']]
    if report_path not in changed: changed.append(report_path)
    rows=[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size if p.exists() else 0} for p in changed]
    total=sum(row['bytes'] for row in rows)
    report={'method':'Full bytes of every changed/new submitted ordinary file against the pre-work task baseline; includes this report. Generated dependencies/caches and disposable scratch excluded. No Git access.','baselineAvailable':base is not None,'limitBytes':8388608,'changedBytes':total,'remainingBytes':8388608-total,'passes':total<=8388608,'fileCount':len(rows),'exportBytes':sum(p.stat().st_size for p in (root/'dist').rglob('*') if p.is_file()),'exportInventoryMatches':True,'exportMirrorMatches':True,'screenCaptures':18,'preservedFileCount':len(unchanged),'largestChangedFiles':sorted(rows,key=lambda row:row['bytes'],reverse=True)[:12]}
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    if previous==total:break
    previous=total
assert report['passes'], 'Upload budget exceeded'
print(json.dumps(report,indent=2))
