import { parseAbiItem } from "viem";
import type { Runtime } from "./config";

// Creation block from the pinned deployment handoff (UnlockV2Token.blockNumber).
// Addresses and clients always come from the verified runtime; this is a scan bound only.
export const GATE_HISTORY_START = 26334602n;
const contributed = parseAbiItem("event Contributed(address indexed account,uint8 indexed gate,uint256 amount)");

export async function loadGateBurn(r: Runtime, gate: number, atBlock: bigint): Promise<bigint> {
  if (!Number.isInteger(gate) || gate < 1 || gate > 10) throw Error("Select a gate from 1 to 10.");
  if (atBlock < GATE_HISTORY_START) throw Error("Snapshot predates the pinned token deployment.");
  let total = 0n;
  // Bound each request for public-RPC range limits. A failed chunk rejects the whole
  // read: partial history is never presented as a complete burn total.
  for (let start = GATE_HISTORY_START; start <= atBlock; start += 2000n) {
    const logs = await r.client.getLogs({
      address: r.addresses.UnlockV2Token,
      event: contributed,
      args: { gate },
      fromBlock: start,
      toBlock: start + 1999n > atBlock ? atBlock : start + 1999n,
      strict: true,
    });
    for (const log of logs) {
      if (!log.removed && log.args.gate === gate) total += log.args.amount;
    }
  }
  return total;
}
