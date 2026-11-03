# UNLOCK V2 terminal

React, TypeScript, Vite and viem. This is a static Ethereum application: public RPC reads run in the browser and a visitor's wallet signs user transactions. Founder setup only downloads unsigned transaction JSON. There is no backend, private key, signing service, relay or WalletConnect project ID.

## Install, build and preview

Requires Node 22+ (validated with Node 24).

```sh
npm ci --prefix web
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web run validate
npm --prefix web run preview -- --port 4173
```

Open the preview URL. `dist/` at the repository root is the complete export, with relative asset URLs and hash navigation. It also works beneath a gateway directory such as `/preview/`; no route rewrites are required. Serve over HTTP(S), not `file://`, because the deployment and ABI JSON are fetched at runtime.

`npm --prefix web run dev` supports source development after the initial build: its development middleware serves the *same* `dist/imd-deployment.json`; implementation ABIs are served from `web/public/abi/`. The middleware is not part of the production application.

## Configuration and provenance

`docs/frontend/deployment-handoff.json` and `docs/frontend/network-handoff.json` preserve the supplied handoffs as build inputs. They are not imported into the browser. The build reads them to generate **one runtime configuration**, `dist/imd-deployment.json`. `web/src/config.ts` loads that file, fetches its referenced ABI arrays and verifies canonical Keccak hashes before constructing clients. No deployed address or RPC map is hardcoded in the React components.

All four ABI arrays under `web/public/abi/` were copied byte-for-byte from `docs/abi/` at source commit `c5cfccf67b93f76f6ff0b82684e5c0ae8b804835`. The attested contract list contains only the token and hook. Companion addresses are obtained from the hook, with code and back-reference checks. Supplemental companion ABIs are included in the asset inventory, without inventing additional attested deployments. The handoff has no `poolKey`; the runtime reads the initialized hook's PoolKey, checks its currencies and hook, and uses it unchanged. The export generator also copies a handoff poolKey exactly if one is supplied in a subsequent approved handoff.

The final build generates SHA-256 entries for every exported file except the manifest itself. `npm --prefix web run validate` checks the complete inventory, exact handoff fields, exact network and wallet-add-chain objects, ABI hashes and export limits. Rebuild after any source/public-asset change; never edit generated assets without regenerating their inventory.

## Wallets and transactions

One connect sheet discovers extensions through EIP-6963, offers a fallback browser wallet, provides mobile wallet-browser links, and lazily loads Coinbase Smart Wallet with passkeys. No credentials are required. Wrong-network handling switches, offers the exact handoff `wallet_addEthereumChain` parameters for error 4902, then switches again. Account and chain changes invalidate reviews and account reads. Public RPCs are tried in configured order, with a connected wallet read fallback on the correct chain.

Reads refresh every 12 seconds while the page is visible, on manual refresh, after transactions, and on return to the tab. Requests are batched, without a multicall contract dependency. Missing code, mismatched bindings, RPC failures and stale snapshots disable actions. Values are unavailable until actually read; there are no example balances or invented history.

Swap routing uses only the network block's quoter, Permit2 and Universal Router. Both ERC-20 directions send zero ETH value and require ETH for gas. Approval 1 is token → Permit2, approval 2 is Permit2 → Universal Router, each limited to the entered amount and only offered when the live allowance is insufficient. Router permission expires after 30 minutes. Quotes expire after 60 seconds. Automatic slippage accepts 0.01–5%; minimum output floors in base units. Swaps encode V4_SWAP `0x10` with actions `0x060c0f` and a ten-minute deadline. The extended six-field swap tuple is supported only when the runtime network declares it.

**Sell-quote limitation:** the configured deployed quoter's `msgSender()` call reverts. Before gate 10 the hook therefore attributes a sell quote to the quoter's shared address, which normally has no sell allowance. Do not register an incompatible quoter as a trusted router. The interface surfaces the quote failure and provides an explicit **custom minimum output** path: the user chooses a positive output floor, approves as needed, then simulates the actual Universal Router call with their own account. No estimated output or automatic slippage is claimed for that path. A failed simulation cannot proceed to signing. This restriction comes from the deployed integration; it is not bypassed by fabricated quote state or state overrides.

All user actions show a review, simulate, estimate gas, then re-simulate immediately before the wallet request. Pending signing and receipt states lock duplicate submissions; hashes link to the explorer. A closed review retains a visible status control. An unresolved receipt can be rechecked without resubmitting. Successful receipts, reverts, rejection and retry states are visible. Irreversible migration, burns and activation preparation require acknowledgment. No real transaction was broadcast during validation.

## Screens and owner setup

Trade, Gates, Migrate, My Rights, Burn & Points, Weekly IMD Rewards, Golden Vault, Rules / Contracts and Founder setup are hash routes. Every gate has FDV, gross cumulative volume and per-gate contribution progress. Burns use the contract's exact `previewBurn`; contributions use `contributionQuote` and preserve the quoted expected gate. The Golden Vault is the final gate state, not an NFT treasury. V1 remains available through its original token explorer link; no V1 contract or website was replaced.

See [owner setup](../docs/frontend/OWNER-SETUP.md). The actual distributor is an owner-entered setting, not a guessed address. The owner screen prepares funding, router registration, distributor setting and activation JSON and never calls the wallet send method for these actions. Live observed transaction data is in `docs/frontend/evidence/live-chain.json`; activation is currently blocked by missing funding/setup.

## Validation

```sh
npm --prefix web test
# Install Playwright browsers and their system dependencies in a suitable environment first.
npm --prefix web exec -- playwright install chromium webkit
npm --prefix web run test:browser
node web/scripts/live-check.mjs
node web/scripts/render-live.mjs
```

Browser tests own and close a temporary HTTP server under `/preview/`. Their wallet/RPC fixtures are explicitly synthetic, live only in the test code, and are never bundled into the application. Test screenshots are watermarked. Separate live screenshots exercise configured public RPCs without injection or mocks. Evidence is written under `docs/frontend/evidence/`; the detailed scope, commands, findings, unperformed checks and integration limitations are recorded in [validation](../docs/frontend/VALIDATION.md).

Dependency folders and caches are not deliverables. `web/.gitignore` is the only ignore file added and its explicit path budget is one file; it excludes dependency and cache directories recursively within `web/`. No root configuration, deployed source, root ignore file or submodule was changed. Publishing the delivered export is handled subsequently by the publisher.
