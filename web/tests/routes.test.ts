import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeFunctionData,
  decodeAbiParameters,
  parseAbiParameters,
  zeroAddress,
  type Address,
} from "viem";
import {
  assertRouteKeys,
  ethSwapData,
  poolId,
  referenceKey,
} from "../src/eth-route.ts";
import { POOL_COMPONENTS, routerAbi, type PoolKey } from "../src/core.ts";
import {
  portion,
  sellable,
  gasReserve,
  spendableEth,
} from "../src/shortcuts.ts";
const token = "0xbd769d71d535030e47b0a024b8edae4a923d7819" as Address,
  imd = "0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7" as Address,
  hook = "0x4f811b89ef9a19800101705262681f715ac668cc" as Address;
const buyer = "0x48e4e74fe1d0c14404ceb57b9fec5b21329c6ec9" as Address;
const key: PoolKey = {
  currency0: token,
  currency1: imd,
  fee: 12500,
  tickSpacing: 60,
  hooks: hook,
};
test("Only the hook's official key and pinned native reference key can be used", () => {
  assert.equal(
    poolId(key),
    "0xb97e547a02a8c4d8374725d6c01fff1337f97e36ca37c25f34a8ddc04933a4be",
  );
  assert.equal(
    poolId(referenceKey(imd)),
    "0xb07d640fd9e2eb9dc81b953c8e4fd006bdfeaf276010fb5418eb763ca15abfb3",
  );
  assert.doesNotThrow(() =>
    assertRouteKeys(
      key,
      poolId(key),
      poolId(referenceKey(imd)),
      imd,
      token,
      hook,
    ),
  );
  for (const bad of [
    { ...key, fee: 3000 },
    { ...key, hooks: zeroAddress },
    { ...key, tickSpacing: 200 },
  ])
    assert.throws(() =>
      assertRouteKeys(
        bad,
        poolId(bad),
        poolId(referenceKey(imd)),
        imd,
        token,
        hook,
      ),
    );
  assert.throws(() =>
    assertRouteKeys(
      key,
      poolId(referenceKey(imd)),
      poolId(referenceKey(imd)),
      imd,
      token,
      hook,
    ),
  );
});
test("Native router plan is one atomic unlock with two strict swaps, exact settlement and buyer refund", () => {
  const data = ethSwapData(key, imd, token, buyer, 123n, 456n, 999n);
  const decoded = decodeFunctionData({ abi: routerAbi, data });
  const [commands, inputs, deadline] = decoded.args!;
  assert.equal(commands, "0x1004");
  assert.equal(deadline, 999n);
  assert.equal(inputs.length, 2);
  const [actions, params] = decodeAbiParameters(
    parseAbiParameters("bytes,bytes[]"),
    inputs[0],
  );
  assert.equal(actions, "0x06060b0f");
  assert.equal(params.length, 4);
  const single = [
    {
      type: "tuple",
      components: [
        { name: "poolKey", type: "tuple", components: POOL_COMPONENTS },
        { name: "zeroForOne", type: "bool" },
        { name: "amountIn", type: "uint128" },
        { name: "amountOutMinimum", type: "uint128" },
        { name: "hookData", type: "bytes" },
      ],
    },
  ] as const;
  const [first] = decodeAbiParameters(single, params[0]),
    [second] = decodeAbiParameters(single, params[1]);
  assert.equal(poolId(first.poolKey), poolId(referenceKey(imd)));
  assert.equal(first.amountIn, 123n);
  assert.equal(first.zeroForOne, true);
  assert.equal(poolId(second.poolKey), poolId(key));
  assert.equal(second.amountIn, 0n);
  assert.equal(second.amountOutMinimum, 456n);
  assert.equal(second.zeroForOne, false);
  assert.deepEqual(
    decodeAbiParameters(parseAbiParameters("address,uint256,bool"), params[2]),
    [zeroAddress, 123n, false],
  );
  const [output, min] = decodeAbiParameters(
    parseAbiParameters("address,uint256"),
    params[3],
  );
  assert.equal(output.toLowerCase(), token);
  assert.equal(min, 456n);
  const [currency, recipient, refundMin] = decodeAbiParameters(
    parseAbiParameters("address,address,uint256"),
    inputs[1],
  );
  assert.equal(currency, zeroAddress);
  assert.equal(recipient.toLowerCase(), buyer);
  assert.equal(refundMin, 0n);
});
test("Shortcuts floor base units and cap sells to CURRENT allowance, including gate-ten max", () => {
  assert.equal(portion(7n, 20), 1n);
  assert.equal(portion(7n, 50), 3n);
  assert.equal(portion(7n, 75), 5n);
  assert.equal(portion(7n, 100), 7n);
  assert.equal(
    portion(1234567890123456789012345n, 75),
    925925917592592591759258n,
  );
  assert.equal(sellable(1000n, 23n), 23n);
  assert.equal(sellable(5n, 2n ** 256n - 1n), 5n);
  assert.equal(gasReserve(100n, 10n), 1500n);
  assert.equal(spendableEth(2000n, 1500n), 500n);
  assert.equal(spendableEth(100n, 1500n), 0n);
  assert.throws(() => portion(10n, 33));
  assert.throws(() => ethSwapData(key, imd, token, buyer, 0n, 1n, 99n));
});

