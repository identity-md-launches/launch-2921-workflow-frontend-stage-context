# UNLOCK V2 continuation validation

## Outcome and publication boundary

**The website source and production export are implemented and locally validated. Public publication remains incomplete.** `dist/` is the complete static deliverable for the same **https://unlock-v2.imd.site/** identity, mirrored byte-for-byte in `web/site/`. The worker did not create a new site, contract, token, owner setting or economic parameter.

The current public URL returned HTTPS 200 and all **17** assets matched its existing manifest, but its HTML and `repair-config.json` still differed from this export: adapter/quoter were null and installation review false. See `public-url.json`. This session exposes no hosting/repository publication tool; `.git/` is protected, so no new commit or successful remote publication is claimed. Base checkout: `235b4fbc32254cdea0837640d5f7539922314a86`. The submission/publishing service must commit this bundle, publish root `dist/` under the existing identity and rerun:

```sh
node web/scripts/check-public-update.mjs
node web/tests/public-browser.mjs
```

The public browser navigation itself returned `net::ERR_EMPTY_RESPONSE` from this worker; it did not establish browser behavior on the public domain. The production export was therefore also served locally under `/preview/` and exercised with both real mainnet reads and actual isolated-fork transactions. These are distinct evidence tiers, not substitutes for public publication.

## Scope and provenance

The supplied corrected ZIP and preview were retrieved successfully over HTTPS. [RETRIEVAL.md](RETRIEVAL.md) records hashes, merged corrections and protected changes intentionally excluded. Reviewed adapter/quoter hashes come from the package's actual installation records. Existing native proof fixtures and all deployed contract sources/ABIs remain intact.

Only website/source tests/documentation/export changed. No mainnet wallet/signature/broadcast, contract deployment, setup, duplicate funding, activation, router registration, fund transfer, ownership or economic change was performed. Owner activation and artificial test balances described below exist only inside isolated forks.

## Executed checks

| Tier | Command / procedure | Actual result |
| --- | --- | --- |
| Production build | `npm --prefix web run build` | PASS. Current TSX bundled by retained integrity-checked offline compiler. Both exports rebuilt after the last application-source edit; 17 inventoried assets. `production-build.txt`. |
| Strict TypeScript | `node test/scratch/toolchain/node_modules/typescript/bin/tsc --noEmit -p test/scratch/typecheck.json` | PASS, no diagnostics. Equivalent strict project settings include all source, TS tests and Vite config. Same pinned dependencies installed only in disposable scratch, with paths/typeRoots resolving them. Normal reproduction: `npm --prefix web ci` then `npm --prefix web run typecheck`. `typecheck.json`. |
| Pure Node tests | `node --import ./web/scripts/offline-register.mjs --experimental-strip-types --test web/tests/core.test.ts web/tests/repair.test.mjs web/tests/routes.test.ts` | **15/15 PASS**. Integer parsing/floors, slippage, both token orderings, router payloads, historical candles, authentic native proofs, burn/sell-right arithmetic, strict pool bindings and full-route rejection cases. `node-tests.txt`. |
| Export integrity | `npm --prefix web run validate` | PASS. ABI hashes match pinned handoff; network exact; every exported asset SHA-256 is inventoried; relative static export complete. |
| Synthetic Chromium interactions | `node --import ./web/scripts/offline-register.mjs web/tests/browser.mjs` | **14/14 PASS**, no page errors. Production `dist/` served under `/preview/`. Wallet/RPC responses are explicitly synthetic. `evidence/browser-report.json`. |
| Solidity actual-pool fork | `UNLOCK_ETH_FORK=true forge test --match-contract EthRouteForkTest -vvv` | **4/4 PASS, no skips**, block **26347457**. Actual installed hook/token/WalletQuoter/Universal Router and actual two pools. `fork-tests.txt`. |
| Production interface + actual-pool fork | `UNLOCK_ETH_FORK_BLOCK=latest node --import ./web/scripts/offline-register.mjs web/tests/fork-browser.mjs` | **6/6 PASS**, fork pinned at startup to block **26347705**. Real execution on local Anvil, no mainnet broadcast. Includes gas shortcuts, both buy modes, approvals, sale, buyer credit, real candle/volume rendering and mobile chart/table reflow. `evidence/fork-browser.json`. |
| Live read-only chain | `node --import ./web/scripts/offline-register.mjs web/scripts/verify-update.mjs` | PASS at block **26347620**. Runtime/ABI hashes, bindings, pool IDs, registrations, native evidence bindings and backing independently read. `live-state.json`. |
| Live reads in production browser | `node web/tests/live-export-browser.mjs` | PASS. Local production export with real mainnet RPC payloads forwarded unchanged through Node. Ten doors, completed setup separately from closed trading, no setup write buttons, no page/resource errors; no horizontal overflow at 320/390/768/1440. `live-export-browser.json`. |
| Existing public HTTPS/assets | `node web/scripts/check-public-update.mjs` | HTTPS 200; 17 existing public assets match their manifest. **New export/config not public yet.** `public-url.json`. |
| Existing public browser | `node web/tests/public-browser.mjs` | Incomplete: direct browser navigation returned `net::ERR_EMPTY_RESPONSE`. `public-browser.json`; no public rendered pass claimed. |
| Pinned design probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | Ran on final `dist/`: **15/16 PASS**. The single remaining chrome flag is a documented illustration exception below. `evidence/design-probe.json`. |

