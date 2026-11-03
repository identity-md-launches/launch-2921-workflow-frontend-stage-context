# UNLOCK V2 implemented design

## Overview

A compact Ethereum trading terminal for UNLK2 holders, migrators, burn contributors and the founder. The requested visual idea is a black, monospace workspace with thin rules, a permanent gate ladder and a practical swap panel. There is no marketing hero, fabricated chart, NFT treasury or Labs surface. The primary task and wallet control remain visible on the first 390px screen.

Source: `web/src/style.css`, `App.tsx`, `components.tsx`, `Trade.tsx`, `Screens.tsx`, `Founder.tsx`, `wallet.tsx` and `transactions.tsx`. This document lives under `docs/` because the assignment's overriding write scope does not allow a root `DESIGN.md`.

## Colors

CSS semantic tokens in `web/src/style.css` are the source of truth:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#050807` | Near-black page and fields |
| `--surface` | `#0a0f0d` | Protocol panels and dialogs |
| `--hover` | `#121c17` | Selected controls and hover surfaces |
| `--text` | `#e0eae4` | Primary text |
| `--muted` | `#9aada2` | Labels and supporting text |
| `--border` | `#2d4136` | Thin structural rules |
| `--mint` | `#a5f3ce` | Primary action, active selection, open gate markers |
| `--cyan` | `#91d7e5` | Links and keyboard focus |
| `--amber` | `#efc47d` | Warnings, closed or unknown conditions |
| `--error` | `#ffb0a8` | Action errors |
| `--ink` | `#05130c` | Text on the mint action |

Status always includes text or a symbol in addition to color. Mint action hover uses `#c6f9e1`. Dialog backdrops use black at 80% opacity. No gradient or glow is used. Rendered contrast measurements and limits are in the validation record; the pinned probe checks resolved solid backgrounds.

## Typography

One platform monospace stack: `SFMono-Regular`, Consolas, `Liberation Mono`, monospace. No font download or remote font dependency. Actual platform font selection varies; a computed first family is not evidence that SFMono is installed.

Six size tokens: `--sm` 13px, `--body` 14px, `--input` 16px, `--sub` 18px, `--heading` 24px, `--amount` 28px. Body is 400, section headings and action buttons 600, page headings 700. The main heading is the heaviest type. Body line-height is 1.6, headings 1.3–1.4; no tracked capital kickers. Inputs stay at 16px on phones. Long prose is capped at 76ch, numeric values use tabular figures, and addresses wrap rather than clipping. Amount formatting preserves integer precision and marks tiny nonzero values with a less-than threshold instead of falsely showing zero.

## Layout

The main workspace is at most 1440px wide; desktop inline padding is 40px. Navigation has a 1360px maximum. Repeated spacing is 8, 12, 16, 20 and 24px, with 28px top and 48px bottom desktop workspace padding. Panels use 24px padding. The trade grid puts the ladder on the left and the swap panel on the right, with a 24px gutter. The swap is first in DOM order and moves above the ladder on mobile.

At 1100px and below, outer padding becomes 24px and panels 20px. At 760px and below, panels and outer padding become 16px, grids become one column, and the desktop link row becomes a labeled native screen selector. The mobile market strip keeps price and gate state prominent; supply and volume remain on the dedicated protocol screens. No horizontally scrolling tab strip is required. Tables use fixed layout and wrapping; long numeric counters and full addresses remain readable at 320px. The exact minimum output is available in the review and its value tooltip.

Production-export measurements cover 320, 390, 768 and 1440px. The 390px main-action bounding box and screenshots are recorded in `docs/frontend/evidence/`. A narrow viewport does not claim a physical device or native zoom test.

## Elevation & Depth

The interface is deliberately flat: 1px borders and small tonal changes group protocol data. There are no panel shadows or nested cards. The segmented control has only a 2px inset active underline. Native dialogs sit above an inert browser-managed background with an 80% black backdrop.

## Shapes

Buttons, fields and selectors use 2px corners; dialogs use 3px. The phone wallet sheet uses 4px top corners and aligns to the bottom edge. Progress bars and ladder segments are square. The small Ethereum indicator is round. No pill taxonomy or decorative chrome is used.

## Components

- `Action` and `ContractAction` (`components.tsx`) choose connection, network prerequisite, disabled and transaction states. One filled mint action identifies the main operation; secondary actions have a neutral border. Normal controls are at least 44px; compact Refresh and Copy controls are 36px, above the 24px accessibility baseline.
- `Field` binds labels and optional hint IDs to inputs; decimal inputs request a decimal keyboard. Native checkboxes acknowledge irreversible actions. `Alert` provides persistent, actionable errors and warnings.
- `Stat`, `UsdValue`, `Progress` and `GateProgress` present real contract state with units and explicitly unavailable states. USD values use only the onchain reference and are labeled as reference values. `progress` has an accessible label and textual amounts.
- `AddressLink` exposes the complete checksummed address or an explicit contract label, explorer destination and copy control. Values wrap at narrow widths.
- `Panel`, `.two-col`, `.trade-grid`, `.metrics` and `.form-grid` provide shared layouts. Heading levels remain semantic; the protocol ladder uses compact aligned rows.
- `WalletDialog` uses native `dialog` for focus trapping, Escape, backdrop close and focus restoration. EIP-6963 provider marks, pending rows, phone wallet-browser links, connection errors and disconnect are visible.
- The transaction review (`transactions.tsx`) shows the amount and effect, target, network, method, ETH value and gas estimate. Simulation precedes the wallet step; the receipt phase locks repeats. Founder variants download unsigned JSON. Irreversible actions require a separate checkbox.

Keyboard focus uses a 2px cyan perimeter with a 4px offset, and forced-colors mode preserves a system highlight. Motion is limited to 120ms color/background/border transitions under `prefers-reduced-motion: no-preference`. There is no autoplay or endless motion.

## Do's and Don'ts

Start a new protocol screen from `Panel` and the existing grid classes. Use `Field` for inputs, `Action` for wallet prerequisites and the shared transaction review for contract writes. Obtain deployment data only from the runtime configuration and verified live contract state. Keep consequential explanations next to the relevant control.

Keep long values selectable and wrap them; never hide overflow to conceal an address or balance. Use the same color roles, six-size scale and three weights. Preserve monospace because it is explicit in the brief. Do not add a hero, synthetic price chart, fake history, new wallet relay, alternate address map, or a UI that bypasses simulation or irreversible-action acknowledgment.
