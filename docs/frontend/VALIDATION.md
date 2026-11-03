# Frontend validation and interface review

Worker self-report for the delivered UNLOCK V2 source and static export. These checks are reproducible development evidence, not independent certification or an audit of deployed economics.

## Scope and result

The source is under `web/`, the complete relative-base export is under root `dist/`, and documentation/evidence is under `docs/`. The reviewed build has nine screens: Trade, Gates, Migrate, My Rights, Burn & Points, Weekly IMD Rewards, Golden Vault, Rules / Contracts and Founder setup. Public reads are available without a wallet. Contract writes require a verified deployment, correct wallet chain, prerequisites, simulation and review. Founder transactions are unsigned downloads only.

**Complete for this frontend worker scope**, subject to the explicit live-signing and physical-device limitations below. Hosting, IPFS pinning, site naming and publication checks happen after delivery and have not been claimed as worker results. Deployed contracts, root configuration and V1 were not modified.

The handoff is pinned to `c5cfccf67b93f76f6ff0b82684e5c0ae8b804835`. Both attested ABI canonical Keccak hashes match exactly. Companion ABIs were also copied from that commit. The supplied handoff has no poolKey, so the application reads the initialized hook's key; it does not replace the hook with a zero address. The manifest generator preserves an exact supplied poolKey if a handoff contains one.

## Commands and evidence

