// CI smoke test — no private save required. Runs a maximally-empty envelope
// through every Artifact Find source so a broken/renamed source id (the
// artifact switch throws on unknown ids) or a crash on missing save fields
// (no Boats/Captains/Spelunk…) fails CI, not just the local-only save tests.
import { describe, it, expect } from "vitest";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";
import { ARTI_GROUPS } from "@/lib/arkh/stats/defs/artifact-find";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("Artifact Find smoke test", () => {
  it("computes every source on an empty save without throwing", () => {
    const { tree, total } = computeArkhArtifactFind({ charNames: ["A"], data: {} }, 0);
    expect(total).toBe(1);
    expect(tree.children).toHaveLength(24);
    expect(tree.children).toHaveLength(ARTI_GROUPS.length);
  });

  // User decision (2026-11-03): N.js fills NONdummies[60] only under `200 == CurrentMap`, and it
  // lasts the session, so the tracker counts the type-6 captains (+25 each, up to 30) like the
  // Skill Info after any character entered the W5 town. Real-save tests skip in CI.
  it("counts type-6 captains at +25 each, up to 30", () => {
    const capt = (k: number) => {
      const captains = JSON.stringify(Array.from({ length: k }, () => [6, 0, 0, 0, 0, 0, 0]));
      const { tree } = computeArkhArtifactFind({ charNames: ["A"], data: { Captains: captains } }, 0);
      return tree.children![0].children![ARTI_GROUPS[0].sources.indexOf("captains6")];
    };
    expect(capt(2).name).toMatch(/^Captains of type 6/);
    expect(capt(2).val).toBe(50);
    expect(capt(2).children![0].val).toBe(2);
    expect(capt(31).val).toBe(750);
  });
});
