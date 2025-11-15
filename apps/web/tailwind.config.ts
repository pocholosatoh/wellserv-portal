import type { Config } from "tailwindcss";
import themeConfig from "@wellserv/theme/tailwind";

const { webConfig } = themeConfig as { webConfig: Config };

const config: Config = {
  ...webConfig,
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
  ],
};

export default config;
