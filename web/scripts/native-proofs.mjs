import { keccak256, encodeAbiParameters, concat, getAddress } from "viem";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
export const nativeLeaf = (account, amount) =>
  keccak256(
    keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [getAddress(account), BigInt(amount)],
      ),
    ),
  );
export const pair = (a, b) =>
  keccak256(concat(BigInt(a) < BigInt(b) ? [a, b] : [b, a]));
export function verify(account, amount, proof, root) {
  return (
    proof.reduce(pair, nativeLeaf(account, amount)).toLowerCase() ===
    root.toLowerCase()
  );
}
/** Complete OZ StandardMerkleTree. The address ordering additionally proves account uniqueness onchain. */
export function buildAllocations(input) {
  if (!Array.isArray(input) || !input.length)
    throw Error("Full canonical allocation array required");
  const allocations = input
    .map((x) => ({
      account: getAddress(x.account),
      amount: BigInt(x.amount).toString(),
    }))
    .sort((a, b) => (BigInt(a.account) < BigInt(b.account) ? -1 : 1));
  for (let i = 0; i < allocations.length; i++)
    if (
      BigInt(allocations[i].amount) <= 0n ||
      BigInt(allocations[i].account) === 0n ||
      (i && allocations[i].account === allocations[i - 1].account)
    )
      throw Error("Zero or duplicate account / invalid amount");
  const leaves = allocations
    .map((x) => ({ ...x, leaf: nativeLeaf(x.account, x.amount) }))
    .sort((a, b) => (BigInt(a.leaf) < BigInt(b.leaf) ? -1 : 1));
  const tree = new Array(2 * leaves.length - 1);
  leaves.forEach((x, i) => {
    x.index = tree.length - 1 - i;
    tree[x.index] = x.leaf;
  });
  for (let i = leaves.length - 2; i >= 0; i--)
    tree[i] = pair(tree[2 * i + 1], tree[2 * i + 2]);
  const proofs = leaves.map((x) => {
    let i = x.index;
    const proof = [];
    while (i > 0) {
      proof.push(tree[i % 2 === 1 ? i + 1 : i - 1]);
      i = Math.floor((i - 1) / 2);
    }
    return { account: x.account, amount: x.amount, proof };
  });
  return {
    root: tree[0],
    allocations,
    proofs,
    total: allocations.reduce((s, x) => s + BigInt(x.amount), 0n).toString(),
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw Error(
      "Usage: node web/scripts/native-proofs.mjs canonical-allocations.json output.json (amounts are integer wei)",
    );
  const config = JSON.parse(
    await readFile(
      new URL("../public/repair-config.json", import.meta.url),
      "utf8",
    ),
  );
  const result = buildAllocations(JSON.parse(await readFile(input, "utf8")));
  if (
    result.root !== config.nativeRoot ||
    BigInt(result.total) > BigInt(config.nativeFunded)
  )
    throw Error(
      "Canonical native root/funding mismatch; no proof package written",
    );
  await writeFile(
    output,
    JSON.stringify(
      {
        ...result,
        nativeDistributor: config.nativeDistributor,
        nativeRound: config.nativeRound,
      },
      null,
      2,
    ) + "\n",
  );
}
