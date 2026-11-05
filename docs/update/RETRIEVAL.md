# Corrected source retrieval

Retrieved on 2026-11-05 using HTTPS GET with `curl -fL`. All three requested locations returned successfully:

- [Corrected source archive](https://the-imd-daily.duckdns.org/unlock-v2-setup/source.zip): 686,461 bytes; SHA-256 `366251b21d8ca4885c6d25b7aecb4d185bde41b8683004dcf423ea2b068689d1`.
- [Working corrected preview](https://the-imd-daily.duckdns.org/unlock-v2-preview/): HTML retrieved, SHA-256 `30d9e02bbf423a2f1db5fbc59091d0386ef85ed95727a6915f2ae621edf1e6eb`.
- [Existing public URL](https://unlock-v2.imd.site/): HTML retrieved, SHA-256 `d003b35c9c6fa2bf85ebd2ee1b223a7f30b60cf68fc74af4d224ce6257dca9ac` at the initial check.

The web browsing tool could not open the preview, but direct HTTPS retrieval succeeded. There was no source retrieval blocker.

Merged the reviewed `repair-config.json`, corrected `Screens.tsx` (including the cold-load gate-10 voluntary-burn fix), and corrected test fixtures before applying this redesign. The setup screen was transformed into read-only integration status: no registration, funding or activation action remains. Tests were updated for the new interface. The archive's `verified-installation.json` is retained as `reviewed-installation.json`; its runtime hashes are independently checked by `web/scripts/verify-update.mjs`.

The archive's contract, dependency and Foundry configuration changes were not applied: this is a website-only assignment and the existing build configuration/dependencies are protected. The original deployed token/hook sources and implementation ABIs remain unchanged. The frontend uses the supplied reviewed installed adapter/quoter addresses and hashes, not a local deployment. Existing authentic claim proofs remain in `test/fixtures/native-mainnet-claim.json` and are exercised by the Node proof tests.

The source ZIP, extracted dependency tree, browser packages and scratch installations are intentionally not included in the submission. Required existing offline compiler/runtime assets remain intact.
