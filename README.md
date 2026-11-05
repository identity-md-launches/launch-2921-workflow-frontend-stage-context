# UNLOCK V2

Targeted UI update of **https://unlock-v2.imd.site/** from source commit **`6a2c438c6962d3e798cafbfc0f9248e1d8b34788`**. React/TypeScript source is in `web/`; **root `dist/` is the production static export**, mirrored byte for byte in `web/site/`. Existing package manifests, lockfile, build configuration and dependencies are unchanged.

All four supplied handoff base/replacement SHA-256 hashes were checked before applying. The update implements “Not yet observed” for a successful zero processed-FDV read, the flexible desktop chart height, and the full-width desktop contribution panel with artwork beside its form. An additional wording correction keeps failed/stale reads distinct in expanded accounting and handles a zero observation timestamp. [Handoff verification](docs/ui-fixes/handoff-verification.json).

All existing artwork and fonts remain byte-identical: the logo, the three portal-state illustrations used across all ten gates, Burn & Points core, Golden Vault, and six local font faces. No illustrated candles, example balances or substitute valuations were added.

**Publication is pending the existing submission/publishing service.** The public URL was checked: all six WebP images and all six TTF files return HTTP 200 with correct MIME types, signatures and matching bytes, but its application build differs from this export. There is no publishing connector available, and this assignment prohibits `.git/` writes; no new commit or public deployment is claimed. [Publication handoff](docs/ui-fixes/PUBLISH.md), [public comparison](docs/ui-fixes/public-url.json).

Build identifier: **`sha256:9bc4d312032147f78a087a7207f6c00bc65211e9e25900f56f4313e926d93de6`**, the SHA-256 of `dist/imd-deployment.json`, which inventories every export asset. [Build/source integrity](docs/ui-fixes/build-integrity.json) records the full source digest and preservation checks. The deployment manifest’s `sourceCommit` remains the original **contract** source commit; it is not a claim about this frontend update.

## Install, preview and rebuild

Use Node 22.18+ and the existing locked dependencies:

```sh
npm --prefix web ci
npm --prefix web run typecheck
npm --prefix web run build:vite
npm --prefix web run preview
```

Open the URL printed by Vite. `npm --prefix web run dev` starts source development. Both production builders write `web/site/` and root `dist/`, with relative assets and all nine existing hash routes for static hosting and gateway subpaths.

The retained, integrity-checked Linux x64 builder needs no dependency installation:

```sh
npm --prefix web run build
npm --prefix web run validate
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173/`. This builder compiles the actual source and verifies ABI hashes; it is not a TypeScript checker. The separate typecheck is required. Necessary offline compiler/runtime assets and licenses remain in `web/vendor/offline/`; no npm registry mirror, dependency archive, cache or generated dependency directory is added to the submission.

## Current verification

The current worker results are documented in [VALIDATION.md](docs/ui-fixes/VALIDATION.md). Earlier reports under `docs/frontend/`, `docs/repair/`, `docs/update/` and `docs/redesign/` are historical and do not establish results for this build.

| Check | Current result |
| --- | --- |
| Production source build | PASS; root `dist/` and `web/site/` generated |
| Strict TypeScript | PASS; exact source/config/test mirror with the locked compiler in disposable scratch |
| Unit/regression tests | 21/21 PASS |
| Actual production JS in simulated DOM | 11/11 groups PASS; explicitly synthetic RPC/wallet and simulated modal/scroll APIs |
| Static export integrity | PASS; 37 asset hashes, ABI/network checks, relative entry URLs and identical export mirror |
| Artwork/font preservation | PASS; all 12 binary runtime files match the base commit and both exports |
| Public HTTPS artwork/fonts | PASS; all 12 return 200 with correct MIME types and bytes |
| Public new-build identity | PENDING; currently differs from delivered export |
| Desktop/mobile rendered checks and pinned design probe | BLOCKED by browser runtime failures; no new screenshot or geometry result claimed |

Unit tests:

```sh
node --import ./web/scripts/offline-register.mjs --experimental-strip-types --test \
  web/tests/core.test.ts web/tests/repair.test.mjs web/tests/routes.test.ts \
  web/tests/gate-history.test.ts web/tests/dashboard.test.ts
```

The production-JavaScript DOM suite uses the optional **test-only** `jsdom@26.1.0`, installed into disposable scratch without changing the project manifest/lockfile:

```sh
npm install --prefix test/scratch/ui-dom --no-save --package-lock=false jsdom@26.1.0
IMD_JSDOM="$PWD/test/scratch/ui-dom/node_modules/jsdom/lib/api.js" \
  node --import ./web/scripts/offline-register.mjs web/tests/ui-fixes-dom.mjs
```

This checks all nine routes, zero/positive/expired/stale/error FDV states and retry, ten portal selections, real contribution/vault navigation, wallet discovery/mobile links, IMD quotes/minimum output/slippage, stopped unsupported ETH simulation, percentage/quota protections, burn preview, weekly reward control, vault states and migration approval review. No signed transaction is sent, even to a mock. It does **not** establish native dialog behavior, accessibility compliance, image/font rendering, responsive layout or chart geometry.

With functioning Playwright browsers, run the prepared export/browser suite and the pinned probe:

```sh
node --import ./web/scripts/offline-register.mjs web/tests/ui-fixes-browser.mjs
IMD_BROWSER=webkit node --import ./web/scripts/offline-register.mjs web/tests/ui-fixes-browser.mjs
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

`IMD_PLAYWRIGHT` can select an installed Playwright `index.mjs`. The browser suite includes all routes at 320/390/768/1024/1440, asset/font loading, horizontal overflow, first-screen actions, quote chart resizing, contribution geometry and wallet focus/Escape. It could not start here. [Exact limits](docs/ui-fixes/browser-limitations.json).

After the publication service publishes **root `dist/`** to the same site identity:

```sh
node web/scripts/check-ui-fixes-public.mjs
```

This read-only command exits 1 while the expected export differs. Require `matchesDeliveredExport: true` and `allArtworkAndFontsLoad: true`, then repeat rendered public-route/mobile/wallet checks. It never publishes or signs anything.

## Preserved behavior

All nine routes, wallet connector, migration, selling rights, contributions, rewards and Golden Vault code remain. The transaction body of `Trade`, route/calldata logic, contracts, ABI bindings, fees, allocations, thresholds, payment options, percentage shortcuts, gas reserve, quota, slippage and minimum-output protections are unchanged.

ETH purchases retain **native ETH → pinned ETH/IMD pool → official IMD/UNLK2 pool → connected buyer**. Unsupported full-route simulation stops ETH buying; there is no alternate pool or fallback route. The chart retains real official-pool history and its honest empty/error states.

No contract was deployed, trading was not activated, and no mainnet signing, funding, registration, transfer or economic change occurred. [DESIGN.md](DESIGN.md) describes the implemented design system and responsive rules; [current validation](docs/ui-fixes/VALIDATION.md) separates observed results, mocks and remaining blockers.
