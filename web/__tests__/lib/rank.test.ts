import { describe, it, expect } from "vitest";
import { rankBgClass, tierOf, TIER_LABELS, TIER_COLORS } from "@/lib/rank";
import type { Tier } from "@/lib/rank";

describe("rankBgClass", () => {
  it("returns 'unranked' style for null", () => {
    expect(rankBgClass(null)).toBe("bg-zinc-800 text-zinc-400");
  });

  it("returns gold style for rank 1", () => {
    expect(rankBgClass(1)).toContain("FFD700");
    expect(rankBgClass(1)).toContain("font-bold");
  });

  it("returns silver style for rank 2", () => {
    expect(rankBgClass(2)).toContain("C0C0C0");
    expect(rankBgClass(2)).toContain("font-bold");
  });

  it("returns bronze style for rank 3", () => {
    expect(rankBgClass(3)).toContain("CD7F32");
  });

  it("returns green for top 10 (ranks 4-10)", () => {
    expect(rankBgClass(4)).toContain("green-400");
    expect(rankBgClass(10)).toContain("green-400");
  });

  it("returns mid-green for top 50", () => {
    expect(rankBgClass(11)).toContain("green-700/40");
    expect(rankBgClass(50)).toContain("green-700/40");
  });

  it("returns yellow for top 100", () => {
    expect(rankBgClass(51)).toContain("yellow-700/40");
    expect(rankBgClass(100)).toContain("yellow-700/40");
  });

  it("returns orange for top 200", () => {
    expect(rankBgClass(101)).toContain("orange-700/40");
    expect(rankBgClass(200)).toContain("orange-700/40");
  });

  it("returns red for top 500", () => {
    expect(rankBgClass(201)).toContain("red-700/40");
    expect(rankBgClass(500)).toContain("red-700/40");
  });

  it("returns dark-red for rank 500+", () => {
    expect(rankBgClass(501)).toContain("red-900/60");
    expect(rankBgClass(999)).toContain("red-900/60");
  });
});

describe("tierOf", () => {
  it("buckets null into rank500plus", () => {
    expect(tierOf(null)).toBe("rank500plus");
  });

  it("returns top10 for ranks 1-10", () => {
    for (let i = 1; i <= 10; i++) {
      expect(tierOf(i)).toBe("top10");
    }
  });

  it("returns top11_50 for ranks 11-50", () => {
    for (let i = 11; i <= 50; i++) {
      expect(tierOf(i)).toBe("top11_50");
    }
  });

  it("returns top51_100 for ranks 51-100", () => {
    for (let i = 51; i <= 100; i++) {
      expect(tierOf(i)).toBe("top51_100");
    }
  });

  it("returns top101_200 for ranks 101-200", () => {
    for (let i = 101; i <= 200; i++) {
      expect(tierOf(i)).toBe("top101_200");
    }
  });

  it("returns rank201_500 for ranks 201-500", () => {
    for (let i = 201; i <= 500; i++) {
      expect(tierOf(i)).toBe("rank201_500");
    }
  });

  it("returns rank500plus for ranks 501+", () => {
    expect(tierOf(501)).toBe("rank500plus");
    expect(tierOf(999_999)).toBe("rank500plus");
  });

  const allTiers: Tier[] = [
    "top10",
    "top11_50",
    "top51_100",
    "top101_200",
    "rank201_500",
    "rank500plus",
  ];

  it("has a label for every tier", () => {
    allTiers.forEach((t) => {
      expect(TIER_LABELS[t]).toBeDefined();
      expect(TIER_LABELS[t]).toBeTruthy();
    });
  });

  it("has a color class for every tier", () => {
    allTiers.forEach((t) => {
      expect(TIER_COLORS[t]).toBeDefined();
      expect(TIER_COLORS[t]).toContain("bg-");
    });
  });
});

describe("Tier constants", () => {
  it("labels contain human-readable ranges", () => {
    expect(TIER_LABELS["top10"]).toBe("Top 10");
    expect(TIER_LABELS["rank500plus"]).toBe("Rank 500+");
  });
});
