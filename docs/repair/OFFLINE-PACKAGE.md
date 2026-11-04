# Upload-size repair and offline reproduction

The rejected submission carried a 28,897,044-byte generated npm registry cache. It has been removed. Contract source, deployment facts, auxiliary ABI/bytecode packages, fixtures, chart library, source dependency versions/lockfile, screenshots and the complete static export are retained. No deployed contract, owner configuration, accounting or frontend transaction logic was changed by this packaging repair.

The replacement under `web/vendor/offline/` contains only the dependencies needed to rebuild the site and run the Node component/proof tests: production ESM bundles of React 19.2.0, React DOM 19.2.0, viem 2.38.5, Coinbase Wallet SDK 4.3.7, and one compressed esbuild 0.25.12 Linux x64 compiler. Transitive dependency versions and license notices are recorded in `manifest.json` and `LICENSES.txt`. The pinned compiler MIT license is also supplied. React is shared between the application, JSX runtime and React DOM; it is not duplicated in independent bundles.

The manifest binds the bundles to the existing npm lockfile and records file lengths, SHA-256 hashes and the uncompressed compiler hash/version. Build/test entrypoints verify these before use. This detects accidental drift; it is not a signature or an independent supply-chain audit. The complete registry cache, registry metadata and redundant package/source archives are unnecessary for these commands and are not delivered.

From the repository root, with **Node 22.18+**, Linux x64 and `xz` available:

```sh
sh web/scripts/offline-install.sh
npm --prefix web test
npm --prefix web run build
npm --prefix web run validate
npm --prefix web run check:bundle
```

`offline-install.sh` verifies the package; it no longer installs a registry cache. `test`, `build`, `validate` and their explicit `*:offline` counterparts do not install packages or need `node_modules`. Node runs the original component tests against the bundled viem implementation. `build` compiles the actual `web/src/main.tsx` source, copies `web/public/`, writes `web/site/`, verifies the pinned implementation ABIs and regenerates the asset inventory. It does not reuse precompiled application JS. The compiler is extracted into a temporary directory, checked, executed and removed. The output website needs no compiler, npm, xz, remote JavaScript CDN or paid API. Live Ethereum reads still require the configured RPCs.

Owner preparation also resolves its viem dependency from the committed bundle:

```sh
npm --prefix web run prepare:owner
```

The proof command's actual input format and owner prerequisites remain in `docs/repair-integration.md`; do not substitute a partial corpus or invented auxiliary addresses. Owner/live preparation intentionally needs RPC access and sends no transaction.

The compact build **transpiles and bundles; it does not typecheck**. Full developer tooling is still pinned in `web/package.json`/`package-lock.json`: after installing those dependencies, `npm --prefix web run typecheck`, `npm --prefix web run build:vite`, `npm --prefix web run dev` and `npm --prefix web run test:browser` remain available. That optional full toolchain, browser executables, other compiler platforms and package-manager caches are not in the compact offline package. Browser tests need an externally provisioned compatible Chromium and Playwright. They are distinct from the fully self-contained Node component checks. `web/scripts/vendor-offline.mjs` reproducibly regenerates the compact package from a full pinned npm installation and a local `xz` executable, without changing dependency versions.

## Checks for this repair

* Removed `web/node_modules` from module resolution, then passed all **8** original component/proof tests, rebuilt from source and validated all ABIs and asset hashes using only delivered files, Node and xz. See `evidence/offline-package-tests.txt`.
* Browser fixtures now explicitly set `en-US` so chart formatting does not inherit an invalid host POSIX locale. All **10** browser checks pass against the offline-built export.
* Full TypeScript check passed using the existing installed development tooling. This is separate from the compact offline build.
* Desktop/mobile browser checks are rerun against the regenerated offline export with explicitly synthetic wallet/RPC fixtures; no live wallet transaction or mainnet write is involved. See `evidence/browser-report.json` for the measured result.
* `evidence/bundle-size.json` records the conservative total size of every changed/new ordinary file relative to the delivered frontend baseline, including this documentation, dependencies and screenshots. The upload ceiling is 8,388,608 bytes. Deleted files count as zero. This conservative total counts full modified files, rather than just their changed bytes.

The prior live/fork/contract results are preserved as historical evidence; this packaging-only repair does not claim new fork or live-chain results. Pending adapter installation/full canonical corpus and authenticated publication limitations remain unchanged in `DELIVERY.md` and `repair-integration.md`.
