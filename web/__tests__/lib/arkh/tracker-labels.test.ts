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
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import { saveData } from "@/lib/arkh/state";
import { etcBonus } from "@/lib/arkh/stats/systems/common/etcBonus";
import { friend } from "@/lib/arkh/stats/systems/common/friend";
import { guild } from "@/lib/arkh/stats/systems/common/guild";
import { owl } from "@/lib/arkh/stats/systems/w1/owl";
import { pristine } from "@/lib/arkh/stats/systems/w5/pristine";
import { sushiRoG } from "@/lib/arkh/stats/systems/w7/sushi";
import { arcadeBonus } from "@/lib/arkh/stats/systems/w2/arcade";
import { TALENT_FINAL_BONUS_WRAPS } from "@/lib/arkh/stats/data/common/talent-final-bonus-wraps";
import { TALENT_CAP_BOOSTERS } from "@/lib/arkh/stats/data/common/talent-cap-boosters";
import { trackerNamed } from "@/lib/arkh/stats/systems/common/tracker-names";

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
        // child rows: a plain name, the code expression lives in the note
        "Roo reset tiers",
        "STR ÷ 250 (rounded down)",
        "Total dust collected (log10)",
        "Total ores mined (log10)",
        "Best Pet Arena wave",
        "Bean kills (log10, rounded down)",
        "Taskboard recipes unlocked",
        "World number",
        "Kills (millions)",
        "Talent value (at least 1)",
      ],
      [
        "Vote 34 (Cash)",
        "Penny of Strength (CashSTR)",
        "Vault 34 × VaultKillzTotal(8)",
        "EtcBonuses(77) (etcBonus 77)",
        "⌈(OLA[271] − 6) / 7⌉",
        "⌊STR / 250⌋",
        "log10(OLA[362])",
        "log10(OLA[340])",
        "Arena wave (OLA[89])",
        "VaultKillzTotal(4)",
        "VaultKillzTotal(8)",
        "1 + ⌊map / 50⌋",
        "Kills / 1e6",
        "Talent 433 (getbonus2, min 1)",
      ],
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
        "Best Crucible wave",
        "Merit level",
        "Stickers found",
        "Bonus per level",
        "Upgrade level",
        "Pantheon Shrine level",
        "Megaflesh bonus %",
        "Bubba tiers",
        "Discoveries found",
        "Shimmer count",
        "Total fish caught (log10)",
        "Kills on this map",
      ],
      [
        "Vote 15 (Class EXP)",
        "Jelly Operation 30",
        "EtcBonuses(78) (etcBonus 78)",
        "Crucible best wave (OLA[628])",
        "Merit (Tasks[2][0][2])",
        "Stickers found (Research[9][0])",
        "ZenithMarket[9][4]",
        "Spelunk[45][9] level",
        "Pantheon Shrine level (Tower[21])",
        "Megaflesh bonus % (Bubba_RoG_all)",
        "Tiers ⌈(Bubba[1][3] − 5) / 7⌉",
        "Spelunk[6].length",
        "OLA[179]",
        "log10(OLA[345])",
        "Kills (mapBon[map][1])",
        "Talent 429 (getbonus2)",
      ],
    ],
    [
      "AFK Gains",
      () => computeArkhAfkGains(EMPTY(), 0, 301).tree,
      [
        "REM Fighting (Guild 4)",
        "Void Set Bonus",
        "🦪 The Clamworks",
        "Sleepy Drops+ (Cove Upgrade 13)",
        "AFK Gains (Weekly Vote 6)",
        "Merit level",
        "Kills on this map",
        "Roo reset tiers",
        "The character's cavern",
      ],
      [
        "Vote 6 (AFK Gains)",
        "Cglunko upgrade 13",
        "EtcBonuses(92) (etcBonus 92)",
        "Merit level (Tasks[2][1][2])",
        "Kills (mapBon[map][2])",
        "⌈(OLA[271] − 5) / 7⌉",
      ],
    ],
    [
      "Multikill",
      () => computeArkhMultikill(EMPTY(), 0, 251).tree,
      [
        "Cullingo (Star Sign 47)",
        "Multikill (Equipment)",
        "Mr Massacre (Kazam Cauldron)",
        "Max damage vs target HP",
        "Salt Lick level",
        "Building level",
      ],
      [
        "Star signs (Multikill)",
        "Max damage ≥ HP × E",
        "Level (SaltLick[8])",
        "Building level (TowerInfo[2])",
      ],
    ],
    [
      "Artifact Find",
      () => computeArkhArtifactFind(EMPTY(), 0).tree,
      ["Fauxory Tusk (Artifact 3)", "🌟 Glowing Veil (Pristine Charm 2)", "Glowing Veil (Pristine Charm 2)", "Artifact Find (Weekly Vote 20)", "Discoveries found"],
      ["Vote 20 (Artifact)", "Pristine 2", "Artifact 3", "Spelunk[6].length"],
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

  it("a renamed child row keeps its jargon in the note", () => {
    const coin = nodes(computeArkhCoinMulti(EMPTY(), 0, 301).tree);
    expect(coin.get("Total ores mined (log10)")?.note).toBe("log10(OLA[340])");
    expect(coin.get("Best Pet Arena wave")?.note).toBe("OLA[89]");
    expect(coin.get("Bean kills (log10, rounded down)")?.note).toBe("VaultKillzTotal(4)");
    expect(coin.get("STR ÷ 250 (rounded down)")?.note).toBe("⌊STR / 250⌋");
    expect(coin.get("World number")?.note).toBe("1 + ⌊map / 50⌋");
    const mk = nodes(computeArkhMultikill(EMPTY(), 0, 251).tree);
    expect(mk.get("Building level")?.note).toBe("TowerInfo[2]");
    expect(nodes(computeArkhMultikill(EMPTY(), 0, 306).tree).get("Clamworks HP")?.note).toBe("1e16 × 30^OLA[464]");
    const afk = nodes(computeArkhAfkGains(EMPTY(), 0, 301).tree);
    expect(afk.get("The character's cavern")?.note).toBe("Holes[0][char]");
    expect(afk.get("Roo reset tiers")?.note).toContain("OLA[271]");
  });

  it("no tracker node name carries code or the flat-tree path separator", () => {
    const JARGON = /OLA\[|VaultKillz|Holes\[|TowerInfo|MKtierACTIVE|etcBonus|getbonus| \/ |\w\[\w+\]/;
    const trees: [string, ArkhNode][] = [
      ["coin", computeArkhCoinMulti(EMPTY(), 0, 301).tree],
      ["exp", computeArkhExpMulti(EMPTY(), 0, 301).tree],
      ["afk", computeArkhAfkGains(EMPTY(), 0, 301).tree],
      ["mk", computeArkhMultikill(EMPTY(), 0, 251).tree],
      ["artifact", computeArkhArtifactFind(EMPTY(), 0).tree],
    ];
    for (const [t, tree] of trees) {
      const bad = [...nodes(tree).keys()].filter((n) => JARGON.test(n));
      expect(bad, t).toEqual([]);
    }
  });

  // Rows inside helpers that Drop Rate also feeds (arcade, talents) are renamed by the
  // tracker at its call site; the helper itself must keep its name.
  it("the Maxed Multi row is renamed in every tracker that reads an arcade bonus", () => {
    const ARC = Array.from({ length: 70 }, () => 0);
    for (const i of [6, 8, 10, 11, 12, 32, 60, 66]) ARC[i] = 101;
    const env = () => ({ charNames: ["A"], data: { ArcadeUpg: ARC } });
    const trees: [string, ArkhNode][] = [
      ["coin", computeArkhCoinMulti(env(), 0, 301).tree],
      ["exp", computeArkhExpMulti(env(), 0, 301).tree],
      ["afk", computeArkhAfkGains(env(), 0, 301).tree],
      ["mk", computeArkhMultikill(env(), 0, 251).tree],
      ["artifact", computeArkhArtifactFind(env(), 0).tree],
    ];
    for (const [t, tree] of trees) {
      const names = nodes(tree);
      expect(names.has("Maxed Multi (Super ×2 · Omega ×6)"), t).toBe(true);
      expect(names.has("Maxed Multi (Super 101 ×2 / Omega 102 ×6)"), t).toBe(false);
    }
    expect(nodes(trees[0][1]).get("Maxed Multi (Super ×2 · Omega ×6)")?.note).toBe("Arcade level 101 (Super) ×2, level 102 (Omega) ×6");
  });

  it("trackerNamed renames nested talent rows and leaves the others (and their notes) alone", () => {
    const t = node("Talent", 1, [
      node("Cooking LV / 10", 3, null, { note: "CalcTalentMAP[644]" }),
      node("Lotto Skills (W4 bubble [3][0]) Lv", 9, null, { note: "CauldronInfo[3][0] — clamp ceiling" }),
      node("Level", 7),
    ]);
    const out = trackerNamed(t);
    expect(out.children!.map((c) => c.name)).toEqual(["Cooking level ÷ 10", "Lotto Skills (World 4 bubble) Lv", "Level"]);
    expect(out.children![0].note).toBe("CalcTalentMAP[644]");
    expect(out.children![1].note).toBe("CauldronInfo[3][0] — clamp ceiling");
    expect(t.children![0].name).toBe("Cooking LV / 10"); // the shared node is untouched
  });
});

// The trackers rename at their call sites, so the shared helpers must still give
// Drop Rate the names it always had.
describe("Drop Rate keeps its original names", () => {
  const load = () => computeArkhDropRate(EMPTY(), 0, 8);
  const ctx = () => ({ saveData, charIdx: 0 }) as never;

  it("etcBonus, friend, guild, pristine, sushiRoG and owl helpers", () => {
    load();
    expect(etcBonus.resolve(77, ctx()).name).toBe("EtcBonuses(77) (etcBonus 77)");
    expect(etcBonus.resolve(92, ctx()).name).toBe("EtcBonuses(92) (etcBonus 92)");
    expect(etcBonus.resolve(2, ctx()).name).toBe("Drop Rate (Equipment) (etcBonus 2)");
    expect(friend.resolve(3, ctx())).toMatchObject({ name: "Friend Bonus", note: "friend 3" });
    expect(friend.resolve(5, ctx())).toMatchObject({ name: "Friend Bonus", note: "friend 5" });
    expect(guild.resolve(4, ctx())).toMatchObject({ name: "Guild 4", note: "guild 4" });
    expect(guild.resolve(10, ctx()).name).toBe("Gold Charm (Guild 10)");
    expect(pristine.resolve(2, ctx()).name).toBe("Pristine 2");
    expect(pristine.resolve(3, ctx()).name).toBe("Cotton Candy (Pristine 3)");
    expect(sushiRoG.resolve(15, ctx()).name).toBe("Tobiko Temaki (Sushi Tier 16) — Class EXP gain (RoG Bonus 15)");
    expect(owl.resolve(0, ctx())).toMatchObject({ name: "Summoning Owl", note: "owl 0" });
  });

  it("the arcade and talent rows the trackers rename", () => {
    load();
    const prev = saveData.arcadeUpgData;
    try {
      saveData.arcadeUpgData = [];
      saveData.arcadeUpgData[11] = 101;
      expect(arcadeBonus(11, saveData).children!.map((c) => c.name)).toContain("Maxed Multi (Super 101 ×2 / Omega 102 ×6)");
    } finally {
      saveData.arcadeUpgData = prev;
    }
    expect(TALENT_FINAL_BONUS_WRAPS[644].counterLabel).toBe("Cooking LV / 10");
    expect(TALENT_CAP_BOOSTERS[79].boosters[0].bubbleCap?.bubbleLabel).toBe("Lotto Skills (W4 bubble [3][0])");
  });

  it("the Drop Rate tree itself", () => {
    const names = nodes(load().tree);
    for (const n of ["Equipment (etcBonus 2)", "Equipment (etcBonus 91)", "Equipment (etcBonus 99)", "Gold Charm (Guild 10)", "Cotton Candy (Pristine 3)", "Friend Bonus"]) {
      expect(names.has(n), n).toBe(true);
    }
  });
});
