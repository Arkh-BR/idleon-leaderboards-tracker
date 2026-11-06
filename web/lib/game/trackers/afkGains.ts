// The AFK Gains tracker. This commit holds the page's rate (`afkFightRate`: the A9 rule and the Cove override, product logic that is no N.js
// block); the tree adapter follows in the next one.
//
// Decisions in force (the page's, kept from lib/arkh): A9 (spec 2026-09-24-afk-gains-page-design.md:53) a skill target shows the Fighting rate,
// and Nothing, Paying_Respect or a target with no definition gives 0; the Cove (map 216, cavern 17) counts as a fight whatever its target says;
// Ruling V, the AFK target follows ctx.map (lib/game/afkTarget.ts).
import { attr } from "../attr";
import { afkTarget } from "../afkTarget";
import { assumed, type Ctx } from "../ctx";
import { MONSTERS } from "../data";
import { AFKgainrates } from "../njs/AFKgainrates";

/** The Cove: map 216 with the character in cavern 17 (Holes[0][character]), where its rate replaces everything (AFKgainrates @4447xxx). */
const inCove = (ctx: Ctx): boolean => 216 == ctx.map && 17 == attr(ctx, "Holes", 0, ctx.player);
const typeOf = (target: string): string | undefined => (MONSTERS as unknown as Record<string, { AFKtype?: string } | undefined>)[target]?.AFKtype;
/** The block name of the A9 trace leaf (it stands for no N.js function: `assumed()` leaves are no calls). */
const TARGET_LEAF = "AFK target";

/**
 * The AFK page's rate: `AFKgainrates("Fighting")` on `ctx.map`, or 0 when the AFK target of that map has nothing to fight. This is page
 * product logic (decision A9 and the Cove override), not an N.js block. The game's AFK panel (@3803300) prints a literal 0% for a target whose
 * MonsterDefinitions AFKtype is "Nothing" or "Paying_Respect"; a target with no MonsterDefinitions entry (the maps whose default target is "Z"
 * or "Filler": no monster) has no panel at all. Those give 0 here. A skill target (MINING, CHOPPIN...) shows that skill's own rate in the game;
 * the page shows the Fighting rate there instead (A9), so it is not 0. The Cove counts as a fight whatever its target says (product decision).
 * The target is checked before the rate, so a map with nothing to fight computes nothing here.
 *
 * Both A9 branches leave an `assumed:` leaf in the trace (`AFK target`, value 0 or 1) so the page can say why; a plain fight leaves none.
 */
export function afkFightRate(ctx: Ctx): number {
  if (inCove(ctx)) return AFKgainrates(ctx, "Fighting");
  const target = afkTarget(ctx);
  const type = typeOf(target);
  if (undefined === type || "Nothing" == type || "Paying_Respect" == type) {
    assumed(
      ctx,
      TARGET_LEAF,
      undefined === type ? `${target} has no monster to fight: this page shows 0` : `the AFK target ${target} (${type}) has nothing to fight: this page shows 0`,
      0,
      `page decision A9 (docs/superpowers/specs/2026-09-24-afk-gains-page-design.md:53): map ${ctx.map}, target ${target}, AFKtype ${type ?? "no definition"}`
    );
    return 0;
  }
  if ("FIGHTING" != type)
    assumed(
      ctx,
      TARGET_LEAF,
      `the AFK target ${target} is a ${type} skill, whose own rate the game shows: this page shows the Fighting rate`,
      1,
      `page decision A9 (docs/superpowers/specs/2026-09-24-afk-gains-page-design.md:53): map ${ctx.map}, target ${target}, AFKtype ${type}`
    );
  return AFKgainrates(ctx, "Fighting");
}
