import { asNumber, attr } from "../attr";
import { block, type Ctx } from "../ctx";
import { CardStuff, IDforCardBonus } from "../data";
import { InvalidSaveValue, MissingSaveKey, NotPorted } from "../errors";
import { hString } from "../hstring";
import { chipBonuses } from "./chipBonuses";
import { RunCodeOfTypeXforThingY } from "./RunCodeOfTypeXforThingY";
import { Thingies } from "./Thingies";
import type { Ported } from "../ported";

/** The card info map (`ActorEvents_312`'s GenINFO[45], @7493547): card name -> its CardStuff row. */
const CARD_ROW: ReadonlyMap<string, readonly unknown[]> = (() => {
  const m = new Map<string, readonly unknown[]>();
  for (const group of CardStuff as unknown as readonly (readonly (readonly unknown[])[])[]) for (const row of group) m.set(hString(row[0]), row);
  return m;
})();

const ids = IDforCardBonus as Readonly<Record<string, string>>;
/**
 * The keys `TalentCalc(-4)` rewrites after the equipped cards, when a Rift skill bonus or Vault 44 is on: it zeroes IDforCardBonus 24, 25,
 * 33, 34 (Rift skill 0), 27, 28, 36, 37 (2), 30, 31, 39, 45 (3), 32, 40, 41, 75 (5), 53, 57, 58 (6), 54, 55, 52 (8), 97, 98, 99 (18) and
 * 12 (Vault 44), and adds every card of the skill those keys name. Not ported: a key read here that is one of them throws.
 */
const REWRITTEN = new Set(["24", "25", "33", "34", "27", "28", "36", "37", "30", "31", "39", "45", "32", "40", "41", "75", "53", "57", "58", "54", "55", "52", "97", "98", "99", "12"].map((i) => ids[i]));
const rewritten = (key: string) =>
  REWRITTEN.has(key) ||
  ["Mining", "Choppin", "Fishing", "Catching", "Trapping", "Spelunking"].some((s) => -1 != key.indexOf(s)) ||
  ["+{%_Shiny_Critter_Chance", "+{%_Charge_Rate", "+{_Starting_Pts_in_Worship", "+{%_Max_Charge", "+{%_Card_Drop_Chance"].includes(key);

/** One equipped card that gives a bonus key: its slot (0..9), name, level, per-level value CardStuff row[4], the legend talent 21 factor, whether a card chip doubles it, and what it adds. */
export type EquippedCard = { slot: number; card: string; level: number; per: number; legend: number; doubled: boolean; val: number };

/**
 * The equipped cards (Cards[2], "B" for an empty slot) that give the bonus `key`, in slot order, as `TalentCalc(-4)` @4499636 adds them to `DNSM.CardBonusS[key]`:
 * (1 + legend talent 21 / 100) x CardLv x CardStuff row[4], doubled for the first card with the card1 chip and the eighth with the card2 chip.
 * The keys the Rift and Vault rewrite are refused (see REWRITTEN).
 */
export function equippedCards(ctx: Ctx, key: string): EquippedCard[] {
  if (rewritten(key)) throw new NotPorted("CardBonusREAL", `CardBonusS:key=${key}`);
  const equipped = attr(ctx, "Cards", 2);
  if (equipped === undefined) throw new MissingSaveKey("Cards[2]"); // `null != Cards[2]` is the game's guard; the load always gives the list
  if (!Array.isArray(equipped)) throw new InvalidSaveValue("Cards[2]", "an array", equipped);
  const out: EquippedCard[] = [];
  for (let g = 0; g < 10; g++) {
    if ("B" == equipped[g]) continue;
    const row = CARD_ROW.get(hString(equipped[g]));
    // the game reads CardBonusSdl[3] of what GenINFO[45] has for the name, and would throw on a card it does not have
    if (!row) throw new RangeError(`CardBonusREAL: no card ${hString(equipped[g])} in CardStuff`);
    if (hString(row[3]) !== key) continue;
    const doubled = (0 == g && 1 == chipBonuses(ctx, "card1")) || (7 == g && 1 == chipBonuses(ctx, "card2"));
    const legend = 1 + Thingies(ctx, "LegendPTS_bonus", 21, 0) / 100;
    const level = RunCodeOfTypeXforThingY(ctx, "CardLv", hString(equipped[g]));
    const per = asNumber(row[4]);
    out.push({ slot: g, card: hString(equipped[g]), level, per, legend, doubled, val: doubled ? 2 * legend * level * per : legend * level * per });
  }
  return out;
}

/** `DNSM.CardBonusS[key]`: the sum of the equipped cards that give it (`equippedCards`), each added in slot order. */
function cardBonusS(ctx: Ctx, key: string): number {
  let total: number | undefined;
  for (const card of equippedCards(ctx, key)) total = card.val + asNumber(total);
  return asNumber(total);
}

/**
 * N.js `_customBlock_CardBonusREAL(c)` @6608105: the card bonus `IDforCardBonus[c]` ("9" is "+{_Base_STR") as `DNSM.CardBonusS` holds it,
 * 0 when absent (`null == cdb8 ? 0`).
 */
export const CardBonusREAL = block("CardBonusREAL", (ctx, c: number) => cardBonusS(ctx, hString(ids[`${c}`])));

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = "generic";
