import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useApp } from "./context";
import {
  Action,
  Alert,
  display,
  Field,
  Panel,
  Progress,
  UsdValue,
} from "./components";
import {
  amount,
  erc20Abi,
  errorText,
  minimumOut,
  permitAbi,
  quoterAbi,
  routerAbi,
  same,
  swapData,
} from "./core";
export function GateProgress() {
  const { data: d } = useApp();
  const next = d?.gateTable[Math.min(d.gates, 9)];
  return (
    <>
      <div className="spread">
        <h2>
          {d?.gates === 10
            ? "All gates open"
            : `Next: gate ${d ? d.gates + 1 : "…"}`}
        </h2>
        <span className="mint">
          {next ? `${next[0]}% sell rights` : "Reading thresholds"}
        </span>
      </div>
      {d?.gates === 10 ? (
        <Alert>
          Golden Vault is open. Every holder can sell without a quota in the
          official pool.
        </Alert>
      ) : (
        <>
          <Progress
            label="Market cap / FDV"
            value={d?.fdv[0]}
            target={next?.[1] ?? 1n}
            unit="USD"
            valid={d?.fdv[1] ?? false}
          />
          <Progress
            label="Gross official volume"
            value={d?.volume}
            target={next?.[2] ?? 1n}
            unit="USD"
          />
          <Progress
            label="Gate contributions"
            value={d?.burnProgress}
            target={next?.[3] ?? 1n}
            unit="UNLK2"
          />
          <p className="helper">
            Any one target opens the gate forever. Voluntary burns do not
            advance this bar.
          </p>
        </>
      )}
    </>
  );
}
export function Ladder() {
  const { data: d } = useApp();
  return (
    <section className="panel ladder">
      <GateProgress />
      <div className="ladder-title spread">
        <h3>Permanent gate ladder</h3>
        <span className="muted">
          {d ? `${d.gates} / 10 open` : "Awaiting chain"}
        </span>
      </div>
      <div className="ladder-head">
        <span>Gate</span>
        <span>Sell %</span>
        <span>State</span>
      </div>
      {Array.from({ length: 10 }, (_, i) => {
        const g = i + 1;
        const opened = d ? g <= d.gates : false;
        const next = d ? g === d.gates + 1 : false;
        return (
          <div
            className={`ladder-row ${opened ? "opened" : ""} ${next ? "current" : ""}`}
            key={g}
          >
            <span>
              {String(g).padStart(2, "0")}
              <span
                className="ladder-segment"
                style={{ width: `${g * 7}%` }}
                aria-hidden="true"
              />
            </span>
            <span>{d ? `${d.gateTable[i][0]}%` : "—"}</span>
            <span>
              {d
                ? opened
                  ? "Open"
                  : next
                    ? "Collecting"
                    : "Locked"
                : "Unread"}
            </span>
          </div>
        );
      })}
      <p className="helper">
        Gate 10 removes quota checks for every holder. Other pools remain
        outside these rules.
      </p>
    </section>
  );
}
export function Trade() {
  const { r, data: d, wallet: w, request, verified, stale, busy } = useApp();
  const [buy, setBuy] = useState(true),
    [input, setInput] = useState(""),
    [slippage, setSlippage] = useState("0.50"),
    [manual, setManual] = useState(false),
    [customMin, setCustomMin] = useState(""),
    [quote, setQuote] = useState<{
      out: bigint;
      min: bigint;
      amount: bigint;
      at: number;
      manual?: boolean;
    }>(),
    [error, setError] = useState(""),
    [quoting, setQuoting] = useState(false),
    [allow, setAllow] = useState<{
      token: bigint;
      permit: bigint;
      expiry: number;
      snapshot: number;
      source: Address;
      account: Address;
    }>();
  const quoteRequest = useRef(0);
  const allowanceRequest = useRef(0);
  const source = (
      buy ? r.d.network.pairToken.address : r.addresses.UnlockV2Token
    ) as Address,
    from = buy ? "IMD" : "UNLK2",
    to = buy ? "UNLK2" : "IMD",
    dec = buy ? r.d.network.pairToken.decimals : 18;
  const checkAllowance = useCallback(async () => {
    const sequence = ++allowanceRequest.current;
    setAllow(undefined);
    if (!w.address) return;
    try {
      const [a, p] = await Promise.all([
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
      const current = {
        token: a,
        permit: p[0],
        expiry: p[1],
        snapshot: d?.time ?? 0,
        source,
        account: w.address,
      };
      if (sequence === allowanceRequest.current) setAllow(current);
      return current;
    } catch (e) {
      if (sequence === allowanceRequest.current) setError(errorText(e));
    }
  }, [r, source, w.address, d?.time]);
  useEffect(() => {
    void checkAllowance();
  }, [checkAllowance]);
  useEffect(() => {
    quoteRequest.current += 1;
    setQuote(undefined);
    setError("");
    setQuoting(false);
  }, [buy, input, slippage, manual, customMin, w.address, w.chainId]);
  useEffect(() => {
    const t = setInterval(() => {
      if (quote && Date.now() - quote.at > 60000) setQuote(undefined);
    }, 1000);
    return () => clearInterval(t);
  }, [quote]);
  const getQuote = async () => {
    if (!d?.poolKey || !verified || stale) return;
    const sequence = ++quoteRequest.current;
    setError("");
    setQuoting(true);
    setQuote(undefined);
    try {
      const n = amount(input, dec);
      if (!manual) minimumOut(1n, slippage);
      if (
        !buy &&
        w.address &&
        d.gates < 10 &&
        d.pendingGates <= d.gates &&
        n > (d.sellAllowance ?? 0n)
      )
        throw Error(
          "Amount exceeds your current sell allowance. See My Rights.",
        );
      if (manual) {
        const min = amount(
          customMin,
          buy ? 18 : r.d.network.pairToken.decimals,
        );
        setQuote({ out: min, min, amount: n, at: Date.now(), manual: true });
        await checkAllowance();
        return;
      }
      const result = await r.client.simulateContract({
        address: r.d.network.uniswapV4.quoter,
        abi: [...quoterAbi, ...r.abis.UnlockV2Hook],
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: d.poolKey,
            zeroForOne: same(source, d.poolKey.currency0),
            exactAmount: n,
            hookData: "0x",
          },
        ],
        ...(w.address ? { account: w.address } : {}),
      });
      const out = (result.result as readonly [bigint, bigint])[0];
      if (sequence !== quoteRequest.current) return;
      if (out <= 0n) throw Error("The pool returned no output.");
      const min = minimumOut(out, slippage);
      if (min === 0n)
        throw Error("The minimum output rounds to zero. Increase the amount.");
      setQuote({ out, min, amount: n, at: Date.now() });
      await checkAllowance();
    } catch (e) {
      if (sequence === quoteRequest.current) setError(errorText(e));
    } finally {
      if (sequence === quoteRequest.current) setQuoting(false);
    }
  };
  const step = async () => {
    if (!quote || !d?.poolKey) return;
    if (Date.now() - quote.at > 60000) {
      setQuote(undefined);
      setError("Quote expired. Request a fresh quote.");
      return;
    }
    const version = quoteRequest.current;
    const current = await checkAllowance();
    if (!current) {
      setError("Could not refresh allowances. Retry the current step.");
      return;
    }
    if (version !== quoteRequest.current) {
      setError("The swap inputs or wallet changed. Request a fresh quote.");
      return;
    }
    if (current.token < quote.amount) {
      request({
        title: `Approve ${from} for Permit2`,
        description: `Allow Permit2 to spend exactly ${formatUnits(quote.amount, dec)} ${from}. This is step 1 of 2 approvals.`,
        address: source,
        abi: erc20Abi,
        functionName: "approve",
        args: [r.d.network.uniswapV4.permit2, quote.amount],
      });
      return;
    }
    if (
      current.permit < quote.amount ||
      current.expiry < Math.floor(Date.now() / 1000) + 300
    ) {
      request({
        title: "Approve router in Permit2",
        description: `Authorize the configured Universal Router to spend ${formatUnits(quote.amount, dec)} ${from} through Permit2 for 30 minutes.`,
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
      return;
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const data = swapData(
      d.poolKey,
      source,
      quote.amount,
      quote.min,
      deadline,
      !!r.d.network.uniswapV4.extendedSwapParams,
    );
    const decodedInputs = decodeSwap(data);
    request({
      title: `Swap ${from} for ${to}`,
      description: `Spend ${formatUnits(quote.amount, dec)} ${from}. Receive at least ${formatUnits(quote.min, buy ? 18 : r.d.network.pairToken.decimals)} ${to}, or the transaction reverts. Deadline: 10 minutes.`,
      address: r.d.network.uniswapV4.universalRouter,
      abi: routerAbi,
      functionName: "execute",
      args: decodedInputs,
      value: 0n,
    });
  };
  const reason = !d
    ? "Waiting for verified contract state."
    : !d.activated
      ? "Trading is closed. Owner setup and activation are required."
      : !d.routerSupported
        ? "The configured router is not registered. Trade is disabled to protect account attribution."
        : !d.poolKey
          ? "The official pool is not initialized."
          : quote &&
              w.address &&
              (!allow ||
                allow.snapshot !== d.time ||
                !same(allow.source, source) ||
                !same(allow.account, w.address))
            ? "Reading current token and Permit2 allowances."
            : quote &&
                w.address &&
                quote.amount > (buy ? (d.imdBalance ?? 0n) : (d.balance ?? 0n))
              ? `Insufficient ${from} balance.`
              : undefined;
  const action = quote
    ? allow && allow.token < quote.amount
      ? `1. Approve ${from}`
      : allow &&
          (allow.permit < quote.amount ||
            allow.expiry < Math.floor(Date.now() / 1000) + 300)
        ? "2. Approve router"
        : "Review swap"
    : "Get live quote";
  return (
    <div className="trade-grid">
      <section className="panel swap-panel">
        <div className="spread">
          <h2>Swap</h2>
          <span className="muted">Official pool only</span>
        </div>
        <div className="segmented">
          <button aria-pressed={buy} onClick={() => setBuy(true)}>
            Buy UNLK2
          </button>
          <button aria-pressed={!buy} onClick={() => setBuy(false)}>
            Sell UNLK2
          </button>
        </div>
        <div className="spread field-heading">
          <span>You pay</span>
          <span
            className="muted"
            title={
              w.address
                ? formatUnits(
                    buy ? (d?.imdBalance ?? 0n) : (d?.balance ?? 0n),
                    dec,
                  )
                : undefined
            }
          >
            Balance:{" "}
            {w.address
              ? display(buy ? d?.imdBalance : d?.balance, dec)
              : "Connect"}
          </span>
        </div>
        <div className="amount-input">
          <label className="sr-only" htmlFor="swap-amount">
            Amount to swap
          </label>
          <input
            id="swap-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <span>{from}</span>
        </div>
        <UsdValue
          value={(() => {
            try {
              return amount(input, dec);
            } catch {
              return undefined;
            }
          })()}
          token={from as "IMD" | "UNLK2"}
        />
        <div className="swap-direction" aria-hidden="true">
          ↓
        </div>
        <div className="spread">
          <span>{quote?.manual ? "Minimum you accept" : "You receive"}</span>
          <span className="muted">{to}</span>
        </div>
        <div className="quote-output">
          {quoting
            ? "Quoting…"
            : quote
              ? `${quote.manual ? "≥ " : ""}${display(quote.out, buy ? 18 : r.d.network.pairToken.decimals)}`
              : "—"}
        </div>
        <div className="slippage">
          <label htmlFor="slippage">Slippage tolerance</label>
          <div>
            <input
              id="slippage"
              disabled={manual}
              inputMode="decimal"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
            <span>%</span>
          </div>
        </div>
        {manual && (
          <>
            <Field
              label={`Minimum output (${to})`}
              value={customMin}
              onChange={setCustomMin}
              inputMode="decimal"
              hint="You choose the output floor. Automatic slippage is not applied; the router simulation must still pass."
            />
            <p className="helper">
              The configured quoter may fail sells before gate 10 because its
              shared address has no allowance. A custom minimum enables a direct
              router simulation after approvals. No expected output is implied.
            </p>
          </>
        )}
        {quote && (
          <dl className="compact-dl">
            <dt>Minimum received</dt>
            <dd
              title={formatUnits(
                quote.min,
                buy ? 18 : r.d.network.pairToken.decimals,
              )}
            >
              {display(quote.min, buy ? 18 : r.d.network.pairToken.decimals)}{" "}
              {to}
            </dd>
            {!quote.manual && (
              <>
                <dt>Rate</dt>
                <dd>
                  1 {from} ≈{" "}
                  {display(
                    (quote.out * 10n ** BigInt(dec)) / quote.amount,
                    buy ? 18 : r.d.network.pairToken.decimals,
                  )}{" "}
                  {to}
                </dd>
              </>
            )}
            <dt>Quote validity</dt>
            <dd>60 seconds; re-simulated before signing</dd>
          </dl>
        )}
        {error && (
          <Alert error>
            {error}
            {!buy && (
              <span>
                {" "}
                The v4 quoter may be attributed its own sell rights; a quota
                revert is not a wallet balance quote. Set an explicit custom
                minimum, then simulate the router after approvals. No swap is
                submitted by quoting.
              </span>
            )}
          </Alert>
        )}
        {quote ? (
          <Action onClick={() => void step()} reason={reason}>
            {action}
          </Action>
        ) : (
          <Action
            onClick={() => void getQuote()}
            reason={quoting ? "Requesting a simulation quote…" : reason}
          >
            {quoting
              ? "Quoting…"
              : manual
                ? "Review custom minimum"
                : "Get live quote"}
          </Action>
        )}
        {quote && (
          <button
            className="full"
            disabled={busy || quoting}
            onClick={() => void getQuote()}
          >
            Refresh quote
          </button>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={manual}
            onChange={(e) => setManual(e.target.checked)}
          />
          Set a custom minimum output
        </label>
        <p className="helper">
          1.25% LP fee + 1% reward fee on the IMD leg. Different bases; fees do
          not simply add. Quotes include hook effects.
        </p>
        <details>
          <summary>Execution and price details</summary>
          <p>
            Exact input through the configured Uniswap v4 Universal Router.
            Token approval to Permit2, then Permit2 approval to the router. No
            ETH is sent for this ERC-20 pair; ETH is still required for gas.
          </p>
          <p>
            {d?.imdUsd[1] && d?.tokenPrice[1]
              ? `Onchain reference: 1 IMD ≈ $${display(d.imdUsd[0])}; 1 UNLK2 ≈ ${display(d.tokenPrice[0], 18, 10)} IMD.`
              : "USD context is unavailable until valid onchain prices can be read."}
          </p>
          <p>
            Sell rights are account based. Transfers do not grant them. Buys
            mature after one block. Slippage protects output, not transaction
            success or price manipulation.
          </p>
        </details>
      </section>
      <Ladder />
    </div>
  );
}
import { decodeFunctionData } from "viem";
function decodeSwap(data: `0x${string}`) {
  return decodeFunctionData({ abi: routerAbi, data }).args;
}
