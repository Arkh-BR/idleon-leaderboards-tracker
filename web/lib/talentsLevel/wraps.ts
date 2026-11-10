// The final-bonus wraps of /talents-level, read from lib/game. For most talents the curve IS the bonus (Eternal STR's +792 is +792 STR). A few give only a coefficient, "+X% per power of 10 of <a counter>", and the
// bonus is that coefficient times the counter (or its log10): each wrap follows the talent's consumer (the Damage / Drop Rate / Multikill code that applies it), not the tooltip the game draws for it
// (N.js TalentPow10Disp / TalentMultiDisp, @7235759..@7255309 of the talent panel's draw event). The tree of a wrapped talent is
//
//   Talent X = <final bonus>
//   |- the talent's own rows (Active / Effective Level, or Level / Max Level for a star)
//   |- Talent Value                  the coefficient
//   '- <Counter>                     the value the coefficient is applied to
//
// Names, order, formats and notes are the page's (lib/arkh's table was the reference for them), because the Hypothetical tab compares by path. Every counter reads lib/game. Where the game's arithmetic is not what
// lib/arkh had, the table follows the game and the difference is listed in the comparer's TALENT_KNOWN (__tests__/lib/game/support/talentCompare.ts).
import { asNum, asNumber } from "@/lib/game/attr";
import { charKey, opt } from "@/lib/game/state";
import type { Ctx } from "@/lib/game/ctx";
import { ArcaneUpg, CompassUpg, GrimoireUpg } from "@/lib/game/data";
import { NonFiniteResult } from "@/lib/game/errors";
import { listAt } from "@/lib/game/lists";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { AtomCollider } from "@/lib/game/njs/AtomCollider";
import { minigameHiscore } from "@/lib/game/njs/DamageDealed";
import { getLOG } from "@/lib/game/njs/getLOG";
import { talentCurveAt } from "@/lib/game/njs/GetTalentNumber";
import { PlayerHPmax } from "@/lib/game/njs/PlayerHPmax";
import { PlayerMPmax } from "@/lib/game/njs/PlayerMPmax";
import { PlayerSpeedBonus } from "@/lib/game/njs/PlayerSpeedBonus";
import { SkillStats } from "@/lib/game/njs/SkillStats";
import { DNSM_CalcTalentMAP, TalentCalc } from "@/lib/game/njs/TalentCalc";
import { TotalStats } from "@/lib/game/njs/TotalStats";
import { Windwalker } from "@/lib/game/njs/Windwalker";
import { itemsAndStorageOwned } from "@/lib/game/njs/WorkbenchStuff";
import type { ArkhNode } from "@/lib/dropRate/node";
import { raw as rawRow, row } from "@/lib/dropRate/explain/talent";

/** Where a wrap's counter comes from. */
export type CounterSource =
  | { kind: "OLA"; index: number } // OptionsListAccount[index]
  | { kind: "PetsStored"; row: number; col: number }
  | { kind: "PlayerHPmax" }
  | { kind: "PlayerMPmax" }
  | { kind: "SkillStats"; stat: string } // SkillStats(stat + "Efficiency")
  | { kind: "Lv0"; index: number } // the character's Lv0[index]
  | { kind: "TotalStat"; stat: string } // TotalStats(stat)
  | { kind: "GrimoireUpgTotal" }
  | { kind: "ArcaneUpgTotal" }
  | { kind: "CompassUpgTotal" }
  | { kind: "TotBreedzWWz" }
  | { kind: "StatueOnyx" }
  | { kind: "MinigameHiscore"; index: number } // FamilyValuesMap.MinigameHiscores[index]
  | { kind: "CalcTalent"; talentId: number } // CalcTalentMAP[talentId] (TalentCalc)
  | { kind: "TotalTitanKills" }
  | { kind: "InvStorageOwned"; item: string } // the character's inventory and the storage, as the game counts them
  | { kind: "PlayerSpeedBonus" };

/** Spec for a talent whose final bonus = wrap(the talent's curve value, counter). */
export type TalentWrapSpec = {
  /** Name of the counter row. */
  counterLabel: string;
  counterSource: CounterSource;
  /** Note of the counter row. */
  counterNote: string;
  /** The curve value and the counter to the final bonus. */
  wrap: (rawTalentVal: number, counter: number, c: Ctx) => number;
  /** Takes precedence over `wrap` when the final bonus needs the effective level (Tal 282 clamps against the talent's own tab-2 curve at it). */
  wrapWithLv?: (rawTalentVal: number, counter: number, effectiveLv: number, c: Ctx) => number;
  /** Takes precedence over `wrapWithLv` and `wrap` when the final bonus reads a second value of the character (the Atom 1 term of the inventory talents, the move speed of Speedna). */
  wrapWithSave?: (rawTalentVal: number, counter: number, c: Ctx) => number;
  /** The consumer applies the wrap with a counter of 0 too (the inventory talents add the Atom term to getLOG(0) = 0; 313's exponent is 1 at Trapping 0): only a curve value of 0 is inactive. */
  zeroCounterApplies?: true;
  /** "x" (a multiplier) or "+" (additive). */
  fmt: "x" | "+";
  /** The root's note when active, from the curve value and the counter. */
  noteForActive: (rawTalentVal: number, counter: number) => string;
  /** The root's value and note when the curve value or the counter is 0. */
  inactiveVal: number;
  inactiveNote: (rawTalentVal: number, counter: number) => string;
  /** Rows beside the talent's own and the counter (the coefficient, the Atom term). */
  extraBaseKids?: (rawTalentVal: number, c: Ctx) => ArkhNode[];
  /** The game's TalentCalc reads the character's own GetTalentNumber(1,id) when it is above 0 and the best character's getbonus2(1,id,-1) only otherwise (59 @4515654, 430 @4516984): the wrap does too, outside the what-if. */
  ownFirst?: true;
};