Browser checks used Playwright 1.56.1 Chromium. Because the assigned browser connector lacked Chrome and the OS initially lacked browser libraries, the unchanged pinned toolchain, browsers and required libraries were installed/extracted into disposable scratch. `IMD_PLAYWRIGHT`, `PLAYWRIGHT_BROWSERS_PATH` and a scratch library path selected those copies. No dependency manifest/lockfile was changed. These generated tools/caches are not submitted.

WebKit 26.0 launched after its libraries were supplied, but page creation did not complete; a bounded smoke test was terminated after 40 seconds before navigation. **WebKit/Safari remains unverified**, not passed. See `evidence/webkit-limitation.json`. Physical phone wallets, passkeys, screen-reader sessions, native browser 200% zoom, RTL/localization and full assistive-technology auditing were not performed.

The direct browser transport cannot POST reliably to the public RPC hosts on this worker. Synthetic interaction cases intercept them; actual-fork cases redirect them to isolated Anvil; live-export cases forward original requests unchanged through Node to real mainnet. The ordinary unproxied design-probe screenshots consequently exercise the honest RPC-unavailable state. These methods and limitations are identified in each JSON report.

## Critical ETH and quota evidence

`test/EthRouteFork.t.sol` verifies both PoolKey hashes against the live hook, existing router registrations and remaining backing before the isolated owner activation. A fresh buyer starts without IMD or IMD approval, sends native ETH directly to the installed Universal Router, receives UNLK2 and receives **matching hook buy credit at the actual buyer**; the router receives no new credit. The buying block has no matured allowance. After one block at gate 0, allowance equals **floor(bought × 20 / 100)**. A sale within that entitlement succeeds; an excess sale reverts and preserves counters. Final-minimum and deadline failures revert atomically, and surplus native ETH is returned to the buyer.

The browser fork independently completes the same website flows. ETH shortcuts run fresh full-route simulation and `eth_estimateGas` on the final minimum-output-protected calldata before reserving 20% additional gas units and 25% additional fee buffer. ETH buying needs no IMD approval. The allowed sale follows the actual two-step Permit2 approval flow; its IMD proceeds then fund an IMD buy through the installed WalletQuoter/official pool. ETH MAX was also executed through the interface and left a positive ETH fee reserve without spending pre-owned IMD. Finally, actual official-pool logs render observed candles and volume; the keyboard-readable data disclosure and mobile layout were exercised. `ETH_ROUTE_VERIFIED` is enabled on this evidence; live swaps still require the real hook to be activated.

