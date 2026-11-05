# UNLOCK V2 redesign: worker validation

Current revision results supersede the original homepage composition measurements below: see [REVISION.md](REVISION.md) and [.imd-responses.json](../../.imd-responses.json). The original report is retained as history.

## Outcome and scope

**Implemented and locally validated; public publication/commit and post-publication verification remain incomplete.** Source is in `web/`, production export in `dist/`, identical tooling mirror in `web/site/`. This continues completed job `38c6908b-83e2-4a77-8d65-4fa6c24660d6` (supplied source commit `e71f51d9cb2424955a224c1f97d4aad9f295585a`). Checks below are the worker’s observations, not independent certification.

The approved PNG was retrieved successfully. Six original ancient-tech assets and three locally licensed font families implement its near-black, emerald/cyan, metallic and gold direction. The homepage keeps ten immediate portals, three separate conditions, chart/swap, core/vault previews and the full contribution form. Every existing hash screen and primary workflow remains. Sample balances/candles from the reference were not used as real data. The result follows the reference’s hierarchy and materials using original illustrations; its exact temple backdrop and pixel-for-pixel page composition are not reproduced. Additional real-state details and the complete contribution form add vertical space.

No mainnet signing/broadcast, deployment, activation, registration, funding, transfer or economic/ownership change occurred. Mainnet checks were read-only. Fork owner activation and artificial test balances existed only on a local isolated node. ABI/runtime hashes, bindings, pools, registrations and backing were read from mainnet; the recorded live verification found `activated=false` at block **26348071**. The current public URL returned HTTPS 200 with the old 17-asset export, which does not match the delivered build.

There is no publishing connector, `.git/` is prohibited and `imd` commands are prohibited. No credentials were sought. The existing service must commit and publish this bundle to the same identity, then verify it. See [PUBLISH.md](PUBLISH.md). No commit, successful new public publication or post-publication browser pass is claimed.

## Executed checks

| Tier | Actual command / method | Result and evidence |
| --- | --- | --- |
| Production build | `node web/scripts/offline-build.mjs` (the existing `npm --prefix web run build` implementation) | PASS. Actual TSX bundled; verified ABI hashes and regenerated root export/mirror. Run after the last application-source change. `production-build.txt`. |
| Strict TypeScript | `node test/scratch/tools/node_modules/typescript/bin/tsc --noEmit -p test/scratch/typecheck.json` | PASS, exit 0, no diagnostics. Temporary config extends unchanged `web/tsconfig.json`, including app source, TS tests and Vite config, with dependency paths/typeRoots pointing only to scratch. `typecheck.txt`, `check-results.json`. Normal reproduction: install pinned dependencies, then `npm --prefix web run typecheck`. |
| Pure tests | `node --import ./web/scripts/offline-register.mjs --experimental-strip-types --test web/tests/core.test.ts web/tests/repair.test.mjs web/tests/routes.test.ts web/tests/gate-history.test.ts` | **18/18 PASS.** Parsing/floors, slippage, route encoding, pool binding, authentic proofs, rights/burn calculations, candles and complete historical-log accumulation/failure. `node-tests.txt`. |
| Export validation | `node --import ./web/scripts/offline-register.mjs web/scripts/validate.mjs` | PASS: **37** inventoried assets, matching ABI hashes, exact network, complete hashes and relative export. `export-validation.txt`; final byte count in `bundle-audit.json`. |
| Existing frontend suite, Chromium | `node --import ./web/scripts/offline-register.mjs web/tests/browser.mjs` | **14/14 PASS**, no page errors. Explicitly synthetic RPC and wallet. `frontend-tests.txt`, `evidence/browser-report.json`. |
| Redesigned routes, Chromium | `node --import ./web/scripts/offline-register.mjs web/tests/redesign-browser.mjs` | **24/24 recorded checks PASS:** 18 route/viewport cases plus six interaction groups. No page errors or failed local resources. `redesign-tests.txt`, `evidence/all-routes-chromium.json`. |
| Redesigned routes, WebKit 26 | Same redesigned suite with `IMD_BROWSER=webkit` | **24/24 recorded checks PASS**, no page errors or failed local resources. `webkit-tests.txt`, `evidence/all-routes-webkit.json`. |
| Fixed-route Solidity fork | `UNLOCK_ETH_FORK=true forge test --match-contract EthRouteForkTest -vvv` | **4/4 PASS, zero skips**, block **26347457**. `contracts-fork.txt`. Actual installed contracts and two pools on an isolated fork. |
| Production UI + actual-pool fork | `node --import ./web/scripts/offline-register.mjs web/tests/fork-browser.mjs` | **6/6 PASS** in the final run. ETH shortcuts/buffer, ETH buy with no pre-owned IMD, actual buyer credit, maturity/sell approvals and limits, IMD buy, ETH MAX fee reserve, real candle/volume data and mobile/desktop canvas bounds. `fork-browser.txt`, `evidence/fork-browser.json`, `evidence/fork-trade-1440.webp`. |
| Live mainnet read-only | `node --import ./web/scripts/offline-register.mjs web/scripts/verify-update.mjs` | PASS: runtime/ABI hashes, both pool keys, bindings, registrations and backing. `live-state.json`, `live-verification.txt`. |
| Production export + live reads | `node web/tests/live-export-browser.mjs` | PASS with real mainnet reads forwarded unchanged through Node. Ten portals; closed trading separate from completed setup; no setup-write buttons; no document overflow at 320/390/768/1440. `live-export-browser.json`, `evidence/live-read-only-390.webp`. |
| Existing public site | `node web/scripts/check-public-update.mjs` | HTTPS 200 and **17 old public assets** match their own manifest. Delivered export/config do **not** match. Publication pending. `public-url.json`. |
| Pinned design probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **16/16 PASS**, rendered at 320/390/1440 and reduced motion. `evidence/design-probe.json`. Its solid-pair contrast check passed; art/gradient/canvas backgrounds are explicitly excluded from that measurement. |
| Files, preservation and upload size | `python3 web/scripts/audit-redesign.py` after image optimization | PASS report in `bundle-audit.json`; unchanged sources/configuration/bindings in `preservation.json`. Complete changed/new ordinary file bytes are counted against 8,388,608, including evidence and the report itself. |

