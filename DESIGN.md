# UNLOCK V2 design system

## Overview

UNLOCK V2 is an Ethereum trading and gate-progress dashboard. Its primary visual is a compact hallway of **ten dimensional doors**, followed by the market and swap workspace. Near-black surfaces, crisp system typography, emerald/cyan utilities and restrained gold distinguish permanent progress from trading and rewards. This continuation preserves the original U mark, favicon, share image and wallet marks; doors and energy/vault artwork are original CSS/SVG, with no stock imagery or remote asset dependency.

Source of truth: `web/src/style.css`, `GateDoors.tsx`, `EnergyCore.tsx`, `Dashboard.tsx`, `Trade.tsx`, `Screens.tsx`, and the shared components. The last `:root` palette/font declaration in the stylesheet overrides the older baseline declaration. This document describes the final values, not the historical monochrome terminal.

## Colors

| Token | Implemented value | Use |
| --- | --- | --- |
| `--bg` | `#060b0a` | Page and recessed inputs |
| `--surface` | `#0b1211` | Panels, dialogs, empty chart surface |
| `--hover` | `#14221e` | Hover/selected neutral controls |
| `--text` | `#eef6f2` | Main text and headings |
| `--muted` | `#a5b7b0` | Explanations, labels and source metadata |
| `--border` | `#2b3c35` | Panel/input structure and separators |
| `--mint` | `#79e5b2` | Primary actions, opened doors and burn core |
| `--cyan` | `#8edce5` | Links, chart price and keyboard focus |
| `--amber` | `#f2ca7a` | Current gate, gold vault and cautions |
| `--error` | `#ffb0a8` | Action failures |
| `--ink` | `#06110c` | Text on emerald primary actions |

The body adds a restrained dark-green radial glow; door art uses local dark/gold/emerald tones. Status always has text as well as color (`Open`, `Current`, `Locked`, `Unread`). Progress remains three independent labeled bars. Solid rendered contrast checks and gradient limitations are reported in the validation document; palette declarations alone do not establish rendered contrast.

## Typography

