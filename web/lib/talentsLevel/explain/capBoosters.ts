// The cap row of a talent that has its own: N.js writes SkillLevelsMAX[id] in TotalTalentPoints from the character's own talents.
// - The stat targets are reassigned, no max with the saved value: SkillLevelsMAX[10] = 100 + GetTalentNumber(1,81) + GetTalentNumber(2,143) + getbonus2(1,51,-1) @4376078; 11, 12, 23 and 75 likewise (@4376759 for 75, @4376913 for 23).
// - The bubble targets ratchet: SkillLevelsMAX[86] = max(100 + min(GetTalentNumber(1,129), CauldronInfo[0][1]), SkillLevelsMAX[86]) @4377334; [87] @4377104, [266] @4377631, [446] @4378162 (and 267, 447 beside them).
// - 79 is a bubble clamp that does NOT ratchet: SkillLevelsMAX[79] = max(100 + min(GetTalentNumber(1,39), CauldronInfo[3][0]), 100) @4378692, the inner max is the literal 100, not the saved value.
// So the saved SM raises the cap only for the entries with `ratchet`; for the others it is information (the game recomputes it). A booster of kind "y" on a per-char source reads the second curve (tab 2); an account-wide one is
// always getbonus2(1, src, -1) (tab 1), whatever its kind. Rows, order, formats and notes are the page's (lib/arkh emitBaseLevelNode), because the Hypothetical tab compares by path.
import { asNum, asNumber } from "@/lib/game/attr";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { charKey, opt } from "@/lib/game/state";
import type { ArkhNode } from "@/lib/dropRate/node";
import { raw, row } from "@/lib/dropRate/explain/talent";
import { TALENT_CAP_BOOSTERS } from "../capBoosters";
import { plainTalent } from "./plain";

/** `Talent Cap (base + boosters)` of talent `id` as character `who` holds it; null for a talent with no booster entry (it keeps the Max Book Lv Cap). */
export function capBoosterRow(cur: Ctx, id: number, who: number): ArkhNode | null {
  const c = withPlayer(cur, who); // the game writes SM[id] from the owner's own talents
  const entry = TALENT_CAP_BOOSTERS[id];
  if (!entry) return null;
  let total = entry.baseCap;
  const kids: ArkhNode[] = [raw("Base Cap (hardcoded)", entry.baseCap, "in-game hardcoded base for this talent")];
  for (const b of entry.boosters) {
    const wide = "account-wide" === b.scope;
    const tab = !wide && "y" === b.kind ? 2 : 1;
    const value = wide ? getbonus2(c, tab, b.sourceTalent, -1) : GetTalentNumber(c, tab, b.sourceTalent);
    const source = plainTalent(c, b.sourceTalent, { split: false });
    const tree = raw(source.name, value, wide ? "best-char emit (mode=max) — full breakdown" : "per-char emit — full breakdown", source.children);
    let v = value;
    let sub: ArkhNode[] = [tree];
    if (b.bubbleCap) {
      const { chapter, slot, bubbleLabel } = b.bubbleCap;
      const level = asNum(c, "CauldronInfo", chapter, slot);
      v = Math.min(value, level);
      sub = [raw("Booster Raw", value, "x-bonus from source talent before bubble clamp", [tree]), raw(`${bubbleLabel} Lv`, level, `CauldronInfo[${chapter}][${slot}] — clamp ceiling`)];
    }
    total += v;
    kids.push(row(b.label, v, "+", b.bubbleCap ? `min(raw, bubble Lv) — ${b.scope}` : wide ? "account-wide" : "per-char", sub));
  }
  const saved = asNumber(opt(c.state, charKey("SM", who), id));
  const cap = entry.ratchet && 0 < saved ? Math.max(total, saved) : total;
  if (0 < saved) {
    const differs = saved !== total;
    const why = !differs ? "save's SM[id] matches the live formula exactly" : entry.ratchet ? "save's SM[id] differs from live formula — using max() to honor in-game ratcheting (N.js never decreases SM[id])" : "save's SM[id] differs from live formula — the game recomputes it (N.js reassigns SM[id], no max()), the formula wins";
    kids.push(raw(differs ? "Saved SkillLevelsMAX (override)" : "Saved SkillLevelsMAX (verified)", saved, why));
  }
  return raw("Talent Cap (base + boosters)", cap, entry.ratchet ? "max(base + boosters, savedSM[id]) — ratchets upward, verified vs SkillLevelsMAX" : "hardcoded base + cap boosters from talent descriptions — the game recomputes SM[id], no ratchet", kids);
}
