# UNLOCK V2 repair integration — pending auxiliary installation

This continues `unlock-v2.identitymd.eth` / https://unlock-v2.identitymd.eth.limo and the existing source repository https://github.com/identity-md-launches/launch-2921-workflow-frontend-stage-context. No V1 or deployed V2 source, allocation, fee, gate or accounting code is changed. No mainnet transaction was signed or broadcast. The static export is **web/site/** because this assignment prohibits modifying root dist/. Publish that directory as the next version of the existing identity; do not create a new identity.

## Live checkpoint and installation status

`docs/repair/evidence/live-read.json` contains fixed-block public RPC results, code hashes, native compatibility probes and authentic claim verification. At block **26339946**, Ethereum chain 1: trading closed; gatesOpen=0; lastFdvUsd=0 (no processed FDV yet); volume=0; swarmDistributor unset; Universal Router and stock V4Quoter unregistered; migration backing=0 and remaining capacity=700m UNLK2. The pool is initialized and token bound. A zero lastFdvUsd is displayed as **not yet observed**, not a zero market valuation. These facts are historical evidence, not permission to act on stale state. Both owner preparation scripts and the UI re-read state before preparing actions.

**Auxiliaries are source only.** `web/public/repair-config.json` deliberately uses null installation records. No guessed, zero, dead or simulated address is an installation. Trading activation is disabled in the UI and absent from generated owner plans. Mandatory owner installation remains outstanding.

A complete canonical native round-0 account/amount corpus was not supplied or recovered. An authentic claimed allocation and its eight-element proof were recovered from transaction `0x7282f29e31181d1992dd2a062a820117dba1b6b9824324d917cda343bf1bedbe`, block 26335960. See `test/fixtures/native-mainnet-claim.json` and its Solidity equivalent. This is **one authentic leaf, not a reconstructed full corpus**. Adapter deployment must remain pending until the full corpus rebuilds the authentic root and proves account uniqueness. If that root actually contains duplicate accounts with different amounts, this boolean-only native interface cannot safely disambiguate the paid amount; this adapter rejects deployment. Do not omit the uniqueness check or substitute an owner-chosen legacy root.

## Exact native compatibility interface

Authentic distributor: `0x00aecdb1da9fafac4b5717d54c8b9adc860e189a`, token `0xbd769d71d535030e47b0a024b8edae4a923d7819`.

```
roundCount() -> uint256
roundOf(uint256 round) -> (bytes32 root,uint256 funded,uint256 claimed,uint64 unlocksAt)
claimed(uint256 round,address account) -> bool
token() -> address
```

Round 0 root is `0x0442e07558c3a49da44ffafc43fde948057ee5f5d02c63bbde025369ab4c96fb`, funded=100000000000000000000000000 wei. Native leaf:

```
keccak256(bytes.concat(keccak256(abi.encode(account,amount))))
```

The native `claim(uint256,address,uint256,bytes32[])` selector is `0x2e7ba6ef`, as independently decoded from the authentic transaction. This terminal syncs completed claims; it does not submit native claims. The launch's native claim interface should be used to receive tokens first.

The deployed hook requires `merkleRoot() -> bytes32`, `isClaimed(uint256) -> bool`, and packed legacy leaf `keccak256(abi.encodePacked(index,account,amount))`. The native distributor's legacy calls revert, as reproduced live and on a fork. Registering it directly is wrong.

### NativeSwarmAdapter

Constructor:

```
NativeSwarmAdapter(INativeSwarm native, ISwarmCreditHook hook, uint256 round,
                   address[] accounts, uint256[] amounts)
```

The adapter has no owner or setters. The constructor verifies native token equals hook token, round existence, nonzero authentic root/funding, positive amounts, nonzero strictly ascending **unique addresses**, and sum <= native funding. It double-hashes all allocation leaves, sorts the hashes and rebuilds the complete binary heap used by OpenZeppelin StandardMerkleTree (sorted leaves reversed into the heap). The rebuilt root must equal `roundOf(round).root`. The entire allocation list is constructor calldata, not an arbitrary derived-root assertion. No account list is kept in storage. A nonstandard tree layout will fail the root check rather than produce credits; reconcile the canonical tree format before installation. Actual full-corpus constructor gas/initcode must be simulated before owner deployment.

