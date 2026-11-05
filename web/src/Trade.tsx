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
import { ETH_ROUTE_VERIFIED, ethSwapData, quoteEthRoute } from "./eth-route";
import { portion, sellable, gasReserve, spendableEth } from "./shortcuts";
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
            ? d.gates === 10
              ? "100% · every holder"
              : `${d.percents[0]}% buys / ${d.percents[1]}% other → ${next?.[0]}%`
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
            valid={
              !!processed &&
              !!fresh &&
              !!d?.gatePrice[1] &&
              !!d?.tokenPrice[1] &&
              !stale
            }
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
      <p className="helper">
        Any one trigger opens the gate permanently.{" "}
        {stale
          ? "Live state unavailable; refresh to verify progress."
          : "Open states come only from stored gatesOpen."}
      </p>
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
          . Pending observation could reach{" "}
          {!stale && d?.gatePrice[1] && d?.tokenPrice[1]
            ? d.pendingGates
            : "unavailable"}{" "}
          gates; this is a preview, never an open state.
        </p>
        <p>
          The immutable hook reads the official price left by the previous block
          before the first successful official swap of a later block. It is not
          an immediate spot gate. Its IMD-per-ETH tracker moves at most 5% per
          hour, with a four-hour gap cap (upper bound ×1.20, lower bound ÷1.20
          per update). Gate USD uses the lower of spot IMD/USD and
          tracker-derived IMD/USD; IMD price declines count immediately. Invalid
          or stale feed prices do not count. Gates opened in storage never
          close.
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
  tag: string;
  referenceLp?: bigint;
  gas?: bigint;
  deadline?: bigint;
};
export function Trade() {
  const { r, data: d, wallet: w, request, verified, stale } = useApp();
  const [buy, setBuy] = useState(true),
    [payment, setPayment] = useState<"IMD" | "ETH">("IMD"),
    [input, setInput] = useState(""),
    [slippage, setSlippage] = useState("0.50");
  const [quote, setQuote] = useState<Quote>(),
    [error, setError] = useState(""),
    [quoting, setQuoting] = useState(false),
    [shortcutPending, setShortcutPending] = useState(false);
  const [allow, setAllow] = useState<{
    token: bigint;
    permit: bigint;
    expiry: number;
  }>();
  const version = useRef(0);
  const eth = buy && payment === "ETH";
  const from = buy ? payment : "UNLK2",
    to = buy ? "UNLK2" : "IMD";
  const source = (
    buy ? r.d.network.pairToken.address : r.addresses.UnlockV2Token
  ) as Address;
  const available = stale
    ? undefined
    : buy
      ? eth
        ? d?.ethBalance
        : d?.imdBalance
      : d?.balance !== undefined && d.sellAllowance !== undefined
        ? sellable(d.balance, d.sellAllowance)
        : undefined;
  const tag = [
    buy,
    payment,
    input,
    slippage,
    w.address,
    w.chainId,
    d?.gates,
    d?.tokenPrice[0],
    d?.imdUsd[0],
    d?.balance,
    d?.imdBalance,
    d?.ethBalance,
    d?.sellAllowance,
    d?.poolId,
    d?.activated,
    verified,
    stale,
  ].join(":");
  const liveTag = useRef(tag);
  liveTag.current = tag;
  const allowance = useCallback(async () => {
    if (!w.address || eth) return;
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
  }, [r, source, w.address, eth]);
  useEffect(() => {
    if (quote && !eth) void allowance().catch((e) => setError(errorText(e)));
  }, [d?.time, quote?.at, allowance, eth]);
  const ready = () => {
    if (
      !d?.poolKey ||
      !d.activated ||
      !d.routerSupported ||
      !verified ||
      stale ||
      !w.address ||
      w.wrong
    )
      throw Error("Connect on Ethereum and wait for verified active trading.");
    if (!eth && !d!.quoterSupported)
      throw Error(
        "The reviewed wallet quoter is not registered. IMD trading is unavailable.",
      );
    if (eth && !ETH_ROUTE_VERIFIED)
      throw Error("ETH mode awaits actual-buyer fork verification.");
  };
  const getQuote = async () => {
    const id = ++version.current,
      atTag = tag;
    setQuote(undefined);
    setError("");
    setQuoting(true);
    try {
      ready();
      const n = amount(input);
      minimumOut(1n, slippage);
      if (available === undefined || n > available)
        throw Error(
          buy
            ? `Insufficient available ${from}.`
            : "Amount exceeds your currently sellable UNLK2.",
        );
      let q: Omit<Quote, "min" | "amount" | "tag">;
      if (eth) {
        q = await quoteEthRoute(r, d!.poolKey!, w.address!, n, 1n, slippage);
        const fees = await r.client.estimateFeesPerGas();
        const balance = await r.client.getBalance({ address: w.address! });
        if (n > spendableEth(balance, gasReserve(q.gas!, fees.maxFeePerGas)))
          throw Error(
            "Keep more ETH for the fresh gas estimate and fee buffer. Use a smaller amount.",
          );
      } else {
        const target = await verifyAuxiliary(r, "quoter"),
          block = await r.client.getBlockNumber();
        const result = await r.client.simulateContract({
          address: target,
          abi: [...walletQuoterAbi, ...r.abis.UnlockV2Hook],
          functionName: "quoteExactInput",
          args: [same(source, d!.poolKey!.currency0), n],
          account: w.address!,
          blockNumber: block,
        });
        const [out, fee, lp] = result.result as readonly [
          bigint,
          bigint,
          bigint,
        ];
        q = { out, fee, lp, block, at: Date.now() };
      }
      if (id !== version.current || liveTag.current !== atTag) return;
      const min = minimumOut(q.out, slippage);
      if (min <= 0n) throw Error("No usable output was quoted.");
      setQuote({ ...q, min, amount: n, tag: atTag });
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
  }, [tag]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (quote && Date.now() - quote.at > 45000) {
        setQuote(undefined);
        setError("Quote expired. Refresh before trading.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [quote]);
  const shortcut = async (percent: number) => {
    const initialTag = tag;
    setError("");
    setQuote(undefined);
    ++version.current;
    setShortcutPending(true);
    try {
      if (!w.address || w.wrong || !verified || stale)
        throw Error("Connect on Ethereum and refresh balances first.");
      let base: bigint;
      if (!buy) {
        const [balance, quota] = await Promise.all([
          r.client.readContract({
            address: r.addresses.UnlockV2Token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [w.address],
          }),
          r.client.readContract({
            address: r.addresses.UnlockV2Hook,
            abi: r.abis.UnlockV2Hook,
            functionName: "sellAllowance",
            args: [w.address],
          }),
        ]);
        base = sellable(balance, quota as bigint);
      } else if (!eth)
        base = await r.client.readContract({
          address: source,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [w.address],
        });
      else {
        ready();
        const [balance, fees] = await Promise.all([
          r.client.getBalance({ address: w.address }),
          r.client.estimateFeesPerGas(),
        ]);
        const seed = balance / 100n;
        if (seed <= 0n) throw Error("No spendable ETH.");
        const probe = await quoteEthRoute(
          r,
          d!.poolKey!,
          w.address,
          seed,
          1n,
          slippage,
        );
        base = spendableEth(balance, gasReserve(probe.gas, fees.maxFeePerGas));
        // Re-estimate the actual selected size; larger trades may cross more ticks.
        for (let i = 0; i < 3; i++) {
          const selected = portion(base, percent);
          if (!selected) throw Error("No ETH remains after network fees.");
          const actual = await quoteEthRoute(
            r,
            d!.poolKey!,
            w.address,
            selected,
            1n,
            slippage,
          );
          const freshBalance = await r.client.getBalance({
            address: w.address,
          });
          const freshFees = await r.client.estimateFeesPerGas();
          const next = spendableEth(
            freshBalance,
            gasReserve(actual.gas, freshFees.maxFeePerGas),
          );
          if (portion(next, percent) >= selected) break;
          base = next;
          if (i === 2)
            throw Error("Gas changed during estimation. Retry the shortcut.");
        }
      }
      if (liveTag.current !== initialTag) {
        setError("State changed while calculating this amount. Retry the shortcut.");
        return;
      }
      setInput(formatUnits(portion(base, percent), 18));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setShortcutPending(false);
    }
  };
  const step = async () => {
    try {
      ready();
      const q = quote;
      if (!q || q.tag !== liveTag.current || Date.now() - q.at > 45000)
        throw Error("Get a fresh quote first.");
      const revalidate = async () => {
        if (q.tag !== liveTag.current)
          throw Error("Wallet, inputs or state changed. Refresh the quote.");
        const h = (functionName: string, args: readonly unknown[] = []) =>
          r.client.readContract({
            address: r.addresses.UnlockV2Hook,
            abi: r.abis.UnlockV2Hook,
            functionName,
            args,
          });
        if (
          !(await h("activated")) ||
          !(await h("isRouter", [r.d.network.uniswapV4.universalRouter]))
        )
          throw Error("Trading or router is unavailable.");
        if (eth) {
          const fresh = await quoteEthRoute(
            r,
            d!.poolKey!,
            w.address!,
            q.amount,
            q.min,
            undefined,
            q.deadline,
          );
          const [balance, fees] = await Promise.all([
            r.client.getBalance({ address: w.address! }),
            r.client.estimateFeesPerGas(),
          ]);
          if (
            q.amount >
            spendableEth(balance, gasReserve(fresh.gas, fees.maxFeePerGas))
          )
            throw Error(
              "ETH balance cannot cover input plus buffered gas. Reduce the amount.",
            );
        } else {
          const balance = await r.client.readContract({
            address: source,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [w.address!],
          });
          const base = buy
            ? balance
            : sellable(
                balance,
                (await h("sellAllowance", [w.address!])) as bigint,
              );
          if (q.amount > base)
            throw Error(
              "Balance or currently sellable amount changed. Refresh the quote.",
            );
          const target = await verifyAuxiliary(r, "quoter");
          const fresh = await r.client.simulateContract({
            address: target,
            abi: walletQuoterAbi,
            functionName: "quoteExactInput",
            args: [same(source, d!.poolKey!.currency0), q.amount],
            account: w.address!,
          });
          if (fresh.result[0] < q.min)
            throw Error(
              "Output fell below the reviewed minimum. Refresh the quote.",
            );
        }
      };
      if (!eth) {
        const a = await allowance();
        if (q.tag !== liveTag.current || !a)
          throw Error("Inputs changed. Refresh the quote.");
        if (a.token < q.amount)
          return request({
            title: `Approve ${from}`,
            description: `Permit2 may spend exactly ${formatUnits(q.amount, 18)} ${from}.`,
            address: source,
            abi: erc20Abi,
            functionName: "approve",
            args: [r.d.network.uniswapV4.permit2, q.amount],
            validUntil: q.at + 45000,
            validate: revalidate,
          });
        if (a.permit < q.amount || a.expiry < Date.now() / 1000 + 300)
          return request({
            title: "Approve router in Permit2",
            description: `Authorize exactly ${formatUnits(q.amount, 18)} ${from} for 30 minutes.`,
            address: r.d.network.uniswapV4.permit2,
            abi: permitAbi,
            functionName: "approve",
            args: [
              source,
              r.d.network.uniswapV4.universalRouter,
              q.amount,
              Math.floor(Date.now() / 1000) + 1800,
            ],
            validUntil: q.at + 45000,
            validate: revalidate,
          });
      }
      const deadline =
        q.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 180);
      const data = eth
        ? ethSwapData(
            d!.poolKey!,
            r.d.network.pairToken.address,
            r.addresses.UnlockV2Token,
            w.address!,
            q.amount,
            q.min,
            deadline,
          )
        : swapData(
            d!.poolKey!,
            source,
            q.amount,
            q.min,
            deadline,
            !!r.d.network.uniswapV4.extendedSwapParams,
          );
      request({
        title: `Swap ${from} → ${to}`,
        description: `Spend ${formatUnits(q.amount, 18)} ${from}; receive at least ${formatUnits(q.min, 18)} ${to}.${eth ? " Native ETH → pinned ETH/IMD pool → official IMD/UNLK2 pool → your wallet. Both legs revert together; no IMD approval is needed." : " Only the hook’s official pool is used."}`,
        address: r.d.network.uniswapV4.universalRouter,
        abi: routerAbi,
        functionName: "execute",
        args: decodeFunctionData({ abi: routerAbi, data }).args,
        value: eth ? q.amount : 0n,
        validUntil: q.at + 45000,
        validate: revalidate,
      });
    } catch (e) {
      setError(errorText(e));
      setQuote(undefined);
    }
  };
  const reason = !d
    ? "Reading verified pool state."
    : !d.activated
      ? d.setupReady
        ? "Trading is closed. Setup is verified complete; activation is detected automatically."
        : "Trading is closed. Review the live integration status."
      : !d.routerSupported
        ? "Pinned Universal Router unavailable."
        : eth && !ETH_ROUTE_VERIFIED
          ? "ETH buying is disabled until the actual-buyer fork suite passes."
          : (!r.repair.quoter || !d.quoterSupported) && !eth
            ? "Reviewed wallet quoter unavailable or unregistered."
            : undefined;
  return (
    <section className="panel swap-panel" aria-label="Swap UNLK2">
      <div className="spread">
        <h2>Swap UNLK2</h2>
        <span className="mint">Official route</span>
      </div>
      <div className="segmented">
        <button aria-pressed={buy} onClick={() => setBuy(true)}>
          Buy UNLK2
        </button>
        <button aria-pressed={!buy} onClick={() => setBuy(false)}>
          Sell UNLK2
        </button>
      </div>
      {buy && (
        <div className="payment-choice" role="group" aria-label="Pay with">
          <span>Pay with</span>
          <button
            aria-pressed={payment === "IMD"}
            onClick={() => {
              setPayment("IMD");
              setInput("");
            }}
          >
            IMD
          </button>
          <button
            aria-pressed={payment === "ETH"}
            onClick={() => {
              setPayment("ETH");
              setInput("");
            }}
          >
            ETH
          </button>
        </div>
      )}
      <div className="spread">
        <label htmlFor="swap-amount">You pay · {from}</label>
        <span className="muted">
          {buy ? "Balance" : "Currently sellable"} {display(available)}
        </span>
      </div>
      <input
        id="swap-amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={
          error ? "shortcut-context swap-error" : "shortcut-context"
        }
      />
      <div className="shortcuts" role="group" aria-label="Amount shortcuts">
        {[20, 50, 75, 100].map((p) => (
          <button
            key={p}
            disabled={
              !w.address ||
              w.wrong ||
              stale ||
              shortcutPending ||
              (eth && (!ETH_ROUTE_VERIFIED || !d?.activated))
            }
            onClick={() => void shortcut(p)}
          >
            {p === 100 ? "MAX" : `${p}%`}
          </button>
        ))}
      </div>
      <p id="shortcut-context" className="helper">
        {shortcutPending
          ? "Reading fresh balance and gas…"
          : !buy
            ? "Percentages are portions of your CURRENTLY SELLABLE amount, capped by balance and onchain allowance."
            : eth
              ? "Shortcuts use spendable ETH after a fresh gas estimate, 20% gas margin and 25% fee buffer."
              : "Percentages use your available IMD balance. Keep ETH for network fees."}
      </p>
      {!eth && (
        <UsdValue
          value={(() => {
            try {
              return amount(input);
            } catch {
              return undefined;
            }
          })()}
          token={buy ? "IMD" : "UNLK2"}
        />
      )}
      <div className="receive-line">
        <span className="muted">You receive · {to}</span>
        <strong>
          {quoting ? "Quoting…" : quote ? display(quote.out) : "Unavailable"}
        </strong>
      </div>
      <div className="slippage-setting">
        <label htmlFor="slippage">Slippage %</label>
        <input
          id="slippage"
          inputMode="decimal"
          value={slippage}
          onChange={(e) => setSlippage(e.target.value)}
        />
      </div>
      {quote && (
        <dl className="compact-dl">
          <dt>Minimum received</dt>
          <dd>
            {display(quote.min)} {to}
          </dd>
          <dt>Execution price · incl. fees</dt>
          <dd>
            {display(
              buy
                ? (quote.amount * 10n ** 18n) / quote.out
                : (quote.out * 10n ** 18n) / quote.amount,
              18,
              10,
            )}{" "}
            {buy ? from : "IMD"} / UNLK2
          </dd>
          <dt>Reward fee · exact</dt>
          <dd>{display(quote.fee)} IMD</dd>
          <dt>Official LP fee · estimate</dt>
          <dd>
            {display(quote.lp)} {eth ? "IMD" : from}
          </dd>
          {eth && (
            <>
              <dt>Reference LP fee · estimate</dt>
              <dd>{display(quote.referenceLp)} ETH</dd>
              <dt>Route gas estimate</dt>
              <dd>{quote.gas?.toString()} units</dd>
            </>
          )}
          <dt>Quoted at</dt>
          <dd>Block {quote.block.toString()} · 45s validity</dd>
        </dl>
      )}
      {error && (
        <div id="swap-error">
          <Alert error>{error}</Alert>
        </div>
      )}
      <Action
        onClick={() => void (quote ? step() : getQuote())}
        reason={quoting ? "Quoting…" : reason}
      >
        {quote
          ? allow && !eth && allow.token < quote.amount
            ? `Approve ${from}`
            : allow &&
                !eth &&
                (allow.permit < quote.amount ||
                  allow.expiry < Date.now() / 1000 + 300)
              ? "Approve router"
              : "Review swap"
          : "Get live quote"}
      </Action>
      <p className="visible-route"><span>Fixed official route</span><strong>{eth ? "ETH → IMD → UNLK2" : buy ? "IMD → UNLK2" : "UNLK2 → IMD"}</strong></p>
      <details className="swap-context">
        <summary>Route, fees and protections</summary>
        <p>
          {eth
            ? "Native ETH → ETH/IMD v4 (1% LP) → official IMD/UNLK2 (1.25% LP + 1% IMD reward fee) → connected buyer. Full-route RPC simulation includes first-leg price changes and hook fees. No pre-owned IMD, approvals, split routes or fallback pools. Unsupported simulation stops the trade."
            : "IMD ↔ UNLK2 through the hook’s official pool only. WalletQuoter includes hook effects and wallet sell rights. 1.25% LP fee and 1% IMD reward fee."}{" "}
          Network fees are additional. Minimum output and a three-minute router
          deadline are enforced. Every transaction is simulated again before
          signing.
        </p>
      </details>
    </section>
  );
}
