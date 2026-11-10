// The final-bonus wrap of a talent's root (lib/talentsLevel/wraps.ts has the table): the wrapped node, or null for a talent that has no wrap.
import type { Ctx } from "@/lib/game/ctx";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import type { ArkhNode } from "@/lib/dropRate/node";
import { applyWrap, TALENT_WRAPS } from "../wraps";

/**
 * `raw` is the talent's curve value (what the plain root would show), `kids` its rows, `effectiveLv` its effective level (0 when it has none). `forced`: the what-if, whose `raw` is the forced curve and
 * stands as it is; otherwise an `ownFirst` talent takes the character's own GetTalentNumber(1,id) when it is above 0, as the game's TalentCalc does.
 */
export function wrapRow(c: Ctx, id: number, name: string, raw: number, kids: ArkhNode[], effectiveLv: number, forced = false): ArkhNode | null {
  const spec = TALENT_WRAPS[id];
  if (!spec) return null;
  const own = spec.ownFirst && !forced ? GetTalentNumber(c, 1, id) : 0;
  return applyWrap(c, spec, name, 0 < own ? own : raw, kids, effectiveLv);
}
