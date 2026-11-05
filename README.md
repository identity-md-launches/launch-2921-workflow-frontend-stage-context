# UNLOCK V2

A redesign of the existing **https://unlock-v2.imd.site/** website, continuing job **38c6908b-83e2-4a77-8d65-4fa6c24660d6**. React/TypeScript source is in `web/`; **`dist/` is the finished static export**, mirrored in `web/site/`. Relative assets and existing hash routes support static hosting and gateway subpaths.

The approved reference was retrieved successfully. The redesign adds six original optimized artwork assets, local licensed fonts, ten live portals on Home and Gates, independent gate progress, a visible fixed swap route, illustrated core/vault previews and a consistent system across all nine screens. Migration, rights, native claim credit, transfers, burns, rewards, owner/setup safeguards and transaction protections are retained. See [DESIGN.md](DESIGN.md) and [asset provenance](docs/redesign/ASSETS.md).

**Publication is pending the existing publishing service.** The public URL returned HTTPS 200 with its older 17-asset build; it did not match this export. This worker has no publishing connector and the assignment prohibits touching `.git/`, so no new commit, publication or post-publication pass is claimed. See [PUBLISH.md](docs/redesign/PUBLISH.md).

No contracts were deployed, trading was not activated, and no mainnet signing, funding, registration, transfer or economic change occurred. Live read-only verification found trading closed. The four Solidity route tests and six browser transaction flows execute only on an isolated fork.

## Install, preview and rebuild

Use Node 22.18+; the existing manifests, lockfile and build configuration are unchanged.

```sh
npm --prefix web ci
npm --prefix web run typecheck
npm --prefix web run build:vite
npm --prefix web run preview
```

Open the preview URL printed by Vite. `npm --prefix web run dev` starts source development. The publisher serves `dist/` and does not need to rebuild it.

The retained integrity-checked Linux x64 production builder works without installing frontend dependencies:

```sh
npm --prefix web run build
npm --prefix web run validate
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173/`. This builder compiles the actual source, verifies ABI hashes and rebuilds both exports. Run the separate typecheck as well: the offline build is transpilation, not a typecheck. Required offline runtime/compiler assets and licenses stay in `web/vendor/offline/`; no npm registry mirror, dependency archive or generated dependency directory is delivered.

Artwork and fonts are local. Chain reads, wallet connections and transaction submission need the visitor’s network access. There is no private credential or backend in the export.

## Checks and evidence

The focused revision fixes desktop composition and both burn-preview findings. Current results, before/after measurements, screenshots and remaining publication limits are in [REVISION.md](docs/redesign/REVISION.md); reviewer responses are in [.imd-responses.json](.imd-responses.json). The result counts below describe the original redesign; the revision report distinguishes checks rerun on this export.

```sh
node --import ./web/scripts/offline-register.mjs --experimental-strip-types --test web/tests/core.test.ts web/tests/repair.test.mjs web/tests/routes.test.ts web/tests/gate-history.test.ts
node --import ./web/scripts/offline-register.mjs web/tests/browser.mjs
node --import ./web/scripts/offline-register.mjs web/tests/redesign-browser.mjs
UNLOCK_ETH_FORK=true forge test --match-contract EthRouteForkTest -vvv
node --import ./web/scripts/offline-register.mjs web/tests/fork-browser.mjs
node --import ./web/scripts/offline-register.mjs web/scripts/verify-update.mjs
node web/tests/live-export-browser.mjs
node web/scripts/check-public-update.mjs
```

Browser scripts require Playwright and its browser runtimes. `IMD_BROWSER=webkit` selects WebKit for the redesigned route suite. `IMD_PLAYWRIGHT` can select an installed Playwright module. On this worker, test dependencies, browser binaries and extracted runtime libraries were confined to disposable `test/scratch/`; they are not submitted. Existing manifests and lockfiles were never changed.

Current results: production build and strict TypeScript pass; **18 pure subtests**, **14 existing frontend interaction groups**, **24 redesigned checks per browser in Chromium and WebKit**, **4 Solidity fixed-route fork tests**, and **6 production-interface fork flows** pass. The pinned design probe passes **16/16**. All nine screens have desktop and mobile screenshots. [Validation](docs/redesign/VALIDATION.md) identifies exact commands, mock/fork/live tiers, findings, screenshots and remaining limits. These are worker checks, not independent certification.

Screenshots are genuine browser captures, labeled by evidence tier. Full-page screenshots are optimized to WebP without changing dimensions/content; rerun `python3 web/scripts/optimize-redesign-evidence.py` after browser captures (Pillow required). The share image can be regenerated with `node web/scripts/redesign-og.mjs`, then rebuilt. It has no displayed balances or candle data.

## Fixed ETH route and retained protections

`native ETH → pinned ETH/IMD v4 pool → official IMD/UNLK2 v4 pool → connected buyer`

There are no alternate pools, aggregators, split routes or fallback routes. The existing atomic Universal Router payload, actual-buyer credit, full-route simulation, approvals, slippage/minimum output, deadline, exact fees, refund and gas checks remain. Wallet identity and EIP-6963/mobile-wallet/Coinbase Smart Wallet flows remain. Trading is disabled from the verified hook state.

20/50/75/MAX uses the IMD balance for buys, ETH after the existing fresh gas/buffer calculation, and `min(balance, remaining sell allowance)` for sells. A state change during shortcut simulation discards the stale amount and asks for a retry. No stale quote is signed.

## Data limits

Current gate burn progress is a verified storage read. Future-gate zero is derived from verified `gatesOpen` and the immutable contract’s refusal of out-of-order contributions. Opened gates require complete historical Contributed logs. Both pinned public RPCs rejected the old-block probe: PublicNode requires an archive token; dRPC reported its free-plan range limit. The site shows an explicit unavailable-history/retry state, never a guessed burn total. A wallet provider with historical-log support may help; that provider path was not verified with a physical wallet.

The reference’s balances, candles and percentages were not imported as live data. Live closed trading displays its real empty-history state. No missing value or test result was fabricated. Screen-reader sessions, physical wallet apps/passkeys, native 200% browser zoom and the newly published public build remain unverified. Historical reports under `docs/frontend/`, `docs/repair/` and `docs/update/` describe earlier work; the current report is `docs/redesign/VALIDATION.md`.
