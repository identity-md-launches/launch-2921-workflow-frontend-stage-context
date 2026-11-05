export function EnergyCore({
  gold = false,
  confirmed = false,
}: {
  gold?: boolean;
  confirmed?: boolean;
}) {
  return (
    <div
      className={`energy-scene ${gold ? "gold" : ""} ${confirmed ? "confirmed" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 360 180" className="energy-art">
        <defs>
          <radialGradient id={gold ? "vault-glow" : "core-glow"}>
            <stop stopColor="currentColor" stopOpacity=".3" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx="180"
          cy="110"
          rx="142"
          ry="63"
          fill={`url(#${gold ? "vault-glow" : "core-glow"})`}
        />
        <path
          className="core-ring"
          d="M70 100 180 40 290 100 180 160Z M95 100 180 54 265 100 180 146Z"
          fill="none"
          stroke="currentColor"
          opacity=".5"
        />
        {gold ? (
          <g fill="#17140d" stroke="currentColor" strokeWidth="2">
            <path d="m132 53 86-13 24 18v84l-86 14-24-18Z" />
            <path d="m142 63 77-12 13 11v72l-77 13-13-11Z" />
            <ellipse cx="187" cy="100" rx="20" ry="23" />
            <path d="M187 76v48m-22-24h44m-36-17 29 34m-29 0 29-34" />
            <circle cx="187" cy="100" r="7" fill="currentColor" />
          </g>
        ) : (
          <g stroke="currentColor" strokeWidth="2">
            <path d="m180 24 33 20v57l-33 20-33-20V44Z" fill="#09251c" />
            <path d="m180 24 1 61 32-41m-66 0 34 41v36" fill="none" />
            <path
              d="m180 45 15 9v35l-15 10-14-10V54Z"
              fill="currentColor"
              opacity=".8"
            />
          </g>
        )}
        <g className="flow-particles" fill="currentColor">
          <circle cx="65" cy="100" r="4" />
          <circle cx="100" cy="100" r="3" />
          <circle cx="125" cy="100" r="2" />
        </g>
      </svg>
    </div>
  );
}