const logMul = (tv: number, n: number, c: Ctx) => 1 + (tv * getLOG(c, n)) / 100;
const logAdd = (tv: number, n: number, c: Ctx) => tv * getLOG(c, n);
const COEFFICIENT = "formula(effective_lv) — coefficient";
/** The "Talent Value" row under a wrapped talent: the curve before the counter is applied. */
const tvKid =
  (note = "formula(effective_lv) — per-step coefficient") =>
  (tv: number): ArkhNode[] => [rawRow("Talent Value", tv, note)];
const coefficient = tvKid(COEFFICIENT);
const idle = (what: string) => (_tv: number, n: number) => (n <= 0 ? `Inactive — ${what}` : "Inactive — talent 0");
const two = (n: number) => n.toFixed(2);

/** An account counter in OptionsListAccount: log10 of it times the coefficient. */
function olaLog(o: { label: string; index: number; note: string; what: string; wrap: TalentWrapSpec["wrap"]; fmt: "x" | "+"; active: (tv: number, n: number) => string; inactiveVal: number }): TalentWrapSpec {
  return { counterLabel: o.label, counterSource: { kind: "OLA", index: o.index }, counterNote: o.note, wrap: o.wrap, fmt: o.fmt, noteForActive: o.active, inactiveVal: o.inactiveVal, inactiveNote: idle(o.what), extraBaseKids: coefficient };
}
const mulNote = (tv: number, n: number) => `1 + (${two(tv)} × log10(${n})) / 100`;
const addNote = (what: string) => (tv: number, n: number) => `${two(tv)} × log10(${n}) % ${what}`;

/** A linear wrap on a counter: `tv × shape(counter)`, "+" format. */
function linear(o: { label: string; source: CounterSource; note: string; what: string; shape: (n: number) => number; show: (tv: number, n: number) => string; extra?: TalentWrapSpec["extraBaseKids"] }): TalentWrapSpec {
  return { counterLabel: o.label, counterSource: o.source, counterNote: o.note, wrap: (tv, n) => tv * o.shape(n), fmt: "+", noteForActive: o.show, inactiveVal: 0, inactiveNote: idle(o.what), extraBaseKids: o.extra ?? tvKid() };
}
const per10 = (tv: number, n: number, unit: string) => `${two(tv)} × floor(${n}/10) ${unit}`;
const lv10 = (label: string, index: number, skill: string, unit: string): TalentWrapSpec =>
  linear({ label, source: { kind: "Lv0", index }, note: `Lv0[${index}] — ${skill} skill level`, what: `${skill[0].toUpperCase()}${skill.slice(1)} Lv 0`, shape: (n) => Math.floor(n / 10), show: (tv, n) => per10(tv, n, unit) });
const stat1000 = (stat: "STR" | "AGI" | "WIS"): TalentWrapSpec =>
  linear({ label: `Total ${stat}`, source: { kind: "TotalStat", stat }, note: `computeTotalStat('${stat}') — active char`, what: `${stat} 0`, shape: (n) => n / 1000, show: (tv, n) => `${two(tv)} × (${Math.round(n)}/1000) % kill` });
const grimoire = (what: string): TalentWrapSpec =>
  linear({ label: "Grimoire Upgrade Total", source: { kind: "GrimoireUpgTotal" }, note: "Σ Grimoire[] — total grimoire upgrade levels", what: "no Grimoire upgrades", shape: (n) => n / 100, show: (tv, n) => `${two(tv)} × (${n}/100) % ${what}` });
const compass = (what: string): TalentWrapSpec =>
  linear({ label: "Compass Upgrade Total", source: { kind: "CompassUpgTotal" }, note: "Σ Compass[] — total compass upgrade levels", what: "no Compass upgrades", shape: (n) => n / 100, show: (tv, n) => `${two(tv)} × (${n}/100) % ${what}` });
/** 643's tier is a session value the game keeps from its last stat rebuild (DNSM_CalcTalentMAP "643"): the row says it is worked out now. */
export const ASSUMED_643 = " — assumed: the tier worked out now (the game keeps the one it found at its last stat rebuild)";
/** A CalcTalentMAP counter: `shape` is what the game's TalentCalc does to it (the consumer of each is cited on its row). */
const calc = (id: number, label: string, note: string, what: string, shape: (n: number) => number, show: (tv: number, n: number) => string, extra?: TalentWrapSpec["extraBaseKids"]): TalentWrapSpec =>
  linear({ label, source: { kind: "CalcTalent", talentId: id }, note, what, shape, show, extra });
