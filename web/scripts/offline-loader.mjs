// Node-only scripts/tests can use the same vendored viem implementation as the site.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "viem") return {
    url: new URL("../vendor/offline/viem.mjs", import.meta.url).href,
    shortCircuit: true,
  };
  return nextResolve(specifier, context);
}
