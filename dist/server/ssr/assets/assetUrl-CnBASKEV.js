//#region app/accountAvailability.ts
function isStaticPages(hostname = typeof location === "undefined" ? "" : location.hostname) {
	return hostname === "github.io" || hostname.endsWith(".github.io");
}
//#endregion
//#region app/assetUrl.ts
/** Public assets must share the build base on both root hosting and project Pages. */
function assetUrl(path) {
	return `${"/".replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
//#endregion
export { isStaticPages as n, assetUrl as t };
