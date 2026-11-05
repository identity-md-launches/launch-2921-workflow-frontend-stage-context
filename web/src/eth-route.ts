import {
  decodeEventLog,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiParameters,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import type { Runtime } from "./config";
import {
  POOL_COMPONENTS,
  erc20Abi,
  minimumOut,
  routerAbi,
  same,
  type PoolKey,
} from "./core.ts";

export const ETH_ROUTE_VERIFIED = true; // Set only after the committed actual-pool buyer-credit fork suite passes.
export const poolId = (key: PoolKey) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "tuple", components: POOL_COMPONENTS }],
      [key],
    ),
  );
export const referenceKey = (imd: Address): PoolKey => ({
  currency0: zeroAddress,
  currency1: imd,
  fee: 10000,
  tickSpacing: 200,
  hooks: zeroAddress,
});
export function assertRouteKeys(
  official: PoolKey,
  officialId: Hex,
  referenceId: Hex,
  imd: Address,
  token: Address,
  hook: Address,
) {
  if (
    !same(official.hooks, hook) ||
    official.fee !== 12500 ||
    official.tickSpacing !== 60 ||
    ![official.currency0, official.currency1].some((a) => same(a, imd)) ||
    ![official.currency0, official.currency1].some((a) => same(a, token)) ||
    poolId(official) !== officialId ||
    poolId(referenceKey(imd)) !== referenceId
  )
    throw Error(
      "Pinned pool binding mismatch. No alternative route is permitted.",
    );
}
/** Two exact-input single swaps inside ONE V4 unlock; intermediate credit funds leg two.
 * Exact native settlement and no intermediate take make partial fills leave unsettled deltas and revert.
 * TAKE_ALL pays msgSender() (the buyer). SWEEP returns unused native funds to the same buyer.
 */
export function ethSwapData(
  official: PoolKey,
  imd: Address,
  token: Address,
  buyer: Address,
  input: bigint,
  min: bigint,
  deadline: bigint,
): Hex {
  if (input <= 0n || input >= 2n ** 128n || min <= 0n || min >= 2n ** 128n)
    throw Error("Unsupported route amount.");
  const tuple = {
    type: "tuple",
    components: [
      { name: "poolKey", type: "tuple", components: POOL_COMPONENTS },
      { name: "zeroForOne", type: "bool" },
      { name: "amountIn", type: "uint128" },
      { name: "amountOutMinimum", type: "uint128" },
      { name: "hookData", type: "bytes" },
    ],
  } as const;
  const single = (key: PoolKey, zeroForOne: boolean, n: bigint, m: bigint) =>
    encodeAbiParameters(
      [tuple],
      [
        {
          poolKey: key,
          zeroForOne,
          amountIn: n,
          amountOutMinimum: m,
          hookData: "0x",
        },
      ],
    );
  const actions = encodeAbiParameters(parseAbiParameters("bytes,bytes[]"), [
    "0x06060b0f",
    [
      single(referenceKey(imd), true, input, 0n),
      single(official, same(official.currency0, imd), 0n, min),
      encodeAbiParameters(parseAbiParameters("address,uint256,bool"), [
        zeroAddress,
        input,
        false,
      ]),
      encodeAbiParameters(parseAbiParameters("address,uint256"), [token, min]),
    ],
  ]);
  return encodeFunctionData({
    abi: routerAbi,
    functionName: "execute",
    args: [
      "0x1004",
      [
        actions,
        encodeAbiParameters(parseAbiParameters("address,address,uint256"), [
          zeroAddress,
          buyer,
          0n,
        ]),
      ],
      deadline,
    ],
  });
}
const events = parseAbi([
  "event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)",
  "event HookFeeCollected(uint256 amount,bool isSell)",
  "event PartialFillRefunded(address indexed trader,uint256 requested,uint256 executed,uint256 refund)",
]);
type SimCall = {
  status: Hex;
  returnData: Hex;
  gasUsed: Hex;
  logs: { address: Address; data: Hex; topics: Hex[] }[];
  error?: { message: string };
};
/** RPC executes the actual router and both pools, sequentially, with no state overrides.
 * Unlike composing single-pool quotes, this includes the first leg's reference-price movement.
 */
