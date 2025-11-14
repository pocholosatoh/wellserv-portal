import type { Config } from "tailwindcss";
import { webConfig } from "@wellserv/theme/tailwind";

const config: Config = {
  ...webConfig,
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
  ],
};

export default config;
