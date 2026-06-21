import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Make navigator.clipboard writable so individual tests can inject a mock.
// happy-dom exposes clipboard as a getter-only property; Object.defineProperty
// here sets writable:true so tests can do Object.assign(navigator, { clipboard: ... }).
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  configurable: true,
  value: { writeText: () => Promise.resolve() },
});

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
