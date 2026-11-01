// The stat trackers name their sources like the game ("Cool Bird (Companion 24)")
// and keep jargon in the tooltip. No private save needed: an empty envelope
// still builds every node.
import { describe, it, expect } from "vitest";
import { node, renamed } from "@/lib/arkh/node";
import type { ArkhNode } from "@/lib/arkh/node";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { computeArkhArtifactFind } from "@/lib/arkh/computeArtifactFind";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const EMPTY = () => ({ charNames: ["A"], data: {} });

function nodes(tree: ArkhNode): Map<string, ArkhNode> {
  const out = new Map<string, ArkhNode>();
  const walk = (n: ArkhNode) => {
    out.set(n.name, n);
    n.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

describe("renamed", () => {
  it("copies the node under the tracker's name and note, never touching the shared one", () => {
    const shared = node("Friend Bonus", 5, [node("Score", 1)], { fmt: "+", note: "friend 5" });
    const mine = renamed(shared, "More Coins (Friend Bonus 5)", "scales with account level");
    expect(mine).toMatchObject({ name: "More Coins (Friend Bonus 5)", val: 5, fmt: "+", note: "scales with account level" });
    expect(mine.children).toBe(shared.children);
    expect(shared).toMatchObject({ name: "Friend Bonus", note: "friend 5" });
  });

  it("drops the helper's debug note when there is no new one", () => {
    expect(renamed(node("Guild 4", 1, null, { note: "guild 4" }), "REM Fighting (Guild 4)").note).toBeUndefined();
  });
});

describe("tracker labels", () => {
  const cases: [string, () => ArkhNode, string[], string[]][] = [
    [
      "Coin Multi",
      () => computeArkhCoinMulti(EMPTY(), 0, 301).tree,
      [
        "🐾 Balloonfish (Companion 38)",
        "🌪️ Dustwalker (Talent 433)",
        "Penny of Strength (Power Cauldron)",
        "Bonus Money (Equipment)",
        "More Coins (Friend Bonus 5)",
        "Recipe for Profit (Vault 34)",
        "Cash from Monsters (Weekly Vote 34)",
      ],
      ["Vote 34 (Cash)", "Penny of Strength (CashSTR)", "Vault 34 × VaultKillzTotal(8)", "EtcBonuses(77) (etcBonus 77)"],
    ],
    [
      "EXP Multi",
      () => computeArkhExpMulti(EMPTY(), 0, 301).tree,
      [
        "Surrage (Jelly Obstruction 31)",
        "Tobiko Temaki (Sushi Tier 16)",
        "Bonuses of Orion (Owl Upgrade 0)",
        "Gloomie Expie (Cavern Upgrade 47)",
        "Class EXP Multi (Equipment)",
        "Class EXP from Monsters (Weekly Vote 15)",
      ],
      ["Vote 15 (Class EXP)", "Jelly Operation 30", "EtcBonuses(78) (etcBonus 78)"],
    ],
    [
      "AFK Gains",
      () => computeArkhAfkGains(EMPTY(), 0, 301).tree,
      ["REM Fighting (Guild 4)", "Void Set Bonus", "🦪 The Clamworks", "Sleepy Drops+ (Cove Upgrade 13)", "AFK Gains (Weekly Vote 6)"],
      ["Vote 6 (AFK Gains)", "Cglunko upgrade 13", "EtcBonuses(92) (etcBonus 92)"],
    ],
    [
      "Multikill",
      () => computeArkhMultikill(EMPTY(), 0, 251).tree,
      ["Cullingo (Star Sign 47)", "Multikill (Equipment)", "Mr Massacre (Kazam Cauldron)", "Max damage vs target HP"],
      ["Star signs (Multikill)", "Max damage ≥ HP × E"],
    ],
    [
      "Artifact Find",
      () => computeArkhArtifactFind(EMPTY(), 0).tree,
      ["Fauxory Tusk (Artifact 3)", "🌟 Glowing Veil (Pristine Charm 2)", "Glowing Veil (Pristine Charm 2)", "Artifact Find (Weekly Vote 20)"],
      ["Vote 20 (Artifact)", "Pristine 2", "Artifact 3"],
    ],
  ];

  it.each(cases)("%s uses the game's names", (_n, tree, has, hasNot) => {
    const names = nodes(tree());
    for (const n of has) expect(names.has(n), n).toBe(true);
    for (const n of hasNot) expect(names.has(n), n).toBe(false);
  });

  it("a group keeps its shape note and appends the tooltip", () => {
    const n = nodes(computeArkhCoinMulti(EMPTY(), 0, 301).tree).get("🐾 Balloonfish (Companion 38)");
    expect(n?.note).toBe("× (1 + Σ) · Coin drop multi");
  });
});
