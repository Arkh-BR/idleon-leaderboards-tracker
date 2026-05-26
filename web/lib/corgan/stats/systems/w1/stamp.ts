// ===== STAMP SYSTEM (W1) =====
// 1:1 port of corgan-source/js/stats/systems/w1/stamp.js.
// Cross-deps on Stage 3/4 (pristine, setBonus, vault, mainframe, legendPTS,
// sushi RoG, compass, palette, exotic) are stubbed; their stubs return 0,
// which makes the stamp doubler default to 100 (no exalted multiplier) —
// matching the game's behavior for un-doubled stamps.

import { node, treeResult, type CorganNode, type TreeResult } from "../../../node";
import { label } from "../../entity-names";
import { stampLvData } from "../../../save/data";
import { formulaEval } from "../../../formulas";
import { eventShopOwned } from "../../../game-helpers";
import { pristineBon } from "../w5/pristine";
import { getSetBonus } from "../w3/setBonus";
import { vaultUpgBonus } from "../common/vault";
import { mainframeBonus } from "../w4/lab";
import { legendPTSbonus } from "../w7/spelunking";
import { exoticParams } from "../../data/w5/farming";
import { paletteParams } from "../../data/w4/gaming";
import { compassUpgPerLevel } from "../../data/common/compass";
import { rogBonusQTY } from "../w7/sushi";
import { STAMP_DATA } from "../../data/w1/stamp";
import { ITEMS } from "../../data/game/items.js";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData };

const N2L = "_abcdefghijklmnopqrstuvwxyz";

export function stampKey(cat: number, idx: number): string {
  return (N2L[cat] || "_") + idx;
}

export function isExalted(cat: number, idx: number, saveData: SaveData): boolean {
  const key = stampKey(cat, idx);
  const exaltedArr = saveData.compassData && saveData.compassData[4];
  if (!exaltedArr || !Array.isArray(exaltedArr)) return false;
  return exaltedArr.indexOf(key) !== -1;
}

