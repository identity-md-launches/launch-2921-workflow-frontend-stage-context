import { useApp } from "./context";
import { Trade, GateProgress } from "./Trade";
import { Charts } from "./Charts";
import { Burn } from "./Screens";
export function Dashboard() {
  const { data: d } = useApp();
  return (
    <>
      <div className="dashboard-grid">
        <Charts />
        <Trade />
      </div>
      <section className="panel active-gate">
        <GateProgress />
        <Burn home key={d?.gates === 10 ? "golden" : "gates"} />
      </section>
    </>
  );
}
