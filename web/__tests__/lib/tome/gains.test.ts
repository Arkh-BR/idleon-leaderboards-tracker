import { describe, it, expect } from "vitest";
import type { TomeRow } from "@/lib/tome/compute";
import type { TopPlayerEntry } from "@/lib/tome/topPlayers";
import {
  enrichRows,
  nextPtCost,
  gainPts,
  isGated,
  isActionable,
  rankGains,
  heroGain,
  describeNextPoint,
  displayTaskName,
  CAPPED_ID,
  type EnrichedRow,
} from "@/lib/tome/gains";

// --- synthetic-input helpers -------------------------------------------------

// A "linear capped" curve (x2 = 2): pct = min(1, q/x1), maxPts = x3. With
// x1 === x3, raw value and pts line up 1:1 and the +1-pt cost is exactly 1 —
// mirrors the real "Vault Upgrade bonus LV" task, which keeps the assertions
// hand-checkable.
const LINEAR: readonly [number, number, number] = [1000, 2, 1000];
// Big linear curve whose max is far away, so test rows are never auto-capped.
const BIG: readonly [number, number, number] = [100000, 2, 100000];
// Inverted "Fastest Time" curve (x2 = 3): fewer is better.
const INVERTED: readonly [number, number, number] = [40, 3, 250];

function row(p: Partial<TomeRow>): TomeRow {
  return {
    idx: 1,
    task: "Task",
    rawValue: p.pts ?? 0,
    pts: 0,
    source: "test",
    computeIdx: 0,
    bonus: BIG,
    ...p,
  };
}

function topMap(
  entries: Record<string, number | null>
): Record<string, TopPlayerEntry> {
  const out: Record<string, TopPlayerEntry> = {};
  for (const [task, pts] of Object.entries(entries)) {
    out[task] = {
      date: "06/25/2026",
      player: "Top",
      raw: pts,
      pts,
      classification: null,
    };
  }
  return out;
}

function enrichOne(
  r: Partial<TomeRow>,
  opts?: {
    userClass?: Record<string, number>;
    topPlayers?: Record<string, TopPlayerEntry>;
    defaultClassifications?: Record<string, number | null>;
  }
): EnrichedRow {
  return enrichRows([row(r)], opts?.userClass ?? {}, null, {
    topPlayers: opts?.topPlayers,
    defaultClassifications: opts?.defaultClassifications,
  })[0];
}

// --- gap-to-top --------------------------------------------------------------

describe("enrichRows — gap to top", () => {
  it("computes ptsGapToTop = max(0, topPts - yourPts)", () => {
    const e = enrichOne(
      { task: "Vault", pts: 936, bonus: BIG },
      { topPlayers: topMap({ Vault: 1040 }) }
    );
    expect(e.ptsGapToTop).toBe(104);
  });

  it("clamps the gap to 0 when you are at or above the top player", () => {
    const e = enrichOne(
      { task: "Vault", pts: 1100, bonus: BIG },
      { topPlayers: topMap({ Vault: 1040 }) }
    );
    expect(e.ptsGapToTop).toBe(0);
  });

  it("treats a missing pts value as 0", () => {
    const e = enrichOne(
      { task: "Vault", pts: null, bonus: BIG },
      { topPlayers: topMap({ Vault: 1040 }) }
    );
    expect(e.ptsGapToTop).toBe(1040);
  });
});

// --- gain fallback (no top snapshot) -----------------------------------------

describe("gainPts", () => {
  it("uses gap-to-top when a top snapshot exists", () => {
    const e = enrichOne(
      { task: "Vault", pts: 936, bonus: BIG },
      { topPlayers: topMap({ Vault: 1040 }) }
    );
    expect(gainPts(e)).toBe(104);
  });

  it("falls back to gap-to-max when the task has no top snapshot", () => {
    // BIG maxPts = 100000; pts 936 → gap-to-max 99064; no top entry.
    const e = enrichOne({ task: "Orphan", pts: 936, bonus: BIG }, { topPlayers: {} });
    expect(e.top).toBeNull();
    expect(gainPts(e)).toBe(100000 - 936);
  });
});

// --- effective classification ------------------------------------------------

