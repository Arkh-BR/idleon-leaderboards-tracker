/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./__tests__/setupTests.ts"],
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/_stubs/**", "**/api/**/route.ts", "e2e/**", "**/*.spec.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@parsers": path.resolve(__dirname, "lib/it/parsers"),
      "@utility": path.resolve(__dirname, "lib/it/utility"),
      "@website-data": path.resolve(__dirname, "lib/it/data/website-data.json"),
      "@components": path.resolve(__dirname, "lib/it/_stubs/components"),
      "@hooks": path.resolve(__dirname, "lib/it/_stubs/hooks"),
    },
  },
});
