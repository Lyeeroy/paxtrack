import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this project even if a parent directory has a
  // lockfile (a common local setup).
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
