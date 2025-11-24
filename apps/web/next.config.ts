import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

loadWorkspaceEnv();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow file uploads up to ~20 MB per request
      bodySizeLimit: "20mb",
    },
  },
  eslint: { ignoreDuringBuilds: true },
  // Uncomment only if `next build` is failing on TS type errors:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

function loadWorkspaceEnv() {
  const workspaceRoot = path.resolve(__dirname, "../..");
  const envFiles = [".env.local", ".env"];

  for (const fileName of envFiles) {
    const fullPath = path.join(workspaceRoot, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const contents = fs.readFileSync(fullPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;

      const key = line.slice(0, eqIndex).trim();
      if (!key) continue;

      let value = line.slice(eqIndex + 1).trim();
      const hasQuotes =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"));

      if (hasQuotes) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