Browser commands in this run selected the installed scratch Playwright module with `--import ./test/scratch/test-register.mjs` and `PLAYWRIGHT_BROWSERS_PATH=test/scratch/browsers`. WebKit also used extracted runtime libraries in scratch. Dependencies, browser downloads, library packages, compiler caches and raw image atlases are not submitted. Existing package manifests, lockfiles and build configuration were never modified. The assigned MCP browser launcher failed before navigation with a socket-path-length error; actual screenshots/interactions were performed with foreground-managed Playwright instead.

The direct browser path to public RPCs is unreliable here. Mock tests explicitly intercept RPC/wallet calls. Fork tests redirect them only to the isolated fork. Live-export tests forward original requests unchanged through Node; they do not invent responses. The design probe exercises the honest unavailable-RPC state when direct reads fail.

## Interaction coverage

The existing 14 groups cover ten doors, separate progress, keyboard selection, balance/allowance shortcuts, quote/review/account invalidation, rejected signing, gate-10 cold load, failed and receipt-confirmed burns, later gate openings, closed trading/setup/activation distinction, unsupported full-route simulation, responsive/reduced-motion layout, RPC outage, wallet Escape/focus return, migration approval/permanent-lock review, weekly claim, native proof credit/duplicate refusal, wrong network and 45-second quote expiry.

The six added groups cover all nine routes at **390×844 and 1440×1000**, every portal on Home and Gates, remaining amounts, loaded local art/fonts, no horizontal page overflow, skip-to-content focus without changing any route hash, the real contribution target, Golden Vault navigation, disabled connected-wallet trading while closed, RPC failure on every route at both widths with no signing enabled, historical-log failure/retry, initial configuration loading, More-menu Escape, wallet focus trapping and explicit connected-rights metrics. All of those groups also ran in WebKit.

The fork uses actual token, hook, WalletQuoter, Universal Router and both pinned pools. It confirms ETH pays only the reference pool then official pool atomically, no IMD approval is needed for ETH buys, the connected buyer receives matching hook credit, a buy matures after one block, allowed selling works, and previous sales stay counted. Minimum-output/deadline/refund behavior is also exercised by Solidity. There are no alternative/split/aggregator routes.

