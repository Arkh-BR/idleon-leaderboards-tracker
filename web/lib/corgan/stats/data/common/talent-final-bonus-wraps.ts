// ===== TALENT FINAL BONUS WRAPS =====
// (formerly external-context-multipliers.ts)
//
// For MOST talents, `formulaEval(formula, x1, x2, effective_lv)` — i.e.
// what talent.resolve() returns — IS the final in-game bonus. Eternal
// STR's "+792" means literally +792 STR. For those, no wrap is needed.
//
// Some talents are different: their formula result is only a COEFFICIENT
// ("+X% per power of 10 of <some counter>"). The actual bonus needs an
// extra step that multiplies the coefficient by the counter (or its
// log10). Without the wrap, the talent's headline would show the bare
// coefficient (e.g. 4.86) — useless on its own. With the wrap, the
// headline shows the FINAL bonus and the tree exposes the inputs:
//
//   Talent X = <final bonus>
//   ├── Effective Level (Base + Bonus + Super)   ← formula input
//   ├── Talent Value = formula(effective_lv)     ← the coefficient
//   └── <Counter>                                ← external/derived value
//
// This keeps the user-facing contract "talent headline = final bonus"
// true for ALL talents.
//
// Wrap shapes seen in N.js:
//   - log multiplier:  final = 1 + talVal × log10(counter) / 100   (fmt "x")
//   - log additive:    final = talVal × log10(counter)             (fmt "+")
//   - log chance:      final = talVal × log10(counter) / 100       (fmt "+")
//   - linear:          final = talVal × counter                    (Cat 3a/3b)
//   - custom:          arbitrary fn                                (Cat 4)

import type { CorganNode } from "../../../node";
import { node } from "../../../node";
import { optionsListData } from "../../../save/data";
import { getLOG } from "../../../formulas";
import type { SaveData } from "../../../state";
import {
  computePlayerHPmax,
  computePlayerMPmax,
  computeSkillEfficiency,
} from "../../systems/common/derived-stats";
import { computeTotalStat } from "../../systems/common/stats";
import { computeCalcTalent } from "../../systems/common/calcTalent";
import {
  grimoireUpgTotal,
  arcaneUpgTotal,
  compassUpgTotal,
  totBreedzWWz,
  statueOnyxOwned,
} from "../../systems/w6/upg-totals";

/** Where a wrap's counter value comes from. Extend as new wrap counters
 *  are added (Cat 3a/3b/4 bring more kinds). */
export type CounterSource =
  /** optionsListData[index] — account-level counter (kills, collected, etc). */
  | { kind: "OLA"; index: number }
  /** saveData.petsStoredData[row][col] — e.g. stored pet's mob power. */
  | { kind: "PetsStored"; row: number; col: number }
  /** Active char's computed max HP. PORTED IN: player-derived-stats.ts. */
  | { kind: "PlayerHPmax" }
  /** Active char's computed max MP. PORTED IN: player-derived-stats.ts. */
  | { kind: "PlayerMPmax" }
  /** Active char's computed skill stat (e.g. "FishingEfficiency"). */
  | { kind: "SkillStats"; stat: string }
  /** Active char's Lv0[index] — a skill/player level (mining=1, smith=2,
   *  cooking=10, lab=12, sailing=13, divinity=14, gaming=15, etc). */
  | { kind: "Lv0"; index: number }
  /** Active char's computed primary stat (STR/AGI/WIS/LUK) via the
   *  ported stats engine. */
  | { kind: "TotalStat"; stat: string }
  /** Account-wide W6 upgrade-total counters (sum of save arrays). */
  | { kind: "GrimoireUpgTotal" }
  | { kind: "ArcaneUpgTotal" }
  | { kind: "CompassUpgTotal" }
  | { kind: "TotBreedzWWz" }
  /** Count of unique Onyx statues owned. */
  | { kind: "StatueOnyx" }
  /** FamValMinigameHiscores[index] — minigame highscore points. */
  | { kind: "MinigameHiscore"; index: number }
  /** CalcTalentMAP[talentId] — the in-game per-talent counter built by
   *  N.js `_customBlock_TalentCalc`. Ported in systems/common/calcTalent.ts.
   *  Some sub-sources are stubbed to 0 there (rift kill-trackers, overkill
   *  tier, accuracy gate) — those wraps emit their inactive value. */
  | { kind: "CalcTalent"; talentId: number };

/** Spec for a talent whose final bonus = wrap(rawTalentVal, counter). */
export type TalentWrapSpec = {
  /** Human-readable name of the counter (shown as a kid label). */
  counterLabel: string;
  /** Where to read the counter value from. */
  counterSource: CounterSource;
  /** Free-text note attached to the counter kid. */
  counterNote: string;
  /** Applies the counter to the talent's raw value → the final bonus. */
  wrap: (rawTalentVal: number, counter: number) => number;
  /** Format of the wrapped value: "x" (multiplier) or "+" (additive). */
  fmt: "x" | "+";
  /** Headline note for the wrapped node, given both inputs. */
  noteForActive: (rawTalentVal: number, counter: number) => string;
  /** Value + note to emit when the wrap is inactive (raw<=0 or counter<=0). */
  inactiveVal: number;
  inactiveNote: (rawTalentVal: number, counter: number) => string;
  /** Extra kids inserted alongside the base kids (e.g. a "Per Skull" row). */
  extraBaseKids?: (rawTalentVal: number) => CorganNode[];
};