Frontend API (exact ABI is in `docs/repair/package/NativeSwarmAdapter.json`):

```
nativeDistributor() -> address
hook() -> address
nativeRound() -> uint256
nativeRoot() -> bytes32
nativeFunded() -> uint256
allocationCount() -> uint256
indexOf(address account) -> uint256
synced(address account) -> bool
syncClaim(address account,uint256 amount,bytes32[] nativeProof)
```

`syncClaim` is permissionless; the credited recipient always equals the proven account. It checks the immutable native root/funding still match, the authentic distributor actually marks this account claimed in the immutable round, and the amount is proven against that native root. A claimed boolean alone never suffices. Constructor-verified unique accounts rule out alternate valid amounts for the same account.

Only during that call, it exposes a one-leaf legacy tree rooted at the exact packed legacy leaf and an isClaimed flag for its deterministic index:

```
uint256(keccak256(abi.encode(nativeDistributor,nativeRound,account)))
```

It immediately calls the existing hook's `creditSwarmClaim(index,account,amount,[])`, then clears the temporary root/active flag. An empty legacy proof is valid only for this already-authenticated singleton. A caller cannot select an index or legacy root. `synced[account]`, domain-separated indices, the immutable round, and the hook's existing `swarmIndexCredited` prevent replay, even across replacement adapter instances for the same native round. Wrong account, amount, round, sibling, fabricated legacy evidence and direct out-of-context hook calls fail. Any hook revert rolls the whole sync back. Existing uncredited burns are netted by the deployed hook unchanged.

### Reproducible proof inputs

Full corpus input is a JSON array of `{ "account": "checksummed address", "amount": "integer token wei" }`, **not human decimal tokens**. There is no production stand-in corpus.

```
node web/scripts/native-proofs.mjs canonical-allocations.json docs/repair/canonical-proofs.json
```

The generator rejects duplicate/zero accounts and invalid amounts, reconstructs the root, checks the pinned root/funding, and outputs sorted constructor arrays and per-account native proofs. Output is written only if validation passes. Reordering the input gives identical output. `test/fixtures/native-mainnet-claim.json` is reproducible from the original transaction input without an API key. Synthetic multi-leaf fixtures exist only in tests and are explicitly identified as mocks.

## Wallet-specific exact-input quotes

Verified router: `0x66a9893cc07d91d95644aedd05d03f95e1dba8af`. Stock quoter: `0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203`. Its msgSender() probe reverts and its shared address cannot quote a pre-gate-10 sell using the wallet's credits. **Never register the stock quoter.**

`WalletQuoter(IQuoteHook hook)` fixes the hook and its PoolManager immutably. It quotes only that hook's official PoolKey and takes no trader, recipient, arbitrary pool or hookData argument:

```
quoteExactInput(bool zeroForOne,uint128 amountIn)
    -> (uint256 amountOut,uint256 rewardFee,uint256 lpFeeInput)
msgSender() -> address
hook() -> address
poolManager() -> address
```

The calling wallet is captured from msg.sender during the quote, exposed through msgSender(), and cleared afterwards. The owner must register this auxiliary as a supported router **before sealing**. A PoolManager unlock callback runs the real exact-input swap, including hook quota checks, pending-buy maturity, settled FDV observations and extra fees. It then reverts with a narrowly decoded QuoteResult. No delta is settled or taken; all simulated pool/hook/reward/gate writes roll back. The contract has no spending/execution function and no approvals. Direct/idle callback forgery fails. Partial input fills and zero output are rejected. The fixed hook cannot be substituted by caller calldata.

