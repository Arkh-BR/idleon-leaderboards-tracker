import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Mock localStorage globally with in-memory store
const storage: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => (storage[key] = value),
    removeItem: (key: string) => delete storage[key],
    clear: () => Object.keys(storage).forEach((k) => delete storage[k]),
    get length() {
      return Object.keys(storage).length;
    },
    key: (i: number) => Object.keys(storage)[i] ?? null,
  },
  writable: true,
});

// Reset storage before each test
beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
});
