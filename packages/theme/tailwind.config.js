const tokens = require("./tokens.json");

const spacingScale = {
  xs: `${tokens.spacing.xs}px`,
  sm: `${tokens.spacing.sm}px`,
  md: `${tokens.spacing.md}px`,
  lg: `${tokens.spacing.lg}px`,
  xl: `${tokens.spacing.xl}px`,
  "2xl": `${tokens.spacing["2xl"]}px`,
};

const borderRadius = {
  none: `${tokens.radii.none}px`,
  sm: `${tokens.radii.sm}px`,
  md: `${tokens.radii.md}px`,
  lg: `${tokens.radii.lg}px`,
  full: `${tokens.radii.pill}px`,
};

const fontSize = {
  xs: [`${tokens.fontSizes.xs}px`, { lineHeight: "18px" }],
  sm: [`${tokens.fontSizes.sm}px`, { lineHeight: "20px" }],
  base: [`${tokens.fontSizes.base}px`, { lineHeight: "24px" }],
  lg: [`${tokens.fontSizes.lg}px`, { lineHeight: "28px" }],
  xl: [`${tokens.fontSizes.xl}px`, { lineHeight: "32px" }],
  "2xl": [`${tokens.fontSizes["2xl"]}px`, { lineHeight: "36px" }],
};

const extend = {
  colors: {
    brand: {
      DEFAULT: tokens.colors.primary,
      dark: tokens.colors.primaryDark,
      light: tokens.colors.primaryLight,
      accent: tokens.colors.accent,
    },
    gray: tokens.colors.gray,
  },
  spacing: spacingScale,
  borderRadius,
  fontSize,
};

const webConfig = {
  darkMode: ["class"],
  content: [],
  theme: {
    extend,
  },
  plugins: [],
};

const nativewindConfig = {
  theme: {
    extend,
  },
};

module.exports = {
  webConfig,
  nativewindConfig,
  default: webConfig,
};
