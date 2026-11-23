//#region app/assetUrl.ts
/** Public assets must share the build base on both root hosting and project Pages. */
function assetUrl(path) {
	return `${"/".replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
//#endregion
export { assetUrl as t };