/** An item count in the inventory and storage: coefficient × (log10(count) + the Atom 1 bonus). */
const invAtom = (item: string, itemLabel: string, effectWord: string): TalentWrapSpec => ({
  counterLabel: `${itemLabel} Owned (inv+storage)`,
  counterSource: { kind: "InvStorageOwned", item },
  counterNote: `ItemsAndStorageOWNED.${item} — assumed: this character's inventory plus the storage, counted as the game does after an inventory change (the game's own map is empty until the session's first one)`,
  wrap: (tv, n, c) => tv * getLOG(c, n),
  wrapWithSave: (tv, n, c) => tv * (getLOG(c, n) + AtomCollider(c, "AtomBonuses", 1, 0)),
  zeroCounterApplies: true, // N.js @4204412: 1 + GetTalentNumber(1,101) x (AtomCollider("AtomBonuses",1,0) + getLOG(owned)) / 100, with getLOG(0) = 0 (@4461003)
  fmt: "+",
  noteForActive: (tv, n) => `${two(tv)} × (log10(${n}) + Atom1) % ${effectWord}`,
  inactiveVal: 0,
  inactiveNote: idle(`no ${itemLabel} owned`),
  extraBaseKids: (tv, c) => [
    rawRow("Talent Value", tv, "formula(effective_lv) — per-power-of-10 coefficient"),
    rawRow("Atom Bonus (Helium)", AtomCollider(c, "AtomBonuses", 1, 0), "AtomCollider('AtomBonuses',1,0) = Atoms[1] × AtomInfo[1][4] — extra powers of 10 added to log10(count)"),
  ],
});

