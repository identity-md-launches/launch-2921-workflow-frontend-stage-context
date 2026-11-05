import { useEffect, useRef, useState } from "react";
import { GATE_THRESHOLDS, gateState } from "./gate-data";
import { formatUnits, parseAbiItem } from "viem";
import { useApp } from "./context";
import { display, Alert } from "./components";
import { candles, type TradePoint } from "./market";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type UTCTimestamp,
} from "./vendor/lightweight-charts.mjs";

export function GateChart() {
  const { data: d, stale } = useApp();
  const [selected, setSelected] = useState(1);
  const rows = d?.gateTable ?? GATE_THRESHOLDS;
  const g = rows[selected - 1];
  const state = (n: number) => gateState(n, d?.gates, stale);
  // X positions are logarithmic FDV; Y is the permanent cumulative unlock percentage.
  const x = (fdv: bigint) =>
    75 +
    ((Math.log10(Number(formatUnits(fdv, 18))) - Math.log10(250000)) / 2) * 680;
  const y = (pct: number) => 285 - pct * 2.3;
  let path = "M 35 285 H 75";
  rows.forEach((row, i) => {
    path += ` H ${x(row[1])} V ${y(row[0])}${i === 9 ? " H 790" : ""}`;
  });
  return (
    <>
      <p className="helper">
        Initial official buys: 20% · migration / swarm / founder: 0%. All
        credited origins share the gate percentage after gate 1.
      </p>
      <svg
        viewBox="0 0 840 340"
        className="staircase"
        role="img"
        aria-label="Interactive permanent gate staircase. Logarithmic FDV USD axis; cumulative sell percentage axis."
      >
        {[0, 20, 40, 60, 80, 100].map((p) => (
          <g key={p}>
            <line x1="35" x2="800" y1={y(p)} y2={y(p)} stroke="#262626" />
            <text x="1" y={y(p) + 4}>
              {p}%
            </text>
          </g>
        ))}
        <path
          d={`M 35 ${y(20)} H 75`}
          stroke="#8ddce6"
          strokeWidth="3"
          fill="none"
          strokeDasharray="4 3"
        />
        <path d={path} stroke="#83dcb9" strokeWidth="3" fill="none" />
        {rows.map((row, i) => (
          <g
            key={i}
            className="gate-node"
            aria-label={`Gate ${i + 1}, ${state(i + 1)}, ${row[0]} percent unlocked. FDV ${display(row[1])} USD OR cumulative volume ${display(row[2])} USD OR burn ${display(row[3])} UNLK2.`}
            onClick={() => setSelected(i + 1)}
          >
            <title>{`Gate ${i + 1} · ${state(i + 1)} · ${row[0]}%\nFDV $${display(row[1])} OR volume $${display(row[2])} OR gate burn ${display(row[3])} UNLK2`}</title>
            <circle cx={x(row[1])} cy={y(row[0])} r="17" fill="transparent" />
            <circle
              cx={x(row[1])}
              cy={y(row[0])}
              r={selected === i + 1 ? 7 : 5}
              stroke="#eee"
              fill={
                state(i + 1) === "Opened"
                  ? "#83dcb9"
                  : state(i + 1) === "Current"
                    ? "#efc47d"
                    : "#333"
              }
            />
            <text x={x(row[1])} y={y(row[0]) - 15} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        ))}
        <text x="75" y="315">
          $250K
        </text>
        <text x="390" y="315">
          FDV USD · log scale
        </text>
        <text x="710" y="315">
          $25M
        </text>
      </svg>
      <div className="gate-legend">
        <span className="mint">● Opened</span>
        <span className="amber">◉ Current</span>
        <span>○ Future</span>
      </div>
      <div className="gate-selector" aria-label="Select gate details">
        {rows.map((_, i) => (
          <button
            key={i}
            data-state={state(i + 1)}
            aria-label={`View gate ${i + 1}: ${state(i + 1)}`}
            aria-pressed={selected === i + 1}
            onClick={() => setSelected(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="helper">
        {!d || stale
          ? "Contract thresholds shown. Live gate states unavailable."
          : `Stored openings: ${d.gates} / 10 · block ${d.block.toString()}.`}{" "}
        The FDV axis shows thresholds; volume or contributions can also open
        each gate.
      </p>
      <div className="gate-detail" aria-live="polite">
        <strong>
          Gate {selected} · {state(selected)} · {g?.[0] ?? "—"}% unlocked
        </strong>
        <p>
          FDV ${display(g?.[1], 18, 0)} <b>OR</b> cumulative official volume $
          {display(g?.[2], 18, 0)} <b>OR</b> this gate’s burn{" "}
          {display(g?.[3], 18, 0)} UNLK2.
        </p>
      </div>
      <details>
        <summary>Accessible gate table · all ten thresholds</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Gate / state</th>
                <th>Sell %</th>
                <th>FDV USD · OR</th>
                <th>Gross USD volume · OR</th>
                <th>Gate burn UNLK2</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <th>
                    <button
                      className="small"
                      onClick={() => setSelected(i + 1)}
                    >
                      {i + 1} · {state(i + 1)}
                    </button>
                  </th>
                  {r.map((v, j) => (
                    <td key={j}>
                      {j === 0 ? `${v}%` : display(v as bigint, 18, 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
const swapEvent = parseAbiItem(
  "event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)",
);
export function MarketChart() {
  const { r, data: d, stale } = useApp();
  const [points, setPoints] = useState<TradePoint[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [updated, setUpdated] = useState(0),
    [retry, setRetry] = useState(0);
  const [unit, setUnit] = useState<"IMD" | "USD">("USD"),
    [frame, setFrame] = useState(900),
    [range, setRange] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setRetry((n) => n + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!d?.poolKey) return;
    let canceled = false;
    async function load() {
      setLoading(true);
      setError("");
      setPoints([]);
      try {
        const latest = await r.client.getBlockNumber();
        const first = latest > 7200n ? latest - 7200n : 0n;
        const logs = [];
        for (let start = first; start <= latest; start += 2000n) {
          const end = start + 1999n > latest ? latest : start + 1999n;
          logs.push(
            ...(await r.client.getLogs({
              address: r.d.network.uniswapV4.poolManager,
              event: swapEvent,
              args: { id: d!.poolId },
              fromBlock: start,
              toBlock: end,
              strict: true,
            })),
          );
        }
        const blocks = new Map<bigint, { time: number; usd?: number }>();
        // Serial batches bound RPC use; historical USD conversion never uses today's price.
        for (const block of [...new Set(logs.map((l) => l.blockNumber))]) {
          const b = await r.client.getBlock({ blockNumber: block });
          let usd: number | undefined;
          try {
            const p = (await r.client.readContract({
              address: r.addresses.UnlockV2Hook,
              abi: r.abis.UnlockV2Hook,
              functionName: "imdUsdPrice",
              blockNumber: block,
            })) as readonly [bigint, boolean];
            if (p[1]) usd = Number(formatUnits(p[0], 18));
          } catch {
            /* IMD history remains available; USD will explicitly fail. */
          }
          blocks.set(block, { time: Number(b.timestamp), usd });
        }
        logs.sort(
          (a, b) =>
            Number(a.blockNumber - b.blockNumber) ||
            a.transactionIndex - b.transactionIndex ||
            a.logIndex - b.logIndex,
        );
        const trades = logs
          .filter((l) => !l.removed && l.args.id === d!.poolId)
          .flatMap((l) => {
            const a = l.args;
            const token0 =
              d!.poolKey!.currency0.toLowerCase() ===
              r.addresses.UnlockV2Token.toLowerCase();
            const abs = (n: bigint) => (n < 0n ? -n : n);
            const t = abs(token0 ? a.amount0 : a.amount1),
              i = abs(token0 ? a.amount1 : a.amount0);
            if (t === 0n || i === 0n) return [];
            const b = blocks.get(l.blockNumber)!;
            return [
              {
                time: b.time,
                imdPerToken:
                  Number(formatUnits(i, 18)) / Number(formatUnits(t, 18)),
                imdVolume: Number(formatUnits(i, 18)),
                usdPerImd: b.usd,
              },
            ];
          });
        if (!canceled) {
          setPoints(trades);
          setUpdated(Date.now());
          setRange(`${first}–${latest}`);
        }
      } catch (e) {
        if (!canceled)
          setError(
            `Official-pool history unavailable: ${e instanceof Error ? e.message : "RPC failed"}`.slice(
              0,
              300,
            ),
          );
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [r, d?.poolId, !!d?.poolKey, retry]);
  let bars: ReturnType<typeof candles> = [],
    unitError = "";
  try {
    bars = candles(points, frame, unit);
  } catch (e) {
    unitError = (e as Error).message;
  }
  useEffect(() => {
    if (!host.current || !bars.length) return;
    const chart = createChart(host.current, {
      autoSize: true,
      height: 440,
      layout: {
        background: { type: ColorType.Solid, color: "#0b1211" },
        textColor: "#a5b7b0",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#181818" },
        horzLines: { color: "#181818" },
      },
      timeScale: { timeVisible: true },
      rightPriceScale: { borderColor: "#333", minimumWidth: 110 },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#83dcb9",
      downColor: "#efaa90",
      borderVisible: false,
      wickUpColor: "#83dcb9",
      wickDownColor: "#efaa90",
      priceFormat: { type: "price", precision: 10, minMove: 0.0000000001 },
    });
    series.setData(bars.map((b) => ({ ...b, time: b.time as UTCTimestamp })));
    const volumes = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumes
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    series
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.05, bottom: 0.25 } });
    volumes.setData(
      bars.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? "#315e4e" : "#633e31",
      })),
    );
    if (bars.length < 40)
      chart
        .timeScale()
        .setVisibleLogicalRange({
          from: bars.length - 40,
          to: bars.length + 3,
        });
    else chart.timeScale().fitContent();
    const tooltip = readout.current;
    chart.subscribeCrosshairMove((p) => {
      const v = p.seriesData.get(series) as
        | { open?: number; high?: number; low?: number; close?: number }
        | undefined;
      if (tooltip)
        tooltip.textContent = v?.close
          ? `O ${v.open?.toPrecision(6)} H ${v.high?.toPrecision(6)} L ${v.low?.toPrecision(6)} C ${v.close.toPrecision(6)} ${unit} / UNLK2`
          : "Move crosshair · scroll to zoom · drag to pan";
    });
    return () => chart.remove();
  }, [points, unit, frame, unitError]);
  return (
    <>
      <div className="spread market-heading">
        <h2>Official market</h2>
        <strong>
          {!stale && d?.tokenPrice[1]
            ? `${display(d.tokenPrice[0], 18, 10)} IMD / UNLK2`
            : "Price unavailable"}
        </strong>
      </div>
      <div className="spread">
        <div className="segmented">
          {[60, 300, 900, 3600, 14400].map((s) => (
            <button
              key={s}
              aria-pressed={frame === s}
              onClick={() => setFrame(s)}
            >
              {s < 3600 ? `${s / 60}m` : `${s / 3600}h`}
            </button>
          ))}
        </div>
        <select
          aria-label="Market price unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value as "IMD" | "USD")}
        >
          <option value="IMD">IMD / UNLK2</option>
          <option value="USD">USD / UNLK2</option>
        </select>
      </div>
      <p>
        Price: {unit} per UNLK2 · Volume: {unit} · official-pool executed trades
      </p>
      {!d?.poolKey ? (
        <div className="chart-empty" role="status">
          <strong>Official-pool state unavailable</strong>
          <p>Use Refresh above to verify the pool, then retry market data.</p>
        </div>
      ) : loading ? (
        <p role="status">Reading official-pool Swap logs…</p>
      ) : error ? (
        <Alert error>{error}</Alert>
      ) : !points.length ? (
        <div className="chart-empty">
          <strong>
            {d?.activated
              ? "No official trades in this window"
              : "Trading closed · no official trade history in this window"}
          </strong>
          <p>
            Candles appear only after official-pool swaps. The ten doors above
            show permanent gate progress.
          </p>
        </div>
      ) : unitError ? (
        <Alert>{unitError}</Alert>
      ) : (
        <div className="market-chart">
          <div ref={readout} className="chart-readout">
            Move crosshair · scroll to zoom · drag to pan
          </div>
          <div ref={host} className="market-canvas" />
        </div>
      )}
      {bars.length > 0 && (
        <details className="candle-data">
          <summary>Read candle data</summary>
          <table>
            <caption>
              Latest {Math.min(bars.length, 30)} observed candles. Prices and
              volume in {unit}. Empty intervals have no candle.
            </caption>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Open / high / low / close</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {bars.slice(-30).map((bar) => (
                <tr key={bar.time}>
                  <th>{new Date(bar.time * 1000).toISOString()}</th>
                  <td>
                    {(["open", "high", "low", "close"] as const).map((k) => (
                      <div key={k}>
                        {k}: {bar[k].toPrecision(8)}
                      </div>
                    ))}
                  </td>
                  <td>{bar.volume.toPrecision(8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {stale && d && (
        <Alert>
          Pool snapshot is stale. Trading status is unavailable; history is a
          separately dated snapshot.
        </Alert>
      )}
      <button
        disabled={loading || !d?.poolKey}
        onClick={() => setRetry((n) => n + 1)}
      >
        Retry / refresh market data
      </button>
      <p className="helper">
        Source:{" "}
        <a href={r.d.network.rpcUrls[0]} target="_blank" rel="noreferrer">
          Ethereum public RPC
        </a>{" "}
        · PoolManager Swap logs filtered to official pool{" "}
        {d?.poolId.slice(0, 12)}… · block window {range || "unavailable"} (last
        7,200 blocks). Updated{" "}
        {updated ? new Date(updated).toISOString() : "not yet"}. USD uses the
        historical valid end-of-block IMD/USD reference at each trade block;
        archive RPC support is required. Prices use executed pool IMD/token
        legs, excluding the extra reward fee. Empty intervals stay empty. Public
        RPC only; no paid API. Charts by{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView Lightweight Charts 5.0.9
        </a>
        .
      </p>
    </>
  );
}
export function Charts() {
  const [tab, setTab] = useState("market");
  return (
    <section className="panel chart-panel">
      <div
        className="segmented chart-tabs"
        role="tablist"
        aria-label="Dashboard charts"
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            const next =
              e.key === "Home"
                ? "gates"
                : e.key === "End"
                  ? "market"
                  : tab === "gates"
                    ? "market"
                    : "gates";
            setTab(next);
            document.getElementById(`chart-tab-${next}`)?.focus();
          }
        }}
      >
        <button
          role="tab"
          id="chart-tab-gates"
          aria-controls="chart-content"
          tabIndex={tab === "gates" ? 0 : -1}
          aria-selected={tab === "gates"}
          onClick={() => setTab("gates")}
        >
          Gate Staircase
        </button>
        <button
          role="tab"
          id="chart-tab-market"
          aria-controls="chart-content"
          tabIndex={tab === "market" ? 0 : -1}
          aria-selected={tab === "market"}
          onClick={() => setTab("market")}
        >
          Market Chart
        </button>
      </div>
      <div
        id="chart-content"
        role="tabpanel"
        aria-labelledby={`chart-tab-${tab}`}
      >
        {tab === "gates" ? <GateChart /> : <MarketChart />}
      </div>
    </section>
  );
}
