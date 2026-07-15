/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        royal: {
          900: "#0b1f2a",
          800: "#0f2c3a",
          700: "#153c4e",
          600: "#1c4c63",
        },
        gold: {
          400: "#d4af37",
          500: "#c39a2e",
        },
        felt: "#0e3b2e",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
      },
    },
  },
  plugins: [],
};
