# UNLOCK V2

Website continuation for **https://unlock-v2.imd.site/** on Ethereum mainnet, chain 1. Source is in `web/`; the complete static hosting export is **`dist/`**. `web/site/` is an identical build mirror retained for existing tooling. Assets use relative URLs and navigation uses hashes, so the export works below a gateway subpath.

This assignment changes the website only. It deploys no contracts and performs no mainnet activation, registration, funding, transfers or ownership/economic changes. At the read-only verification block **26347620**, trading was closed (`activated() == false`), the reviewed adapter and routers were registered, and remaining migration backing equaled remaining capacity: **665,646,916.1257 UNLK2**. Closed trading is shown separately from completed setup and activation is detected on subsequent reads. There is no activation or setup transaction button.

The export is ready for the existing IdentityMD publication pipeline. **A new public version/commit is not claimed by this worker:** this session exposes no hosting or repository publication tool, and `.git/` is protected. The existing URL was checked read-only; post-publication comparison is still required. See [delivery and validation](docs/update/VALIDATION.md).

## Install, preview and rebuild

Node **22.18+**; the existing package manifest and lockfile are unchanged.

```sh
npm --prefix web ci
npm --prefix web run typecheck
npm --prefix web run build:vite
npm --prefix web run preview
```

Open Vite's printed preview URL. `npm --prefix web run dev` starts source development after the first build. Both build paths regenerate verified ABI/asset inventories and replace `dist/` and `web/site/` together.

The retained Linux x64 production build also works without installing dependencies (Node and `xz` required):

```sh
npm --prefix web run build
npm --prefix web run validate
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173/`. This default production build bundles the actual TSX source using the committed, integrity-checked offline compiler/runtime assets. It **does not typecheck**; run the separate typecheck above. Required offline assets and licenses remain in `web/vendor/offline/`. No npm registry mirror, vendored npm archives or generated dependencies are part of the delivery. Wallets and chain reads require an internet connection.

## What changed

- Ten dimensional doors lead the homepage. Stored open gates appear broken/open, the current gate is gold and future gates remain locked. Numerical cumulative selling percentages remain visible. Selecting a door shows separate onchain FDV, volume and burn targets/progress. Any one condition opens a gate; past gate burn counters are not invented.
- Current gate progress and a contribution link are on the first phone screen. The full contribution form is on the homepage. After gate 10, including a cold load, it uses voluntary Golden Vault burning rather than a nonexistent contribution.
- A large official-pool candlestick/volume chart sits beside the desktop sticky swap panel. Mobile stacks the swap above the chart. Candles use timestamped PoolManager events filtered to the official pool; empty intervals are not filled. IMD history works without historical USD pricing. USD history requires valid end-of-block archive reads. History covers the latest 7,200 blocks and refreshes every minute while visible.
- IMD/ETH payment selection; IMD buys and UNLK2-to-IMD sells remain available when the live hook permits them. 20%, 50%, 75%, MAX and manual entry use integer base units. Sell percentages mean a portion of **currently sellable** tokens, capped by balance and the onchain allowance. ETH shortcuts use fresh full-route simulation and `eth_estimateGas`, a 20% gas margin and 25% fee buffer.
- Emerald burn core, separate burn/point/share values, and a brief token flow only after a successful matching burn receipt. Failed, cancelled and unrelated replacements do not animate success. Golden Vault uses a distinct gold visual, voluntary burns, separately accrued/claimable/maturing rewards, points and weekly timing. Burns remain irreversible.
- Existing migration, authentic native claim credit, cumulative selling counters and weekly reward claims remain connected. EIP-6963 browser wallets, wallet-browser mobile links and Coinbase Smart Wallet remain behind the existing connect sheet. No relay or project ID is needed.

## Strict ETH route

`native ETH → pinned ETH/IMD v4 pool → hook's official IMD/UNLK2 pool → connected buyer`

The reference key is native ETH/IMD, fee 10000, tick spacing 200, no hook. Its hash must equal `hook.referencePoolId()`. The official key is read from the hook and checked against `officialPoolId()`, the token pair, fee, spacing and hook. No route search, alternate pool, split or fallback exists.

The buyer calls the registered Universal Router directly. Two swaps share one atomic V4 unlock; the first leg's IMD credit funds the second without pre-owned IMD or approval. Exact native settlement and leaving intermediate deltas unsettled reject partial route settlement; a final native sweep refunds surplus to the buyer. Final minimum output and a three-minute router deadline are enforced.

WalletQuoter remains **single-pool only** for IMD buys/sells. ETH quotes use `eth_simulateV1` to run the real complete router transaction with sequential before/after buyer-balance and credit reads, followed by gas estimation of the final protected calldata. This includes first-leg reference-price changes, hook deltas and fees. Unexpected pools, partial/refund events, inconsistent buyer credit, stale quotes or unsupported RPC simulation stop ETH buying. There is no approximation fallback. Quotes last at most 45 seconds, invalidate on relevant state/account/network/input changes, and are revalidated before signing.

`ETH_ROUTE_VERIFIED` is enabled only after the actual-pool fork tests passed. That does not activate mainnet trading: the live hook's activation and runtime checks still gate all swaps.

## Checks

```sh
# Pure calculations, authentic proofs, route encoding and fail-closed simulations
node --import ./web/scripts/offline-register.mjs --experimental-strip-types --test web/tests/core.test.ts web/tests/repair.test.mjs web/tests/routes.test.ts

# Production export, explicitly synthetic RPC/wallet interactions
npm --prefix web run test:browser

# Read-only mainnet hashes, ABI hashes, bindings, pools, registrations and backing
node --import ./web/scripts/offline-register.mjs web/scripts/verify-update.mjs

# Actual installed contracts/pools on an isolated fork; NEVER mainnet writes
UNLOCK_ETH_FORK=true forge test --match-contract EthRouteForkTest -vvv
node --import ./web/scripts/offline-register.mjs web/tests/fork-browser.mjs
```

Playwright browsers and OS libraries must be installed for browser checks. `IMD_PLAYWRIGHT` may point to Playwright's `index.mjs` when installed outside `web/`. `UNLOCK_ETH_FORK_BLOCK=latest` selects a fresh browser-test fork; a numeric `UNLOCK_ETH_FORK_BLOCK` overrides the pinned fork block (26347457); the Solidity suite also accepts `UNLOCK_ETH_FORK_RPC`. Replaying old blocks requires an archive-capable RPC. Fork scripts create test balances/activation only in isolated local forks and shut down their children when finished.

Current worker evidence: production build and strict equivalent typecheck passed; pure Node tests, **14 Chromium interaction checks**, **4 Solidity fork cases**, and **6 production-interface fork flows** passed. Source retrieval, live reads, limitations, exact commands and the six-domain Better Interface review are recorded in [docs/update/VALIDATION.md](docs/update/VALIDATION.md). Screenshots are explicitly identified as mock or fork evidence. Earlier `docs/repair/` and `docs/frontend/` reports are historical.

Read [DESIGN.md](DESIGN.md) for the final implemented system, [retrieval/provenance](docs/update/RETRIEVAL.md) for the corrected package merge, and [guidance attribution](docs/frontend/NOTICE.md) for retained licenses.
