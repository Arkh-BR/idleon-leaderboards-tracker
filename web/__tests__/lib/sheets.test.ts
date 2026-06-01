import { describe, it, expect } from "vitest";
import { mySheets, communitySheets, communityTools, type SheetLink } from "@/lib/sheets";

describe("Sheet data", () => {
  const requiredFields = (list: SheetLink[]) => {
    for (const item of list) {
      expect(item.name).toBeTruthy();
      expect(item.url).toMatch(/^https?:\/\//);
    }
  };

  it("mySheets has valid entries", () => {
    expect(mySheets.length).toBeGreaterThanOrEqual(1);
    requiredFields(mySheets);
    for (const item of mySheets) {
      expect(item.description).toBeTruthy();
    }
  });

  it("communitySheets has valid entries", () => {
    expect(communitySheets.length).toBeGreaterThanOrEqual(1);
    requiredFields(communitySheets);
  });

  it("communityTools has valid entries", () => {
    expect(communityTools.length).toBeGreaterThanOrEqual(1);
    requiredFields(communityTools);
  });

  it("no duplicate URLs across all lists", () => {
    const all = [...mySheets, ...communitySheets, ...communityTools];
    const urls = all.map((s) => s.url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  it("community entries have author or description", () => {
    for (const item of communitySheets) {
      expect(item.author || item.description).toBeTruthy();
    }
  });
});
