import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
