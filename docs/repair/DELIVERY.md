# Continuation delivery

The updated static hosting root is **repository-root `dist/`**. `web/site/` is an identical build mirror. The production build regenerates both, including source-derived ABI hashes, asset integrity inventory, verified contract runtimes, pending auxiliary configuration, favicon and share image. Source and the existing unchanged manifest/lockfile remain under `web/`.

Existing site identity: **unlock-v2.identitymd.eth**, https://unlock-v2.identitymd.eth.limo. Existing frontend/source repository: https://github.com/identity-md-launches/launch-2921-workflow-frontend-stage-context. The original deployed-contract source commit is unchanged. No new identity, repository, remote source commit or IPFS CID is invented.

This worker prepared the continuation bundle for the assignment's delivery service. It did not run a separate site publisher or write Git metadata. The delivery service must commit the supplied source/export to the existing repository and publish `dist/` as the next version under the existing identity. These service operations are **pending**, not claimed complete by local builds.

Auxiliary sources and compiler ABI/bytecode packages remain in `src/auxiliary/` and `docs/repair/package/`; read-only owner scripts are `script/PrepareRepair.s.sol`, `web/scripts/prepare-repair.mjs`, `native-proofs.mjs` and `runtime-inventory.mjs`. Current unsigned owner actions are in `docs/repair/owner-plan.json`. No activation calldata is generated. Both auxiliary installation records remain null/pending in the website.

Owner work still required: complete canonical native allocation corpus, constructor/root/unique-account rehearsal, auxiliary deployment and runtime/immutable review, installation-specific proof/quote regression, separate router/quoter/adapter configuration, reserve funding and eventual external activation review. No deployment, registration, funding, migration or activation transaction was broadcast by this worker. Local/fork fixture setup is explicitly off-chain.

Current validation and finding-to-fix table: `artifacts/validation.md`. Design: root `DESIGN.md`. Full interfaces and installation prerequisites: `docs/repair-integration.md`. No original V1 or deployed V2 source/economics was changed.
