# Publication handoff

Target: **https://unlock-v2.imd.site/** under the existing **unlock-v2.identitymd.eth** identity. Publish repository-root **`dist/`** through the existing submission/website service. This is a continuation of the existing frontend; no contract/token deployment or activation is involved.

The source handoff’s base commit is **`6a2c438c6962d3e798cafbfc0f9248e1d8b34788`**. All four base/replacement hashes matched before applying. [Integrity report](build-integrity.json) records the final frontend source digest and the export build identifier. Existing package manifests/lockfile and required offline assets are retained.

Delivered build identifier (SHA-256 of `dist/imd-deployment.json`):

```text
9bc4d312032147f78a087a7207f6c00bc65211e9e25900f56f4313e926d93de6
```

This worker has no publication tool, and `.git/` writes are prohibited by the assignment. Therefore the submission service must create the source commit and publish the prepared export. No new commit, publishing action or new-build-public confirmation is claimed.

The public HTTP comparison found all six WebP images and six fonts present, correctly typed and byte-identical to this export. It also found that the public manifest/index and expected application assets differ, so the updated application is **not yet confirmed public**. [Actual results](public-url.json). A public asset-loading pass on the existing build is not proof of this update’s publication.

After publication, run:

```sh
node web/scripts/check-ui-fixes-public.mjs
```

Require `matchesDeliveredExport: true`, `allExpectedAssetsMatch: true` and `allArtworkAndFontsLoad: true`. The verifier compares the manifest and every expected file, including new hashed JavaScript/CSS, instead of accepting an HTTP 200 alone.

Then use functioning browser tooling to inspect all nine public hash routes at desktop/mobile widths, wallet-dialog behavior, contribution navigation, chart resizing with quote states, images/fonts, overflow and the 390px first screen. Local rendered checks could not run because browser processes failed; [browser limitations](browser-limitations.json) records the actual failures. The supplied handoff’s own measurements were not treated as this worker’s verification.
