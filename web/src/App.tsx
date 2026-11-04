import { Dashboard } from "./Dashboard";
import { useEffect, useMemo, useState } from "react";
import { loadConfig, withWalletReadFallback, type Runtime } from "./config";
import { Context } from "./context";
import { useData } from "./state";
import { WalletDialog, useWallet } from "./wallet";
import { useTransactions } from "./transactions";
import { display, Stat } from "./components";
import {
  Burn,
  Gates,
  Golden,
  Migrate,
  Rewards,
  Rights,
  Rules,
} from "./Screens";
import { Founder } from "./Founder";
import { errorText } from "./core";
const screens = [
  "Trade",
  "Gates",
  "Migrate",
  "My Rights",
  "Burn & Points",
  "Weekly IMD Rewards",
  "Golden Vault",
  "Rules / Contracts",
  "Founder setup",
];
const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
const current = () =>
  screens.find((s) => key(s) === location.hash.slice(1)) ?? "Trade";
export default function App() {
  const [baseRuntime, setRuntime] = useState<Runtime>(),
    [configError, setConfigError] = useState(""),
    [screen, setScreen] = useState(current),
    [retry, setRetry] = useState(0);
  const wallet = useWallet(baseRuntime?.d);
  const runtime = useMemo(
    () =>
      baseRuntime && wallet.provider && !wallet.wrong
        ? withWalletReadFallback(baseRuntime, wallet.provider)
        : baseRuntime,
    [baseRuntime, wallet.provider, wallet.wrong],
  );
  const state = useData(runtime, wallet.address);
  const tx = useTransactions(
    runtime,
    wallet,
    state.refresh,
    state.verified && !state.stale,
  );
  useEffect(() => {
    let cancelled = false;
    setConfigError("");
    loadConfig()
      .then((r) => {
        if (!cancelled) setRuntime(r);
      })
      .catch((e) => {
        if (!cancelled) setConfigError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  useEffect(() => {
    const fn = () => setScreen(current());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const view = (name: string) => {
    location.hash = key(name);
    setScreen(name);
    document.getElementById("main-heading")?.focus();
    window.scrollTo(0, 0);
  };
  const d = state.data;
  const status = !runtime
    ? "Loading deployment"
    : !d && !state.error
      ? "Reading chain"
      : state.error
        ? "RPC unavailable"
        : state.stale
          ? "Verifying chain"
        : d?.activated
          ? "Trading active"
          : "Trading closed";
  const connectLabel = wallet.pending
    ? "Wallet pending…"
    : wallet.wrong
      ? "Switch to Ethereum"
      : wallet.address
        ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
        : "Connect wallet";
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#trade" aria-label="UNLOCK V2 home">
          <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">
            <path d="M2 2h7v20h10V2h7v28H2Z" fill="currentColor" />
          </svg>
          <span>
            UNLOCK<span className="version">V2</span>
          </span>
        </a>
        <div className="header-utilities">
          <span className="chain-label">
            <i />
            Ethereum
          </span>
          <button
            className="wallet-button"
            disabled={!!wallet.pending}
            onClick={() =>
              wallet.wrong ? void wallet.switchNetwork() : wallet.setOpen(true)
            }
          >
            {connectLabel}
          </button>
        </div>
      </header>
      <nav className="desktop-nav" aria-label="Protocol screens">
        {screens.map((s) => (
          <a
            href={`#${key(s)}`}
            key={s}
            aria-current={s === screen ? "page" : undefined}
            onClick={() => setScreen(s)}
          >
            {s}
          </a>
        ))}
      </nav>
      <div className="mobile-nav">
        <label className="sr-only" htmlFor="screen-nav">
          Protocol screen
        </label>
        <select
          id="screen-nav"
          value={screen}
          onChange={(e) => view(e.target.value)}
        >
          {screens.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="muted">UNLK2 / IMD</span>
      </div>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading">
          <h1 id="main-heading" tabIndex={-1}>
            {screen === "Trade" ? (
              <>
                Trade <span className="muted">UNLK2 / IMD</span>
              </>
            ) : (
              screen
            )}
          </h1>
          <div className="read-status">
            <span
              className={
                state.error ? "amber" : d?.activated ? "mint" : "muted"
              }
            >
              ● {status}
            </span>
            <button
              className="small"
              onClick={() =>
                runtime ? void state.refresh() : setRetry((n) => n + 1)
              }
              disabled={state.loading}
            >
              {state.loading ? "Reading…" : "Refresh"}
            </button>
          </div>
        </div>
        {tx.status}
        {configError && (
          <div className="system-message error" role="alert">
            <span>Deployment configuration could not load. {configError}</span>
            <button onClick={() => setRetry((n) => n + 1)}>
              Retry configuration
            </button>
          </div>
        )}
        {state.error && (
          <div className="system-message" role="status">
            <span className="amber">
              Live state unavailable; actions disabled. {d ? "Previous snapshot is stale." : ""}
            </span>
            <details>
              <summary>Connection details</summary>
              <p>{errorText(new Error(state.error))}</p>
              <p>
                Public reads use the deployment’s RPCs. Retry with Refresh. No
                example balances or prices are substituted.
              </p>
            </details>
          </div>
        )}
        {wallet.wrong && (
          <div className="system-message amber" role="status">
            Your wallet is on another network. Use “Switch to Ethereum” in the
            header to continue.
          </div>
        )}
        {runtime ? (
          <Context.Provider
            value={{
              r: runtime,
              wallet,
              data: d,
              verified: state.verified,
              stale: state.stale,
              refresh: state.refresh,
              busy: tx.busy,
              request: tx.request,
              view,
            }}
          >
            {screen === "Trade" && (
              <div className="market-strip">
                <Stat
                  label="UNLK2 price"
                  value={
                    d?.tokenPrice[1] && !state.stale
                      ? display(d.tokenPrice[0], 18, 8)
                      : "Unavailable"
                  }
                  unit="IMD"
                />
                <Stat
                  label="Current supply"
                  value={display(d?.supply, 18, 0)}
                  unit="UNLK2"
                />
                <Stat label="Gates open" value={d && !state.stale ? `${d.gates} / 10` : "Unavailable"} />
                <Stat
                  label="Gross official volume"
                  value={display(d?.volume, 18, 0)}
                  unit="USD"
                />
              </div>
            )}
            {screen === "Trade" ? (
              <Dashboard />
            ) : screen === "Gates" ? (
              <Gates />
            ) : screen === "Migrate" ? (
              <Migrate />
            ) : screen === "My Rights" ? (
              <Rights />
            ) : screen === "Burn & Points" ? (
              <Burn />
            ) : screen === "Weekly IMD Rewards" ? (
              <Rewards />
            ) : screen === "Golden Vault" ? (
              <Golden />
            ) : screen === "Rules / Contracts" ? (
              <Rules />
            ) : (
              <Founder />
            )}
            {tx.element}
          </Context.Provider>
        ) : (
          <section className="panel">
            <h2>Swap UNLK2 / IMD</h2>
            <p>
              {configError
                ? "The runtime deployment must load before amounts, addresses or transactions can be used."
                : "Loading the attested runtime configuration and verifying implementation ABIs…"}
            </p>
            <button className="action" onClick={() => wallet.setOpen(true)}>
              Connect wallet
            </button>
          </section>
        )}
      </main>
      <footer>
        <span>UNLOCK V2 · Ethereum mainnet</span>
        <span>
          Official-pool rules. Irreversible burns. No promised returns.
        </span>
        <a href="#rules-contracts">Verify contracts ↗</a>
      </footer>
      <WalletDialog wallet={wallet} />
    </>
  );
}