| Check | Executed command / evidence | Outcome |
| --- | --- | --- |
| Install | `npm install --prefix web` using the pinned package versions; lockfile included | Passed |
| Typecheck | `npm --prefix web run typecheck`; also enforced by every production build | Passed |
| Production export | `npm --prefix web run build` | Passed; relative `./` base, root `dist/` |
| Encoding/amount/error tests | `npm --prefix web test` | 5 tests passed |
| Browser interactions | `npm --prefix web run test:browser` with locally provisioned Chromium and WebKit | All scenarios in `evidence/browser-results.json` passed |
| Live deployment reads | `node web/scripts/live-check.mjs` | Chain 1, nonempty token/hook/companion code and bindings verified; `evidence/live-chain.json` |
| Live rendered export | `node web/scripts/render-live.mjs` | Real configured public RPCs, no wallet injection or fixtures, no script/local-resource failures; `evidence/live-browser.json` |
| Manifest and hashes | `npm --prefix web run validate` | Exact handoff/network/ABI binding and complete SHA-256 inventory passed |
| Pinned design probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` with Playwright module configured | 14 of 16 mechanical checks passed; two reviewed exceptions below |
| Scope and size | Git nonignored candidate inventory; `evidence/bundle-audit.json` | Only allowed paths; below 8 MiB; no dependency/cache archives or submodules added |

The supplied browser MCP launcher could not find its Chrome distribution. Validation used local Playwright browsers instead. WebKit needed temporary shared-library and software EGL dependencies; its engine then rendered the actual export and executed the primary flow. The dependency cache and browser binaries are outside the submitted files. These environment-specific accommodations are not runtime dependencies of the website.

## Interaction coverage

The browser harness serves the committed production export beneath `/preview/`, intercepts only its test RPC/wallet calls, and closes its server and browser. Synthetic companion addresses, balances and receipts exist only in `web/tests/`; they are not production configuration or bundled code. Mocked screenshots have an explicit watermark. Successful fixture interactions do not claim a real funded swap.

Chromium scenarios cover:

- Walletless deployment and ABI loading, live-state presentation, complete metadata and relative subpath assets.
- EIP-6963 discovery, wallet rejection and retry, checksummed connected address, unknown-chain error 4902 → exact add-chain parameters → switch, and wrong-network send prevention.
- Missing contract code and modified ABI JSON disable the application before any send.
- Phone user-agent wallet-browser link destinations, local wallet marks and Coinbase Smart Wallet entry.
- Invalid amount rejection, simulated quoter requests, slippage minimum, both separate approvals, Universal Router execution with zero ETH for the IMD pair, pending receipt lock and confirmed state.
- A failed sell quote followed by an explicit custom minimum, separate UNLK2/Permit2 permissions and actual-router simulation. No expected output is invented for the custom-minimum path.
- V1 approval, permanent-lock acknowledgment, 1:1 migration, cap/backing and balance refresh.
- All ten gate rows and all three collecting-gate progress bars; origin counters and one-time native swarm evidence submission.
- Exact onchain burn preview, conservative debits, contribution versus voluntary burn, point units and irreversible acknowledgment.
- Matured reward claims, checkpoint and fee redemption; simulation failure and actionable retry.
- Signing rejection, unresolved receipt recovery without a second send, and onchain revert presentation.
- Funding, router setting, distributor setting and activation as simulated unsigned preparation; no owner wallet send request is made. The downloaded file's sender and target are asserted.
- All nine screens at 320, 390, 768 and 1440 CSS pixels without horizontal overflow; native dialog focus containment, Escape and reduced-motion behavior.

WebKit also completes wallet connection, quote, both approvals, simulated swap, wallet request and confirmation at 390px. Its screenshot is `evidence/webkit-trade-mobile.png`. The browser fixture responses are the same declared synthetic test transport, not a physical wallet or native app session.

Live browser checks use the actual configured public RPCs without interception or an injected wallet. They visit all screens, validate local resources and JavaScript errors, and measure no overflow at 320/390/768/1440. At 390×844, the initial trade action is entirely within the first screen (the exact final bounding box is in `evidence/live-browser.json`). `evidence/live-trade-390.png` is the unmodified rendered page, with real protocol state. RPC methods observed are read-only: chain ID, code, eth_call and block number.

## Live state and owner preparation

At the dated observation in `evidence/live-chain.json`, the official pool is initialized, token binding and price references are valid, and trading is closed. The remaining migration capacity is 700m UNLK2 with zero backing. Universal Router registration is false and the swarm distributor is actually unset onchain. An observed zero setting is not a substitute deployment address; the application disables the affected feature and asks the owner to configure it.

The evidence includes complete unsigned transaction data for the actual owner to fund the discovered immutable vault, register the configured Universal Router and activate. Funding and router calls were successfully simulated with eth_call. Activation's call currently reverts because setup/funding is incomplete. The actual distributor is an owner-entered setting, with no guessed address or placeholder transaction. See `OWNER-SETUP.md`.

The configured deployed v4 quoter's `msgSender()` call reverts. Registering it as an authenticated router would break quoting. The source investigation and actual deployed-interface read are recorded separately; newer upstream code is not treated as deployed-code evidence. Before gate 10, a quoter sell may fail its own quota. The UI explains that limitation, offers an explicit user-set minimum and simulates the real Universal Router with the user's account after approvals. Trading remains disabled until the supported router is registered and activation is complete.

## Better Interface consolidated review

The six pinned domains were applied during implementation and reviewed together. The user's requested black monospace terminal direction is authoritative. No hero, chart, treasury or invented activity was added.

| Domain | Coverage | Evidence and limitations |
| --- | --- | --- |
| Accessibility | Checked | Native buttons, labels, progress, tables and dialogs; keyboard focus/escape, 320px reflow and reduced motion checked in Chromium; WebKit primary flow checked. No screen-reader, physical-device or browser-native 200% zoom session was performed. |
| Layout | Checked | Swap and wallet visible on first 390px screen; all nine screens checked at 320/390/768/1440. Long addresses wrap; no document overflow. Probe reports no overlaps, floating controls over text or hidden text. |
| Writing | Checked | Verb-first controls, persistent recovery text, irreversible burn/migration warnings, cap, dilution and external-pool limits. Missing owner setup is explicit. No investor-return promises or fabricated history. |
| Typography | Checked | One platform monospace stack, six declared sizes, three weights, 16px inputs, tabular data and wrapping. Actual platform font family can vary; no remote font-load claim. Monospace prose is the explicit brief override. |
| Colors | Checked | Semantic tokens and measured resolved solid text pairs pass the probe. Token calculations in `evidence/color-contrast.json` include text/surface 15.69:1, muted/surface 8.16:1 and button ink/mint 14.76:1. No claim about an unmeasured image/backdrop text pair. |
| UI | Checked | Flat thin-border surfaces, one filled primary action per task, neutral setup steps, visible disabled/loading/error/pending/success states, native focus management and bounded color transitions. No animation or autoplay requires a slow-motion review. |

## Findings, corrections and rechecks

| Severity | Source | Finding and correction | Recheck |
| --- | --- | --- | --- |
| High | `web/src/Trade.tsx:159`, `web/src/Screens.tsx:120` | Allowances originally depended only on block number, leaving a stale approval step after a same-block refresh. Reads now refresh with snapshot time; trade allowances are also bound to token/account. Approval clicks fetch fresh allowances before choosing the next step, avoiding a silent no-op during a background refresh. | Both buy and sell approval sequences pass, including post-receipt refresh. |
| High | `web/src/Trade.tsx:206`, `web/src/Founder.tsx:210` | Actual deployed quoter cannot supply compatible msgSender. Removed the proposed quoter registration; exposed a clearly labeled custom-minimum sell path with real-router simulation. | Deployed read recorded; failed-quote/custom-minimum interaction passes. |
| High | `web/src/transactions.tsx:54`, `web/src/transactions.tsx:238` | An unresolved receipt must not turn into a duplicate action. The state retains the hash, locks new actions and offers receipt recheck. Closing a pending review keeps a visible status/reopen control. Reverts and cancellations have distinct outcome text. | Pending lock, rejected signing, failed receipt read, recovery without resubmission and onchain revert are exercised. |
| Medium | `web/src/Trade.tsx:151` | A late quote or allowance response could outlive an input/account change. Request sequence guards discard stale results and execution checks token/account/snapshot identity. | Browser primary flow and separate-token approvals pass; code review confirms invalidation dependencies. |
| Medium | `web/src/App.tsx:84` | Before the first snapshot the status could briefly imply trading was closed. It now says Reading chain until actual state exists. | Live screenshots wait for actual closed state and contain real supply/price/gate reads. |
| Medium | `web/src/components.tsx:4` | Floating-number formatting could lose large integer precision or show tiny nonzero rates as zero. BigInt/string formatting preserves integer precision and labels subprecision values with a less-than threshold. | Live low-price display inspected in the final 390px screenshot. |
| Medium | `web/src/Founder.tsx:179`, `web/src/Screens.tsx:533` | Setup peers and optional transfers competed with the main action. Setup steps and optional transfer now use neutral secondary treatment. | Owner and rights screens inspected; shared styling reviewed. |
| Exception | `web/src/App.tsx:130` (desktop navigation) | The probe classifies the active “Trade” navigation link above the “Trade” page heading as a kicker. It is conventional primary navigation, not a content eyebrow. Retained and documented as a false positive. | Screenshot confirms the navigation/heading relationship. |
| Brief override | `web/src/style.css:20` | The probe discourages monospace prose. The brief explicitly requires “monospace text” in a dark terminal. Retained deliberately. | One family and three weights measured; no unrequested redesign. |

The exact probe output is preserved in `evidence/design-probe.json`. It passes rendering, layout, targets, contrast, casing, tracking, size count, glyphs, slogans, repetition, first-screen copy budget, surface treatment, motion and sharing metadata. The two exceptions above are not silently counted as mechanical passes.

## Remaining verification limits

No real wallet signature, funded buy/sell, approval, burn, migration, reward claim, founder transaction or activation was broadcast. The live application is intentionally pre-activation. Test transports cover those UI transitions; production simulation remains the gate before every visitor wallet request. ETH costs, MEV, real liquidity/partial fills, downstream router implementation behavior and post-activation economics remain live-chain concerns, not proven by fixtures.

Physical wallet-app deep-link handoff, Coinbase passkey account creation, real extension installations, native iOS/Android accessibility, a screen reader and native browser zoom were not exercised. The mobile link destinations and SDK wiring are provided; a phone user-agent test checks the actual four link URLs, local marks and passkey entry, while app handoff remains a physical-device check. Social image, title, description and favicon are included; absolute OG URLs await the publisher's actual host/domain, so the export intentionally uses relative metadata assets.

Root `DESIGN.md` is outside the overriding permitted paths. The implemented design record is delivered at `docs/DESIGN.md`; no protected root file was created. The publisher subsequently hosts the export. No site URL, CID or independent publication verification is fabricated here.
