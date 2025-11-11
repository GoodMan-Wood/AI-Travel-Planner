import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d8ecff",
          200: "#b5dcff",
          300: "#88c4ff",
          400: "#5ba7ff",
          500: "#3d8aff",
          600: "#2568f5",
          700: "#1d50d1",
          800: "#1e45a3",
          900: "#1c3d82"
        }
      }
    }
  },
  plugins: []
};

export default config;
