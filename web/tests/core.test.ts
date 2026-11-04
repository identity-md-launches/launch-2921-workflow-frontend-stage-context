import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeAbiParameters,
  decodeFunctionData,
  parseAbiParameters,
} from "viem";
import {
  amount,
  minimumOut,
  swapData,
  routerAbi,
  POOL_COMPONENTS,
  errorText,
  type PoolKey,
} from "../src/core.ts";
const key: PoolKey = {
  currency0: "0x1111111111111111111111111111111111111111",
  currency1: "0x2222222222222222222222222222222222222222",
  fee: 12500,
  tickSpacing: 60,
  hooks: "0x3333333333333333333333333333333333333333",
};
test("amount parsing rejects exponent, negative, commas, zero and excessive precision", () => {
  for (const v of ["-1", "0", "1e3", "1,000", "NaN", ".1", "1.0000001"])
    assert.throws(() => amount(v, 6));
  assert.equal(amount("1.25", 6), 1250000n);
  assert.equal(amount("0.000000000000000001"), 1n);
});
test("slippage minimum floors safely and rejects unsafe tolerance", () => {
  assert.equal(minimumOut(999n, "0.50"), 994n);
  for (const s of ["0", "-1", "5.01", "abc", "1.111", "1e0"])
    assert.throws(() => minimumOut(100n, s));
});
for (const extended of [false, true])
  test(`Universal Router payload, reversed currencies, extended=${extended}`, () => {
    const data = swapData(key, key.currency1, 100n, 70n, 999n, extended);
    const call = decodeFunctionData({ abi: routerAbi, data });
    assert.equal(call.functionName, "execute");
    assert.equal(call.args[0], "0x10");
    assert.equal(call.args[2], 999n);
    const [actions, params] = decodeAbiParameters(
      parseAbiParameters("bytes,bytes[]"),
      call.args[1][0],
    );
    assert.equal(actions, "0x060c0f");
    assert.equal(params.length, 3);
    const tuple = {
      type: "tuple",
      components: [
        { name: "poolKey", type: "tuple", components: POOL_COMPONENTS },
        { name: "zeroForOne", type: "bool" },
        { name: "amountIn", type: "uint128" },
        { name: "amountOutMinimum", type: "uint128" },
        ...(extended ? [{ name: "minHopPriceX36", type: "uint256" }] : []),
        { name: "hookData", type: "bytes" },
      ],
    } as const;
    const [p] = decodeAbiParameters([tuple], params[0]);
    assert.equal(p.zeroForOne, false);
    assert.equal(p.poolKey.hooks, key.hooks);
    assert.equal(p.amountIn, 100n);
    assert.equal(p.amountOutMinimum, 70n);
    if (extended) assert.equal(p.minHopPriceX36, 0n);
    assert.deepEqual(
      decodeAbiParameters(parseAbiParameters("address,uint256"), params[1]),
      [key.currency1, 100n],
    );
    assert.deepEqual(
      decodeAbiParameters(parseAbiParameters("address,uint256"), params[2]),
      [key.currency0, 70n],
    );
  });
test("contract and wallet failures have actionable messages", () => {
  assert.match(errorText({ code: 4001 }), /declined/);
  assert.match(errorText(new Error("StaleGate")), /gate changed/);
  assert.match(errorText(new Error("SellExceedsAllowance")), /sell exceeds/);
});

import { candles } from "../src/market.ts";
test("Market OHLC uses real observed trades, preserves gaps and sorts chronology", () => {
  assert.deepEqual(
    candles(
      [
        { time: 125, imdPerToken: 3, imdVolume: 7, usdPerImd: 2 },
        { time: 61, imdPerToken: 2, imdVolume: 5, usdPerImd: 4 },
        { time: 65, imdPerToken: 1, imdVolume: 2, usdPerImd: 4 },
        { time: 310, imdPerToken: 4, imdVolume: 9, usdPerImd: 2 },
      ],
      60,
      "IMD",
    ),
    [
      { time: 60, open: 2, high: 2, low: 1, close: 1, volume: 7 },
      { time: 120, open: 3, high: 3, low: 3, close: 3, volume: 7 },
      { time: 300, open: 4, high: 4, low: 4, close: 4, volume: 9 },
    ],
  );
  assert.deepEqual(
    candles(
      [{ time: 61, imdPerToken: 2, imdVolume: 5, usdPerImd: 4 }],
      60,
      "USD",
    ),
    [{ time: 60, open: 8, high: 8, low: 8, close: 8, volume: 20 }],
  );
  assert.throws(
    () => candles([{ time: 1, imdPerToken: 2, imdVolume: 5 }], 60, "USD"),
    /Historical USD reference unavailable/,
  );
  assert.deepEqual(candles([], 60, "USD"), []);
});
import "./dashboard.test.ts";
