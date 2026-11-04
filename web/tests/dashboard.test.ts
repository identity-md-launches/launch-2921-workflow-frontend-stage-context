import { test } from "node:test";
import assert from "node:assert/strict";
import { maxUint256 } from "viem";
import { GATE_THRESHOLDS, gateState } from "../src/gate-data.ts";
import { allowanceAfterOpening } from "../src/burn-preview.ts";
import { candles } from "../src/market.ts";

test("The offline staircase uses all ten deployed thresholds, never optimistic openings", () => {
  assert.deepEqual(GATE_THRESHOLDS.map(row => row[0]), [25,30,35,40,50,60,70,80,90,100]);
  assert.deepEqual(GATE_THRESHOLDS.map(row => row[1] / 10n**18n), [250000n,500000n,1000000n,2000000n,3500000n,5000000n,8000000n,12000000n,18000000n,25000000n]);
  assert.deepEqual(GATE_THRESHOLDS.map(row => row[2] / 10n**18n), [125000n,375000n,750000n,1500000n,2500000n,4000000n,6000000n,9000000n,12500000n,20000000n]);
  assert.deepEqual(GATE_THRESHOLDS.map(row => row[3] / 10n**18n), [25000000n,22000000n,19000000n,16000000n,13000000n,10000000n,8000000n,6000000n,4000000n,2000000n]);
  assert.equal(gateState(1, 0), "Current");
  assert.equal(gateState(2, 0), "Future");
  assert.equal(gateState(1, 1), "Opened");
  assert.equal(gateState(1, undefined), "Unread");
  assert.equal(gateState(1, 10, true), "Unread");
});

test("Full-gate contribution preview preserves previous sales, maturity, floors and gate-ten bypass", () => {
  // Independent integer fixture: 1000 credited buys, 100 sold; 400 other, 20 sold.
  const r = {buyCredited:1000n,buySold:100n,otherCredited:400n,otherSold:20n,pendingBuy:80n,pendingBlock:50n};
  // At block 50, pending buys are debited first (40), no mature credits are consumed.
  assert.equal(allowanceAfterOpening(r,[40n,0n,0n,0n,0n],1,25,50n), 230n);
  // At block 51 all pending buys mature; 40 is debited from mature credits.
  assert.equal(allowanceAfterOpening(r,[0n,40n,0n,0n,0n],1,25,51n), 240n);
  assert.equal(allowanceAfterOpening({...r,buySold:999n,otherSold:399n},[0n,1n,0n,0n,0n],1,25,51n),0n);
  assert.equal(allowanceAfterOpening(r,[0n,40n,0n,0n,0n],10,100,51n),maxUint256);
  assert.equal(allowanceAfterOpening({...r,buyCredited:7n,buySold:0n,otherCredited:0n,otherSold:0n,pendingBuy:0n},[0n,0n,0n],1,25,51n),1n);
});

test("USD history rejects invalid historical rates and never substitutes a current price", () => {
  for (const rate of [undefined, 0, -1, NaN, Infinity]) {
    assert.throws(() => candles([{time:100, imdPerToken:2, imdVolume:3, usdPerImd:rate}],60,"USD"));
  }
  assert.deepEqual(candles([],60,"USD"),[]);
  assert.throws(() => candles([],0,"USD"));
  assert.throws(() => candles([{time:100, imdPerToken:0, imdVolume:3}],60,"IMD"));
});
