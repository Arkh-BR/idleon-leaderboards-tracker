// ===== VOTING SYSTEM (W2) =====
import { node, type CorganNode } from "../../../node";
import { label } from "../../entity-names";
import { votingBonusValue } from "../../data/common/voting";
import type { SaveData } from "../../../state";

type Ctx = {
  saveData: SaveData;
  resolve?: (descId: string) => { val: number; children?: CorganNode[] } | null;
};

export function votingBonusz(voteIdx: number, votingMulti: number | undefined, saveData: SaveData): number {
  const base = votingBonusValue(voteIdx);
  if (base === 0) return 0;
  if (saveData.activeVoteIdx !== voteIdx) return 0;
  const multi = votingMulti != null ? votingMulti : 1;
  return base * multi;
}

const VOTING_DATA: Record<number, { base: number; name: string }> = {
  27: { base: votingBonusValue(27), name: "Voting Bonus (DR)" },
};

export const voting = {
  resolve(id: number, ctx: Ctx): CorganNode {
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
