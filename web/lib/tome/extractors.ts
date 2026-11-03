// All raw*() extractor functions, ported 1:1 from Code_TomeRaw_v6_1.gs v7.9.
// Each function pulls a single number out of the IT save object. Returns null
// if the relevant fields are missing or malformed (matches the .gs behavior).

import { arrSum, arrMax, lavaLog, type RawObj } from "./math";
import { CARDS_PER_TIER, DEATHNOTE_MOB_IDX, DUNGEON_LEVELS } from "./tasks";
import { computeCardLv } from "../arkh/stats/systems/common/cards";
import { loadSaveData } from "../arkh/save/loader";
import { saveData as engineSave } from "../arkh/state";
import { talent } from "../arkh/stats/systems/common/talent";
import { computeFamBonusQTYs } from "../arkh/stats/systems/common/stats";
import { stamp } from "../arkh/stats/systems/w1/stamp";
import { guild } from "../arkh/stats/systems/common/guild";
import { flurboShop } from "../arkh/stats/systems/coin/flurbo";
import { sigil } from "../arkh/stats/systems/w2/alchemy";
import { achieveStatus } from "../arkh/stats/systems/common/achievement";
import { computeShinyBonusS } from "../arkh/stats/systems/w4/breeding";
import { getBribeBonus } from "../arkh/stats/systems/w3/bribe";
import { fractalIslandBonus } from "../arkh/stats/systems/artifact/terms";
import { vaultUpgBonus } from "../arkh/stats/systems/common/vault";
import { companions } from "../arkh/stats/systems/common/companions";
import { CardStuff, DeathNoteMobs, PetStats } from "../arkh/stats/data/game/customlists.js";
import { menagerieUnlockOwned } from "../arkh/stats/data/w7/menagerie";
import type { SaveData } from "../arkh/state";

type D = RawObj;

