import { maxUint256 } from "viem";
type Rights = { buyCredited: bigint; buySold: bigint; otherCredited: bigint; otherSold: bigint; pendingBuy: bigint; pendingBlock: bigint };
/** Preview only: a full contribution opens its expected gate after the same conservative burn debits. */
export function allowanceAfterOpening(rights: Rights, debits: readonly bigint[], gate: number, pct: number, block: bigint) {
  if (gate === 10) return maxUint256;
  const buys = rights.buyCredited + (rights.pendingBlock < block ? rights.pendingBuy : 0n) - debits[1];
  const others = rights.otherCredited - debits[2];
  const buyCap = buys * BigInt(pct) / 100n;
  const otherCap = others * BigInt(pct) / 100n;
  return (buyCap > rights.buySold ? buyCap - rights.buySold : 0n) +
    (otherCap > rights.otherSold ? otherCap - rights.otherSold : 0n);
}
