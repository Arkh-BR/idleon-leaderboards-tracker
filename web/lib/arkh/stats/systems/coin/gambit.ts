// ===== GAMBIT (coin) =====
// Port of N.js Holes("GambitBonuses", b) and its point pipeline, the Death
// Note pages (WorkbenchStuff OverkillQTY) and Measurements 9 and 13.

import { HolesInfo, DeathNoteMobs, MapAFKtarget, NinjaInfo } from "../../data/game/customlists.js";
import { getLOG } from "../../../formulas";
import { legendPTSbonus } from "../w7/spelunking";
import { computeMonumentROGbonus, cosmoBonus } from "../w5/hole";
import { arcaneUpgBonus } from "../mc/tesseract";
import { accountMapKills } from "./accountKills";
import type { SaveData } from "../../../state";

const H = (s: SaveData, row: number, i: number) =>
  Number((((s.holesData as any[]) ?? [])[row] ?? [])[i]) || 0;
const info = (row: number, i: number) =>
  String(((HolesInfo as unknown as unknown[][])[row] ?? [])[i] ?? "");

// @njs DeathNoteRank
/** N.js WorkbenchStuff("DeathNoteRank", kills, e): one mob's skull value;
 *  e = 7842 is the miniboss table. */
function deathNoteRank(kills: number, s: SaveData, mini = false): number {
  if (mini) {
    if (kills < 100) return 0;
    if (kills < 250) return 1;
    if (kills < 1e3) return 2;
    if (kills < 5e3) return 3;
    if (kills < 25e3) return 4;
    if (kills < 1e5) return 5;
    return kills < 1e6 ? 7 : 10;
  }
  if (kills < 25e3) return 0;
  if (kills < 1e5) return 1;
  if (kills < 2.5e5) return 2;
  if (kills < 5e5) return 3;
  if (kills < 1e6) return 4;
  if (kills < 5e6) return 5;
  if (kills < 1e8) return 7;
  // RiftStuff("riftBonus", 3) = Rift[0] >= 5·(3 + 1).
  return kills > 1e9 && (Number((s.riftData as any[])?.[0]) || 0) >= 20 ? 20 : 10;
}

// @njs OverkillQTY
/** N.js WorkbenchStuff("OverkillQTY", w) (@7756378): the Death Note page of
 *  world w (0–6: Σ rank of every DeathNoteMobs[w] mob over the account's kills
 *  on its map) or, for w = 7, the minibosses (Σ rank of Ninja[105][i] for the
 *  NinjaInfo[30] bosses, table 7842). */
export function overkillQTY(w: number, s: SaveData): number {
  if (w === 7) {
    const kills = ((s.ninjaData as any[]) ?? [])[105] ?? [];
    const bosses = ((NinjaInfo as unknown as unknown[][])[30] ?? []).length;
    let t = 0;
    for (let i = 0; i < bosses; i++) t += deathNoteRank(Number(kills[i]) || 0, s, true);
    return t;
  }
  const mapOf = MapAFKtarget as unknown as string[];
  let t = 0;
  for (const mob of (DeathNoteMobs as unknown as string[][])[w] ?? []) {
    const m = mapOf.indexOf(mob);
    t += deathNoteRank(m >= 0 ? accountMapKills(m) : 0, s);
  }
  return t;
}

/** Σ OverkillQTY(0..6): the Death Note skulls MeasurementQTYfound(6) counts
 *  (no minibosses). */
export function deathNoteSkulls(s: SaveData): number {
  let n = 0;
  for (let w = 0; w < 7; w++) n += overkillQTY(w, s);
  return n;
}

// @njs MeasurementBaseBonus
/** N.js Holes("MeasurementBaseBonus", i) (@10914899): (1 + Cosmo(1,3)/100) ×
 *  (HolesInfo[55][i] has "TOT" ? n·lv/(100 + lv) : n·lv), lv = Holes[22][i]. */
function measurementBase(i: number, s: SaveData): number {
  const lv = H(s, 22, i);
  const raw = info(55, i);
  const cosmo = 1 + cosmoBonus(s, 1, 3) / 100;
  return raw.includes("TOT")
    ? cosmo * ((Number(raw.replace("TOT", "")) * lv) / (100 + lv))
    : cosmo * Number(raw) * lv;
}

// @njs MeasurementMulti
/** N.js Holes("MeasurementMulti", type) (@10918723), q = MeasurementQTYfound(type, 99):
 *  1 + 18q/100, or 1 + (18q + 8(q − 5))/100 from q = 5. Ported types: 0 =
 *  log10 of the Gloomie kills (Holes[11][28]), 6 = the Death Note skulls / 125.
 *  ponytail: any other type reads q = 0 (×1) — port it before reading that measurement. */
function measurementMulti(type: number, s: SaveData): number {
  const q = type === 0 ? getLOG(H(s, 11, 28)) : type === 6 ? deathNoteSkulls(s) / 125 : 0;
  return q < 5 ? 1 + (18 * q) / 100 : 1 + (18 * q + 8 * (q - 5)) / 100;
}

// @njs MeasurementBonusTOTAL
/** N.js Holes("MeasurementBonusTOTAL", i) (@10918979) = MeasurementBaseBonus(i)
 *  × MeasurementMulti(HolesInfo[52][i]). Gambit reads 13 (type 6), Multikill
 *  reads 9 (type 0). */
export function measurementBonusTotal(i: number, s: SaveData): number {
  return measurementBase(i, s) * measurementMulti(Number(info(52, i)), s);
}

/** N.js Holes("StudyBolaiaBonuses", b), generic branch (b ∉ {3, 9}). */
function studyBolaia(b: number, s: SaveData): number {
  return H(s, 26, b) * Number(info(70, b));
}

/** N.js Holes("JarCollectibleBonus", b). */
function jarCollectible(b: number, s: SaveData): number {
  return H(s, 24, b) * Number(info(67, b).split("|")[1]) * (1 + legendPTSbonus(29, s) / 100);
}

// @njs GambitPTSmulti
/** N.js Holes("GambitPTSmulti"). B_UPG(78, 10) has no special case: 10 once bought. */
export function gambitPtsMulti(s: SaveData): number {
  const bUpg78 = H(s, 13, 78) !== 0 ? 10 : 0;
  return (
    1 +
    (measurementBonusTotal(13, s) +
      studyBolaia(13, s) +
      bUpg78 +
      computeMonumentROGbonus(2, 7, s) +
      jarCollectible(23, s) +
      jarCollectible(30, s) +
      arcaneUpgBonus(47, s)) /
      100
  );
}

// @njs GambitPts
/** N.js Holes("GambitPts", 777). */
export function gambitPoints(s: SaveData): number {
  let sum = 0;
  for (let b = 0; b <= 5; b++) {
    const v = H(s, 11, 65 + b);
    sum += (b === 0 ? 100 : 200) * (v + 3 * Math.floor(v / 10) + 10 * Math.floor(v / 60));
  }
  return sum * gambitPtsMulti(s);
}

// @njs GambitPtsREQ
/** N.js Holes("GambitPtsREQ", b). */
export function gambitPtsReq(b: number): number {
  return 2e3 + 1e3 * (b + 1) * (1 + b / 5) * Math.pow(1.26, b);
}

// @njs GambitBonuses
/** N.js Holes("GambitBonuses", b) for b ≥ 1. */
export function gambitBonus(b: number, s: SaveData): number {
  const pts = gambitPoints(s);
  if (pts < gambitPtsReq(b)) return 0;
  const [val, scale] = info(71, b).split("|");
  return Number(scale) === 1 ? Number(val) * getLOG(pts) : Number(val);
}
