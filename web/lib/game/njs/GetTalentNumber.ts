import { asNumber } from "../attr";
import { block, type Ctx } from "../ctx";
import { TalentDescriptions } from "../data";
import { hString } from "../hstring";
import { skillLevel } from "../player";
import { ArbitraryCode5Inputs } from "./ArbitraryCode5Inputs";
import { Dungon } from "./Dungon";
import { allTalentLV, RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import type { Ported } from "../ported";

/** `CustomLists.TalentDescriptions[b][1]`: the talent's two curves, [0..2] the first (`d == 1`), [3..5] the second. */
export function talentCurves(b: number): readonly unknown[] {
  const row = (TalentDescriptions as unknown as readonly (readonly unknown[])[])[b | 0];
  // the game indexes TalentDescriptions[b][1][...] directly and would throw on a talent it does not have
  if (!row) throw new RangeError(`no talent ${b} in TalentDescriptions`);
  return row[1] as readonly unknown[];
}

/**
 * N.js `_customBlock_GetTalentNumber(d, b)` @4463103: talent `b`'s value for the current player, curve `d` (1 = the first, else the
 * second). 0 while the talent has no level; inside a dungeon (`Dungon() > 0`) the curve is read at level 50; elsewhere at the level plus
 * the levels every talent gets (`RunCodeOfTypeXforThingY("AllTalentLV", b)`).
 */
export const GetTalentNumber = block("GetTalentNumber", (ctx, d: number, b: number) => {
  if (0 >= skillLevel(ctx, b | 0)) return 0;
  const t = talentCurves(b);
  const curve = (level: number) =>
    1 == d
      ? ArbitraryCode5Inputs(ctx, hString(t[2]), asNumber(t[0]), asNumber(t[1]), level, 0, 0)
      : ArbitraryCode5Inputs(ctx, hString(t[5]), asNumber(t[3]), asNumber(t[4]), level, 0, 0);
  if (0 < Dungon(ctx)) return curve(50);
  return curve(RunCodeOfTypeXforThingY(ctx, "AllTalentLV", `${b}`) + skillLevel(ctx, b | 0));
});

/**
 * `GetTalentNumber(d, b)` as the game computes it while `TalentCalc(-3)` rebuilds DNSM.FamBonusQTYs: the same, but its "all talent levels"
 * read the half-built map's key 68 (`fam68`). Not a `block`: its value depends on that point of the rebuild, which the cache key cannot see.
 */
export function talentNumberDuringFamRebuild(ctx: Ctx, d: number, b: number, fam68: () => number): number {
  if (0 >= skillLevel(ctx, b | 0)) return 0;
  if (0 < Dungon(ctx)) return GetTalentNumber(ctx, d, b);
  const t = talentCurves(b);
  const level = allTalentLV(ctx, "AllTalentLV", `${b}`, fam68) + skillLevel(ctx, b | 0);
  return 1 == d
    ? ArbitraryCode5Inputs(ctx, hString(t[2]), asNumber(t[0]), asNumber(t[1]), level, 0, 0)
    : ArbitraryCode5Inputs(ctx, hString(t[5]), asNumber(t[3]), asNumber(t[4]), level, 0, 0);
}

/** A talent's curve `d` at `level`, as `getbonus2` and the family bonus read it (`TalentDescriptions[b][1][3(d-1)..3(d-1)+2]`). */
export function talentCurveAt(ctx: Ctx, d: number, b: number, level: number): number {
  const t = talentCurves(b);
  const k = Math.round(d - 1);
  return ArbitraryCode5Inputs(ctx, hString(t[Math.round(2 + 3 * k)]), asNumber(t[Math.round(3 * k)]), asNumber(t[Math.round(1 + 3 * k)]), level, 0, 0);
}

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