export const TALENT_WRAPS: Record<number, TalentWrapSpec> = {
  // ===== log multiplier (account-wide, "x") =====
  178: olaLog({ label: "Rememberance Orb Kills", index: 138, note: "OLA[138] — kills with the rememberance orb", what: "no Rememberance Orb Kills (OLA[138])", wrap: logMul, fmt: "x", active: mulNote, inactiveVal: 1 }),
  208: olaLog({ label: "Wraith Bones Collected", index: 329, note: "OLA[329] — wraith bones ever collected", what: "no Wraith Bones (OLA[329])", wrap: logMul, fmt: "x", active: mulNote, inactiveVal: 1 }),
  328: olaLog({ label: "Plunderous Kills", index: 139, note: "OLA[139] — kills of plunderous mobs", what: "no Plunderous Kills (OLA[139])", wrap: logMul, fmt: "x", active: mulNote, inactiveVal: 1 }),
  433: olaLog({ label: "Dust Collected", index: 362, note: "OLA[362] — dust ever collected", what: "no Dust (OLA[362])", wrap: logMul, fmt: "x", active: mulNote, inactiveVal: 1 }),
  508: olaLog({ label: "Wormhole Kills", index: 152, note: "OLA[152] — kills of wormhole mobs", what: "no Wormhole Kills (OLA[152])", wrap: logMul, fmt: "x", active: mulNote, inactiveVal: 1 }),
  // N.js @15151232: the chance is getbonus2(1,598,-1) x getLOG(OLA[394]) / 100 (gate @11095487), so the talent's % is tv x log10(OLA[394]); lib/arkh divided that % by 100 again
  598: olaLog({ label: "Tachyons", index: 394, note: "OLA[394] — tachyons collected", what: "no Tachyons (OLA[394])", wrap: logAdd, fmt: "+", active: addNote("chance"), inactiveVal: 0 }),

  // ===== log additive ("+") =====
  638: olaLog({ label: "Dungeon Credits", index: 71, note: "OLA[71] — dungeon credits earned", what: "no Dungeon Credits (OLA[71])", wrap: logAdd, fmt: "+", active: addNote("damage"), inactiveVal: 0 }),
  649: olaLog({ label: "Garbage", index: 161, note: "OLA[161] — garbage collected", what: "no Garbage (OLA[161])", wrap: logAdd, fmt: "+", active: addNote("damage"), inactiveVal: 0 }),
  // N.js @4062188 (TotalStats): Math.min(15, getLOG(OptionsListAccount[172]) x GetTalentNumber(1,653)); the tooltip draws it uncapped, the consumer is the headline
  653: olaLog({ label: "Best Target Dummy DPS", index: 172, note: "OLA[172] — best DPS ever on the Target Dummy", what: "no Target Dummy DPS (OLA[172])", wrap: (tv, n, c) => Math.min(15, logAdd(tv, n, c)), fmt: "+", active: (tv, n) => `${two(tv)} × log10(${n}) % all stat (max 15)`, inactiveVal: 0 }),
  365: {
    counterLabel: "Stored Pet Mob Power",
    counterSource: { kind: "PetsStored", row: 0, col: 2 },
    counterNote: "PetsStored[0][2] — mob power of pet in storage slot 0",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, n) => `${two(tv)} × log10(${n}) weapon power`,
    inactiveVal: 0,
    inactiveNote: idle("no stored pet in slot 0"),
    extraBaseKids: coefficient,
  },
  86: { counterLabel: "Max HP", counterSource: { kind: "PlayerHPmax" }, counterNote: "PlayerHPmax() — active char's computed max HP", wrap: logAdd, fmt: "+", noteForActive: addNote("damage"), inactiveVal: 0, inactiveNote: idle("Max HP is 0"), extraBaseKids: coefficient },
  446: { counterLabel: "Max MP", counterSource: { kind: "PlayerMPmax" }, counterNote: "PlayerMPmax() — active char's computed max MP", wrap: logAdd, fmt: "+", noteForActive: addNote("damage"), inactiveVal: 0, inactiveNote: idle("Max MP is 0"), extraBaseKids: coefficient },
  // N.js Grimoire_CRITPCT @10888848 (the wraith crit chance): 10 + GrimoireUpgBonus(10) + GetTalentNumber(1,202) x getLOG(SkillStats("FishingEfficiency"))
  202: {
    counterLabel: "Fishing Efficiency",
    counterSource: { kind: "SkillStats", stat: "Fishing" },
    counterNote: "computeSkillEfficiency('Fishing') — active char",
    wrap: logAdd,
    fmt: "+",
    noteForActive: addNote("wraith crit chance"),
    inactiveVal: 0,
    inactiveNote: idle("Fishing Efficiency is 0"),
    extraBaseKids: tvKid("formula(effective_lv) — coefficient (X bonus)"),
  },

  // ===== linear x counter ("+") =====
  // 655, the boss battle spillover star talent: final = Per-Skull x Skulls Beaten (TotalStats @4193353 reads GetTalentNumber(1,655) of the character, not the best one)
  655: {
    counterLabel: "Skulls Beaten",
    counterSource: { kind: "OLA", index: 189 },
    counterNote: "OLA[189] — count of skulls beaten",
    wrap: (perSkull, skulls) => perSkull * skulls,
    fmt: "+",
    noteForActive: (perSkull, skulls) => `${two(perSkull)} per skull × ${skulls} skulls`,
    inactiveVal: 0,
    inactiveNote: (_p, skulls) => (skulls <= 0 ? "Inactive — no Skulls Beaten (OLA[189])" : "Inactive — Per-Skull contribution is 0"),
    extraBaseKids: (perSkull) => [rawRow("Per Skull", perSkull)],
  },
  58: linear({ label: "Speedrun Highscore Maps", source: { kind: "OLA", index: 158 }, note: "OLA[158] — speedrun highscore (maps cleared)", what: "no Speedrun highscore (OLA[158])", shape: (n) => Math.floor(n / 5), show: (tv, n) => `${two(tv)} × floor(${n}/5) % multikill` }),
  // N.js @4202284 (SkillStats): x (1 + GetTalentNumber(1,103) x (Lv0[1] / 10) / 100), so the talent's % is tv x (Lv0[1] / 10); lib/arkh divided that % by 100 again
  103: linear({ label: "Mining Level", source: { kind: "Lv0", index: 1 }, note: "Lv0[1] — mining skill level", what: "Mining Lv 0", shape: (n) => n / 10, show: (tv, n) => `${two(tv)} × (${n}/10) % mining power` }),
  140: lv10("Cooking Level", 10, "cooking", "weapon power"),
  141: stat1000("STR"),
  170: lv10("Gaming Level", 15, "gaming", "weapon power"),
  281: lv10("Smithing Level", 2, "smithing", "anvil pts"),
  320: lv10("Sailing Level", 13, "sailing", "weapon power"),
  366: stat1000("AGI"),
  500: lv10("Divinity Level", 14, "divinity", "weapon power"),
  530: lv10("Lab Level", 12, "lab", "weapon power"),
  531: stat1000("WIS"),

  // ===== W6 upgrade totals (+) =====
  200: grimoire("wraith dmg/acc"),
  201: grimoire("wraith def/hp"),
  425: compass("tempest def/acc"),
  426: compass("tempest elem dmg"),
  // N.js @11070551 (Compass_CRITPCT): GetTalentNumber(1,427) x floor(Windwalker("TotBreedzWWz") / 25); the total is not the count of unlocked breeds lib/arkh took, see totBreedzWWz (@11072274)
  427: linear({ label: "Breeds Unlocked (WW)", source: { kind: "TotBreedzWWz" }, note: "TotBreedzWWz — the W6 breeds, each unlocked one weighted by its 2nd multiplier, as the game sums them", what: "no breeds unlocked", shape: (n) => Math.floor(n / 25), show: (tv, n) => `${two(tv)} × floor(${n}/25) % tempest crit` }),
  591: linear({ label: "Arcane Upgrade Total", source: { kind: "ArcaneUpgTotal" }, note: "Σ Arcane[] — total arcane (tesseract) upgrade levels", what: "no Arcane upgrades", shape: (n) => n / 100, show: (tv, n) => `${two(tv)} × (${n}/100) % arcanist acc/def` }),
  463: linear({ label: "Minigame Highscore", source: { kind: "MinigameHiscore", index: 0 }, note: "FamValMinigameHiscores[0] — chopping minigame highscore", what: "no minigame highscore", shape: (n) => Math.floor(n / 25), show: (tv, n) => `${two(tv)} × floor(${n}/25) % dmg` }),
  654: linear({ label: "Onyx Statues Owned", source: { kind: "StatueOnyx" }, note: "count of unique Onyx statues (StatueG[e] >= 2, gated by OLA[69])", what: "no Onyx statues", shape: (n) => n, show: (tv, n) => `${two(tv)} × ${n} onyx statues % multikill` }),
  // N.js @10745916 (the bits): x (1 + getbonus2(1,177,-1) x Lv0[15] / 100) x ..., so the talent's % is tv x Lv0[15]; lib/arkh divided that % by 100 again. The Gaming multiplier of the same product is not in the row
  177: linear({ label: "Gaming Level", source: { kind: "Lv0", index: 15 }, note: "Lv0[15] — gaming level (× GamingPOINGmulti omitted)", what: "Gaming Lv 0", shape: (n) => n, show: (tv, n) => `${two(tv)} × ${n} % bits (×gaming mult omitted)` }),
  // N.js @11089284 (Arcane_DMG): x (1 + GetTalentNumber(1,590) x (ArcaneUpgTotal / 100) / 100), so the talent's % is tv x (total / 100); lib/arkh divided that % by 100 again
  590: linear({ label: "Arcane Upgrade Total", source: { kind: "ArcaneUpgTotal" }, note: "Σ Arcane[] — total arcane upgrade levels (×pow(1.04,ACzWepAtk) omitted)", what: "no Arcane upgrades", shape: (n) => n / 100, show: (tv, n) => `${two(tv)} × (${n}/100) % arcanist dmg (×ACzWepAtk pow omitted)` }),

  // ===== CalcTalentMAP-scaled talents (lib/game/njs/TalentCalc.ts): the root is the term the game's consumer adds, or puts in a 1 + x / 100 =====
  // Damage sum @4113350: + TalentCalc(31) = GetTalentNumber(1,31) x floor(CalcTalentMAP[31] / 5)
  31: calc(31, "Lowest Skill LV", "CalcTalentMAP[31] — min(Lv0[1..9]) lowest skill level", "lowest skill LV is 0", (n) => Math.floor(n / 5), (tv, n) => `${two(tv)} × floor(${n}/5) % dmg`),
  // the critters @7777168 and the souls @7767819: x (1 + TalentCalc(57) / 100), TalentCalc(57) = getbonus2(1,57,-1) x CalcTalentMAP[57]
  57: calc(57, "Trapping+Worship LV over 100", "CalcTalentMAP[57] — max(0, best(Lv0[7]+Lv0[9]) - 100) across chars", "combined Trapping+Worship <= 100", (n) => n, (tv, n) => `${two(tv)} × ${n} % critters & souls`),
  // the cooking speed @7893630: 10 x (1 + TalentCalc(59) / 100) x ..., so the talent's % is TalentCalc(59) = pow(min(1.012, 1 + t / 100), CalcTalentMAP[59]) (@4515654); lib/arkh shows the pow as a multiplier
  59: {
    counterLabel: "Total Meal LV",
    counterSource: { kind: "CalcTalent", talentId: 59 },
    counterNote: "CalcTalentMAP[59] — Σ Meals[0][*] (all meal upgrade levels)",
    wrap: (tv, n) => Math.pow(Math.min(1.012, 1 + tv / 100), n),
    fmt: "+",
    noteForActive: (tv, n) => `pow(min(1.012, 1 + ${two(tv)}/100), ${n}) % cooking spd`,
    inactiveVal: 1,
    inactiveNote: (_tv, n) => (n <= 0 ? "Inactive — no Meal LV (Σ = 0) → pow(..,0) = 1" : "Inactive — talent 0"),
    extraBaseKids: tvKid(),
    ownFirst: true,
  },
  // Damage sum @4113380: + TalentCalc(110) = GetTalentNumber(1,110) x CalcTalentMAP[110]
  110: calc(110, "Mob Types Killed >100k", "CalcTalentMAP[110] — fighting maps with >100k lifetime kills (capped by talent)", "no maps with >100k kills", (n) => n, (tv, n) => `${two(tv)} × ${n} % dmg`),
  // Damage sum @4113380: + GetTalentNumber(1,125) x TalentCalc(125), the counter being TalentCalc(125) itself (@4516114)
  125: calc(125, "Refinery Ranks (acc-gated)", "CalcTalentMAP[125] — Σ Refinery ranks when accuracy >= 2.25× AFK-target defence, else 0", "accuracy below 2.25× AFK-target defence (or no refinery ranks)", (n) => n, (tv, n) => `${two(tv)} × ${n} % dmg`),
  // the efficiencies @4245830 and the cooking @4246949: x (1 + (TalentCalc(146) + ...) / 100), TalentCalc(146) = GetTalentNumber(1,146) x CalcTalentMAP[146]
  146: calc(146, "Mob Types Killed >1m", "CalcTalentMAP[146] — fighting maps with >1m lifetime kills (capped by talent)", "no maps with >1m kills", (n) => n, (tv, n) => `${two(tv)} × ${n} % cooking exp & eff`),
  // the gold food sum @5057606: + getbonus2(1,209,-1) x CalcTalentMAP[209] (TalentCalc(209) is only the tooltip's)
  209: calc(209, "Mob Types Killed >1b", "CalcTalentMAP[209] — the Death Bringer's fighting maps with >1b lifetime kills", "no maps with >1b kills", (n) => n, (tv, n) => `${two(tv)} × ${n} % gold food effect`),
  // Damage sum @4113449: + TalentCalc(305) / 50
  305: calc(305, "Items Ever Found", "CalcTalentMAP[305] — count of Cards[1] entries (excl. Gem*/Cards*)", "no items found", (n) => n / 50, (tv, n) => `${two(tv)} × ${n} / 50 % damage`),
  // the Ninja upgrade costs @10853056 (and the six after it) divide by (1 + TalentCalc(430) / 100), so the talent's % is TalentCalc(430) = t x floor(CalcTalentMAP[430] / 10) (@4516984); the tooltip's
  // "1 + .01 x ... x_Cheaper_Upgrades" (@7249170) is that divisor
  430: { ...calc(430, "Total Ninja Upgrades", "CalcTalentMAP[430] — Σ Ninja[103][*] (Ninja Knowledge upg)", "no Ninja upgrades", (n) => Math.floor(n / 10), (tv, n) => `${two(tv)} × floor(${n}/10) % cheaper`), ownFirst: true },
  // Damage sum @4113480: + TalentCalc(470) / 10
  470: calc(470, "Stamps In Collection", "CalcTalentMAP[470] — count StampLevelMAX[0..2][*] > 0.5", "no stamps", (n) => n / 10, (tv, n) => `${two(tv)} × ${n} / 10 % damage`),
  // Damage sum @4113380: + TalentCalc(485)
  485: calc(485, "Vials >= Green LV", "CalcTalentMAP[485] — count CauldronInfo[4][*] > 3", "no Green+ vials", (n) => n, (tv, n) => `${two(tv)} × ${n} % damage`),
  // Summoning("UpgCost") @10923070: x 1 / (1 + getbonus2(1,595,-1) x max(0, floor(CalcTalentMAP[595] / 100)) / 100); the root is that divisor, the "x cheaper" of the tooltip (@7252776)
  595: {
    counterLabel: "Total Summoning Upgrades",
    counterSource: { kind: "CalcTalent", talentId: 595 },
    counterNote: "CalcTalentMAP[595] — Σ Summon[0][*] (summoning upgrades)",
    wrap: (tv, n) => 1 + 0.01 * tv * Math.floor(n / 100),
    fmt: "x",
    noteForActive: (tv, n) => `1 + 0.01 × ${two(tv)} × floor(${n}/100) cheaper upgrades`,
    inactiveVal: 1,
    inactiveNote: (_tv, n) => (n < 100 ? "Inactive — < 100 Summoning upgrades (floor = 0)" : "Inactive — talent 0"),
    extraBaseKids: tvKid(),
  },
  // weapon power @4186963: + TalentCalc(616) = min(GetTalentNumber(1,616), floor(CalcTalentMAP[616] / 10))
  616: {
    ...calc(616, "Best Beginner Lv", "CalcTalentMAP[616] — best Lv0[0] across class<6 chars", "", (n) => n, () => ""),
    wrap: (tv, n) => Math.min(tv, Math.floor(n / 10)),
    noteForActive: (tv, n) => `min(${two(tv)}, floor(${n}/10)) weapon power`,
    inactiveNote: (_tv, n) => (n < 10 ? "Inactive — best Beginner < Lv 10 (floor = 0)" : "Inactive — talent 0"),
    extraBaseKids: tvKid("formula(effective_lv) — the +N cap coefficient"),
  },
  // the stats @4177260 (STR; AGI, WIS, LUK after it): + TalentCalc(620) = min(GetTalentNumber(1,620), floor(CalcTalentMAP[620] / 10))
  620: {
    ...calc(620, "Highest Char Lv", "CalcTalentMAP[620] — best Lv0[0] across all chars", "", (n) => n, () => ""),
    wrap: (tv, n) => Math.min(tv, Math.floor(n / 10)),
    noteForActive: (tv, n) => `min(${two(tv)}, floor(${n}/10)) all stats`,
    inactiveNote: (_tv, n) => (n < 10 ? "Inactive — highest char < Lv 10 (floor = 0)" : "Inactive — talent 0"),
    extraBaseKids: tvKid("formula(effective_lv) — the +N cap coefficient"),
  },
  // the coins @4049671: + TalentCalc(643) + TalentCalc(644) + ..., 643 = GetTalentNumber(1,643) x the multikill tier (assumed: see DNSM_CalcTalentMAP "643"), 644 = GetTalentNumber(1,644) x Lv0[10] / 10
  643: { ...calc(643, "Multikill Damage Tier", `CalcTalentMAP[643] — OverkillStuffs("2"): max damage vs AFKtarget_N's HP, saved map${ASSUMED_643}`, "", (n) => n, (tv, n) => `${two(tv)} × ${n} % cash per tier`), inactiveNote: () => "Inactive — talent 0" },
  644: calc(644, "Cooking LV / 10", "CalcTalentMAP[644] — Lv0[10]/10 (active char cooking / 10)", "Cooking LV 0", (n) => n, (tv, n) => `${two(tv)} × ${n} % cash`),
  // the AFK gains @4445380: + TalentCalc(650); the Damage sum @4113722: + TalentCalc(656)
  650: calc(650, "Random Event Rare Items", "CalcTalentMAP[650] — Cards[1] matches of RANDOlist[82..86]", "no Random Event rares found", (n) => n, (tv, n) => `${two(tv)} × ${n} % AFK gains rate`),
  656: calc(656, "Dream Clouds Completed", "CalcTalentMAP[656] — count DreamChallenge with WeeklyBoss[d_g]===-1", "no Dream clouds completed", (n) => n, (tv, n) => `${two(tv)} × ${n} % damage`),

  // ===== coefficient x (log10(items owned) + Atom 1) =====
  101: invAtom("Copper", "Copper Ore", "mining efficiency"),
  131: invAtom("Refinery1", "Redox Salts", "build speed"),
  295: invAtom("OakTree", "Oak Logs", "catching efficiency"),
  311: invAtom("Critter1", "Froge Critters", "trapping efficiency"),
  461: invAtom("Leaf1", "Grass Leaves", "choppin efficiency"),
  476: invAtom("Soul1", "Forest Souls", "worship efficiency"),

  // ===== power forms ("x") =====
  // N.js @7779456 (the shiny chance): Math.pow(Math.max(1, GetTalentNumber(1,313)), 1 + Math.floor(Lv0[7] / 10)), so Trapping 0 still gives max(1, tv)
  313: {
    zeroCounterApplies: true,
    counterLabel: "Trapping Level",
    counterSource: { kind: "Lv0", index: 7 },
    counterNote: "Lv0[7] — Trapping skill level (exponent = 1 + floor(LV/10))",
    wrap: (tv, n) => Math.pow(Math.max(1, tv), 1 + Math.floor(n / 10)),
    fmt: "x",
    noteForActive: (tv, n) => `pow(max(1, ${two(tv)}), 1 + floor(${n}/10)) shiny chance`,
    inactiveVal: 1,
    inactiveNote: (_tv, n) => (n <= 0 ? "Inactive — Trapping LV 0 → pow(..,1)" : "Inactive — talent 0"),
    extraBaseKids: tvKid("formula(effective_lv) — base x-multiplier (per 10 Trapping LV)"),
  },
  // N.js @4265761 (the class EXP): Math.pow(Math.max(1, getbonus2(1,434,-1)), Windwalker("TotalTitanKills"))
  434: {
    counterLabel: "Abominations Killed",
    counterSource: { kind: "TotalTitanKills" },
    counterNote: "Σ Compass[1][l] === 1 — titans/abominations killed (exponent)",
    wrap: (tv, n) => Math.pow(Math.max(1, tv), n),
    fmt: "x",
    noteForActive: (tv, n) => `pow(${tv.toFixed(4)}, ${n}) class EXP`,
    inactiveVal: 1,
    inactiveNote: (_tv, n) => (n <= 0 ? "Inactive — no abominations killed → pow(..,0) = 1" : "Inactive — talent 0"),
    extraBaseKids: tvKid("formula(effective_lv) — per-kill x-multiplier base"),
  },

  // ===== clamped linear =====
  // N.js @7246915: min(GetTalentNumber(1,282) x (TotalStats("AGI") / 250), GetTalentNumber(2,282)); the cap is the talent's tab-2 curve at the effective level
  282: {
    counterLabel: "Total AGI",
    counterSource: { kind: "TotalStat", stat: "AGI" },
    counterNote: "computeTotalStat('AGI') — active char",
    wrap: (tv, n) => tv * (n / 250), // uncapped: the cap needs the effective level (wrapWithLv)
    wrapWithLv: (tv, n, lv, c) => Math.min(tv * (n / 250), talentCurveAt(c, 2, 282, lv)),
    fmt: "+",
    noteForActive: (tv, n) => `min(${two(tv)} × (${Math.round(n)}/250), cap) % skill exp`,
    inactiveVal: 0,
    inactiveNote: idle("AGI 0"),
    extraBaseKids: tvKid("formula(effective_lv) — % exp per 250 AGI (capped by tab-2)"),
  },
  // N.js @4113631 (the Damage sum): GetTalentNumber(1,290) x floor(min(PlayerSpeedBonus() - 1, 10) / .15), the speed above 100% in steps of 15%, at most 1000%. The counter row is the speed over 100% in %
  290: {
    counterLabel: "Movement Speed % over 100",
    counterSource: { kind: "PlayerSpeedBonus" },
    counterNote: "min(1000, 100×(PlayerSpeedBonus−1)) — move speed % above 100",
    wrap: (tv, n) => tv * (n / 15),
    wrapWithSave: (tv, _n, c) => tv * Math.floor(Math.min(PlayerSpeedBonus(c) - 1, 10) / 0.15),
    fmt: "+",
    noteForActive: (tv, n) => `${two(tv)} × ⌊${Math.round(n)}/15⌋ % damage`,
    inactiveVal: 0,
    inactiveNote: idle("move speed at/below 100%"),
    extraBaseKids: tvKid("formula(effective_lv) — % dmg per 15% move spd"),
  },
};

