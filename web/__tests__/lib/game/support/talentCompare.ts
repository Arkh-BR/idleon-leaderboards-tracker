// The /talents-level tree on lib/game against lib/arkh's, path by path (a support module: vitest only collects *.test.ts). Same paths, values to 1e-9, formats and notes, the way v1Compare does it for Drop Rate V1.
//
// lib/arkh is the comparison target only: where it is wrong the tree follows N.js and the path goes in TALENT_KNOWN with the evidence.
import "./arkhOracle"; // first: it sets the `window` shim lib/arkh reads
import { computeTalentEffective } from "@/lib/talentsLevel/compute";
import { TALENT_FINAL_BONUS_WRAPS } from "@/lib/arkh/stats/data/common/talent-final-bonus-wraps";
import { talentCurveAt } from "@/lib/game/njs/GetTalentNumber";
import { makeCtx } from "@/lib/game/ctx";
import { stateOf } from "@/lib/game/trackers/page";
import { computeGameTalent, presetState, type TalentOpts } from "@/lib/game/trackers/talents";
import type { ArkhNode } from "@/lib/dropRate/node";
import { near, rowsOf, type V1Diff } from "./v1Compare";

/** The talents with a final-bonus wrap (a task of its own builds them): the comparer skips them until it lands. Task 3 and 4 empty it. */
export const PENDING_WRAPS = new Set<number>(Object.keys(TALENT_FINAL_BONUS_WRAPS).map(Number));
/** The cap boosters are built (Task 2): nothing is pending. */
export const PENDING_BOOSTERS = new Set<number>();

/** A path where lib/arkh is wrong, with its N.js evidence (RAW offset). */
export const TALENT_KNOWN: { path: RegExp; why: string }[] = [
  {
    path: / \/ Family Guy Multi \(×\) — potential buff( \/ Super Levels)?$/,
    why: "N.js TalentCalc(-3) reads GetTalentNumber(1,144) @4498035, whose AllTalentLV @4085148 gives the super levels only when Spelunk[20 + player + 12 x preset] lists 144; lib/arkh forces the super levels on for it (talent.ts forceSuperActive, the family bonus 68 term), for characters that do not have it listed (Family Guy Multi 1.3556 vs the game's 1.3484 on ARKHE's characters without 144 listed), so its row is above the game's and has a Super Levels row the game has no levels for. Same ruling as V1_KNOWN",
  },
  {
    path: / \/ Winner Multi \(combined\) \/ Bundle ban_i$/,
    why: "N.js WinBonus @10927394 (@10930921, the branch of the bonuses not 19 or 20..33) adds 50*Thingies(\"Have_ban_i\") (@10978279, BundlesReceived.ban_i == 1) to the winners' boosts; lib/arkh's _winBonusParts (w6/summoning.ts) adds banI to winnerSum but lists no row for it, so Winner Multi's rows do not sum to its value. The game's tree has the row (under the Max Book Lv Cap's Winner Bonus 19), only while the bundle is owned; the value above it is the same",
  },
];

const hits = new Set<RegExp>();
/** The TALENT_KNOWN rows no comparison needed so far: a stale row is one lib/arkh no longer gets wrong. */
export const knownUnused = (): string[] => TALENT_KNOWN.filter((k) => !hits.has(k.path)).map((k) => k.path.source);

/** lib/arkh's tree for an account-wide talent no character has points in: one `Reference Character: Char -1` row. */
const NOBODY = /^Reference Character: Char -1$/;

export function compareTalent(save: unknown, ci: number, id: number, opts: TalentOpts): V1Diff {
  const mine = computeGameTalent(save, ci, id, opts);
  const theirs = computeTalentEffective(structuredClone(save), ci, id, opts).tree;
  // N.js getbonus2 @7987852, with e == -1: a character without the talent still gives the curve at level 0 (its else branch reads ArbitraryCode5Inputs at SkillLevels[b], 0), and the first of them above 0 is the reference. lib/arkh
  // (getbonus2 in talent.ts, getTalentNumber) zeroes the value at level 0 instead and finds no reference at all, so for such a talent the tree has the game's Effective Level chain of the first character, with 0 points.
  if (theirs.children?.length === 1 && NOBODY.test(theirs.children[0].name) && mine.children?.some((k) => k.name === "Effective Level")) {
    const at = (n: ArkhNode | undefined, ...names: string[]): ArkhNode | undefined => names.reduce<ArkhNode | undefined>((k, name) => k?.children?.find((c) => c.name === name), n);
    // the game's tree must be the one of nobody: no points, the curve at level 0 as the root value, and the first character as the reference (the first above 0 wins and every character reads the same value at level 0)
    const wrong: string[] = [];
    const points = at(mine, "Effective Level", "Base Level", "Points Invested")?.val;
    if (points !== 0) wrong.push(`${mine.name}: arkh finds no reference character, the game's has ${points} points`);
    const state = undefined === opts.presetIdx ? stateOf(save) : presetState(save, ci, opts.presetIdx);
    // plain: the curve at level 0. forceSuperActive (the Hypothetical what-if) counts the super levels the talent would get, so the curve is read at the Effective Level the tree shows
    const level = opts.forceSuperActive ? (at(mine, "Effective Level")?.val ?? 0) : 0;
    const expected = talentCurveAt(makeCtx(state, { player: ci, map: 0 }), 1, id, level);
    if (!near(mine.val, expected)) wrong.push(`${mine.name}: nobody has points, the root is ${mine.val} but the curve at level ${level} is ${expected}`);
    const names = (save as { charNames?: string[] }).charNames ?? [];
    const reference = at(mine, "Effective Level", "Base Level")?.children?.[0]?.name;
    if (reference !== `Reference Character: ${names[0] || "Char 0"}`) wrong.push(`${mine.name}: reference row is ${JSON.stringify(reference)}, the game's pick is character 0`);
    return { missing: [], extra: wrong, value: [], meta: [] };
  }
  const a = rowsOf(mine);
  const b = rowsOf(theirs);
  const explained = (path: string): boolean => {
    const k = TALENT_KNOWN.find((row) => row.path.test(path));
    if (k) hits.add(k.path);
    return !!k;
  };
  const out: V1Diff = { missing: [], extra: [], value: [], meta: [] };
  for (const path of b.keys()) if (!a.has(path) && !explained(path)) out.missing.push(path);
  for (const path of a.keys()) if (!b.has(path) && !explained(path)) out.extra.push(path);
  for (const [path, r] of a) {
    const t = b.get(path);
    if (!t) continue;
    if (!near(r.node.val, t.node.val) && !explained(path)) out.value.push(`${path}: game ${r.node.val}, arkh ${t.node.val}`);
    if (r.node.fmt !== t.node.fmt && !explained(path)) out.meta.push(`${path}: fmt ${r.node.fmt} vs ${t.node.fmt}`);
    if (r.node.note !== t.node.note && !explained(path)) out.meta.push(`${path}: note ${JSON.stringify(r.node.note)} vs ${JSON.stringify(t.node.note)}`);
  }
  return out;
}
