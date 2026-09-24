import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computeArkhMultikill, MK_COLLECTOR_MAP } from "@/lib/arkh/computeMultikill";
import { deathNoteSkulls, overkillQTY } from "@/lib/arkh/stats/systems/coin/gambit";
import { MK_NODES, MK_POOLS, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { formatMultikill } from "@/lib/multikill/format";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getMultiKillBase / getMultiKillPerTier
// on this exact file (SP/mk/it-mk.mts), term by term via SP/mk/arkh-mk.mts,
// unless a comment says N.js ≠ IT (spec M8).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

const close = (actual: number, expected: number) => {
  if (expected === 0) expect(actual).toBe(0);
  else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
};

/** A source's value by pool position (root children: base, tier, per tier, status). */
const srcIn = (tree: ArkhNode, id: string): number => {
  const kids = tree.children!;
  if (MK_POOLS.base.includes(id)) return Number(kids[0].children![MK_POOLS.base.indexOf(id)].val);
  if (MK_POOLS.perTier.includes(id)) return Number(kids[2].children![MK_POOLS.perTier.indexOf(id)].val);
  if (id === "tier") return Number(kids[1].val);
  if (id === "active") return Number(kids[3].val);
  throw new Error(`not a source: ${id}`);
};

describe.skipIf(!existsSync(SAVE))("Multikill — Markhe on map 14 vs IdleonToolbox", () => {
  let save: any;
  let tree: ArkhNode;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    tree = computeArkhMultikill(save, save.charNames.indexOf("Markhe"), 14).tree;
  });
  const src = (id: string) => srcIn(tree, id);

  it("has the four root children; the tier's note names the map and target", () => {
    expect(tree.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    expect(tree.children![0].children).toHaveLength(MK_POOLS.base.length); // no rule row on map 14
    expect(tree.children![1].note).toBe("Map 14 · beanG"); // tier 51: no "estimate" (M17)
  });

  it.each<[string, number]>([
    // Base Multikill
    ["stampC19", 166], // StampC19 is the only "Overkill" stamp
    ["deathNoteBuilding", 102], // TowerInfo[2] = 51, ×2
    ["etc29", 30.450000000000003],
    ["ach148", 1],
    ["ach122", 6],
    ["ach123", 2],
    ["talent654", 576], // MONOLITHIALISM × onyx statues
    // Multikill per Tier
    ["vialOverkill", 101.92],
    ["talent58", 265.7718120805369], // account-wide × ⌊OLA[158]/5⌋
    ["arcade8", 20.09950248756219],
    ["artifact26", 150], // Trilobite Rock
    ["chipMkill", 0], // no Wood Chip in slots [9,20,21,15,16,17,18]
    ["etc71", 195.16191214168592],
    ["card80", 0],
    ["prayer16", 0], // Balance of Pain isn't equipped (12,1,3,5,14)
    ["shiny4", 80],
    ["box13b", 9.782608695652174],
    // No Multikill card set equipped. IT keys this set as "CardSet9", N.js as
    // "{%_Multikill_Per_Tier" — probably the same, unconfirmed (spec risk 4).
    ["cardSet11", 0],
    // Tier and status
    ["tier", 51],
    ["active", 1],
  ])("%s", (id, expected) => close(src(id), expected));

  it.each<[string, number]>([
    ["saltLick8", 30], // SaltLick[8] = 10, 3 per level
    ["deathNoteWorld", 300], // map 14 → the W1 page (15 mobs at 20)
    ["deathNoteMini", 58],
    ["meas9", 281.3841523937517], // Holes[22][9] = 465 ("40TOT") × the Gloomie multi (log10 1.35e14)
  ])("%s", (id, expected) => close(src(id), expected));

  it("names the Death Note row by its world (spec M11)", () => {
    expect(tree.children![2].children![0].name).toBe("Death Note (W1 page)");
  });

  it("Death Note pages W1–W7 and the minibosses", () => {
    loadSaveData(save);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((w) => overkillQTY(w, saveData))).toEqual([300, 220, 280, 260, 260, 280, 460, 58]);
    expect(deathNoteSkulls(saveData)).toBe(2060); // Σ W1–W7: Coin's Measurement 13 input
  });

  it.each<[string, number]>([
    ["sign47", 150], // Cullingo 15 × Seraph 10 (245 enabled signs: the unlocked range counts)
    ["sign78", 30], // Killian Maximus 3 × Seraph 10
    ["buff46", 0], // no Void Radius buff (BuffsActive_8 = 94, 168, 167)
    ["buff469", 0],
    ["bubbleMKtier", 89.11312573906189], // Sheepie owned (and "c15" equipped)
  ])("%s", (id, expected) => close(src(id), expected));

  it("Base Multikill = 1063.45", () => close(Number(tree.children![0].val), 1063.45));
  it("Multikill per Tier = 1581.2331…", () => close(Number(tree.children![2].val), 1581.2331135382508));
  it("total = IdleonToolbox = the AFK Info's MULTIKILL: 81706%", () => expect(tree.val).toBe(81706));
  it("active, and the AFK Info shows the line (beanG is FIGHTING)", () => {
    expect(src("active")).toBe(1);
    expect(tree.children![3].note).toBe("the AFK Info shows the MULTIKILL line");
  });

  it("no source is left unported", () => {
    const notes: string[] = [];
    const walk = (n: ArkhNode) => {
      if (n.note === "pending port") notes.push(n.name);
      n.children?.forEach(walk);
    };
    walk(tree);
    expect(notes).toEqual([]);
  });
});