// ---- the counters ----

/** The sum of the first `n` entries of `list`, as the game's `c.asNumber(list[i])` loop adds them. */
function sumFirst(n: number, at: (i: number) => number): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += at(i);
  return total;
}

/** Summoning("GrimoireUpgTotal") @10885016: Σ Grimoire[g] over GrimoireUpg.length. (The game keeps it in DNSM.GrimoireTotLV from the first call of the session; here it is summed from the save.) */
const grimoireUpgTotal = (c: Ctx): number => sumFirst(GrimoireUpg.length, (g) => asNum(c, "Grimoire", g));
/** ArcaneType("ArcaneUpgTotal") @11084044: Σ Arcane[e] over ArcaneUpg.length (DNSM.ArcaneTotLV). */
const arcaneUpgTotal = (c: Ctx): number => sumFirst(ArcaneUpg.length, (e) => asNum(c, "Arcane", e));
/** Windwalker("CompassUpgTotal") @11071791: Σ Compass[0][l] over CompassUpg.length (DNSM.CompassTotLV). */
const compassUpgTotal = (c: Ctx): number => sumFirst(CompassUpg.length, (l) => asNum(c, "Compass", 0, l));

/**
 * Windwalker("TotBreedzWWz") @11072274: over the four W6 breeding worlds w (Breeding[13 + w]) and each entry e, an entry above .5 adds min(9, floor((Breeding("2ndMulti","0",w,e) - 1)^.8) + 1) and any other adds 1.
 * Breeding("2ndMulti") @7939419 is 1 + ln(max(1, (Breeding[13 + w][e] + 1)^.725)) once the breeding actor's GenINFO[53][0] is 1 and 1 before. That flag is `0 < Breeding[2][3]` (the actor's constructor @10095007, again
 * at @10021495), read here from the save. (DNSM.TotBreedzWWz keeps the sum from the session's first call.)
 */
