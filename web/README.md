# UNLOCK V2 terminal

Continuation of https://unlock-v2.identitymd.eth.limo. The deployed token/hook, allocations, fees and accounting are preserved. Auxiliary swarm compatibility and wallet-quoter contracts are **pending installation**, with null addresses in public/repair-config.json. Activation is disabled.

```
# From repository root, with no registry or node_modules required (Node 22.18+, Linux x64, xz):
sh web/scripts/offline-install.sh
npm --prefix web run test:offline
npm --prefix web run build:offline
npm --prefix web run validate:offline

# Full developer checks with the pinned npm dependencies installed:
npm --prefix web run typecheck
npm --prefix web run test:browser
```

Build output is **web/site/**, inside this assignment's permitted paths. Publish its contents under the existing site identity. Root dist/ is an older delivered export and is deliberately untouched. The runtime manifest retains the pinned *contract-source* commit and ABI hashes; it does not pretend that the frontend repair redeployed the contracts.

Development: `npm --prefix web run dev`. It serves the generated runtime manifest from web/site/. Static export works from a subdirectory and needs no paid API or remote JavaScript CDN. React, wallet tooling and viem are bundled; TradingView Lightweight Charts 5.0.9 is vendored under src/vendor/ with its license and visible attribution. Compact pinned dependency bundles, compiler, licenses and integrity manifest are under vendor/offline/; no npm cache is shipped. The offline source build transpiles/bundles without typechecking. The original npm/Vite build (`npm --prefix web run build:vite`), typecheck and browser tooling remain available through the pinned package.json/package-lock.json; those full development tools are not part of the compact offline package. See ../docs/repair/OFFLINE-PACKAGE.md.

Browser tests serve the production export under /preview/ and intercept all RPC/wallet activity with explicitly labelled synthetic fixtures. They require an available Chromium executable (optionally PLAYWRIGHT_CHROMIUM_EXECUTABLE). They never sign a real transaction. Fork tests are independently opt-in; see ../docs/repair/VALIDATION.md.

The home page has an interactive gate staircase, a real official-pool market-chart tab and an active-gate contribution form. Historical gate FDV, current indicative FDV and pending observations are separate; only stored gatesOpen marks a gate open. Market history uses official PoolManager logs and valid block-historical USD references; empty/unavailable data is never replaced with example candles.

Owner actions are separately reviewed and simulated through the owner wallet, with an unsigned Safe-export option. Actual adapter/quoter installation records must contain reviewed deployed addresses and runtime hashes before integration use. No stock-quoter or manual-minimum fallback exists. `scripts/prepare-repair.mjs` prepares unsigned actions read-only and emits no activation calldata.

See ../docs/repair-integration.md for exact interfaces, canonical proof generation, setup instructions and finding-to-fix table. See ../docs/repair/DELIVERY.md for the explicit publication limitation: this runtime has no authenticated GitHub session and its IMD CLI cannot update an existing launched-site identity. No new site or repository was created.
