// ===== VOTING SYSTEM (W2) =====
import { node, type ArkhNode } from "../../../node";
import { label } from "../../entity-names";
import { votingBonusValue, votingWorldReq } from "../../data/common/voting";
import { buffsActiveData, klaData, optionsListData } from "../../../save/data";
import { totalTitanKills } from "../w6/upg-totals";
import type { SaveData } from "../../../state";

type Ctx = {
  saveData: SaveData;
  resolve?: (descId: string) => { val: number; children?: ArkhNode[] } | null;
};

// @njs _customBlock_Summoning2
/** N.js Summoning("VotingBonusz", b) (@10953438): NinjaInfo[38][1 + 3b] ×
 *  VotingBonuszMulti while b is the active vote. Vote 1 (damage) also counts
 *  for character `ci` while it hasn't reached the world the active vote asks
 *  for (GenINFO[58] < NinjaInfo[38][2 + 3·max(1, active)]). */
export function votingBonusz(voteIdx: number, votingMulti: number | undefined, saveData: SaveData, ci?: number): number {
  const base = votingBonusValue(voteIdx);
  if (base === 0) return 0;
  const active = saveData.activeVoteIdx;
  const on =
    active === voteIdx ||
    (voteIdx === 1 && ci != null && worldsReached(ci, saveData) < votingWorldReq(Math.max(1, active)));
  if (!on) return 0;
  const multi = votingMulti != null ? votingMulti : 1;
  return base * multi;
}

// A buff on the character's saved BuffsActive with over 100 s left.
function buffLasting(id: number, ci: number): boolean {
  const list = (buffsActiveData as any[])[ci];
  if (!list || typeof list !== "object") return false;
  return Object.keys(list).some((k) => k !== "length" && Number(list[k]?.[0]) === id && Number(list[k]?.[1]) > 100);
}

/** The portal actor's GenINFO[58] (@5542319), set when a map loads: 1 plus
 *  the worlds whose town portal (maps 0, 50, … 250) the character has opened.
 *  With Compass Tempest (buff 420) up it reads the titan kills each town needs
 *  (3/8/17/25/30), with Tesseract Arcanist (buff 585) the Tess[0] portal list,
 *  else the character's KillsLeft2Advance. The buffs read the saved timers. */
// @njs _customBlock_Windwalker
// @njs _customBlock_ArcaneType
function worldsReached(ci: number, s: SaveData): number {
  const kla = (klaData as any[])[ci] || [];
  // Kills left on map b's portal; a map the save doesn't list stays shut.
  const left = (b: number) => (kla[b]?.[0] == null ? Infinity : Number(kla[b][0]) || 0);
  let w = 1;
  if (buffLasting(420, ci)) {
    const titans = totalTitanKills(s);
    const capped = Number((optionsListData as any[])[387]) === 1;
    [3, 8, 17, 25, 30].forEach((req, k) => {
      if (titans >= req && (!capped || left(50 * k) < 1)) w = k + 2;
    });
  } else if (buffLasting(585, ci)) {
    const tess = ((s.tessData as any[])?.[0] as string[]) || [];
    for (let k = 0; k < 5; k++) if (tess.includes(`${50 * k}_0`)) w = k + 2;
  } else {
    for (let k = 0; k < 6; k++) if (left(50 * k) <= 0) w = k + 2;
  }
  return w;
}

const VOTING_DATA: Record<number, { base: number; name: string }> = {
  27: { base: votingBonusValue(27), name: "Voting Bonus (DR)" },
};

export const voting = {
  resolve(id: number, ctx: Ctx): ArkhNode {
    const saveData = ctx.saveData;
    const data = VOTING_DATA[id];
    if (!data) return node(label("Voting", id), 0, null, { note: "voting " + id });
    if (saveData.activeVoteIdx !== id) {
      return node(
        data.name,
        0,
        [
          node("Not active vote", 0, null, {
            fmt: "raw",
            note: "active=" + saveData.activeVoteIdx,
          }),
        ],
        { note: "voting " + id }
      );
    }
    const vm = ctx.resolve ? ctx.resolve("voting-multi") : null;
    const multi = vm ? vm.val : 1;
    const multiChildren = vm ? vm.children : undefined;
    const val = data.base * multi;
    return node(
      data.name,
      val,
      [
        node("Base", data.base, null, { fmt: "raw" }),
        node("Voting Multi", multi, multiChildren, { fmt: "x" }),
      ],
      { fmt: "+", note: "voting " + id }
    );
  },
};
