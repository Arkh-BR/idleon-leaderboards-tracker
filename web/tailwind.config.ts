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
    },
  },
  plugins: [],
} satisfies Config;
