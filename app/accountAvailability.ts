export function isStaticPages(hostname = typeof location === "undefined" ? "" : location.hostname): boolean {
  if (hostname === "github.io" || hostname.endsWith(".github.io")) return true;
  if (typeof window === "undefined") return false;
  // Electron's private app: protocol and Capacitor's WebView are completely local.
  // Do not call the account API or display login controls in either offline build.
  if (["app:", "herolist:", "capacitor:", "file:"].includes(location.protocol)) return true;
  return Boolean(window.HeroListDesktop || window.HeroListNative);
}