The frontend calls `simulateContract` with the actual connected wallet as account. The same wallet executes the real Universal Router transaction; it never routes the user's real transaction through the quoter. A third party can ask an RPC to simulate another sender, but this cannot authorize spending or execute a trade for that sender. Quotes are advisory; actual router simulation and the wallet transaction remain authoritative.

`amountOut` is net output including hook effects. `rewardFee` is the exact change in the hook's PoolManager IMD claims. `lpFeeInput` is an explicitly labelled ceiling estimate of the 1.25% LP input fee; per-tick rounding may differ by wei. Buy reward fee is removed before pool input; sell reward fee is deducted from pool IMD output. Their bases differ. The UI shows fee-inclusive spot deviation (not a falsely precise fee-free price impact), output, slippage-derived minimum, source block and update time. There is no custom-minimum bypass. Invalid quotes produce no transaction.

### Exact real-router calldata

The fork at block 26339867 proved the deployed router uses the original v4 exact-input tuple **without minHopPriceX36**:

```
execute(bytes commands,bytes[] inputs,uint256 deadline)
commands = 0x10                         // V4_SWAP
inputs[0] = abi.encode(0x060c0f,params)  // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
params[0] = abi.encode(ExactInputSingleParams{
    PoolKey poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData
})
params[1] = abi.encode(inputCurrency,uint256(amountIn))
params[2] = abi.encode(outputCurrency,uint256(amountOutMinimum))
```

`params[0]` encodes a **single dynamic tuple**, including its outer offset; flattening its fields is not equivalent. Both the independent Solidity fork test and frontend core tests cover this. The deployment network configuration's original tuple layout remains unchanged.

ERC-20 approval goes to Permit2 `0x000000000022d473030f116ddee9f6b43ac78ba3` for exactly the necessary input. Permit2 approval goes to the actual Universal Router for exactly that input, with a 30-minute expiry. Real transactions use a 10-minute deadline, no ETH value, and automatic slippage minimum. Quotes expire in 45 seconds and bind wallet/direction/amount/slippage. At both simulation and final confirmation the terminal checks expiry, caller/input identity, auxiliary runtime hash, a fresh wallet quote, and actual Universal Router simulation. A stale, failed or below-minimum quote cannot reach signing. As with any wallet flow, chain state can move after the final check; onchain minimum/deadline/quota checks still apply.

## Gate observations and dashboard

Only `gatesOpen` determines opened/current/future states. `pendingGatesOpen` is labelled a preview. Before gate 1, official buys have 20% and migration/swarm/founder credits have 0%; subsequent gates use the table below for credited origins. Gate 10 removes quota checks for everyone. All figures retain 18-decimal onchain precision.

| Gate | Sell % | FDV USD | Cumulative gross USD volume | Per-gate UNLK2 contribution |
|---|---:|---:|---:|---:|
| 1 | 25 | 250,000 | 125,000 | 25,000,000 |
| 2 | 30 | 500,000 | 375,000 | 22,000,000 |
| 3 | 35 | 1,000,000 | 750,000 | 19,000,000 |
| 4 | 40 | 2,000,000 | 1,500,000 | 16,000,000 |
| 5 | 50 | 3,500,000 | 2,500,000 | 13,000,000 |
| 6 | 60 | 5,000,000 | 4,000,000 | 10,000,000 |
| 7 | 70 | 8,000,000 | 6,000,000 | 8,000,000 |
| 8 | 80 | 12,000,000 | 9,000,000 | 6,000,000 |
| 9 | 90 | 18,000,000 | 12,500,000 | 4,000,000 |
| 10 | 100 | 25,000,000 | 20,000,000 | 2,000,000 |

Any **one** trigger opens the next sequential gate permanently. Volume is cumulative gross official executed IMD-leg volume valued with the gate price; it never resets and does not mean unique organic demand. Only `UnlockV2Token.contribute(expectedGate,amount)` advances the collecting gate's burn counter. Voluntary `burn(amount)` earns points but does not advance gates. Contribution max is min(wallet balance, remaining gate capacity), and the exact hook preview shows pending/buy/other credit debits, uncredited burn, post-burn allowance and points. The target gate is captured and rechecked, never silently retargeted. Past sales never reset. Golden Vault mode after gate 10 replaces contribution with voluntary burning and continuing fee rewards. Reward share changes as others earn points; returns are not guaranteed.

