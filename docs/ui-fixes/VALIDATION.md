# UI-fix validation

## Delivery status and identity

**Source/export implementation is ready; the assignment remains incomplete for publication and required rendered verification.** This report records worker checks, not independent certification.

Source base: **`6a2c438c6962d3e798cafbfc0f9248e1d8b34788`**. The repository HEAD matched the supplied handoff commit. All four original file hashes and all four replacement hashes matched before applying; no newer source changes needed merging. [Hash record](handoff-verification.json).

Build: **`sha256:9bc4d312032147f78a087a7207f6c00bc65211e9e25900f56f4313e926d93de6`**. This identifies `dist/imd-deployment.json`, whose inventory hashes all 37 export assets. The frontend source digest is **`3adad2903b9de7a6e4ee1619677cb9113594062ccb9094b41a018d7ee316204e`**. [Integrity evidence](build-integrity.json) defines the checked files. The original contract source commit in the runtime manifest is preserved. No new frontend commit was created because `.git/` writes are prohibited; the submission service creates that commit.

The supplied working reference and handoff were retrieved over HTTPS. The four replacement files were applied to this existing project. The preview was not embedded, linked as the application, or used as a substitute export. Browser rendering of the reference could not be inspected because the browser tool failed to initialize.

## Implemented scope

- **Missing FDV:** `components.tsx:234` accepts explicit missing-state text in visible progress and `aria-valuetext`. `GateDoors.tsx:103` and `Trade.tsx:45` supply “Not yet observed” only for a successfully read, non-stale zero processed FDV. No valuation or percentage is invented. Positive but expired/invalid observations stay unavailable. Expanded accounting also guards unread/stale snapshots.
- **Chart:** `style.css:1667` implements the handoff’s flex columns, flexible canvas, 190px minimum and size containment above 1250px. Existing mobile rules remain, including the final 320px canvas height. This was source-checked, not measured in a rendered browser.
- **Contribution:** `style.css:1685` gives the desktop home contribution its full-width outer column and a 300px artwork column beside the form, with a 24px gap. The heading spans both columns; mobile stacking remains. This was source-checked, not measured in a rendered browser.
- **Assets:** all six existing WebP files and six TTF faces are byte-identical in `web/public/`, `dist/` and `web/site/`, and match the base commit. The ten gate positions retain the existing reusable Open/Current/Locked portal illustrations. Logo, Burn & Points and Golden Vault artwork, font licenses, provenance and share image are retained.

The complete `Trade` transaction function is byte-identical to the base. Fifteen additional integration/config/dependency files were compared byte for byte, including wallet, transactions, screens, chart/history logic, fixed ETH route, quote/protection helpers, package manifest/lockfile and Vite configuration. Contract sources, economics, thresholds, ABI bindings and runtime configuration were not changed. No mainnet signing, broadcast, activation, deployment, registration, funding or transfer occurred.

## Checks actually run

