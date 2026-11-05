import { useEffect, useRef, useState } from "react";
import { useApp } from "./context";
import { Progress } from "./components";
export function GateDoors() {
  const { data: d, stale } = useApp();
  const [selected, setSelected] = useState<number>(),
    [opening, setOpening] = useState("");
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
    current = fresh && gate === d.gates + 1;
  return (
    <section className="gate-hall" aria-label="Ten permanent gates">
      <div className="spread gate-hall-heading">
        <h2>
          {d?.gates === 10 && !stale
            ? "All doors open. Golden Vault."
            : "Unlock the next door"}
        </h2>
        <a href="#active-gate">
          {d?.gates === 10 ? "Burn for points" : "Contribute UNLK2"} ↓
        </a>
      </div>
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
                <span className="door-frame">
                  <span className="door-leaf">
                    <span className="door-lock" />
                  </span>
                  <span className="door-light" />
                </span>
              </span>
              <strong>{d?.gateTable[i] ? `${d.gateTable[i][0]}%` : "?"}</strong>
              <span className="door-state">{state}</span>
            </button>
          );
        })}
      </div>
      <div className="gate-disclosure" aria-live="polite">
        <div className="spread">
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
          <span className="muted">Any one target opens a gate</span>
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
            value={current ? d?.burnProgress : undefined}
            target={row?.[3]}
            unit="UNLK2"
            valid={fresh && current}
          />
        </div>
        <p className="helper">
          Selling percentages are cumulative entitlements, not a new allowance
          each gate.{" "}
          {d?.gates === 0
            ? "At gate 0: buys 20%; migration and native claims 0%."
            : "Your remaining allowance also reflects past sales and burns."}{" "}
          <a href="#gates">Numerical ladder and rules ↗</a>
        </p>
      </div>
      {opening && (
        <p className="gate-opening" role="status">
          {opening}
        </p>
      )}
    </section>
  );
}