/** Reads a wrap counter from the save. Per-char counters (HPmax, etc.)
 *  use charIdx. Returns 0 for not-yet-ported derived stats (the wrap
 *  then emits its inactive value, with a note explaining what's missing). */
function readCounter(
  src: CounterSource,
  saveData: SaveData,
  charIdx: number
): number {
  switch (src.kind) {
    case "OLA":
      return Number((optionsListData as any)[src.index]) || 0;
    case "PetsStored": {
      const row = (saveData.petsStoredData as any)?.[src.row];
      return Number(row?.[src.col]) || 0;
    }
    case "PlayerHPmax":
      return Number(computePlayerHPmax(charIdx, { saveData, charIdx }).val) || 0;
    case "PlayerMPmax":
      return Number(computePlayerMPmax(charIdx, { saveData, charIdx }).val) || 0;
    case "SkillStats":
      return (
        Number(
          computeSkillEfficiency(src.stat, charIdx, { saveData, charIdx }).val
        ) || 0
      );
    case "Lv0":
      return (
        Number((saveData.lv0AllData as any)?.[charIdx]?.[src.index]) || 0
      );
    case "TotalStat":
      return (
        Number(computeTotalStat(src.stat, charIdx, { saveData, charIdx }).computed) || 0
      );
    case "GrimoireUpgTotal":
      return grimoireUpgTotal(saveData);
    case "ArcaneUpgTotal":
      return arcaneUpgTotal(saveData);
    case "CompassUpgTotal":
      return compassUpgTotal(saveData);
    case "TotBreedzWWz":
      return totBreedzWWz(saveData);
    case "StatueOnyx":
      return statueOnyxOwned(saveData);
    case "MinigameHiscore":
      return (
        Number((saveData as any).minigameHiscores?.[src.index]) || 0
      );
    case "CalcTalent":
      return Number(computeCalcTalent(src.talentId, charIdx, saveData)) || 0;
  }
}

const logMul = (tv: number, c: number) => 1 + (tv * getLOG(c)) / 100;
const logAdd = (tv: number, c: number) => tv * getLOG(c);
const logChance = (tv: number, c: number) => (tv * getLOG(c)) / 100;

/** Standard "Talent Value" coefficient kid emitted under a wrapped talent
 *  so the user can see formula(effective_lv) before the counter is applied. */
const tvKid =
  (note = "formula(effective_lv) — per-step coefficient") =>
  (tv: number): CorganNode[] => [
    node("Talent Value", tv, null, { fmt: "raw", note }),
  ];

