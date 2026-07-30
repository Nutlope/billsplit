import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript 7 is the project typechecker, while Next still requires the
  // TypeScript 6 compatibility package for its programmatic compiler API.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
