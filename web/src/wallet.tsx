import { useEffect, useId, useRef, useState } from "react";
import { getAddress, type Address, type EIP1193Provider } from "viem";
import { switchChain, type Deployment } from "./config";
import { errorText } from "./core";
export type Provider = EIP1193Provider & {
  on?: (event: string, fn: (v: never) => void) => void;
  removeListener?: (event: string, fn: (v: never) => void) => void;
};
type Discovery = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Provider;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
async function coinbaseProvider(d: Deployment): Promise<Provider> {
  const { createCoinbaseWalletSDK } = await import("@coinbase/wallet-sdk");
  return createCoinbaseWalletSDK({
    appName: "UNLOCK V2",
    appLogoUrl: new URL("favicon.svg", document.baseURI).href,
    appChainIds: [d.chainId],
    preference: { options: "smartWalletOnly" },
  }).getProvider() as unknown as Provider;
}
export function useWallet(d?: Deployment) {
  const [providers, setProviders] = useState<Discovery[]>([]),
    [provider, setProvider] = useState<Provider>(),
    [address, setAddress] = useState<Address>(),
    [chainId, setChain] = useState<number>(),
    [open, setOpen] = useState(false),
    [pending, setPending] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const listener = (e: Event) => {
      const p = (e as CustomEvent<Discovery>).detail;
      if (p?.info?.uuid && p.provider)
        setProviders((list) =>
          list.some((x) => x.info.uuid === p.info.uuid) ? list : [...list, p],
        );
    };
    window.addEventListener("eip6963:announceProvider", listener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () =>
      window.removeEventListener("eip6963:announceProvider", listener);
  }, []);
  const connect = async (p: Provider, name: string) => {
    if (!d) return;
    setPending(name);
    setError("");
    try {
      const accounts = (await p.request({
        method: "eth_requestAccounts",
      })) as Address[];
      if (!accounts[0])
        throw Error("No account was returned. Unlock your wallet and retry.");
      setProvider(p);
      setAddress(getAddress(accounts[0]));
      setChain(Number(await p.request({ method: "eth_chainId" })));
      localStorage.setItem("unlk2-wallet", name);
      try {
        await switchChain(p, d);
      } finally {
        setChain(Number(await p.request({ method: "eth_chainId" })));
      }
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending("");
    }
  };
  useEffect(() => {
    if (!d || provider) return;
    let cancelled = false;
    const remembered = localStorage.getItem("unlk2-wallet");
    const restore = async () => {
      let selected = providers.find(
        (p) => p.info.name === remembered,
      )?.provider;
      if (!selected && remembered === "Browser wallet")
        selected = window.ethereum;
      if (!selected && remembered === "Coinbase Smart Wallet")
        selected = await coinbaseProvider(d);
      if (!selected) return;
      const accounts = (await selected.request({
        method: "eth_accounts",
      })) as Address[];
      if (!accounts[0]) return;
      const id = Number(await selected.request({ method: "eth_chainId" }));
      if (cancelled) return;
      setProvider(selected);
      setAddress(getAddress(accounts[0]));
      setChain(id);
    };
    void restore().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [d, providers, provider]);
  useEffect(() => {
    if (!provider) return;
    const accounts = (a: Address[]) => {
      setAddress(a[0] ? getAddress(a[0]) : undefined);
    };
    const chain = (id: string) => setChain(Number(id));
    const off = () => {
      setAddress(undefined);
      setChain(undefined);
    };
    provider.on?.("accountsChanged", accounts as (v: never) => void);
    provider.on?.("chainChanged", chain as (v: never) => void);
    provider.on?.("disconnect", off);
    return () => {
      provider.removeListener?.(
        "accountsChanged",
        accounts as (v: never) => void,
      );
      provider.removeListener?.("chainChanged", chain as (v: never) => void);
      provider.removeListener?.("disconnect", off);
    };
  }, [provider]);
  const switchNetwork = async () => {
    if (!provider || !d) return;
    setError("");
    setPending("Switch network");
    try {
      await switchChain(provider, d);
      setChain(Number(await provider.request({ method: "eth_chainId" })));
    } catch (e) {
      setError(errorText(e));
      setOpen(true);
    } finally {
      setPending("");
    }
  };
  const smart = async () => {
    if (!d) return;
    setPending("Coinbase Smart Wallet");
    setError("");
    try {
      await connect(await coinbaseProvider(d), "Coinbase Smart Wallet");
    } catch (e) {
      setError(errorText(e));
      setPending("");
    }
  };
  return {
    providers,
    provider,
    address,
    chainId,
    open,
    setOpen,
    pending,
    error,
    connect,
    smart,
    switchNetwork,
    disconnect: () => {
      setAddress(undefined);
      setProvider(undefined);
      setChain(undefined);
      localStorage.removeItem("unlk2-wallet");
      setOpen(false);
    },
    wrong: !!address && chainId !== d?.chainId,
  };
}
export type Wallet = ReturnType<typeof useWallet>;
export function WalletDialog({ wallet: w }: { wallet: Wallet }) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (w.open) ref.current?.showModal();
    else ref.current?.close();
  }, [w.open]);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    url = location.href;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={() => w.setOpen(false)}
      onClick={(e) => {
        if (e.target === ref.current) w.setOpen(false);
      }}
      className="wallet-dialog"
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{w.address ? "Your wallet" : "Connect wallet"}</h2>
        <button
          type="button"
          aria-label="Close wallet dialog"
          onClick={() => w.setOpen(false)}
        >
          ×
        </button>
      </div>
      {w.address ? (
        <>
          <p className="address">{w.address}</p>
          <button
            className="full"
            onClick={() => {
              void navigator.clipboard.writeText(w.address!);
            }}
          >
            Copy address
          </button>
          {w.wrong && (
            <button className="full" onClick={() => void w.switchNetwork()}>
              Switch network
            </button>
          )}
          <button className="full" onClick={w.disconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <>
          <p>Your wallet holds your keys and confirms every transaction.</p>
          {w.providers.map((p) => (
            <button
              className="wallet-row"
              key={p.info.uuid}
              disabled={!!w.pending}
              onClick={() => void w.connect(p.provider, p.info.name)}
            >
              <img
                src={
                  /^data:image\//.test(p.info.icon)
                    ? p.info.icon
                    : "./wallet-browser.svg"
                }
                alt=""
              />
              {p.info.name}
              <span>{w.pending === p.info.name ? "Opening…" : "→"}</span>
            </button>
          ))}
          {!w.providers.length && window.ethereum && (
            <button
              className="wallet-row"
              disabled={!!w.pending}
              onClick={() => void w.connect(window.ethereum!, "Browser wallet")}
            >
              <img src="./wallet-browser.svg" alt="" />
              Browser wallet<span>→</span>
            </button>
          )}
          {mobile && !window.ethereum && !w.providers.length && (
            <>
              {[
                [
                  "MetaMask",
                  `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
                  "metamask",
                ],
                [
                  "Coinbase Wallet",
                  `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
                  "coinbase",
                ],
                [
                  "Rabby",
                  `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
                  "rabby",
                ],
                [
                  "Phantom",
                  `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin)}`,
                  "phantom",
                ],
              ].map(([name, href, icon]) => (
                <a className="wallet-row" key={name} href={href}>
                  <img src={`./wallet-${icon}.svg`} alt="" />
                  Open in {name}
                  <span>↗</span>
                </a>
              ))}
            </>
          )}
          {!w.providers.length && !window.ethereum && !mobile && (
            <p className="notice">
              No browser wallet found. Enable your extension, then retry, or use
              a passkey wallet below.
            </p>
          )}
          <button
            className="wallet-row"
            disabled={!!w.pending}
            onClick={() => void w.smart()}
          >
            <img src="./wallet-coinbase.svg" alt="" />
            Coinbase Smart Wallet
            <span>
              {w.pending === "Coinbase Smart Wallet" ? "Opening…" : "→"}
            </span>
          </button>
          <p className="muted">
            On a phone, open this page in your wallet’s browser. No relay or
            project ID is required.
          </p>
        </>
      )}
      <div role="status">
        {w.pending && `${w.pending}: waiting for your wallet.`}
      </div>
      {w.error && (
        <p role="alert" className="error">
          {w.error}
        </p>
      )}
    </dialog>
  );
}
