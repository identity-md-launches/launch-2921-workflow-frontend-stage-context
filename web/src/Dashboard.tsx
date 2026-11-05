import { useApp } from "./context";
import { Trade } from "./Trade";
import { MarketChart } from "./Charts";
import { Burn, VaultSummary } from "./Screens";
import { GateDoors } from "./GateDoors";
export function Dashboard() {
  const { data: d, stale } = useApp();
  return (
    <>
      <GateDoors />
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <MarketChart />
        </section>
        <Trade />
      </div>
      <section
        className="active-gate"
        id="active-gate"
        tabIndex={-1}
        aria-label={
          d?.gates === 10
            ? "Golden Vault voluntary burn"
            : "Active gate contribution"
        }
      >
        <Burn home />
        {d?.gates === 10 && !stale && <VaultSummary />}
      </section>
    </>
  );
}
