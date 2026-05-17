import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Masters-green primary — the iconic green jacket / Augusta tournament
        brand: {
          DEFAULT: "#0E5B3D",
          dark: "#0A4530",
          light: "#1F7A53",
        },
        // Vintage magazine palette
        cream: {
          DEFAULT: "#F5EFE0",
          dark: "#EBE3CF",
        },
        // Classic golf magazine red accent
        magred: {
          DEFAULT: "#C8102E",
          dark: "#9E0D24",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
