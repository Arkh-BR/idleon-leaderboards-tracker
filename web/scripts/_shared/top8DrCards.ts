// Top-player DR CARD ceiling: a character has only 8 card slots, shared by
// additive (+% Total Drop Rate) and multi (% Drop Rate Multi) cards. The
// observed generator otherwise sums the max of EVERY DR card (and mixes
// additive from one player with multi from another) → far more than 8 slots.
//
// Fix: pick the best 8 by OBSERVED value (each card's max observed star level ×
// its base × the legend ceiling — never a theoretical star tier nobody has):
//   - Slots 1 & 8 get a chip ×2 (card1/card2). Prefer multi there; if fewer
//     than 2 multi exist, fill with the largest additive(s).
//   - Slots 2-7: the rest — remaining multi first, then additive.
// Additive picks feed the additive pool (Σ); multi picks feed the multi pool
// (Σ, applied as 1+Σ/100).

import { MONSTERS } from "../../lib/arkh/stats/data/game/monsters.js";
import { CARD_DR_BONUS, CARD_DR_MULTI } from "../../lib/arkh/stats/data/common/cards";
import type { Pool } from "../../lib/arkh/stats/tree-builder";
import { label } from "../../lib/arkh/stats/entity-names";

const LEGEND = 1.75; // ponytail: Legendary Cardholder (Legend 21) ceiling — every endgamer caps it
const CHIP = 2; // slots 1 & 8 chip double (card1/card2)
const SLOTS = 8;

export type DrCardType = "multi" | "add";
/** A card ready to rank. `val` = base × observedStarLv × legend (no chip). */
export type DrCardIn = { key: string; type: DrCardType; val: number };
export type DrCardPick = DrCardIn & {
  slot: number; // 1..8
  boosted: boolean; // slot 1 or 8 (chip ×2)
  effVal: number; // val × (boosted ? 2 : 1)
};
export type Top8Result = {
  additiveSum: number; // Σ effVal of additive picks → additive pool
  multiSum: number; // Σ effVal of multi picks → multi pool (1 + Σ/100)
  picks: DrCardPick[];
};

/** Pure: rank pre-valued cards, take 8, chip-boost slots 1 & 8. */
export function selectTop8DrCards(
  multi: DrCardIn[],
  add: DrCardIn[]
): Top8Result {
  const mQ = [...multi].sort((a, b) => b.val - a.val);
  const aQ = [...add].sort((a, b) => b.val - a.val);

  // Slots 1 & 8: multi first, additive to fill.
  const boost: DrCardIn[] = [];
  while (boost.length < 2 && (mQ.length || aQ.length)) {
    boost.push(mQ.length ? mQ.shift()! : aQ.shift()!);
  }
  // Slots 2-7: remaining multi first, then additive.
  const normal: DrCardIn[] = [];
  while (normal.length < SLOTS - 2 && (mQ.length || aQ.length)) {
    normal.push(mQ.length ? mQ.shift()! : aQ.shift()!);
  }

  let additiveSum = 0;
  let multiSum = 0;
  const picks: DrCardPick[] = [];
  const place = (c: DrCardIn, slot: number, boosted: boolean) => {
    const effVal = c.val * (boosted ? CHIP : 1);
    if (c.type === "multi") multiSum += effVal;
    else additiveSum += effVal;
    picks.push({ ...c, slot, boosted, effVal });
  };
  if (boost[0]) place(boost[0], 1, true);
  normal.forEach((c, i) => place(c, i + 2, false));
  if (boost[1]) place(boost[1], 8, true);

  return { additiveSum, multiSum, picks };
}

/**
 * Drop unreleased cards: W7-zone-B placeholders carry mob ExpGiven === 1
 * (Ancientfish, Magni Pufferfin). Real mobs give ≥ 2. Cards whose key has no
 * mob entry are kept (event/boss cards — always real).
 */
export function obtainableDrCards(
  table: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(table)) {
    const mob = (MONSTERS as Record<string, { ExpGiven?: number }>)[k];
    if (mob && Number(mob.ExpGiven) <= 1) continue; // unreleased placeholder
    out[k] = v;
  }
  return out;
}

