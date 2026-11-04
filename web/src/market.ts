export type TradePoint = {
  time: number;
  imdPerToken: number;
  imdVolume: number;
  usdPerImd?: number;
};
export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
/** Only observed official trades create bars. Empty intervals are intentionally not synthesized. */
export function candles(
  trades: TradePoint[],
  seconds: number,
  unit: "IMD" | "USD",
): Bar[] {
  if (!Number.isInteger(seconds) || seconds <= 0)
    throw Error("Invalid timeframe");
  const bars = new Map<number, Bar>();
  for (const t of [...trades].sort((a, b) => a.time - b.time)) {
    if (unit === "USD" && (!t.usdPerImd || !Number.isFinite(t.usdPerImd)))
      throw Error("Historical USD reference unavailable; choose IMD.");
    const rate = unit === "USD" ? t.usdPerImd! : 1;
    const price = t.imdPerToken * rate,
      volume = t.imdVolume * rate;
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(volume) ||
      volume < 0
    )
      throw Error("Invalid trade data");
    const time = Math.floor(t.time / seconds) * seconds;
    const b = bars.get(time);
    if (b) {
      b.high = Math.max(b.high, price);
      b.low = Math.min(b.low, price);
      b.close = price;
      b.volume += volume;
    } else
      bars.set(time, {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
      });
  }
  return [...bars.values()];
}
