// All raw*() extractor functions, ported 1:1 from Code_TomeRaw_v6_1.gs v7.9.
// Each function pulls a single number out of the IT save object. Returns null
// if the relevant fields are missing or malformed (matches the .gs behavior).

import { arrSum, arrMax, lavaLog, type RawObj } from "./math";
import { CARDS_PER_TIER, DEATHNOTE_MOB_IDX, DUNGEON_LEVELS } from "./tasks";

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
    for (const k of Object.keys(row)) t += num(row[k]);
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
  if (!d.Summon || !Array.isArray((d.Summon as unknown[])[1])) return null;
  const wins = ((d.Summon as unknown[])[1] as unknown[]).length;
  const opt = arr(d.OptLacc);
  const endless = num(opt[319]);
  return wins + endless;
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
  const powers: number[] = [];
  if (Array.isArray(d.PetsStored)) {
    for (const p of d.PetsStored) {
      if (Array.isArray(p) && p[2] !== undefined) {
        const v = Number(p[2]);
        if (!Number.isNaN(v) && v > 0) powers.push(v);
      }
    }
  }
  if (Array.isArray(d.Breeding) && Array.isArray((d.Breeding as unknown[])[3])) {
    for (const v of (d.Breeding as unknown[])[3] as unknown[]) {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 0) powers.push(n);
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

// Star Talents (compute 15): max char (level-1 + sum_skills_1_9 - 3) across all chars.
export function rawStarTalentsProper(d: D): number | null {
  let maxPts = 0;
  for (let c = 0; c < 10; c++) {
    const lv = d["Lv0_" + c];
    if (!Array.isArray(lv)) continue;
    const charLv = num(lv[0]);
    let base = -3;
    for (let i = 1; i <= 9 && i < lv.length; i++) base += num(lv[i]);
    const pts = charLv - 1 + base;
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