| Check | Command/method | Actual result |
| --- | --- | --- |
| Production build | `TMPDIR="$PWD/test/scratch" npm --prefix web run build` | **PASS, exit 0.** Actual source compiled by existing integrity-checked production builder; 37 assets exported to both locations. [Log](production-build.txt). |
| Strict typecheck | Exact `web/src`, `web/tests`, `vite.config.ts` and `tsconfig.json` copy into disposable `test/scratch/tooling/`; `node test/scratch/tooling/node_modules/typescript/bin/tsc --project test/scratch/tooling/tsconfig.json --noEmit` | **PASS, exit 0, no diagnostics.** Locked TypeScript 5.9.3 and dependencies from the unchanged project lockfile. Source/config mirror verified. [Record](typecheck.txt). |
| Pure regression tests | `node --import ./web/scripts/offline-register.mjs --experimental-strip-types --test web/tests/core.test.ts web/tests/repair.test.mjs web/tests/routes.test.ts web/tests/gate-history.test.ts web/tests/dashboard.test.ts` | **21/21 PASS, exit 0.** Fixed pool keys/atomic route, minimum output, shortcuts/gas reserve, burn/rights and historical-data rules included. [Log](node-tests.txt). |
| Production JS interactions | `IMD_JSDOM=<scratch jsdom@26.1.0 module> node --import ./web/scripts/offline-register.mjs web/tests/ui-fixes-dom.mjs` | **11/11 PASS, exit 0.** The actual generated application JavaScript executes with synthetic RPC/wallet responses in jsdom. No mock transaction sent. [Report](dom-validation.json), [log](dom-validation.txt). |
| Export/ABI/network integrity | `npm --prefix web run validate` plus byte/hash audit | **PASS, exit 0.** All 37 inventoried asset hashes; 2,002,846 inventoried bytes; matching ABIs/network; identical export mirrors. Metadata and relative entry URLs checked. [Validator](export-validation.txt), [integrity](build-integrity.json). |
| Artwork/font preservation | SHA-256 and base-commit byte comparison of all 12 runtime binaries | **PASS.** No existing artwork/font altered, omitted or recompressed. [Integrity](build-integrity.json). |
| Public HTTPS | `node web/scripts/check-ui-fixes-public.mjs` | **Exit 1 because the application build differs.** All 12 artwork/font URLs return 200 with correct MIME, signatures and identical bytes. New hashed app assets/manifest are not confirmed public. [Actual comparison](public-url.json). |
| Browser route/layout suite | `node --import ./web/scripts/offline-register.mjs web/tests/ui-fixes-browser.mjs` | **Could not start; exit 1.** Chromium died during launch with SIGTRAP. No assertion groups or screenshots completed. |
| Pinned taste@1 probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **Could not measure; exit 2.** Chromium launch failure. No 16-check pass or rendered measurement is claimed. [Runtime limits](browser-limitations.json). |
| Diff/path/budget audit | `git diff --check`; changed/new-file byte accounting and protected-path check | **PASS.** See [bundle budget](bundle-budget.json). No ignore file changed. |

Dependencies and browser/runtime attempts were confined to disposable scratch; nothing from those installations is submitted. Existing required `web/vendor/offline/` assets remain intact.

The 11 simulated-DOM groups cover all nine hash routes and primary controls; honest empty chart/log failure/retry; fresh zero FDV with zero timestamp on both gate components; stale/RPC failure/recovery; positive, expired and invalid-price states; all ten portal selections; contribution focus target and vault/contribution navigation; named EIP-6963 wallet discovery, four phone links and Coinbase option; IMD quote/minimum/slippage and safely stopped unsupported ETH simulation; percentage/sell-quota protections; burn preview, weekly reward control and vault locked/open states; and migration approval review after acknowledgement. The mock’s ETH simulator is unsupported by design, so **successful two-leg ETH execution is not claimed**. The existing route/calldata unit tests pass and that runtime code is unchanged.

## Better Interface consolidated review

Applied the pinned Better Interface workflow and the six domain core-principle sections from `.imd/reads/skills/better-interface/REFERENCE.md` while implementing this bounded update. The black/emerald/gold palette, detailed portal art, local typography and existing components remain authoritative. Documentation follows its implemented-design method. Attribution/licenses remain in [the existing notice](../redesign/BETTER-INTERFACE-LICENSE).

One visual idea: an Ethereum protocol terminal whose ten carved portals show permanent gate progress, supported by emerald energy and a gold final vault. No unrelated redesign was introduced.

