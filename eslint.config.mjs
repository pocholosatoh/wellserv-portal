import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use Next's presets but then turn off the noisy rules globally (temporary)
// Resolve Next's ESLint config from the web app package where it is installed
const compat = new FlatCompat({
  baseDirectory: join(__dirname, "apps/web"),
});
const nextConfigs = compat.extends("next/core-web-vitals", "next/typescript").map((cfg) => ({
  ...cfg,
  settings: {
    ...(cfg.settings ?? {}),
    next: { rootDir: ["apps/web/"] },
  },
}));

const config = [
  ...nextConfigs,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".expo/**",
      "apps/**/.next/**",
      "apps/**/dist/**",
      "apps/**/build/**",
      "apps/**/.expo/**",
      "out/**",
      "build/**",
      "apps/mobile/.expo/**",
      "apps/mobile/android/**",
      "apps/mobile/ios/**",
      "next-env.d.ts",
      "apps/web/next-env.d.ts",
      // optional: ignore legacy routes while you “watch logs”
      "apps/web/app/api/report/**",
      "apps/web/app/api/results/**",
      "apps/web/app/api/_debug/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // TEMP: quiet things down across the repo
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      "no-console": "off",
      "prefer-const": "off",
    },
  },
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["packages/theme/tailwind.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["apps/mobile/metro.config.js", "apps/mobile/tailwind.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default config;