function num(v: unknown): number {
  return Number(v) || 0;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

// Number of characters on the account. The game now allows more than 10
// characters; several tome quantities sum/scan per-character data
// (Lv0_N, QuestComplete_N, SL_/SM_N, KLA_N, CharacterClass_N). A hardcoded
// 10-char loop silently DROPS the 11th+ character — e.g. its level (Account
// LV) and skill levels (Account Skills LV). Detect the real count from the
// highest present Lv0_N (every char has one), with a charNames fallback.
// Over-counting is harmless: every per-char loop already guards missing keys.
function charCount(d: D): number {
  let n = 0;
  for (let i = 0; i < 24; i++) if (Array.isArray(d["Lv0_" + i])) n = i + 1;
  if (n > 0) return n;
  const names = (d as { charNames?: unknown }).charNames;
  return Array.isArray(names) && names.length > 0 ? names.length : 10;
}

// ---------------------------------------------------------------- account / chars

export function rawAccountLevel(d: D): number | null {
  let t = 0;
  let f = false;
  for (let i = 0; i < charCount(d); i++) {
    const lv = d["Lv0_" + i];
    if (Array.isArray(lv) && lv[0] !== undefined) {
      t += num(lv[0]);
      f = true;
    }
  }
  return f ? t : null;
}

export function rawAchievements(d: D): number | null {
  const a = d.AchieveReg;
  if (!Array.isArray(a)) return null;
  let c = 0;
  for (let i = 0; i < a.length; i++) if (num(a[i]) === -1) c++;
  return c;
}

export function rawUniqueQuests(d: D): number | null {
  const s: Record<string, boolean> = {};
  let c = 0;
  for (let i = 0; i < charCount(d); i++) {
    const qc = obj(d["QuestComplete_" + i]);
    if (!qc) continue;
    for (const k of Object.keys(qc)) {
      if (num(qc[k]) === 1 && !s[k]) {
        s[k] = true;
        c++;
      }
    }
  }
  return c > 0 ? c : null;
}

export function rawStatues(d: D): number | null {
  const sl = d.StatueLevels_0;
  if (!Array.isArray(sl)) return null;
  let t = 0;
  for (let i = 0; i < sl.length; i++) {
    const row = sl[i];
    if (Array.isArray(row)) t += num(row[0]);
    else t += num(row);
  }
  return t;
}

export function rawOnyxStatues(d: D): number | null {
  const sg = d.StuG;
  if (!Array.isArray(sg)) return null;
  let c = 0;
  for (let i = 0; i < sg.length; i++) if (num(sg[i]) >= 2) c++;
  return c;
}

// ---------------------------------------------------------------- coliseum / farms

export function rawColoScore(d: D): number | null {
  const c = d.FamValColosseumHighscores;
  if (!Array.isArray(c)) return null;
  return arrSum(c);
}

export function rawCropsDiscovered(d: D): number | null {
  const fc = obj(d.FarmCrop);
  return fc ? Object.keys(fc).length : null;
}

export function rawLandRank(d: D): number | null {
  if (!Array.isArray(d.FarmRank) || !Array.isArray(d.FarmRank[0])) return null;
  return arrSum(d.FarmRank[0]);
}

// ---------------------------------------------------------------- arcade / summon

export function rawArcade(d: D): number | null {
  return d.ArcadeUpg ? arrSum(d.ArcadeUpg) : null;
}

export function rawSummoningUpg(d: D): number | null {
  if (!Array.isArray(d.Summon) || !Array.isArray(d.Summon[0])) return null;
  return arrSum(d.Summon[0]);
}

export function rawResearch(d: D): number | null {
  if (!Array.isArray(d.Research) || !Array.isArray(d.Research[0])) return null;
  return arrSum(d.Research[0]);
}

// ---------------------------------------------------------------- stamps / tasks / meals

// TomeQTY[0] is the stamp page's TOTAL_LV (N.js stamp actor init, GenINFO[106]):
// Σ StampLevel[tab][i] over the three stamp tabs. A tab can arrive as a
// {i: lv, length: n} object; only its numeric keys are stamps.
export function rawStamps(d: D): number | null {
  const sl = d.StampLv;
  if (!Array.isArray(sl)) return null;
  let t = 0;
  for (let tab = 0; tab < 3; tab++) {
    const row = sl[tab];
    if (!row || typeof row !== "object") continue;
    for (const k of Object.keys(row)) {
      if (!isNaN(Number(k))) t += num((row as Record<string, unknown>)[k]);
    }
  }
  return t;
}

export function rawTotalTasks(d: D): number | null {
  const tz = d.TaskZZ1;
  if (!Array.isArray(tz)) return null;
  let t = 0;
  for (let i = 0; i < tz.length; i++) {
    const row = tz[i];
    if (Array.isArray(row)) {
      for (let j = 0; j < Math.min(8, row.length); j++) t += num(row[j]);
    }
  }
  return t;
}

export function rawMeals(d: D): number | null {
  if (!Array.isArray(d.Meals) || !Array.isArray(d.Meals[0])) return null;
  return arrSum(d.Meals[0]);
}

// ---------------------------------------------------------------- constellations / cards

export function rawConstellations(d: D): number | null {
  let sp: unknown = d.SSprog;
  if (!sp) return null;
  if (typeof sp === "string") {
    try {
      sp = JSON.parse(sp);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(sp)) return null;
  let s = 0;
  for (let i = 0; i < sp.length; i++) {
    const row = sp[i];
    if (Array.isArray(row) && row.length > 1) s += num(row[1]);
  }
  return s;
}

export function rawLootyCount(d: D, p: string): number | null {
  const c1 = d.Cards1;
  if (!Array.isArray(c1)) return null;
  let c = 0;
  for (let i = 0; i < c1.length; i++) {
    if (String(c1[i] || "").indexOf(p) !== -1) c++;
  }
  return c;
}

export function rawItemsFound(d: D): number | null {
  return Array.isArray(d.Cards1) ? d.Cards1.length : null;
}

export function rawCardsTotalLv(d: D): number | null {
  const c = obj(d.Cards0);
  if (!c) return null;
  const k = Object.keys(c);
  return k.length > 0 ? k.length : null;
}

// ---------------------------------------------------------------- hats / spelunk / mega

export function rawHatsTotal(d: D): number | null {
  if (!Array.isArray(d.Spelunk)) return null;
  const sp = d.Spelunk as unknown[];
  const slot = sp[46];
  if (!Array.isArray(slot)) return null;
  return slot.length;
}

export function rawMegaflesh(d: D): number | null {
  const b = d.Bubba;
  if (
    Array.isArray(b) &&
    Array.isArray(b[1]) &&
    (b[1] as unknown[]).length > 8
  ) {
    return Number((b[1] as unknown[])[8]);
  }
  return null;
}

export function rawHoles(d: D): unknown[] {
  return Array.isArray(d.Holes) ? d.Holes : [];
}

export function rawExtraCalc(d: D, i: number): number | null {
  const h = rawHoles(d);
  const row = h[11];
  if (Array.isArray(row) && row[i] !== undefined) return Number(row[i]);
  return null;
}

export function rawHolesSum(d: D, i: number): number | null {
  const h = rawHoles(d);
  if (Array.isArray(h[i])) return arrSum(h[i]);
  return null;
}

export function rawSpelunk(d: D): unknown[] {
  return Array.isArray(d.Spelunk) ? d.Spelunk : [];
}

export function rawSpelunkDiscoveries(d: D): number | null {
  const s = rawSpelunk(d);
  return Array.isArray(s[6]) ? (s[6] as unknown[]).length : null;
}

export function rawBestCave(d: D): number | null {
  const s = rawSpelunk(d);
  return Array.isArray(s[1]) ? arrMax(s[1]) : null;
}

export function rawSpelunkUpgrades(d: D): number | null {
  const s = rawSpelunk(d);
  if (!Array.isArray(s[5])) return null;
  const row = s[5] as unknown[];
  let sum = 0;
  for (let i = 0; i < row.length; i++) sum += Math.max(0, num(row[i]));
  return sum;
}

// ---------------------------------------------------------------- research / captains

export function rawRatKingCrowns(d: D): number | null {
  const r = d.Research;
  if (Array.isArray(r) && Array.isArray((r as unknown[])[11])) {
    return ((r as unknown[])[11] as unknown[]).length;
  }
  return null;
}

export function rawCaptainMaxLv(d: D): number | null {
  const c = d.Captains;
  if (!Array.isArray(c)) return null;
  let m = 0;
  for (let i = 0; i < c.length; i++) {
    const row = c[i];
    if (Array.isArray(row) && row[0] !== -1 && row.length >= 4) {
      const v = num(row[3]);
      if (v > m) m = v;
    }
  }
  return m;
}

export function rawFamiliars(d: D): number | null {
  const s = d.Summon;
  if (
    !Array.isArray(s) ||
    !Array.isArray((s as unknown[])[4])
  ) return null;
  const arr4 = (s as unknown[])[4] as unknown[];
  let fo = 0;
  let mult = 1;
  for (let i = 0; i < arr4.length; i++) {
    fo += mult * num(arr4[i]);
    mult *= i + 3;
  }
  return fo;
}

// ---------------------------------------------------------------- cooking / ninja / tower

export function rawKitchenLevels(d: D): number | null {
  const ck = d.Cooking;
  if (!Array.isArray(ck)) return null;
  let s = 0;
  for (let i = 0; i < ck.length; i++) {
    const row = ck[i];
    if (Array.isArray(row) && row.length > 8) {
      s += num(row[6]) + num(row[7]) + num(row[8]);
    }
  }
  return s;
}

export function rawNinja(d: D): unknown[] {
  return Array.isArray(d.Ninja) ? d.Ninja : [];
}

export function rawNinjaUpgrades(d: D): number | null {
  const n = rawNinja(d);
  if (Array.isArray(n[103])) return arrSum(n[103]);
  return null;
}

export function rawBeanstalk(d: D): number | null {
  const n = rawNinja(d);
  if (Array.isArray(n[104])) return arrSum(n[104]);
  return null;
}

export function rawJadeEmporium(d: D): number | null {
  const n = rawNinja(d);
  if (Array.isArray(n[102]) && typeof (n[102] as unknown[])[9] === "string") {
    return ((n[102] as unknown[])[9] as string).length;
  }
  return null;
}

export function rawTowerSum(d: D): number | null {
  const t = d.Tower;
  if (!Array.isArray(t)) return null;
  let s = 0;
  for (let i = 0; i < Math.min(27, t.length); i++) {
    const v = Number(t[i]);
    if (!Number.isNaN(v) && v < 1e6) s += Math.max(0, v);
  }
  return s;
}

// TomeQTY[75]: FamilyValuesMap.MinigameHiscores[0..3] + OptionsListAccount[99].
export function rawMinigameScore(d: D): number | null {
  const m = d.FamValMinigameHiscores;
  if (!Array.isArray(m)) return null;
  let s = num(arr(d.OptLacc)[99]);
  for (let i = 0; i < 4; i++) s += num(m[i]);
  return s;
}

export function rawSummoningStones(d: D): number | null {
  const s = d.Summon;
  if (!Array.isArray(s) || !Array.isArray((s as unknown[])[3])) return null;
  return arrSum((s as unknown[])[3]);
}

// ---------------------------------------------------------------- farming / boats / sail

// TomeQTY[112] = FarmingStuffs("TotalStickers"): Σ Research[9].
// @njs TotalStickers
export function rawFarmingStickers(d: D): number | null {
  if (!Array.isArray(d.Research) || !Array.isArray((d.Research as unknown[])[9])) return null;
  return arrSum((d.Research as unknown[])[9]);
}

export function rawBoatsLevel(d: D): number | null {
  const b = d.Boats;
  if (!Array.isArray(b)) return null;
  let s = 0;
  for (let i = 0; i < b.length; i++) {
    const row = b[i];
    if (Array.isArray(row) && num(row[3]) > 0 && row.length > 5) {
      s += num(row[3]) + num(row[5]);
    }
  }
  return s;
}

export function rawArtifacts(d: D): number | null {
  const s = d.Sailing;
  if (!Array.isArray(s) || !Array.isArray((s as unknown[])[3])) return null;
  return arrSum((s as unknown[])[3]);
}

export function rawLabChips(d: D): number | null {
  const l = d.Lab;
  if (!Array.isArray(l) || !Array.isArray((l as unknown[])[15])) return null;
  const row = (l as unknown[])[15] as unknown[];
  let s = 0;
  for (let i = 0; i < row.length; i++) s += Math.max(0, num(row[i]));
  return s;
}

export function rawStorageCritter(d: D): number | null {
  const co = d.ChestOrder;
  const cq = d.ChestQuantity;
  if (!Array.isArray(co) || !Array.isArray(cq)) return null;
  for (let i = 0; i < co.length; i++) {
    if (co[i] === "Critter11A") return num(cq[i]);
  }
  return 0;
}

// ---------------------------------------------------------------- cauldron / sigils / equinox

export function rawSigils(d: D): number | null {
  const cp = d.CauldronP2W;
  if (!Array.isArray(cp) || !Array.isArray((cp as unknown[])[4])) return null;
  const sd = (cp as unknown[])[4] as unknown[];
  let t = 0;
  for (let i = 0; i < sd.length; i += 2) {
    const un = sd[i + 1] !== undefined ? Number(sd[i + 1]) : 0;
    t += un + 1;
  }
  return t;
}

export function rawEquinoxClouds(d: D): number | null {
  const wb = obj(d.WeeklyBoss);
  if (!wb) return null;
  let c = 0;
  for (const k of Object.keys(wb)) {
    if (k.indexOf("d_") === 0 && num(wb[k]) === -1) c++;
  }
  return c;
}

export function rawSkillsLevels(d: D): number | null {
  let t = 0;
  for (let c = 0; c < charCount(d); c++) {
    const lv = d["Lv0_" + c];
    if (Array.isArray(lv)) {
      for (let i = 1; i <= 20 && i < lv.length; i++) t += num(lv[i]);
    }
  }
  return t > 0 ? t : null;
}

export function rawPrayers(d: D): number | null {
  const p = d.PrayOwned;
  if (!Array.isArray(p)) return null;
  let s = 0;
  for (let i = 0; i < Math.min(19, p.length); i++) s += num(p[i]);
  return s;
}

export function rawTalentMaxLevel(d: D): number | null {
  const mx: Record<string, number> = {};
  const srcs = ["SL_", "SM_"];
  for (let c = 0; c < charCount(d); c++) {
    for (let si = 0; si < srcs.length; si++) {
      const sl = obj(d[srcs[si] + c]);
      if (!sl) continue;
      for (const k of Object.keys(sl)) {
        const v = num(sl[k]);
        if (!mx[k] || v > mx[k]) mx[k] = v;
      }
    }
  }
  let t = 0;
  for (const k of Object.keys(mx)) t += mx[k];
  return t > 0 ? t : null;
}

// ---------------------------------------------------------------- deathnote / dungeon / star

export function rawDeathNoteDigits(d: D): number | null {
  const all: Record<number, number> = {};
  for (let c = 0; c < charCount(d); c++) {
    const k = d["KLA_" + c];
    if (!Array.isArray(k)) continue;
    for (let i = 0; i < k.length; i++) {
      const v = k[i];
      let kl = 0;
      if (Array.isArray(v) && v.length > 0) kl = Math.abs(num(v[0]));
      else if (typeof v === "number") kl = Math.abs(v);
      if (kl > 0) all[i] = (all[i] || 0) + kl;
    }
  }
  let dg = 0;
  for (const k of Object.keys(all)) {
    const x = all[Number(k)];
    if (x > 0) dg += Math.ceil(Math.log(x) / Math.LN10);
  }
  return dg > 0 ? dg : null;
}

// N.js (ActorEvents_498 → GenINFO[12] → TomeQTY[17]): rank starts at 1 and
// becomes the FIRST index b whose threshold exceeds the points:
//   for b in 0..len: if OptLacc[71] < RANDOlist[29][b] { rank = b; break }
// Equivalent to "one past the last threshold reached", including at exact
// equality (points == threshold counts as reached). IdleonToolbox uses "last
// index strictly exceeded", which is one rank LOW vs the game (ARKHE: game
// 75, IT 74). Past every threshold (> 1e16, unreachable) the game keeps 1;
// we return the table length instead of that artefact.
export function rawDungeonRank(d: D): number | null {
  const opt = arr(d.OptLacc);
  const p = opt[71];
  if (p === undefined || p === null) return null;
  const points = Number(p);
  for (let b = 0; b < DUNGEON_LEVELS.length; b++) {
    if (points < DUNGEON_LEVELS[b]) return b;
  }
  return DUNGEON_LEVELS.length;
}

export function rawStarTalents(d: D): number | null {
  const opt = arr(d.OptLacc);
  const v = opt[61];
  return v !== undefined && v !== null ? Math.ceil(Number(v)) : null;
}

// ---------------------------------------------------------------- cauldron LVs / refinery / god

export function rawBubbleTotalLv(d: D): number | null {
  if (!d.CauldronInfo) return null;
  const ci = d.CauldronInfo as unknown[];
  let t = 0;
  for (let i = 0; i < 4 && i < ci.length; i++) {
    const c = obj(ci[i]);
    if (!c) continue;
    // CauldronInfo[i] can deserialize as a {slot: lv, length: N} dict (save
    // envelope artifact) — skip "length" so it isn't summed as a bogus extra
    // bubble level. N.js sums a real array (`for i < CauldronInfo[i].length`);
    // .length is only ever read once as the loop bound.
    for (const k of Object.keys(c)) {
      if (isNaN(Number(k))) continue;
      t += num(c[k]);
    }
  }
  return t > 0 ? t : null;
}

export function rawVialTotalLv(d: D): number | null {
  if (!d.CauldronInfo) return null;
  const v = (d.CauldronInfo as unknown[])[4];
  const c = obj(v);
  if (!c) return null;
  let t = 0;
  // Same "length" envelope artifact as rawBubbleTotalLv above — N.js sums a
  // real array (`for i < CauldronInfo[4].length`), never the .length itself.
  for (const k of Object.keys(c)) {
    if (isNaN(Number(k))) continue;
    t += num(c[k]);
  }
  return t > 0 ? t : null;
}

export function rawRefineryRank(d: D): number | null {
  if (!Array.isArray(d.Refinery) || !Array.isArray((d.Refinery as unknown[])[0])) {
    return null;
  }
  const ref = d.Refinery as unknown[];
  const n = Math.min(6, num((ref[0] as unknown[])[0]));
  let r = 0;
  for (let i = 0; i < n; i++) {
    const s = ref[3 + i];
    if (Array.isArray(s)) r += num(s[1]);
  }
  return r > 0 ? r : null;
}

export function rawGodRank(d: D): number | null {
  if (!Array.isArray(d.Divinity) || (d.Divinity as unknown[])[25] === undefined) {
    return null;
  }
  const v = num((d.Divinity as unknown[])[25]) - 10;
  return Math.max(0, v);
}

// ---------------------------------------------------------------- v7.9 extras

export function rawWorshipWaves(d: D): number | null {
  if (!Array.isArray(d.TotemInfo) || !Array.isArray((d.TotemInfo as unknown[])[0])) {
    return null;
  }
  return arrSum((d.TotemInfo as unknown[])[0]);
}

export function rawHoleOpals(d: D): number | null {
  if (!Array.isArray(d.Holes) || !Array.isArray((d.Holes as unknown[])[7])) {
    return null;
  }
  return arrSum((d.Holes as unknown[])[7]);
}

export function rawHoleLayers(d: D): number | null {
  if (!Array.isArray(d.Holes) || !Array.isArray((d.Holes as unknown[])[11])) {
    return null;
  }
  const ec = (d.Holes as unknown[])[11] as unknown[];
  let s = 0;
  for (const i of [1, 3, 5, 7]) s += Math.round(Math.max(0, num(ec[i])));
  return s;
}

export function rawGambitTime(d: D): number | null {
  if (!Array.isArray(d.Holes) || !Array.isArray((d.Holes as unknown[])[11])) {
    return null;
  }
  const sl = ((d.Holes as unknown[])[11] as unknown[]).slice(65, 71);
  let s = 0;
  for (let i = 0; i < sl.length; i++) s += num(sl[i]);
  return Math.round(s);
}

export function rawCareerSummWins(d: D): number | null {
  // N.js summoning scene (_GenINFO[143][9], read by TomeQTY[71]): each won
  // battle in Summon[1] counts as a white battle when it starts with "Pet",
  // else once per DeathNoteMobs world row holding it (slots 1–8; rift and
  // mini-boss fights are in neither), + OptLacc[319] endless wins.
  // @njs DeathNoteMobs
  if (!d.Summon || !Array.isArray((d.Summon as unknown[])[1])) return null;
  const worlds = (DeathNoteMobs as unknown as string[][]).slice(0, 8);
  let wins = 0;
  for (const raw of (d.Summon as unknown[])[1] as unknown[]) {
    const id = String(raw);
    if (id.indexOf("Pet") === 0) wins++;
    else for (const mobs of worlds) if (mobs.includes(id)) wins++;
  }
  return Math.round(wins + num(arr(d.OptLacc)[319]));
}

// Pets per breeding world = the game's PetStats[w] rows. Only the 4 breeding
// worlds have pets (rows 4–7 are 1-entry placeholders); Breeding[13 + w] may
// have extra trailing slots, so the EXP array length would overshoot.
const PET_COUNTS_PER_WORLD: readonly number[] = (PetStats as unknown as unknown[][])
  .slice(0, 4)
  .map((pets) => pets.length);

// TomeQTY[51]: for every pet of the breeding worlds, its breedability level
// min(9, floor((2ndMulti - 1)^0.8) + 1), where Breeding("2ndMulti") is
// 1 + ln(max(1, (EXP + 1)^0.725)) once Breeding[2][3] > 0 (the breeding
// actor's GenINFO[53][0] unlock), else 1. EXP = Breeding[13 + world][pet].
// @njs _customBlock_Breeding
export function rawBreedability(d: D): number | null {
  if (!Array.isArray(d.Breeding)) return null;
  const breeding = d.Breeding as unknown[];
  const unlocked = num(arr(breeding[2])[3]) > 0;
  let total = 0;
  for (let w = 0; w < PET_COUNTS_PER_WORLD.length; w++) {
    const exp = arr(breeding[13 + w]);
    for (let p = 0; p < PET_COUNTS_PER_WORLD[w]; p++) {
      const multi = unlocked ? 1 + Math.log(Math.max(1, Math.pow(num(exp[p]) + 1, 0.725))) : 1;
      total += Math.min(9, Math.floor(Math.pow(multi - 1, 0.8)) + 1);
    }
  }
  return total;
}

export function rawShinyLevels(d: D): number | null {
  if (!d.Breeding || !Array.isArray((d.Breeding as unknown[])[1])) return null;
  return arrSum((d.Breeding as unknown[])[1]);
}

// ---------------------------------------------------------------- v7.9 W7 / breeding / spelunk extras

// TomeQTY[46]: the best Pets[g][2] / PetsStored[g][2] power, from 0.
export function rawHighestPowerMob(d: D): number | null {
  if (!Array.isArray(d.Pets) && !Array.isArray(d.PetsStored)) return null;
  let best = 0;
  for (const pet of [...arr(d.Pets), ...arr(d.PetsStored)]) {
    const v = Number(arr(pet)[2]);
    if (v > best) best = v;
  }
  return best;
}

export function rawCoralReefSum(d: D): number | null {
  if (!Array.isArray(d.Spelunk) || !Array.isArray((d.Spelunk as unknown[])[13])) {
    return null;
  }
  return arrSum((d.Spelunk as unknown[])[13]);
}

export function rawBiggestHaul(d: D): number | null {
  if (!Array.isArray(d.Spelunk) || !Array.isArray((d.Spelunk as unknown[])[2])) {
    return null;
  }
  const row = (d.Spelunk as unknown[])[2] as unknown[];
  let mx = 0;
  for (let i = 0; i < row.length; i++) {
    const v = Number(row[i]);
    if (!Number.isNaN(v) && v > mx) mx = v;
  }
  return mx > 0 ? mx : null;
}

export function rawSpelunkerLevel(d: D): number | null {
  let mx = 0;
  for (let i = 0; i < charCount(d); i++) {
    const lv = d["Lv0_" + i];
    if (Array.isArray(lv) && lv.length > 19) {
      const sk = num(lv[19]);
      if (sk > mx && sk !== -1) mx = sk;
    }
  }
  return mx > 0 ? mx : null;
}

export function rawMineheadOpponents(d: D): number | null {
  if (!Array.isArray(d.Research) || !Array.isArray((d.Research as unknown[])[7])) {
    return null;
  }
  const v = Number(((d.Research as unknown[])[7] as unknown[])[4]);
  return Number.isNaN(v) ? null : v;
}

export function rawGlimboTrades(d: D): number | null {
  if (!Array.isArray(d.Research) || !Array.isArray((d.Research as unknown[])[12])) {
    return null;
  }
  return arrSum((d.Research as unknown[])[12]);
}

// ---------------------------------------------------------------- royal guardian (2026-08)

// RoyalG / RoyalMaps arrive as arrays from the IT profiles API but may be JSON
// strings in a "Copy for Support" paste — accept both.
function parseArr(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Total Royal Statue LV = Σ RoyalG[0]. */
export function rawRoyalStatueLv(d: D): number | null {
  const rg = parseArr(d.RoyalG);
  const st = rg && parseArr(rg[0]);
  return st ? arrSum(st) : null;
}

/** Royal Guardian Outposts Built = RoyalMaps entries carrying ≥ 3 fields. */
export function rawRoyalOutposts(d: D): number | null {
  const rm = parseArr(d.RoyalMaps);
  if (!rm) return null;
  let n = 0;
  for (const e of rm) if (Array.isArray(e) && e.length >= 3) n++;
  return n;
}

/** Total Resource Grade = Σ RoyalG[5] (N.js TotalStatz(0)). */
export function rawResourceGrade(d: D): number | null {
  const rg = parseArr(d.RoyalG);
  const g = rg && parseArr(rg[5]);
  return g ? arrSum(g) : null;
}

/** Successful Jelly Operations = Research[7][9] (obstructions defeated at the
 *  W7 Jelly Operator research game, 2026-09-18). Saves from before the update
 *  have a shorter Research[7] — read as 0, not null, so the row still shows. */
export function rawJellyOperations(d: D): number | null {
  const r = parseArr(d.Research);
  const r7 = r && parseArr(r[7]);
  if (!r7) return null;
  return num(r7[9]);
}

// Luminous Menagerie (2026-10-16), save key "Menagerie" (8 lists). Saves from
// before the update have no key: the game's initialize4 fills it with zeros,
// so both tasks read 0 there (not null).
function menagerie(d: D): unknown[] {
  return parseArr(d.Menagerie) ?? [];
}

/** MenagerieStuff("UnlockOwned", b) on a raw save (lead's helper, raw-save adapter). */
export function menagerieUnlock(d: D, b: number): number {
  return menagerieUnlockOwned(b, { menagerieData: menagerie(d) } as unknown as SaveData);
}

/** Luminous Menagerie Rank = TomeQTY[122] = Menagerie[0][2]. */
export function rawMenagerieRank(d: D): number {
  return num(parseArr(menagerie(d)[0])?.[2]);
}

/** Total Menagerie Boosts Upg LV = TomeQTY[123] = Σ Menagerie[3]. */
export function rawMenagerieBoostLv(d: D): number {
  return arrSum(parseArr(menagerie(d)[3]) ?? []);
}

// ---------------------------------------------------------------- "proper" extractors

// The engine's card helpers read these four save keys only.
function cardSave(d: D): SaveData {
  return {
    cards0Data: obj(d.Cards0) ?? {},
    riftData: arr(d.Rift),
    spelunkData: arr(d.Spelunk),
    olaData: arr(d.OptLacc),
  } as unknown as SaveData;
}

// TomeQTY[2]: Σ CardLv over the Cards[0] keys that are game cards (CardStuff),
// with the engine's port of N.js CardLv.
export function rawCardsTotalLvProper(d: D): number | null {
  const cards = obj(d.Cards0);
  if (!cards) return null;
  const s = cardSave(d);
  let total = 0;
  for (const name of Object.keys(cards)) {
    if (CARDS_PER_TIER[name] !== undefined) total += computeCardLv(name, s);
  }
  return total > 0 ? total : null;
}

// N.js Breeding("SpecialPassives","Lv"): 19 thresholds, + 10 more once
// Menagerie unlock 11 is owned (2026-10-16: shiny cap 20 → 30).
function shinyThresholds(d: D): number {
  return 19 + 10 * menagerieUnlock(d, 11);
}

function getShinyLevelFromProgress(p: number, thresholds: number): number {
  if (!p || p === 0) return 0;
  let sl = 0;
  for (let i = 0; i < thresholds; i++) {
    if (p > Math.floor((1 + Math.pow(i + 1, 1.6)) * Math.pow(1.7, i + 1))) {
      sl = i + 2;
    }
  }
  return sl === 0 ? 1 : sl;
}

export function rawShinyLevelsProper(d: D): number | null {
  if (!d.Breeding) return null;
  const breed = d.Breeding as unknown[];
  const thresholds = shinyThresholds(d);
  let total = 0;
  for (let w = 0; w < 4; w++) {
    const arrW = breed[22 + w];
    if (!Array.isArray(arrW)) continue;
    for (let p = 0; p < arrW.length; p++) {
      const sl = getShinyLevelFromProgress(num(arrW[p]), thresholds);
      total += sl === 0 ? 1 : sl;
    }
  }
  return total > 0 ? total : null;
}

// The character the game is running as. N.js computes TomeQTY for the player
// logged in (UserInfo[0]); a save marks it with the latest PTimeAway_N.
// -1 when the save carries no away times.
function playedChar(d: D): number {
  let best = -1;
  let at = 0;
  for (let c = 0; c < charCount(d); c++) {
    const away = num(d["PTimeAway_" + c]);
    if (away > at) {
      at = away;
      best = c;
    }
  }
  return best;
}

// TomeQTY[15] = TotalTalentPoints(...)[5], the star tab of the logged-in
// character (GTN = GetTalentNumber(1, id) on that character):
//   floor(Lv0[0] - 1 + TalentDL[0] + GTN(8) + CYTalentPoints[5]
//     + FamBonusQTYs["64"] + GTN(622) + StampBonusOfTypeX("TalentS") + GTN(17)
//     + floor(GuildBonuses(11)) + FlurboShop(1) + min(5·CardLv(w4b2), 50)
//     + min(15·CardLv(Boss2C), 100) + min(4·CardLv(fallEvent1), 100)
//     + SigilBonus(9) + 10·Ach(212) + 20·Ach(289) + 20·Ach(305)
//     + ShinyBonusS(14) + BribeBonus(32) + 100·FractalIslandBonus(5)
//     + VaultUpgBonus(53) + Companions(20))
// with TalentDL[0] = Σ Lv0[1..9] - 3 + round(GTN(275)). Every term is read
// through the engine, which needs the save loaded. Without away times every
// character is tried and the best one kept.
// @njs _customBlock_TotalTalentPoints
export function rawStarTalentsProper(d: D): number | null {
  const played = playedChar(d);
  const chars = played >= 0 ? [played] : Array.from({ length: charCount(d) }, (_, c) => c);
  loadSaveData(d as never);
  const s = engineSave;
  const ctx = { saveData: s, charIdx: -1 };
  const cardLv = (key: string) => computeCardLv(key, s);
  const account =
    num(arr(d.CYTalentPoints)[5]) +
    stamp.resolve("C18", ctx).val +
    Math.floor(guild.resolve(11, ctx).val) +
    flurboShop(1, s).val +
    Math.min(5 * cardLv("w4b2"), 50) +
    Math.min(15 * cardLv("Boss2C"), 100) +
    Math.min(4 * cardLv("fallEvent1"), 100) +
    sigil.resolve(9, ctx).val +
    10 * achieveStatus(212, s) +
    20 * achieveStatus(289, s) +
    20 * achieveStatus(305, s) +
    computeShinyBonusS(14, s) +
    getBribeBonus(32, s).val +
    100 * fractalIslandBonus(5, s) +
    vaultUpgBonus(53, s) +
    companions(20, s);

  let best: number | null = null;
  for (const c of chars) {
    const lv0 = arr(d["Lv0_" + c]);
    if (!lv0.length) continue;
    const gtn = (id: number) => talent.resolve(id, { saveData: s, charIdx: c, activeCharIdx: c }).val;
    let tab = -3;
    for (let i = 1; i <= 9; i++) tab += num(lv0[i]);
    tab += Math.round(gtn(275));
    const pts = Math.floor(
      num(lv0[0]) - 1 + tab + gtn(8) + gtn(622) + gtn(17) + (computeFamBonusQTYs(c, s)[64] ?? 0) + account
    );
    if (best === null || pts > best) best = pts;
  }
  return best;
}

// Summoning Boss Stone victories (compute 96): sum KRbest keys starting with "SummzTrz".
export function rawSummonStones(d: D): number | null {
  const k = obj(d.KRbest);
  if (!k) return null;
  let total = 0;
  for (const key of Object.keys(k)) {
    if (key.indexOf("SummzTrz") === 0) total += num(k[key]);
  }
  return total > 0 ? total : null;
}

export function rawDeathNoteDigitsProper(d: D): number | null {
  const all: Record<number, number> = {};
  for (let c = 0; c < charCount(d); c++) {
    const k = d["KLA_" + c];
    if (!Array.isArray(k)) continue;
    for (let i = 0; i < k.length; i++) {
      const v = k[i];
      let kills = 0;
      if (Array.isArray(v) && v.length > 0) kills = Math.abs(num(v[0]));
      else if (typeof v === "number") kills = Math.abs(v);
      if (kills > 0) all[i] = (all[i] || 0) + kills;
    }
  }
  let dg = 0;
  for (let i = 0; i < DEATHNOTE_MOB_IDX.length; i++) {
    const mobIdx = DEATHNOTE_MOB_IDX[i];
    const kk = all[mobIdx] || 0;
    if (kk > 0) dg += Math.ceil(lavaLog(kk));
  }
  // Add miniBoss digits from Ninja[105]
  const mb = Array.isArray(d.Ninja) ? (d.Ninja as unknown[])[105] : null;
  if (Array.isArray(mb)) {
    for (let i = 0; i < mb.length; i++) {
      const mk = num(mb[i]);
      if (mk > 0) dg += Math.ceil(lavaLog(mk));
    }
  }
  return dg > 0 ? dg : null;
}
