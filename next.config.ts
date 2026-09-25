import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.HEROLIST_PAGES === "1" ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
