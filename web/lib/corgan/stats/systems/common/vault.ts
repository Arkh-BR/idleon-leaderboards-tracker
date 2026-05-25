// ===== VAULT SYSTEM =====
// 1:1 port replacing the Stage 2 stub.
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { VAULT_NO_MASTERY } from "../../data/game-constants";
import { vaultUpgPerLevel } from "../../data/common/vault";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

export function vaultUpgBonus(idx: number, saveData: SaveData): number {
  if (!saveData || !saveData.vaultData) return 0;
  const level = Number((saveData.vaultData as any)[idx]) || 0;
  if (level <= 0) return 0;
  const perLv = vaultUpgPerLevel(idx);
  if (perLv == null) return 0;
  let base = level * perLv;
  if (idx === 0) {
    base +=
      Math.max(0, level - 25) + Math.max(0, level - 50) + Math.max(0, level - 100);
  }
  if (idx === 60) {
    base +=
      Math.max(0, level - 25) +
      Math.max(0, level - 50) +
      2 * Math.max(0, level - 100) +
      3 * Math.max(0, level - 200) +
      5 * Math.max(0, level - 300) +
      7 * Math.max(0, level - 400) +
      10 * Math.max(0, level - 450);
    base *= 1 + Math.floor(level / 25) / 5;
  }
  if (!VAULT_NO_MASTERY.has(idx)) {
    let masteryLv = 0;
    const vd = saveData.vaultData as any;
    if (idx < 32) masteryLv = Number(vd[32]) || 0;
    else if (idx <= 60) masteryLv = Number(vd[61]) || 0;
    else if (idx <= 88) masteryLv = Number(vd[89]) || 0;
    base *= 1 + masteryLv / 100;
  }
  return base;
}

export const vault = {
  resolve(id: number, ctx: Ctx): CorganNode {
    const name = label("Vault", id);
    const vd = ctx.saveData.vaultData as any;
    const lv = vd ? Number(vd[id]) || 0 : 0;
    const perLevel = vaultUpgPerLevel(id);
    let baseVal = perLevel * lv;
    if (id === 0) {
      baseVal +=
        Math.max(0, lv - 25) + Math.max(0, lv - 50) + Math.max(0, lv - 100);
    }
    if (id === 60) {
      baseVal +=
        Math.max(0, lv - 25) +
        Math.max(0, lv - 50) +
        2 * Math.max(0, lv - 100) +
        3 * Math.max(0, lv - 200) +
        5 * Math.max(0, lv - 300) +
        7 * Math.max(0, lv - 400) +
        10 * Math.max(0, lv - 450);
      baseVal *= 1 + Math.floor(lv / 25) / 5;
    }

    let masteryLv = 0;
    if (!VAULT_NO_MASTERY.has(id) && vd) {
      if (id < 32) masteryLv = Number(vd[32]) || 0;
      else if (id <= 60) masteryLv = Number(vd[61]) || 0;
      else if (id <= 88) masteryLv = Number(vd[89]) || 0;
    }
    const masteryMulti = 1 + masteryLv / 100;
    const val = baseVal * masteryMulti;

    const children: CorganNode[] = [
      node("Level", lv, null, { fmt: "raw" }),
      node("Per Level", perLevel, null, { fmt: "raw" }),
    ];
    if (masteryLv > 0) {
      children.push(
        node(
          "Mastery",
          masteryMulti,
          [node("Mastery Lv", masteryLv, null, { fmt: "raw" })],
          { fmt: "x" }
        )
      );
    }
    return node(name, val, children, { fmt: "+", note: "vault " + id });
  },
};