/**
 * Build ranking inputs from OBSERVED star levels. `starLvOf(key)` returns the
 * max star level observed for that card across scanned endgamers (0 if never
 * seen → the card is skipped, since nobody actually has it). Card value uses
 * that observed level, not a theoretical max star tier.
 */
export function buildDrCardInputs(starLvOf: (key: string) => number): {
  multi: DrCardIn[];
  add: DrCardIn[];
} {
  const mk = (type: DrCardType, table: Record<string, number>): DrCardIn[] =>
    Object.entries(obtainableDrCards(table))
      .map(([key, base]) => ({ key, type, lv: starLvOf(key), base: Number(base) }))
      .filter((c) => c.lv > 0)
      .map((c) => ({ key: c.key, type, val: c.base * c.lv * LEGEND }));
  return { multi: mk("multi", CARD_DR_MULTI), add: mk("add", CARD_DR_BONUS) };
}

// ── Generator glue: apply the 8-slot cap in the observed reference ──────────
const ADD_CARD_ITEM = "Drop Rate Cards (Card Type 10)";
const MULTI_CARD_ITEM = "Drop Rate Multi Cards (Card Type 101)";
const CARDS_BUCKET_ADD = "Drop Rate / Additive Pool / 🃏 Cards";
const ADD_CARD_PATH = CARDS_BUCKET_ADD + " / " + ADD_CARD_ITEM;
const ADDITIVE_POOL_PATH = "Drop Rate / Additive Pool";
const TOTAL_SUM_PATH = "Drop Rate / Total Sum";

/** Max star level observed per card key, from "(Card key) / Star Lv" leaves. */
export function observedStarLvOf(
  bestFlat: Record<string, number>
): (k: string) => number {
  const m = new Map<string, number>();
  for (const p in bestFlat) {
    const mm = p.match(/\(Card ([^)]+)\) \/ Star Lv$/);
    if (mm) m.set(mm[1], Math.max(m.get(mm[1]) ?? 0, Number(bestFlat[p]) || 0));
  }
  return (k) => m.get(k) ?? 0;
}

/** Rebuild the two card pool items (drives the total) from the best-8 pick. */
export function capDrCardsInPools(grp: {
  bestPools: Record<string, Pool> | null;
  bestFlat: Record<string, number>;
}): Top8Result {
  const { multi, add } = buildDrCardInputs(observedStarLvOf(grp.bestFlat));
  const sel = selectTop8DrCards(multi, add);
  const setItem = (pool: string, name: string, val: number) => {
    const it = grp.bestPools?.[pool]?.items.find((i) => i.name === name);
    if (it) it.val = val;
  };
  setItem("addMain", ADD_CARD_ITEM, sel.additiveSum);
  setItem("postMult", MULTI_CARD_ITEM, sel.multiSum);
  return sel;
}

/**
 * Rewrite the additive card node's display subtree to the capped 8-slot pick
 * and nudge its additive ancestors by the delta. The multi node already holds
 * only the observed multi cards, so its display needs no surgery.
 */
export function patchCardFlatDisplay(
  flat: Record<string, number>,
  sel: Top8Result
): void {
  const old = Number(flat[ADD_CARD_PATH]) || 0;
  const delta = sel.additiveSum - old;
  for (const p in flat) if (p.startsWith(ADD_CARD_PATH + " / ")) delete flat[p];
  flat[ADD_CARD_PATH] = sel.additiveSum;
  for (const pk of sel.picks) {
    if (pk.type !== "add") continue;
    flat[`${ADD_CARD_PATH} / ${label("Card", pk.key)}`] = pk.effVal;
  }
  if (flat[CARDS_BUCKET_ADD] != null) flat[CARDS_BUCKET_ADD] += delta;
  if (flat[ADDITIVE_POOL_PATH] != null) flat[ADDITIVE_POOL_PATH] += delta;
  if (flat[TOTAL_SUM_PATH] != null) flat[TOTAL_SUM_PATH] += delta / 100;
}
