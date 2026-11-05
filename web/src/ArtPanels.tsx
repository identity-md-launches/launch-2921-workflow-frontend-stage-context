import { useApp } from "./context";
import { display } from "./components";
import { EnergyCore } from "./EnergyCore";

export function ArtPanels() {
  const { data: d, wallet: w, stale, view } = useApp();
  const open = !!d && !stale && d.gates === 10;
  return (
    <div className="art-panels">
      <section className="art-panel burn-art-panel" aria-labelledby="burn-preview-heading">
        <EnergyCore />
        <div className="art-panel-content">
          <h2 id="burn-preview-heading">Burn &amp; Points</h2>
          <dl className="compact-dl">
            <dt>Burned UNLK2</dt><dd>{display(stale ? undefined : d?.totalBurned)}</dd>
            <dt>Your points</dt><dd>{w.address ? display(stale ? undefined : d?.myPoints) : "Connect wallet"}</dd>
            <dt>Reward share</dt><dd>{w.address && !stale && d?.myPoints !== undefined ? d.points > 0n ? `${Number(d.myPoints * 10000n / d.points) / 100}%` : "0%" : "Unavailable"}</dd>
          </dl>
          <button className="preview-action" onClick={() => document.getElementById("active-gate")?.scrollIntoView({ behavior: "instant", block: "start" })}>Contribute UNLK2 ↓</button>
          <span className="art-caption">Irreversible burns · Nontransferable points</span>
        </div>
      </section>
      <section className="art-panel vault-art-panel" aria-labelledby="vault-preview-heading">
        <EnergyCore gold />
        <div className="art-panel-content">
          <h2 id="vault-preview-heading">Golden Vault</h2>
          <p className="vault-lock">{!d || stale ? "Awaiting verified gate state" : open ? "Open permanently · Gate 10" : "Unlocks after Gate 10"}</p>
          <p>Burn for points. Claim matured IMD.</p>
          <button onClick={() => view("Golden Vault")}>Explore Golden Vault →</button>
        </div>
      </section>
    </div>
  );
}
