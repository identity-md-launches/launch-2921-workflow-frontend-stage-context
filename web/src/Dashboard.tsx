import { useApp } from "./context";
import { Trade, GateProgress } from "./Trade";
import { Charts } from "./Charts";
import { Burn } from "./Screens";
export function Dashboard() {
  const { data: d } = useApp();
  return (
    <>
      <div className="home-actions"><span>{d ? `Gate ${Math.min(d.gates + 1, 10)} / 10` : "Ten permanent gates"} · sell rights unlock forever</span><a href="#active-gate" onClick={e => {e.preventDefault(); document.getElementById("active-gate")?.scrollIntoView(); document.getElementById("active-gate")?.focus();}}>{d?.gates === 10 ? "Golden Vault" : "Contribute UNLK2"} ↓</a></div>
      <div className="dashboard-grid">
        <Charts />
        <Trade />
      </div>
      <section className="panel active-gate" id="active-gate" tabIndex={-1} aria-label="Active gate contribution">
        <div className="gate-overview"><GateProgress /></div>
        <Burn home key={d?.gates === 10 ? "golden" : "gates"} />
      </section>
    </>
  );
}
