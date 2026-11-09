// The rows under the farming, Holes and late-world sources of the Drop Rate V1 tree (rank9, cropSC7, exotic59, hole46, hole82, meas15, monument, caveDR, grimoire44, spelunk50, legend1, emperor11, grid173, glimbo, minehead0, menagerie24,
// pristine3, rog, vial): each one's number is the game's block's, and the rows are its terms, read from the same blocks and lists. No logic from lib/arkh: only the rows' names, order, formats and notes are V1's, as the page's snapshots
// and Compare are keyed by them. A source the save has not unlocked has no rows (the page shows it at 0); a read the save cannot answer is a noted leaf, never a page error.
import { asNum, asNumber, attr } from "@/lib/game/attr";
import type { Ctx } from "@/lib/game/ctx";
import { EmperorBon, GrimoireUpg, HolesInfo, LegendTalents, MarketExoticInfo, NinjaInfo, NjEQ, Research as ResearchLists, ResGridSquares, SpelunkUpg, AlchemyDescription } from "@/lib/game/data";
import { hString } from "@/lib/game/hstring";
import { contains, listAt } from "@/lib/game/lists";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { CauldronStats, vialBoost } from "@/lib/game/njs/CauldronStats";
import { FarmingStuffs, cropCount } from "@/lib/game/njs/FarmingStuffs";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { Holes, monumentMulti } from "@/lib/game/njs/Holes";
import { Holes2 } from "@/lib/game/njs/Holes2";
import { JellyOperation } from "@/lib/game/njs/JellyOperation";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { Minehead } from "@/lib/game/njs/Minehead";
import { ResearchStuff, gridAllMultiTerms } from "@/lib/game/njs/ResearchStuff";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { Ninja } from "@/lib/game/njs/Ninja";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Summoning } from "@/lib/game/njs/Summoning";
import { Summoning2 } from "@/lib/game/njs/Summoning2";
import { emperorBonTable } from "@/lib/game/njs/Thingies";
import type { ArkhNode } from "../node";
import type { Explainer } from "./index";
import { NOT_READ, present, raw, row, talentLevelRows, when } from "./talent";

type Table = readonly (readonly unknown[])[];
const list = (data: unknown, a: number, b: number): number => asNumber(((data as Table)[a] as readonly unknown[])[b]);

/** A source's rows, or one leaf saying why the save could not give them. */
const safe =
  (name: string, make: (c: Ctx, val: number) => ArkhNode[]): Explainer =>
  (c, val) => {
    try {
      return make(c, val);
    } catch (e) {
      return [{ name, val: 0, note: `${NOT_READ}${e instanceof Error ? e.message : String(e)}` }];
    }
  };

// ===== Farming =====

/** `LankRankUpgBonus` @10823067 for the Land Rank upgrade 9: the level times its value, times the best talent 207 (at least 1) and 1 + Exotic 14 / 100. */
const rank9 = safe("Crop Drop Rate Rank", (c) => {
  listAt(c, "FarmRank", 2);
  const rank = asNum(c, "FarmRank", 2, 9);
  const ninja = list(NinjaInfo, 36, 9);
  if (!(0 < ninja && 0 < rank)) return [];
  const doubled = contains(attr(c, "Spelunk", 50), 14);
  return [
    raw("Rank Level", rank),
    raw("Ninja Base", ninja),
    row("Dank Ranks (Talent 207)", getbonus2(c, 1, 207, -1), "+", undefined, talentLevelRows(c, 207, { best: true })),
    row("Pommelyon Seed (Exotic 14) Bonus", 1 + FarmingStuffs(c, "ExoticBonusQTY", 14, 0) / 100, "x", `Level ${asNum(c, "FarmUpg", 34)}${doubled ? " · Menagerie doubler ×2" : ""}`),
  ];
});