describe("enrichRows — effective classification", () => {
  it("auto-Caps a task whose pts reached the theoretical max", () => {
    // LINEAR maxPts = 1000; pts 1000 → cappedByMax.
    const e = enrichOne({ task: "Done", pts: 1000, bonus: LINEAR });
    expect(e.cappedByMax).toBe(true);
    expect(e.classification).toBe(CAPPED_ID);
  });

  it("honors an explicit user clear (0) over any default", () => {
    const e = enrichOne(
      { task: "Vault", pts: 500, bonus: BIG },
      { userClass: { Vault: 0 }, defaultClassifications: { Vault: 3 } }
    );
    expect(e.classification).toBeNull();
  });

  it("honors a user-picked classification", () => {
    const e = enrichOne(
      { task: "Vault", pts: 500, bonus: BIG },
      { userClass: { Vault: 1 }, defaultClassifications: { Vault: 3 } }
    );
    expect(e.classification).toBe(1);
  });

  it("uses DEFAULT_CLASSIFICATIONS when the user has not picked", () => {
    const e = enrichOne(
      { task: "Vault", pts: 500, bonus: BIG },
      { defaultClassifications: { Vault: 3 } }
    );
    expect(e.classification).toBe(3);
  });

  it("treats a DEFAULT_CLASSIFICATIONS null as 'no class' (does NOT fall through to the top player's class)", () => {
    const e = enrichOne(
      { task: "Vault", pts: 500, bonus: BIG },
      {
        defaultClassifications: { Vault: null },
        topPlayers: topMap({ Vault: 1040 }), // top.classification null here anyway
      }
    );
    expect(e.classification).toBeNull();
  });

  it("falls back to the top player's class when the task is absent from DEFAULT_CLASSIFICATIONS", () => {
    const top = topMap({ Vault: 1040 });
    top.Vault.classification = 4; // Time Gated
    const e = enrichOne(
      { task: "Vault", pts: 500, bonus: BIG },
      { defaultClassifications: {}, topPlayers: top }
    );
    expect(e.classification).toBe(4);
  });

  it("never uses Capped as a fallback default", () => {
    const top = topMap({ Vault: 1040 });
    top.Vault.classification = CAPPED_ID;
    const e = enrichOne(
      { task: "Vault", pts: 500, bonus: BIG },
      { defaultClassifications: {}, topPlayers: top }
    );
    expect(e.classification).toBeNull();
  });
});

// --- next-point cost & description -------------------------------------------

describe("nextPtCost / describeNextPoint", () => {
  it("normal curve: cost is the raw increase needed for +1 pt", () => {
    const e = enrichOne({ task: "Vault", pts: 936, rawValue: 936, bonus: LINEAR });
    expect(nextPtCost(e)).toBe(1); // rawForNextPt 937 - raw 936
    expect(describeNextPoint(e)).toEqual({
      kind: "step",
      drop: false,
      cost: 1,
      target: 937,
    });
  });

  it("inverted curve: it is a DROP (raw must decrease)", () => {
    // On a "fewer is better" curve, +1 pt needs a LOWER raw value, so the
    // next-point target sits below the current raw and the cost is a drop.
    const e = enrichOne({ task: "Time", pts: 80, rawValue: 170, bonus: INVERTED });
    const d = describeNextPoint(e);
    expect(e.rawForNextPt).not.toBeNull();
    expect(d.kind).toBe("step");
    if (d.kind === "step") {
      expect(d.drop).toBe(true);
      // cost is the magnitude of the raw drop = raw - rawForNextPt
      expect(d.cost).toBe(170 - (e.rawForNextPt as number));
      expect(d.cost).toBeGreaterThan(0);
      expect(d.target).toBe(e.rawForNextPt);
    }
  });

  it("reports 'maxed' when the next point is unreachable (capped)", () => {
    const e = enrichOne({ task: "Done", pts: 1000, rawValue: 1000, bonus: LINEAR });
    expect(e.rawForNextPt).toBeNull();
    expect(describeNextPoint(e)).toEqual({ kind: "maxed" });
  });
});

// --- actionability filter ----------------------------------------------------

