import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#517AA4",
          tint: "#D1DCE8",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
