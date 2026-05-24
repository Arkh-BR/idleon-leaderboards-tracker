// All raw*() extractor functions, ported 1:1 from Code_TomeRaw_v6_1.gs v7.9.
// Each function pulls a single number out of the IT save object. Returns null
// if the relevant fields are missing or malformed (matches the .gs behavior).

import { arrSum, arrMax, lavaLog, type RawObj } from "./math";
import { CARDS_PER_TIER, DEATHNOTE_MOB_IDX, DUNGEON_LEVELS } from "./tasks";
import { SUMMONING_ENEMY_IDS } from "./summoningEnemies";

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

// ---------------------------------------------------------------- account / chars

export function rawAccountLevel(d: D): number | null {
  let t = 0;
  let f = false;
  for (let i = 0; i < 10; i++) {
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
  for (let i = 0; i < 10; i++) {
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

export function rawStamps(d: D): number | null {
  const sl = d.StampLv;
  if (!Array.isArray(sl)) return null;
  let t = 0;
  for (let i = 0; i < sl.length; i++) {
    const row = obj(sl[i]);
    if (!row) continue;
    // StampLv rows are plain objects that carry a `"length"` own property
    // holding the count of stamps in that category. Skipping it matches IT's
    // `calcStampLevels` behavior.
    for (const k of Object.keys(row)) {
      if (k === "length") continue;
      t += num(row[k]);
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

export function rawMinigameScore(d: D): number | null {
  const m = d.FamValMinigameHiscores;
  if (!Array.isArray(m)) return null;
  let s = 0;
  for (let i = 0; i < Math.min(5, m.length); i++) s += num(m[i]);
  return s;
}

export function rawSummoningStones(d: D): number | null {
  const s = d.Summon;
  if (!Array.isArray(s) || !Array.isArray((s as unknown[])[3])) return null;
  return arrSum((s as unknown[])[3]);
}

// ---------------------------------------------------------------- farming / boats / sail

export function rawFarmingStickers(d: D): number | null {
  // IT (parsers/world-7/research.ts) computes totalStickers = sum(Research[9])
  // where Research[9] is the per-sticker-type level array. OptLacc[140] is a
  // related but slightly stale value — use Research[9] to match IT.
  if (Array.isArray(d.Research) && Array.isArray((d.Research as unknown[])[9])) {
    return arrSum((d.Research as unknown[])[9]);
  }
  const opt = arr(d.OptLacc);
  const v = opt[140];
  if (v !== undefined && v !== null) return Math.floor(Number(v));
  if (Array.isArray(d.FarmStick)) return d.FarmStick.length;
  return null;
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
  for (let c = 0; c < 10; c++) {
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
  for (let c = 0; c < 10; c++) {
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
  for (let c = 0; c < 10; c++) {
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

export function rawDungeonRank(d: D): number | null {
  const opt = arr(d.OptLacc);
  const p = opt[71];
  if (p === undefined || p === null) return null;
  let r = 0;
  for (let i = 0; i < DUNGEON_LEVELS.length; i++) {
    if (Number(p) > DUNGEON_LEVELS[i]) r = i;
  }
  return r + 1;
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
    for (const k of Object.keys(c)) t += num(c[k]);
  }
  return t > 0 ? t : null;
}

export function rawVialTotalLv(d: D): number | null {
  if (!d.CauldronInfo) return null;
  const v = (d.CauldronInfo as unknown[])[4];
  const c = obj(v);
  if (!c) return null;
  let t = 0;
  for (const k of Object.keys(c)) t += num(c[k]);
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
  // IT's parseSummoning iterates a hardcoded list of 108 valid enemies
  // (9 white battles + 99 deathNote) and counts each as won if its ID is in
  // Summon[1]. Then adds highestEndlessLevel = OptLacc[319]. Rift/mini-boss
  // entries that may appear in Summon[1] are NOT counted because they're
  // not in IT's enemy list.
  if (!d.Summon || !Array.isArray((d.Summon as unknown[])[1])) return null;
  const wonBattles = (d.Summon as unknown[])[1] as unknown[];
  const wonSet = new Set(wonBattles.map((x) => String(x)));
  let validWins = 0;
  for (const id of SUMMONING_ENEMY_IDS) {
    if (wonSet.has(id)) validWins++;
  }
  const opt = arr(d.OptLacc);
  const endless = num(opt[319]);
  return validWins + endless;
}

export function rawBreedability(d: D): number | null {
  if (!d.Breeding || !Array.isArray((d.Breeding as unknown[])[7])) return null;
  return arrSum((d.Breeding as unknown[])[7]);
}

export function rawShinyLevels(d: D): number | null {
  if (!d.Breeding || !Array.isArray((d.Breeding as unknown[])[1])) return null;
  return arrSum((d.Breeding as unknown[])[1]);
}

// ---------------------------------------------------------------- v7.9 W7 / breeding / spelunk extras

export function rawHighestPowerMob(d: D): number | null {
  // IT's calcHighestPower (parsers/world-4/breeding.ts) aggregates:
  //  - PetsStored[*][2]              (stored pets)
  //  - Pets[*][2]                    (fence pets + territory teams)
  // NOT Breeding[3] — that's genetics/material counts, not pet power.
  const powers: number[] = [];
  if (Array.isArray(d.PetsStored)) {
    for (const p of d.PetsStored) {
      if (Array.isArray(p) && p[2] !== undefined) {
        const v = Number(p[2]);
        if (!Number.isNaN(v) && v > 0) powers.push(v);
      }
    }
  }
  if (Array.isArray(d.Pets)) {
    for (const p of d.Pets) {
      if (Array.isArray(p) && p[2] !== undefined) {
        const v = Number(p[2]);
        if (!Number.isNaN(v) && v > 0) powers.push(v);
      }
    }
  }
  return powers.length > 0 ? Math.max(...powers) : null;
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
  for (let i = 0; i < 10; i++) {
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

// ---------------------------------------------------------------- "proper" extractors

function calcStars(
  tierReq: number,
  amount: number,
  name: string,
  maxStars: number,
  isInFiveStarList: boolean
): number {
  let lvl = 0;
  for (let i = 0; i < maxStars; i++) {
    if (name === "Boss3B") {
      if (amount > 1.5 * Math.pow(i + 1 + Math.floor(i / 3), 2)) lvl = i + 2;
    } else {
      if (
        amount >
        tierReq *
          Math.pow(
            i +
              1 +
              (Math.floor(i / 3) + (16 * Math.floor(i / 4) + 100 * Math.floor(i / 5))),
            2
          )
      ) {
        lvl = i + 2;
      }
    }
  }
  if (isInFiveStarList && lvl < 6) return 5;
  return lvl > 0 ? lvl - 1 : lvl;
}

export function rawCardsTotalLvProper(d: D): number | null {
  const cards = obj(d.Cards0);
  if (!cards) return null;
  const rift =
    Array.isArray(d.Rift) && (d.Rift as unknown[])[0] !== undefined
      ? num((d.Rift as unknown[])[0])
      : 0;
  const maxStars = Math.round(4 + (rift >= 45 ? 1 : 0));
  const opt = arr(d.OptLacc);
  const fiveStarRaw = String(opt[155] || "");
  const fiveStarList = fiveStarRaw ? fiveStarRaw.split(",") : [];
  let total = 0;
  for (const name of Object.keys(cards)) {
    const amount = num(cards[name]);
    if (amount <= 0) continue;
    const perTier = CARDS_PER_TIER[name];
    if (perTier === undefined) continue;
    const isFive = fiveStarList.indexOf(name) !== -1;
    const stars = calcStars(perTier, amount, name, maxStars, isFive);
    total += stars + 1;
  }
  return total > 0 ? total : null;
}

function getShinyLevelFromProgress(p: number): number {
  if (!p || p === 0) return 0;
  let sl = 0;
  for (let i = 0; i < 19; i++) {
    if (p > Math.floor((1 + Math.pow(i + 1, 1.6)) * Math.pow(1.7, i + 1))) {
      sl = i + 2;
    }
  }
  return sl === 0 ? 1 : sl;
}

export function rawShinyLevelsProper(d: D): number | null {
  if (!d.Breeding) return null;
  const breed = d.Breeding as unknown[];
  let total = 0;
  for (let w = 0; w < 4; w++) {
    const arrW = breed[22 + w];
    if (!Array.isArray(arrW)) continue;
    for (let p = 0; p < arrW.length; p++) {
      const sl = getShinyLevelFromProgress(num(arrW[p]));
      total += sl === 0 ? 1 : sl;
    }
  }
  return total > 0 ? total : null;
}

// Star Talents (compute 15): max-across-chars of (level-1 + sum_skills_1_9 - 3
// + per-char talent bonuses + account-wide bonuses).
//
// We port the high-impact pieces of IT's calcTotalStarTalent:
//   - STAR_PLAYER talent (skillIndex 8): funcX=add x1=1 x2=0 → bonus = level
//   - SUPERNOVA_PLAYER (skillIndex 17): funcX=add x1=1 x2=0 → bonus = level
//   - STONKS! star talent (skillIndex 622): funcX=decay x1=130 x2=50
//     → bonus = 130·level / (level + 50)
//   - account.talentPoints[5] (CYTalentPoints[5])
//   - Achievements 212/289/305 → 10/20/20 flat pts when unlocked
//
// Remaining IT bonuses we don't port (typically <100 pts combined on most
// accounts): family ES bonus, Talent_Points_for_Star_Tab stamp, guild bonus
// 11, dungeon flurbo 'Talent_Pts', card 'Star_Talent_Pts_(Passive)', sigil
// TWO_STARZ, shiny pet 'Star_Talent_Pts', bribe 'Star_Scraper', fractal
// island shop, vault upgrade 53, companion 20.
//
// When the input is an IT API response with parsedData.tomePoints (e.g. from
// our /api proxy), computeTome overrides our value with IT's exact number.
const SKILL_STAR_PLAYER = 8;
const SKILL_SUPERNOVA = 17;
const SKILL_STONKS = 622;
const SKILL_THE_FAMILY_GUY = 144;
const CLASS_ELEMENTAL_SORC = 22;
const BRIBE_STAR_SCRAPER_IDX = 32;
const VAULT_UPG_SPECIAL_TALENT = 53;
const FAMILY_STAR_TAB_THRESHOLD = 29; // x3 of classFamilyBonuses STAR_TAB_TALENT_POINTS

// Star-talent-passive cards (IT website-data). Effect: Star_Talent_Pts_(Passive).
// [rawName, base bonus, perTier threshold]
const STAR_TALENT_CARDS: readonly [string, number, number][] = [
  ["w4b2", 5, 20],
  ["Boss2C", 15, 11],
  ["fallEvent1", 4, 3],
];

function talentLevel(d: D, charIdx: number, skillIndex: number): number {
  const sl = d["SL_" + charIdx];
  const slObj = obj(sl);
  if (!slObj) return 0;
  const v = slObj[String(skillIndex)] ?? slObj[skillIndex as unknown as string];
  return num(v);
}

function sigilTwoStarzBonus(d: D): number {
  // CauldronP2W[4] sigil index 9 (slot 19) = unlocked stage → bonus.
  if (!Array.isArray(d.CauldronP2W)) return 0;
  const sigilsData = (d.CauldronP2W as unknown[])[4];
  if (!Array.isArray(sigilsData)) return 0;
  const unlocked = num((sigilsData as unknown[])[19]);
  if (unlocked === 4) return 125;
  if (unlocked === 3) return 100;
  if (unlocked === 2) return 45;
  if (unlocked === 1) return 25;
  if (unlocked === 0) return 10;
  return 0;
}

function stampTalentSBonus(d: D): number {
  // misc stamp 17 (Talent_S Stamp), func=add x1=1 x2=0 → level.
  if (!Array.isArray(d.StampLv)) return 0;
  const miscStamps = obj((d.StampLv as unknown[])[2]);
  if (!miscStamps) return 0;
  return num(miscStamps["17"]);
}

function bribeStarScraperBonus(d: D): number {
  // BribeStatus[32] = Star_Scraper. Done flag = 1 → +33 Star Talent Points.
  if (!Array.isArray(d.BribeStatus)) return 0;
  return num((d.BribeStatus as unknown[])[BRIBE_STAR_SCRAPER_IDX]) === 1 ? 33 : 0;
}

function vaultSpecialTalentBonus(d: D): number {
  // UpgVault[53] level. Vault upg 53 ("Special_Talent", x5=1) is in IT's
  // isSimple list → bonus = level * x5. IT doesn't cap by maxLevel in the
  // bonus calc, just multiplies.
  if (!Array.isArray(d.UpgVault)) return 0;
  return num((d.UpgVault as unknown[])[VAULT_UPG_SPECIAL_TALENT]);
}

function dungeonFlurboTalentPts(d: D): number {
  // DungUpg[5] is the flurbo upgrade levels array. Index 1 = Talent_Pts
  // (func=add, x1=1, x2=0 → bonus = level).
  if (!Array.isArray(d.DungUpg)) return 0;
  const flurbo = (d.DungUpg as unknown[])[5];
  if (!Array.isArray(flurbo)) return 0;
  return num((flurbo as unknown[])[1]);
}

function guildStarDazzleBonus(d: D): number {
  // Guild bonus 11 (Star_Dazzle): decay(level, 120, 50). ARKHE-style data
  // lives in blob.guildData.stats[0][11] — the IT serializer attaches this
  // to account.guild.guildBonuses[11].level. In raw paste mode we read it
  // from the same path if present.
  // NOTE: when the user pastes only the .data field, this is unreachable.
  // We fall back to 0 in that case.
  const gd = (d as { guildData?: { stats?: unknown[] } }).guildData;
  if (!gd?.stats) return 0;
  const lvls = (gd.stats as unknown[])[0];
  if (!Array.isArray(lvls)) return 0;
  const level = num((lvls as unknown[])[11]);
  if (level <= 0) return 0;
  return (120 * level) / (level + 50);
}

function flyingWormCompanionBonus(d: D): number {
  // Companion index 20 (Flying_Worm) gives +30 Talent Points if acquired.
  // Companion data in blob.companion.l (list of "id,tradable,?,?,?" strings).
  // Acquired = any entry in list has id === "20".
  const c = (d as { companion?: { l?: string[] } }).companion;
  if (!c?.l || !Array.isArray(c.l)) return 0;
  const acquired = c.l.some((entry) => {
    if (typeof entry !== "string") return false;
    return entry.split(",")[0] === "20";
  });
  return acquired ? 30 : 0;
}

function shinyStarTalentPetBonus(d: D): number {
  // Only W2 pet 11 (Cryosnake/snakeB) has passive "+{_Star_Talent_Pts" with
  // baseValue=2. Shiny level comes from Breeding[23][11] progress, via the
  // getShinyLevelFromProgress curve. Bonus = round(baseValue * shinyLevel).
  if (!Array.isArray(d.Breeding)) return 0;
  const w2Progress = (d.Breeding as unknown[])[23];
  if (!Array.isArray(w2Progress)) return 0;
  const progress = num((w2Progress as unknown[])[11]);
  if (progress <= 0) return 0;
  let shinyLv = 0;
  for (let i = 0; i < 19; i++) {
    if (progress > Math.floor((1 + Math.pow(i + 1, 1.6)) * Math.pow(1.7, i + 1))) {
      shinyLv = i + 2;
    }
  }
  if (shinyLv === 0) shinyLv = 1;
  return Math.round(2 * shinyLv);
}

function calcCardStars(
  tierReq: number,
  amount: number,
  name: string,
  maxStars: number,
  isInFiveStarList: boolean
): number {
  let lvl = 0;
  for (let i = 0; i < maxStars; i++) {
    if (name === "Boss3B") {
      if (amount > 1.5 * Math.pow(i + 1 + Math.floor(i / 3), 2)) lvl = i + 2;
    } else {
      if (
        amount >
        tierReq *
          Math.pow(
            i +
              1 +
              (Math.floor(i / 3) +
                (16 * Math.floor(i / 4) + 100 * Math.floor(i / 5))),
            2
          )
      ) {
        lvl = i + 2;
      }
    }
  }
  if (isInFiveStarList && lvl < 6) return 5;
  return lvl > 0 ? lvl - 1 : lvl;
}

function cardPassiveStarBonus(d: D): number {
  const cards = obj(d.Cards0);
  if (!cards) return 0;
  const rift =
    Array.isArray(d.Rift) && (d.Rift as unknown[])[0] !== undefined
      ? num((d.Rift as unknown[])[0])
      : 0;
  const maxStars = Math.round(4 + (rift >= 45 ? 1 : 0));
  const opt = arr(d.OptLacc);
  const fiveStarRaw = String(opt[155] || "");
  const fiveStarList = fiveStarRaw ? fiveStarRaw.split(",") : [];
  let total = 0;
  for (const [name, baseBonus, perTier] of STAR_TALENT_CARDS) {
    const amount = num(cards[name]);
    if (amount <= 0) continue;
    const isFive = fiveStarList.indexOf(name) !== -1;
    const stars = calcCardStars(perTier, amount, name, maxStars, isFive);
    total += baseBonus * (stars + 1);
  }
  return total;
}

function familyStarBaseBonus(highestEsLv: number): number {
  // classFamilyBonuses[32] = STAR_TAB_TALENT_POINTS, func=intervalAdd,
  // x1=1 x2=6 x3=29 (threshold). IT's getFamilyBonusBonus:
  //   if level < x3 return 0; else growth(intervalAdd, level-x3, x1, x2)
  // intervalAdd(L, x1, x2) = x1 + floor(L / x2).
  if (highestEsLv < FAMILY_STAR_TAB_THRESHOLD) return 0;
  return 1 + Math.floor((highestEsLv - FAMILY_STAR_TAB_THRESHOLD) / 6);
}

function familyValueRound(
  e: number,
  func: string,
  _x1: number,
  a: number
): number {
  // Port of getFamilyBonusValue rounding rules.
  if (e < 10 && func.indexOf("decay") !== -1) return Math.round(100 * e) / 100;
  if (
    e < 1 ||
    (func === "add" && a < 1 && e < 100) ||
    (e < 25 && func === "decay")
  ) {
    return Math.round(10 * e) / 10;
  }
  return Math.round(e);
}

function highestElementalSorcLevel(d: D): number {
  let max = 0;
  for (let c = 0; c < 10; c++) {
    if (num(d["CharacterClass_" + c]) !== CLASS_ELEMENTAL_SORC) continue;
    const lv = d["Lv0_" + c];
    if (Array.isArray(lv)) {
      const v = num(lv[0]);
      if (v > max) max = v;
    }
  }
  return max;
}

export function rawStarTalentsProper(d: D): number | null {
  const ach = Array.isArray(d.AchieveReg) ? d.AchieveReg : [];
  const cyTp = Array.isArray(d.CYTalentPoints) ? (d.CYTalentPoints as unknown[]) : [];
  const talentPointsStar = num(cyTp[5]);
  const achBonus =
    (num(ach[212]) === -1 ? 10 : 0) +
    (num(ach[289]) === -1 ? 20 : 0) +
    (num(ach[305]) === -1 ? 20 : 0);
  const sigil = sigilTwoStarzBonus(d);
  const stamp = stampTalentSBonus(d);
  const bribe = bribeStarScraperBonus(d);
  const vault = vaultSpecialTalentBonus(d);
  const cardsBonus = cardPassiveStarBonus(d);
  const flurbo = dungeonFlurboTalentPts(d);
  const guild = guildStarDazzleBonus(d);
  const companion = flyingWormCompanionBonus(d);
  const shiny = shinyStarTalentPetBonus(d);

  // Family bonus is per-char (ES chars get a multiplier from THE_FAMILY_GUY).
  const highestEsLv = highestElementalSorcLevel(d);
  const familyBase = familyStarBaseBonus(highestEsLv);

  const accountConstant =
    talentPointsStar +
    achBonus +
    sigil +
    stamp +
    bribe +
    vault +
    cardsBonus +
    flurbo +
    Math.floor(guild) +
    companion +
    shiny;

  let maxPts = 0;
  for (let c = 0; c < 10; c++) {
    const lv = d["Lv0_" + c];
    if (!Array.isArray(lv)) continue;
    const charLv = num(lv[0]);
    let base = -3;
    for (let i = 1; i <= 9 && i < lv.length; i++) base += num(lv[i]);

    const starPlayerRaw = talentLevel(d, c, SKILL_STAR_PLAYER);
    const supernovaRaw = talentLevel(d, c, SKILL_SUPERNOVA);
    const stonksLv = talentLevel(d, c, SKILL_STONKS);
    const stonks = stonksLv > 0 ? (130 * stonksLv) / (stonksLv + 50) : 0;

    // Family bonus: per char. ES chars apply (1 + TFG%) and re-round.
    let familyEff = familyBase;
    const isEs = num(d["CharacterClass_" + c]) === CLASS_ELEMENTAL_SORC;
    if (isEs && familyEff > 0) {
      const tfgLv = talentLevel(d, c, SKILL_THE_FAMILY_GUY);
      const tfgPct = tfgLv > 0 ? (40 * tfgLv) / (tfgLv + 100) : 0;
      familyEff *= 1 + tfgPct / 100;
      familyEff = familyValueRound(familyEff, "intervalAdd", 1, 6);
    }

    // IT's applyTalentAddedLevels boosts each non-excluded talent's level by
    // `addedLevels` if the base level >= 1. STAR_PLAYER (8) and SUPERNOVA
    // (17) qualify; STONKS! (skillIndex 622) is excluded (skillIndex > 614).
    //
    // addedLevels is the SUM of: family bonus, symbol-of-beyond talent,
    // achievement 291 (+1), companion 1, ninja mastery [232]>=3 (+5),
    // god/divinity bonus, equinox 'Equinox_Symbols', grimoire 39,
    // Kattlekruk set, tesseract 57 (cap 5), superbit 'Timmy_Talented',
    // super-talent (per talent). We port the cheap account-wide ones.
    //
    // Missing here (typically <100 total for non-maxed accounts): symbol
    // talent, god bonus, equinox, grimoire, kattlekruk, tesseract, superbit,
    // companion 1, super-talent boost.
    const isNinjaMastery = num(arr(d.OptLacc)[232]) >= 3;
    const ach291 = num((Array.isArray(d.AchieveReg) ? d.AchieveReg : [])[291]) === -1 ? 1 : 0;
    // Grimoire upgrade 39 (Skull_of_Major_Talent): isSimple → level * x5 = level.
    let grimoire = 0;
    if (Array.isArray(d.Grimoire) && (d.Grimoire as unknown[])[39] !== undefined) {
      grimoire = num((d.Grimoire as unknown[])[39]);
    }
    // Companion 1 (Rift_Slug) acquired → +25 added levels.
    let companion1 = 0;
    const cList = (d as { companion?: { l?: string[] } }).companion?.l;
    if (Array.isArray(cList) && cList.some((e) => typeof e === "string" && e.split(",")[0] === "1")) {
      companion1 = 25;
    }
    const addedLevels =
      Math.floor(familyEff) +
      ach291 +
      (isNinjaMastery ? 5 : 0) +
      grimoire +
      companion1;

    const starPlayer = starPlayerRaw >= 1 ? starPlayerRaw + addedLevels : 0;
    const supernova = supernovaRaw >= 1 ? supernovaRaw + addedLevels : 0;

    const pts = Math.floor(
      charLv - 1 + base + starPlayer + supernova + stonks + familyEff + accountConstant
    );
    if (pts > maxPts) maxPts = pts;
  }
  return maxPts > 0 ? maxPts : null;
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
  for (let c = 0; c < 10; c++) {
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
