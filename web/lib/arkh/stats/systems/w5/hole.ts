// ===== HOLE SYSTEM (W5) =====
// Cavern upgrades, brass schematics, measurements, monument bonuses.
// Pragmatic port: holes.resolve handles the DR descriptor's four ids
// (upg46, upg82, meas15, monument) at full fidelity. The gambit/research
// helpers (gambitPTSmulti, gambitBonus15, GambitBonus7) read from
// sim-math (deathNoteRank) which is outside our DR scope — they're
// omitted here and can land in Stage 4 when sim-math ports.

import { node, type ArkhNode } from "../../../node";
import { label } from "../../entity-names";
import { getLOG } from "../../../formulas";
import {
  cosmoUpgBase,
  holesMeasBase,
  holesMonBonus,
} from "../../data/w5/hole";
import { HolesInfo } from "../../data/game/customlists.js";
import { HOLE_MULTIPLIERS } from "../../data/game-constants";
import { fountainBonusTotal } from "../../data/w5/fountain";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

const HOLE_DATA = HOLE_MULTIPLIERS;

// N.js MonumentROGbonuses(b, e): HoleozDN = 1; when e != 9 it becomes
// 1 + MonumentROGbonuses(b, 9)/100 + CosmoBonusQTY(0,0)/100; then, for EVERY
// e (the Wisdom monument e = 9 included), b = 0/1/2 multiplies it by
// (1 + Fountain_BonTOT(b, 13)/100). The Fountain factor therefore boosts the
// Wisdom monument's own value AND the final multiplier — verified against the
// live game on ARKHE (DR monument 635.6, not 558.2).
function applyMonumentFountain(base: number, saveData: SaveData, t: number): number {
  if (t !== 0 && t !== 1 && t !== 2) return base;
  const fb = fountainBonusTotal(saveData, t, 13);
  return Math.max(1, base * (1 + fb / 100));
}

