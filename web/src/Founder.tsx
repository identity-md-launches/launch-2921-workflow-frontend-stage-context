import { useApp } from "./context";
import { AddressLink, Panel, Stat, display } from "./components";
export function Founder() {
  const { r, data: d, stale } = useApp();
  const status = (ok: boolean | undefined) =>
    !d || stale ? "Unavailable" : ok ? "Verified" : "Check required";
  return (
    <div className="two-col">
      <Panel title="Live integration status">
        <p>
          This site reads the completed setup. Trading opens only when the hook
          reports activation; this page refreshes automatically.
        </p>
        <dl className="compact-dl">
          <dt>Token and hook bindings</dt>
          <dd>{status(d?.isBound)}</dd>
          <dt>Official pool initialized</dt>
          <dd>{status(d?.poolInitialized)}</dd>
          <dt>Universal Router registered</dt>
          <dd>{status(d?.routerSupported)}</dd>
          <dt>WalletQuoter registered</dt>
          <dd>{status(d?.quoterSupported)}</dd>
          <dt>Native adapter registered</dt>
          <dd>
            {status(
              d?.swarm.toLowerCase() ===
                r.repair.adapter?.address.toLowerCase(),
            )}
          </dd>
          <dt>Remaining backing ≥ capacity</dt>
          <dd>{status(d && d.backing >= d.capacity)}</dd>
          <dt>Pricing reference</dt>
          <dd>{status(d?.reference)}</dd>
          <dt>Trading</dt>
          <dd>
            {!d || stale
              ? "Unavailable"
              : d.activated
                ? "Active"
                : "Closed; awaiting activation"}
          </dd>
        </dl>
        <div className="metrics">
          <Stat
            label="Remaining backing"
            value={display(stale ? undefined : d?.backing)}
            unit="UNLK2"
          />
          <Stat
            label="Remaining capacity"
            value={display(stale ? undefined : d?.capacity)}
            unit="UNLK2"
          />
        </div>
      </Panel>
      <Panel title="Reviewed installations">
        <p>
          Runtime hashes and contract bindings are checked before transactions
          are enabled.
        </p>
        <h3>Native claims adapter</h3>
        <AddressLink address={r.repair.adapter?.address} />
        <h3>WalletQuoter</h3>
        <AddressLink address={r.repair.quoter?.address} />
        <h3>Universal Router</h3>
        <AddressLink address={r.d.network.uniswapV4.universalRouter} />
        <p className="helper">
          Registration and the initial 700 million UNLK2 migration funding are
          complete. Backing falls with successful migrations; it is compared
          with remaining capacity, not the original cap.
        </p>
      </Panel>
    </div>
  );
}
