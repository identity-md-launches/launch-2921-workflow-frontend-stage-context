# Publication handoff

The current export includes the focused composition/focus/label revision. See [REVISION.md](REVISION.md) for final results and screenshots.

Target: **https://unlock-v2.imd.site/**, retaining the existing `unlock-v2.identitymd.eth` site identity. Parent job: `38c6908b-83e2-4a77-8d65-4fa6c24660d6`; supplied completed source commit: `e71f51d9cb2424955a224c1f97d4aad9f295585a`.

`dist/index.html` and all inventoried runtime assets are ready. `web/site/` is an identical mirror. Existing frontend package manifest/lockfile, contract sources, ABI bindings, economic parameters, wallet identity and fixed swap routes remain.

The worker cannot create a Git commit or publish: the assignment prohibits touching `.git/` and there is no publishing connector. No credentials were sought and no publishing command was run. The existing HTTPS site was checked read-only; it serves an older 17-asset export and does **not** match this delivery. No new-public-build verification is claimed.

The existing submission service must commit this source/export bundle and publish **root `dist/`** under the same site identity. Do not deploy contracts or activate trading. After publication:

```sh
node web/scripts/check-public-update.mjs
node web/tests/public-browser.mjs
```

The read-only comparison must report `matchesDeliveredExport: true`, `matchesDeliveredConfig: true` and matching hashes for every public asset. Recheck the public site at 390px and 1440px, all hash routes and wallet connection. Until then, publication/post-publication verification is incomplete.

Older-gate burn history can also remain unavailable with the two pinned public RPCs. `gate-history-rpc-limit.json` records the actual responses. This does not prevent the rest of the site, current/future-gate display or transaction guards from functioning. No unavailable history or publication outcome was fabricated.
