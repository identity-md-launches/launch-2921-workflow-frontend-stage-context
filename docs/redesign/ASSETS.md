# Artwork, fonts and provenance

The approved reference was retrieved successfully from:

https://the-imd-daily.duckdns.org/unlock-v2-preview/unlock-v2-design-reference.png

Its SHA-256 is recorded in `web/public/art/provenance.json`. It served as visual direction. The reference PNG and its sample balances/candles are not runtime assets and are not submitted as an interface.

Six original assets were generated specifically for this assignment using OpenAI image generation: matching locked/current/broken-open ancient-tech portals, an emerald burn reactor, a golden vault and a gold/emerald hexagonal lock brand mark. A six-panel generated atlas was split into independent tiles and encoded as optimized WebP. No artistic state was synthesized by CSS rectangular doors. The production interface chooses artwork from verified state and renders labels, progress, forms and confirmations in HTML.

| Asset | Runtime source | Use |
| --- | --- | --- |
| Locked portal | `web/public/art/portal-locked.webp` | Dim future gates; unread state is separately labeled |
| Current portal | `web/public/art/portal-current.webp` | Gold collecting gate |
| Broken-open portal | `web/public/art/portal-open.webp` | Permanently opened gates |
| Emerald energy core | `web/public/art/burn-core.webp` | Burn screen, homepage preview and contribution form |
| Golden Vault | `web/public/art/golden-vault.webp` | Vault screen and homepage preview |
| Brand mark | `web/public/art/brand-mark.webp` | Header and favicon |

The atlas is not needed at runtime and remains only in disposable scratch. The shipped `provenance.json` includes its hash, the reference hash, each optimized image’s dimensions/bytes/hash, base job and packaging method. `LICENSE.txt` records the generated-art origin and a CC0 dedication to the extent the contributor holds applicable rights; `CC0-1.0.txt` contains the full legal text. No exclusivity, human authorship or trademark clearance is asserted.

Cinzel 400/600, Manrope 400/600 and IBM Plex Mono 400/600 are bundled locally in `web/public/fonts/`. `PROVENANCE.md` records each Google Fonts download URL and SHA-256. Each family’s original copyright notice and full SIL Open Font License are local. No external font or image service is contacted by visitors.

The 1200×630 share image is rendered by `web/scripts/redesign-og.mjs` using those same local assets and fonts, then PNG-optimized. It is a data-free branding composition and is not a page screenshot used as UI.

Existing TradingView Lightweight Charts attribution/license, wallet marks and offline-runtime licenses remain in their original source paths. Better Interface guidance and documentation attribution are retained in `docs/frontend/NOTICE.md`; the exact pinned combined guide license is also copied to `docs/redesign/BETTER-INTERFACE-LICENSE`.

Browser screenshots in `evidence/` are real captures of the built export. `mock-*` uses explicitly synthetic RPC/wallet fixtures, `fork-*` uses actual contracts/pools on an isolated local fork, and `live-*` uses real read-only mainnet RPC. The optimization script applies lossy WebP encoding with unchanged dimensions and visible content; `evidence/optimization.json` records input/output sizes. These are worker evidence, not independent certification.
