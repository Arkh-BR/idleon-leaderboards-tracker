// The Tome on lib/game (njs/TomeQTY.ts) against the frozen computeTome (arkhTome.ts), task by task (a support module: vitest only collects
// *.test.ts). The oracle is never the page's compute: arkhTome.ts is a copy of it from before the switch.
//
// lib/arkh's computeTome is the comparison target only: where it is wrong the quantity follows N.js and the line goes in TOME_KNOWN with
// the evidence (RAW offset).
import "./arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { computeTome } from "./arkhTome";
import { makeCtx } from "@/lib/game/ctx";
import { PENDING_QTY, tomeQty } from "@/lib/game/njs/TomeQTY";
import { stateOf } from "@/lib/game/trackers/page";
import { near } from "./v1Compare";

export { PENDING_QTY };

/** A difference where the frozen computeTome is wrong, with its N.js evidence. `line` matches `"qty[i]"` or `"pts[i]"` (Task 3). */
export const TOME_KNOWN: { line: RegExp; why: string }[] = [
  {
    line: /^qty\[3\]$/,
    why: "N.js TomeQTY[3] @5742014 sums, per index of the current character's SkillLevelsMAX, the best SkillLevelsMAX of every character (PlayerDATABASE, loaded from SM_<n> @19926198); the frozen computeTome takes the best of SL_<n> (the levels) and SM_<n>. On ARKHE's saves of 03/11 character 3 has talent 12 at level 2595 (SL_3) with a saved max of 2470 (SM_3): the game's best max for 12 is character 5's 2580, 15 below the oracle's 2595 (the same Tome points, 838)",
  },
  {
    line: /^qty\[26\]$/,
    why: "N.js TomeQTY[26] @5748739 is Math.round(DeliveryBoxComplete) + (Math.round(DeliveryBoxStreak) + Math.round(DeliveryBoxMisc)) of CurrenciesOwned; the frozen computeTome sums them unrounded (ARKHE's CYDeliveryBoxMisc is 355720.84: 623613.84 vs the game's 623614)",
  },
];

/**
 * The character the oracle computes the Tome for: the latest PTimeAway (computeTome's playedChar). The game computes TomeQTY for the
 * character logged in, which a save marks the same way.
 */
function played(data: Record<string, unknown>, chars: number): number {
  let best = 0;
  let at = 0;
  for (let c = 0; c < chars; c++) {
    const away = Number(data[`PTimeAway_${c}`]) || 0;
    if (away > at) [at, best] = [away, c];
  }
  return best;
}

/**
 * Every non-pending TomeQTY[i] against the oracle's rawValue of the row whose computeIdx is i (1e-9). A row the oracle leaves null (MISSING)
 * is a difference too. `pts` is compared from Task 3 on. Lines outside TOME_KNOWN only. The map is 251, the one characterize uses: of
 * quantities 0..41 only the Crystal Spawn record reads it (Shrine 6), under the saved record.
 */
export function compareTome(save: unknown): { qty: string[]; pts: string[] } {
  const env = save as { data: Record<string, unknown>; charNames: string[] };
  const rows = new Map(computeTome(structuredClone(env) as never).rows.map((r) => [r.computeIdx, r]));
  const ctx = makeCtx(stateOf(save), { player: played(env.data, env.charNames.length), map: 251 });
  const qty: string[] = [];
  for (const [i, row] of rows) {
    if (PENDING_QTY.has(i)) continue;
    const game = tomeQty(ctx, i);
    const line = `qty[${i}]`;
    if (row.rawValue !== null && near(game, row.rawValue)) continue;
    if (TOME_KNOWN.some((k) => k.line.test(line))) continue;
    qty.push(`${line} ${row.task}: game ${game} vs arkh ${row.rawValue ?? `MISSING (${row.source})`}`);
  }
  return { qty, pts: [] };
}
