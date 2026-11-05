# UNLOCK V2 frontend

The current website targets **https://unlock-v2.imd.site/**. Source lives here; the publisher serves repository-root `dist/`. `site/` is an identical export mirror.

See the [root README](../README.md) for installation, preview, rebuilding, route constraints and checks; [DESIGN.md](../DESIGN.md) for the implemented interface; and [current validation](../docs/update/VALIDATION.md) for actual results and publication limits.

`npm ci`, `npm run typecheck`, `npm run build:vite`, and `npm run preview` provide normal development. The default `npm run build` is the retained integrity-checked offline Linux x64 source build; it does not typecheck. Both build paths regenerate root `dist/` with relative assets and verified ABI/asset manifests. Existing manifests, lockfiles and dependencies are unchanged.

`public/repair-config.json` now contains the supplied **reviewed installed adapter and WalletQuoter**, with their actual hashes. Runtime bindings, registrations, pool IDs and remaining migration backing are checked onchain. The integration screen is read-only. Completed setup is distinct from the hook's `activated()` status, which is refreshed automatically.

`tests/browser.mjs` invokes the current synthetic production-export suite. `tests/fork-browser.mjs` separately exercises actual pools and installed contracts through the production interface on a locally managed Anvil fork. Neither broadcasts to mainnet. Test dependencies and caches belong outside the submitted source.
