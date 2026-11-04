// Read-only deployed/source verification. Never overwrites the reviewed runtime pin.
// Run `forge build` first. Optional UNLOCK_READ_RPC selects a read provider for this process only.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createPublicClient, http, keccak256 } from "viem";
import { resolve } from "node:path";
import { root, abiHash } from "./export.mjs";
const json = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const deployment = await json("docs/frontend/deployment-handoff.json");
const network = (await json("docs/frontend/network-handoff.json")).network;
const pinned = await json("web/public/contract-runtime.json");
const client = createPublicClient({transport:http(process.env.UNLOCK_READ_RPC ?? network.rpcUrls[0], {retryCount:0, timeout:20000})});
if (await client.getChainId() !== deployment.chainId) throw Error("Wrong chain");
const block = await client.getBlockNumber();
const verified = [];
for (const item of pinned.contracts) {
  const code = await client.getCode({address:item.address, blockNumber:block});
  if (!code || code === "0x" || keccak256(code) !== item.runtimeCodeHash) throw Error(`Runtime pin mismatch: ${item.name}`);
  let sourceMatch = "Dependency code pinned by hash";
  if (["UnlockV2Token", "UnlockV2Hook", "MigrationVault", "RewardPot"].includes(item.name)) {
    const artifact = await json(`out/${item.name}.sol/${item.name}.json`);
    const binding = deployment.contracts.find(c => c.name === item.name);
    if (binding && abiHash(artifact.abi) !== binding.abiHash) throw Error(`Compiled ABI differs from deployment: ${item.name}`);
    const mask = hex => {
      const bytes = hex.slice(2).split("");
      for (const group of Object.values(artifact.deployedBytecode.immutableReferences ?? {}))
        for (const {start, length} of group) bytes.fill("0", start * 2, (start + length) * 2);
      return bytes.join("").toLowerCase();
    };
    if (mask(code) !== mask(artifact.deployedBytecode.object)) throw Error(`Compiled source mismatch: ${item.name}`);
    sourceMatch = "Compiled runtime matches outside immutable slots; frontend verifies immutable bindings separately";
  }
  verified.push({...item, sourceMatch});
}
for (const name of ["NativeSwarmAdapter", "WalletQuoter"]) {
  const artifact = await json(`out/${name}.sol/${name}.json`);
  const packaged = await json(`docs/repair/package/${name}.json`);
  if (abiHash(artifact.abi) !== abiHash(packaged.abi) || artifact.bytecode.object.toLowerCase() !== packaged.bytecode.toLowerCase())
    throw Error(`Auxiliary package differs from compiled source: ${name}`);
}
await mkdir(resolve(root,"artifacts"), {recursive:true});
await writeFile(resolve(root,"artifacts/runtime-verification.json"), JSON.stringify({mode:"Live reads only",checkedAt:new Date().toISOString(),chainId:deployment.chainId,block:block.toString(),source:network.rpcUrls[0],verified},null,2)+"\n");
console.log(`Verified ${verified.length} deployed runtimes; four source comparisons passed. No transaction sent.`);
