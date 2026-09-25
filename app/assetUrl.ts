/// <reference types="vite/client" />

/** Public assets must share the build base on both root hosting and project Pages. */
export function assetUrl(path: string): string {
  const base = import.meta.env?.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