/** `CropSCbonus` 7 @10824845: the crops past 100, times `CropSCbonMulti`, once the Emporium item 38 is owned. */
const cropSC7 = safe("Crop Depot Bonus 7", (c) => {
  if (1 != Ninja(c, "EmporiumBonus", 38, 0)) return [raw("Emporium not unlocked", 0)];
  const crops = cropCount(c);
  const excess = Math.max(0, crops - 100);
  if (!(0 < excess)) return [];
  return [
    raw("Crop Count", crops),
    raw("Excess", excess, "crops - 100"),
    row("Multi", FarmingStuffs(c, "CropSCbonMulti", 0, 0), "x", undefined, [
      raw("Depot Studies PhD (Mainframe 17)", MainframeBonus(c, 17)),
      raw("Superior Crop Research (Grimoire 22)", Summoning(c, "GrimoireUpgBonus", 22, 0)),
      raw("Scienterrific (Exotic 40)", FarmingStuffs(c, "ExoticBonusQTY", 40, 0), `Level ${asNum(c, "FarmUpg", 60)}`),
      raw("Properly Funded Research (Vault 79)", Summoning(c, "VaultUpgBonus", 79, 0)),
    ]),
  ];
});

/** `ExoticBonusQTY` 59 @10830602: the market upgrade's curve at its level (25 x L / (1000 + L)), doubled when Spelunk[50] lists it. */
const exotic59 = safe("Pommelion Seed", (c, val) => {
  const level = asNum(c, "FarmUpg", 79);
  if (!(0 < level)) return [];
  const doubled = contains(attr(c, "Spelunk", 50), 59);
  return [
    raw("Level", level),
    raw("Formula Result", doubled ? val / 2 : val, `decay(${list(MarketExoticInfo, 59, 3)},1000,${level})`),
    row("Menagerie Exotic Doubler", doubled ? 2 : 1, "x", doubled ? "doubler placed (Spelunk[50])" : "no doubler"),
  ];
});

// ===== Holes =====

/** `B_UPG` @10996050: the upgrade's level (a Holes[11] slot) times its value; 0 while Holes[13][b] is not bought. The 5 and 20 are the game's (46: 5 x Holes[11][26]; the page passes 20 for 82, 20 x Holes[11][55]). */
const holeUpgrade = (name: string, b: number, slot: number, per: number) =>
  safe(name, (c) => {
    const holes = attr(c, "Holes");
    if (!Array.isArray(holes) || 0 == holes.length || 0 == attr(c, "Holes", 13, b)) return [raw("Not built", 0)];
    return [raw("Level", asNum(c, "Holes", 11, slot)), row("Multiplier", per, "x")];
  });

/** Measurement 15 (`MeasurementBonusTOTAL` @11007027): its base bonus (with the Cosmo upgrade) times the multi of its kind. */
const meas15 = safe("Drop Rate Measurement", (c) => {
  const level = asNum(c, "Holes", 22, 15);
  if (!(0 < level)) return [];
  const kind = list(HolesInfo, 52, 15);
  const cosmo = Holes(c, "CosmoBonusQTY", 1, 3);
  return [
    raw("Measurement Level", level),
    raw("Cosmo Bonus", cosmo, `raw=${asNum(c, "Holes", 5, 3)}`),
    row("Cosmo Multiplier", 1 + cosmo / 100, "x"),
    raw("Base Bonus", Holes(c, "MeasurementBaseBonus", 15, 0), "50×lv/(100+lv)×cosmo"),
    row("Meas Multi", Holes(c, "MeasurementMulti", kind, 0), "x", `type ${kind}`, [
      raw(10 == kind ? "Holes[11][63]" : `Measurement count (type ${kind})`, Holes(c, "MeasurementQTYfound", kind, 0)),
      raw(`QTY (type ${kind})`, Holes(c, "MeasurementQTYfound", kind, 99), 10 == kind ? "max(0,log10(raw)-2)" : undefined),
    ]),
  ];
});

