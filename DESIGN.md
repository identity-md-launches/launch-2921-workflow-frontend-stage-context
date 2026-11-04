# UNLOCK V2 design system

## Overview

An Ethereum trading and gate-contribution terminal for existing UNLK2 holders and the protocol owner. The V1 reference informs a compact, flat black terminal: monospace information, charcoal panels, gray structural borders and restrained mint/cyan/amber. No marketing hero, green page background, V1 market values, NFT treasury or Labs section is present.

The homepage places a status strip above a large left chart and a compact right swap. A direct contribution link leads to the full active-gate panel on the same page. Migration, rights, burn points, rewards, contracts and owner setup retain dedicated hash-navigation screens.

## Colors

Canonical tokens are in `web/src/style.css:1`.

| Token | Value | Job |
|---|---|---|
| `--bg` | `#000` | Page and inputs |
| `--surface` | `#0b0b0b` | Charcoal panels |
| `--hover` | `#181818` | Hover/selected neutral fill |
| `--text` | `#e5e5e5` | Primary text |
| `--muted` | `#aaa` | Secondary labels and units |
| `--border` | `#333` | Thin structural borders |
| `--mint` | `#a5f3ce` | Primary action, active navigation |
| `--cyan` | `#91d7e5` | Links and focus |
| `--amber` | `#efc47d` | Pending/current states and burn warnings |
| `--error` | `#ffb0a8` | Action errors |
| `--ink` | `#050505` | Text on filled mint actions |

Charts and the status strip use `#050505`; chart steps/candles use `#83dcb9`, the initial-buy line `#8ddce6`, current gate `#efc47d`, future gates `#333`. State labels accompany color. Hovered primary actions use `#c6f9e1`. There is one permanent dark scheme; no theme toggle. Measured rendered foreground/background samples and focus properties are in `artifacts/design-measurements.json`; the probe found no failing measured text contrast pair. This does not claim all possible wallet/embedded chart states were measured.

## Typography

One system monospace stack: `SFMono-Regular`, Consolas, Liberation Mono, monospace. No downloaded font or font CDN. The actual platform fallback may differ; no particular installed font is guaranteed.

Six CSS roles, all rem-based at a 16px root: `--sm` 13px, `--body` 14px, `--input` 16px, `--sub` 18px, `--heading` 24px and `--amount` 28px. Weights 400/600/700; tabular numbers throughout. SVG axis artwork uses 12 user units within its viewBox; the equivalent native selector/detail/table text uses the normal scale. Long text is capped at 76ch. Body line-height is 1.6; headings use 1.3–1.5. Brand/headings use slight negative tracking, with natural body tracking. Inputs stay 16px on phones to avoid iOS input zoom.

Addresses and exact reviewed amounts wrap and remain selectable. Burn previews display full 18-decimal precision instead of hiding significant digits. Compact market summaries truncate decimals only for display and do not determine transactions.

## Layout

Shared content max-width is 1440px. Desktop header/main horizontal padding is 32px, decreasing to 24px below 1100px and 16px on phones. Typical spacing is 8/12/16/20/24px; controls have at least 44px height unless explicitly compact, separated controls use 36px. Panels have 20px padding, 16px on phones.

`Dashboard.tsx` uses `.dashboard-grid`: flexible chart plus a 360px swap, narrowing the swap to 320px below 1050px. At 800px the grid becomes a vertical flex layout, with the swap first. Explicit grid placement is cleared inside this dashboard so no implicit mobile column can appear. The two-column active-gate overview/contribution panel also stacks at 800px. Native gate selectors are ten across on desktop and five across on small screens, each at least 44px high on phones.

At 760px the desktop nav becomes a native screen select, header utilities reduce to the wallet control, status rows stack, and the strip shows price and gates while supply/volume remain available in the dedicated screens. Slippage stays beside its input. Secondary explanations use native disclosures; primary costs, warnings, pending installation and actions stay visible. The wallet modal becomes a bottom sheet.

