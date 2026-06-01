import { describe, it, expect } from "vitest";
import { CATEGORIES, type CategoryKey } from "@/lib/registry";

describe("registry", () => {
  it("contains 7 categories", () => {
    expect(CATEGORIES).toHaveLength(7);
  });

  const expectedCategories: { key: CategoryKey; expectedBoards: number }[] = [
    { key: "global", expectedBoards: 1 },
    { key: "general", expectedBoards: 47 },
    { key: "tasks", expectedBoards: 11 },
    { key: "skills", expectedBoards: 21 },
    { key: "character", expectedBoards: 14 },
    { key: "misc", expectedBoards: 42 },
    { key: "caverns", expectedBoards: 17 },
  ];

  const totalExpectedBoards = expectedCategories.reduce((sum, c) => sum + c.expectedBoards, 0);

  it(`contains ${totalExpectedBoards} total boards across all categories`, () => {
    const total = CATEGORIES.reduce((sum, cat) => sum + cat.boards.length, 0);
    expect(total).toBe(totalExpectedBoards);
  });

  expectedCategories.forEach(({ key, expectedBoards }) => {
    it(`category '${key}' has ${expectedBoards} boards`, () => {
      const cat = CATEGORIES.find((c) => c.key === key);
      expect(cat).toBeDefined();
      expect(cat!.boards).toHaveLength(expectedBoards);
    });
  });

  it("every board has an apiKey and label", () => {
    for (const cat of CATEGORIES) {
      for (const board of cat.boards) {
        expect(board.apiKey).toBeTruthy();
        expect(board.label).toBeTruthy();
        expect(typeof board.apiKey).toBe("string");
        expect(typeof board.label).toBe("string");
      }
    }
  });

  it("board apiKeys are unique across all categories", () => {
    const keys = new Set<string>();
    for (const cat of CATEGORIES) {
      for (const board of cat.boards) {
        expect(keys.has(board.apiKey)).toBe(false);
        keys.add(board.apiKey);
      }
    }
    expect(keys.size).toBe(totalExpectedBoards);
  });
});
