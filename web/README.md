# UNLOCK V2 frontend

The source continues the existing UNLOCK V2 website at **https://unlock-v2.imd.site/**. Repository-root `dist/` is the static publication artifact; `web/site/` is its identical build mirror. Current publication status is recorded in [the root README](../README.md) and [PUBLISH.md](../docs/redesign/PUBLISH.md).

Normal workflow: `npm ci`, `npm run typecheck`, `npm run build:vite`, `npm run preview`. The retained default `npm run build` uses the integrity-checked offline source builder; run a separate typecheck. Both production paths regenerate ABI/asset inventories and the root export, with relative URLs.

Do not change deployed addresses, ABIs, wallet identity, pool routing or economics for a visual update. Transaction behavior remains in the existing core/config/integration/transaction modules. This redesign adds separate local art/fonts, shared visual styling, accessible focus handling and read-only historical gate display. Historical RPC failures remain explicitly unavailable.

See [DESIGN.md](../DESIGN.md), [ASSETS.md](../docs/redesign/ASSETS.md), and [current validation](../docs/redesign/VALIDATION.md). No node_modules, browser binaries or caches belong in the source submission.
