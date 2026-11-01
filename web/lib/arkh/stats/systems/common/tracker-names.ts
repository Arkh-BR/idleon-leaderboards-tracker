// Rows that sit inside helpers Drop Rate shares (arcade, talents), so the helpers
// keep their names; the stat trackers rename them where they call the helper.
import { renamedDeep, type ArkhNode } from "../../../node";
import { arcadeBonus } from "../w2/arcade";
import type { SaveData } from "../../../state";

const BUBBLE_CAP = /^(.+) \(W(\d) bubble (\[\d+\]\[\d+\])\) Lv$/;

function trackerName(name: string): [string, string?] | undefined {
  if (name === "Maxed Multi (Super 101 ×2 / Omega 102 ×6)") {
    return ["Maxed Multi (Super ×2 · Omega ×6)", "Arcade level 101 (Super) ×2, level 102 (Omega) ×6"];
  }
  if (name === "Cooking LV / 10") return ["Cooking level ÷ 10"];
  const m = BUBBLE_CAP.exec(name);
  return m ? [`${m[1]} (World ${m[2]} bubble) Lv`] : undefined;
}

/** A tracker's copy of a shared helper's node (a talent, say) with those rows renamed. */
export const trackerNamed = (n: ArkhNode): ArkhNode => renamedDeep(n, trackerName);

/** arcadeBonus(), its Maxed Multi row renamed. */
export function arcadeBonusNamed(idx: number, s: SaveData): { val: number; children: ArkhNode[] | null } {
  const a = arcadeBonus(idx, s);
  return { val: a.val, children: a.children && a.children.map(trackerNamed) };
}