The route uses two single-swap actions in one V4 unlock, exact native settlement and no intermediate take/settle. Intermediate IMD credit supplies the official leg; residual route deltas cannot silently settle. The final native sweep refunds surplus to the same buyer. No alternative/split/best-price/fallback pool exists. Full-route simulation verifies two exact pool events, full leg consumption, fee consistency and matching before/after buyer credit. Node tests explicitly reject synthetic partial first/second fills, refund events, unexpected pools, missing buyer credit, reverted simulations and unsupported RPC. An actual liquidity-exhaustion partial fill was not induced in the fork; that limitation is not reported as a fork pass.

## Browser interaction coverage

The 14 synthetic production-export cases cover:

1. Ten doors, separate three-condition progress, first-screen mobile contribution link, keyboard activation and disclosure.
2. Fresh-balance IMD shortcuts, integer floors, currently-sellable sell shortcuts and excess manual input.
3. IMD quote/review, wallet rejection and account-change invalidation.
4. Gate-10 cold load, voluntary burning, gold visual and no success animation on failed simulation.
5. Exact burn-log receipt matching, confirmation-only energy flow and separate reward-share display.
6. Later gate openings update doors and announce FDV/volume/burn alternatives without burn-success animation.
7. Completed setup remains distinct from closed trading; later activation is read and no setup/activation buttons exist.
8. Unsupported full-route RPC simulation stops ETH buying without an approval/fallback.
9. 320/390/768/1440 layouts, reduced motion and desktop sticky positioning.
10. RPC outage, unavailable values, wallet Escape/focus return and first-screen primary action.
11. Migration allowance/permanent-lock confirmation and weekly matured-reward claim.
12. Authentic native proof entry, installed adapter credit flow and duplicate-credit refusal (RPC/wallet synthetic; proof verification separately real).
13. Network-change invalidation and switching back to Ethereum.
14. 45-second quote expiry and invalid USD remaining unavailable.

Mocks test the interface; they do not certify contracts. Fork funding/activation/wallet sends are artificial and confined to the local node. Live evidence is read-only. No real-fund test occurred.

## Better Interface: six-domain review

| Domain | Coverage and final result | Limits |
| --- | --- | --- |
| Accessibility | Checked native buttons/links/inputs, bound labels, modal titles, Escape/focus return, visible door focus ring, keyboard door selection, live error/status text, state labels, reduced motion and a readable OHLC/volume disclosure. Destructive reviews retain acknowledgement and simulation. | Screen readers, native 200% zoom and a full manual keyboard walk of every connected-wallet state were not performed. Passkeys/native wallet apps unverified. |
| Layout | Checked 320/390/768/1440 in synthetic and real-read production browser; actual fork chart/table at 390/1440. Product and contribution link on the first 390px screen; all ten doors remain visible. No document overflow; desktop chart left/swap right, mobile stack and sticky CSS confirmed. | RTL/localization and physical devices unverified. |
| Writing | Source reviewed labels/errors, setup-vs-activation distinction, irreversible burn/migration confirmations, separate burn/point/share labels, quote expiry, unavailable prices, honest history states and estimates/no-guarantee copy. | Third-party wallet wording is outside the local interface. |
| Typography | Final six-token scale, three weights, platform UI stack, monospace only for code/addresses, 16px mobile inputs/select, stable numeric figures and wrapping reviewed. Probe type-size/family/weight checks passed. | Platform fonts differ; no claim that a downloaded Inter face exists. |
| Colors | Final semantic hex tokens reviewed; probe measured solid text/background pairs pass 4.5:1 (3:1 large). Text, shape and words distinguish door states; errors/focus have separate roles. | Probe explicitly excludes text over gradients/canvas/art. No measured contrast ratio is claimed for excluded pairs; no full contrast certification. |
| UI | Original dimensional doors, restrained surfaces, emerald/gold core, loading/empty/error/expiry/review states, confirmation-only finite animation and reduced-motion suppression inspected. Actual pool candles and volume render without fake intervals. | Animation-panel 10% playback, WebKit and every replacement-receipt variant were not manually exercised. |

### Findings, corrections and recheck