export async function quoteEthRoute(
  r: Runtime,
  key: PoolKey,
  buyer: Address,
  input: bigint,
  minimum = 1n,
  slippage?: string,
  reviewedDeadline?: bigint,
) {
  if (!ETH_ROUTE_VERIFIED)
    throw Error("ETH route awaits the actual-buyer fork verification.");
  const token = r.addresses.UnlockV2Token,
    imd = r.d.network.pairToken.address,
    hook = r.addresses.UnlockV2Hook;
  const block = await r.client.getBlockNumber();
  const read = async (functionName: string) =>
    r.client.readContract({
      address: hook,
      abi: r.abis.UnlockV2Hook,
      functionName,
      blockNumber: block,
    });
  const [officialId, refId, active, registered] = await Promise.all([
    read("officialPoolId"),
    read("referencePoolId"),
    read("activated"),
    r.client.readContract({
      address: hook,
      abi: r.abis.UnlockV2Hook,
      functionName: "isRouter",
      args: [r.d.network.uniswapV4.universalRouter],
      blockNumber: block,
    }),
  ]);
  if (!active || !registered)
    throw Error("Trading is closed or the pinned router is unavailable.");
  assertRouteKeys(key, officialId as Hex, refId as Hex, imd, token, hook);
  const deadline =
    reviewedDeadline ?? BigInt(Math.floor(Date.now() / 1000) + 180);
  const data = ethSwapData(key, imd, token, buyer, input, minimum, deadline);
  const balanceData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [buyer],
  });
  const rightsData = encodeFunctionData({
    abi: r.abis.UnlockV2Hook,
    functionName: "rightsOf",
    args: [buyer],
  });
  let response: { calls: SimCall[] }[];
  try {
    response = (await r.client.request({
      method: "eth_simulateV1" as never,
      params: [
        {
          blockStateCalls: [
            {
              calls: [
                { from: buyer, to: token, data: balanceData },
                { from: buyer, to: hook, data: rightsData },
                {
                  from: buyer,
                  to: r.d.network.uniswapV4.universalRouter,
                  data,
                  value: toHex(input),
                  gas: toHex(4000000),
                },
                { from: buyer, to: token, data: balanceData },
                { from: buyer, to: hook, data: rightsData },
              ],
            },
          ],
          validation: false,
          traceTransfers: false,
        },
        toHex(block),
      ] as never,
    })) as unknown as { calls: SimCall[] }[];
  } catch {
    throw Error(
      "Full-route simulation unavailable from this RPC. ETH buying is stopped; retry or use IMD.",
    );
  }
  const calls = response?.[0]?.calls;
  if (!calls || calls.length !== 5 || calls.some((c) => c.status !== "0x1"))
    throw Error(
      "The complete ETH route reverted or could not be simulated. No fallback pool is permitted.",
    );
  const balance = (i: number) =>
    decodeFunctionResult({
      abi: erc20Abi,
      functionName: "balanceOf",
      data: calls[i].returnData,
    });
  const rights = (i: number) =>
    decodeFunctionResult({
      abi: r.abis.UnlockV2Hook,
      functionName: "rightsOf",
      data: calls[i].returnData,
    }) as { buyCredited: bigint; pendingBuy: bigint };
  const out = balance(3) - balance(0),
    before = rights(1),
    after = rights(4);
  if (
    out < minimum ||
    out <= 0n ||
    after.buyCredited +
      after.pendingBuy -
      before.buyCredited -
      before.pendingBuy !==
      out
  )
    throw Error(
      "Simulation did not credit the actual buyer. ETH buying is stopped.",
    );
  let fee = 0n,
    referenceInput: bigint | undefined,
    referenceOutput = 0n,
    officialInput = 0n,
    refCount = 0,
    officialCount = 0;
  for (const log of calls[2].logs) {
    if (
      !same(log.address, r.d.network.uniswapV4.poolManager) &&
      !same(log.address, hook)
    )
      continue;
    try {
      const e = decodeEventLog({
        abi: events,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (e.eventName === "PartialFillRefunded") throw Error("PARTIAL_FILL");
      if (e.eventName === "HookFeeCollected" && same(log.address, hook))
        fee += e.args.amount;
      if (
        e.eventName === "Swap" &&
        same(log.address, r.d.network.uniswapV4.poolManager)
      ) {
        if (e.args.id === refId) {
          refCount++;
          referenceInput = -e.args.amount0;
          referenceOutput = e.args.amount1;
        } else if (e.args.id === officialId) {
          officialCount++;
          officialInput = -(same(key.currency0, imd)
            ? e.args.amount0
            : e.args.amount1);
        } else throw Error("UNEXPECTED_POOL");
      }
    } catch (e) {
      if (
        e instanceof Error &&
        ["PARTIAL_FILL", "UNEXPECTED_POOL"].includes(e.message)
      )
        throw Error(
          "Unsupported partial fill or unexpected pool. ETH buying stopped.",
        );
    }
  }
  if (
    refCount !== 1 ||
    officialCount !== 1 ||
    referenceInput !== input ||
    officialInput + fee !== referenceOutput
  )
    throw Error(
      "Route did not fully consume both pinned legs. ETH buying stopped.",
    );
  // Reserve gas for the protected calldata that the wallet will actually sign.
  const finalMinimum =
    slippage === undefined ? minimum : minimumOut(out, slippage);
  const protectedData = ethSwapData(
    key,
    imd,
    token,
    buyer,
    input,
    finalMinimum,
    deadline,
  );
  const gas = await r.client.estimateGas({
    account: buyer,
    to: r.d.network.uniswapV4.universalRouter,
    data: protectedData,
    value: input,
    blockNumber: block,
  });
  return {
    out,
    fee,
    lp: (officialInput * 12500n) / 1000000n,
    referenceLp: input / 100n,
    gas,
    simulationGas: BigInt(calls[2].gasUsed),
    block,
    at: Date.now(),
    deadline,
    data: protectedData,
  };
}
