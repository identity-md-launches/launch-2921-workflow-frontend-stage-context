# Owner setup — repaired integration, pending installation

The previous direct-native-distributor and custom-minimum instructions were incompatible with the deployed contracts and are superseded.

Use [the exact integration/setup guide](../repair-integration.md), [measured validation](../repair/VALIDATION.md), and [delivery status](../repair/DELIVERY.md). The owner screen now provides separately reviewed/simulated wallet actions plus unsigned Safe exports. Activation is disabled. No mainnet deployment, funding, registration or activation was performed by this repair.

* NativeSwarmAdapter must verify the **complete canonical native allocation corpus** and unique accounts in its constructor, then verify a native amount proof plus actual claimed state during atomic sync. The native round distributor must never be registered directly.
* WalletQuoter authenticates its caller and executes the real PoolManager simulation. Register it and the verified Universal Router before sealing. Never register the incompatible stock V4Quoter or use a manual minimum as a quotation workaround.
* The 700m migration reserve remains unfunded at the recorded live checkpoint. Fund only the rechecked deficit in an explicit owner transaction. Existing allocations, gates, separate origin credits, prior-sales accounting and weekly rewards are unchanged.
* Do not reuse old activation calldata or mistake historical evidence for current authorization. The new read-only owner generator emits **no activation calldata** and withholds adapter creation without the full canonical corpus.

Regenerate read-only preparation from the repository root:

```
node web/scripts/prepare-repair.mjs
# Only with the authentic complete corpus:
node web/scripts/prepare-repair.mjs canonical-allocations.json docs/repair/owner-plan-with-corpus.json
```

Generated files are unsigned review artifacts, not executable batches. Review deployed code/immutables and simulate each step after preceding owner receipts. No configuration can be repaired after permanent sealing.