| Finding | Source / evidence | Correction and recheck |
| --- | --- | --- |
| HIGH: native review dialog lacked an accessible name; role/name-based burn interaction could not reach it | `web/src/components.tsx:306`, `web/src/wallet.tsx:173`; browser test failure | Added stable heading IDs and `aria-labelledby` to both native dialogs. Role/name interactions, Escape and focus return now pass. |
| HIGH: long unavailable labels crowded adjacent narrow doors | `web/src/GateDoors.tsx:65`, `web/src/style.css:1932`; first 390px probe screenshot | Unread state uses a short label and unknown numeric marker; label width/wrapping is bounded. Final 390px screenshots and probe show no overlap/overflow. |
| MEDIUM: mobile navigation select inherited 14px text | `web/src/style.css:1959`; source review against mobile input guidance | Final select uses the existing 16px input token. Production rebuild and responsive checks passed. |
| MEDIUM: preview wording could imply an already-completed burn, and confirmation text originally expired with the animation | `web/src/Screens.tsx:564`, `:770`; source/receipt-state review | Preview now separates tokens to burn, points to earn and estimated future share. Confirmed token/point text persists; animation alone ends. Exact-log receipt and failed-simulation cases pass. |
| HIGH: cold loads could retain contribution mode after all gates opened | `web/src/Screens.tsx:581`; supplied corrected package and cold-load regression | Derive contribution mode from current gates, preserving the supplied fix. Gate-10 homepage calls voluntary `burn`, never `contribute`; browser case passes. |
| MEDIUM: ETH MAX gas reservation originally estimated preliminary rather than final minimum-output calldata | `web/src/eth-route.ts:315`; signing revalidation review | Gas is now estimated for the final protected data and its reviewed deadline. An actual production-interface ETH MAX transaction passes and leaves a positive ETH reserve. |
| MEDIUM: sparse real history was over-expanded and the chart information depended on pointer/canvas interaction | `web/src/Charts.tsx` (`candle-data` disclosure); accessibility source review | Reserved a legible price axis and a stable sparse-history viewport without synthesizing bars. Added a native keyboard-readable table of the latest observed candle values. Actual-pool fork case reads it and checks mobile reflow. |

The probe's remaining **chrome** flag reports border plus shadow on ten `.door-frame` elements. These are decorative parts of the requested **“TEN compact dimensional doors”**, not application panels. Retained intentionally for that explicit visual direction; application panels have no shadow, there are no cards inside cards and no gradient text. This exception is not a hidden pass or a new unrelated design feature.

### Screenshots and source consistency

- `evidence/mock-home-390.png`: synthetic active gate-0 product/action, keyboard focus and compact ten-door layout.
- `evidence/mock-home-1440.png`: synthetic desktop hierarchy and chart/swap columns.
- `evidence/mock-golden-390.png`: synthetic gold vault/burn state.
- `evidence/mock-opened-door-390.png`: synthetic stored gate opening; broken/open door and next current door.
- `evidence/fork-trade-1440.png`: production interface using actual fork trades/candles.
- `evidence/live-read-only-390.png`: production export with real mainnet read-only state; trading closed, no invented prices/balances.

These were inspected as images; they are not screen-reader sessions or physical-device tests. The pinned probe's full screenshots remain in disposable `test/scratch/taste/shots/`. [Root DESIGN.md](../../DESIGN.md) documents the final implemented tokens/components/responsive behavior, retaining guide/license attribution.

## Packaging and completion

`bundle-audit.json` conservatively counts the full uncompressed contents of every added/modified file, rather than relying on Git delta compression. The budget is **8,388,608 bytes**. The final audit checks protected paths, submodules, ignore-file changes and the complete static export. Existing required offline compiler/runtime assets remain; no generated dependency/cache directory, source ZIP, npm registry mirror, unnecessary archive or scratch browser library is included. No ignore file was changed, so no new ignore-path budget was needed.

Local implementation and the stated Chromium/mainnet-read/fork checks are complete. **The complete assignment remains incomplete until the existing public URL serves this export and post-publication browser verification succeeds.** WebKit/physical wallets/assistive-technology/native-zoom limitations remain explicitly unverified. These worker results have no independent audit authority.
