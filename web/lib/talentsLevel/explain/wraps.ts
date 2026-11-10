// The final-bonus wrap of a talent's root (lib/talentsLevel/wraps.ts has the table): the wrapped node, or null for a talent that has no wrap, or whose counter is not on lib/game yet and keeps the plain shape.
import type { Ctx } from "@/lib/game/ctx";
import type { ArkhNode } from "@/lib/dropRate/node";
import { applyWrap, TALENT_WRAPS, WRAP_COUNTER_PENDING } from "../wraps";

/** `raw` is the talent's curve value (what the plain root would show), `kids` its rows, `effectiveLv` its effective level (0 when it has none). */
export function wrapRow(c: Ctx, id: number, name: string, raw: number, kids: ArkhNode[], effectiveLv: number): ArkhNode | null {
  const spec = TALENT_WRAPS[id];
  if (!spec || WRAP_COUNTER_PENDING.has(id)) return null;
  return applyWrap(c, spec, name, raw, kids, effectiveLv);
}
