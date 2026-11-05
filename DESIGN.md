# UNLOCK V2 design system

## Overview

UNLOCK V2 is an Ethereum trading and rights dashboard. The supplied design reference defines its ancient-tech portals, emerald energy, gold current gate and final vault, near-black surfaces and serif headings. The interface uses six original, separately optimized artwork assets; labels, progress, balances, forms, charts and confirmations remain live HTML. No full-page mockup is used as the interface.

The homepage starts with the ten clickable gates and the selected gate’s three independent conditions. It follows with the official market and swap panel, two illustrated previews, and the complete contribution form. Secondary screens use the same navigation, metallic frames, typography and form components. Ordinary chain data is never replaced by the reference’s example balances or candles.

Source of truth: `web/src/style.css` (base styles and final ancient-tech layer), `web/public/design-assets.css` (local font faces), `web/src/GateDoors.tsx`, `web/src/ArtPanels.tsx` and `web/src/EnergyCore.tsx`.

## Colors

| Token | Implemented value | Role |
| --- | --- | --- |
| `--bg` | `#050807` | Page background |
| `--surface` | `#09100e` | Base surfaces and dialogs |
| `--hover` | `#14251e` | Neutral hover/selected surfaces |
| `--text` | `#f2f1e6` | Primary off-white text |
| `--muted` | `#a9b9b1` | Secondary copy and labels |
| `--border` | `#35453b` | Fields and internal separators |
| `--metal` | `#8b8364` | Outer metallic frames |
| `--mint` | `#54edb3` | Emerald progress and confirmed/open state |
| `--cyan` | `#8fe4dc` | Links and price context |
| `--amber` | `#ecd08c` | Current gate, vault and irreversible-action notices |
| `--error` | `#ffb0a8` | Errors |
| `--ink` | `#04110b` | Text on the skip-link background |

The focus ring uses `#b9fff2`. Actions use an off-white foreground over the restrained emerald gradient `#164d36 → #08301f → #0a2319`; hover is `#115638`. Panels use `#0b1510 → #060b09`, thin metallic frames and inset frame lines. The core’s own backing is `#08110c`; preview art uses `#060e0a` to integrate the generated image’s black edges.

Color is redundant with text: each portal says Open, Current, Locked or Unread. Current is gold; open is broken and emerald; future is dim emerald. Read failure is not a locked gate. The validation report distinguishes measured solid contrast from unmeasured art/gradient backgrounds; it does not claim a full contrast certification.

## Typography

All fonts are local, normal-style static weights **400 and 600**, declared with `font-display: swap`. Files and full SIL Open Font Licenses are in `web/public/fonts/`; `PROVENANCE.md` records source URLs and SHA-256 hashes.

- **Cinzel**, with Georgia/serif fallback: brand, h1/h2, selected-gate heading and the illustrated preview headings.
- **Manrope**, with system-ui/sans-serif fallback: body copy, buttons, navigation and explanations.
- **IBM Plex Mono**, with Consolas/monospace fallback: labels, numbers, inputs, statistics, progress, account data, addresses and chart axes.

The six size tokens are `--sm: .8125rem` (13px), `--body: .875rem` (14px), `--input: 1rem` (16px), `--sub: 1.125rem` (18px), `--heading: 1.5rem` (24px), and `--amount: 1.75rem` (28px). Body line height is 1.6; headings use 1.3–1.4. Desktop page headings use 28px, mobile 24px. Main panel headings use 24px; compact mobile art headings use 18px. Inputs/selects remain at least 16px. Strong/bold text uses the bundled 600 face, with no synthetic 700 weight.

Numbers use tabular figures. Explanatory paragraphs retain a 76ch maximum measure. Addresses and diagnostic strings wrap. Wide threshold tables scroll within their own labeled content area, not the page.

## Layout

The content maximum width is 1600px. Desktop main padding is 20px 28px (the Trade screen uses 4px top padding above 1250px); mobile is 14px 14px 30px. Compact desktop control gaps are 3–6px; common content gaps are 8, 12, 14, 16, 18, 20 and 24px. Fields and data groups retain spacing from the existing application.

- Above 1250px: compact single-row brand, primary navigation, More menu and wallet utilities.
- 761–1250px: desktop navigation wraps below the brand/utilities.
- At 760px and below: a native route selector replaces desktop navigation; the brand and wallet action stay at the top.
- Ten portals use ten columns on desktop and five columns/two rows on mobile. There is no horizontally hidden gate carousel.
- Gate progress uses three independent columns on desktop and three stacked bars on mobile. The FDV/observation explanation is a labeled disclosure; amounts and remaining values stay visible.
- The dashboard uses `minmax(0,1fr) minmax(340px,.45fr)` with an 18px gap (14px above 1250px). Below 1050px the swap column is 330px. At 800px and below, the swap precedes the chart in a single column.
- Above 1250px, Trade uses a horizontal gate summary: gate/status at the left, three independent progress columns in the center, and contribution/accounting controls at the right. Current, target and remaining amounts stay visible; only the duplicate remaining percentage is omitted. Expanded accounting and errors grow in normal flow.
- The compact desktop chart/swap panels use 10px 16px padding. Swap heading/tabs, amount/balance/input, and route/slippage share rows; shortcut/USD explanations remain in the existing route disclosure. Inputs stay editable, the fixed route stays visible, and quote minimum/fees and transaction reviews are retained. The desktop chart canvas is 190px high; the honest empty chart has a 180px minimum. Mobile chart heights and touch controls retain their existing overrides.
- Two illustrated previews are side by side above 800px and stacked below. Above 1250px their energy scenes are 205px high, with 14px between previews. The complete contribution form follows them. At 1440×1000 with verified closed trading, the summary is about 78px high, chart/swap begins at y≈360 and the previews at y≈698; both previews end before y=941.
- Shared `.two-col` sections stack at 760px. Secondary content never depends on a fixed page height.

