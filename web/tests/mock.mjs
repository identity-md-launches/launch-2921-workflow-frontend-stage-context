import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  decodeFunctionData,
  encodeFunctionResult,
  parseAbi,
  toHex,
} from "viem";
import { root } from "../scripts/export.mjs";
const read = async (p) => JSON.parse(await readFile(resolve(root, p), "utf8"));
const deployment = await read("dist/imd-deployment.json");
const abi = {};
for (const n of [
  "UnlockV2Token",
  "UnlockV2Hook",
  "MigrationVault",
  "RewardPot",
])
  abi[n] = await read("dist/abi/" + n + ".json");
const erc20 = parseAbi([
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)",
  "function decimals() view returns(uint8)",
  "function symbol() view returns(string)",
  "function transfer(address,uint256) returns(bool)",
]);
const permit = parseAbi([
  "function allowance(address,address,address) view returns(uint160,uint48,uint48)",
  "function approve(address,address,uint160,uint48)",
]);
const quote = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
];
const router = parseAbi(["function execute(bytes,bytes[],uint256) payable"]);
const distributorAbi = parseAbi([
  "function merkleRoot() view returns(bytes32)",
  "function isClaimed(uint256) view returns(bool)",
]);
export const token = deployment.contracts.find(
  (x) => x.name === "UnlockV2Token",
).address;
export const hook = deployment.contracts.find(
  (x) => x.name === "UnlockV2Hook",
).address;
const net = deployment.network;
// Synthetic companion addresses exist only in this intercepted test fixture, never runtime configuration.
export const vault = "0x1111111111111111111111111111111111111111",
  pot = "0x2222222222222222222222222222222222222222",
  distributor = "0x3333333333333333333333333333333333333333";
