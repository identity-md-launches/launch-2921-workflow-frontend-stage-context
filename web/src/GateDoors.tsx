import { loadGateBurn } from "./gate-history";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./context";
import { display, Progress } from "./components";
export function GateDoors() {
  const { r, data: d, stale, view } = useApp();
  const [selected, setSelected] = useState<number>(),
    [opening, setOpening] = useState("");
  const [history, setHistory] = useState<{ gate: number; amount: bigint; block: bigint }>();
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRetry, retryHistory] = useState(0);
  const previous = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (d && !stale) {
      if (previous.current !== undefined && d.gates > previous.current)
        setOpening(
          `Gate ${d.gates} opened permanently. FDV, volume or burn targets can each open a gate.`,
        );
      previous.current = d.gates;
    }
  }, [d?.gates, stale]);
  const gate = selected ?? Math.min((d?.gates ?? 0) + 1, 10),
    row = d?.gateTable[gate - 1];
  const priceAge = d ? Date.now() / 1000 - Number(d.lastObservation) : Infinity;
  const fresh = !!d && !stale,
    opened = fresh && gate <= d.gates,
    current = fresh && gate === d.gates + 1,
    future = fresh && gate > d.gates + 1;
  useEffect(() => {
    let canceled = false;
    setHistory(undefined);
    setHistoryError("");
    setHistoryLoading(false);
    if (!d || stale || current || future) return;
    setHistoryLoading(true);
    void loadGateBurn(r, gate, d.block).then((n) => {
      if (!canceled) setHistory({ gate, amount: n, block: d.block });
    }).catch(() => {
      if (!canceled) setHistoryError("Full contribution history is unavailable from the configured RPCs. Connect an Ethereum wallet with historical-log support and retry. Partial results are discarded.");
    }).finally(() => { if (!canceled) setHistoryLoading(false); });
    return () => { canceled = true; };
  }, [r, gate, d?.gates, stale, current, future, historyRetry]);
  const burnValue = current ? d?.burnProgress : future ? 0n : history?.gate === gate ? history.amount : undefined;

  return (
    <section className="gate-hall" aria-label="Ten permanent gates">
      <h2 className="sr-only">Ten permanent gates</h2>
      <div className="door-grid">
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1,
            state = !fresh
              ? "Unread"
              : n <= d.gates
                ? "Open"
                : n === d.gates + 1
                  ? "Current"
                  : "Locked";
          return (
            <button
              className="gate-door"
              data-state={state}
              key={n}
              aria-pressed={gate === n}
              aria-label={`Gate ${n}: ${state}, ${d?.gateTable[i]?.[0] ?? "unavailable"}% cumulative selling`}
              onClick={() => setSelected(n)}
            >
              <span className="door-number">{String(n).padStart(2, "0")}</span>
              <span className="door-art" aria-hidden="true">
                <img src={`./art/portal-${state === "Open" ? "open" : state === "Current" ? "current" : "locked"}.webp`} width="384" height="382" alt="" decoding="async" />
              </span>
              <strong>{d?.gateTable[i] ? `${d.gateTable[i][0]}%` : "?"}</strong>
              <span className="door-state">{state}</span>
            </button>
          );
        })}
      </div>
      <div className="gate-disclosure" aria-live="polite">
        <div className="spread gate-hall-heading">
          <h3>
            Gate {gate} ·{" "}
            {opened
              ? "Open"
              : current
                ? "Current"
                : fresh
                  ? "Future"
                  : "State unavailable"}
          </h3>
          <span className="muted">ANY ONE target opens a gate</span>
        <a className="contribute-link" href="#active-gate" onClick={(e) => {
          e.preventDefault();
          const form = document.getElementById("active-gate");
          if (form) { form.scrollIntoView({ block: "start" }); form.focus({ preventScroll: true }); }
          else view("Burn & Points");
        }}>
          {d?.gates === 10 ? "Burn for points" : "Contribute UNLK2"} ↓
        </a>
        </div>
        <div className="gate-three">
          <Progress
            label="FDV · processed"
            value={d?.lastGateFdv}
            target={row?.[1]}
            unit="USD"
            valid={
              fresh &&
              !!d?.gatePrice[1] &&
              !!d?.tokenPrice[1] &&
              d.lastGateFdv > 0n &&
              priceAge >= 0 &&
              priceAge <= 5400
            }
          />
          <Progress
            label="Cumulative official volume"
            value={d?.volume}
            target={row?.[2]}
            unit="USD"
            valid={fresh}
          />
          <Progress
            label="This gate’s burn"
            value={burnValue}
            target={row?.[3]}
            unit="UNLK2"
            valid={fresh && burnValue !== undefined}
          />
        </div>
        {future && <p className="helper">This gate has not collected contributions. Zero burn progress is derived from verified gatesOpen at block {d?.block.toString()}; the contract rejects contributions to future gates.</p>}
        {historyLoading && <p className="helper" role="status">Reading gate {gate} contribution events…</p>}
        {historyError && <div className="history-error" role="status"><p className="helper">{historyError}</p><button className="small" onClick={() => retryHistory(n => n + 1)}>Retry gate history</button></div>}
        {history && !current && <p className="helper">Gate {gate} burn total from token Contributed events through block {history.block.toString()}. Other conditions may have opened this gate before its burn target was met.</p>}
        <details className="observation-details">
          <summary>Live FDV, processed observation &amp; accounting</summary>
        <div className="gate-observation">
          <span>Indicative live FDV <strong>{fresh && d?.fdv[1] ? `$${display(d.fdv[0], 18, 2)}` : "Unavailable"}</strong></span>
          <span>Last processed gate FDV <strong>{d && d.lastGateFdv > 0n ? `$${display(d.lastGateFdv, 18, 2)}` : "Not yet observed"}</strong></span>
        </div>
        <p className="helper observation-note">
          The processed observation and indicative price are separate. {d?.lastObservation ? `Last valid volume observation: ${new Date(Number(d.lastObservation) * 1000).toISOString()}.` : "No valid gate-volume observation recorded yet."} Historical observations are not fresh quotes.
          The collecting gate uses the hook’s live burn counter. Past gates require complete contribution event history. Future gates cannot receive contributions.
        </p>
        <p className="helper">
          Selling percentages are cumulative entitlements, not a new allowance
          each gate.{" "}
          {d?.gates === 0
            ? "At gate 0: buys 20%; migration and native claims 0%."
            : "Your remaining allowance also reflects past sales and burns."}{" "}
          <a href="#gates">Numerical ladder and rules ↗</a>
        </p>
        </details>
      </div>
      {opening && (
        <p className="gate-opening" role="status">
          {opening}
        </p>
      )}
    </section>
  );
}
