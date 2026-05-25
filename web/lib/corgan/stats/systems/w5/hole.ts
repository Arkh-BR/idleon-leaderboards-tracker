// ===== HOLE SYSTEM (W5) =====
// Cavern upgrades, brass schematics, measurements, monument bonuses.
// Pragmatic port: holes.resolve handles the DR descriptor's four ids
// (upg46, upg82, meas15, monument) at full fidelity. The gambit/research
// helpers (gambitPTSmulti, gambitBonus15, GambitBonus7) read from
// sim-math (deathNoteRank) which is outside our DR scope — they're
// omitted here and can land in Stage 4 when sim-math ports.

import { node, type CorganNode } from "../../../node";
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

// applyMonumentFountain: IT-only extension (not in corgan-source).
// The Fountain cavern's per-tier monument-boost upgrade multiplies
// the corresponding monument's bonuses by `1 + fountainBonusTotal(t, 13)/100`,
// clamped to ≥ 1. Applies for t = 0/1/2.
function applyMonumentFountain(base: number, saveData: SaveData, t: number): number {
  if (t !== 0 && t !== 1 && t !== 2) return base;
  const fb = fountainBonusTotal(saveData, t, 13);
  return Math.max(1, base * (1 + fb / 100));
}

export const holes = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const hd = saveData.holesData as any[];
    if (!hd) return node("Hole: " + id, 0);

    // Standard upgrades: multi × Holes[11][dataIdx] if building constructed
    const data = HOLE_DATA[id];
    if (data) {
      const built = ((hd[13] && (hd[13] as any)[data.buildIdx]) || 0) >= 1;
      const lv = Number((hd[11] && (hd[11] as any)[data.dataIdx]) || 0);
      const name = label("Cavern", id);
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
        return node(label("Measurement", 15), 0, null, { note: "hole:meas15" });
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
        label("Measurement", 15),
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
      let wisBonus = 0;
      if (wisLv > 0) {
        wisBonus =
          0.1 * Math.ceil((wisLv / (250 + wisLv)) * 10 * wisBonusPerLv);
      }

      const cosmo00Base = cosmoUpgBase(0, 0);
      const cosmo00Lv = Number((hd[4] && (hd[4] as any)[0]) || 0);
      const cosmoBonus = Math.floor(cosmo00Base * cosmo00Lv);

      const holeozDN = 1 + wisBonus / 100 + cosmoBonus / 100;
      // IT extension: fountain Wisdom-monument boost (t=2, i=13) multiplies
      // monument bonuses. Placeholder in current game data (perLv=0), but
      // included so any future activation flows through automatically.
      const finalMulti = applyMonumentFountain(holeozDN, ctx.saveData, t);
      const fountainTier = fountainBonusTotal(ctx.saveData, t, 13);

      const val =
        0.1 *
        Math.ceil(
          (monLv / (250 + monLv)) * 10 * bonusPerLv * finalMulti
        );

      const multiCh: CorganNode[] = [];
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
            "Wisdom Multiplier",
            holeozDN,
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
  resolve(id: string, ctx: Ctx): CorganNode {
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
