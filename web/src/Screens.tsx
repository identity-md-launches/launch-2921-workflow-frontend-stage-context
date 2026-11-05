import { EnergyCore } from "./EnergyCore";
import { adapterAbi, verifyAuxiliary } from "./integration";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatUnits,
  isAddress,
  maxUint256,
  type Address,
  type Hex,
} from "viem";
import { useApp } from "./context";
import {
  Action,
  AddressLink,
  Alert,
  ContractAction,
  display,
  exact,
  EmptyWallet,
  Field,
  Panel,
  Stat,
} from "./components";
import { amount, erc20Abi, errorText, same } from "./core";
import { GateProgress } from "./Trade";
import { allowanceAfterOpening } from "./burn-preview";
import type { Data } from "./state";
const ZERO = "0x0000000000000000000000000000000000000000";
export function Gates() {
  const { data: d, view } = useApp();
  return (
    <>
      <div className="two-col">
        <Panel title="Gate progress">
          <GateProgress />
        </Panel>
        <Panel title="How gates open">
          <p>
            Any one threshold opens the next gate globally and forever. Falling
            prices never relock a gate. Gates are evaluated in order; a single
            observation can open several.
          </p>
          <p>
            FDV uses current supply, including reserves and excluding burned
            tokens. The first official swap in a later block observes the
            settled price. The IMD-per-ETH tracker moves at most 5% per hour
            with a four-hour elapsed-time cap. Gate IMD/USD uses the lower of
            spot and the tracker-derived USD rate; IMD price declines count
            immediately.
          </p>
          <p>
            Volume is cumulative gross official USD volume, not organic demand.
            It counts successful executed IMD legs once, including repeated
            trades by the same account. Failed swaps, transfers and external
            pools are excluded.
          </p>
          <button onClick={() => view("Burn & Points")}>
            Contribute to the current gate →
          </button>
        </Panel>
      </div>
      <Panel title="Ten permanent gates">
        <div className="table-wrap">
          <table>
            <caption>
              Onchain thresholds. Burn targets are per gate; volume is
              cumulative.
            </caption>
            <thead>
              <tr>
                <th>Gate</th>
                <th>Sell</th>
                <th>FDV USD</th>
                <th>Volume USD</th>
                <th>Burn UNLK2</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => {
                const g = d?.gateTable[i];
                return (
                  <tr key={i} className={d && i < d.gates ? "opened" : ""}>
                    <th>
                      {i + 1}
                      {d && i < d.gates ? " ✓" : ""}
                    </th>
                    <td>{g ? `${g[0]}%` : "—"}</td>
                    {[g?.[1], g?.[2], g?.[3]].map((n, j) => (
                      <td
                        key={j}
                        title={
                          n === undefined ? "Not read" : formatUnits(n, 18)
                        }
                      >
                        {n === undefined ? "Unread" : compact(n)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="helper">
          Contributions already burned are never refunded, even if price or
          volume opens the gate first. The next gate starts its own burn
          counter. Gate 10 removes all quotas, including for uncredited tokens.
        </p>
      </Panel>
    </>
  );
}
const compact = (n: bigint) => {
  const x = Number(formatUnits(n, 18));
  return x >= 1000000
    ? `${x / 1000000}m`
    : x >= 1000
      ? `${x / 1000}k`
      : x.toString();
};
export function Migrate() {
  const { r, data: d, wallet: w, request } = useApp();
  const [input, setInput] = useState(""),
    [allowance, setAllowance] = useState<bigint>(),
    [error, setError] = useState(""),
    [ack, setAck] = useState(false);
  useEffect(() => {
    setAllowance(undefined);
    setError("");
    if (d && w.address)
      r.client
        .readContract({
          address: d.v1,
          abi: erc20Abi,
          functionName: "allowance",
          args: [w.address, d.vault],
        })
        .then(setAllowance)
        .catch((e) => setError(errorText(e)));
  }, [r, d?.time, w.address, d?.vault]);
  const go = () => {
    if (!d) return;
    setError("");
    try {
      const n = amount(input, d.v1Decimals);
      if (n > d.capacity)
        throw Error(
          "Amount exceeds the lifetime migration capacity remaining.",
        );
      if (n > d.backing)
        throw Error(
          "The migration vault does not have enough backing for this amount.",
        );
      if (n > (d.v1Balance ?? 0n))
        throw Error("Amount exceeds your V1 balance.");
      if (allowance === undefined)
        throw Error("Wait for the V1 allowance read or refresh.");
      if (allowance < n)
        request({
          title: "Approve V1 for migration",
          description: `Approve exactly ${formatUnits(n, d.v1Decimals)} V1 for the immutable migration vault. Migration is a separate confirmation.`,
          address: d.v1,
          abi: erc20Abi,
          functionName: "approve",
          args: [d.vault, n],
        });
      else
        request({
          title: "Migrate V1 to UNLK2",
          description: `Permanently lock ${formatUnits(n, d.v1Decimals)} V1 and receive ${formatUnits(n, 18)} UNLK2 atomically. V1 cannot be released or reused.`,
          address: d.vault,
          abi: r.abis.MigrationVault,
          functionName: "migrate",
          args: [n],
          irreversible: true,
        });
    } catch (e) {
      setError(errorText(e));
    }
  };
  let needsApproval = true;
  try {
    needsApproval =
      allowance === undefined || allowance < amount(input, d?.v1Decimals ?? 18);
  } catch {
    /* validated on action */
  }
  return (
    <div className="two-col">
      <Panel title="Migrate 1:1">
        <p>Any V1 holder can migrate, regardless of purchase date or source.</p>
        <div className="metrics">
          <Stat
            label="Your V1"
            value={
              w.address
                ? display(d?.v1Balance, d?.v1Decimals)
                : "Connect wallet"
            }
            unit="V1"
          />
          <Stat
            label="Your V2"
            value={w.address ? display(d?.balance) : "Connect wallet"}
            unit="UNLK2"
          />
        </div>
        <Field
          label="V1 amount"
          value={input}
          onChange={setInput}
          inputMode="decimal"
          placeholder="0.00"
          hint="You receive the same amount in UNLK2. No migration fee; ETH is required for gas."
        />
        <label className="check">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          I understand my V1 will be locked forever.
        </label>
        {error && <Alert error>{error}</Alert>}
        <Action
          onClick={go}
          reason={
            !d
              ? "Waiting for migration state."
              : d.v1Decimals !== 18
                ? "V1 decimals differ from the expected 1:1 unit basis. Transactions disabled."
                : !ack
                  ? "Read and acknowledge the permanent V1 lock."
                  : w.address && allowance === undefined
                    ? "Reading V1 allowance."
                    : d.capacity === 0n
                      ? "The lifetime migration cap has been reached."
                      : d.backing === 0n
                        ? "Owner funding is required before migration can proceed."
                        : undefined
          }
        >
          {needsApproval ? "Approve V1" : "Review migration"}
        </Action>
        <p className="helper">
          Approval is limited to your entered amount. After confirmation,
          refresh the allowance and migrate. Migration works before and after
          activation, including after gate 10.
        </p>
      </Panel>
      <Panel title="Reserve and capacity">
        <div className="metrics">
          <Stat
            label="Lifetime cap"
            value={display(d?.cap, 18, 0)}
            unit="UNLK2"
          />
          <Stat
            label="Remaining capacity"
            value={display(d?.capacity, 18, 0)}
            unit="UNLK2"
          />
          <Stat
            label="Actual backing"
            value={display(d?.backing, 18, 0)}
            unit="UNLK2"
          />
          <Stat
            label="Migrated"
            value={display(d?.migrated, 18, 0)}
            unit="UNLK2"
          />
          <Stat
            label="V1 locked forever"
            value={display(d?.lockedV1, d?.v1Decimals, 0)}
            unit="V1"
          />
          <Stat
            label="Fully backed"
            value={d ? (d.funded ? "Yes" : "No") : "Unread"}
          />
        </div>
        <Alert>
          The 700 million cap cannot cover the entire V1 supply. Capacity is
          first come, first served, with no deadline and no reserve recovery.
        </Alert>
        <p>
          Migrated tokens enter the “other” origin bucket: 0% before gate 1,
          then the global gate percentage. Prior sales keep counting.
        </p>
        <h3>Keep V1 accessible</h3>
        <AddressLink address={d?.v1} label="V1 token on Etherscan" />
        <AddressLink address={d?.vault} label="Immutable migration vault" />
        <p className="muted">
          V1 remains a separate token. This site does not replace or modify its
          contract.
        </p>
      </Panel>
    </div>
  );
}
export function Rights() {
  const { r, data: d, wallet: w, request, view, stale } = useApp();
  const [claimAmount, setClaimAmount] = useState(""),
    [proof, setProof] = useState(""),
    [error, setError] = useState("");
  const credit = async () => {
    if (!d || !w.address) return;
    setError("");
    try {
      const n = amount(claimAmount);
      const p = proof.trim() ? proof.trim().split(/[\s,]+/) : [];
      if (p.some((x) => !/^0x[\da-f]{64}$/i.test(x)))
        throw Error(
          "Each proof element must be a 32-byte hex value. An empty proof is allowed for a single-leaf tree.",
        );
      const target = await verifyAuxiliary(r, "adapter", d.swarm);
      const credited = await r.client.readContract({
        address: target,
        abi: adapterAbi,
        functionName: "synced",
        args: [w.address],
      });
      if (credited)
        throw Error("This native round/account has already been credited.");
      request({
        title: "Verify swarm claim credit",
        description: `Verify existing native round-0 swarm claim for ${formatUnits(n, 18)} UNLK2 to ${w.address}. This records rights once; it does not claim tokens from a distributor. Earlier uncredited burns are netted first.`,
        address: target,
        abi: adapterAbi,
        functionName: "syncClaim",
        args: [w.address, n, p as Hex[]],
      });
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <>
      <div className="two-col">
        <Panel title="Your official-pool rights">
          {!w.address ? (
            <EmptyWallet />
          ) : (
            <>
              <Stat
                label="Current sell allowance"
                value={
                  d?.gates === 10 ? "Unlimited" : display(d?.sellAllowance)
                }
                unit="UNLK2"
              />
              <p className="helper">
                Your balance is {display(d?.balance)} UNLK2. Allowance is
                cumulative eligibility; a sale still requires enough balance.
              </p>
              <table>
                <caption>Account origin counters (UNLK2)</caption>
                <thead>
                  <tr>
                    <th>Origin</th>
                    <th>Credited</th>
                    <th>Sold</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Official buys</th>
                    <td>{display(d?.rights?.buyCredited)}</td>
                    <td>{display(d?.rights?.buySold)}</td>
                  </tr>
                  <tr>
                    <th>Migrate / swarm / founder</th>
                    <td>{display(d?.rights?.otherCredited)}</td>
                    <td>{display(d?.rights?.otherSold)}</td>
                  </tr>
                </tbody>
              </table>
              <p>
                Unmatured buys: {display(d?.rights?.pendingBuy)} UNLK2
                {d?.rights?.pendingBuy
                  ? ` (recorded at block ${d.rights.pendingBlock.toString()})`
                  : ""}
                . Buys mature after one block.
              </p>
              <p>
                Earlier uncredited burns awaiting netting:{" "}
                {display(d?.uncreditedBurned)} UNLK2.
              </p>
            </>
          )}
          <button className="full" onClick={() => view("Burn & Points")}>
            Preview a burn’s effect on your rights →
          </button>
        </Panel>
        <Panel title="What creates eligibility">
          <p>
            Before gate 1, credited official buys have 20% cumulative sell
            rights. Migrated tokens, the founder’s 50 million and verified
            native swarm claims have 0%. After gate 1, all credited origins use
            the same global percentage.
          </p>
          <p>
            Each bucket’s allowance is max(credited × percentage / 100 − sold,
            0). Sales debit buys first. Previous sales never reset. Ordinary
            incoming transfers and balance alone grant no eligibility.
          </p>
          <p>
            Rights stay with accounts when tokens move. A credited account may
            later use its remaining allowance on received tokens. Gate 10
            bypasses quotas for every holder.
          </p>
          <Alert>
            Only registered routers authenticate individual traders through
            msgSender(). Unregistered contracts share one allowance across all
            their users. These restrictions govern the official pool; external
            pools are not prevented.
          </Alert>
          <p>
            Current buy / other percentages:{" "}
            {d ? `${d.percents[0]}% / ${d.percents[1]}%` : "Unavailable"}.
            Pending FDV observation:{" "}
            {d && !stale && d.gatePrice[1] && d.tokenPrice[1]
              ? `${d.pendingGates} gates would be open`
              : "Unavailable"}
            .
          </p>
        </Panel>
      </div>
      <Panel title="Verify native swarm evidence">
        <p>
          Paste the original allocation and native double-hashed Merkle proof
          from your actual launch claim. The distributor must already mark the
          claim as completed. The adapter derives a domain-separated index; each
          account/round is credited only once. Native tokens must be claimed
          through the original distributor before syncing rights.
        </p>
        {d && same(d.swarm, ZERO) && (
          <Alert>
            NativeSwarmAdapter installation is pending. Native claim evidence
            cannot be credited through the hook directly.
          </Alert>
        )}
        <div className="form-grid">
          <Field
            label="Original claim amount (UNLK2)"
            value={claimAmount}
            onChange={setClaimAmount}
            inputMode="decimal"
          />
        </div>
        <label htmlFor="swarm-proof">
          Merkle proof (comma or space separated)
        </label>
        <textarea
          id="swarm-proof"
          rows={3}
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          spellCheck={false}
        />
        {error && <Alert error>{error}</Alert>}
        <Action
          onClick={() => void credit()}
          reason={
            !d
              ? "Waiting for distributor state."
              : !r.repair.adapter || same(d.swarm, ZERO)
                ? "NativeSwarmAdapter installation is pending."
                : undefined
          }
        >
          Verify claim evidence
        </Action>
        <AddressLink
          address={d && !same(d.swarm, ZERO) ? d.swarm : undefined}
          label="Configured native compatibility adapter"
        />
      </Panel>
      <Transfer />
    </>
  );
}
function Transfer() {
  const { r, data: d, wallet: w, request } = useApp();
  const [recipient, setRecipient] = useState(""),
    [input, setInput] = useState(""),
    [error, setError] = useState("");
  const send = async () => {
    setError("");
    try {
      let to: Address;
      if (isAddress(recipient.trim())) to = recipient.trim() as Address;
      else {
        const resolved = await r.client.getEnsAddress({
          name: recipient.trim(),
        });
        if (!resolved)
          throw Error("Enter a valid Ethereum address or resolvable ENS name.");
        to = resolved;
      }
      if (same(to, ZERO))
        throw Error(
          "Use Burn & Points for a burn. The zero address cannot receive a transfer.",
        );
      const n = amount(input);
      if (n > (d?.balance ?? 0n))
        throw Error("Amount exceeds your UNLK2 balance.");
      request({
        title: "Transfer UNLK2",
        description: `Send ${formatUnits(n, 18)} UNLK2 to ${to}. Transfers do not grant sell rights to the recipient.`,
        address: r.addresses.UnlockV2Token,
        abi: r.abis.UnlockV2Token,
        functionName: "transfer",
        args: [to, n],
      });
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <details className="panel">
      <summary>Transfer UNLK2</summary>
      <p>The recipient receives tokens, but no official-pool eligibility.</p>
      <Field
        label="Recipient address or ENS"
        value={recipient}
        onChange={setRecipient}
      />
      <Field
        label="Amount (UNLK2)"
        value={input}
        onChange={setInput}
        inputMode="decimal"
      />
      {error && <Alert error>{error}</Alert>}
      <Action
        secondary
        onClick={() => void send()}
        reason={w.address && !d ? "Waiting for balance." : undefined}
      >
        Review transfer
      </Action>
    </details>
  );
}
export function Burn({ home = false }: { home?: boolean } = {}) {
  const { r, data: d, wallet: w, request } = useApp();
  const [input, setInput] = useState(""),
    [contributionMode, setContribute] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [preview, setPreview] = useState<{
      values: readonly bigint[];
      n: bigint;
      gate: number;
      max: bigint;
      at: number;
      openingAllowance?: bigint;
      totalPoints: bigint;
      myPoints: bigint;
      rights: NonNullable<Data["rights"]>;
    }>();
  const [confirmedBurn, setConfirmedBurn] = useState<{
    n: bigint;
    hash: string;
  }>();
  const [animateBurn, setAnimateBurn] = useState(false);
  const burnActor = useRef(`${w.chainId}:${w.address}`);
  burnActor.current = `${w.chainId}:${w.address}`;
  useEffect(() => {
    setConfirmedBurn(undefined);
    setAnimateBurn(false);
  }, [w.address, w.chainId]);
  useEffect(() => {
    if (confirmedBurn === undefined) return;
    setAnimateBurn(true);
    const timer = setTimeout(() => setAnimateBurn(false), 2400);
    return () => clearTimeout(timer);
  }, [confirmedBurn]);
  const contribute = contributionMode && d?.gates !== 10;
  useEffect(() => {
    setPreview(undefined);
    setError("");
  }, [input, contribute, w.address, w.chainId, d?.gates]);
  const previewVersion = useRef(0);
  useEffect(() => {
    ++previewVersion.current;
  }, [input, contribute, w.address, w.chainId, d?.gates]);
  const readPreview = async () => {
    const version = ++previewVersion.current;
    const selectedGate = d?.contribution[0];
    if (!w.address || !d) return;
    setError("");
    setPending(true);
    try {
      const n = amount(input);
      if (n > (d.balance ?? 0n))
        throw Error("Amount exceeds your UNLK2 balance.");
      const block = await r.client.getBlockNumber();
      const [values, q, rights, totalPoints, myPoints] = await Promise.all([
        r.client.readContract({
          address: r.addresses.UnlockV2Hook,
          abi: r.abis.UnlockV2Hook,
          functionName: "previewBurn",
          args: [w.address, n],
          blockNumber: block,
        }),
        r.client.readContract({
          address: r.addresses.UnlockV2Hook,
          abi: r.abis.UnlockV2Hook,
          functionName: "contributionQuote",
          blockNumber: block,
        }),
        r.client.readContract({
          address: r.addresses.UnlockV2Hook,
          abi: r.abis.UnlockV2Hook,
          functionName: "rightsOf",
          args: [w.address],
          blockNumber: block,
        }),
        r.client.readContract({
          address: d.pot,
          abi: r.abis.RewardPot,
          functionName: "totalPoints",
          blockNumber: block,
        }),
        r.client.readContract({
          address: d.pot,
          abi: r.abis.RewardPot,
          functionName: "points",
          args: [w.address],
          blockNumber: block,
        }),
      ]);
      if (version !== previewVersion.current) return;
      const [gate, max] = q as readonly [number, bigint];
      if (contribute && gate !== selectedGate)
        throw Error(
          "The collecting gate changed. Refresh state and explicitly preview the new gate.",
        );
      if (contribute && (!gate || n > max))
        throw Error(
          gate
            ? "This contribution exceeds the gate remainder. Reduce the amount and preview again."
            : "Golden Vault is open. Use voluntary burn.",
        );
      setPreview({
        values: values as readonly bigint[],
        n,
        gate,
        max,
        at: Date.now(),
        openingAllowance:
          contribute && n === max
            ? allowanceAfterOpening(
                rights as NonNullable<typeof d.rights>,
                values as readonly bigint[],
                gate,
                d.gateTable[gate - 1][0],
                block,
              )
            : undefined,
        totalPoints: totalPoints as bigint,
        myPoints: myPoints as bigint,
        rights: rights as NonNullable<Data["rights"]>,
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  };
  const burn = () => {
    if (!preview) return;
    if (Date.now() - preview.at > 60000) {
      setPreview(undefined);
      setError("Burn preview expired. Read a fresh preview.");
      return;
    }
    const id = previewVersion.current;
    request({
      title: contribute ? "Contribute and burn" : "Burn for points",
      description: `Destroy ${formatUnits(preview.n, 18)} UNLK2 permanently and earn ${formatUnits(preview.n, 18)} nontransferable points.${contribute ? ` Contribute only to gate ${preview.gate}; a changed gate or excessive amount reverts.` : " This voluntary burn will not advance any gate."} Your credits will decrease: pending ${formatUnits(preview.values[0], 18)}, buy ${formatUnits(preview.values[1], 18)}, other ${formatUnits(preview.values[2], 18)}. Sales never reset.`,
      address: r.addresses.UnlockV2Token,
      abi: r.abis.UnlockV2Token,
      functionName: contribute ? "contribute" : "burn",
      args: contribute ? [preview.gate, preview.n] : [preview.n],
      irreversible: true,
      validUntil: preview.at + 60000,
      onConfirmed: (receipt) => {
        if (burnActor.current !== `${w.chainId}:${w.address}`) return;
        const from = w.address?.toLowerCase().slice(2).padStart(64, "0");
        if (
          receipt.logs.some(
            (log) =>
              log.address.toLowerCase() ===
                r.addresses.UnlockV2Token.toLowerCase() &&
              log.topics[0] ===
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
              log.topics[1]?.slice(2) === from &&
              log.topics[2] === "0x" + "0".repeat(64) &&
              BigInt(log.data) === preview.n,
          )
        ) {
          setConfirmedBurn({ n: preview.n, hash: receipt.transactionHash });
          setPreview(undefined);
          setInput("");
        }
      },
      validate: async () => {
        if (id !== previewVersion.current)
          throw Error("Burn inputs or wallet changed. Read a new preview.");
        const block = await r.client.getBlockNumber();
        const current = (await r.client.readContract({
          address: r.addresses.UnlockV2Hook,
          abi: r.abis.UnlockV2Hook,
          functionName: "previewBurn",
          args: [w.address!, preview.n],
          blockNumber: block,
        })) as readonly bigint[];
        const rights = (await r.client.readContract({
          address: r.addresses.UnlockV2Hook,
          abi: r.abis.UnlockV2Hook,
          functionName: "rightsOf",
          args: [w.address!],
          blockNumber: block,
        })) as NonNullable<Data["rights"]>;
        if (current.some((value, i) => value !== preview.values[i]))
          throw Error(
            "Your burn debits or rights changed. Close and read a new preview.",
          );
        if (
          (Object.keys(preview.rights) as (keyof typeof rights)[]).some(
            (key) => rights[key] !== preview.rights[key],
          )
        )
          throw Error(
            "Your origin credits changed. Close and read a new preview.",
          );
        if (contribute) {
          const q = (await r.client.readContract({
            address: r.addresses.UnlockV2Hook,
            abi: r.abis.UnlockV2Hook,
            functionName: "contributionQuote",
            blockNumber: block,
          })) as readonly [number, bigint];
          if (q[0] !== preview.gate || q[1] < preview.n)
            throw Error(
              "Gate changed or capacity reduced. Review a new contribution preview.",
            );
        }
      },
    });
  };
  const total = preview?.totalPoints ?? d?.points ?? 0n;
  const mine = preview?.myPoints ?? d?.myPoints ?? 0n;
  return (
    <div className="two-col">
      <Panel
        title={
          home
            ? d?.gates === 10
              ? "Golden Vault · voluntary burning & continuing fee rewards"
              : "Contribute UNLK2 to the active gate"
            : "Burn & Points"
        }
      >
        <EnergyCore gold={d?.gates === 10} confirmed={animateBurn} />
        {confirmedBurn !== undefined && (
          <div className="burn-confirmation" role="status">
            <strong>Burn confirmed</strong>
            <span>{exact(confirmedBurn.n)} UNLK2 destroyed</span>
            <span>{exact(confirmedBurn.n)} points earned</span>
          </div>
        )}
        {!home && (
          <div className="segmented">
            <button
              aria-pressed={contribute}
              disabled={d?.gates === 10}
              onClick={() => setContribute(true)}
            >
              Gate contribution
            </button>
            <button
              aria-pressed={!contribute}
              onClick={() => setContribute(false)}
            >
              Voluntary burn
            </button>
          </div>
        )}
        <Alert>
          Burns are irreversible. UNLK2 is destroyed, not deposited. Points
          cannot be transferred or redeemed for the burned tokens.
        </Alert>
        <div className="metrics">
          <Stat
            label="Your balance"
            value={w.address ? display(d?.balance) : "Connect wallet"}
            unit="UNLK2"
          />
          <Stat
            label="Your points"
            value={w.address ? display(d?.myPoints) : "Connect wallet"}
          />
          <Stat
            label="Your reward share"
            value={
              !w.address
                ? "Connect wallet"
                : d?.myPoints === undefined
                  ? "Unavailable"
                  : d.points > 0n
                    ? `${Number((d.myPoints * 10000n) / d.points) / 100}%`
                    : "0%"
            }
            note="Share of future fees; changes with new points"
          />
        </div>
        <Field
          label="Amount to burn (UNLK2)"
          value={input}
          onChange={setInput}
          inputMode="decimal"
          placeholder="0.00"
        />
        <button
          className="small"
          disabled={!w.address || !d || d.balance === undefined}
          onClick={() => {
            const max =
              contribute && d
                ? (d.balance ?? 0n) < d.contribution[1]
                  ? (d.balance ?? 0n)
                  : d.contribution[1]
                : (d?.balance ?? 0n);
            setInput(formatUnits(max, 18));
          }}
        >
          Max · balance{contribute ? " / gate capacity" : ""}
        </button>
        {contribute && (
          <p>
            Collecting gate: {d ? d.contribution[0] || "None" : "Unavailable"} ·
            Maximum contribution: {display(d?.contribution[1])} UNLK2.
          </p>
        )}
        {error && <Alert error>{error}</Alert>}
        {preview ? (
          <>
            <h3>Onchain burn preview</h3>
            <dl className="compact-dl">
              {[
                "Pending buy debit",
                "Mature buy debit",
                "Other origin debit",
                "Uncredited balance burned",
                "Allowance after burn at current gate",
              ].map((label, i) => (
                <div className="dl-row" key={label}>
                  <dt>{label}</dt>
                  <dd>{exact(preview.values[i])} UNLK2</dd>
                </div>
              ))}
            </dl>
            <div className="metrics burn-preview-metrics">
              <Stat
                label="UNLK2 to burn"
                value={exact(preview.n)}
                unit="UNLK2"
              />
              <Stat label="Points to earn" value={exact(preview.n)} />
              <Stat
                label="Estimated future reward share"
                value={
                  total + preview.n > 0n
                    ? `${Number(((mine + preview.n) * 10000n) / (total + preview.n)) / 100}%`
                    : "0%"
                }
                note="Before later burns by others; no guaranteed reward"
              />
            </div>
            {preview.openingAllowance !== undefined && (
              <p>
                Allowance if this contribution opens gate {preview.gate}:{" "}
                <strong>{exact(preview.openingAllowance)} UNLK2</strong>. This
                is a preview, not a stored opening.
              </p>
            )}
            <p className="helper">
              The debit preview uses the current gate. Reward share changes as
              others earn points. Review again if your rights change.
            </p>
            <Action onClick={burn}>
              {contribute
                ? `Contribute UNLK2 · gate ${preview.gate}`
                : "Burn UNLK2 for points"}
            </Action>
            <button
              className="full"
              onClick={() => void readPreview()}
              disabled={pending}
            >
              Refresh burn preview
            </button>
          </>
        ) : (
          <Action
            onClick={() => void readPreview()}
            reason={
              !d
                ? "Waiting for balance and gate state."
                : pending
                  ? "Reading exact burn debits…"
                  : contribute && d.gates === 10
                    ? "All gates are open. Select voluntary burn."
                    : undefined
            }
          >
            {pending ? "Reading preview…" : "Preview burn and rights"}
          </Action>
        )}
      </Panel>
      <details
        className={home ? "home-burn-notes" : "panel"}
        open={home ? undefined : true}
      >
        <summary>Points, selling rights and weekly rewards</summary>
        <div className="metrics">
          <Stat label="Total points" value={display(d?.points)} />
          <Stat
            label="Total burned"
            value={display(d?.totalBurned)}
            unit="UNLK2"
          />
        </div>
        <p>
          1 UNLK2 burned earns 1 point, with 18-decimal precision. Contributions
          and voluntary burns both earn points. Only contributions count toward
          the collecting gate; they cannot exceed its remainder.
        </p>
        <p>
          Burn debits apply in order: unmatured buys, held buy credits (credited
          − sold), held other credits, then uncredited balance. Sold counters
          never decrease. Earlier uncredited burns are netted against later
          founder or swarm credit; migration credits are atomic.
        </p>
        <p>
          New points dilute everyone else’s share of future fees. Your points
          persist, but no future reward, trading volume or return is guaranteed.
          New burns do not gain already attributed rewards.
        </p>
        <p>
          Before any point exists, fees accumulate in the pre-point pot. From
          the first point, that fixed pot releases linearly over seven days.
          Later fees are attributed immediately to existing points; entitlements
          mature in weekly epochs from activation.
        </p>
      </details>
    </div>
  );
}
export function Rewards() {
  const { r, data: d, wallet: w } = useApp();
  return (
    <div className="two-col">
      <Panel title="Your weekly IMD">
        <div className="metrics">
          <Stat
            label="Matured / claimable"
            value={w.address ? display(d?.rewards?.[0]) : "Connect wallet"}
            unit="IMD"
          />
          <Stat
            label="Maturing this epoch"
            value={w.address ? display(d?.rewards?.[1]) : "Connect wallet"}
            unit="IMD"
          />
          <Stat
            label="Claimed to date"
            value={w.address ? display(d?.claimed) : "Connect wallet"}
            unit="IMD"
          />
          <Stat
            label="Your nontransferable points"
            value={w.address ? display(d?.myPoints) : "Connect wallet"}
          />
        </div>
        <p>
          Only your wallet can claim your matured rewards, paid to that same
          wallet. Entitlements do not expire. A claim can automatically redeem
          pending fees when the pot’s IMD balance is low.
        </p>
        <ContractAction
          tx={{
            title: "Claim matured IMD",
            description: `Claim ${display(d?.rewards?.[0])} matured IMD to your connected wallet. Current-epoch rewards remain maturing.`,
            address: d?.pot ?? r.addresses.UnlockV2Hook,
            abi: r.abis.RewardPot,
            functionName: "claim",
          }}
          reason={
            !d
              ? "Waiting for reward state."
              : !d.activated
                ? "Weekly epochs start at activation."
                : w.address && !d.rewards?.[0]
                  ? "No matured reward is available yet."
                  : undefined
          }
        />
        <p className="helper">
          Current epoch: {d?.activated ? d.epoch.toString() : "Not started"}.
          Next epoch:{" "}
          {d?.activated
            ? new Date(
                Number(d.epochStart + (d.epoch + 1n) * 604800n) * 1000,
              ).toUTCString()
            : "After activation"}
          .
        </p>
      </Panel>
      <Panel title="Reward accounting">
        <div className="metrics">
          <Stat
            label="Pre-point pot"
            value={display(d?.prePointPot)}
            unit="IMD"
          />
          <Stat
            label="Pre-point released"
            value={display(d?.released)}
            unit="IMD"
          />
          <Stat
            label="Pending fee redemption"
            value={display(d?.pendingFees)}
            unit="IMD"
          />
          <Stat
            label="Solvent"
            value={d ? (d.solvent ? "Yes" : "No") : "Unread"}
          />
        </div>
        <dl className="compact-dl">
          {[
            "Accrued fees",
            "Vested to points",
            "Redeemed IMD",
            "Paid to beneficiaries",
            "Unredeemed IMD",
            "Held IMD",
            "Pre-point unreleased",
          ].map((label, i) => (
            <div className="dl-row" key={label}>
              <dt>{label}</dt>
              <dd>{display(d?.solvency[i])} IMD</dd>
            </div>
          ))}
        </dl>
        <p>
          Pre-point release starts{" "}
          {d?.firstPoint
            ? new Date(Number(d.firstPoint) * 1000).toUTCString()
            : "when the first points are created"}
          ; it lasts seven days. Only this initial pot streams. New fees are
          attributed when earned.
        </p>
        <div className="form-grid">
          <ContractAction
            secondary
            tx={{
              title: "Checkpoint rewards",
              description:
                "Update the pre-point release and epoch accounting. Anyone may checkpoint; this does not claim for another beneficiary.",
              address: d?.pot ?? r.addresses.UnlockV2Hook,
              abi: r.abis.RewardPot,
              functionName: "checkpoint",
            }}
            reason={!d ? "Waiting for reward pot." : undefined}
          />
          <ContractAction
            secondary
            tx={{
              title: "Redeem fees to pot",
              description:
                "Move pending IMD fees from PoolManager claims to the RewardPot. They belong to point holders, not the caller.",
              address: r.addresses.UnlockV2Hook,
              abi: r.abis.UnlockV2Hook,
              functionName: "redeemFees",
            }}
            reason={
              !d
                ? "Waiting for fee state."
                : d.pendingFees === 0n
                  ? "No fees are pending."
                  : undefined
            }
          />
        </div>
      </Panel>
    </div>
  );
}
export function VaultSummary() {
  const { data: d, wallet: w, stale } = useApp();
  return (
    <Panel title="Golden Vault rewards">
      <div className="metrics">
        <Stat
          label="Accrued IMD · all beneficiaries"
          value={display(stale ? undefined : d?.solvency[0])}
          unit="IMD"
        />
        <Stat
          label="Your points"
          value={
            w.address
              ? display(stale ? undefined : d?.myPoints)
              : "Connect wallet"
          }
        />
        <Stat
          label="Your claimable reward"
          value={
            w.address
              ? display(stale ? undefined : d?.rewards?.[0])
              : "Connect wallet"
          }
          unit="IMD"
        />
        <Stat
          label="Your maturing reward"
          value={
            w.address
              ? display(stale ? undefined : d?.rewards?.[1])
              : "Connect wallet"
          }
          unit="IMD"
        />
      </div>
      <p>
        Next weekly distribution:{" "}
        {d?.activated && !stale
          ? new Date(
              Number(d.epochStart + (d.epoch + 1n) * 604800n) * 1000,
            ).toUTCString()
          : "After activation"}
        . Estimates of future rewards depend on actual fees and everyone’s
        points. No yield is guaranteed.
      </p>
      <a href="#weekly-imd-rewards">Review and claim matured IMD ↗</a>
    </Panel>
  );
}
export function Golden() {
  const { data: d, view } = useApp();
  return (
    <div className="two-col">
      <Panel title="Golden Vault">
        <div className="golden-graphic" aria-hidden="true">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <path
              d="M14 68V20h60v48H14ZM22 28h44v32H22ZM44 31v26M31 44h26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle
              cx="44"
              cy="44"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <h3>
          {d
            ? d.gates === 10
              ? "Open permanently"
              : "Opens at gate 10"
            : "Awaiting verified gate state"}
        </h3>
        <p>
          Golden Vault is the final state of the gate system. At gate 10 every
          holder can sell in the official pool without a quota, including
          holders of transferred or uncredited tokens.
        </p>
        <p>
          Gate contributions end. Voluntary burns remain available and continue
          earning points. All prior points and matured IMD rewards survive.
        </p>
        <button className="full" onClick={() => view("Burn & Points")}>
          Open Burn & Points →
        </button>
        <button className="full" onClick={() => view("Weekly IMD Rewards")}>
          View your IMD rewards →
        </button>
      </Panel>
      {d?.gates === 10 ? (
        <div>
          <Burn home />
          <VaultSummary />
        </div>
      ) : (
        <Panel title="What remains permanent">
          <p>
            There is no later mint, token upgrade, transfer tax, seizure or
            blacklist. Supply only decreases through holder-authorized burns.
          </p>
          <p>
            The owner’s configuration is permanently sealed on activation.
            Migration remains available while capacity and backing remain.
            Weekly beneficiary claims continue, with no expiry.
          </p>
          <Alert>
            Golden Vault is a protocol state, not a treasury investment or a
            promise of returns. Rewards depend on actual fees and are diluted by
            future points.
          </Alert>
        </Panel>
      )}
    </div>
  );
}
export function Rules() {
  const { r, data: d } = useApp();
  return (
    <>
      <div className="two-col">
        <Panel title="Rules you can verify">
          <p>
            UNLOCK V2 is an Ethereum Uniswap v4 token and hook. Exactly 1
            billion UNLK2 was minted once to the factory with 18 decimals.
            Holders may burn; no later mint exists.
          </p>
          <div className="allocation">
            <div>
              Pool <span>150m</span>
            </div>
            <div>
              Native swarm <span>100m</span>
            </div>
            <div>
              Migration reserve <span>700m</span>
            </div>
            <div>
              Founder <span>50m</span>
            </div>
          </div>
          <p>
            The factory’s 750m remainder includes the initial 700m funded into
            the immutable migration vault. Founder rights credit only the 50m
            allocation, net of earlier uncredited burns.
          </p>
          <p>
            The pool LP fee is 1.25% of swap input: 1% founder and 0.25%
            platform. The extra reward fee is 1% of the executed IMD leg, always
            for points holders. The fee bases differ.
          </p>
          <p>
            USD prices come only from the official pool, the native ETH/IMD
            reference pool and Chainlink ETH/USD. Stale or invalid references
            pause price and volume progress; existing rights, burns and
            migration remain available. Price manipulation remains a risk; gross
            volume is not organic demand.
          </p>
          <p>
            No chart or trade history is fabricated. This terminal displays
            contract snapshots. External pools are outside official sell quotas.
            V1 stays separate and accessible.
          </p>
        </Panel>
        <Panel title="Deployment attestation">
          <dl className="review-list">
            <dt>Chain</dt>
            <dd>
              {r.d.network.name} ({r.d.chainId})
            </dd>
            <dt>Source commit</dt>
            <dd className="address">{r.d.sourceCommit}</dd>
            <dt>Attestation hash</dt>
            <dd className="address">{r.d.attestationHash}</dd>
            <dt>Launch ID</dt>
            <dd className="address">{r.d.launchId}</dd>
          </dl>
          <a href="./imd-deployment.json" target="_blank" rel="noreferrer">
            Open runtime deployment manifest ↗
          </a>
          <p>
            Addresses and ABIs load from this same manifest. ABI canonical
            Keccak hashes are verified before use. The runtime checks RPC chain
            ID, contract code and companion bindings before transactions are
            enabled.
          </p>
          <p>
            Last successful snapshot:{" "}
            {d
              ? `${new Date(d.time).toUTCString()} · block ${d.block}`
              : "No successful snapshot yet"}
            .
          </p>
        </Panel>
      </div>
      <Panel title="Contracts and infrastructure">
        {r.d.contracts.map((c) => (
          <div className="contract-row" key={c.name}>
            <h3>{c.name}</h3>
            <AddressLink address={c.address} />
            <a href={`./${c.abiPath}`} target="_blank" rel="noreferrer">
              Implementation ABI ↗
            </a>
            <p className="address muted">Keccak: {c.abiHash}</p>
          </div>
        ))}
        {[
          ["MigrationVault", d?.vault],
          ["RewardPot", d?.pot],
          ["V1 token", d?.v1],
          ["IMD", r.d.network.pairToken.address],
          ["Owner", d?.owner],
          [
            "Configured swarm compatibility adapter",
            d && !same(d.swarm, ZERO) ? d.swarm : undefined,
          ],
          ["Authentic native distributor", r.repair.nativeDistributor],
          ["Reviewed wallet quoter", r.repair.quoter?.address],
          ...Object.entries(r.d.network.uniswapV4).filter(
            ([, v]) => typeof v === "string",
          ),
        ].map(([name, a]) => (
          <div className="contract-row" key={String(name)}>
            <h3>{name}</h3>
            <AddressLink address={a as string | undefined} />
          </div>
        ))}
        {d?.poolKey && (
          <>
            <h3>Official PoolKey</h3>
            <pre>{JSON.stringify(d.poolKey, null, 2)}</pre>
            <p className="address">Pool ID: {d.poolId}</p>
          </>
        )}
        <h3>Configured public RPCs</h3>
        {r.d.network.rpcUrls.map((url) => (
          <p className="address" key={url}>
            {url}
          </p>
        ))}
        <p className="helper">
          USD context is unavailable when onchain prices are invalid. No signing
          keys or private RPC credentials are stored by this application.
        </p>
      </Panel>
    </>
  );
}
