# Repair validation

Original integration results are retained below. The upload-size repair reruns offline build/component/asset checks and the desktop/mobile browser suite; see OFFLINE-PACKAGE.md and evidence/bundle-size.json. Contract, fork and live-chain results are prior checkpoint evidence. These checks are regression evidence, not an independent security audit. No real wallet was connected and no mainnet transaction was signed or broadcast.

| Layer | Result | Scope and limits |
|---|---|---|
| Existing + new local Solidity suite | **136 passed, 0 failed, 7 skipped** | Actual local v4 PoolManager and unchanged deployed-contract source; synthetic ERC20/feed/native fixtures. Includes property/invariant tests and the adapter's five-leaf cross-language corpus fixture. Baseline network tests and the opt-in fork suite are skipped in this offline run. See evidence/contract-tests.txt. |
| Independent mainnet fork | **3 passed, 0 failed** | Ethereum block **26339867**, public RPC, actual deployed token/hook/vault/reward pot, real Universal Router, Permit2 and stock quoter bytecode. Fork-only owner impersonation funds the reserve and registers the test quoter/router; synthetic trader IMD/V1 balances are confined to the fork. No live owner transaction. See evidence/fork-tests.txt. |
| Native authentic allocation | **Verified offline, live and fork** | Exact native double-hash leaf and proof recovered from a successful claim transaction. Native claimed(round,account) is true. Legacy root/claimed calls revert. This is not the full canonical corpus. |
| Frontend core/proof tests | **8 passed** | Input/slippage/calldata failures, both tuple encodings, independently specified OHLC/gap/historical-USD expectations, real claim proof and altered evidence, deterministic full-tree generator and duplicate rejection. See evidence/frontend-tests.txt. |
| Desktop/mobile browser regression | **10 checks passed** | Chromium, 1440px desktop and 390px mobile, built static export served under /preview/. All RPC/wallet responses are explicitly synthetic. Evidence/browser-report.json records the individual checks. Screenshots are supplemental. |
| Typecheck, production build and asset/ABI validation | **Passed** | Existing implementation ABI hashes match the deployment handoff; network/address inventory unchanged; export includes repair-config.json and local chart runtime. See frontend-build.txt and frontend-validation.txt. |
| Offline dependency reproduction | **Passed** | Superseded the oversized npm cache with compact pinned runtime bundles and a compiler. The no-node_modules source build, 8 component tests and asset/ABI validation are rerun for this size repair; see OFFLINE-PACKAGE.md. Full typechecking/browser tooling is separate from this compact package. |
| Current mainnet checkpoint | **Read-only verified** | Block **26339946**; trading closed, gates=0, no configured swarm/router, zero migration backing. Exact code hashes, native round and compatibility probes are in evidence/live-read.json. |
| Owner transaction preparation | **3 unsigned steps separately estimated** | Quoter creation, exact remaining migration deficit transfer, and supported Universal Router registration. Adapter creation and auxiliary registration withheld pending corpus/installation. No activation calldata. docs/repair/owner-plan.json must be regenerated before use. |
| Website/source publication | **Unavailable from this runtime** | GitHub CLI reports no authenticated session; available IMD CLI excludes launched-site identities. No remote commit, CID or replacement identity is claimed. See DELIVERY.md. |

## What the fork proves

`test/RepairFork.t.sol` activates only its isolated fork to exercise closed-mainnet behavior without a mainnet transaction. Actual UniversalRouter.execute calldata settles both buy and sell. Balance output equals the new wallet quoter output exactly, and the executed reward-fee change equals its quoted fee. The real stock quoter fails the pre-gate-10 sell and a different caller without credits also fails. The actual native allocation/proof validates and its legacy ABI mismatch is reproduced. Migration locks V1 and credits V2; gate contribution earns points; an old expected gate reverts after the owner finishes a gate; voluntary burn earns points; real swap fees redeem and mature into a weekly IMD claim.

This is more than a mock-router quote comparison. Nevertheless the fork's missing swarm configuration is intentionally left missing to isolate quote behavior: activate() does not enforce it. The production checklist prohibits activation before all mandatory integrations are installed and proven. No mainnet adapter deployment or authentic full-corpus constructor run is claimed.

## Browser functional assertions

The browser test asserts real DOM/UI behavior and inspects intercepted calldata/state transitions, not just screenshots:

1. Home has ten interactive gate markers, three OR progress tracks, and the contribution form; pending observations never mark gates open; background is true black.
2. Empty market history shows an explicit no-trades state, units, source and working retry.
3. Connected-wallet buy quotes are automatic, have no manual minimum bypass, and token/Permit2 approvals are exactly the spend before reviewed router execution.
4. Sells use the wallet quoter; a simulated quota failure yields no send.
5. Contribution max is capped by balance/capacity; a gate change prevents the reviewed contribution from signing.
6. Gate 10 replaces home contribution with voluntary burning, which can complete the simulated wallet flow.
7. Advancing time after the first simulation but before final confirmation blocks signing the expired quote.
8. Observed-trade **synthetic test logs** render real candle/volume canvases with timeframe switching, USD selection, crosshair and zoom. Production has no test candle data.
9. Mobile stacks without horizontal overflow, shows trading closed/pending installation and keeps activation disabled.
10. RPC failure marks a previous snapshot stale and disables transactions.

Hardware wallets, a real mobile browser wallet app, Safari/WebKit, and a live activated market have not been exercised. Wallet signatures in browser checks are mocked. Mainnet trading is still closed; actual production candle history is not claimed. Price/FDV display uses unavailable states for invalid/missing/stale data rather than synthetic zeros.

## Outstanding installation / limits

* Full canonical native allocation corpus is absent. The recovered leaf proves its own native amount only. The constructor's full-tree/unique-account check is mandatory; deployment remains pending. A duplicate-account native root would be an explicit safety blocker for this adapter.
* Mainnet auxiliary deployment, runtime/immutable review, owner registration, 700m backing and any activation remain explicit future owner work. The job performs none of these. Source and ABI package are not a deployment.
* Read-only owner-plan estimates are checkpoint estimates, not sequential batch execution proof. Actual addresses/nonces, full-corpus gas/initcode and every installed runtime must be reviewed before use.
* The immutable tracker and next-block FDV behavior remain in force; no UI change makes gates immediate-spot.
* Market history is bounded to the last 7,200 blocks. USD candles require historical state support from the public RPC. Failure is explicit; it never falls back to fabricated candles or today's USD rate.
* Quoter LP input fee and spot deviation are labelled estimates/context; the net output and reward fee are measured from actual swap simulation. Partial fills are rejected.
* Static export is web/site/ within the assigned write scope. Root dist/ is intentionally untouched. Authenticated publication to the existing identity/repository remains a delivery-system operation.