export function computeStampDoublerSources(saveData: SaveData): { total: number; children: CorganNode[] } {
  const atom12 = Number(saveData.atomsData && saveData.atomsData[12]) || 0;
  const prist20 = pristineBon(20, saveData);
  const compassLv =
    (saveData.compassData &&
      saveData.compassData[0] &&
      Number((saveData.compassData[0] as any)[76])) ||
    0;
  const compass76 = compassLv * compassUpgPerLevel(76);
  const emperorSet = getSetBonus("EMPEROR_SET").val;
  const evShop18 = 20 * eventShopOwned(18, saveData.cachedEventShopStr);

  const paletteLv =
    (saveData.spelunkData &&
      saveData.spelunkData[9] &&
      Number((saveData.spelunkData[9] as any)[23])) ||
    0;
  const pal23 = paletteParams(23);
  const palRaw23 =
    paletteLv > 0 ? (paletteLv / (paletteLv + pal23.denom)) * pal23.coeff : 0;
  const palLegendMulti = 1 + legendPTSbonus(10, saveData) / 100;
  const loreFlag8 =
    Number(
      (saveData.spelunkData &&
        saveData.spelunkData[0] &&
        (saveData.spelunkData[0] as any)[8]) ||
        0
    ) >= 1
      ? 1
      : 0;
  const palLoreMulti = 1 + 0.5 * loreFlag8;
  const palette23 = palRaw23 * palLegendMulti * palLoreMulti;

  const ex49 = exoticParams(49);
  const exoticLv =
    (saveData.farmUpgData && Number((saveData.farmUpgData as any)[ex49.farmSlot])) || 0;
  const exotic49 =
    exoticLv > 0 ? (ex49.base * exoticLv) / (ex49.denom + exoticLv) : 0;

  const spelunk43 = Math.round(
    Number(
      (saveData.spelunkData &&
        saveData.spelunkData[4] &&
        (saveData.spelunkData[4] as any)[3]) ||
        0
    )
  );

  const legend36 = legendPTSbonus(36, saveData);
  const sushiRoG17 = rogBonusQTY(17, saveData.cachedUniqueSushi || 0);

  const innerSum =
    atom12 + prist20 + compass76 + emperorSet + evShop18 + palette23 + exotic49 + spelunk43;
  const total = 100 + innerSum + legend36 + sushiRoG17;

  // Sub-source names mirror IT's website-data:
  //   atomsInfo[12]      → Aluminium - Stamp Supercharger
  //   pristineCharms[20] → Jellypick
  //   compass[76]        → Abomination Slayer XVII
  //   exoticMarketInfo[49] → EXALTED ELDOU
  //   legendTalents[36]  → Wowa Woowa
  //   research[36][17]   → Exalted Bonus +0.01x (sushi RoG slot 17)
  const children: CorganNode[] = [
    node("Base Doubler", 100, null, { fmt: "raw" }),
    node(
      "Aluminium — Stamp Supercharger (Atom 12)",
      atom12,
      null,
      { fmt: "+" }
    ),
    node("Jellypick (Pristine 20)", prist20, null, { fmt: "+" }),
    node(
      "Abomination Slayer XVII (Compass 76)",
      compass76,
      compass76 > 0
        ? [node("Compass Level", compassLv, null, { fmt: "raw" })]
        : null,
      { fmt: "+" }
    ),
    node("Emperor Set", emperorSet, null, { fmt: "+" }),
    node(label("Event", 18, " (×20)"), evShop18, null, { fmt: "+" }),
    node(
      label("Palette", 23),
      palette23,
      paletteLv > 0
        ? [node("Palette Level", paletteLv, null, { fmt: "raw" })]
        : null,
      { fmt: "+" }
    ),
    node(
      "EXALTED ELDOU (Exotic 49)",
      exotic49,
      exoticLv > 0
        ? [node("Exotic Level", exoticLv, null, { fmt: "raw" })]
        : null,
      { fmt: "+" }
    ),
    node(
      "Spelunk Legend Talent Slot (Spelunk 4,3)",
      spelunk43,
      null,
      { fmt: "+" }
    ),
    node("Wowa Woowa (Legend 36)", legend36, null, { fmt: "+" }),
    node("Exalted Bonus RoG (Sushi 17)", sushiRoG17, null, { fmt: "+" }),
  ];

  return { total, children };
}

export const stamp = {
  resolve(id: string, ctx: Ctx): CorganNode {
    const data = STAMP_DATA[id];
    if (!data) return node(label("Stamp", id), 0, null, { note: "no formula data" });
    const lv = Number(
      (stampLvData && (stampLvData as any)[data.cat] && (stampLvData as any)[data.cat][data.idx]) || 0
    );
    if (lv <= 0) return node(label("Stamp", id), 0, null, { note: "Level 0 — not collected" });
    const baseVal = formulaEval(data.formula, data.x1, data.x2, lv);

    const exalted = isExalted(data.cat, data.idx, ctx.saveData);
    const doublerInfo = computeStampDoublerSources(ctx.saveData);
    const exaltedMulti = exalted ? 1 + doublerInfo.total / 100 : 1;
    let val = baseVal * exaltedMulti;

    let labDouble = 1;
    let pristineMulti = 1;
    if (data.cat < 2) {
      if (mainframeBonus(7, ctx.saveData) === 2) labDouble = 2;
      const prist17 = pristineBon(17, ctx.saveData);
      if (prist17 > 0) pristineMulti = 1 + prist17 / 100;
      val = val * labDouble * pristineMulti;
    }

    const stampChildren: CorganNode[] = [
      node("Stamp Level", lv, null, { fmt: "raw" }),
      node("Formula Result", baseVal, null, {
        fmt: "raw",
        note: data.formula + "(" + data.x1 + "," + data.x2 + "," + lv + ")",
      }),
    ];

    if (exalted) {
      stampChildren.push(
        node(
          "Exalted ×",
          exaltedMulti,
          [
            node("StampDoubler", doublerInfo.total, doublerInfo.children, { fmt: "raw" }),
          ],
          { fmt: "x" }
        )
      );
    } else {
      stampChildren.push(
        node(
          "Exalted",
          0,
          [
            node(
              'Not exalted (Compass[4] missing key "' + stampKey(data.cat, data.idx) + '")',
              0,
              null,
              { fmt: "raw" }
            ),
            node(
              "StampDoubler (if exalted)",
              doublerInfo.total,
              doublerInfo.children,
              { fmt: "raw" }
            ),
          ],
          { fmt: "raw", note: "inactive" }
        )
      );
    }

    if (data.cat < 2) {
      if (labDouble > 1) {
        stampChildren.push(
          node("Certified Stamp Book ×", labDouble, null, {
            fmt: "x",
            note: "Lab node 7",
          })
        );
      }
      if (pristineMulti > 1) {
        stampChildren.push(
          node("Liquorice Rolle ×", pristineMulti, null, {
            fmt: "x",
            note: "Pristine 17",
          })
        );
      }
    }

    return node(label("Stamp", id), val, stampChildren, {
      fmt: "+",
    });
  },
};

