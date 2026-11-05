export const portion = (available: bigint, percent: number) => {
  if (![20, 50, 75, 100].includes(percent) || available < 0n)
    throw Error("Invalid shortcut.");
  return (available * BigInt(percent)) / 100n;
};
export const sellable = (balance: bigint, allowance: bigint) =>
  balance < allowance ? balance : allowance;
export const gasReserve = (gas: bigint, maxFeePerGas: bigint) =>
  (((gas * 120n + 99n) / 100n) * maxFeePerGas * 125n) / 100n;
export const spendableEth = (balance: bigint, reserve: bigint) =>
  balance > reserve ? balance - reserve : 0n;