/** `MonumentROGbonuses(2, 6)` @11014436: the level times the monument's value, times the multiplier the Wisdom monument (2, 9), the Cosmo upgrade (0, 0) and the fountain make. */
const monument = safe("Monument Drop Rate", (c) => {
  const level = asNum(c, "Holes", 15, 26);
  if (!(0 < level)) return [];
  const wisdom = Holes(c, "MonumentROGbonuses", 2, 9);
  const cosmo = Holes(c, "CosmoBonusQTY", 0, 0);
  const fountain = Holes2(c, "Fountain_BonTOT", 2, 13);
  return [
    raw("Monument Level", level),
    raw("Bonus Per Level", list(HolesInfo, 37, 26)),
    row(
      "Wisdom Multiplier",
      Math.max(1, monumentMulti(c, 2, 6)),
      "x",
      undefined,
      present([
        when(wisdom, (v) => raw("Wisdom Monument", v, "monument idx 29", [raw("Wisdom Level", asNum(c, "Holes", 15, 29)), raw("Bonus Per Level", list(HolesInfo, 37, 29))])),
        when(cosmo, (v) => raw("Cosmo Upgrade", v, "cosmo 0/0", [raw("Cosmo Level", asNum(c, "Holes", 4, 0))])),
        when(fountain, (v) => row("Fountain Wisdom Boost", 1 + v / 100, "x", "fountain[2][13]", [row("fountainTotal(2,13)", v, "+")])),
      ])
    ),
  ];
});

// ===== The cards, the Grimoire, the Spelunking shop and the Legend talents =====

/** min(4 x caveC + 6 x caveD, 100), the two cards sharing the cap. */
const caveDR = safe("Cave Drop Rate", (c, val) => [
  raw("caveC (×4)", 4 * RunCodeOfTypeXforThingY(c, "CardLv", "caveC")),
  raw("caveD (×6)", 6 * RunCodeOfTypeXforThingY(c, "CardLv", "caveD")),
  raw(100 <= val ? "CAPPED (100)" : "Uncapped", val),
]);

/** `GrimoireUpgBonus` 44 @10885504: the level times the upgrade's value, times 1 + upgrade 36 / 100. */
const grimoire44 = safe("Skull of Major Droprate", (c) => {
  const level = asNum(c, "Grimoire", 44);
  if (!(0 < level)) return [];
  return [raw("Level", level), raw("Per Level", asNumber((GrimoireUpg[44] as readonly unknown[])[5])), row("Writhing Grimoire (Grimoire 36)", 1 + Summoning(c, "GrimoireUpgBonus", 36, 0) / 100, "x", `Level ${asNum(c, "Grimoire", 36)}`)];
});

/** `ShopUpgBonus` 50 @11112825: SpelunkUpg[50][4] x its level Spelunk[5][50]. */
const spelunk50 = safe("Golden Hardhat", (c) => {
  const level = asNum(c, "Spelunk", 5, 50);
  if (!(0 < level)) return [];
  return [raw("Shop Level", level), raw("Per Level", list(SpelunkUpg, 50, 4))];
});

/** `LegendPTS_bonus` 1 @10970802: the talent's points Spelunk[18][1] x its value per point. */
const legend1 = safe("Greatest Drop Party Ever", (c, val) => (0 < val ? [raw("Points", asNum(c, "Spelunk", 18, 1)), raw("Per Point", asNumber((LegendTalents[1] as readonly unknown[])[2]))] : []));

// ===== The Jelly Operator and the Sushi Station =====

/** `JellyOperation("RoG_BonusQTY", idx)` @5168369: unlocked while the successful operations Research[7][9] are past idx. */
function jellyRow(c: Ctx, idx: number, name: string): ArkhNode {
  const ops = asNum(c, "Research", 7, 9);
  return row(name, JellyOperation(c, "RoG_BonusQTY", idx, 0), "+", `jelly RoG ${idx}`, [raw("Successful Operations", ops), raw("Bonus Value", list(ResearchLists, 47, idx), ops > idx ? "Unlocked" : `Locked (need ${idx + 1} operations)`)]);
}

