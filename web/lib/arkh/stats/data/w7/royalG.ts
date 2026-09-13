// ===== ROYAL GUARDIAN DATA (W7, 2026-08) =====
// Pure readers over the `RoyalG` / `RoyalMaps` save attributes + the ArmoryUpg
// and Research lists. Kept free of system imports so talent.ts can use
// armoryUpgBonus() without a cycle (systems/w7/royalG.ts imports talent for the
// DR-per-Grade term).
//
// RoyalG (verified on a live profile): [0] = Royal Statue levels, [1] =
// resource amounts, [2] = Armory upgrade levels, [5] = resource-node Grades.
// RoyalMaps[i] = the outpost on map i — an entry with ≥ 3 fields is built.
import { ArmoryUpg, Research } from "../game/customlists.js";

type RG = { royalGData?: any[]; royalMapsData?: any[] };

const num = (v: unknown): number => Number(v) || 0;

export function royalStatueLv(statueIdx: number, s: RG): number {
  return num(s.royalGData?.[0]?.[statueIdx]);
}

export function armoryUpgLv(b: number, s: RG): number {
  return num(s.royalGData?.[2]?.[b]);
}

// @njs ArmoryUpgBonus
// RoyalG[2][b] × ArmoryUpg[b][5] (level × per-level value).
export function armoryUpgBonus(b: number, s: RG): number {
  return armoryUpgLv(b, s) * num((ArmoryUpg as any)?.[b]?.[5]);
}

/** Royal Statue curve params: Research[41][b] = base, Research[42][b] = per level. */
export function royalStatueParams(statueIdx: number): { base: number; perLv: number } {
  return {
    base: num((Research as any)?.[41]?.[statueIdx]),
    perLv: num((Research as any)?.[42]?.[statueIdx]),
  };
}

/** "}千_DROP_RATE" → "Drop Rate" (Research[40] names). */
export function royalStatueName(statueIdx: number): string {
  const raw = String((Research as any)?.[40]?.[statueIdx] ?? `Statue ${statueIdx}`);
  const words = raw.split("_").slice(raw.startsWith("}") ? 1 : 0);
  return words
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// @njs StatueBon
// 0 while the statue is unbuilt; otherwise
//   (1 + Royal Reverence(Armory 45)/100) × (base + perLv × max(0, lv − 1)).
export function royalStatueBon(statueIdx: number, s: RG): number {
  const lv = royalStatueLv(statueIdx, s);
  if (lv <= 0) return 0;
  const { base, perLv } = royalStatueParams(statueIdx);
  return (1 + armoryUpgBonus(45, s) / 100) * (base + perLv * Math.max(0, lv - 1));
}

// @njs TotalStatz
// b = 0 branch: Σ RoyalG[5] — total resource-node Grades across all worlds.
export function totalResourceGrade(s: RG): number {
  const g = s.royalGData?.[5];
  return Array.isArray(g) ? g.reduce((a: number, v: unknown) => a + num(v), 0) : 0;
}

/** Σ RoyalG[0] — total Royal Statue levels (Tome task). */
export function totalRoyalStatueLv(s: RG): number {
  const st = s.royalGData?.[0];
  return Array.isArray(st) ? st.reduce((a: number, v: unknown) => a + num(v), 0) : 0;
}

/** Outposts built = RoyalMaps entries carrying ≥ 3 fields (Tome task). */
export function royalOutpostsBuilt(s: RG): number {
  const rm = s.royalMapsData;
  if (!Array.isArray(rm)) return 0;
  let n = 0;
  for (const e of rm) if (Array.isArray(e) && e.length >= 3) n++;
  return n;
}