// ==================== STAMP BONUS OF TYPE X ====================
let _stampTypeCache: Record<string, any[]> | null = null;
function buildStampTypeMap(): Record<string, any[]> {
  if (_stampTypeCache) return _stampTypeCache;
  _stampTypeCache = {};
  const _items = ITEMS as Record<string, any>;
  const keys = Object.keys(_items);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.indexOf("Stamp") !== 0 || k.length < 7) continue;
    const item = _items[k];
    if (!item || !item.desc_line1) continue;
    const parts = String(item.desc_line1).split(",");
    const type = parts[0];
    const catLetter = k[5];
    const catNum = catLetter === "A" ? 0 : catLetter === "B" ? 1 : 2;
    const idx = item.ID - catNum * 1000;
    if (!_stampTypeCache[type]) _stampTypeCache[type] = [];
    _stampTypeCache[type].push({
      cat: catNum,
      idx,
      x1: Number(parts[2]),
      x2: Number(parts[3]),
      formula: parts[1],
    });
  }
  return _stampTypeCache;
}

export function computeStampBonusOfTypeX(typeKey: string, saveData: SaveData): TreeResult {
  const map = buildStampTypeMap();
  const stamps = map[typeKey];
  if (!stamps) return treeResult(0, null);
  let total = 0;
  const children: CorganNode[] = [];
  let doublerTotal: number | null = null;
  const labDouble = mainframeBonus(7, saveData) === 2 ? 2 : 1;
  const prist17 = pristineBon(17, saveData) || 0;
  const pristMulti = prist17 > 0 ? 1 + prist17 / 100 : 1;

  for (let si = 0; si < stamps.length; si++) {
    const st = stamps[si];
    const lv = Number(
      (stampLvData && (stampLvData as any)[st.cat] && (stampLvData as any)[st.cat][st.idx]) || 0
    );
    if (lv <= 0) continue;
    let val = formulaEval(st.formula, st.x1, st.x2, lv);
    let noteStr = "lv=" + lv;
    if (isExalted(st.cat, st.idx, saveData)) {
      if (doublerTotal === null) {
        const _d = computeStampDoublerSources(saveData);
        doublerTotal = _d.total;
      }
      val *= 1 + doublerTotal / 100;
      noteStr += " exalted";
    }
    if (st.cat < 2) {
      val *= labDouble * pristMulti;
    }
    total += val;
    children.push(
      node(stampKey(st.cat, st.idx), val, null, { fmt: "raw", note: noteStr })
    );
  }
  if (
    typeKey === "BaseDmg" ||
    typeKey === "BaseHP" ||
    typeKey === "BaseAcc" ||
    typeKey === "BaseDef"
  ) {
    const vault16 = vaultUpgBonus(16, saveData);
    if (vault16 > 0) total *= 1 + vault16 / 100;
  }
  return treeResult(total, children);
}