Rendered verification covered 320, 390, 768 and 1440 CSS pixels, all hash screens and the first 390px viewport with live state. Initial and stale RPC errors were checked separately. Native 200% browser zoom, physical phones and WebKit remain unverified; viewport emulation does not prove those.

## Elevation & depth

Flat structural 1px borders, without decorative shadows. The selected segmented control uses an inset underline, not elevation. The active-gate panel has a 2px mint top rule. Black chart interiors distinguish plots from charcoal panels. Native modal dialogs use the top layer and dark backdrops. Home contribution content has no redundant inner panel borders.

## Shapes

Controls and fields use 2px radii. Panels and chart plots are square. Mobile wallet sheet uses 4px top corners. Focus-visible uses a 2px cyan outline with 4px offset; forced-colors mode uses the system Highlight color. Motion is restricted to 120ms color/border/background changes when reduced motion is not requested; no endless animations exist.

## Components

- `components.tsx`: `Action` handles wallet connection, chain mismatch, verified/stale data, busy and reason states. Primary actions are mint-filled; `secondary` is neutral. `Field` binds labels and input IDs. `Progress` shows actual/target/percent/remaining and explicit unavailable states, including accessible value text when the target is unknown. `AddressLink`, `Stat`, `Alert` and native `Dialog` are shared.
- `wallet.tsx`: EIP-6963 discovery, browser-wallet fallback, mobile deep links and Coinbase Smart Wallet behind one connection dialog. Native modal focus/escape behavior was checked with Chromium. Errors stay in the dialog; there is no QR relay path.
- `Charts.tsx`: `GateChart` plots ten real threshold steps on logarithmic FDV x / percentage y axes. Visual markers are clickable and have tooltips; equivalent native buttons provide comfortable keyboard/touch access and selected state. Details/table include all three OR triggers. Offline threshold data is immutable source data, explicitly labelled; live gate states stay Unread until verified. `Charts` tabs support arrows/Home/End with associated tabpanel semantics.
- `MarketChart` uses the bundled Lightweight Charts runtime for genuine official-pool logs. A fixed 340px `.market-canvas` keeps auto-sizing independent of the crosshair readout. Timeframes, USD/IMD units, volume, crosshair, pan/zoom, source/window/update time, missing-price/no-trades/error and retry states are retained. Production has no sample candles.
- `Trade.tsx`: automatic caller-bound quotes, exact approvals, fees, slippage, 45-second expiry and pending-installation disclosure. `GateProgress` separates indicative, historical processed and pending FDV; stored gate state alone determines openings.
- `Screens.tsx` / `burn-preview.ts`: balance/capacity capped contributions, coherent block previews, exact conservative origin debits and points, current-gate allowance plus gate-opening preview, irreversible acknowledgement and revalidation of credits/target before signing. Max is disabled until the wallet balance is known. Voluntary burning does not advance gates.
- `Founder.tsx`: current owner checklist with reviewed-runtime/binding checks, separate actions and unsigned export. Stale checks are Unavailable. Activation is disabled. The screen never invents installation addresses.

## Do's and don'ts

Start an added protocol screen with `Panel`, `Field`, `Action` and the existing context/hash navigation. Reuse role tokens and the six type sizes. Keep amounts, units, chain, irreversible effects and recovery steps next to controls. Give new data the same loading/unavailable/stale/error treatment.

Do not compute gate openings from spot prices, invent history or zero-valued price fallbacks, hide required setup behind fake success states, combine owner setup transactions, or turn a gate contribution into `burn(amount)`. Do not add a hero, background tint, glow, animated ticker, extra font or extra type scale. Source and runtime verification determine transaction availability; color and layout never do.

Design guidance attribution and preserved licenses: `docs/frontend/NOTICE.md`, `BETTER-INTERFACE-LICENSE`, and `WALLET-MARKS-LICENSE`. The consolidated six-domain findings/rechecks are in `artifacts/validation.md`.
