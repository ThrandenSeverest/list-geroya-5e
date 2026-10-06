export function isStaticPages(hostname = typeof location === "undefined" ? "" : location.hostname): boolean {
  return hostname === "github.io" || hostname.endsWith(".github.io");
}