/** `SushiStuff("RoG_BonusQTY", idx)` @11218643: unlocked while the unique sushi are more than idx. */
function sushiRow(c: Ctx, idx: number, name: string): ArkhNode {
  const unique = SushiStuff(c, "UniqueSushi", 0, 0);
  return row(name, SushiStuff(c, "RoG_BonusQTY", idx, 0), "+", `sushi RoG ${idx}`, [raw("Unique Sushi", unique), raw("RoG Value", list(ResearchLists, 37, idx), unique > idx ? "Unlocked" : `Locked (need ${idx + 1})`)]);
}

const rog = safe("Sushi + Jelly Drop Rate", (c) => [
  sushiRow(c, 48, "Unagi Nigiri (Sushi Tier 49) — Drop Rate (RoG Bonus 48)"),
  jellyRow(c, 14, "Gold Bangle (Jelly Obstruction 15) — Drop Rate (Jelly Bonus 14)"),
]);

/** `EmperorBon` 11 @10979748: the bucket of the Emperor fights (OLA[369]) times 1 + (Arcane 48 + Arcade 51 + Jelly 28) / 100, rounded down. */
const emperor11 = safe("Drop Rate Emperor Bonus", (c, val) => {
  if (!(0 < val)) return [];
  const fights = asNum(c, "OptionsListAccount", 369) | 0;
  const bucketOf = (EmperorBon as unknown as readonly (readonly unknown[])[])[2];
  let matches = 0;
  for (let g = 0; g < fights; g++) if (11 == (asNumber(bucketOf[g - 48 * Math.floor(g / 48)]) | 0)) matches++;
  const arcane = ArcaneType(c, "ArcaneUpgBonus", 48, 0);
  const arcade = ArcadeBonus(c, 51);
  const jelly = jellyRow(c, 28, "Strabbury (Jelly Obstruction 29) — All earned Emperor Bonuses are x bigger than before! (Jelly Bonus 28)");
  return [
    raw("Emperor Kills", fights),
    raw("Slot Matches", matches),
    raw("Raw Sum", emperorBonTable(c)[11]),
    raw("Arcane 48", arcane),
    raw("Emperor Bonuses Arcade Bonus (Arcade 51)", arcade),
    jelly,
    row("Multi", 1 + (arcane + (arcade + jelly.val)) / 100, "x"),
  ];
});

// ===== The Research grid =====

/** The Research grid's multipliers on square `b` (`Grid_Bonus` @11177849): its shape (Research[1][b], -1 for none) and the multiplier every square gets. */
function gridMultis(c: Ctx, b: number): { shape: ArkhNode; all: ArkhNode } {
  const selector = attr(c, "Research", 1, b);
  const percent = -1 == selector ? 0 : list(ResearchLists, 5, asNum(c, "Research", 1, b) | 0);
  const t = gridAllMultiTerms(c);
  const cloud = (n: number, v: number) => when(v, (x) => raw(`Dream Challenge ${n} (Cloud Bonus ${n})`, x));
  const kids = present([
    when(t.comp55, (v) => raw("Pirate Deckhand (Companion 55)", v, "companion 55", [raw("Owned", 1), raw("Bonus", v)])),
    when(t.comp0, () => raw("King Doot (Companion 0)", t.grid173, "companion 0", [raw("Divine Design (Grid 173) Lv", t.level173)])),
    cloud(71, t.cloud71),
    cloud(72, t.cloud72),
    cloud(76, t.cloud76),
    when(t.sushi53, (v) => raw("Sushi Tier 54 — Research Grid All Multi (RoG Bonus 53)", v)),
  ]);
  return {
    shape: row("Shape Bonus", 1 + percent / 100, "x", `shape=${asNum(c, "Research", 1, b)}`),
    all: row("All Multi", ResearchStuff(c, "Grid_Bonus_Allmulti", 0, 0), "x", undefined, kids),
  };
}