test("Full-route simulation rejects partial fills, wrong pools, missing buyer credit and unavailable RPC", async () => {
  const { readFile } = await import("node:fs/promises");
  const {
    encodeAbiParameters,
    encodeEventTopics,
    encodeFunctionResult,
    parseAbi,
    toHex,
  } = await import("viem");
  const { quoteEthRoute } = await import("../src/eth-route.ts");
  const hookAbi = JSON.parse(
    await readFile(
      new URL("../../docs/abi/UnlockV2Hook.json", import.meta.url),
      "utf8",
    ),
  );
  const erc20 = (await import("../src/core.ts")).erc20Abi;
  const router = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
  const events = parseAbi([
    "event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)",
    "event HookFeeCollected(uint256 amount,bool isSell)",
    "event PartialFillRefunded(address indexed trader,uint256 requested,uint256 executed,uint256 refund)",
  ]);
  const manager = "0x000000000004444c5dc75cb358380d2e3de08a90";
  const simSwap = (id: `0x${string}`, a: bigint, b: bigint) => ({
    address: manager,
    data: encodeAbiParameters(
      parseAbiParameters("int128,int128,uint160,uint128,int24,uint24"),
      [a, b, 1n, 1n, 0, 10000],
    ),
    topics: encodeEventTopics({
      abi: events,
      eventName: "Swap",
      args: { id, sender: router },
    }),
  });
  const before = {
    buyCredited: 0n,
    buySold: 0n,
    otherCredited: 0n,
    otherSold: 0n,
    pendingBuy: 0n,
    pendingBlock: 0n,
  };
  async function run(
    change: {
      partialFirst?: boolean;
      partialSecond?: boolean;
      refund?: boolean;
      wrongPool?: boolean;
      missingCredit?: boolean;
      rpcError?: boolean;
      reverted?: boolean;
    } = {},
  ) {
    const call = (returnData: `0x${string}`, logs: unknown[] = []) => ({
      status: "0x1",
      returnData,
      logs,
      gasUsed: "0x10000",
    });
    const logs: unknown[] = [
      simSwap(
        poolId(referenceKey(imd)),
        change.partialFirst ? -9n : -10n,
        1000n,
      ),
      simSwap(
        change.wrongPool ? poolId(referenceKey(token)) : poolId(key),
        100n,
        change.partialSecond ? -900n : -990n,
      ),
      {
        address: hook,
        topics: encodeEventTopics({
          abi: events,
          eventName: "HookFeeCollected",
        }),
        data: encodeAbiParameters(parseAbiParameters("uint256,bool"), [
          10n,
          false,
        ]),
      },
    ];
    if (change.refund)
      logs.push({
        address: hook,
        topics: encodeEventTopics({
          abi: events,
          eventName: "PartialFillRefunded",
          args: { trader: buyer },
        }),
        data: encodeAbiParameters(
          parseAbiParameters("uint256,uint256,uint256"),
          [1000n, 990n, 1n],
        ),
      });
    const calls = [
      call(
        encodeFunctionResult({
          abi: erc20,
          functionName: "balanceOf",
          result: 0n,
        }),
      ),
      call(
        encodeFunctionResult({
          abi: hookAbi,
          functionName: "rightsOf",
          result: before,
        }),
      ),
      call("0x", logs),
      call(
        encodeFunctionResult({
          abi: erc20,
          functionName: "balanceOf",
          result: 100n,
        }),
      ),
      call(
        encodeFunctionResult({
          abi: hookAbi,
          functionName: "rightsOf",
          result: {
            ...before,
            pendingBuy: change.missingCredit ? 99n : 100n,
            pendingBlock: 11n,
          },
        }),
      ),
    ];
    if (change.reverted) calls[2].status = "0x0";
    const client = {
      getBlockNumber: async () => 10n,
      estimateGas: async () => 200000n,
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === "officialPoolId") return poolId(key);
        if (functionName === "referencePoolId")
          return poolId(referenceKey(imd));
        if (["activated", "isRouter"].includes(functionName)) return true;
        throw Error("Unexpected read " + functionName);
      },
      request: async (q: any) => {
        assert.equal(q.method, "eth_simulateV1");
        assert.equal(q.params[0].blockStateCalls[0].stateOverrides, undefined);
        assert.equal(q.params[0].blockStateCalls[0].calls[2].from, buyer);
        if (change.rpcError) throw Error("Unavailable");
        return [{ calls }];
      },
    };
    return quoteEthRoute(
      {
        client,
        addresses: { UnlockV2Token: token, UnlockV2Hook: hook },
        abis: { UnlockV2Hook: hookAbi },
        d: {
          network: {
            pairToken: { address: imd },
            uniswapV4: { universalRouter: router, poolManager: manager },
          },
        },
      } as any,
      key,
      buyer,
      10n,
    );
  }
  const q = await run();
  assert.equal(q.out, 100n);
  assert.equal(q.fee, 10n);
  assert.equal(q.gas, 200000n);
  for (const change of [
    { partialFirst: true },
    { partialSecond: true },
    { refund: true },
    { wrongPool: true },
    { missingCredit: true },
    { rpcError: true },
    { reverted: true },
  ])
    await assert.rejects(() => run(change));
});