export const holes = {
  resolve(id: string, ctx: Ctx): ArkhNode {
    const saveData = ctx.saveData;
    const hd = saveData.holesData as any[];
    if (!hd) return node("Hole: " + id, 0);

    // Standard upgrades: multi × Holes[11][dataIdx] if building constructed.
    // Cavern upgrades have friendly names from N.js's HolesBuildings[buildIdx][0]
    // (customlists.js, "_" → " "):
    //   upg46 → "Gloomie Lootie" (+5% DR per Gloomie Mushroom colony cleared)
    //   upg82 → "Sanctum of LOOT" (+20% DR per Sanctum cleared)
    //   upg47 → "Gloomie Expie" (+25% Class EXP per Gloomie Mushroom colony cleared)
    //   upg83 → "Sanctum of EXP" (+40% Class EXP per Sanctum cleared)
    // Use those as the primary label and keep the cavern id as the tag. DR only
    // reads 46/82 (below) — 47/83 are additive, for the EXP Multi page only.
    const CAVERN_UPGRADE_NAMES: Record<string, string> = {
      upg46: "Gloomie Lootie",
      upg82: "Sanctum of LOOT",
      upg47: "Gloomie Expie",
      upg83: "Sanctum of EXP",
    };
    const data = HOLE_DATA[id];
    if (data) {
      const built = ((hd[13] && (hd[13] as any)[data.buildIdx]) || 0) >= 1;
      const lv = Number((hd[11] && (hd[11] as any)[data.dataIdx]) || 0);
      const friendly = CAVERN_UPGRADE_NAMES[id];
      const name = friendly
        ? `${friendly} (Cavern ${id})`
        : label("Cavern", id);
      if (!built)
        return node(
          name,
          0,
          [node("Not built", 0, null, { fmt: "raw" })],
          { note: "hole:" + id }
        );
      const val = data.multi * lv;
      return node(
        name,
        val,
        [
          node("Level", lv, null, { fmt: "raw" }),
          node("Multiplier", data.multi, null, { fmt: "x" }),
        ],
        { fmt: "+", note: "hole:" + id }
      );
    }

    if (id === "meas15") {
      const measLv = Number((hd[22] && (hd[22] as any)[15]) || 0);
      if (measLv <= 0)
        return node("Drop Rate Measurement (Measurement 15)", 0, null, { note: "hole:meas15" });
      const parsedVal = parseFloat(holesMeasBase(15) || "50") || 50;
      const cosmoRaw = Number((hd[5] && (hd[5] as any)[3]) || 0);
      const cosmoBonus = Math.floor(cosmoRaw * 25);
      const baseBonus =
        (1 + cosmoBonus / 100) * ((parsedVal * measLv) / (100 + measLv));

      const raw63 = Number((hd[11] && (hd[11] as any)[63]) || 0);
      const qty = raw63 > 1 ? Math.max(0, getLOG(raw63) - 2) : 0;
      const measMulti =
        qty < 5 ? 1 + (18 * qty) / 100 : 1 + (18 * qty + 8 * (qty - 5)) / 100;

      const val = baseBonus * measMulti;
      return node(
        "Drop Rate Measurement (Measurement 15)",
        val,
        [
          node("Measurement Level", measLv, null, { fmt: "raw" }),
          node("Cosmo Bonus", cosmoBonus, null, {
            fmt: "raw",
            note: "raw=" + cosmoRaw,
          }),
          node("Cosmo Multiplier", 1 + cosmoBonus / 100, null, { fmt: "x" }),
          node("Base Bonus", baseBonus, null, {
            fmt: "raw",
            note: "50×lv/(100+lv)×cosmo",
          }),
          node(
            "Meas Multi",
            measMulti,
            [
              node("Holes[11][63]", raw63, null, { fmt: "raw" }),
              node("QTY (type 10)", qty, null, {
                fmt: "raw",
                note: "max(0,log10(raw)-2)",
              }),
            ],
            { fmt: "x", note: "type 10" }
          ),
        ],
        { fmt: "+", note: "hole:meas15" }
      );
    }

    if (id === "monument") {
      const t = 2;
      const iDR = 6;
      const iWis = 9;
      const idx = 10 * t + iDR;
      const monLv = Number((hd[15] && (hd[15] as any)[idx]) || 0);
      if (monLv <= 0)
        return node("Monument Drop Rate", 0, null, { note: "hole:monument" });
      const bonusPerLv = holesMonBonus(26);

      const wisIdx = 10 * t + iWis;
      const wisLv = Number((hd[15] && (hd[15] as any)[wisIdx]) || 0);
      const wisBonusPerLv = holesMonBonus(29);
      // Wisdom monument = MonumentROGbonuses(2, 9): the Fountain factor is
      // inside its own ceil() too (N.js applies it for every e).
      const wisBonus = computeMonumentROGbonus(t, iWis, ctx.saveData);

      const cosmo00Base = cosmoUpgBase(0, 0);
      const cosmo00Lv = Number((hd[4] && (hd[4] as any)[0]) || 0);
      const cosmoBonus = Math.floor(cosmo00Base * cosmo00Lv);

      const holeozDN = 1 + wisBonus / 100 + cosmoBonus / 100;
      const finalMulti = applyMonumentFountain(holeozDN, ctx.saveData, t);
      const fountainTier = fountainBonusTotal(ctx.saveData, t, 13);

      const val =
        bonusPerLv < 30
          ? monLv * bonusPerLv * Math.max(1, finalMulti)
          : 0.1 *
            Math.ceil(
              (monLv / (250 + monLv)) * 10 * bonusPerLv * Math.max(1, finalMulti)
            );

      const multiCh: ArkhNode[] = [];
      if (wisBonus > 0)
        multiCh.push(
          node(
            "Wisdom Monument",
            wisBonus,
            [
              node("Wisdom Level", wisLv, null, { fmt: "raw" }),
              node("Bonus Per Level", wisBonusPerLv, null, { fmt: "raw" }),
            ],
            { fmt: "raw", note: "monument idx 29" }
          )
        );
      if (cosmoBonus > 0)
        multiCh.push(
          node(
            "Cosmo Upgrade",
            cosmoBonus,
            [node("Cosmo Level", cosmo00Lv, null, { fmt: "raw" })],
            { fmt: "raw", note: "cosmo 0/0" }
          )
        );
      if (fountainTier > 0)
        multiCh.push(
          node(
            "Fountain Wisdom Boost",
            1 + fountainTier / 100,
            [node("fountainTotal(2,13)", fountainTier, null, { fmt: "+" })],
            { fmt: "x", note: "fountain[2][13]" }
          )
        );
      return node(
        "Monument Drop Rate",
        val,
        [
          node("Monument Level", monLv, null, { fmt: "raw" }),
          node("Bonus Per Level", bonusPerLv, null, { fmt: "raw" }),
          node(
            // Show finalMulti (= holeozDN × fountain boost), the value actually
            // applied to `val`. Equals holeozDN for players without the Green
            // Water Wisdom_Boost (fb=0); reflects the boost when present.
            "Wisdom Multiplier",
            finalMulti,
            multiCh.length ? multiCh : null,
            { fmt: "x" }
          ),
        ],
        { fmt: "+", note: "hole:monument" }
      );
    }

    return node("Hole " + id, 0, null, { note: "hole:" + id });
  },
};

