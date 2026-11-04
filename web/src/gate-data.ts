// Immutable thresholds from deployed UnlockV2Hook.gate(); these are not market data.
export const GATE_THRESHOLDS: readonly (readonly [number, bigint, bigint, bigint])[] = [
  [25, 250000, 125000, 25000000],
  [30, 500000, 375000, 22000000],
  [35, 1000000, 750000, 19000000],
  [40, 2000000, 1500000, 16000000],
  [50, 3500000, 2500000, 13000000],
  [60, 5000000, 4000000, 10000000],
  [70, 8000000, 6000000, 8000000],
  [80, 12000000, 9000000, 6000000],
  [90, 18000000, 12500000, 4000000],
  [100, 25000000, 20000000, 2000000],
].map(([pct, fdv, volume, burn]) => [pct, BigInt(fdv) * 10n ** 18n, BigInt(volume) * 10n ** 18n, BigInt(burn) * 10n ** 18n] as const);

export function gateState(n: number, opened?: number, stale = false) {
  if (opened === undefined || stale) return "Unread";
  return n <= opened ? "Opened" : n === opened + 1 ? "Current" : "Future";
}