The home page separates:

* **Indicative market FDV:** fdvUsd(), spot IMD/USD × official token/IMD × **current totalSupply**. Invalid/missing/stale references display unavailable.
* **Last processed gate FDV:** lastFdvUsd, a historical contract value. Zero before observation is not a market price. lastFdvBlock is the latest **attempt** and also advances on invalid reads; lastValidObservation is a successful volume observation timestamp, not a precise last-successful-FDV timestamp. The immutable contract exposes no such separate FDV timestamp. The UI states this and does not present old values as current price quotes.
* **Pending observation:** gateImdUsdPrice() and pendingGatesOpen(), not stored openings.

The immutable hook observes the official price left by a previous block, before the first successful official swap of a later block. It does not immediately open FDV gates on a spot-price move. The reference tracker tracks **IMD per ETH**, moving at most 5%/hour with a four-hour elapsed-time cap (20% permitted move in one update). IMD/USD for gates is the lower of spot and tracker-derived USD; falls count immediately. A 20% movement of IMD-per-ETH is not a claim of exactly 20% USD growth. Invalid prices skip price/volume progress. UI changes cannot remove this immutable behavior.

The staircase is an interactive SVG with logarithmic FDV x-axis and unlock percentage y-axis, keyboard/click selection, tooltips, opened/current/future markers and a readable table alternative. Its initial buy-20% segment is separate from other-origins-0%.

Market Chart uses vendored **TradingView Lightweight Charts 5.0.9** (Apache 2.0; license and attribution included), with real official-pool Swap logs only, candles, volume, timeframes, crosshair and zoom/pan. It scans the last 7,200 blocks in bounded RPC ranges. Price is executed pool IMD/token ratio, not FDV; IMD volume excludes the extra hook fee. USD conversion uses a valid historical reference at each trade block, requiring archive RPC support. It never converts old trades at today's reference, invents carry-forward candles or silently substitutes another pool. Missing historical USD remains unavailable; IMD can still be viewed. Empty windows, closed trading, errors, source, update time and retry are explicit. No paid API is required. Long histories/indexers and browser wallet hardware are not claimed tested.

## Owner package and offline reproduction

`docs/repair/package/{NativeSwarmAdapter,WalletQuoter}.json` contains compiler-derived ABIs, creation/runtime bytecode and immutable references, built with the unchanged project's solc 0.8.26 / optimizer 200 / viaIR / Cancun settings. Existing token/hook ABI hashes remain pinned and verified; their source is unchanged.

```
sh web/scripts/offline-install.sh
npm --prefix web run test:offline
npm --prefix web run build:offline
npm --prefix web run validate:offline
forge test --out /tmp/unlock-build --cache-path /tmp/unlock-cache -vv
UNLOCK_REPAIR_FORK=true forge test --match-path test/RepairFork.t.sol --out /tmp/unlock-build --cache-path /tmp/unlock-cache -vv
npm --prefix web run test:browser
npm --prefix web run check:live
npm --prefix web run prepare:owner
# When the authentic complete corpus is available:
npm --prefix web run prepare:owner -- canonical-allocations.json docs/repair/owner-plan-with-corpus.json
```

The compact offline path verifies pinned vendored runtime modules and a Linux x64 compiler under web/vendor/offline/; it requires Node 22.18+ and xz, with no node_modules, package manager installation or registry. Frontend runtime dependencies are bundled in web/site/. Offline builds transpile/bundle; full npm/Vite typechecking and browser tooling require the development dependencies separately. See docs/repair/OFFLINE-PACKAGE.md for reproduction and the upload-size repair. Browser tests require an available Chromium runtime; set PLAYWRIGHT_CHROMIUM_EXECUTABLE explicitly if the local Playwright build is not installed. No browser executable is downloaded by the tests. Fork/live commands intentionally require network and are opt-in; ordinary contract tests skip fork cases when unset. Solidity dependencies already present under lib/ are preserved, with no new submodule.