describe("isGated / isActionable", () => {
  it("flags Time/Lucky/Update gated classes as gated", () => {
    for (const id of [4, 5, 9]) {
      const e = enrichOne(
        { task: "G", pts: 100, bonus: BIG },
        { userClass: { G: id }, topPlayers: topMap({ G: 200 }) }
      );
      expect(isGated(e)).toBe(true);
      expect(isActionable(e)).toBe(false);
    }
  });

  it("treats Priority / Doable / unclassified with a gap as actionable", () => {
    const top = topMap({ P: 200, D: 200, U: 200 });
    const priority = enrichOne(
      { task: "P", pts: 100, bonus: BIG },
      { userClass: { P: 1 }, topPlayers: top }
    );
    const doable = enrichOne(
      { task: "D", pts: 100, bonus: BIG },
      { userClass: { D: 3 }, topPlayers: top }
    );
    const unclassified = enrichOne(
      { task: "U", pts: 100, bonus: BIG },
      { topPlayers: top } // no class anywhere
    );
    expect(unclassified.classification).toBeNull();
    for (const e of [priority, doable, unclassified]) {
      expect(isGated(e)).toBe(false);
      expect(isActionable(e)).toBe(true);
    }
  });

  it("excludes capped and zero-gap tasks from actionable", () => {
    const capped = enrichOne({ task: "C", pts: 1000, bonus: LINEAR });
    const tied = enrichOne(
      { task: "T", pts: 200, bonus: BIG },
      { userClass: { T: 3 }, topPlayers: topMap({ T: 200 }) }
    );
    expect(isActionable(capped)).toBe(false);
    expect(isActionable(tied)).toBe(false);
  });
});

// --- ranking + hero ----------------------------------------------------------

describe("rankGains / heroGain", () => {
  // A realistic mix: gated task with the biggest gap, two actionable, one
  // unclassified, one capped, one tied.
  const top = topMap({
    A: 1040, // Doable, gap 104
    B: 285, //  Doable, gap 45
    C: 275, //  Update Gated, gap 175
    D: 130, //  unclassified, gap 30
    E: 500, //  capped, gap 0
    F: 840, //  Doable, gap 0 (tied)
  });
  const defs = { A: 3, B: 3, C: 9, F: 3 };
  const rows: TomeRow[] = [
    row({ idx: 1, task: "A", pts: 936, bonus: BIG }),
    row({ idx: 2, task: "B", pts: 240, bonus: BIG }),
    row({ idx: 3, task: "C", pts: 100, bonus: BIG }),
    row({ idx: 4, task: "D", pts: 100, bonus: BIG }),
    row({ idx: 5, task: "E", pts: 500, bonus: LINEAR }), // capped
    row({ idx: 6, task: "F", pts: 840, bonus: BIG }), // tied
  ];
  const enriched = enrichRows(rows, {}, null, {
    topPlayers: top,
    defaultClassifications: defs,
  });

  it("excludes gated/capped/zero-gap and sorts actionable by gain desc (toggle off)", () => {
    const ranked = rankGains(enriched, { includeGated: false });
    expect(ranked.map((r) => r.task)).toEqual(["A", "B", "D"]);
  });

  it("includes gated tasks when the toggle is on, still sorted by gain desc", () => {
    const ranked = rankGains(enriched, { includeGated: true });
    expect(ranked.map((r) => r.task)).toEqual(["C", "A", "B", "D"]);
  });

  it("hero is the biggest ACTIONABLE gain, even when a gated task outranks it", () => {
    const hero = heroGain(enriched);
    expect(hero?.task).toBe("A");
    expect(gainPts(hero as EnrichedRow)).toBe(104);
  });

  it("hero is null when nothing is actionable", () => {
    const onlyGatedAndCapped = enrichRows(
      [
        row({ idx: 1, task: "C", pts: 100, bonus: BIG }),
        row({ idx: 2, task: "E", pts: 500, bonus: LINEAR }),
      ],
      {},
      null,
      { topPlayers: topMap({ C: 275, E: 500 }), defaultClassifications: { C: 9 } }
    );
    expect(heroGain(onlyGatedAndCapped)).toBeNull();
  });
});

// --- display name ------------------------------------------------------------

describe("displayTaskName", () => {
  it("strips the trailing (in Seconds) annotation", () => {
    expect(displayTaskName("Best Wave (in Seconds)")).toBe("Best Wave");
  });
  it("leaves other names untouched", () => {
    expect(displayTaskName("Vault Upgrade bonus LV")).toBe("Vault Upgrade bonus LV");
  });
});
