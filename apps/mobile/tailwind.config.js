const { nativewindConfig } = require("@wellserv/theme/tailwind");

module.exports = {
  ...nativewindConfig,
  content: ["./app/**/*.{tsx,ts}", "./src/**/*.{tsx,ts}"],
};
