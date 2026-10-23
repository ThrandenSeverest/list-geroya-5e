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
//#region app/assetUrl.ts
/** Public assets must share the build base on both root hosting and project Pages. */
function assetUrl(path) {
	return `${"/".replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
//#endregion
export { isStaticPages as n, assetUrl as t };
