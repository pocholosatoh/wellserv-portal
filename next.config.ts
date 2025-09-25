import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Do NOT fail `next build` on ESLint errors (temporary)
    ignoreDuringBuilds: true,
  },
  // Uncomment only if `next build` is failing on TS type errors:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