/** Grid square 173 (Divine Design): its level times its value per level, times its shape and the all-multi (at least 1). */
const grid173 = safe("Divine Design", (c) => {
  const level = ResearchStuff(c, "Grid_Bonus", 173, 1);
  if (!(1 <= level)) return [];
  const per = list(ResGridSquares, 173, 2);
  const { shape, all } = gridMultis(c, 173);
  return [raw("Grid Level", level), raw("Base per Level", per * level, `${per}/level`), shape, { ...all, val: Math.max(1, all.val) }];
});

/** `GlimboDRmulti` @11198811 (grid square 168): 1 + the square's value x floor(trades / 100) / 100, once the square has a level. */
const glimbo = safe("Glimbo DR Multi", (c) => {
  const level = ResearchStuff(c, "Grid_Bonus", 168, 1);
  if (!(1 <= level)) return [];
  const trades = Minehead(c, "GlimboTotalTrades", 0, 0);
  const { shape, all } = gridMultis(c, 168);
  return [raw("Glimbo Insider Trading Secrets (Grid 168) Level", level), shape, all, raw("Total Trades", trades, `${Math.floor(trades / 100)} groups`)];
});

// ===== The Minehead, the Menagerie, the Pristine Charm and the vial =====

/** `Minehead("BonusQTY", 0)` @11194007: Research[20][0] once the floor Research[7][4] is past 0. */
const minehead0 = safe("Minehead Floor 0", (c, val) => {
  const floor = asNum(c, "Research", 7, 4);
  return 0 < val ? [raw("Mine Floor", floor), raw("Bonus Value", list(ResearchLists, 20, 0))] : [raw("Mine Floor", floor), raw("Required Floor", 0)];
});

/** `BoostQTY` 24 @5182868: the boost's level Menagerie[3][24] times its value Research[58][24]. */
const menagerie24 = safe("Menagerie Boost: Drop Rate", (c) => [raw("Level", asNum(c, "Menagerie", 3, 24)), raw("Per Level", list(ResearchLists, 58, 24))]);

/** `PristineBon` 3 @10871214: the charm's bonus (NjTrP3[3]) once it is found (Ninja[107][3] == 1). */
const pristine3 = safe("Cotton Candy", (c) => {
  const found = 1 == attr(c, "Ninja", 107, 3);
  return [raw(found ? "Unlocked" : "Locked", found ? 1 : 0), raw("Charm Bonus", asNumber(((NjEQ as Record<string, readonly unknown[]>).NjTrP3)[3]))];
});

/** `DNSM.AlchVials["7drMulto"]` (@4495601): each vial of that kind, its `VialBonus` @5108874 with the three multipliers the note gives. */
const vial = safe("Drop Rate Vial", (c) => {
  const vials = (AlchemyDescription as unknown as Table[])[4];
  const out: ArkhNode[] = [];
  vials.forEach((v, g) => {
    if ("7drMulto" !== hString(v[11])) return;
    if (!(0 < asNum(c, "CauldronInfo", 4, g))) return;
    const lab = 2 == MainframeBonus(c, 10) ? 2 : 1;
    const note = `lab×${lab} riftVault×${(1 + vialBoost(c) / 100).toFixed(2)} meritoc×${(1 + Summoning2(c, "MeritocBonusz", 20, 0) / 100).toFixed(2)}`;
    out.push(raw(String(v[0]) || `Vial ${g}`, CauldronStats(c, "VialBonus", 4, g, 0), note));
  });
  return out;
});

export const WORLD67_EXPLAINERS: Record<string, Explainer> = {
  rank9,
  cropSC7,
  exotic59,
  hole46: holeUpgrade("Gloomie Lootie", 46, 26, 5),
  hole82: holeUpgrade("Sanctum of LOOT", 82, 55, 20),
  meas15,
  monument,
  caveDR,
  grimoire44,
  spelunk50,
  legend1,
  emperor11,
  grid173,
  glimbo,
  minehead0,
  menagerie24,
  pristine3,
  rog,
  vial,
};