export const TALENT_FINAL_BONUS_WRAPS: Record<number, TalentWrapSpec> = {
  // ===== Cat 2 — log multiplier (account-wide, fmt "x") =====

  // Tal 178 — King Of The Remembered (Divine Knight).
  // "+% printer output for every POW 10 kills with the rememberance orb".
  178: {
    counterLabel: "Rememberance Orb Kills",
    counterSource: { kind: "OLA", index: 138 },
    counterNote: "OLA[138] — kills with the rememberance orb",
    wrap: logMul,
    fmt: "x",
    noteForActive: (tv, c) => `1 + (${tv.toFixed(2)} × log10(${c})) / 100`,
    inactiveVal: 1,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Rememberance Orb Kills (OLA[138])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 208 — Wraith Overlord (Death Bringer).
  // "+% DMG MULTI for all characters per POW 10 wraith bones collected".
  208: {
    counterLabel: "Wraith Bones Collected",
    counterSource: { kind: "OLA", index: 329 },
    counterNote: "OLA[329] — wraith bones ever collected",
    wrap: logMul,
    fmt: "x",
    noteForActive: (tv, c) => `1 + (${tv.toFixed(2)} × log10(${c})) / 100`,
    inactiveVal: 1,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Wraith Bones (OLA[329])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 328 — Archlord Of The Pirates (Siege Breaker).
  // "+% EXP and Drop Rate per POW 10 kills of Plunderous Mobs".
  328: {
    counterLabel: "Plunderous Kills",
    counterSource: { kind: "OLA", index: 139 },
    counterNote: "OLA[139] — kills of plunderous mobs",
    wrap: logMul,
    fmt: "x",
    noteForActive: (tv, c) => `1 + (${tv.toFixed(2)} × log10(${c})) / 100`,
    inactiveVal: 1,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Plunderous Kills (OLA[139])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 433 — Dustwalker (Wind Walker).
  // "+% Coins dropped by mobs for every POW 10 dust ever collected, for all".
  433: {
    counterLabel: "Dust Collected",
    counterSource: { kind: "OLA", index: 362 },
    counterNote: "OLA[362] — dust ever collected",
    wrap: logMul,
    fmt: "x",
    noteForActive: (tv, c) => `1 + (${tv.toFixed(2)} × log10(${c})) / 100`,
    inactiveVal: 1,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Dust (OLA[362])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 508 — Wormhole Emperor (Elemental Sorcerer).
  // "+% DMG per POW 10 kills of Wormhole Mobs. Applies to all characters!".
  508: {
    counterLabel: "Wormhole Kills",
    counterSource: { kind: "OLA", index: 152 },
    counterNote: "OLA[152] — kills of wormhole mobs",
    wrap: logMul,
    fmt: "x",
    noteForActive: (tv, c) => `1 + (${tv.toFixed(2)} × log10(${c})) / 100`,
    inactiveVal: 1,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Wormhole Kills (OLA[152])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // ===== Cat 2 — log chance (account-wide, fmt "+") =====

  // Tal 598 — Tachyon Truth (Arcane Cultist).
  // "No Bubble Left Behind has a +% chance to give +3 LV per POW 10 Tachyons".
  598: {
    counterLabel: "Tachyons",
    counterSource: { kind: "OLA", index: 394 },
    counterNote: "OLA[394] — tachyons collected",
    wrap: logChance,
    fmt: "+",
    noteForActive: (tv, c) => `(${tv.toFixed(2)} × log10(${c})) / 100 % chance`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Tachyons (OLA[394])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // ===== Cat 2 — log additive (per-char, fmt "+") =====

  // Tal 638 — Dungeonic Damage (Special tab).
  // "+% damage for every power of 10 Dungeon Credits you've earned".
  638: {
    counterLabel: "Dungeon Credits",
    counterSource: { kind: "OLA", index: 71 },
    counterNote: "OLA[71] — dungeon credits earned",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × log10(${c}) % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Dungeon Credits (OLA[71])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 649 — Filthy Damage (Special tab).
  // "+% damage for every power of 10 Garbage you have".
  649: {
    counterLabel: "Garbage",
    counterSource: { kind: "OLA", index: 161 },
    counterNote: "OLA[161] — garbage collected",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × log10(${c}) % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Garbage (OLA[161])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 653 — Dummy Thicc Stats (Special tab).
  // "+% All Stat per POW 10 best DPS ever on the Target Dummy".
  653: {
    counterLabel: "Best Target Dummy DPS",
    counterSource: { kind: "OLA", index: 172 },
    counterNote: "OLA[172] — best DPS ever on the Target Dummy",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × log10(${c}) % all stat`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Target Dummy DPS (OLA[172])" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 365 — Animalistic Ferocity (Beast Master).
  // "+Weapon Power per power of 10 Mob Power of mob in 1st slot of Stored pets".
  365: {
    counterLabel: "Stored Pet Mob Power",
    counterSource: { kind: "PetsStored", row: 0, col: 2 },
    counterNote: "PetsStored[0][2] — mob power of pet in storage slot 0",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × log10(${c}) weapon power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no stored pet in slot 0" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // ===== Cat 2 — log additive, DERIVED counter (per-char, fmt "+") =====
  // Counter computed from the ported stats engine (derived-stats.ts).

  // Tal 86 — Meat Shank (Barbarian).
  // "Damage dealt is increased by {% for every power of 10 Max HP you have".
  86: {
    counterLabel: "Max HP",
    counterSource: { kind: "PlayerHPmax" },
    counterNote: "PlayerHPmax() — active char's computed max HP",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × log10(${c}) % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Max HP is 0" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 446 — Overclocked Energy (Elemental Sorcerer).
  // "Damage dealt is increased by {% for every power of 10 Max MP you have".
  446: {
    counterLabel: "Max MP",
    counterSource: { kind: "PlayerMPmax" },
    counterNote: "PlayerMPmax() — active char's computed max MP",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × log10(${c}) % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Max MP is 0" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient" }),
    ],
  },

  // Tal 202 — Famine O' Fish (Death Bringer).
  // "+% Wraith Crit Chance, +% Wraith Crit DMG per POW 10 Fishing Efficiency".
  202: {
    counterLabel: "Fishing Efficiency",
    counterSource: { kind: "SkillStats", stat: "Fishing" },
    counterNote: "computeSkillEfficiency('Fishing') — active char",
    wrap: logAdd,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × log10(${c}) % wraith crit chance`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Fishing Efficiency is 0" : "Inactive — talent 0",
    extraBaseKids: (tv) => [
      node("Talent Value", tv, null, { fmt: "raw", note: "formula(effective_lv) — coefficient (X bonus)" }),
    ],
  },

  // ===== Cat 3a — linear × external counter (fmt "+") =====
  // (migrated from the old registry; the rest of Cat 3a lands in Onda 2)

  // Tal 655 — Boss Battle Spillover (star talent).
  // final = Per-Skull × Skulls Beaten. Consumed by the DR pipeline.
  655: {
    counterLabel: "Skulls Beaten",
    counterSource: { kind: "OLA", index: 189 },
    counterNote: "OLA[189] — count of skulls beaten",
    wrap: (perSkull, skulls) => perSkull * skulls,
    fmt: "+",
    noteForActive: (perSkull, skulls) =>
      `${perSkull.toFixed(2)} per skull × ${skulls} skulls`,
    inactiveVal: 0,
    inactiveNote: (_perSkull, skulls) =>
      skulls <= 0
        ? "Inactive — no Skulls Beaten (OLA[189])"
        : "Inactive — Per-Skull contribution is 0",
    extraBaseKids: (perSkull) => [
      node("Per Skull", perSkull, null, { fmt: "raw" }),
    ],
  },

  // Tal 58 — Master Of The System (Voidwalker, account-wide).
  // "+% Multikill per tier per 5 maps of Speedrun highscore".
  58: {
    counterLabel: "Speedrun Highscore Maps",
    counterSource: { kind: "OLA", index: 158 },
    counterNote: "OLA[158] — speedrun highscore (maps cleared)",
    wrap: (tv, c) => tv * Math.floor(c / 5),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/5) % multikill`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Speedrun highscore (OLA[158])" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 103 — Tool Proficiency (per-char). "+% more Mining Power per
  // 10 Mining Lvs" — Lv0[1] = mining level.
  103: {
    counterLabel: "Mining Level",
    counterSource: { kind: "Lv0", index: 1 },
    counterNote: "Lv0[1] — mining skill level",
    wrap: (tv, c) => (tv * (c / 10)) / 100,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${c}/10)/100 % mining power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Mining Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 140 — Tough Steaks (per-char). "+Weapon Power for every 10
  // Cooking Lvs" — Lv0[10] = cooking level.
  140: {
    counterLabel: "Cooking Level",
    counterSource: { kind: "Lv0", index: 10 },
    counterNote: "Lv0[10] — cooking skill level",
    wrap: (tv, c) => tv * Math.floor(c / 10),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/10) weapon power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Cooking Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 141 — Charred Skulls (per-char). "+% Kill per Kill per 1000 STR".
  141: {
    counterLabel: "Total STR",
    counterSource: { kind: "TotalStat", stat: "STR" },
    counterNote: "computeTotalStat('STR') — active char",
    wrap: (tv, c) => tv * (c / 1000),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${Math.round(c)}/1000) % kill`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — STR 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 170 — Gamer Strength (per-char). "+Weapon Power for every 10
  // Gaming Lvs" — Lv0[15] = gaming level.
  170: {
    counterLabel: "Gaming Level",
    counterSource: { kind: "Lv0", index: 15 },
    counterNote: "Lv0[15] — gaming skill level",
    wrap: (tv, c) => tv * Math.floor(c / 10),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/10) weapon power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Gaming Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 281 — Acme Anvil (per-char). "+extra Anvil Production Points per
  // 10 Smithing Lvs" — Lv0[2] = smithing level.
  281: {
    counterLabel: "Smithing Level",
    counterSource: { kind: "Lv0", index: 2 },
    counterNote: "Lv0[2] — smithing skill level",
    wrap: (tv, c) => tv * Math.floor(c / 10),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/10) anvil pts`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Smithing Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 320 — Crew Rowing Strength (per-char). "+Weapon Power for every
  // 10 Sailing Lvs" — Lv0[13] = sailing level.
  320: {
    counterLabel: "Sailing Level",
    counterSource: { kind: "Lv0", index: 13 },
    counterNote: "Lv0[13] — sailing skill level",
    wrap: (tv, c) => tv * Math.floor(c / 10),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/10) weapon power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Sailing Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 366 — Stacked Skulls (per-char). "+% Kill per Kill per 1000 AGI".
  366: {
    counterLabel: "Total AGI",
    counterSource: { kind: "TotalStat", stat: "AGI" },
    counterNote: "computeTotalStat('AGI') — active char",
    wrap: (tv, c) => tv * (c / 1000),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${Math.round(c)}/1000) % kill`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — AGI 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 500 — Believer Strength (per-char). "+Weapon Power for every 10
  // Divinity Lvs" — Lv0[14] = divinity level.
  500: {
    counterLabel: "Divinity Level",
    counterSource: { kind: "Lv0", index: 14 },
    counterNote: "Lv0[14] — divinity skill level",
    wrap: (tv, c) => tv * Math.floor(c / 10),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/10) weapon power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Divinity Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 530 — Wired In Power (per-char). "+Weapon Power for every 10
  // Lab Lvs" — Lv0[12] = lab level.
  530: {
    counterLabel: "Lab Level",
    counterSource: { kind: "Lv0", index: 12 },
    counterNote: "Lv0[12] — lab skill level",
    wrap: (tv, c) => tv * Math.floor(c / 10),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/10) weapon power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Lab Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 531 — Memorial Skulls (per-char). "+% Kill per Kill per 1000 WIS".
  531: {
    counterLabel: "Total WIS",
    counterSource: { kind: "TotalStat", stat: "WIS" },
    counterNote: "computeTotalStat('WIS') — active char",
    wrap: (tv, c) => tv * (c / 1000),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${Math.round(c)}/1000) % kill`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — WIS 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // ===== Cat 3a — W6 system upgrade-total counters (fmt "+") =====

  // Tal 200 — Marauder Style. "+% Wraith DMG & Accuracy per 100 Grimoire Upgrades".
  200: {
    counterLabel: "Grimoire Upgrade Total",
    counterSource: { kind: "GrimoireUpgTotal" },
    counterNote: "Σ Grimoire[] — total grimoire upgrade levels",
    wrap: (tv, c) => tv * (c / 100),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${c}/100) % wraith dmg/acc`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Grimoire upgrades" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 201 — Bulwark Style. "+% Wraith Defence & HP per 100 Grimoire Upgrades".
  201: {
    counterLabel: "Grimoire Upgrade Total",
    counterSource: { kind: "GrimoireUpgTotal" },
    counterNote: "Σ Grimoire[] — total grimoire upgrade levels",
    wrap: (tv, c) => tv * (c / 100),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${c}/100) % wraith def/hp`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Grimoire upgrades" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 425 — Windborne. "+% Tempest Defence & Accuracy per 100 Compass Upgrades".
  425: {
    counterLabel: "Compass Upgrade Total",
    counterSource: { kind: "CompassUpgTotal" },
    counterNote: "Σ Compass[] — total compass upgrade levels",
    wrap: (tv, c) => tv * (c / 100),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${c}/100) % tempest def/acc`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Compass upgrades" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 426 — Elemental Mayhem. "+% Tempest Elemental Damage per 100 Compass Upgrades".
  426: {
    counterLabel: "Compass Upgrade Total",
    counterSource: { kind: "CompassUpgTotal" },
    counterNote: "Σ Compass[] — total compass upgrade levels",
    wrap: (tv, c) => tv * (c / 100),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${c}/100) % tempest elem dmg`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Compass upgrades" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 427 — Pumpin' Power. "+% Tempest Crit Hit chance per 25 Breedability".
  427: {
    counterLabel: "Breeds Unlocked (WW)",
    counterSource: { kind: "TotBreedzWWz" },
    counterNote: "count of unlocked breeds across 4 W6 breeding worlds",
    wrap: (tv, c) => tv * Math.floor(c / 25),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/25) % tempest crit`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no breeds unlocked" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 591 — Ghoulish Power. "+% Arcanist Accuracy & Defence per 100 Tesseract Upgrades".
  591: {
    counterLabel: "Arcane Upgrade Total",
    counterSource: { kind: "ArcaneUpgTotal" },
    counterNote: "Σ Arcane[] — total arcane (tesseract) upgrade levels",
    wrap: (tv, c) => tv * (c / 100),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${c}/100) % arcanist acc/def`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Arcane upgrades" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 463 — Choppin It Up EZ. "+% Minigame Rewards & +% Dmg per 25 Pts
  // of Minigame highscore" — FamValMinigameHiscores[0] (chopping minigame).
  463: {
    counterLabel: "Minigame Highscore",
    counterSource: { kind: "MinigameHiscore", index: 0 },
    counterNote: "FamValMinigameHiscores[0] — chopping minigame highscore",
    wrap: (tv, c) => tv * Math.floor(c / 25),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/25) % dmg`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no minigame highscore" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 654 — Monolithialism. "+% MultiKill per unique Onyx Statue you have".
  654: {
    counterLabel: "Onyx Statues Owned",
    counterSource: { kind: "StatueOnyx" },
    counterNote: "count of unique Onyx statues (StatueG[e] >= 2, gated by OLA[69])",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} onyx statues % multikill`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Onyx statues" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 177 — Bitty Litty (account-wide). "+% Bits gained per Gaming LV,
  // no matter which character". Counter = Lv0[15] (gaming level).
  // NOTE: the in-game formula also multiplies by max(1, min(25,
  // GamingPOINGmulti)) — a gaming-system multiplier we don't port here
  // (it affects gaming Bits, not DR). The headline shows the main
  // per-gaming-lv term; the gaming multiplier is omitted.
  177: {
    counterLabel: "Gaming Level",
    counterSource: { kind: "Lv0", index: 15 },
    counterNote: "Lv0[15] — gaming level (× GamingPOINGmulti omitted)",
    wrap: (tv, c) => tv * (c / 100),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × (${c}/100) % bits (×gaming mult omitted)`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Gaming Lv 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 590 — Ghastly Power. "+% Arcanist DMG & Attack Speed per 100
  // Tesseract Upgrades". Base = ArcaneUpgTotal/100/100.
  // NOTE: the in-game formula also multiplies by pow(1.04, ACzWepAtk) ×
  // (1 + tal585/100) × … — Arcanist-weapon/runtime multipliers we don't
  // model here. The headline shows the base per-upgrade term only.
  590: {
    counterLabel: "Arcane Upgrade Total",
    counterSource: { kind: "ArcaneUpgTotal" },
    counterNote: "Σ Arcane[] — total arcane upgrade levels (×pow(1.04,ACzWepAtk) omitted)",
    wrap: (tv, c) => (tv * (c / 100)) / 100,
    fmt: "+",
    noteForActive: (tv, c) =>
      `${tv.toFixed(2)} × (${c}/100)/100 % arcanist dmg (×ACzWepAtk pow omitted)`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Arcane upgrades" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // ===== Cat 3b — CalcTalentMAP-scaled talents =====
  // Counter = CalcTalentMAP[id] (N.js _customBlock_TalentCalc MAP-build).
  // The wrap shape (× / clamp / power / cost-multi) is per-talent, taken
  // verbatim from the N.js `if(<id>==d)return ...` bonus-emission block
  // (offset ~4420700-4425900). r.val passed to the wrap is what
  // GetTalentNumber(1,id) returns (per-char) or getbonus2(1,id,-1)
  // returns (account-wide) — talent.resolve auto-selects max mode for the
  // account-wide ids (57, 59, 209, 430, 595), so r.val already matches.

  // Tal 31 — Skillage Damage (Voidwalker, per-char).
  // N.js: GetTalentNumber(1,31) × floor(CalcTalentMAP[31]/5).
  // CalcTalentMAP[31] = lowest of the active char's 9 skill levels.
  // NOTE: the wrap is × floor(counter/5), NOT a bare × counter.
  31: {
    counterLabel: "Lowest Skill LV",
    counterSource: { kind: "CalcTalent", talentId: 31 },
    counterNote: "CalcTalentMAP[31] — min(Lv0[1..9]) lowest skill level",
    wrap: (tv, c) => tv * Math.floor(c / 5),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/5) % dmg`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — lowest skill LV is 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 57 — Species Epoch (Voidwalker, account-wide).
  // N.js: getbonus2(1,57,-1) × CalcTalentMAP[57].
  // CalcTalentMAP[57] = max(0, best(Trapping+Worship LV across chars) - 100).
  57: {
    counterLabel: "Trapping+Worship LV over 100",
    counterSource: { kind: "CalcTalent", talentId: 57 },
    counterNote:
      "CalcTalentMAP[57] — max(0, best(Lv0[7]+Lv0[9]) - 100) across chars",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) =>
      `${tv.toFixed(2)} × ${c} % critters & souls`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — combined Trapping+Worship <= 100" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 59 — Blood Marrow (Voidwalker, account-wide). POWER form.
  // N.js: pow(min(1.012, 1 + talVal/100), CalcTalentMAP[59]).
  // CalcTalentMAP[59] = Σ Meals[0][*] (total LV of all upgraded meals).
  59: {
    counterLabel: "Total Meal LV",
    counterSource: { kind: "CalcTalent", talentId: 59 },
    counterNote: "CalcTalentMAP[59] — Σ Meals[0][*] (all meal upgrade levels)",
    wrap: (tv, c) => Math.pow(Math.min(1.012, 1 + tv / 100), c),
    fmt: "x",
    noteForActive: (tv, c) =>
      `pow(min(1.012, 1 + ${tv.toFixed(2)}/100), ${c}) meal spd`,
    inactiveVal: 1,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Meal LV (Σ = 0) → pow(..,0) = 1" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 110 — Apocalypse Zow (Death Bringer, per-char).
  // N.js: GetTalentNumber(1,110) × CalcTalentMAP[110].
  // [STUB COUNTER] CalcTalentMAP[110] = mob types killed >100k — needs the
  // rift kill-tracker (unported), so the counter is 0 → emits inactive.
  110: {
    counterLabel: "Mob Types Killed >100k",
    counterSource: { kind: "CalcTalent", talentId: 110 },
    counterNote: "CalcTalentMAP[110] — [STUB] rift kill-tracker unported (0)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % dmg`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — counter stubbed (rift kill-tracker unported)" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 125 — Precision Power (per-char).
  // N.js: GetTalentNumber(1,125) × CalcTalentMAP[125].
  // CalcTalentMAP[125] = Σ Refinery ranks IF the active char's accuracy is
  // >= 2.25× the AFK target's defence, else 0.
  // [STUB COUNTER] the accuracy gate is unported → counter is 0 → inactive.
  125: {
    counterLabel: "Refinery Ranks (acc-gated)",
    counterSource: { kind: "CalcTalent", talentId: 125 },
    counterNote: "CalcTalentMAP[125] — [STUB] accuracy gate unported (0)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % dmg`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — counter stubbed (accuracy gate unported)" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 146 — Apocalypse Chow (Death Bringer, per-char).
  // N.js: GetTalentNumber(1,146) × CalcTalentMAP[146].
  // [STUB COUNTER] CalcTalentMAP[146] = mob types killed >1m — rift
  // kill-tracker unported → counter 0 → inactive.
  146: {
    counterLabel: "Mob Types Killed >1m",
    counterSource: { kind: "CalcTalent", talentId: 146 },
    counterNote: "CalcTalentMAP[146] — [STUB] rift kill-tracker unported (0)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % cooking exp & eff`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — counter stubbed (rift kill-tracker unported)" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 209 — Apocalypse Wow (Death Bringer, account-wide).
  // N.js: GetTalentNumber(1,209) × CalcTalentMAP[209] (account-wide via
  // the DK char's kill tracker; talent.resolve emits max for id 209).
  // [STUB COUNTER] mob types killed >1b — rift kill-tracker unported → 0.
  209: {
    counterLabel: "Mob Types Killed >1b",
    counterSource: { kind: "CalcTalent", talentId: 209 },
    counterNote: "CalcTalentMAP[209] — [STUB] rift kill-tracker unported (0)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % gold food effect`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — counter stubbed (rift kill-tracker unported)" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 305 — Looty Mc Shooty (per-char).
  // N.js: GetTalentNumber(1,305) × CalcTalentMAP[305].
  // CalcTalentMAP[305] = items ever found (Cards[1] minus Gem/Cards entries).
  305: {
    counterLabel: "Items Ever Found",
    counterSource: { kind: "CalcTalent", talentId: 305 },
    counterNote:
      "CalcTalentMAP[305] — count of Cards[1] entries (excl. Gem*/Cards*)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no items found" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 430 — Price Recession (Wind Walker, account-wide). floor(/10) form.
  // N.js: GetTalentNumber(1,430) × floor(CalcTalentMAP[430]/10)
  //   (or getbonus2(1,430,-1) × floor(.../10) when GTN=0).
  // CalcTalentMAP[430] = Σ Ninja[103][*] (total Ninja Knowledge upgrades).
  430: {
    counterLabel: "Total Ninja Upgrades",
    counterSource: { kind: "CalcTalent", talentId: 430 },
    counterNote: "CalcTalentMAP[430] — Σ Ninja[103][*] (Ninja Knowledge upg)",
    wrap: (tv, c) => tv * Math.floor(c / 10),
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × floor(${c}/10) % cheaper`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Ninja upgrades" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 470 — Paperwork, Great... (per-char).
  // N.js: GetTalentNumber(1,470) × CalcTalentMAP[470].
  // CalcTalentMAP[470] = stamps in collection (StampLevelMAX>0.5).
  // [PROXY COUNTER] we count StampLv>0 (raw save lacks StampLevelMAX).
  470: {
    counterLabel: "Stamps In Collection",
    counterSource: { kind: "CalcTalent", talentId: 470 },
    counterNote:
      "CalcTalentMAP[470] — [PROXY] count StampLv>0 (StampLevelMAX unported)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no stamps" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 485 — Virile Vials (per-char).
  // N.js: GetTalentNumber(1,485) × CalcTalentMAP[485].
  // CalcTalentMAP[485] = count of CauldronInfo[4][*] > 3 (vials >= Green LV).
  485: {
    counterLabel: "Vials >= Green LV",
    counterSource: { kind: "CalcTalent", talentId: 485 },
    counterNote: "CalcTalentMAP[485] — count CauldronInfo[4][*] > 3",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Green+ vials" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 595 — Essential Essence (Arcane Cultist, account-wide). COST MULTI.
  // N.js cost path: 1 / (1 + getbonus2(1,595,-1) × floor(MAP[595]/100)/100).
  // N.js tooltip headline (the "x_Cheaper_Upgrades" display):
  //   1 + 0.01 × GetTalentNumber(1,595) × floor(CalcTalentMAP[595]/100).
  // We emit the tooltip/headline form (a cheapness multiplier).
  // CalcTalentMAP[595] = Σ Summon[0][*] (total Summoning upgrades).
  595: {
    counterLabel: "Total Summoning Upgrades",
    counterSource: { kind: "CalcTalent", talentId: 595 },
    counterNote: "CalcTalentMAP[595] — Σ Summon[0][*] (summoning upgrades)",
    wrap: (tv, c) => 1 + (0.01 * tv * Math.floor(c / 100)),
    fmt: "x",
    noteForActive: (tv, c) =>
      `1 + 0.01 × ${tv.toFixed(2)} × floor(${c}/100) cheaper upgrades`,
    inactiveVal: 1,
    inactiveNote: (_tv, c) =>
      c < 100 ? "Inactive — < 100 Summoning upgrades (floor = 0)" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 616 — Beginner Best Class (per-char). CLAMP form.
  // N.js: min(GetTalentNumber(1,616), floor(CalcTalentMAP[616]/10)).
  // CalcTalentMAP[616] = best Beginner (class<6) char level (Lv0[0]).
  616: {
    counterLabel: "Best Beginner Lv",
    counterSource: { kind: "CalcTalent", talentId: 616 },
    counterNote: "CalcTalentMAP[616] — best Lv0[0] across class<6 chars",
    wrap: (tv, c) => Math.min(tv, Math.floor(c / 10)),
    fmt: "+",
    noteForActive: (tv, c) =>
      `min(${tv.toFixed(2)}, floor(${c}/10)) weapon power`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c < 10 ? "Inactive — best Beginner < Lv 10 (floor = 0)" : "Inactive — talent 0",
    extraBaseKids: tvKid("formula(effective_lv) — the +N cap coefficient"),
  },

  // Tal 620 — Will Of The Eldest (per-char). CLAMP form.
  // N.js: min(GetTalentNumber(1,620), floor(CalcTalentMAP[620]/10)).
  // CalcTalentMAP[620] = highest char level (Lv0[0]) across ALL chars.
  620: {
    counterLabel: "Highest Char Lv",
    counterSource: { kind: "CalcTalent", talentId: 620 },
    counterNote: "CalcTalentMAP[620] — best Lv0[0] across all chars",
    wrap: (tv, c) => Math.min(tv, Math.floor(c / 10)),
    fmt: "+",
    noteForActive: (tv, c) =>
      `min(${tv.toFixed(2)}, floor(${c}/10)) all stats`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c < 10 ? "Inactive — highest char < Lv 10 (floor = 0)" : "Inactive — talent 0",
    extraBaseKids: tvKid("formula(effective_lv) — the +N cap coefficient"),
  },

  // Tal 643 — Coins For Charon (per-char).
  // N.js: GetTalentNumber(1,643) × CalcTalentMAP[643].
  // CalcTalentMAP[643] = OverkillStuffs("2") = multikill damage tier.
  // [STUB COUNTER] overkill-tier sim unported → counter 0 → inactive.
  643: {
    counterLabel: "Multikill Damage Tier",
    counterSource: { kind: "CalcTalent", talentId: 643 },
    counterNote: "CalcTalentMAP[643] — [STUB] OverkillStuffs(\"2\") unported (0)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % cash per tier`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — counter stubbed (multikill tier unported)" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 644 — American Tipper (per-char).
  // N.js: GetTalentNumber(1,644) × CalcTalentMAP[644].
  // CalcTalentMAP[644] = active char's Cooking LV / 10 (continuous, not floored).
  644: {
    counterLabel: "Cooking LV / 10",
    counterSource: { kind: "CalcTalent", talentId: 644 },
    counterNote: "CalcTalentMAP[644] — Lv0[10]/10 (active char cooking / 10)",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % cash`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — Cooking LV 0" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 650 — Rando Event Looty (account-wide).
  // N.js: GetTalentNumber(1,650) × CalcTalentMAP[650].
  // CalcTalentMAP[650] = count of Random-Event rare items found
  // (Cards[1] matching RANDOlist[82..86]).
  650: {
    counterLabel: "Random Event Rare Items",
    counterSource: { kind: "CalcTalent", talentId: 650 },
    counterNote:
      "CalcTalentMAP[650] — Cards[1] matches of RANDOlist[82..86]",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % AFK gains rate`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Random Event rares found" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },

  // Tal 656 — Dreamer Damage (account-wide).
  // N.js: GetTalentNumber(1,656) × CalcTalentMAP[656].
  // CalcTalentMAP[656] = count of completed Equinox Dream clouds
  // (DreamChallenge entries with WeeklyBoss["d_"+g] === -1).
  656: {
    counterLabel: "Dream Clouds Completed",
    counterSource: { kind: "CalcTalent", talentId: 656 },
    counterNote:
      "CalcTalentMAP[656] — count DreamChallenge with WeeklyBoss[d_g]===-1",
    wrap: (tv, c) => tv * c,
    fmt: "+",
    noteForActive: (tv, c) => `${tv.toFixed(2)} × ${c} % damage`,
    inactiveVal: 0,
    inactiveNote: (_tv, c) =>
      c <= 0 ? "Inactive — no Dream clouds completed" : "Inactive — talent 0",
    extraBaseKids: tvKid(),
  },
};

/** Convenience: true if the talent has a final-bonus wrap. */
export function hasTalentWrap(talentId: number): boolean {
  return talentId in TALENT_FINAL_BONUS_WRAPS;
}

/** Apply a talent's final-bonus wrap. Returns the wrapped node (headline =
 *  final bonus) with the talent's base kids + the counter as kids, or null
 *  when the talent has no wrap. Emits the inactive shape when raw<=0 or
 *  counter<=0 (or the counter isn't ported yet). */
export function applyTalentWrap(
  talentId: number,
  rawTalentVal: number,
  baseKids: CorganNode[],
  talentName: string,
  saveData: SaveData,
  charIdx: number
): CorganNode | null {
  const spec = TALENT_FINAL_BONUS_WRAPS[talentId];
  if (!spec) return null;
  const counter = readCounter(spec.counterSource, saveData, charIdx);
  const extraKids = spec.extraBaseKids ? spec.extraBaseKids(rawTalentVal) : [];
  const counterKid = node(spec.counterLabel, counter, null, {
    fmt: "raw",
    note: spec.counterNote,
  });
  const active = rawTalentVal > 0 && counter > 0;
  if (active) {
    return node(talentName, spec.wrap(rawTalentVal, counter), [...baseKids, ...extraKids, counterKid], {
      fmt: spec.fmt,
      note: spec.noteForActive(rawTalentVal, counter),
    });
  }
  return node(talentName, spec.inactiveVal, [...baseKids, ...extraKids, counterKid], {
    fmt: spec.fmt,
    note: spec.inactiveNote(rawTalentVal, counter),
  });
}
