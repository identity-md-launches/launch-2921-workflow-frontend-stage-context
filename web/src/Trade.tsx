import { useCallback, useEffect, useRef, useState } from "react";
import { decodeFunctionData, formatUnits, type Address } from "viem";
import { useApp } from "./context";
import { Action, Alert, display, Progress, UsdValue } from "./components";
import {
  amount,
  erc20Abi,
  errorText,
  minimumOut,
  permitAbi,
  routerAbi,
  same,
  swapData,
} from "./core";
import { verifyAuxiliary, walletQuoterAbi } from "./integration";

export function GateProgress() {
  const { data: d, stale } = useApp();
  const next = d?.gateTable[Math.min(d.gates, 9)];
  const processed = d && d.lastGateFdv > 0n && d.lastObservation > 0n;
  const age = d ? Date.now() / 1000 - Number(d.lastObservation) : Infinity;
  const fresh = age >= 0 && age <= 5400;
  return (
    <>
      <div className="spread">
        <h2>
          {d?.gates === 10
            ? "Golden Vault · all gates open"
            : `Active gate ${d ? d.gates + 1 : "pending"}`}
        </h2>
        <span className="gate-status">
          {d
            ? d.gates === 10 ? "100% · every holder" : `${d.percents[0]}% buys / ${d.percents[1]}% other → ${next?.[0]}%`
            : "Awaiting state"}
        </span>
      </div>
      {d?.gates !== 10 && (
        <>
          <Progress
            label="OR · Contract FDV · last processed"
            value={processed ? d.lastGateFdv : undefined}
            target={next?.[1]}
            unit="USD"
            valid={!!processed && !!fresh && !!d?.gatePrice[1] && !!d?.tokenPrice[1] && !stale}
          />
          <Progress
            label="OR · Cumulative official gross USD volume"
            value={d?.volume}
            target={next?.[2]}
            unit="USD"
            valid={!!d && !stale}
          />
          <Progress
            label="OR · This gate’s UNLK2 burn contribution"
            value={d?.burnProgress}
            target={next?.[3]}
            unit="UNLK2"
            valid={!!d && !stale}
          />
        </>
      )}
      <p className="helper">Any one trigger opens the gate permanently. {stale ? "Live state unavailable; refresh to verify progress." : "Open states come only from stored gatesOpen."}</p>
      <details>
        <summary>Market FDV, processed FDV and pending observations</summary>
        <p>
          Indicative market FDV:{" "}
          {d?.fdv[1] && !stale ? `$${display(d.fdv[0], 18, 2)}` : "Unavailable"}
          . Uses current totalSupply ({display(d?.supply, 18, 0)} UNLK2),
          including reserves and excluding burns.
        </p>
        <p>
          Historical last processed gate FDV:{" "}
          {processed ? `$${display(d.lastGateFdv, 18, 2)}` : "Not yet observed"}
          ; last FDV attempt block {d?.lastFdvBlock.toString() ?? "—"}. Last
          valid volume observation:{" "}
          {d?.lastObservation
            ? new Date(Number(d.lastObservation) * 1000).toISOString()
            : "None"}
          . Historical values are not fresh price quotes. lastFdvBlock also
          advances on invalid attempts; the hook has no separate timestamp for a
          successful FDV reading.
        </p>
        <p>
          Gate IMD/USD reference:{" "}
          {d?.gatePrice[1] && !stale
            ? `$${display(d.gatePrice[0], 18, 6)}`
            : "Unavailable"}
          . Pending observation could reach {!stale && d?.gatePrice[1] && d?.tokenPrice[1] ? d.pendingGates : "unavailable"} gates; this
          is a preview, never an open state.
        </p>
        <p>
          The immutable hook reads the official price left by the previous block
          before the first successful official swap of a later block. It is not
          an immediate spot gate. Its IMD-per-ETH tracker moves at most 5% per
          hour, with a four-hour gap cap (upper bound ×1.20, lower bound ÷1.20 per update). Gate USD uses the
          lower of spot IMD/USD and tracker-derived IMD/USD; IMD price declines
          count immediately. Invalid or stale feed prices do not count. Gates
          opened in storage never close.
        </p>
      </details>
    </>
  );
}
export function Ladder() {
  return <GateProgress />;
}
type Quote = {
  out: bigint;
  min: bigint;
  amount: bigint;
  fee: bigint;
  lp: bigint;
  at: number;
  block: bigint;
};
export function Trade() {
  const { r, data: d, wallet: w, request, verified, stale } = useApp();
  const [buy, setBuy] = useState(true),
    [input, setInput] = useState(""),
    [slippage, setSlippage] = useState("0.50");
  const [quote, setQuote] = useState<Quote>(),
    [error, setError] = useState(""),
    [quoting, setQuoting] = useState(false);
  const [allow, setAllow] = useState<{
    token: bigint;
    permit: bigint;
    expiry: number;
  }>();
  const version = useRef(0);
  const source = (
    buy ? r.d.network.pairToken.address : r.addresses.UnlockV2Token
  ) as Address;
  const from = buy ? "IMD" : "UNLK2",
    to = buy ? "UNLK2" : "IMD";
  const dec = buy ? r.d.network.pairToken.decimals : 18;
  const allowance = useCallback(async () => {
    if (!w.address) return;
    const [token, p] = await Promise.all([
      r.client.readContract({
        address: source,
        abi: erc20Abi,
        functionName: "allowance",
        args: [w.address, r.d.network.uniswapV4.permit2],
      }),
      r.client.readContract({
        address: r.d.network.uniswapV4.permit2,
        abi: permitAbi,
        functionName: "allowance",
        args: [w.address, source, r.d.network.uniswapV4.universalRouter],
      }),
    ]);
    const a = { token, permit: p[0], expiry: p[1] };
    setAllow(a);
    return a;
  }, [r, source, w.address]);
  useEffect(() => {
    if (quote) void allowance().catch((e) => setError(errorText(e)));
  }, [d?.time, allowance, quote?.at]);
  const getQuote = async () => {
    const id = ++version.current;
    setQuote(undefined);
    setError("");
    setQuoting(true);
    try {
      if (
        !d?.poolKey ||
        !d.activated ||
        !d.routerSupported ||
        !verified ||
        stale ||
        !w.address ||
        w.wrong
      )
        throw Error(
          "Connect on Ethereum and wait for trading and verified router setup.",
        );
      const n = amount(input, dec);
      minimumOut(1n, slippage);
      if (n > (buy ? (d.imdBalance ?? 0n) : (d.balance ?? 0n)))
        throw Error(`Insufficient ${from} balance.`);
      const target = await verifyAuxiliary(r, "quoter");
      const block = await r.client.getBlockNumber();
      const result = await r.client.simulateContract({
        address: target,
        abi: [...walletQuoterAbi, ...r.abis.UnlockV2Hook],
        functionName: "quoteExactInput",
        args: [same(source, d.poolKey.currency0), n],
        account: w.address,
        blockNumber: block,
      });
      if (id !== version.current) return;
      const [out, fee, lp] = result.result as readonly [bigint, bigint, bigint];
      const min = minimumOut(out, slippage);
      if (min <= 0n) throw Error("No usable output was quoted.");
      setQuote({ out, min, amount: n, fee, lp, at: Date.now(), block });
      await allowance();
    } catch (e) {
      if (id === version.current) setError(errorText(e));
    } finally {
      if (id === version.current) setQuoting(false);
    }
  };
  useEffect(() => {
    ++version.current;
    setQuote(undefined);
    setAllow(undefined);
    setError("");
    setQuoting(false);
    if (!input || !w.address || !d?.activated || !verified || stale) return;
    const timer = setTimeout(() => void getQuote(), 500);
    return () => {
      clearTimeout(timer);
      ++version.current;
    };
  }, [
    buy,
    input,
    slippage,
    w.address,
    w.chainId,
    d?.activated,
    d?.routerSupported,
    verified,
    stale,
  ]);
  useEffect(() => {
    const t = setInterval(() => {
      if (quote && Date.now() - quote.at > 45000) {
        setQuote(undefined);
        setError("Quote expired. Refresh before trading.");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [quote]);
  const step = async () => {
    try {
      if (!quote || !d?.poolKey || !w.address || Date.now() - quote.at > 45000)
        throw Error("Get a fresh quote first.");
      const id = version.current;
      const a = await allowance();
      if (!a || id !== version.current)
        throw Error("Wallet or inputs changed. Refresh the quote.");
      if (a.token < quote.amount)
        return request({
          title: `Approve ${from}`,
          description: `Permit2 may spend exactly ${formatUnits(quote.amount, dec)} ${from}.`,
          address: source,
          abi: erc20Abi,
          functionName: "approve",
          args: [r.d.network.uniswapV4.permit2, quote.amount],
        });
      if (a.permit < quote.amount || a.expiry < Date.now() / 1000 + 300)
        return request({
          title: "Approve router in Permit2",
          description: `Authorize exactly ${formatUnits(quote.amount, dec)} ${from} for 30 minutes.`,
          address: r.d.network.uniswapV4.permit2,
          abi: permitAbi,
          functionName: "approve",
          args: [
            source,
            r.d.network.uniswapV4.universalRouter,
            quote.amount,
            Math.floor(Date.now() / 1000) + 1800,
          ],
        });
      const data = swapData(
        d.poolKey,
        source,
        quote.amount,
        quote.min,
        BigInt(Math.floor(Date.now() / 1000) + 600),
        !!r.d.network.uniswapV4.extendedSwapParams,
      );
      const args = decodeFunctionData({ abi: routerAbi, data }).args;
      request({
        title: `Swap ${from} → ${to}`,
        description: `Spend ${formatUnits(quote.amount, dec)} ${from}; receive at least ${formatUnits(quote.min, 18)} ${to}. The actual Universal Router execution is simulated before signing.`,
        address: r.d.network.uniswapV4.universalRouter,
        abi: routerAbi,
        functionName: "execute",
        args,
        validUntil: quote.at + 45000,
        validate: async () => {
          if (id !== version.current)
            throw Error("Quote inputs or wallet changed.");
          const target = await verifyAuxiliary(r, "quoter");
          const fresh = await r.client.simulateContract({
            address: target,
            abi: walletQuoterAbi,
            functionName: "quoteExactInput",
            args: [same(source, d.poolKey!.currency0), quote.amount],
            account: w.address,
          });
          if (fresh.result[0] < quote.min)
            throw Error(
              "Output fell below the reviewed minimum. Refresh the quote.",
            );
        },
      });
    } catch (e) {
      setError(errorText(e));
      setQuote(undefined);
    }
  };
  const reason = !d
    ? "Reading verified pool state."
    : !d.activated
      ? "Trading closed · owner setup pending."
      : !d.routerSupported
        ? "Universal Router registration pending."
        : !r.repair.quoter
          ? "Wallet quoter installation pending."
          : undefined;
  const spotOutput =
    quote && !stale && d?.tokenPrice[1]
      ? buy
        ? (quote.amount * 10n ** 18n) / d.tokenPrice[0]
        : (quote.amount * d.tokenPrice[0]) / 10n ** 18n
      : undefined;
  const impact =
    quote && spotOutput && spotOutput > 0n
      ? Number(((spotOutput - quote.out) * 10000n) / spotOutput) / 100
      : undefined;
  return (
    <section className="panel swap-panel">
      <div className="spread">
        <h2>IMD / UNLK2</h2>
        <span className="muted">Official pool</span>
      </div>
      <div className="segmented">
        <button aria-pressed={buy} onClick={() => setBuy(true)}>
          Buy UNLK2
        </button>
        <button aria-pressed={!buy} onClick={() => setBuy(false)}>
          Sell UNLK2
        </button>
      </div>
      <div className="spread">
        <label htmlFor="swap-amount">You pay · {from}</label>
        <span>Balance {display(buy ? d?.imdBalance : d?.balance, dec)}</span>
      </div>
      <input
        id="swap-amount"
        inputMode="decimal"
        placeholder="0.00"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <UsdValue
        value={(() => {
          try {
            return amount(input, dec);
          } catch {
            return undefined;
          }
        })()}
        token={from}
      />
      <div className="spread">
        <span>You receive · {to}</span>
        <strong>
          {quoting ? "Quoting…" : quote ? display(quote.out) : "—"}
        </strong>
      </div>
      <div className="slippage-setting">
        <label htmlFor="slippage">Slippage %</label>
        <input id="slippage" inputMode="decimal" value={slippage}
          onChange={(e) => setSlippage(e.target.value)} />
      </div>
      {quote && (
        <dl className="compact-dl">
          <dt>Minimum received</dt>
          <dd>
            {display(quote.min)} {to}
          </dd>
          <dt>Reward fee · exact</dt>
          <dd>{display(quote.fee)} IMD</dd>
          <dt>LP fee · rounding estimate</dt>
          <dd>
            {display(quote.lp)} {from}
          </dd>
          <dt>Price impact · incl. fees</dt>
          <dd>
            {impact === undefined ? "Unavailable" : `${impact.toFixed(2)}%`}
          </dd>
          <dt>Source</dt>
          <dd>
            PoolManager wallet simulation · block {quote.block.toString()}
          </dd>
          <dt>Updated</dt>
          <dd>{new Date(quote.at).toLocaleTimeString()} · 45s validity</dd>
        </dl>
      )}
      {error && <Alert error>{error}</Alert>}
      <Action
        onClick={() => void (quote ? step() : getQuote())}
        reason={quoting ? "Quoting…" : reason}
      >
        {quote
          ? allow && allow.token < quote.amount
            ? `Approve ${from}`
            : allow &&
                (allow.permit < quote.amount ||
                  allow.expiry < Date.now() / 1000 + 300)
              ? "Approve router"
              : "Review swap"
          : "Get live quote"}
      </Action>
      {!r.repair.quoter && <p className="swap-context amber">Wallet quoter installation pending · <a className="setup-link" href="#founder-setup">Review owner checklist ↗</a></p>}
      <details className="swap-context">
        <summary>Fees and quote integration</summary>
        <p className="helper">
        Automatic wallet quotes include hook effects. 1.25% LP fee on pool
        input; 1% reward fee on the IMD leg. Spot deviation includes fees and
        pool price movement. No manual minimum or shared-identity fallback.
        </p>
      {!r.repair.quoter && (
        <p>
          Pending installation: deploy and review WalletQuoter, register it and
          the Universal Router before sealing. Stock V4Quoter is incompatible
          with wallet sell rights.
        </p>
      )}
      </details>
    </section>
  );
}
