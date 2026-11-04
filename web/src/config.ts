import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  fallback,
  http,
  keccak256,
  toBytes,
  type Abi,
  type Address,
  type EIP1193Provider,
  type Transport,
} from "viem";
import type { RepairConfig } from "./integration";
import { erc20Abi, same, type PoolKey } from "./core";
export type Deployment = {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: string;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  poolKey?: PoolKey;
  assets: { path: string; sha256: string }[];
  network: {
    chainId: number;
    name: string;
    testnet: boolean;
    rpcUrls: string[];
    explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    uniswapV4: {
      poolManager: Address;
      universalRouter: Address;
      quoter: Address;
      stateView: Address;
      positionManager: Address;
      permit2: Address;
      extendedSwapParams?: boolean;
    };
    pairToken: { address: Address; symbol: string; decimals: number };
  };
  walletAddChain?: {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };
};
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
        )
      : v;
const base = new URL(".", document.baseURI);
export const assetUrl = (path: string) => new URL(path, base).href;
async function json(path: string) {
  if (path.includes("..") || path.startsWith("/") || path.includes(":"))
    throw Error("Unsafe asset path.");
  const r = await fetch(assetUrl(path), { cache: "no-cache" });
  if (!r.ok) throw Error(`Cannot load ${path}. Retry.`);
  return r.json();
}
function readTransport(d: Deployment, provider?: EIP1193Provider) {
  const transports: Transport[] = d.network.rpcUrls.map((url) =>
    http(url, {
      timeout: 9000,
      retryCount: 0,
      batch: { batchSize: 100, wait: 20 },
    }),
  );
  if (provider) transports.push(custom(provider, { retryCount: 0 }));
  return fallback(transports, { rank: false, retryCount: 0 });
}
export async function loadConfig() {
  const d = (await json("imd-deployment.json")) as Deployment;
  if (
    d.version !== 1 ||
    d.chainId !== d.network?.chainId ||
    !d.network.rpcUrls.length
  )
    throw Error("Invalid deployment configuration.");
  const abis: Record<string, Abi> = {};
  const addresses: Record<string, Address> = {};
  for (const c of d.contracts) {
    const a = await json(c.abiPath);
    if (
      !Array.isArray(a) ||
      keccak256(toBytes(JSON.stringify(canonical(a)))).slice(2) !== c.abiHash
    )
      throw Error(
        `ABI verification failed for ${c.name}. Transactions disabled.`,
      );
    abis[c.name] = a;
    addresses[c.name] = c.address;
  }
  for (const name of ["MigrationVault", "RewardPot"])
    abis[name] = await json(`abi/${name}.json`);
  const chain = defineChain({
    id: d.chainId,
    name: d.network.name,
    nativeCurrency: d.network.nativeCurrency,
    rpcUrls: { default: { http: d.network.rpcUrls } },
    blockExplorers: { default: { name: "Explorer", url: d.network.explorer } },
  });
  const client = createPublicClient({
    chain,
    transport: readTransport(d),
    batch: { multicall: false },
  });
  const repair = (await json("repair-config.json")) as RepairConfig;
  const runtimes = (await json("contract-runtime.json")) as {
    chainId: number;
    contracts: { name: string; address: Address; runtimeCodeHash: `0x${string}` }[];
  };
  if (runtimes.chainId !== d.chainId) throw Error("Runtime inventory chain mismatch.");
  return { d, abis, addresses, chain, client, repair, runtimes };
}
export type Runtime = Awaited<ReturnType<typeof loadConfig>>;
export function withWalletReadFallback(
  r: Runtime,
  provider: EIP1193Provider,
): Runtime {
  const client = createPublicClient({
    chain: r.chain,
    transport: readTransport(r.d, provider),
    batch: { multicall: false },
  });
  return { ...r, client };
}
export function walletClient(
  r: Runtime,
  provider: EIP1193Provider,
  address: Address,
) {
  return createWalletClient({
    account: address,
    chain: r.chain,
    transport: custom(provider),
  });
}
export async function switchChain(provider: EIP1193Provider, d: Deployment) {
  const param = { chainId: `0x${d.chainId.toString(16)}` };
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [param],
    });
  } catch (error) {
    const e = error as {
      code?: number;
      message?: string;
      data?: { originalError?: { code: number } };
    };
    if (
      e.code === 4902 ||
      e.data?.originalError?.code === 4902 ||
      /unknown chain|unrecognized chain|not added/i.test(e.message ?? "")
    ) {
      if (!d.walletAddChain)
        throw Error("This wallet needs the network added manually.");
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [d.walletAddChain],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [param],
      });
    } else throw error;
  }
}
export async function verifyChain(r: Runtime) {
  if ((await r.client.getChainId()) !== r.d.chainId)
    throw Error("RPC chain ID does not match the deployment.");
  for (const a of [
    ...Object.values(r.addresses),
    r.d.network.pairToken.address,
    r.d.network.uniswapV4.universalRouter,
    r.d.network.uniswapV4.quoter,
    r.d.network.uniswapV4.permit2,
    r.d.network.uniswapV4.poolManager,
  ]) {
    const code = await r.client.getCode({ address: a });
    if (!code || code === "0x")
      throw Error(
        "A deployed contract has no code on the configured chain. Transactions disabled.",
      );
    const pinned = r.runtimes.contracts.find(c => same(c.address, a));
    if (!pinned || keccak256(code) !== pinned.runtimeCodeHash)
      throw Error("Deployed runtime differs from the verified contract inventory. Transactions disabled.");
  }
  const token = r.addresses.UnlockV2Token,
    hook = r.addresses.UnlockV2Hook;
  const read = async (name: string) =>
    r.client.readContract({
      address: hook,
      abi: r.abis.UnlockV2Hook,
      functionName: name,
    });
  const [bound, imd, manager, vault, pot, expected] = await Promise.all(
    [
      "token",
      "imd",
      "poolManager",
      "migrationVault",
      "rewardPot",
      "expectedChainId",
    ].map(read),
  );
  if (
    !same(String(bound), token) ||
    !same(String(imd), r.d.network.pairToken.address) ||
    !same(String(manager), r.d.network.uniswapV4.poolManager) ||
    Number(expected) !== r.d.chainId
  )
    throw Error(
      "Contract bindings differ from the deployment. Transactions disabled.",
    );
  for (const a of [vault, pot]) {
    const code = await r.client.getCode({ address: a as Address });
    if (!code || code === "0x")
      throw Error("A companion contract has no code.");
    const pinned = r.runtimes.contracts.find(c => same(c.address, String(a)));
    if (!pinned || keccak256(code) !== pinned.runtimeCodeHash)
      throw Error("Companion runtime differs from the verified contract inventory.");
  }
  const [vh, v2, ph, pi, dec, imdDec, v1] = await Promise.all([
    r.client.readContract({
      address: vault as Address,
      abi: r.abis.MigrationVault,
      functionName: "hook",
    }),
    r.client.readContract({
      address: vault as Address,
      abi: r.abis.MigrationVault,
      functionName: "v2",
    }),
    r.client.readContract({
      address: pot as Address,
      abi: r.abis.RewardPot,
      functionName: "hook",
    }),
    r.client.readContract({
      address: pot as Address,
      abi: r.abis.RewardPot,
      functionName: "imd",
    }),
    r.client.readContract({
      address: token,
      abi: r.abis.UnlockV2Token,
      functionName: "decimals",
    }),
    r.client.readContract({
      address: imd as Address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    r.client.readContract({
      address: vault as Address,
      abi: r.abis.MigrationVault,
      functionName: "v1",
    }),
  ]);
  if (
    !same(String(vh), hook) ||
    !same(String(v2), token) ||
    !same(String(ph), hook) ||
    !same(String(pi), String(imd)) ||
    Number(dec) !== 18 ||
    Number(imdDec) !== r.d.network.pairToken.decimals
  )
    throw Error("Companion or token metadata verification failed.");
  return { vault: vault as Address, pot: pot as Address, v1: v1 as Address };
}