The final font stack is `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. It intentionally uses the platform's UI font; no font download is required. Addresses and code use `SFMono-Regular, Consolas, monospace`. Installed platform fonts and actual glyph shapes can differ by OS.

Six existing size tokens remain: `--sm: .8125rem` (13px), `--body: .875rem` (14px), `--input: 1rem` (16px), `--sub: 1.125rem` (18px), `--heading: 1.5rem` (24px), and `--amount: 1.75rem` (28px). Dense trading labels use 13/14px; editable amounts use 28px; other inputs are 16px. Desktop H1 is 28px, mobile H1 24px, H2 18px and H3 16px. The mobile navigation select is 16px to avoid input zoom.

Weights are 400, 600 and 700. Body line-height is 1.6; H1 1.3, H2 1.4 and H3 1.5. Large headings use `-.03em` tracking; prose is naturally spaced. The root enables tabular digits and font smoothing. Long paragraphs cap at 76ch. Addresses and large amounts wrap instead of truncating essential values.

## Layout

Shared content/header width is at most 1440px; navigation at most 1360px. Desktop main padding is 32px, mobile 16px. Most panels use 20–24px padding (18px for mobile swap/burn). Control groups use 4–12px gaps; section/panel separation is generally 16–32px.

`GateDoors` uses ten equal columns on desktop. At 760px and below it becomes five columns by two rows, retaining all ten doors without horizontal scrolling. Door artwork shrinks from a 128px scene to 76px; text containers remain content-sized. The current door and contribution link lead the first phone screen. Clicking or pressing Enter/Space on a door reveals its FDV, cumulative volume and gate-specific burn details. The numerical ladder remains on the Gates screen.

`Dashboard` places the chart on the left and a 340–390px swap panel on the right, with a 24px gap. The swap has `position: sticky; top: 18px`. At 760px and below, swap comes first, chart second, then the homepage burn form. Intermediate desktop widths reduce gaps and door art. The chart canvas is 440px high, with volume below the candles in the same chart. Sparse history keeps a 40-bar logical viewport and a 110px minimum price axis; empty space is not filled with invented candles. Empty/error states retain a large readable area.

Other screens reuse `.two-col`, `.metrics`, `.panel` and `.compact-dl`. Mobile stacks columns. Tables use wrapping cells rather than silently clipping values. Hash navigation requires no server rewrites. The wallet sheet is bottom-aligned on phones and centered on larger screens. Viewports 320, 390, 768 and 1440 are included in browser validation; native device/zoom limitations are listed there.

## Elevation & depth

Application panels use a single border and tonal surface, without a decorative shadow. Native dialogs use an 80% black backdrop and browser-managed modal focus. Selected controls use background/border/text changes.

Doors are the deliberate exception: their decorative frames use perspective, extruded dark shadows and a border to create the dimensional artwork requested by the brief. Open leaves are rotated and jagged; the current door has restrained gold illumination; locked doors remain solid and dark. This illustration treatment is not a reusable card shadow.

The energy core and gold vault use an inline radial glow and a wireframe platform. They do not pulse on page load. Token flow and core flash run once, for 1.8 seconds, **only after a successful receipt containing the exact token/from/zero-recipient/amount burn log**. The visual state clears after 2.4 seconds while the confirmation text remains. Failed/cancelled/unrelated replacements never start it. Reduced motion removes animation and transitions; success still has text.

## Shapes

Controls/inputs generally use 8px radii; panels 12px; segmented child buttons 6px. Wallet dialogs retain the established 3–4px/bottom-sheet shape. Chart bars, table separators and progress tracks are flat. Native targets are at least 24px with spacing; most buttons are 44px tall, compact shortcuts 36px. Doors have a larger full-scene hit target. Every interactive focus indicator is 2px cyan with a 4px offset.

## Components

| Component/source | Purpose and states |
| --- | --- |
| `GateDoors.tsx` / `.gate-door` | Ten native buttons. Stored gate state determines open/current/locked; unavailable reads remain unread. `aria-pressed`, full names and visible percentages support keyboard/touch. Separate progress and a status message reflect FDV/volume/burn openings without a false burn success. |
| `Trade.tsx` | Buy/sell and IMD/ETH selection, manual amount, four shortcuts, legible output/price/fees/slippage/minimum. Loading, expiry, rejection, unsupported full-route simulation and insufficient quota/funds are explicit. Errors are announced and connected to the input. Relevant state/account/network changes invalidate quotes. |
| `Charts.tsx` / `MarketChart` | Real timestamped official-pool candles and volume, unit/timeframe controls, crosshair/pan/zoom, source/time/window labels, and a native disclosure with a keyboard-readable table of the latest 30 observed candles. Missing history, archive USD, stale state and RPC failure remain honest. No sample candles or empty-interval synthesis. |
| `EnergyCore.tsx` | Decorative `gold` and `confirmed` props. Original SVG uses `currentColor`; state text carries meaning. No transaction logic or success trigger lives in the visual itself. |
| `Screens.tsx` / `Burn`, `Golden`, `VaultSummary` | Irreversible burn preview with separate token, point and estimated-share values. Gate 10 derives voluntary mode even on cold loads. Gold summary separates accrued IMD, claimable/maturing rewards, personal points and weekly timing. |
| `components.tsx` | `Panel`, `Stat`, `Field`, `Progress`, `Alert`, `Action`, `ContractAction`, `AddressLink`, `Dialog`. Labels and native controls are reused. `Action` connects/switches or disables with a reason; writes always enter review/simulation. `Dialog` has an accessible title and native modal focus/escape behavior. |
| `wallet.tsx` / `WalletDialog` | EIP-6963 names/icons, browser fallback, wallet-browser mobile links and Coinbase Smart Wallet. Per-row pending/error states, disconnect, network switch, Escape/backdrop/close and focus return. Existing connector stack is retained. |
| `Founder.tsx` / `Founder` | Read-only integration status, live backing/capacity, registrations, activation state and reviewed addresses. The historical export name is retained; setup/activation controls are removed. |

## Do's and don'ts

Reuse `.panel`, `.two-col`, `Stat`, `Field` and `Action` for another screen; add the screen to the existing hash navigation and keep transaction construction behind the shared review/simulation flow. Preserve all three gate conditions independently. Read live states and label historical/estimated values. Use gold for the current gate/final vault and emerald for opened progress/burning.

Do not copy the doors' extrusion onto application cards, create decorative kicker text, fill missing prices with zero, fabricate candles, animate a pending/failed burn, promise returns, or add alternate pool routes. Do not add owner setup or activation actions to this website.

Guidance attribution and retained licenses: [docs/frontend/NOTICE.md](docs/frontend/NOTICE.md). Review coverage, observed corrections and unperformed checks belong in [docs/update/VALIDATION.md](docs/update/VALIDATION.md), not as claims of full accessibility certification here.