export function cosmoBonus(S: SaveData, t: number, i: number): number {
  const base = cosmoUpgBase(t, i);
  return Math.floor(
    base * (Number(S.holesData && (S.holesData[4 + t] as any)?.[i]) || 0)
  );
}

export function computeCosmoBonus(
  tier: number,
  idx: number,
  saveData: SaveData
): number {
  const holesArr = saveData.holesData && (saveData.holesData[4 + tier] as any);
  if (!holesArr) return 0;
  const lv = Number(holesArr[idx]) || 0;
  if (lv <= 0) return 0;
  const base = cosmoUpgBase(tier, idx);
  return Math.floor(base * lv);
}

export const cosmo = {
  resolve(id: string, ctx: Ctx): ArkhNode {
    const parts = String(id).split("_");
    const tier = Number(parts[0]) || 0;
    const idx = Number(parts[1]) || 0;
    const val = computeCosmoBonus(tier, idx, ctx.saveData);
    const lv =
      Number(
        ctx.saveData.holesData &&
          (ctx.saveData.holesData[4 + tier] as any)?.[idx]
      ) || 0;
    return node(
      label("Cosmo", tier + "/" + idx),
      val,
      [
        node("Level", lv, null, { fmt: "raw" }),
        node("Base", cosmoUpgBase(tier, idx), null, { fmt: "raw" }),
      ],
      { fmt: "+", note: "cosmo " + tier + "/" + idx }
    );
  },
};

export function computeMonumentROGbonus(
  t: number,
  i: number,
  saveData: SaveData
): number {
  const holesArr = saveData.holesData && (saveData.holesData[15] as any);
  if (!holesArr) return 0;
  const slot = 10 * t + i;
  const level = Number(holesArr[slot]) || 0;
  if (level <= 0) return 0;
  const bonusInfo = Number((HolesInfo as any)[37]?.[slot]) || 0;
  if (bonusInfo <= 0) return 0;

  let holeozDN = 1;
  if (i !== 9) {
    holeozDN =
      1 +
      computeMonumentROGbonus(t, 9, saveData) / 100 +
      computeCosmoBonus(0, 0, saveData) / 100;
  }
  // Fountain (t, 13) multiplies HoleozDN for every i — the Wisdom monument
  // (i = 9) included, so it compounds into the other monuments' multiplier.
  holeozDN = applyMonumentFountain(holeozDN, saveData, t);

  if (bonusInfo < 30) {
    return level * bonusInfo * Math.max(1, holeozDN);
  } else {
    return (
      0.1 *
      Math.ceil(
        (level / (250 + level)) * 10 * bonusInfo * Math.max(1, holeozDN)
      )
    );
  }
}
