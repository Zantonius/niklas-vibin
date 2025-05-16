import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  runtime: "edge", // Needed for Cloudflare compatibility
  output: "export", // Optional if using static + Ably
};

export default nextConfig;
