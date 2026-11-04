import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAllocations, verify } from "../scripts/native-proofs.mjs";
const live = JSON.parse(
  await readFile(
    new URL("../../test/fixtures/native-mainnet-claim.json", import.meta.url),
    "utf8",
  ),
);
test("Authentic mainnet native double-hash proof verifies exactly the paid amount", () => {
  assert.ok(verify(live.account, live.amount, live.proof, live.root));
  assert.ok(
    !verify(live.account, BigInt(live.amount) + 1n, live.proof, live.root),
  );
  assert.ok(!verify(live.account, live.amount, live.proof.slice(1), live.root));
  assert.ok(
    !verify(
      "0x0000000000000000000000000000000000000001",
      live.amount,
      live.proof,
      live.root,
    ),
  );
});
test("Whole-tree proof generation: uneven, sorted, unique and reproducible", () => {
  const list = [1, 2, 3, 4, 5].map((n) => ({
    account: `0x${n.toString(16).padStart(40, "0")}`,
    amount: String(n * 123),
  }));
  const a = buildAllocations(list),
    b = buildAllocations([...list].reverse());
  assert.deepEqual(a, b);
  for (const p of a.proofs)
    assert.ok(verify(p.account, p.amount, p.proof, a.root));
  assert.throws(
    () => buildAllocations([...list, { ...list[0], amount: "99" }]),
    /duplicate/,
  );
  assert.throws(
    () => buildAllocations([{ ...list[0], amount: "0" }]),
    /invalid/,
  );
});
