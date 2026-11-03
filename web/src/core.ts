import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  parseAbiParameters,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};
export function amount(value: string, decimals = 18): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim()))
    throw Error("Enter a positive amount without commas or exponent notation.");
  if ((value.split(".")[1]?.length ?? 0) > decimals)
    throw Error(`Use at most ${decimals} decimal places.`);
  const n = parseUnits(value.trim(), decimals);
  if (n <= 0n) throw Error("Amount must be greater than zero.");
  if (n >= 2n ** 128n) throw Error("Amount exceeds the supported range.");
  return n;
}
export function minimumOut(quoted: bigint, slippage: string): bigint {
  const p = Number(slippage);
  if (!/^\d+(\.\d{1,2})?$/.test(slippage) || p < 0.01 || p > 5)
    throw Error("Slippage must be between 0.01% and 5%.");
  return (quoted * (10000n - BigInt(Math.round(p * 100)))) / 10000n;
}
export const POOL_COMPONENTS = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;
export const quoterAbi = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: POOL_COMPONENTS },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;
export const routerAbi = parseAbi([
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
]);
export const permitAbi = parseAbi([
  "function allowance(address user,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)",
  "function decimals() view returns(uint8)",
  "function symbol() view returns(string)",
  "function transfer(address,uint256) returns(bool)",
]);
export function swapData(
  key: PoolKey,
  input: Address,
  inputAmount: bigint,
  min: bigint,
  deadline: bigint,
  extended = false,
): Hex {
  const zeroForOne = input.toLowerCase() === key.currency0.toLowerCase();
  const output = zeroForOne ? key.currency1 : key.currency0;
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
  const values = {
    poolKey: key,
    zeroForOne,
    amountIn: inputAmount,
    amountOutMinimum: min,
    ...(extended ? { minHopPriceX36: 0n } : {}),
    hookData: "0x" as Hex,
  };
  const params = [
    encodeAbiParameters([tuple], [values]),
    encodeAbiParameters(parseAbiParameters("address,uint256"), [
      input,
      inputAmount,
    ]),
    encodeAbiParameters(parseAbiParameters("address,uint256"), [output, min]),
  ];
  const actions = encodeAbiParameters(parseAbiParameters("bytes,bytes[]"), [
    "0x060c0f",
    params,
  ]);
  return encodeFunctionData({
    abi: routerAbi,
    functionName: "execute",
    args: ["0x10", [actions], deadline],
  });
}
export function errorText(error: unknown): string {
  const e = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: unknown;
  };
  const s = [e.shortMessage, e.message].filter(Boolean).join(" ");
  if (e.code === 4001 || /user rejected|user denied/i.test(s))
    return "Request declined in your wallet. You can retry when ready.";
  const errors: Record<string, string> = {
    TradingClosed:
      "Trading is closed until owner setup and activation are complete.",
    SellExceedsAllowance:
      "This sell exceeds your official-pool allowance. Review My Rights.",
    StaleGate:
      "The collecting gate changed. Refresh the contribution quote and preview again.",
    ExceedsGateRemaining:
      "This amount exceeds the current gate remainder. Refresh and reduce the amount.",
    InsufficientBacking:
      "The migration vault does not have enough UNLK2 backing.",
    ExceedsCapacity: "This amount exceeds the remaining migration capacity.",
    NothingToClaim: "No matured IMD is available to claim yet.",
    NothingToRedeem: "No pending IMD fees are available to redeem.",
    Sealed: "Configuration is permanently sealed after activation.",
    GoldenVaultOpen: "All gates are open. Use a voluntary burn to earn points.",
    NotOwner: "Only the contract owner can perform this action.",
    ReferenceUnavailable:
      "The pricing reference is unavailable. Retry after it recovers.",
  };
  for (const [name, message] of Object.entries(errors))
    if (s.includes(name)) return message;
  if (/insufficient funds/i.test(s))
    return "Your wallet needs more ETH for network fees or more of the input token.";
  if (/fetch|network|timeout|HTTP request failed/i.test(s))
    return "The network read failed. Check your connection and retry.";
  if (/signature.*0x|selector.*0x|data:.*0x/i.test(s))
    return "The contract rejected this simulation. Refresh state and check balances, eligibility, setup and approvals, then retry.";
  return (
    e.shortMessage ??
    e.message ??
    "The request failed. Refresh the state and retry."
  ).slice(0, 360);
}
export const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