The original redesign rendered all nine routes at 390px and 1440px in Chromium and WebKit. Current revision coverage and limitations are recorded in `docs/redesign/REVISION.md`. The probe and existing interaction suite also check homepage reflow at 320px, with the interaction suite checking 768px. Physical devices and native browser zoom are unverified.

## Elevation & Depth

Detailed carved portals and machinery provide depth. Thin structural borders, small metallic corner accents, controlled inset frames and modest surface gradients support them. Large generic glow fields are avoided. The More menu and native dialogs have elevated shadows; ordinary information panels stay visually quiet.

The core has a faint ambient opacity pulse. Particles and the stronger core flash are finite and appear only after a matching successful burn receipt. There is no optimistic gate-opening or burn-success animation. `prefers-reduced-motion: reduce` removes all animations, transitions and animated scrolling.

## Shapes

Panels and art previews use asymmetric `10px 3px 10px 3px` corners. Buttons use 5px, fields 4px, dialogs 8px. Portals are detailed raster artwork with live circular number markers and rectangular percentage plates. They are not rectangular CSS doors.

The selected portal has a structural border. Focus uses a separate 2px outline with a 3px offset. Portal hit areas include artwork and labels. Mobile wallet, route selector and Refresh controls are at least 44px high; compact chart/percentage controls retain appropriate spacing.

## Components

| Component / source | Use and states |
| --- | --- |
| `App.tsx` | Existing hash routes, header, More menu, native mobile navigation, chain/error status, route focus and skip-to-content. Skip moves focus without changing the hash. Escape closes More. |
| `GateDoors.tsx` | Exactly ten portals on Home and Gates; stored Open/Current/Locked/Unread states; selection and three separate progress bars; verified future-gate zero, current storage counter, complete event totals for past gates or explicit history error/retry. |
| `gate-history.ts` | Read-only token Contributed scan, fixed snapshot block and bounded nonoverlapping ranges. Any failed range rejects the total; it never supplies a partial amount. |
| `components.tsx` | Shared Panel, Field, Stat, Progress, Alert, Action, AddressLink and native transaction Dialog. Action retains wallet/network/verification/staleness guards. Progress shows current, target, remaining and a separately computed percentage. |
| `focus.ts` | Tab/Shift+Tab wrapping for wallet and transaction dialogs. Native dialogs retain inert background, Escape and focus return. |
| `Trade.tsx` | Existing quote/approval/swap logic with visible fixed route and honest shortcut invalidation feedback. No transaction calldata or economic changes. |
| `Charts.tsx` | Genuine official-pool candles/volume; existing timeframes, price unit, crosshair and accessible data table. Closed, empty, loading, invalid USD, stale and RPC-error states remain distinct. Methodology is disclosed below the chart. |
| `EnergyCore.tsx` | Separate emerald and gold art variants, ambient illumination and confirmation-only finite burn flow. Decorative images have empty alt text. |
| `ArtPanels.tsx` | Live burn/points/share and Golden Vault previews. The primary preview scrolls and focuses `#active-gate`, so the next Tab enters the amount field. Its verified gate-ten state says “Burn for points”; earlier gates say “Contribute UNLK2”. |
| `Screens.tsx` | Existing migration, rights/claim/transfer, burn, weekly rewards, vault and rules controls. Rights now explicitly separates matured/pending/other credits, balance, sales and allowance. Weekly fee share is labeled conditional, with no promised yield. |
| `Founder.tsx` | Retained read-only integration/setup verification. There are no activation, registration or funding transaction controls. |

## Do’s and Don’ts

Start a new screen with the existing page heading and Panel/Stat/Field/Action primitives. Use the existing hash route convention. Keep wallet and transaction review behavior in the existing shared components. Pick emerald for progression and gold for the collecting gate/final vault; retain words and shapes alongside color.

Never average the three gate conditions. Never infer stored gate openings from indicative FDV. Never fill a chart with illustrative candles, infer historical USD from a present price, present a partial log scan as complete, or substitute a missing balance. Retain separate explanatory text for current spot context and historical processed observations.

Reuse the optimized artwork and local fonts. Add text and controls as HTML overlays. Do not flatten screens to screenshots or add new pools, aggregators, minting, activation or owner transactions. For the actual limits of the live RPCs, public publication and manual accessibility coverage, consult `docs/redesign/VALIDATION.md`.
