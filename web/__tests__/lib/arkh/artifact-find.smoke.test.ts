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

  // User decision (2026-11-01): the tracker equals the Skill Info outside the W5 town, where
  // N.js has not yet filled NONdummies[60] (it does so only under `200 == CurrentMap`). The
  // type-6 captains stay visible as a count but add nothing. Real-save tests skip in CI.
  it("shows type-6 captains as a count under a node that adds 0", () => {
    const two = JSON.stringify([[6, 0, 0, 0, 0, 0, 0], [6, 0, 0, 0, 0, 0, 0]]);
    const { tree } = computeArkhArtifactFind({ charNames: ["A"], data: { Captains: two } }, 0);
    const additive = tree.children![0];
    const capt = additive.children![ARTI_GROUPS[0].sources.indexOf("captains6")];
    expect(capt.name).toMatch(/^Captains of type 6/);
    expect(capt.val).toBe(0);
    expect(capt.children![0].val).toBe(2);
  });
});
