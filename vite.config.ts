import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(() => ({
  // Standalone apps serve their packaged assets from the application root.
  // GitHub Pages keeps its project subpath; never reuse it for offline bundles.
  base: process.env.HEROLIST_OFFLINE === "1"
    ? "/"
    : process.env.HEROLIST_PAGES === "1"
      ? `${(process.env.NEXT_PUBLIC_BASE_PATH || "/list-geroya-5e").replace(/\/$/, "")}/`
      : "/",
  // Compile optional chaining/nullish coalescing and other modern syntax for
  // older Android WebViews and Safari. Browser engines still need native ESM.
  build: { target: "es2018" },
  server: {
    host: "0.0.0.0",
    allowedHosts: true as const,
    proxy: { "/api": { target: process.env.API_BASE_URL || "http://127.0.0.1:8000", changeOrigin: true } },
  },
  plugins: [vinext()],
}));
