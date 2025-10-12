/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: { accent: "#44969b" },
      boxShadow: { card: "0 1px 2px rgba(0,0,0,.06)" },
    },
  },
  plugins: [],
};
