import { useState } from "react";
import { getAddress, parseAbi } from "viem";
import { useApp } from "./context";
import {
  Action,
  AddressLink,
  Alert,
  display,
  Field,
  Panel,
} from "./components";
import { errorText, same } from "./core";
const ZERO = "0x0000000000000000000000000000000000000000";
export function Founder() {
  const { r, data: d, wallet: w, request } = useApp();
  const [distributor, setDistributor] = useState(""),
    [supported, setSupported] = useState(true),
    [error, setError] = useState("");
  const isOwner = !!d && same(w.address, d.owner);
  const reason = !d
    ? "Waiting for verified owner and setup state."
    : !isOwner
      ? "Connect the contract owner’s wallet to prepare setup transactions."
      : d.activated
        ? "Configuration is permanently sealed."
        : undefined;
  const prepare = (kind: "fund" | "router" | "distributor" | "activate") => {
    if (!d || !isOwner || d.activated) return;
    setError("");
    const common = { prepareOnly: true, account: d.owner };
    if (kind === "fund") {
      const deficit = d.capacity > d.backing ? d.capacity - d.backing : 0n;
      if (deficit === 0n) return;
      request({
        ...common,
        title: "Prepare migration funding",
        description: `Transfer ${display(deficit, 18, 18)} UNLK2 from owner to the immutable migration vault. This fills the remaining backing deficit. Download only; this interface will not broadcast owner setup.`,
        address: r.addresses.UnlockV2Token,
        abi: r.abis.UnlockV2Token,
        functionName: "transfer",
        args: [d.vault, deficit],
        irreversible: true,
      });
    }
    if (kind === "router")
      request({
        ...common,
        title: "Prepare router registration",
        description: `Set ${r.d.network.uniswapV4.universalRouter} as ${supported ? "supported" : "unsupported"} for msgSender() trader attribution. Verify the router implementation before activation.`,
        address: r.addresses.UnlockV2Hook,
        abi: r.abis.UnlockV2Hook,
        functionName: "setRouter",
        args: [r.d.network.uniswapV4.universalRouter, supported],
      });
    if (kind === "activate")
      request({
        ...common,
        title: "Prepare permanent activation",
        description:
          "Activate trading and permanently seal all configuration. The migration reserve must be fully backed, the token bound and pricing references valid. Router and distributor configuration cannot be repaired afterwards. Exactly 50m founder rights, less earlier uncredited burns, are credited. Download only; nothing is broadcast here.",
        address: r.addresses.UnlockV2Hook,
        abi: r.abis.UnlockV2Hook,
        functionName: "activate",
        irreversible: true,
      });
  };
  const setupDistributor = async () => {
    if (!d || !isOwner) return;
    setError("");
    try {
      const target = getAddress(distributor.trim());
      if (same(target, ZERO))
        throw Error("Enter the actual launch distributor address.");
      const code = await r.client.getCode({ address: target });
      if (!code || code === "0x")
        throw Error("The distributor has no contract code.");
      const abi = parseAbi([
        "function merkleRoot() view returns(bytes32)",
        "function isClaimed(uint256) view returns(bool)",
      ]);
      await Promise.all([
        r.client.readContract({
          address: target,
          abi,
          functionName: "merkleRoot",
        }),
        r.client.readContract({
          address: target,
          abi,
          functionName: "isClaimed",
          args: [0n],
        }),
      ]);
      request({
        title: "Prepare swarm distributor",
        description: `Set the actual native swarm MerkleDistributor to ${target}. Confirm it uses the accepted leaf format and contains this launch’s allocations. The interface check does not validate the allocation tree. Download only.`,
        prepareOnly: true,
        account: d.owner,
        address: r.addresses.UnlockV2Hook,
        abi: r.abis.UnlockV2Hook,
        functionName: "setSwarmDistributor",
        args: [target],
      });
    } catch (e) {
      setError(errorText(e));
    }
  };
  const ready =
    !!d &&
    d.poolInitialized &&
    d.isBound &&
    d.funded &&
    d.reference &&
    d.tokenPrice[1] &&
    d.routerSupported &&
    !same(d.swarm, ZERO);
  return (
    <>
      <Alert>
        Owner setup produces unsigned transaction files only. Review and
        simulate each step in order in your owner wallet or Safe. No setup,
        funding or activation transaction is broadcast by this screen.
      </Alert>
      <div className="two-col">
        <Panel title="Activation checklist">
          <div className="checklist">
            {[
              ["Official pool initialized", d?.poolInitialized],
              ["Hook bound to UNLK2", d?.isBound],
              ["Remaining migration capacity backed", d?.funded],
              ["Pricing references valid", d?.reference && d?.tokenPrice[1]],
              ["Universal Router registered", d?.routerSupported],
              [
                "Native swarm distributor configured",
                d ? !same(d.swarm, ZERO) : undefined,
              ],
              ["Trading activated / permanently sealed", d?.activated],
            ].map(([name, ok]) => (
              <div key={String(name)}>
                <span className={ok ? "mint" : "amber"}>
                  {ok === undefined ? "?" : ok ? "✓" : "○"}
                </span>
                <span>{name}</span>
                <span>{ok === undefined ? "Unread" : ok ? "Yes" : "No"}</span>
              </div>
            ))}
          </div>
          <AddressLink address={d?.owner} label="Contract owner" />
          <p>
            The owner must complete router and swarm setup even though
            activate() does not enforce either setting. This interface requires
            both before preparing activation.
          </p>
          <p>
            Inspect existing liquidity before sealing. Liquidity may be added
            while trading is closed. After activation only the factory may add;
            removals remain available. This terminal does not invent a liquidity
            manager.
          </p>
        </Panel>
        <Panel title="1. Fund the migration reserve">
          <p>
            The founder’s 750m remainder includes the 700m reserve and only 50m
            founder allocation. The allocation sums to 1 billion: pool 150m +
            swarm 100m + migration 700m + founder 50m.
          </p>
          <p>
            Actual backing: {display(d?.backing)} UNLK2. Remaining capacity:{" "}
            {display(d?.capacity)} UNLK2.
          </p>
          <p>
            Required top-up:{" "}
            {d
              ? display(d.capacity > d.backing ? d.capacity - d.backing : 0n)
              : "Unavailable"}{" "}
            UNLK2.
          </p>
          <AddressLink address={d?.vault} label="Immutable migration vault" />
          <Action
            secondary
            onClick={() => prepare("fund")}
            reason={
              reason ??
              (d?.funded
                ? "The remaining migration capacity is already backed."
                : d && (d.balance ?? 0n) < d.capacity - d.backing
                  ? "Owner balance is below the funding deficit."
                  : undefined)
            }
          >
            Prepare unsigned funding
          </Action>
          <p className="helper">
            Migration principal cannot be withdrawn. Funding is a token
            transfer, with no token approval.
          </p>
        </Panel>
        <Panel title="2. Register the supported router">
          <AddressLink
            address={r.d.network.uniswapV4.universalRouter}
            label="Configured Universal Router"
          />
          <label className="check">
            <input
              type="checkbox"
              checked={supported}
              onChange={(e) => setSupported(e.target.checked)}
            />
            Router is supported for individual trader attribution
          </label>
          <Action secondary onClick={() => prepare("router")} reason={reason}>
            Prepare unsigned router setting
          </Action>
          <p>
            Only register a router whose msgSender() reports the actual trader.
            Unregistered routers pool all users’ rights at the router address. A
            router cannot be added after activation.
          </p>
        </Panel>
        <Panel title="3. Set the native swarm distributor">
          <p>
            Use the actual distributor from the launch record. No distributor
            address is guessed or bundled. It must expose merkleRoot() and
            isClaimed(index) with the accepted Uniswap leaf format.
          </p>
          <AddressLink
            address={d && !same(d.swarm, ZERO) ? d.swarm : undefined}
            label="Current swarm distributor"
          />
          <Field
            label="Actual launch distributor address"
            value={distributor}
            onChange={setDistributor}
            hint="Checksummed Ethereum address. Verify the launch’s Merkle tree before sealing."
          />
          {error && <Alert error>{error}</Alert>}
          <Action
            secondary
            onClick={() => void setupDistributor()}
            reason={reason}
          >
            Prepare unsigned distributor setting
          </Action>
        </Panel>
      </div>
      <Panel title="4. Activate and seal permanently">
        <p>
          Complete and confirm the preceding transactions, refresh this
          checklist, then prepare activation. Once confirmed, all owner settings
          are immutable. There is no delay, pause switch or recovery method.
        </p>
        <Action
          onClick={() => prepare("activate")}
          reason={
            reason ??
            (!ready
              ? "Complete every setup prerequisite and refresh before preparing activation."
              : undefined)
          }
        >
          Prepare unsigned activation
        </Action>
      </Panel>
    </>
  );
}