An earlier browser-fork attempt was safely invalidated during MAX calculation by refreshed state; another stopped at the existing fresh fee/buffer guard **before sending**. The harness waits for the existing short block cache after explicit fork mining and repeats the explicit user MAX action after recognized preflight invalidations, without relaxing any gas/quote checks or changing the amount by hand. The final run completed all six flows, one successful MAX send and a positive ETH remainder; its `maxGuardRetries` records any retries actually needed. The app now explains a discarded shortcut rather than leaving it silent. These guarded attempts were not mainnet failures or transactions.

## Better Interface review

The pinned workflow and core principles of all six domains were read and applied during construction. Full guide attribution/licenses are retained. Rendered observations came from actual export screenshots and Playwright; source review alone is not presented as visual proof.

| Domain | Checked | Not verified / limits |
| --- | --- | --- |
| Accessibility | Native controls, labels, named portals, visible focus, all-route skip/focus, Tab/Shift+Tab wrap in native dialogs, Escape/focus return, modal background inertness, state words, destructive acknowledgement, live errors and reduced motion. | No screen-reader session, physical assistive technology or native browser 200% zoom. |
| Layout | Every route at 390/1440 in Chromium and WebKit; homepage at 320/768 too; shared alignment, stacked mobile forms, all ten immediate portals, main contribution action on first 390px screen, wide-table containment, real fork chart/table bounds. | Not every possible viewport/locale; physical-device reflow and RTL not tested. |
| Writing | Exact state/recovery wording, explicit irreversible actions, independent ANY ONE gate rule, separate spot/processed observations, estimates/no-yield promise, current/future/history explanations, setup distinct from activation. | Wallet vendors’ own prompts are outside this interface. |
| Typography | Locally loaded Cinzel/Manrope/IBM Plex Mono, actual 400/600 faces, six-token scale, stable numeric figures, 16px inputs/selects, wrapping and chart label containment. Probe sizes/families/weights pass. | No claim of native-device font rendering or all-language shaping. |
| Colors | Semantic roles and redundant state text; probe’s measured solid foreground/background pairs pass 4.5:1 (3:1 large). | Probe excludes art, canvas and gradients. No universal rendered contrast ratio or accessibility certification is claimed. |
| UI | Original separate art, live overlays, metallic frames, rest/hover/press/focus/disabled/pending/error/confirmation states, subtle illumination, confirmation-only burn particles, real candles and reduced-motion suppression. | No manual animation-panel 10%-speed playback, passkeys or physical wallet-app walkthrough. |

### Findings and corrections

| Severity | Source | Finding → correction and evidence |
| --- | --- | --- |
| High | `web/src/GateDoors.tsx`, `web/src/EnergyCore.tsx`, `web/src/ArtPanels.tsx` | The old CSS doors/core did not meet the approved detailed artwork. Replaced with six separately optimized generated assets and live labels/forms. Reviewed both widths on every screen. |
| High | `web/src/App.tsx:112` | Skip used a route-changing hash. It now prevents default, focuses/scrolls to main and preserves the current route. All 18 route/viewport combinations pass in both browsers. |
| High | `web/src/focus.ts:5`, `wallet.tsx:184`, `components.tsx:315` | Repeated Tab could leave the modal controls. Shared wrapping now retains keyboard focus; native background inertness/Escape/return remain. Chromium/WebKit interaction rechecks pass. |
| Medium | `web/src/GateDoors.tsx:100`, `web/src/style.css` | Remaining gate values were hidden. Current, target and remaining values now stay visible for each independent condition; no averaged progress exists. Portal selection/retry tests pass. |
| Medium | `web/src/GateDoors.tsx:137`, `web/src/Charts.tsx:464` | Observation explanation and chart methodology competed with the main dashboard. Labeled disclosures keep them accessible while separate indicative/live and last-processed values prevent conflating feed health with missing observations. Screenshots/probe rechecked. |
| Medium | Final `.market-canvas table/td/th` rules in `web/src/style.css` | Actual-fork screenshot revealed axis clipping from global application table padding. Chart-internal table layout is reset locally; the final fork test asserts zero internal cell padding and that every canvas fits at 390/1440, with a new real-data capture. |
| Medium | `web/src/Trade.tsx` shortcut invalidation feedback | A correctly discarded amount could look like a dead shortcut. Added a retry explanation while keeping the same stale-state early return. Critical trade logic is verified byte-for-byte after removing the two presentation additions in memory. |
| Medium | `web/src/Screens.tsx:362`, `Screens.tsx:990` | Matured/pending/other credits, sales and fee share needed clearer separation. Added explicit read-derived metrics and conditional-share/no-guarantee labels. Connected-rights screenshots and existing workflow tests pass. |

