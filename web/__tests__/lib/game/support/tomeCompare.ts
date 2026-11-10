// The Tome on lib/game (njs/TomeQTY.ts) against the frozen computeTome (arkhTome.ts), task by task (a support module: vitest only collects
// *.test.ts). The oracle is never the page's compute: arkhTome.ts is a copy of it from before the switch.
//
// lib/arkh's computeTome is the comparison target only: where it is wrong the quantity follows N.js and the line goes in TOME_KNOWN with
// the evidence (RAW offset).
import "./arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { computeTome } from "./arkhTome";
import { makeCtx } from "@/lib/game/ctx";
import { DNSM_TomeQTYtot } from "@/lib/game/njs/DNSM";
import { Summoning } from "@/lib/game/njs/Summoning";
import { tomeQty } from "@/lib/game/njs/TomeQTY";
import { stateOf } from "@/lib/game/trackers/page";
import { tomeWhere } from "@/lib/tome/compute";
import { near } from "./v1Compare";

/**
 * A difference where the frozen computeTome is wrong, with its N.js evidence. `line` matches `"qty[i]"`, `"pts[i]"` or `"total"`. `tol`,
 * when the evidence bounds the gap (a rounding), is the largest |game - arkh| the entry excuses.
 */
export const TOME_KNOWN: { line: RegExp; why: string; tol?: number }[] = [
  {
    line: /^(qty|pts)\[3\]$/, // the points follow the quantity where it crosses a point (01010111001.json, 09/2026: 99358 vs 99457)
    why: "N.js TomeQTY[3] @5742014 sums, per index of the current character's SkillLevelsMAX, the best SkillLevelsMAX of every character (PlayerDATABASE, loaded from SM_<n> @19926198); the frozen computeTome takes the best of SL_<n> (the levels) and SM_<n>. On ARKHE's saves of 03/11 character 3 has talent 12 at level 2595 (SL_3) with a saved max of 2470 (SM_3): the game's best max for 12 is character 5's 2580, 15 below the oracle's 2595 (the same Tome points, 838)",
  },
  {
    line: /^(qty|pts)\[38\]$/,
    why: "N.js TomeQTY[38] @5752210 counts a character's kills of a map as MapDetails[map][0][0] - KillsLeft2Advance[map][0] (the requirement minus what is left); the frozen computeTome takes |KillsLeft2Advance[map][0]|, the kills past the requirement where the map is done (left below 0) and the kills still needed where it is not. The digits, ceil(getLOG), agree where every map's kills dwarf its requirement (ARKHE's newest saves) and differ on accounts with maps not done: the newest saves of two other accounts, 26515665165165.json (CSver 33.05, 1431 vs 1441) and 01010111001.json (CSver 33.05, 980 vs 1059), both with Emporium 7 owned, so the miniboss digits count on both sides",
  },
  {
    line: /^qty\[26\]$/,
    why: "N.js TomeQTY[26] @5748739 is Math.round(DeliveryBoxComplete) + (Math.round(DeliveryBoxStreak) + Math.round(DeliveryBoxMisc)) of CurrenciesOwned; the frozen computeTome sums them unrounded (ARKHE's CYDeliveryBoxMisc is 355720.84: 623613.84 vs the game's 623614)",
    tol: 1.5, // three roundings
  },
  {
    line: /^qty\[82\]$/,
    why: "N.js TomeQTY[82] @5761706 is asNumber(Holes[11][65]) + (… + asNumber(Holes[11][70])), not rounded; the frozen computeTome rounds the sum (ARKHE's saves of 03/11: Holes[11][65..70] = 1932.29999999934, 1681.99999999957…, the game's 10995.7 vs 10996)",
    tol: 0.5, // one rounding
  },
];

/**
 * Every TomeQTY[i] against the oracle's rawValue of the row whose computeIdx is i (1e-9), and every Summoning("TomePTS", i) against the
 * row's pts; then DNSM.TomeQTYtot against totalPts (as line "total", in `pts`). A row the oracle leaves null (MISSING) is a difference too.
 * Lines outside TOME_KNOWN only. The oracle runs without what IdleonToolbox stamped on the envelope (parsedData, extraData), which would
 * make it take IT's per-task points. The character and map are the page's (tomeWhere: the logged-in character, on its
 * CurrentMap, else 251): the quantities that read the map are the Crystal Spawn record (Shrine 6) and the Highest Drop Rate record, raised
 * to the live Drop Rate off map 216; the frozen computeTome reads both saved records.
 */
export function compareTome(save: unknown): { qty: string[]; pts: string[] } {
  const { parsedData: _p, extraData: _e, ...plain } = structuredClone(save) as Record<string, unknown>;
  const oracle = computeTome(plain as never);
  const state = stateOf(save);
  const ctx = makeCtx(state, tomeWhere(state));
  const known = (line: string, game: number, arkh: number | null) =>
    (arkh !== null && near(game, arkh)) || TOME_KNOWN.some((k) => k.line.test(line) && (k.tol === undefined || (arkh !== null && Math.abs(game - arkh) <= k.tol)));
  const qty: string[] = [];
  const pts: string[] = [];
  for (const row of oracle.rows) {
    const i = row.computeIdx;
    const game = tomeQty(ctx, i);
    if (!known(`qty[${i}]`, game, row.rawValue)) qty.push(`qty[${i}] ${row.task}: game ${game} vs arkh ${row.rawValue ?? `MISSING (${row.source})`}`);
    const p = Summoning(ctx, "TomePTS", i, 0);
    if (!known(`pts[${i}]`, p, row.pts)) pts.push(`pts[${i}] ${row.task}: game ${p} vs arkh ${row.pts ?? "MISSING"} (qty ${game} vs ${row.rawValue})`);
  }
  const total = DNSM_TomeQTYtot(ctx);
  if (!known("total", total, oracle.totalPts)) pts.push(`total: game ${total} vs arkh ${oracle.totalPts}`);
  return { qty, pts };
}
