# Focused revision: composition and burn preview

All three reported findings reproduced before application changes and are fixed in the rebuilt `dist/` and identical `web/site/` export. Responses are in [.imd-responses.json](../../.imd-responses.json). This revision retains the accepted artwork, fonts, routes, contract configuration, wallet identity and transaction behavior. These are worker observations, not independent certification.

## Reproduction and corrected behavior

Chromium production export, 1440×1000, existing synthetic RPC fixture with `activated=false` and `gates=0`, fonts/artwork settled:

| Landmark | Before | Final Chromium | Final WebKit |
| --- | ---: | ---: | ---: |
| Gate summary height | 207.39px | 77.56px | 77px |
| Trading row top | 616.33px | 359.94px | 358px |
| Trading row height | 722.14px | 324.47px | 321px |
| Swap action bottom | 1170.28px | 624.42px | 620px |
| Core/vault previews top | 1356.47px | 698.41px | 693px |
| Core/vault previews bottom | 1635.05px | 940.98px | 932px |

The reference PNG downloaded successfully and was inspected. Its chart/swap starts near y=362 and previews near y=678 when scaled to 1440px. The revision brings those landmarks close while preserving honest closed/empty chart content and actual values. It reuses the accepted illustrations rather than replacing them. It does not claim pixel identity with the mockup or its temple backdrop.

`web/src/style.css:1600` scopes the compact layout to desktop widths above 1250px. `Trade.tsx:550` and `Charts.tsx:355` group existing controls horizontally. Gate current/target/remaining amounts and three independent progress bars remain visible; there is no averaged percentage. FDV/accounting, shortcut/USD context and chart methodology use their existing labeled disclosures. The fixed route and editable slippage remain visible. Quote minimum, execution price, exact/estimated fees, approvals, deadline, refunds, revalidation and gas protections remain. Quote results, errors, confirmations and expanded disclosures may grow naturally; panels do not clip them to a fixed height. Mobile retains its five-column/two-row gate strip, stacked progress, larger touch controls and swap-first order.

`web/src/ArtPanels.tsx:19` now scrolls **and focuses** the existing `#active-gate` section with `preventScroll: true`. At both 390×844 and 1440×1000, Enter on the preview moves focus there and the next Tab enters the amount field, preserving the route. The original reproduction instead returned the next Tab to the Golden Vault preview. The existing verified `open` boolean now names the gate-ten action **Burn for points**; earlier gates retain **Contribute UNLK2**. Both states were exercised with zero signing/sends in these regressions. [Original measurements](revision/reproduced-findings.json), [Chromium results](evidence/all-routes-chromium.json), [WebKit results](evidence/all-routes-webkit.json).

## Final checks

