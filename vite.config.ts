import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(() => ({
  base: process.env.HEROLIST_PAGES === "1" ? `${process.env.NEXT_PUBLIC_BASE_PATH || "/list-geroya-5e"}/` : "/",
  server: {
    host: "0.0.0.0",
    allowedHosts: true as const,
    proxy: { "/api": { target: process.env.API_BASE_URL || "http://127.0.0.1:8000", changeOrigin: true } },
  },
  plugins: [vinext()],
}));
