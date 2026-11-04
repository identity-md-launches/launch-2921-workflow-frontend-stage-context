# UNLOCK V2 terminal

Continuation of [unlock-v2.identitymd.eth.limo](https://unlock-v2.identitymd.eth.limo), using the existing Ethereum deployment and source repository. The updated static hosting deliverable is **`dist/`**, with source in `web/`. `web/site/` is an identical build mirror for existing tooling. Both use relative assets and hash navigation.

**Trading is closed and auxiliary installation is pending.** This work sends no mainnet transactions. It does not deploy, register, fund, activate or alter V1 or any deployed V2 contract. The continuation delivery service must publish `dist/` under **unlock-v2.identitymd.eth** and commit this bundle to the existing repository; no replacement identity or completed remote publication is claimed here.

## Install, preview and rebuild

Full development toolchain, Node 22.18+:

```sh
npm --prefix web ci
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build:vite
npm --prefix web run preview
```

The existing manifest and lockfile are unchanged. Preview uses Vite's printed local URL. For live source editing use `npm --prefix web run dev` after one build has generated the runtime manifest.

A compact, pinned Linux x64 build is also retained. It needs Node 22.18+ and `xz`, and requires no npm registry, installed packages or package cache:

```sh
sh web/scripts/offline-install.sh
npm --prefix web test
npm --prefix web run build
npm --prefix web run validate
npm --prefix web run check:bundle
python3 -m http.server 4173 --directory dist
```

Open the printed local server URL. The offline build compiles the current TSX source, bundles the committed dependencies and copies local assets; it **does not typecheck**. Both build paths regenerate the verified ABI/asset inventory and replace `dist/` and `web/site/` together. Required compact compiler/runtime bundles and their licenses remain in `web/vendor/offline/`; generated dependency/cache directories are excluded from Git. No paid API is required. Wallet and Ethereum reads still require network access.

## What the terminal does

- A black V1-style dashboard: large gate/market chart on the left, compact IMD/UNLK2 swap on the right. Phones put the swap first; its main control fits the first 390px screen, including an RPC error state.
- A home-page active-gate contribution panel with three **OR** tracks: processed contract FDV, cumulative official gross USD volume and this gate's UNLK2 contributions. Each shows actual, target, completion and remaining amounts. Contributions use `UnlockV2Token.contribute(expectedGate, amount)`, with capped Max, full-precision burn/points/rights preview and stale-target rejection. Gate 10 changes the home panel to voluntary Golden Vault burning and continuing fee rewards.
- Ten interactive permanent gate steps, $250K–$25M FDV, clickable details, native keyboard/touch selectors and an alternative table. Initial official-buy rights are 20%; migration/swarm/founder rights are 0%. The gate percentages remain 25/30/35/40/50/60/70/80/90/100%.
- Real official-pool Swap-log candles, volume, timeframes, crosshair and pan/zoom using locally bundled TradingView Lightweight Charts. USD conversion uses a valid historical IMD/USD reference at each trade block. Missing/invalid USD, RPC failure and no trades have explicit retryable states; no production example candles exist. History is bounded to 7,200 blocks; historical USD requires archive reads.
- Wallet-driven migration, separate origin rights and previous sales, burn previews, weekly IMD claims, and a safe owner checklist with separate simulation/review and unsigned transaction downloads. EIP-6963 browser wallets, mobile wallet-browser links and Coinbase Smart Wallet share one connection dialog; no relay/project ID.

## Immutable integration limits

`fdvUsd()` is **indicative market FDV**, calculated using current `totalSupply()`. Gate decisions instead use `gateImdUsdPrice()`, settled observations and `lastFdvUsd`. Only stored `gatesOpen` marks a gate open; `pendingGatesOpen` is a preview. Invalid, missing or stale prices show unavailable.

The deployed hook processes the official pool price left before the first successful official swap of a later block. Its IMD/ETH tracker is rate limited to 5% per hour with a four-hour gap cap (upper ×1.20 / lower ÷1.20 per update). Gate pricing uses the lower of spot and tracker-derived IMD/USD; IMD price declines count immediately. This is **not immediate-spot gating**, and a frontend cannot remove that limitation. Openings are permanent. Supply excludes burns, includes reserves, and is never replaced by a fixed initial supply.

The native distributor's `roundOf`/`claimed` interface and double-hashed account/amount leaves do not match the hook's legacy proof interface. `src/auxiliary/NativeSwarmAdapter.sol` bridges authentic completed claims after rebuilding the entire native allocation tree at construction and proving account uniqueness. The full canonical corpus is still required; one authentic proof is not a substitute. No adapter address is invented.

`src/auxiliary/WalletQuoter.sol` simulates the real pool with the caller's identity and rolls back all effects. It must be installed, reviewed and registered before automatic trading quotes can operate. Stock V4Quoter is incompatible with these sell rights. There is no manual-minimum workaround. `web/public/repair-config.json` keeps both auxiliary records null and installation review false.

## Owner package and verified deployment

Token: `0xbd769d71d535030e47b0a024b8edae4a923d7819`

Hook: `0x4f811b89ef9a19800101705262681f715ac668cc`

Chain: Ethereum, ID 1. The supplied deployment ABI hashes are verified during every export; the frontend also verifies deployed runtime hashes and companion bindings before enabling transactions.

Read [the integration/package guide](docs/repair-integration.md), [owner checklist](docs/frontend/OWNER-SETUP.md) and [delivery status](docs/repair/DELIVERY.md). Auxiliary ABIs, bytecode and immutable references are in `docs/repair/package/`. Owner preparation is read-only:

```sh
npm --prefix web run check:live
npm --prefix web run prepare:owner
# After forge build, compare deployed runtimes, pinned ABIs and auxiliary packages:
node --import ./web/scripts/offline-register.mjs web/scripts/runtime-inventory.mjs
```

The owner must obtain and validate the complete allocation corpus, deploy/review both auxiliaries, publish their actual runtime hashes, register only supported integrations, and fund the remaining 700m migration reserve. Every step needs fresh state and separate simulation/review. Activation remains disabled and is absent from the owner package. The immutable hook does not itself enforce all mandatory router/distributor configuration before sealing.

## Validation

Current worker results, with evidence and limits: [artifacts/validation.md](artifacts/validation.md). Production build, equivalent strict TypeScript check, 11 Node tests, 136 local Solidity tests, 3 isolated mainnet-fork tests and 15 Chromium interaction cases passed. Live read-only browser checks covered 320/390/768/1440px and all screens. No real wallet signature or mainnet write occurred. These are regression checks, not an independent security audit.

The pinned design probe ran on `dist/`; its applicable geometry, target, contrast, motion and metadata checks passed. The remaining two probe flags are documented: required monospace prose and navigation mistaken for decorative labels. WebKit/native mobile wallets and assistive-technology sessions remain unverified. [DESIGN.md](DESIGN.md) describes the implemented source and six-domain review.

Independent fork tests opt in with `UNLOCK_REPAIR_FORK=true forge test --match-path test/RepairFork.t.sol -vv`. A process-local `UNLOCK_REPAIR_RPC_URL` can select a read provider; setup and activation occur only on the isolated fork. Normal `forge test --no-match-path 'test/*Fork*.sol'` has no mainnet writes. Deployment source, allocation, fees, ten gates, burn debits, previous-sales accounting and weekly rewards remain unchanged.
