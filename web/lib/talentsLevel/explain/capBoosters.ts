// The cap row of a talent that has its own: N.js writes SkillLevelsMAX[id] = 100 + the boosters' talent numbers (TotalTalentPoints @4376078, SkillLevelsMAX[10] = 100 + GetTalentNumber(1,81) + GetTalentNumber(2,143) +
// getbonus2(1,51,-1)). The bubble-capped targets clamp a booster at the bubble's level and never lower the saved cap (SkillLevelsMAX[86] = max(100 + min(GetTalentNumber(1,129), CauldronInfo[0][1]), SkillLevelsMAX[86])
// @4377334; [87] @4377104): the saved SM is a floor for every target, as the game only ever raises it. A booster of kind "y" reads the talent's second curve (tab 2); an account-wide one is getbonus2(c, tab, src, -1).
// Rows, order, formats and notes are the page's (lib/arkh emitBaseLevelNode), because the Hypothetical tab compares by path.
import { asNum, asNumber } from "@/lib/game/attr";
import type { Ctx } from "@/lib/game/ctx";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { charKey, opt } from "@/lib/game/state";
import type { ArkhNode } from "@/lib/dropRate/node";
import { raw, row } from "@/lib/dropRate/explain/talent";
import { TALENT_CAP_BOOSTERS } from "../capBoosters";
import { plainTalent } from "./plain";

/** `Talent Cap (base + boosters)` of talent `id` as character `who` holds it; null for a talent with no booster entry (it keeps the Max Book Lv Cap). */
export function capBoosterRow(c: Ctx, id: number, who: number): ArkhNode | null {
  const entry = TALENT_CAP_BOOSTERS[id];
  if (!entry) return null;
  let total = entry.baseCap;
  const kids: ArkhNode[] = [raw("Base Cap (hardcoded)", entry.baseCap, "in-game hardcoded base for this talent")];
  for (const b of entry.boosters) {
    const tab = "y" === b.kind ? 2 : 1;
    const wide = "account-wide" === b.scope;
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
  const cap = 0 < saved ? Math.max(total, saved) : total; // 0: the game has not written this character's cap, the formula stands
  if (0 < saved) kids.push(saved !== total ? raw("Saved SkillLevelsMAX (override)", saved, "save's SM[id] differs from live formula — using max() to honor in-game ratcheting (N.js never decreases SM[id])") : raw("Saved SkillLevelsMAX (verified)", saved, "save's SM[id] matches the live formula exactly"));
  return raw("Talent Cap (base + boosters)", cap, entry.ratchet ? "max(base + boosters, savedSM[id]) — ratchets upward, verified vs SkillLevelsMAX" : "hardcoded base + cap boosters from talent descriptions (verified vs SkillLevelsMAX)", kids);
}
