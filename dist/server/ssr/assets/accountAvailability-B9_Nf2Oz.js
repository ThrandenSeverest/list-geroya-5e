//#region app/accountAvailability.ts
function isStaticPages(hostname = typeof location === "undefined" ? "" : location.hostname) {
	if (hostname === "github.io" || hostname.endsWith(".github.io")) return true;
	if (typeof window === "undefined") return false;
	if ([
		"app:",
		"herolist:",
		"capacitor:",
		"file:"
	].includes(location.protocol)) return true;
	return Boolean(window.HeroListDesktop || window.HeroListNative);
}
//#endregion
export { isStaticPages as t };
