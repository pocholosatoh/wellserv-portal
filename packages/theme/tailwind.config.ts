import type { Config } from "tailwindcss";
import { colors, spacing, radii, fontSizes } from "./src/index";

const spacingScale = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  "2xl": spacing["2xl"],
};

const borderRadius = {
  none: radii.none,
  sm: radii.sm,
  md: radii.md,
  lg: radii.lg,
  full: radii.pill,
};

const fontSize = {
  xs: [`${fontSizes.xs}px`, { lineHeight: "18px" }],
  sm: [`${fontSizes.sm}px`, { lineHeight: "20px" }],
  base: [`${fontSizes.base}px`, { lineHeight: "24px" }],
  lg: [`${fontSizes.lg}px`, { lineHeight: "28px" }],
  xl: [`${fontSizes.xl}px`, { lineHeight: "32px" }],
  "2xl": [`${fontSizes["2xl"]}px`, { lineHeight: "36px" }],
};

const extend = {
  colors: {
    brand: {
      DEFAULT: colors.primary,
      dark: colors.primaryDark,
      light: colors.primaryLight,
      accent: colors.accent,
    },
    gray: colors.gray,
  },
  spacing: spacingScale,
  borderRadius,
  fontSize,
};

export const webConfig: Config = {
  darkMode: ["class"],
  content: [],
  theme: {
    extend,
  },
  plugins: [],
};

export const nativewindConfig = {
  theme: {
    extend,
  },
};

export default webConfig;
