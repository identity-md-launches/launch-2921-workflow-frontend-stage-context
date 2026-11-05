export function EnergyCore({ gold = false, confirmed = false }: { gold?: boolean; confirmed?: boolean }) {
  return (
    <div className={`energy-scene ${gold ? "gold" : ""} ${confirmed ? "confirmed" : ""}`} aria-hidden="true">
      <img className="energy-art" src={`./art/${gold ? "golden-vault" : "burn-core"}.webp`} width="512" height="512" alt="" decoding="async" />
      <span className="core-light" />
      <span className="flow-particles"><i /><i /><i /></span>
    </div>
  );
}
