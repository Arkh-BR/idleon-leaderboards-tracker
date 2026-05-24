import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a2e",
        gold: "#FFD700",
        silver: "#C0C0C0",
        bronze: "#CD7F32",
      },
      fontFamily: {
        // Inter is loaded in app/layout.tsx via next/font as --font-inter.
        // Map Tailwind's `font-sans` to it so the entire app picks it up
        // even on elements that already had `font-sans` baked in.
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