export const walletQuoter = "0x4444444444444444444444444444444444444444";
const walletQuoterAbi = parseAbi([
  "function hook() view returns(address)",
  "function poolManager() view returns(address)",
  "function quoteExactInput(bool zeroForOne,uint128 amountIn) returns(uint256 amountOut,uint256 rewardFee,uint256 lpFeeInput)",
]);
export const owner = "0x48e4e74fe1d0c14404ceb57b9fec5b21329c6ec9";
export const E = 10n ** 18n;
const rows = [
  [25, 250000, 125000, 25000000],
  [30, 500000, 375000, 22000000],
  [35, 1000000, 750000, 19000000],
  [40, 2000000, 1500000, 16000000],
  [50, 3500000, 2500000, 13000000],
  [60, 5000000, 4000000, 10000000],
  [70, 8000000, 6000000, 8000000],
  [80, 12000000, 9000000, 6000000],
  [90, 18000000, 12500000, 4000000],
  [100, 25000000, 20000000, 2000000],
];
export function fixture() {
  return {
    chain: 137,
    address: owner,
    reject: false,
    unknownChain: true,
    activated: true,
    gates: 0,
    routerSupported: true,
    quoterSupported: true,
    swarm: distributor,
    funded: true,
    balance: 750000000n * E,
    imdBalance: 10000n * E,
    v1Balance: 5000n * E,
    capacity: 700000000n * E,
    backing: 700000000n * E,
    totalMigrated: 0n,
    tokenAllowance: 0n,
    sellTokenAllowance: 0n,
    v1Allowance: 0n,
    permitAllowance: 0n,
    sellPermitAllowance: 0n,
    expiry: 0,
    burnProgress: 0n,
    claimable: 25n * E,
    maturing: 8n * E,
    myPoints: 1000n * E,
    points: 10000n * E,
    pausedReceipt: false,
    failSimulation: false,
    failSellQuote: false,
    missingCode: false,
    failRpc: false,
    receiptError: false,
    receiptReverted: false,
    rejectSend: false,
    sends: [],
    walletRequests: [],
    calls: [],
    hashes: [],
    block: 26334699n,
  };
}
export function rpcMock(s) {
  const byAddress = {
    [token.toLowerCase()]: abi.UnlockV2Token,
    [hook.toLowerCase()]: abi.UnlockV2Hook,
    [vault]: abi.MigrationVault,
    [pot]: abi.RewardPot,
    [net.pairToken.address.toLowerCase()]: erc20,
    [net.uniswapV4.permit2.toLowerCase()]: permit,
    [net.uniswapV4.quoter.toLowerCase()]: quote,
    [net.uniswapV4.universalRouter.toLowerCase()]: router,
    [distributor]: distributorAbi,
    [walletQuoter]: walletQuoterAbi,
  };
  function decode(tx) {
    const target = tx.to.toLowerCase();
    const a = byAddress[target] ?? erc20;
    return { ...decodeFunctionData({ abi: a, data: tx.data }), abi: a, target };
  }
  function simulate(tx) {
    const { functionName: f, args = [], abi: a, target } = decode(tx);
    s.calls.push({ method: f, target, args });
    if (
      s.failSimulation &&
      [
        "execute",
        "migrate",
        "burn",
        "contribute",
        "claim",
        "checkpoint",
      ].includes(f)
    )
      return {
        error: { code: 3, message: "execution reverted: ReferenceUnavailable" },
      };
    if (
      s.failSellQuote &&
      (f === "quoteExactInputSingle" || f === "quoteExactInput")
    )
      return {
        error: { code: 3, message: "execution reverted: SellExceedsAllowance" },
      };
    const common = {
      token,
      imd: net.pairToken.address,
      poolManager: net.uniswapV4.poolManager,
      migrationVault: vault,
      rewardPot: pot,
      expectedChainId: 1n,
      hook,
      owner,
      activated: s.activated,
      poolInitialized: true,
      isBound: true,
      isReferenceAvailable: true,
      swarmDistributor: s.swarm,
      gatesOpen: s.gates,
      pendingGatesOpen: s.pendingGates ?? s.gates,
      unlockedPercents: s.gates
        ? [BigInt(rows[s.gates - 1][0]), BigInt(rows[s.gates - 1][0])]
        : [20n, 0n],
      gateImdUsdPrice: [1n * E, true],
      lastFdvUsd: 80000n * E,
      lastFdvBlock: s.block - 1n,
      lastValidObservation: BigInt(Math.floor(Date.now() / 1000)),
      trackedAt: BigInt(Math.floor(Date.now() / 1000)),
      fdvUsd: [100000n * E, true],
      imdUsdPrice: s.invalidUsd ? [0n, false] : [2n * E, true],
      tokenPriceInImd: [(1n * E) / 1000n, true],
      cumulativeVolumeUsd: 50000n * E,
      burnProgress: s.burnProgress,
      totalBurned: 1000n * E,
      officialPoolId: "0x" + "ab".repeat(32),
      contributionQuote:
        s.gates === 10
          ? [0, 0n]
          : [s.gates + 1, BigInt(rows[s.gates][3]) * E - s.burnProgress],
      remainingCapacity: s.capacity,
      remainingBacking: s.backing,
      CAP: 700000000n * E,
      totalMigrated: s.totalMigrated,
      lockedV1: s.totalMigrated,
      isFullyFunded: s.funded,
      totalPoints: s.points,
      prePointPot: 100n * E,
      prePointReleased: 50n * E,
      firstPointTime: 1780000000n,
      currentEpoch: 5n,
      epochStart: 1780000000n,
      pendingFees: 50n * E,
      solvency: [
        100n * E,
        80n * E,
        70n * E,
        10n * E,
        30n * E,
        60n * E,
        20n * E,
      ],
      isSolvent: true,
      totalSupply: 999999000n * E,
      decimals: 18,
      symbol: "UNLK2",
      poolKey: [token, net.pairToken.address, 12500, 60, hook],
      v1: "0x99fa82b022be4575891a43b757bc770691e18fda",
      v2: token,
      sellAllowance: s.gates === 10 ? 2n ** 256n - 1n : 200n * E,
      rightsOf: {
        buyCredited: 1000n * E,
        buySold: 0n,
        otherCredited: 500n * E,
        otherSold: 0n,
        pendingBuy: 10n * E,
        pendingBlock: s.block,
      },
      points: s.myPoints,
      rewardsOf: [s.claimable, s.maturing],
      uncreditedBurned: 10n * E,
      accountOf: {
        points: s.myPoints,
        debt: 0n,
        matured: s.claimable,
        pending: s.maturing,
        lastEpoch: 5n,
        claimed: 10n * E,
      },
      merkleRoot: "0x" + "cd".repeat(32),
      isClaimed: true,
      swarmIndexCredited: false,
    };
    let result = common[f];
    if (f === "isRouter")
      result =
        String(args[0]).toLowerCase() === net.uniswapV4.quoter.toLowerCase()
          ? s.quoterSupported
          : s.routerSupported;
    if (f === "gate") {
      const row = rows[Number(args[0]) - 1];
      result = [row[0], ...row.slice(1).map((n) => BigInt(n) * E)];
    }
    if (f === "balanceOf")
      result =
        target === token.toLowerCase()
          ? s.balance
          : target === net.pairToken.address.toLowerCase()
            ? s.imdBalance
            : s.v1Balance;
    if (f === "allowance")
      result =
        target === net.uniswapV4.permit2.toLowerCase()
          ? [
              String(args[1]).toLowerCase() === token.toLowerCase()
                ? s.sellPermitAllowance
                : s.permitAllowance,
              s.expiry,
              0,
            ]
          : target === "0x99fa82b022be4575891a43b757bc770691e18fda"
            ? s.v1Allowance
            : target === token.toLowerCase()
              ? s.sellTokenAllowance
              : s.tokenAllowance;
    if (f === "contribute" && Number(args[0]) !== s.gates + 1)
      return { error: { code: 3, message: "execution reverted: StaleGate" } };
    if (f === "previewBurn") {
      const n = args[1];
      result = [
        n < 10n * E ? n : 10n * E,
        n > 10n * E ? n - 10n * E : 0n,
        0n,
        0n,
        s.previewAllowance ?? 200n * E,
      ];
    }
    if (f === "quoteExactInput")
      result = [
        args[0] ? args[1] / 1000n : args[1] * 1000n,
        args[1] / 100n,
        args[1] / 80n,
      ];
    if (f === "quoteExactInputSingle")
      result = [args[0].exactAmount * 1000n, 120000n];
    if (["approve", "transfer", "transferFrom"].includes(f))
      result =
        target === net.uniswapV4.permit2.toLowerCase() ? undefined : true;
    if (f === "claim") result = s.claimable;
    if (f === "redeemFees") result = 50n * E;
    try {
      return {
        result: encodeFunctionResult({ abi: a, functionName: f, result }),
      };
    } catch (e) {
      throw Error(`Mock result failed for ${f}: ${e.message}`);
    }
  }
  async function rpc(q) {
    const { id, method, params = [] } = q;
    let result;
    switch (method) {
      case "eth_getLogs":
        if (s.failMarket) return {jsonrpc:"2.0",id,error:{code:-32000,message:"Historical logs unavailable"}};
        result = (s.marketLogs ?? []).filter(
          (l) =>
            BigInt(l.blockNumber) >= BigInt(params[0].fromBlock) &&
            BigInt(l.blockNumber) <= BigInt(params[0].toBlock),
        );
        break;
      case "eth_chainId":
        result = "0x1";
        break;
      case "eth_getCode":
        result = s.missingCode ? "0x" : "0x60016000";
        break;
      case "eth_blockNumber":
        result = toHex(s.block);
        break;
      case "eth_call": {
        const res = simulate(params[0]);
        return { jsonrpc: "2.0", id, ...res };
      }
      case "eth_estimateGas":
        result = "0x30d40";
        break;
      case "eth_getTransactionReceipt":
        if (s.receiptError)
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: "Receipt RPC temporarily unavailable",
            },
          };
        result = s.pausedReceipt
          ? null
          : {
              transactionHash: params[0],
              transactionIndex: "0x0",
              blockHash: "0x" + "ef".repeat(32),
              blockNumber: toHex(s.block),
              from: s.address,
              to: s.sends.at(-1)?.to ?? token,
              cumulativeGasUsed: "0x10000",
              gasUsed: "0x10000",
              contractAddress: null,
              logs: [],
              logsBloom: "0x" + "00".repeat(256),
              status: s.receiptReverted ? "0x0" : "0x1",
              type: "0x2",
              effectiveGasPrice: "0x1",
            };
        break;
      case "eth_getTransactionByHash":
        result = {
          hash: params[0],
          nonce: "0x1",
          blockHash: "0x" + "ef".repeat(32),
          blockNumber: toHex(s.block),
          transactionIndex: "0x0",
          from: s.address,
          to: s.sends.at(-1)?.to ?? token,
          value: "0x0",
          gas: "0x30d40",
          gasPrice: "0x1",
          input: s.sends.at(-1)?.data ?? "0x",
          type: "0x2",
          chainId: "0x1",
          v: "0x0",
          r: "0x" + "11".repeat(32),
          s: "0x" + "22".repeat(32),
          maxFeePerGas: "0x2",
          maxPriorityFeePerGas: "0x1",
          accessList: [],
        };
        break;
      case "eth_getBlockByNumber":
        result = {
          number: toHex(s.block),
          hash: "0x" + "ef".repeat(32),
          parentHash: "0x" + "ef".repeat(32),
          nonce: "0x0000000000000000",
          sha3Uncles: "0x" + "00".repeat(32),
          logsBloom: "0x" + "00".repeat(256),
          transactionsRoot: "0x" + "00".repeat(32),
          stateRoot: "0x" + "00".repeat(32),
          receiptsRoot: "0x" + "00".repeat(32),
          miner: s.address,
          difficulty: "0x0",
          totalDifficulty: "0x0",
          extraData: "0x",
          size: "0x1",
          gasLimit: "0x100000",
          gasUsed: "0x10000",
          timestamp: toHex(
            BigInt(s.blockTimes?.[params[0]] ?? Math.floor(Date.now() / 1000)),
          ),
          transactions: [],
          uncles: [],
          baseFeePerGas: "0x1",
          mixHash: "0x" + "00".repeat(32),
        };
        break;
      default:
        throw Error("Unhandled mock RPC " + method);
    }
    return { jsonrpc: "2.0", id, result };
  }
  async function wallet(q) {
    s.walletRequests.push(q);
    switch (q.method) {
      case "eth_requestAccounts":
        if (s.reject)
          throw Object.assign(Error("User rejected request"), { code: 4001 });
        return [s.address];
      case "eth_accounts":
        return [s.address];
      case "eth_chainId":
        return toHex(s.chain);
      case "wallet_switchEthereumChain":
        if (s.unknownChain) {
          s.unknownChain = false;
          throw Object.assign(Error("Unknown chain"), { code: 4902 });
        }
        s.chain = Number(q.params[0].chainId);
        return null;
      case "wallet_addEthereumChain":
        return null;
      case "eth_sendTransaction": {
        if (s.rejectSend)
          throw Object.assign(Error("User rejected request"), { code: 4001 });
        s.block += 1n;
        const tx = q.params[0];
        s.sends.push(tx);
        const { functionName: f, args = [], target } = decode(tx);
        if (f === "approve") {
          if (target === net.uniswapV4.permit2.toLowerCase()) {
            if (String(args[0]).toLowerCase() === token.toLowerCase())
              s.sellPermitAllowance = args[2];
            else s.permitAllowance = args[2];
            s.expiry = Number(args[3]);
          } else if (target === "0x99fa82b022be4575891a43b757bc770691e18fda")
            s.v1Allowance = args[1];
          else if (target === token.toLowerCase())
            s.sellTokenAllowance = args[1];
          else s.tokenAllowance = args[1];
        }
        if (f === "migrate") {
          s.capacity -= args[0];
          s.backing -= args[0];
          s.totalMigrated += args[0];
          s.v1Balance -= args[0];
          s.balance += args[0];
        }
        if (f === "burn" || f === "contribute") {
          const n = args.at(-1);
          s.balance -= n;
          s.myPoints += n;
          s.points += n;
          if (f === "contribute") s.burnProgress += n;
        }
        if (f === "claim") s.claimable = 0n;
        const hash = "0x" + s.sends.length.toString(16).padStart(64, "0");
        s.hashes.push(hash);
        return hash;
      }
      default:
        throw Error("Unhandled mock wallet " + q.method);
    }
  }
  return { rpc, wallet };
}
export { deployment };
