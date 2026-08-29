import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone output for Docker containers; omit on Vercel to prevent NFT tracing errors
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" } : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;


