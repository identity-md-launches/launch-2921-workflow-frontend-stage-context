import { parseAbi, keccak256, type Address, type Hex, type Abi } from "viem";
import type { Runtime } from "./config";
import { same } from "./core";
export const adapterAbi = parseAbi([
  "function nativeDistributor() view returns(address)",
  "function hook() view returns(address)",
  "function nativeRound() view returns(uint256)",
  "function nativeRoot() view returns(bytes32)",
  "function nativeFunded() view returns(uint256)",
  "function allocationCount() view returns(uint256)",
  "function indexOf(address) view returns(uint256)",
  "function synced(address) view returns(bool)",
  "function syncClaim(address account,uint256 amount,bytes32[] nativeProof)",
]);
export const walletQuoterAbi = parseAbi([
  "function hook() view returns(address)",
  "function poolManager() view returns(address)",
  "function quoteExactInput(bool zeroForOne,uint128 amountIn) returns(uint256 amountOut,uint256 rewardFee,uint256 lpFeeInput)",
]);
export type RepairConfig = {
  status: string;
  nativeDistributor: Address;
  nativeRound: string;
  nativeRoot: Hex;
  nativeFunded: string;
  adapter: { address: Address; runtimeCodeHash: Hex } | null;
  quoter: { address: Address; runtimeCodeHash: Hex } | null;
  installationReviewed: boolean;
};
export async function verifyAuxiliary(
  r: Runtime,
  kind: "adapter" | "quoter",
  target?: Address,
) {
  const c = r.repair[kind];
  if (!r.repair.installationReviewed)
    throw Error("Auxiliary installation has not completed independent review.");
  if (!c || (target && !same(c.address, target)))
    throw Error(
      `${kind} installation is pending. A reviewed address and runtime code hash must be published first.`,
    );
  const code = await r.client.getCode({ address: c.address });
  if (!code || keccak256(code) !== c.runtimeCodeHash)
    throw Error(`${kind} runtime differs from the reviewed installation.`);
  const abi = kind === "adapter" ? adapterAbi : walletQuoterAbi;
  const read = (functionName: string) =>
    r.client.readContract({
      address: c.address,
      abi: abi as Abi,
      functionName,
    });
  if (!same(String(await read("hook")), r.addresses.UnlockV2Hook))
    throw Error("Auxiliary hook mismatch.");
  if (kind === "adapter") {
    if (
      !same(
        String(await read("nativeDistributor")),
        r.repair.nativeDistributor,
      ) ||
      BigInt(String(await read("nativeRound"))) !==
        BigInt(r.repair.nativeRound) ||
      String(await read("nativeRoot")).toLowerCase() !==
        r.repair.nativeRoot.toLowerCase() ||
      BigInt(String(await read("nativeFunded"))) !==
        BigInt(r.repair.nativeFunded) ||
      BigInt(String(await read("allocationCount"))) === 0n
    )
      throw Error("Adapter native allocation binding mismatch.");
  } else if (
    !same(String(await read("poolManager")), r.d.network.uniswapV4.poolManager)
  )
    throw Error("Quoter PoolManager mismatch.");
  return c.address;
}