| Domain | Coverage and result | Unperformed checks |
| --- | --- | --- |
| Accessibility | **Checked in source and simulated DOM.** Native progress retains its accessible label and explicit missing-state `aria-valuetext`; field labels, one h1 per route, real controls and contribution focus target remain. Modal APIs were simulated. | Rendered focus visibility, native Tab/Shift+Tab/Escape/inertness, screen reader, forced colors, touch-device targets and native 200% zoom. |
| Layout | **Source reviewed.** Exact handoff flex/canvas and contribution grid changes; mobile stacking rules and content order retained. Relative asset/static hash routing verified. | All nine desktop/mobile rendered routes, 320/390/768/1024/1440 overflow, first-screen 390 action, actual input readability, chart before/quote/cleared heights and screenshot comparison. The prepared browser suite could not start. |
| Writing | **Checked.** Missing, failed, stale, expired and positive FDV observations are explicitly different. DOM regressions verify wording and recovery. No substitute valuation or demo candle was added. | Rendered line wrapping of the longer missing-state wording. |
| Typography | **Source and HTTP assets checked.** Existing Cinzel/Manrope/IBM Plex Mono 400/600 faces, six size tokens, local URLs, licenses and mobile input rules are retained. Every font has correct public MIME and bytes. | Actual face/weight rendering, line breaks, clipping, native iOS input zoom and enlarged text. |
| Colors | **Source and declared-pair calculation checked.** Palette unchanged. Declared primary/muted/error/gold against `#09100e` compute to 16.94/9.40/11.01/12.79:1 respectively. [Calculations](declared-contrast.json). | Actual rendered backgrounds, alpha/gradient/art contrast and focus rings. These calculations are not a full contrast pass. |
| UI details | **Source and simulated DOM checked.** Quote appearance/clearing, empty/error/retry, wallet sheet state, burn preview and vault states execute. Existing reduced-motion rules and confirmation-only animation logic retained. | Rendered chart resize, native dialogs, hover/pressed/focus appearance, reduced-motion animation playback and 10%-speed motion review. |

Findings and corrections:

| Finding | Source/evidence | Correction and recheck |
| --- | --- | --- |
| High, writing/data state: a successful unobserved FDV looked unavailable | `components.tsx:258`, `GateDoors.tsx:103`, `Trade.tsx:45`; zero-FDV/zero-timestamp synthetic snapshot | Applied explicit missing text without replacing missing data with zero dollars or a fabricated percent. Both progress widgets pass DOM tests. |
| High, writing/data state: handoff wording on `GateProgress` was gated by observation age, while accounting disclosures could label failed reads unobserved | `Trade.tsx:45`, `Trade.tsx:89`, `GateDoors.tsx:139`; zero timestamp and stale/retry scenarios | Missing wording now depends on successful non-stale reads; accounting shows unavailable/stale when unread. DOM zero/expired/outage/retry cases pass. |
| Requested layout correction: fixed canvas did not consume the panel’s available height | `style.css:1667`; supplied replacement and source diff | Applied flex/minimum/containment fix. **Source verified; rendered recheck blocked.** Supplied handoff’s 190→300.9→190px measurements are not presented as this worker’s result. |
| Requested layout correction: desktop home contribution left the form in a narrow column | `style.css:1685`; supplied replacement and source diff | Full-width outer column with artwork beside form and mobile rules retained. **Source verified; rendered recheck blocked.** |

No new rendered defect or visual pass is inferred from source or jsdom. The previously reported screenshot/probe results in older documentation are historical.

## Publication and remaining blockers

The public site serves a different application build. Its existing artwork/fonts are accessible with correct file types, so the prior public MIME issue is not reproduced by this HTTP check. The worker has no publishing tool, and the assignment forbids Git metadata changes. The existing submission service must commit this source/export and publish root `dist/` to the same site identity. [Handoff](PUBLISH.md) gives the exact comparison command and required outputs.

The assigned browser tool failed with **“Socket path too long.”** Local Chromium distributions exited during launch with **SIGTRAP**; WebKit launched with temporary libraries but its page target crashed before a page became usable. A Firefox fallback could not locate its application directory. These are runtime failures, not requests for requester input. No new screenshot, browser-based image/font decode, physical wallet/passkey test, chart geometry measurement, visual first-screen/overflow pass or native dialog result is claimed. [Failure summary](browser-limitations.json).

A functioning browser must complete the prepared desktop/mobile suite and pinned probe, inspect the resulting screenshots, repair applicable findings, and repeat those checks on the matching public build. Publication and rendered verification remain the concrete limitations of this useful source/export delivery.
