import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatUnits, getAddress, maxUint256, type Address } from "viem";
import { useApp, type Transaction } from "./context";
export function display(n: bigint | undefined, dec = 18, digits = 4): string {
  if (n === undefined) return "Unavailable";
  if (n === maxUint256) return "Unlimited";
  const [whole, fraction = ""] = formatUnits(n, dec).split(".");
  const shown = fraction.slice(0, digits).replace(/0+$/, "");
  if (n > 0n && whole === "0" && !shown)
    return `<${digits ? "0." + "0".repeat(digits - 1) + "1" : "1"}`;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return grouped + (shown ? "." + shown : "");
}
export function UsdValue({
  value,
  token = "UNLK2",
}: {
  value?: bigint;
  token?: "UNLK2" | "IMD";
}) {
  const { data: d, stale } = useApp();
  const rate =
    !stale && d?.imdUsd[1] && (token === "IMD" || d?.tokenPrice[1])
      ? token === "IMD"
        ? d.imdUsd[0]
        : (d.imdUsd[0] * d.tokenPrice[0]) / 10n ** 18n
      : undefined;
  return (
    <span className="usd-value muted">
      {value !== undefined && rate !== undefined
        ? `Reference ≈ $${display((value * rate) / 10n ** 18n, 18, 2)} USD`
        : "USD context unavailable"}
    </span>
  );
}
export const exact = (n: bigint | undefined, dec = 18) =>
  n === undefined ? "Unavailable" : formatUnits(n, dec);
export function AddressLink({
  address,
  label,
}: {
  address?: string;
  label?: string;
}) {
  const { r } = useApp();
  const [copied, setCopied] = useState(false);
  if (!address) return <span className="muted">Not available</span>;
  return (
    <div className="address-line">
      <a
        href={`${r.d.network.explorer}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        className="address"
        title={address}
      >
        {label ?? getAddress(address)}
      </a>
      <button
        className="small"
        aria-label={`Copy ${label ?? address}`}
        onClick={() => {
          void navigator.clipboard.writeText(getAddress(address)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <div className="stat-value">
        {value}
        {unit && <span className="unit"> {unit}</span>}
      </div>
      {note && <span className="muted">{note}</span>}
    </div>
  );
}
export function Field({
  label,
  value,
  onChange,
  hint,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  hint?: string;
  type?: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text";
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        type={type}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <span id={`${id}-hint`} className="muted">
          {hint}
        </span>
      )}
    </div>
  );
}
export function Alert({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={error ? "notice error" : "notice"}
      role={error ? "alert" : undefined}
    >
      {children}
    </p>
  );
}
export function Action({
  children,
  onClick,
  reason,
  secondary = false,
  requireWallet = true,
}: {
  children: ReactNode;
  onClick: () => void;
  reason?: string;
  secondary?: boolean;
  requireWallet?: boolean;
}) {
  const { wallet: w, busy, verified, stale } = useApp();
  const handler = () => {
    if (requireWallet && !w.address) {
      w.setOpen(true);
      return;
    }
    if (requireWallet && w.wrong) {
      void w.switchNetwork();
      return;
    }
    onClick();
  };
  const label =
    requireWallet && !w.address
      ? "Connect wallet"
      : requireWallet && w.wrong
        ? "Switch network using the wallet button"
        : children;
  const disabled =
    busy ||
    (requireWallet && w.wrong) ||
    ((!requireWallet || (!!w.address && !w.wrong)) &&
      (!verified || stale || !!reason));
  return (
    <>
      <button
        className={`action full ${secondary ? "secondary" : ""}`}
        disabled={disabled}
        onClick={handler}
      >
        {busy ? "Transaction in progress…" : label}
      </button>
      {reason && <p className="helper">{reason}</p>}
    </>
  );
}
export function ContractAction({
  tx,
  reason,
  secondary,
}: {
  tx: Transaction;
  reason?: string;
  secondary?: boolean;
}) {
  const { request } = useApp();
  return (
    <Action onClick={() => request(tx)} reason={reason} secondary={secondary}>
      {tx.title}
    </Action>
  );
}
export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function Progress({
  label,
  value,
  target,
  unit = "",
  valid = true,
}: {
  label: string;
  value?: bigint;
  target?: bigint;
  unit?: string;
  valid?: boolean;
}) {
  const pct =
    value !== undefined && valid && target !== undefined && target > 0n
      ? Math.min(100, Number((value * 10000n) / target) / 100)
      : 0;
  return (
    <div className="progress-row">
      <div className="spread">
        <span>{label}</span>
        <span>
          {valid && value !== undefined && target !== undefined
            ? `${pct.toFixed(1)}%`
            : "Unavailable"}
        </span>
      </div>
      <progress
        value={pct}
        max={100}
        aria-label={label}
        aria-valuetext={
          valid && value !== undefined && target !== undefined
            ? `${pct.toFixed(1)}% completed`
            : "Unavailable"
        }
      />
      <div className="spread muted">
        <span>
          {valid ? display(value) : "Unavailable / stale"} {unit}
        </span>
        <span>
          of {display(target, 18, 0)} {unit}
        </span>
      </div>
      <div className="spread muted">
        <span>
          Remaining:{" "}
          {valid && value !== undefined && target !== undefined
            ? display(target > value ? target - value : 0n)
            : "Unavailable"}{" "}
          {unit}
        </span>
        <span>
          {valid && value !== undefined && target !== undefined
            ? `${(100 - pct).toFixed(1)}% remaining`
            : "Unavailable"}
        </span>
      </div>
    </div>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close review" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EmptyWallet() {
  return (
    <Alert>
      Connect your wallet to read your balances and account rights. Public
      protocol state is available without a wallet.
    </Alert>
  );
}
export const asAddress = (v: string) => getAddress(v.trim()) as Address;
