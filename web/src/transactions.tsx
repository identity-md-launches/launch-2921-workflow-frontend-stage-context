import { useEffect, useRef, useState } from "react";
import { encodeFunctionData, formatEther, type Hex } from "viem";
import { walletClient, type Runtime } from "./config";
import { errorText, same } from "./core";
import type { Transaction } from "./context";
import type { Wallet } from "./wallet";
import { Dialog } from "./components";

export function useTransactions(
  r: Runtime | undefined,
  w: Wallet,
  refresh: () => Promise<void>,
  verified: boolean,
) {
  const [review, setReview] = useState<Transaction>();
  const [showReview, setShowReview] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingReceipt, setAwaitingReceipt] = useState(false);
  const [hash, setHash] = useState<Hex>();
  const [gas, setGas] = useState<bigint>();
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const active = useRef({ address: w.address, chain: w.chainId });
  active.current = { address: w.address, chain: w.chainId };
  const submitted = useRef(false),
    running = useRef(false);
  useEffect(() => {
    if (!submitted.current && !awaitingReceipt) {
      setReview(undefined);
      setShowReview(false);
      setReady(false);
      setGas(undefined);
      setError("");
    }
  }, [w.address, w.chainId]);
  const request = (tx: Transaction) => {
    if (running.current || awaitingReceipt) {
      setShowReview(true);
      return;
    }
    setReview(tx);
    setShowReview(true);
    setConfirmed(false);
    setAccepted(false);
    setReady(false);
    setError("");
    setHash(undefined);
    setGas(undefined);
    setStage("Review the amount, contract and effect before continuing.");
  };
  const settleReceipt = async (txHash: Hex) => {
    if (!r) return;
    let reason = "";
    setStage("Submitted. Waiting for the onchain receipt…");
    const receipt = await r.client.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 180000,
      onReplaced: (replacement) => {
        reason = replacement.reason;
        setHash(replacement.transaction.hash);
        setStage(
          reason === "cancelled"
            ? "The transaction was cancelled in your wallet."
            : "Tracking the replacement transaction…",
        );
      },
    });
    setAwaitingReceipt(false);
    if (receipt.status !== "success")
      throw Object.assign(
        Error(
          "The transaction reverted onchain. Check the explorer, refresh state and retry.",
        ),
        { receiptResolved: true },
      );
    await refresh();
    setConfirmed(true);
    setReady(false);
    setStage(
      reason === "cancelled"
        ? "Cancelled in your wallet. The original action was not executed."
        : reason === "replaced"
          ? "Replacement confirmed. Inspect the explorer to verify its effect."
          : "Confirmed onchain.",
    );
  };
  const run = async () => {
    if (!r || !review || running.current || confirmed) return;
    running.current = true;
    setBusy(true);
    setError("");
    if (awaitingReceipt && hash) {
      try {
        await settleReceipt(hash);
      } catch (e) {
        setError(errorText(e));
        setStage(
          (e as { receiptResolved?: boolean }).receiptResolved
            ? "The transaction failed onchain. Refresh state before retrying."
            : "Receipt status is unresolved. Check the explorer or recheck; no new transaction will be submitted.",
        );
      } finally {
        running.current = false;
        setBusy(false);
      }
      return;
    }
    if (!verified) {
      running.current = false;
      setBusy(false);
      return;
    }
    const tx = review,
      account = tx.prepareOnly ? tx.account : w.address;
    if (!account) {
      running.current = false;
      setBusy(false);
      return;
    }
    let sentHash: Hex | undefined;
    try {
      if (!tx.prepareOnly) {
        if (
          !w.provider ||
          Number(await w.provider.request({ method: "eth_chainId" })) !==
            r.d.chainId
        )
          throw Error("Switch to the configured network before continuing.");
        const accounts = (await w.provider.request({
          method: "eth_accounts",
        })) as string[];
        if (!same(accounts[0], account))
          throw Error(
            "Your wallet account changed. Close this review and retry.",
          );
      }
      if (tx.validUntil && Date.now() > tx.validUntil)
        throw Error("Quote or preview expired. Close and refresh it.");
      await tx.validate?.();
      setStage("Simulating against current contract state…");
      const sim = await r.client.simulateContract({
        address: tx.address,
        abi: [
          ...tx.abi,
          ...r.abis.UnlockV2Hook,
          ...r.abis.UnlockV2Token,
          ...r.abis.MigrationVault,
          ...r.abis.RewardPot,
        ],
        functionName: tx.functionName,
        args: tx.args ?? [],
        account,
        value: tx.value ?? 0n,
      });
      const encoded = encodeFunctionData({
        abi: tx.abi,
        functionName: tx.functionName,
        args: tx.args ?? [],
      });
      const estimate = await r.client.estimateGas({
        account,
        to: tx.address,
        data: encoded,
        value: tx.value ?? 0n,
      });
      setGas(estimate);
      if (!ready) {
        setReady(true);
        setStage(
          tx.prepareOnly
            ? "Simulation passed. Download the unsigned transaction for owner review."
            : "Simulation passed. Confirm when you are ready to open your wallet.",
        );
        return;
      }
      if (tx.prepareOnly) {
        const unsigned = {
          chainId: r.d.chainId,
          from: account,
          to: tx.address,
          value: "0x0",
          data: encoded,
          estimatedGas: estimate.toString(),
          description: tx.description,
          sourceCommit: r.d.sourceCommit,
          simulatedAt: new Date().toISOString(),
          notice:
            "Unsigned. No transaction was broadcast. Re-simulate sequential setup transactions before signing.",
        };
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(unsigned, null, 2) + "\n"], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `unlk2-${tx.functionName}-unsigned.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStage("Unsigned transaction downloaded. Nothing was broadcast.");
        return;
      }
      if (
        !same(active.current.address, account) ||
        active.current.chain !== r.d.chainId
      )
        throw Error("Wallet changed during simulation. Review again.");
      if (tx.validUntil && Date.now() > tx.validUntil)
        throw Error("Quote expired during simulation. Request a fresh quote.");
      await tx.validate?.();
      submitted.current = true;
      setStage("Waiting for confirmation in your wallet…");
      const wc = walletClient(r, w.provider!, account);
      const txHash = await wc.writeContract({
        ...sim.request,
        gas: (estimate * 120n) / 100n,
        account,
      });
      sentHash = txHash;
      setHash(txHash);
      setAwaitingReceipt(true);
      await settleReceipt(txHash);
    } catch (e) {
      setError(errorText(e));
      setReady(false);
      setStage(
        (e as { receiptResolved?: boolean }).receiptResolved
          ? "The transaction failed onchain. Refresh state before retrying."
          : sentHash
            ? "Check the transaction in the explorer. If its receipt is unresolved, recheck without submitting again."
            : "Nothing was submitted by this attempt. You can retry.",
      );
    } finally {
      running.current = false;
      setBusy(false);
      submitted.current = false;
    }
  };
  const status =
    review && !showReview && (busy || awaitingReceipt || hash || error) ? (
      <div className="system-message" role="status">
        <span>{stage}</span>
        <button onClick={() => setShowReview(true)}>
          View transaction status
        </button>
      </div>
    ) : null;
  const element = (
    <Dialog
      open={!!review && showReview}
      onClose={() => setShowReview(false)}
      title={review?.title ?? "Review transaction"}
    >
      {review && (
        <>
          <p>{review.description}</p>
          <dl className="review-list">
            <dt>Network</dt>
            <dd>
              {r?.d.network.name} / chain {r?.d.chainId}
            </dd>
            <dt>Contract</dt>
            <dd className="address">{review.address}</dd>
            <dt>Method</dt>
            <dd>{review.functionName}</dd>
            <dt>ETH sent</dt>
            <dd>{formatEther(review.value ?? 0n)} ETH + network fee</dd>
            {gas && (
              <>
                <dt>Estimated gas</dt>
                <dd>{gas.toString()} gas units; wallet shows fee</dd>
              </>
            )}
          </dl>
          {review.irreversible && (
            <label className="check">
              <input
                type="checkbox"
                checked={accepted}
                disabled={busy || awaitingReceipt}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              I understand this action is irreversible.
            </label>
          )}
          <p role="status">{stage}</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {hash && (
            <a
              className="transaction-link"
              href={`${r?.d.network.explorer}/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction in explorer ↗
            </a>
          )}
          <button
            className="action full"
            disabled={
              busy ||
              confirmed ||
              (!awaitingReceipt &&
                (!verified || (!!review.irreversible && !accepted)))
            }
            onClick={() => void run()}
          >
            {confirmed
              ? stage.startsWith("Cancelled")
                ? "Cancelled"
                : "Confirmed"
              : busy
                ? "Working…"
                : awaitingReceipt
                  ? "Recheck receipt"
                  : ready
                    ? review.prepareOnly
                      ? "Download unsigned transaction"
                      : "Confirm in wallet"
                    : error
                      ? "Retry simulation"
                      : "Simulate transaction"}
          </button>
          <button className="full" onClick={() => setShowReview(false)}>
            Close
          </button>
        </>
      )}
    </Dialog>
  );
  return { request, busy: busy || awaitingReceipt, element, status };
}
