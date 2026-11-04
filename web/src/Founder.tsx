import { useState } from "react";
import { useApp } from "./context";
import { Action, AddressLink, Alert, display, Panel } from "./components";
import { errorText, same } from "./core";
import { verifyAuxiliary } from "./integration";

export function Founder() {
  const { r, data: d, wallet: w, request } = useApp();
  const [unsigned, setUnsigned] = useState(false),
    [error, setError] = useState("");
  const reason = !d
    ? "Waiting for verified chain state."
    : !same(w.address, d.owner)
      ? "Connect the contract owner’s wallet."
      : d.activated
        ? "Configuration is permanently sealed."
        : undefined;
  const act = async (kind: "fund" | "router" | "adapter" | "quoter") => {
    if (!d || reason) return;
    setError("");
    try {
      const common = { prepareOnly: unsigned, account: d.owner };
      if (kind === "fund") {
        const deficit = d.capacity > d.backing ? d.capacity - d.backing : 0n;
        if (!deficit) throw Error("No funding deficit remains.");
        request({
          ...common,
          title: "Fund immutable migration reserve",
          description: `Transfer exactly ${display(deficit, 18, 18)} UNLK2 to the migration vault. Principal cannot be withdrawn. This is a separately reviewed owner transaction.`,
          address: r.addresses.UnlockV2Token,
          abi: r.abis.UnlockV2Token,
          functionName: "transfer",
          args: [d.vault, deficit],
          irreversible: true,
        });
      } else {
        const target =
          kind === "router"
            ? r.d.network.uniswapV4.universalRouter
            : await verifyAuxiliary(
                r,
                kind === "adapter" ? "adapter" : "quoter",
              );
        const isAdapter = kind === "adapter";
        request({
          ...common,
          title: `Configure ${kind}`,
          description: `Set ${target} as ${isAdapter ? "the verified native swarm compatibility adapter" : "a supported msgSender() router"}. Review deployed code and all bindings first. Configuration seals permanently at activation.`,
          address: r.addresses.UnlockV2Hook,
          abi: r.abis.UnlockV2Hook,
          functionName: isAdapter ? "setSwarmDistributor" : "setRouter",
          args: isAdapter ? [target] : [target, true],
        });
      }
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <>
      <Alert>
        {r.repair.status}. This repair job has not deployed, funded, registered
        or activated anything. Owner transactions below require separate review,
        simulation and wallet confirmation.
      </Alert>
      <Panel title="Owner checklist · before permanent sealing">
        <ol>
          <li>
            Verify Ethereum chain ID 1, the manifest addresses, runtime code and
            immutable token/hook/vault bindings. The terminal verifies these
            before enabling actions.
          </li>
          <li>
            Obtain the full canonical native round-0 allocation corpus. Rebuild
            its root, reject duplicate accounts, and simulate adapter deployment
            using the package in docs/repair-integration.md. An individual proof
            is insufficient to establish whole-tree uniqueness.
          </li>
          <li>
            Review and deploy NativeSwarmAdapter and WalletQuoter externally.
            Publish their actual addresses and runtime code hashes in
            repair-config.json after independent review. No placeholder
            addresses are bundled.
          </li>
          <li>
            Prove native claim sync and adversarial cases; prove wallet buy/sell
            quote identity against actual Universal Router execution on a fork.
            Review the exact router version’s calldata layout. Do not register
            stock V4Quoter.
          </li>
          <li>
            Fund the 700m UNLK2 migration reserve; register the Universal
            Router, the compatible wallet quoter and the adapter in separate
            owner transactions. Refresh after each receipt.
          </li>
          <li>
            Review liquidity and pricing, verify all mandatory integrations,
            then consider activation externally. It irreversibly opens trading
            and seals settings. Activation is disabled in this delivery.
          </li>
        </ol>
        <div className="checklist">
          {[
            ["Ethereum / deployed bindings", !!d],
            ["Official pool initialized", d?.poolInitialized],
            ["Hook bound to token", d?.isBound],
            ["Remaining 700m reserve backed", d?.funded],
            ["Valid current pricing references", d?.reference],
            ["Universal Router registered", d?.routerSupported],
            [
              "Adapter installation reviewed",
              !!r.repair.adapter && r.repair.installationReviewed,
            ],
            [
              "Wallet quoter installation reviewed",
              !!r.repair.quoter && r.repair.installationReviewed,
            ],
            ["Trading activated / sealed", d?.activated],
          ].map(([label, ok]) => (
            <div key={String(label)}>
              <span className={ok ? "mint" : "amber"}>{ok ? "✓" : "○"}</span>
              <span>{label}</span>
              <span>{ok ? "Yes" : "Pending"}</span>
            </div>
          ))}
        </div>
        <AddressLink address={d?.owner} label="Immutable owner" />
        <label className="check">
          <input
            type="checkbox"
            checked={unsigned}
            onChange={(e) => setUnsigned(e.target.checked)}
          />
          Download unsigned transactions for Safe review instead of wallet
          submission
        </label>
      </Panel>
      {error && <Alert error>{error}</Alert>}
      <div className="two-col">
        <Panel title="1 · Migration funding">
          <p>
            Backing {display(d?.backing)} / remaining capacity{" "}
            {display(d?.capacity)} UNLK2. The 700m reserve is part of the
            founder’s initial 750m remainder; founder allocation remains 50m.
          </p>
          <AddressLink address={d?.vault} label="Immutable migration vault" />
          <Action
            onClick={() => void act("fund")}
            reason={reason ?? (d?.funded ? "Already backed." : undefined)}
          >
            Review exact reserve top-up
          </Action>
        </Panel>
        <Panel title="2 · Universal Router">
          <AddressLink address={r.d.network.uniswapV4.universalRouter} />
          <p>
            Uses the locker’s authenticated msgSender(). Unregistered routers
            share rights; a wrong registration cannot be fixed after sealing.
          </p>
          <Action onClick={() => void act("router")} reason={reason}>
            Review router registration
          </Action>
        </Panel>
        <Panel title="3 · Native proof adapter">
          <p>
            The native distributor’s roundOf / claimed interface is incompatible
            directly. Only the reviewed NativeSwarmAdapter may be installed. It
            verifies the full canonical tree at deployment and native proof plus
            actual claimed state at sync.
          </p>
          <AddressLink
            address={r.repair.nativeDistributor}
            label="Authentic native distributor"
          />
          <Action
            onClick={() => void act("adapter")}
            reason={
              reason ??
              (!r.repair.adapter
                ? "Pending adapter deployment, allocation corpus and review."
                : undefined)
            }
          >
            Review adapter setting
          </Action>
        </Panel>
        <Panel title="4 · Wallet quoter">
          <p>
            Register WalletQuoter to attribute quote simulations to their
            caller. It cannot settle a swap. Stock V4Quoter lacks compatible
            trader authentication and must remain unregistered.
          </p>
          <Action
            onClick={() => void act("quoter")}
            reason={
              reason ??
              (!r.repair.quoter
                ? "Pending quoter deployment and Universal Router fork equivalence proof."
                : undefined)
            }
          >
            Review quoter registration
          </Action>
        </Panel>
      </div>
      <Panel title="5 · Activation · disabled">
        <p>
          Pending canonical allocation inputs, auxiliary installation and
          independent mainnet-fork equivalence evidence. activate() itself does
          not enforce router/distributor configuration; a successful activation
          simulation alone is insufficient.
        </p>
        <button disabled>
          Activation disabled · mandatory installation and review outstanding
        </button>
        <p>
          Post-activation liquidity additions are restricted to the factory.
          Migration principal cannot be withdrawn, gate openings cannot be
          reversed and the contract has no pause or configuration recovery.
        </p>
      </Panel>
    </>
  );
}