## Screenshots

All are browser captures of the production export. `mock-*` means synthetic RPC/wallet, **not live holdings**. Lossy WebP optimization preserves dimensions and visible content; `evidence/optimization.json` records the conversion. No fake or placeholder screenshot was created.

| Screen | 390px | 1440px |
| --- | --- | --- |
| Trade | [Mobile](evidence/mock-trade-390.webp) | [Desktop](evidence/mock-trade-1440.webp) |
| Gates | [Mobile](evidence/mock-gates-390.webp) | [Desktop](evidence/mock-gates-1440.webp) |
| Migrate | [Mobile](evidence/mock-migrate-390.webp) | [Desktop](evidence/mock-migrate-1440.webp) |
| My Rights | [Mobile](evidence/mock-my-rights-390.webp) | [Desktop](evidence/mock-my-rights-1440.webp) |
| Burn & Points | [Mobile](evidence/mock-burn-points-390.webp) | [Desktop](evidence/mock-burn-points-1440.webp) |
| Weekly IMD Rewards | [Mobile](evidence/mock-weekly-imd-rewards-390.webp) | [Desktop](evidence/mock-weekly-imd-rewards-1440.webp) |
| Golden Vault | [Mobile](evidence/mock-golden-vault-390.webp) | [Desktop](evidence/mock-golden-vault-1440.webp) |
| Rules / Contracts | [Mobile](evidence/mock-rules-contracts-390.webp) | [Desktop](evidence/mock-rules-contracts-1440.webp) |
| Integration / owner setup | [Mobile](evidence/mock-integration-status-390.webp) | [Desktop](evidence/mock-integration-status-1440.webp) |

Additional evidence: [connected rights mobile](evidence/mock-connected-rights-390.webp), [connected rights desktop](evidence/mock-connected-rights-1440.webp), [WebKit mobile](evidence/mock-webkit-trade-390.webp), [WebKit desktop](evidence/mock-webkit-trade-1440.webp), [actual fork candles/volume](evidence/fork-trade-1440.webp), [real read-only mainnet](evidence/live-read-only-390.webp).

## Remaining limits and unmet requirements

1. **New commit/publication and verification of the newly published site:** incomplete, for the explicit capability/scope reasons above. The old public build was verified; no new-public-build claim is made. The existing service must publish `dist/` and perform the checks in PUBLISH.md.
2. **Opened-gate historical burn totals with the pinned public endpoints:** the live probe failed. PublicNode returned `-32602: Archive requests require a personal token`; dRPC returned code `35: ranges over 10000 blocks are not supported on free plan`, even for the bounded old-block probe. `gate-history-rpc-limit.json` contains both actual curl responses. Current storage progress and protocol-derived future-gate zero work. For an opened gate, a complete supported history is required; partial/missing history remains explicitly unavailable with retry. Physical-wallet archive-provider recovery was not verified.
3. **Exact reference artwork/backdrop/composition:** implemented through original generated artwork and the same hierarchy/materials/type direction, not an exact copy of the mockup scene. The site intentionally shows real closed/empty states instead of illustrative candles. No claim of pixel identity is made.
4. **Manual/native coverage:** screen readers, physical phone wallet apps/passkeys, native zoom, physical devices, all third-party signing UI and public post-publication rendering remain unverified. Browser tests use controlled mock or isolated-fork wallet providers, labeled above.

The useful source, export, assets, documentation and real evidence are delivered. No missing chain value, screenshot, quote, test result, publication or commit was fabricated.
