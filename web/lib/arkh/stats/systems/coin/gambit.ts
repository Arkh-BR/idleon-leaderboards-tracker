// ===== GAMBIT (coin) =====
// Port of N.js Holes("GambitBonuses", b) and its point pipeline, with the
// Deathnote skull count Measurement 13 needs (WorkbenchStuff OverkillQTY).

import { HolesInfo, DeathNoteMobs, MapAFKtarget } from "../../data/game/customlists.js";
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

/** N.js WorkbenchStuff("DeathNoteRank", kills, 0): one mob's skull value. */
function deathNoteRank(kills: number, s: SaveData): number {
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

/** Σ_{w=0..6} N.js WorkbenchStuff("OverkillQTY", w): the Deathnote skulls of
 *  worlds 1–7. Index 7 (minibosses) isn't part of MeasurementQTYfound(6). */
export function deathNoteSkulls(s: SaveData): number {
  const mapOf = MapAFKtarget as unknown as string[];
  let n = 0;
  for (const mobs of (DeathNoteMobs as unknown as string[][]).slice(0, 7)) {
    for (const mob of mobs) {
      const m = mapOf.indexOf(mob);
      n += deathNoteRank(m >= 0 ? accountMapKills(m) : 0, s);
    }
  }
  return n;
}

/** N.js Holes("MeasurementBonusTOTAL", 13) = MeasurementBaseBonus(13) ×
 *  MeasurementMulti(HolesInfo[52][13] = 6 → Deathnote skulls / 125). */
function measurement13(s: SaveData): number {
  const lv = H(s, 22, 13);
  const raw = info(55, 13); // "10TOT"
  const cosmo = 1 + cosmoBonus(s, 1, 3) / 100;
  const base = raw.includes("TOT")
    ? cosmo * ((Number(raw.replace("TOT", "")) * lv) / (100 + lv))
    : cosmo * Number(raw) * lv;
  const qty = deathNoteSkulls(s) / 125;
  const multi = qty < 5 ? 1 + (18 * qty) / 100 : 1 + (18 * qty + 8 * (qty - 5)) / 100;
  return base * multi;
}

/** N.js Holes("StudyBolaiaBonuses", b), generic branch (b ∉ {3, 9}). */
function studyBolaia(b: number, s: SaveData): number {
  return H(s, 26, b) * Number(info(70, b));
}

/** N.js Holes("JarCollectibleBonus", b). */
function jarCollectible(b: number, s: SaveData): number {
  return H(s, 24, b) * Number(info(67, b).split("|")[1]) * (1 + legendPTSbonus(29, s) / 100);
}

/** N.js Holes("GambitPTSmulti"). B_UPG(78, 10) has no special case: 10 once bought. */
export function gambitPtsMulti(s: SaveData): number {
  const bUpg78 = H(s, 13, 78) !== 0 ? 10 : 0;
  return (
    1 +
    (measurement13(s) +
      studyBolaia(13, s) +
      bUpg78 +
      computeMonumentROGbonus(2, 7, s) +
      jarCollectible(23, s) +
      jarCollectible(30, s) +
      arcaneUpgBonus(47, s)) /
      100
  );
}

/** N.js Holes("GambitPts", 777). */
export function gambitPoints(s: SaveData): number {
  let sum = 0;
  for (let b = 0; b <= 5; b++) {
    const v = H(s, 11, 65 + b);
    sum += (b === 0 ? 100 : 200) * (v + 3 * Math.floor(v / 10) + 10 * Math.floor(v / 60));
  }
  return sum * gambitPtsMulti(s);
}

export function gambitPtsReq(b: number): number {
  return 2e3 + 1e3 * (b + 1) * (1 + b / 5) * Math.pow(1.26, b);
}

/** N.js Holes("GambitBonuses", b) for b ≥ 1. */
export function gambitBonus(b: number, s: SaveData): number {
  const pts = gambitPoints(s);
  if (pts < gambitPtsReq(b)) return 0;
  const [val, scale] = info(71, b).split("|");
  return Number(scale) === 1 ? Number(val) * getLOG(pts) : Number(val);
}
