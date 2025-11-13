import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow file uploads up to ~20 MB per request
      bodySizeLimit: "20mb",
    },
  },
  // Uncomment only if `next build` is failing on TS type errors:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
