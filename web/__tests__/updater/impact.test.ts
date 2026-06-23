import { describe, it, expect } from "vitest";
import { buildImpactReport } from "../../scripts/updater/impact";
import type { MapDiff } from "../../scripts/updater/diff";

const empty: MapDiff = { added: [], removed: [], changed: [] };

describe("buildImpactReport", () => {
  const registry = {
    FriendBonusQTY: ["lib/arkh/stats/systems/common/friend.ts"],
    "RandoListo2[8]": ["lib/arkh/stats/systems/common/cookingMastery.ts"],
  };

  it("points a mapped formula change at its ported file", () => {
    const fDiff: MapDiff = { ...empty, changed: [{ key: "FriendBonusQTY", before: "x", after: "y" }] };
    const out = buildImpactReport(fDiff, empty, registry);
    expect(out).toContain("FriendBonusQTY");
    expect(out).toContain("friend.ts");
    expect(out).toContain("revise");
  });

  it("flags an uncatalogued formula change as needing investigation", () => {
    const fDiff: MapDiff = { ...empty, changed: [{ key: "SomeNewThing", before: "1", after: "2" }] };
    const out = buildImpactReport(fDiff, empty, registry);
    expect(out).toContain("SomeNewThing");
    expect(out).toContain("NÃO catalogado");
  });

  it("maps a changed list to a mirrored constant", () => {
    const lDiff: MapDiff = { ...empty, changed: [{ key: "RandoListo2", before: [1], after: [2] }] };
    const out = buildImpactReport(empty, lDiff, registry);
    expect(out).toContain("cookingMastery.ts");
    expect(out).toContain("espelhada");
  });

  it("handles an added formula that is mapped", () => {
    const fDiff: MapDiff = { ...empty, added: ["FriendBonusQTY"] };
    const out = buildImpactReport(fDiff, empty, registry);
    expect(out).toContain("adicionada");
    expect(out).toContain("friend.ts");
    expect(out).toContain("revise");
  });

  it("handles a removed uncatalogued formula", () => {
    const fDiff: MapDiff = { ...empty, removed: ["GoneThing"] };
    const out = buildImpactReport(fDiff, empty, registry);
    expect(out).toContain("GoneThing");
    expect(out).toContain("removida");
    expect(out).toContain("NÃO catalogado");
  });

  it("emits the 'nothing touched' fallback when both diffs are empty", () => {
    const out = buildImpactReport(empty, empty, registry);
    expect(out).toContain("Nenhuma fórmula portada tocada");
  });
});