| Tier / command | Actual result |
| --- | --- |
| Production: `node web/scripts/offline-build.mjs` | PASS. Rebuilt actual source, root `dist/` and mirror; 37 inventoried relative runtime assets. [Log](revision/production-build.txt). |
| Strict TypeScript: `node test/scratch/tools/node_modules/typescript/bin/tsc --noEmit -p test/scratch/typecheck.json` | PASS, exit 0, no diagnostics. Scratch config extends unchanged `web/tsconfig.json` and resolves the pinned compiler/types installed in scratch; app, TS tests and Vite config included. [Log](revision/typecheck.txt). |
| Pure tests: `node --import ./web/scripts/offline-register.mjs --experimental-strip-types --test web/tests/core.test.ts web/tests/repair.test.mjs web/tests/routes.test.ts web/tests/gate-history.test.ts` | **18/18 PASS.** [Log](revision/node-tests.txt). |
| Export: `node --import ./web/scripts/offline-register.mjs web/scripts/validate.mjs` | PASS; ABI hashes match handoff, network exact, complete relative export inventory. [Log](revision/export-validation.txt). |
| Existing frontend: `node --import ./web/scripts/offline-register.mjs web/tests/browser.mjs` | **14/14 PASS**, Chromium, synthetic RPC/wallet. One existing assertion now opens the disclosure before reading its relocated shortcut explanation; no transaction assertion removed. [Log](revision/frontend-tests.txt), [report](evidence/browser-report.json). |
| Revision routes: `node --import ./web/scripts/offline-register.mjs web/tests/redesign-browser.mjs` | **26/26 PASS in Chromium and 26/26 in WebKit**: 18 route/viewport cases plus eight groups. Added composition and both preview regressions. No page errors or failed local resources. [Chromium log](revision/redesign-tests.txt), [WebKit log](revision/webkit-tests.txt). |
| Fixed-route fork: `UNLOCK_ETH_FORK=true forge test --match-contract EthRouteForkTest -vvv --out test/scratch/forge-out --cache-path test/scratch/forge-cache` | **4/4 PASS, zero skips**, isolated fork at block 26347457. Buyer credit, maturity/sell limits, atomic minimum/deadline failure, refund and installed IMD quoter/router covered. [Log](revision/contracts-fork.txt). |
| Actual-pool production UI: `node --import ./web/scripts/offline-register.mjs web/tests/fork-browser.mjs` | **6/6 PASS**, eight transactions only on the isolated fork; ETH shortcuts/buffer, ETH buy without IMD, credited buyer, selling/approvals, IMD buy, ETH MAX reserve and genuine chart/candle table/canvas bounds. Final run had no MAX guard retries and no page errors. [Log](revision/fork-browser.txt), [report](evidence/fork-browser.json). |
| Read-only mainnet: existing `verify-update.mjs` checks, output redirected to the revision report | PASS at block **26348591**, `activated=false`; runtime/ABI hashes, bindings, both pool keys, registrations and backing. [Log](revision/live-verification.txt), [state](revision/live-state.json). |
| Production export + mainnet reads: existing `live-export-browser.mjs`, with an additional 1440px screenshot/measurement and revision output paths | PASS: 10 portals, trading closed, no setup write buttons, no overflow at 320/390/768/1440, no page/resource errors. Same desktop geometry as the closed fixture. [Report](revision/live-export-browser.json). |
| Public HTTPS: existing `check-public-update.mjs`, output redirected to revision | HTTPS 200; **17 older public assets** match their manifest. Public export/config still differ from this delivery. [Report](revision/public-url.json). |
| Pinned probe: `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **15/16 automated checks pass**. The eyebrow detector flags real portal state / remaining amount text positioned above the next heading in the denser desktop layout. Rendered inspection confirms these are required data labels, not promotional kickers; retained. Layout, clipping/overlap, targets, measured solid-pair contrast, type scale/families, motion and share metadata checks pass. [Results](revision/design-probe.json). |
| Preservation and bytes | [33 unchanged contract/configuration/wallet/core files](revision/preservation.json); [bundle audit](revision/bundle-audit.json) counts all changed/new ordinary files against the revision-start workspace, including evidence. No build/dependency manifests, lockfiles or ignore files changed. |

Browser commands selected the scratch Playwright 1.56.1 module through `IMD_PLAYWRIGHT` and downloaded runtimes through `PLAYWRIGHT_BROWSERS_PATH`. WebKit 26 required temporary extracted Ubuntu runtime/Mesa libraries, software EGL, its process sandbox disabled inside the still-active task sandbox, and skipping a host-cache dependency check that could not recognize those scratch libraries. It then executed all 26 checks successfully. No runtime libraries, browser downloads, dependency/cache directories or temporary test configuration are delivered.

Fork/live commands used temporary harness preloads and a read-only bridge to the contributor-provided Ethereum transport; deployed/browser RPC configuration is unchanged. Sources remain the pinned public Ethereum RPCs. A first direct fork attempt could not reach the provider; the bridge run passed all four Solidity tests. A first full browser-fork run correctly stopped at the existing “Wallet, inputs or state changed” guard before the IMD step could sign. A fresh run of the same unmodified browser assertions passed all six groups. No guard was relaxed and no mainnet transaction was sent. The temporary network bridge had to bypass the shell proxy for its own local connections; those transport adaptations are not product changes.

## Better Interface review

The pinned workflow and core principles of all six domains were applied to this focused revision. Existing attribution/licenses remain. The website is a live token dashboard carried by ten ancient-tech portals, emerald energy and the golden final vault; its accepted art direction remains.

| Domain | Checked / fixes and evidence | Limits |
| --- | --- | --- |
| Accessibility | **Checked.** Fixed preview focus at `ArtPanels.tsx:19`; Enter then Tab reaches the amount input at both widths in both browsers. All-route skip retains hashes; existing wallet dialog/Escape/focus return, network changes, rejected signing and destructive transaction acknowledgements remain tested. | No screen-reader session, physical assistive technology or native 200% zoom. |
| Layout | **Checked.** Fixed excessive desktop height at `style.css:1600`, with reference landmarks measured in mock and mainnet read-only states. All nine routes checked at 390/1440 in Chromium/WebKit; source retains smaller-width overrides. Expanded accounting/route controls remain usable and do not overlay following panels. | All languages/RTL and every intermediate viewport not reviewed. Quote/error/disclosure states can exceed initial compact dimensions. |
| Writing | **Checked.** Gate-ten button now names voluntary burning at `ArtPanels.tsx:22`. Shorter closed-trading copy at `Trade.tsx:540` retains the setup/activation distinction. ANY ONE condition, separate indicative/processed FDV, costs and irreversible warnings remain. | External wallet prompts outside scope. |
| Typography | **Checked.** Accepted local Cinzel/Manrope/IBM Plex Mono and 400/600 faces retained; fonts load in all-route checks. Existing six-token scale, numeric labels and wrapping remain; probe type checks pass. | Physical-device font rendering and other scripts not reviewed. |
| Colors | **Checked.** Existing near-black/emerald/cyan/gold roles retained with textual states. Probe measured solid text pairs pass its 4.5:1/3:1 thresholds. | Probe explicitly excludes image/canvas/gradient backgrounds; no universal contrast/compliance claim. |
| UI | **Checked.** Existing art, metallic boundaries, sticky desktop swap, disabled/pending/error/review/confirmation states and reduced-motion behavior retained. Actual fork candles/volume and quote details were inspected; preview controls stay live HTML. | No physical phone wallet/passkey walkthrough or manual animation-panel slow playback. |

Applicable reproduced findings were fixed and rechecked. The automated eyebrow candidates were inspected and rejected as false positives, preserving required state/value labels. `DESIGN.md` documents the final source tokens, typography, desktop density, disclosures, component focus behavior and responsive overrides.

## Screenshots

All nine current production screens have full-page **synthetic RPC/wallet** captures at both widths; synthetic numbers are test data, not live balances:

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

Also: [WebKit mobile](evidence/mock-webkit-trade-390.webp), [WebKit desktop](evidence/mock-webkit-trade-1440.webp), [actual isolated-fork candles and quote](evidence/fork-trade-1440.webp), [live mainnet mobile](evidence/live-read-only-390.webp), [live mainnet desktop](evidence/live-read-only-1440.webp). Browser capture dimensions/content are retained in optimized WebP files; [optimization record](evidence/optimization.json).

## Completion and remaining limits

**The three revision findings are fixed and locally checked. Publication, a source commit and verification of a newly published build remain incomplete:** this worker has no publishing connector, and `.git/` is prohibited by the assignment. No publishing command, credential search, Git write or mainnet broadcast occurred. The existing IMD submission service must commit/publish root `dist/` to the same identity and rerun the public comparison/browser checks in [PUBLISH.md](PUBLISH.md). The current public URL is not claimed to contain this revision.

Historical opened-gate RPC limits and manual/physical-device coverage from the original report remain; this revision does not change those behaviors. No guarantee of pixel identity, promised yield, native wallet compatibility or full accessibility compliance is added. No contracts or trading state changed on mainnet.
