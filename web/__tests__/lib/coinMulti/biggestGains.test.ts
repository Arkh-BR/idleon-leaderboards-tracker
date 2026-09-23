import { describe, it, expect } from "vitest";
import { computeCoinGains, splitCoinGains } from "@/lib/coinMulti/biggestGains";
import { COIN_GROUPS, COIN_ROOT } from "@/lib/arkh/stats/defs/coin-multi";

const G = (key: string) => `${COIN_ROOT} / ${COIN_GROUPS.find((g) => g.key === key)!.name}`;

describe("Coin Multi biggest gains", () => {
  it("pct group: the new group factor over the old one", () => {
    const yours = { [G("g23")]: 4, [`${G("g23")} / A`]: 100, [`${G("g23")} / B`]: 200 }; // S = 300
    const ref = { [`${G("g23")} / A`]: 400 };
    const { rows } = computeCoinGains(yours, ref);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "A", kind: "pct", you: 100, max: 400 });
    expect(rows[0].gainPct).toBeCloseTo(75, 9); // (1 + 6) / 4 − 1
  });

  it("raw group has no /100", () => {
    const yours = { [G("g18")]: 3, [`${G("g18")} / X`]: 0.5 }; // S = 2
    const ref = { [`${G("g18")} / X`]: 1.5 };
    expect(computeCoinGains(yours, ref).rows[0].gainPct).toBeCloseTo(100 / 3, 9); // 4/3 − 1
  });

  it("min4 group caps both sides at 4", () => {
    const yours = { [G("g02")]: 3, [`${G("g02")} / C`]: 2 };
    const ref = { [`${G("g02")} / C`]: 9 };
    expect(computeCoinGains(yours, ref).rows[0].gainPct).toBeCloseTo(200 / 3, 9); // 5/3 − 1
  });

  it("ignores sources at the max and sources without a reference; sorts descending", () => {
    const yours = {
      [G("g23")]: 2, [`${G("g23")} / A`]: 50, [`${G("g23")} / B`]: 50,
      [G("g13")]: 1.5, [`${G("g13")} / Gold Set`]: 50,
    };
    const ref = { [`${G("g23")} / A`]: 50, [`${G("g23")} / B`]: 150, [`${G("g13")} / Gold Set`]: 50 };
    const res = computeCoinGains(yours, ref);
    expect(res.comparableSources).toBe(3);
    expect(res.rows.map((r) => r.source)).toEqual(["B"]);
  });

  it("splits minor gains below 0.05%", () => {
    const rows = [
      { path: "a", group: "g", source: "a", kind: "pct" as const, you: 0, max: 1, gainPct: 2 },
      { path: "b", group: "g", source: "b", kind: "pct" as const, you: 0, max: 1, gainPct: 0.01 },
    ];
    const { major, minor } = splitCoinGains(rows);
    expect(major.map((r) => r.path)).toEqual(["a"]);
    expect(minor.map((r) => r.path)).toEqual(["b"]);
  });
});