function totBreedzWWz(c: Ctx): number {
  const second = 0 < asNum(c, "Breeding", 2, 3);
  let total = 0;
  for (let w = 0; w < 4; w++) {
    for (let e = 0, n = listAt(c, "Breeding", 13 + w).length; e < n; e++) {
      const v = asNum(c, "Breeding", 13 + w, e);
      total += 0.5 < v ? Math.min(9, Math.floor(Math.pow((second ? 1 + Math.log(Math.max(1, Math.pow(v + 1, 0.725))) : 1) - 1, 0.8)) + 1) : 1;
    }
  }
  return total;
}

/**
 * The character of `c` on the map its save says it is on (CurrentMap_<i>). The page has no map of its own (its Ctx is on map 0), but 125's accuracy gate and 643's multikill tier are against the
 * monster of the AFK target, which the game takes from the map the character stands on (lib/game/afkTarget.ts).
 */
function onSavedMap(c: Ctx): Ctx {
  const saved = opt(c.state, charKey("CurrentMap", c.player));
  return undefined === saved || null === saved ? c : { ...c, map: asNumber(saved) };
}

/** The counter's value for the character of `c`. */
export function readCounter(c: Ctx, src: CounterSource): number {
  switch (src.kind) {
    case "OLA":
      return asNum(c, "OptionsListAccount", src.index);
    case "PetsStored":
      return asNum(c, "PetsStored", src.row, src.col);
    case "PlayerHPmax":
      return PlayerHPmax(c);
    case "PlayerMPmax":
      return PlayerMPmax(c);
    case "Lv0":
      return asNum(c, "Lv0", src.index);
    case "TotalStat":
      return TotalStats(c, src.stat);
    case "GrimoireUpgTotal":
      return grimoireUpgTotal(c);
    case "ArcaneUpgTotal":
      return arcaneUpgTotal(c);
    case "CompassUpgTotal":
      return compassUpgTotal(c);
    case "TotBreedzWWz":
      return totBreedzWWz(c);
    case "StatueOnyx":
      return ArbitraryCode(c, "StatueOnyxOwned");
    case "MinigameHiscore":
      return minigameHiscore(c, src.index);
    case "TotalTitanKills":
      return Windwalker(c, "TotalTitanKills", 0, 0);
    case "InvStorageOwned":
      return itemsAndStorageOwned(c, src.item);
    case "PlayerSpeedBonus":
      return Math.min(1000, 100 * Math.max(0, PlayerSpeedBonus(c) - 1));
    case "CalcTalent":
      // 125 keeps no CalcTalentMAP key: its counter is TalentCalc(125), the refinery ranks behind the accuracy gate
      if (125 === src.talentId) return TalentCalc(onSavedMap(c), 125);
      return DNSM_CalcTalentMAP(643 === src.talentId ? onSavedMap(c) : c, `${src.talentId}`);
    case "SkillStats":
      return SkillStats(c, `${src.stat}Efficiency`);
  }
}

