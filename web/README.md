# UNLOCK V2 frontend

Source for the continuation at https://unlock-v2.identitymd.eth.limo. See [the root README](../README.md) for installation, preview, build, validation and owner-package commands, and [DESIGN.md](../DESIGN.md) for the implemented design.

`npm ci` installs the unchanged pinned development dependencies. `npm run typecheck` checks TypeScript. `npm run build:vite` uses Vite with relative assets and calls the export script. `npm run build` is the retained compact offline Linux x64 build (Node 22.18+ and xz); it bundles source but does not typecheck. Both replace **../dist/** and **site/** with identical complete exports. `npm run preview` serves the production output; `npm run dev` edits source after a first build.

`npm test` runs independently specified Node fixtures. `npm run test:browser` serves ../dist/ under /preview/ and uses explicitly synthetic RPC/wallet fixtures with Chromium; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an available browser. No real transaction is sent. The live, read-only script is `node scripts/render-live.mjs`, after installing Playwright. Current measured results and limitations are in [artifacts/validation.md](../artifacts/validation.md).

`public/contract-runtime.json` pins verified runtime code; source runtime, ABI and auxiliary package comparisons are reproducible with `scripts/runtime-inventory.mjs` after a Foundry build. `public/repair-config.json` keeps auxiliary installation null/pending; actual reviewed deployments are required. No stock-quoter or custom-minimum fallback exists. Canonical allocation corpus recovery, owner funding/configuration and activation remain outstanding. No existing deployed contract or V1 behavior is changed.
