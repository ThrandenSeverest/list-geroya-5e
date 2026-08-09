/**
 * Node cannot import Cloudflare's runtime-only `cloudflare:` URL scheme while
 * validating the built Worker locally. Provide the smallest possible binding
 * stub so the validator can import the module and inspect its default export.
 * The deployed Worker still uses Cloudflare's native module and real bindings.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export%20const%20env%20%3D%20Object.freeze(%7B%7D)%3B",
    };
  }

  return nextResolve(specifier, context);
}