describe.skipIf(!existsSync(SAVE))("Multikill — the other ten characters vs IdleonToolbox", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });

  // Their saved map is 216 (cavern 3, no Cove), target Bravery_Monument: tier 51.
  it.each<[string, number]>([
    ["ARKHE", 77116], ["ARKHELUCK", 106167], ["zArkhe", 107748], ["farkhe", 77116], ["Darkhe", 77116],
    ["Parkhe", 106167], ["Warkhe", 105652], ["Sarkhe", 107748], ["Barkhe", 106167], ["Arkhiiiiii", 106167],
  ])("%s on the saved map", (name, expected) => {
    const ci = save.charNames.indexOf(name);
    expect(computeArkhMultikill(save, ci, Number(save.data["CurrentMap_" + ci])).total).toBe(expected);
  });
});

describe.skipIf(!existsSync(SAVE))("Multikill — map scenarios on the ARKHE save", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });
  const idx = (name: string) => save.charNames.indexOf(name);
  const kid = (t: ArkhNode, name: string) => t.children!.find((c) => c.name === name)!;

  it("Markhe on map 14 prints like the game: 81706", () => {
    expect(formatMultikill(computeArkhMultikill(save, idx("Markhe"), 14).total)).toBe("81706");
  });

  it("map 301: soft cap on both halves, tier 24 from arkh's max damage (an estimate) → 3185%", () => {
    const t = computeArkhMultikill(save, idx("Markhe"), 301).tree;
    close(Number(t.children![0].val), 114.409);
    close(Number(t.children![2].val), 127.96466227076502); // raw Σ 1741.2331… (W7 page 460)
    expect(t.children![1]).toMatchObject({ name: MK_NODES.tierW7, val: 24 });
    expect(t.children![1].note).toMatch(/^estimate/); // IT's max damage gives tier 30 → 3953 (spec M4)
    expect(t.children![2].children!.at(-1)).toMatchObject({ name: MK_RULES.softCap });
    expect(t.children![2].children!.at(-1)!.note).toMatch(/reduced by ~93%$/);
    expect(t.val).toBe(3185);
  });

  it("map 251 (the collector's): the W6 page and tier 51 → 80686%; every character is at the cap", () => {
    const t = computeArkhMultikill(save, idx("Markhe"), MK_COLLECTOR_MAP).tree;
    expect(t.children![2].children![0]).toMatchObject({ name: "Death Note (W6 page)", val: 280 });
    expect(t.val).toBe(80686);
    for (let ci = 0; ci < save.charNames.length; ci++) {
      expect(computeArkhMultikill(save, ci, MK_COLLECTOR_MAP).tree.children![1].val, save.charNames[ci]).toBe(51);
    }
  }, 30_000);

  // N.js ≠ IT: IT's getMultiKillTotal ignores the Cove override; N.js replaces
  // both sums on map 216 in cavern 17 (@7754109, @7751511).
  it("the Crystal Glunko Cove (a copy with ARKHE in cavern 17): 38×100 + 51 × 46×1 → 6146% (spec M19)", () => {
    const copy = JSON.parse(JSON.stringify(save));
    const holes = typeof copy.data.Holes === "string" ? JSON.parse(copy.data.Holes) : copy.data.Holes;
    holes[0][0] = 17;
    copy.data.Holes = typeof copy.data.Holes === "string" ? JSON.stringify(holes) : holes;
    const t = computeArkhMultikill(copy, 0, 216).tree;
    expect([t.children![0].val, t.children![1].val, t.children![2].val]).toEqual([3800, 51, 46]);
    expect(t.val).toBe(6146);
  });

  // N.js ≠ IT: IT's getMultiKillTotal keeps w7a6's static 1e18 HP; N.js sets
  // Clamz_HP after the curses (@6467129).
  it("Clamworks (map 306): HP = 1e16·30^8 = 6.561e27, no curse → tier 4 (estimate) → 626%", () => {
    const t = computeArkhMultikill(save, idx("Markhe"), 306).tree;
    const tier = t.children![1];
    expect(kid(tier, "Target HP").val).toBe(1e16 * Math.pow(30, 8));
    expect(tier.val).toBe(4);
    expect(tier.note).toMatch(/^estimate/);
    expect(t.val).toBe(626);
  });

  it("zArkhe's Jawbreaker curse (1180%, HP ×12.8): tier 21 → 19 on map 301 → 2754% (3032% without it)", () => {
    const t = computeArkhMultikill(save, idx("zArkhe"), 301).tree;
    const tier = t.children![1];
    close(Number(kid(tier, "Target HP").children!.find((c) => c.name === "Prayer curses")!.val), 12.8);
    expect(tier.val).toBe(19);
    expect(t.val).toBe(2754);
  });

  it("OverkillStuffs('3') is on for all 11; only Markhe's AFK Info shows the line", () => {
    for (let ci = 0; ci < save.charNames.length; ci++) {
      const status = computeArkhMultikill(save, ci, Number(save.data["CurrentMap_" + ci])).tree.children![3];
      expect(status.val, save.charNames[ci]).toBe(1);
      expect(status.note).toMatch(ci === idx("Markhe") ? /shows the MULTIKILL line/ : /hides the MULTIKILL line/);
    }
  }, 30_000);
});

// In-game AFK Info reading taken 2026-09-24 alongside this save (controller-
// supplied anchor, distinct file from SAVE above): Markhe on map 14 (Valley
// of the Beans) read MULTIKILL = 81706% in the live panel.
const SAVE2 = "scripts/updater/golden/.cache/arkhe-live-2026-09-24.json";

describe.skipIf(!existsSync(SAVE2))("Multikill — Markhe on map 14 vs the in-game panel (2026-09-24)", () => {
  it("matches the in-game AFK Info reading taken 2026-09-24 alongside this save", () => {
    const save2 = JSON.parse(readFileSync(SAVE2, "utf8"));
    const markheIdx = save2.charNames.indexOf("Markhe");
    expect(computeArkhMultikill(save2, markheIdx, 14).tree.val).toBe(81706);
  });
});