`prepare-repair.mjs` has no signer or broadcast method. It rechecks mainnet chain, code, token/hook/native root/funding, owner, seal state and migration reserve, then separately estimates unsigned deployment/funding/router transactions. Without the complete corpus it withholds adapter creation. It withholds auxiliary registration until actual reviewed installation records exist. No activation calldata is emitted. `docs/repair/owner-plan.json` is a checkpoint example, not an executable batch; regenerate and review each step sequentially. Its quoter creation address is intentionally unspecified, as it depends on the owner's real transaction nonce.

`script/PrepareRepair.s.sol` is a constructor dry run, deliberately without any broadcast cheatcode. Simulated addresses must never be published as installed. After external deployment, verify full runtime against compiled artifact (including immutable values), all native/quoter bindings, root/funding, authentic sync and actual-router quote equivalence on a fresh fork. Publish actual address + runtime code hash only after review. Register adapter, compatible quoter and Universal Router separately in the owner wallet/Safe, fund exactly the remaining 700m reserve deficit and recheck everything before any external decision to activate. The application provides separately reviewed/simulated wallet actions and an unsigned Safe-export option; activation stays disabled in this delivery.

## Finding-to-fix / validation map

| Finding | Delivered repair | Evidence / remaining requirement |
|---|---|---|
| Native round distributor incompatible with legacy hook | Immutable atomic proof adapter; full-root/unique-account constructor verification | Repair.t.sol forgery/replay/burn-netting tests; authentic proof live + fork; full canonical corpus and mainnet installation pending |
| A claimed boolean cannot prove amount | Native amount proof plus constructor-proven unique account allocations | Alternate amount/account/sibling and duplicate-account-root rejection tests |
| Stock quoter uses a shared sell identity / lacks msgSender | Caller-bound WalletQuoter; fixed official pool; all effects reverted | Local PoolManager quote identity; **actual deployed Universal Router** buy/sell fork equivalence; stock failure reproduced |
| Manual minimum used to work around quote failure | Automatic quotes, output, fees, spot deviation, minimum and source block | Browser buy/sell and failed-quote checks; no manual minimum UI |
| Stale quote could survive review | Expiry and fresh quote checks at simulation and final confirmation, then real-router simulation | Browser advances time during final review and proves no signing |
| Spot FDV presented as gate progress | Separate indicative, historical processed and pending observations; stored gates only | Pending-gates browser fixture leaves current gate unchanged; live lastFdv=0 unavailable |
| Home lacked active contribution | Three labelled OR progress/remaining tracks; capped max; exact preview; gate-bound contribute | Local contracts, mainnet-fork stale-gate test, browser cap/target checks |
| Gate list substituted for chart | Interactive staircase plus alternative table | Desktop/mobile browser interaction and screenshots |
| No trustworthy market history | Maintained vendored candle library; actual official pool logs, historical units, retry/source | Independent OHLC/gap/USD tests and labelled synthetic candle browser fixture; live pool remains untraded |
| JSON-only owner setup / activation too permissive | Owner checklist, wallet simulation/review, Safe export, verified auxiliary config, activation disabled | Browser pending/mobile checks; separately estimated read-only owner package |
| Offline build dependency gap | Compact pinned dependency bundles/compiler and standalone static export | Fresh no-node_modules build/component checks; no network needed to serve web/site |
| Existing site/repository publication | Exact existing identities retained, export prepared at web/site | Not published by this run: GitHub CLI has no login; available imd site command disallows launched-site labels. See DELIVERY.md |

For measured results and limitations, see `docs/repair/VALIDATION.md`. Passing local/fork tests are regression evidence, not an independent security audit.
