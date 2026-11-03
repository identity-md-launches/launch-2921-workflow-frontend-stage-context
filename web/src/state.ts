import { useCallback, useEffect, useRef, useState } from "react";
import { type Address, type Abi, type Hex } from "viem";
import { verifyChain, type Runtime } from "./config";
import { erc20Abi, same, type PoolKey } from "./core";
export type Data = {
  vault: Address;
  pot: Address;
  v1: Address;
  v1Decimals: number;
  owner: Address;
  activated: boolean;
  poolInitialized: boolean;
  isBound: boolean;
  reference: boolean;
  routerSupported: boolean;
  quoterSupported: boolean;
  swarm: Address;
  gates: number;
  pendingGates: number;
  percents: readonly bigint[];
  fdv: readonly [bigint, boolean];
  imdUsd: readonly [bigint, boolean];
  tokenPrice: readonly [bigint, boolean];
  volume: bigint;
  burnProgress: bigint;
  totalBurned: bigint;
  supply: bigint;
  capacity: bigint;
  backing: bigint;
  cap: bigint;
  migrated: bigint;
  lockedV1: bigint;
  funded: boolean;
  points: bigint;
  prePointPot: bigint;
  released: bigint;
  firstPoint: bigint;
  epoch: bigint;
  epochStart: bigint;
  pendingFees: bigint;
  solvency: readonly bigint[];
  solvent: boolean;
  poolKey?: PoolKey;
  poolId: Hex;
  contribution: readonly [number, bigint];
  gateTable: readonly (readonly [number, bigint, bigint, bigint])[];
  block: bigint;
  time: number;
  balance?: bigint;
  imdBalance?: bigint;
  v1Balance?: bigint;
  sellAllowance?: bigint;
  rights?: {
    buyCredited: bigint;
    buySold: bigint;
    otherCredited: bigint;
    otherSold: bigint;
    pendingBuy: bigint;
    pendingBlock: bigint;
  };
  myPoints?: bigint;
  rewards?: readonly [bigint, bigint];
  uncreditedBurned?: bigint;
  claimed?: bigint;
};
export function useData(r?: Runtime, address?: Address) {
  const [data, setData] = useState<Data>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [verified, setVerified] = useState(false),
    [stale, setStale] = useState(true);
  const running = useRef(false),
    identity = useRef("");
  identity.current = address ?? "";
  const refresh = useCallback(async () => {
    if (!r || running.current) return;
    running.current = true;
    setLoading(true);
    const who = address ?? "";
    try {
      const derived = await verifyChain(r);
      const hook = r.addresses.UnlockV2Hook,
        token = r.addresses.UnlockV2Token;
      const h = (name: string, args: readonly unknown[] = []) =>
        r.client.readContract({
          address: hook,
          abi: r.abis.UnlockV2Hook,
          functionName: name,
          args,
        }) as Promise<any>;
      const v = (name: string) =>
        r.client.readContract({
          address: derived.vault,
          abi: r.abis.MigrationVault,
          functionName: name,
        }) as Promise<any>;
      const p = (name: string, args: readonly unknown[] = []) =>
        r.client.readContract({
          address: derived.pot,
          abi: r.abis.RewardPot,
          functionName: name,
          args,
        }) as Promise<any>;
      const t = (
        target: Address,
        name: string,
        args: readonly unknown[] = [],
        abi: Abi = erc20Abi,
      ) =>
        r.client.readContract({
          address: target,
          abi,
          functionName: name,
          args,
        }) as Promise<any>;
      const names = [
        "owner",
        "activated",
        "poolInitialized",
        "isBound",
        "isReferenceAvailable",
        "swarmDistributor",
        "gatesOpen",
        "pendingGatesOpen",
        "unlockedPercents",
        "fdvUsd",
        "imdUsdPrice",
        "tokenPriceInImd",
        "cumulativeVolumeUsd",
        "burnProgress",
        "totalBurned",
        "officialPoolId",
        "contributionQuote",
      ];
      const values = await Promise.all(names.map((n) => h(n)));
      const x = Object.fromEntries(names.map((n, i) => [n, values[i]]));
      const [
        capacity,
        backing,
        cap,
        migrated,
        lockedV1,
        funded,
        points,
        prePointPot,
        released,
        firstPoint,
        epoch,
        epochStart,
        pendingFees,
        solvency,
        solvent,
        routerSupported,
        quoterSupported,
        supply,
        v1Decimals,
        key,
        gateTable,
        block,
      ] = await Promise.all([
        v("remainingCapacity"),
        v("remainingBacking"),
        v("CAP"),
        v("totalMigrated"),
        v("lockedV1"),
        v("isFullyFunded"),
        p("totalPoints"),
        p("prePointPot"),
        p("prePointReleased"),
        p("firstPointTime"),
        p("currentEpoch"),
        p("epochStart"),
        h("pendingFees"),
        p("solvency"),
        p("isSolvent"),
        h("isRouter", [r.d.network.uniswapV4.universalRouter]),
        h("isRouter", [r.d.network.uniswapV4.quoter]),
        t(token, "totalSupply", [], r.abis.UnlockV2Token),
        t(derived.v1, "decimals"),
        h("poolKey"),
        Promise.all(Array.from({ length: 10 }, (_, i) => h("gate", [i + 1]))),
        r.client.getBlockNumber(),
      ]);
      let poolKey: PoolKey | undefined;
      if (x.poolInitialized) {
        const live = {
          currency0: key[0],
          currency1: key[1],
          fee: key[2],
          tickSpacing: key[3],
          hooks: key[4],
        } as PoolKey;
        poolKey = r.d.poolKey ?? live;
        if (
          !same(poolKey.currency0, live.currency0) ||
          !same(poolKey.currency1, live.currency1) ||
          poolKey.fee !== live.fee ||
          poolKey.tickSpacing !== live.tickSpacing ||
          !same(poolKey.hooks, live.hooks)
        )
          throw Error("Pool key differs from the attested deployment.");
        if (
          !same(poolKey.hooks, hook) ||
          ![poolKey.currency0, poolKey.currency1].some((a) => same(a, token)) ||
          ![poolKey.currency0, poolKey.currency1].some((a) =>
            same(a, r.d.network.pairToken.address),
          )
        )
          throw Error("Unexpected pool currencies or hook.");
      }
      const next: Data = {
        ...derived,
        v1Decimals: Number(v1Decimals),
        owner: x.owner,
        activated: x.activated,
        poolInitialized: x.poolInitialized,
        isBound: x.isBound,
        reference: x.isReferenceAvailable,
        routerSupported,
        quoterSupported,
        swarm: x.swarmDistributor,
        gates: x.gatesOpen,
        pendingGates: x.pendingGatesOpen,
        percents: x.unlockedPercents,
        fdv: x.fdvUsd,
        imdUsd: x.imdUsdPrice,
        tokenPrice: x.tokenPriceInImd,
        volume: x.cumulativeVolumeUsd,
        burnProgress: x.burnProgress,
        totalBurned: x.totalBurned,
        supply,
        capacity,
        backing,
        cap,
        migrated,
        lockedV1,
        funded,
        points,
        prePointPot,
        released,
        firstPoint,
        epoch,
        epochStart,
        pendingFees,
        solvency,
        solvent,
        poolKey,
        poolId: x.officialPoolId,
        contribution: x.contributionQuote,
        gateTable,
        block,
        time: Date.now(),
      };
      if (address) {
        const [
          balance,
          imdBalance,
          v1Balance,
          sellAllowance,
          rights,
          myPoints,
          rewards,
          uncreditedBurned,
          account,
        ] = await Promise.all([
          t(token, "balanceOf", [address]),
          t(r.d.network.pairToken.address, "balanceOf", [address]),
          t(derived.v1, "balanceOf", [address]),
          h("sellAllowance", [address]),
          h("rightsOf", [address]),
          p("points", [address]),
          p("rewardsOf", [address]),
          h("uncreditedBurned", [address]),
          p("accountOf", [address]),
        ]);
        Object.assign(next, {
          balance,
          imdBalance,
          v1Balance,
          sellAllowance,
          rights,
          myPoints,
          rewards,
          uncreditedBurned,
          claimed: account.claimed,
        });
      }
      if (who !== identity.current) return;
      setData(next);
      setVerified(true);
      setStale(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network read failed.");
      setVerified(false);
      setStale(true);
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, [r, address]);
  useEffect(() => {
    setData(undefined);
    setVerified(false);
    setStale(true);
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12000);
    const resume = () => {
      if (document.visibilityState === "visible") {
        setStale(true);
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);
  return { data, error, loading, verified, stale, refresh };
}