/** The wrapped node of talent `id`: headline = the final bonus, the talent's rows, the coefficient and the counter under it. The inactive shape when the curve value or the counter is 0. */
export function applyWrap(c: Ctx, spec: TalentWrapSpec, name: string, rawTalentVal: number, baseKids: ArkhNode[], effectiveLv: number): ArkhNode {
  const counter = readCounter(c, spec.counterSource);
  const kids = [...baseKids, ...(spec.extraBaseKids?.(rawTalentVal, c) ?? []), rawRow(spec.counterLabel, counter, spec.counterNote)];
  if (rawTalentVal > 0 && (counter > 0 || spec.zeroCounterApplies)) {
    const val = spec.wrapWithSave ? spec.wrapWithSave(rawTalentVal, counter, c) : spec.wrapWithLv ? spec.wrapWithLv(rawTalentVal, counter, effectiveLv, c) : spec.wrap(rawTalentVal, counter, c);
    if (!Number.isFinite(val)) throw new NonFiniteResult(`TalentWrap ${name}`, [rawTalentVal, counter], val);
    return row(name, val, spec.fmt, spec.noteForActive(rawTalentVal, counter), kids);
  }
  return row(name, spec.inactiveVal, spec.fmt, spec.inactiveNote(rawTalentVal, counter), kids);
}
