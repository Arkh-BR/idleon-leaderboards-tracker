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
});
