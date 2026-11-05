import { Dashboard } from "./Dashboard";
import { useEffect, useMemo, useRef, useState } from "react";
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
  "Integration status",
];
const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
const current = () =>
  location.hash === "#founder-setup"
    ? "Integration status"
    : (screens.find((s) => key(s) === location.hash.slice(1)) ?? "Trade");
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
  const hasRendered = useRef(false);
  useEffect(() => {
    if (!hasRendered.current) { hasRendered.current = true; return; }
    document.getElementById("main-heading")?.focus();
    window.scrollTo(0, 0);
  }, [screen]);
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
      <a href="#main-content" className="skip-link" onClick={(event) => {
        event.preventDefault();
        document.getElementById("main-content")?.focus();
        document.getElementById("main-content")?.scrollIntoView();
      }}>
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#trade" aria-label="UNLOCK V2 home">
          <img src="./art/brand-mark.webp" width="40" height="44" alt="" />
          <span>
            UNLOCK<span className="version">V2</span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Protocol screens">
          {screens.filter((s) => !["Gates", "Rules / Contracts", "Integration status"].includes(s)).map((s) => (
            <a href={`#${key(s)}`} key={s} aria-current={s === screen ? "page" : undefined} onClick={() => setScreen(s)}>
              {s === "Weekly IMD Rewards" ? "Rewards" : s}
            </a>
          ))}
          <details className="more-nav" onKeyDown={(e) => {
            if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); }
          }}>
            <summary>More</summary>
            <div>{["Gates", "Rules / Contracts", "Integration status"].map((s) => (
              <a href={`#${key(s)}`} key={s} aria-current={s === screen ? "page" : undefined} onClick={(e) => {
                setScreen(s);
                e.currentTarget.closest("details")?.removeAttribute("open");
              }}>{s}</a>
            ))}</div>
          </details>
        </nav>
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
      <main id="main-content" tabIndex={-1} data-screen={key(screen)}>
        <div className="page-heading">
          <h1 id="main-heading" tabIndex={-1}>
            {screen === "Trade" ? (
              <>
                Ten gates. Permanent progress.
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
              Live state unavailable; actions disabled.{" "}
              {d ? "Previous snapshot is stale." : ""}
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
