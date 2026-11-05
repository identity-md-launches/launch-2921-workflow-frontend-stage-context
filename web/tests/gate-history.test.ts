import test from "node:test";
import assert from "node:assert/strict";
import { GATE_HISTORY_START, loadGateBurn } from "../src/gate-history.ts";
import type { Runtime } from "../src/config.ts";
import { readFileSync } from "node:fs";
const deployment = JSON.parse(readFileSync(new URL("../../docs/frontend/deployment-handoff.json", import.meta.url), "utf8"));
const address = deployment.contracts.find((c: { name: string }) => c.name === "UnlockV2Token").address;
function runtime(getLogs: (q: any) => Promise<any>): Runtime {
  return { addresses: { UnlockV2Token: address }, client: { getLogs } } as unknown as Runtime;
}
test("Gate history uses the pinned deployment, selected gate, snapshot and nonoverlapping complete ranges", async () => {
  const requests: any[] = [];
  const value = await loadGateBurn(runtime(async q => {
    requests.push(q);
    return [
      { removed: false, args: { gate: 3, amount: 7n } },
      { removed: true, args: { gate: 3, amount: 20n } },
      { removed: false, args: { gate: 2, amount: 99n } },
    ];
  }), 3, GATE_HISTORY_START + 4050n);
  assert.equal(value, 21n);
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map(q => [q.fromBlock,q.toBlock]), [
    [GATE_HISTORY_START,GATE_HISTORY_START+1999n],
    [GATE_HISTORY_START+2000n,GATE_HISTORY_START+3999n],
    [GATE_HISTORY_START+4000n,GATE_HISTORY_START+4050n],
  ]);
  for (const q of requests) { assert.equal(q.address,address); assert.deepEqual(q.args,{gate:3}); assert.equal(q.strict,true); }
});
test("A failed history chunk rejects the whole read instead of reporting a partial total", async () => {
  let calls=0;
  await assert.rejects(loadGateBurn(runtime(async()=>{
    if (++calls===2) throw Error("Synthetic RPC outage");
    return [{removed:false,args:{gate:1,amount:12n}}];
  }),1,GATE_HISTORY_START+3000n),/Synthetic RPC outage/);
  assert.equal(calls,2);
});
test("A fully fetched empty history is zero; invalid gate and pre-deployment snapshots fail", async () => {
  const r=runtime(async()=>[]);
  assert.equal(await loadGateBurn(r,10,GATE_HISTORY_START),0n);
  await assert.rejects(loadGateBurn(r,0,GATE_HISTORY_START),/1 to 10/);
  await assert.rejects(loadGateBurn(r,1,GATE_HISTORY_START-1n),/predates/);
});
