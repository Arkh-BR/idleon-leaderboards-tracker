// diagnose: which term of a tracker's formula most likely makes the site
// disagree with in-game readings. From web/:
//
//   npx tsx scripts/diagnose.ts <reading-id…> [--pairs] [--all-leaves] [--what-if unequip:<slot>|map:<id>]
//
// Per reading: the game/site ratio. Per stat (readings of one stat are read
// together): the top 20 elasticities, the hypotheses ranked by how well one
// factor on one term explains every reading, the alerts and, with --what-if,
// what each top hypothesis predicts the game shows after that action — the
// reading to take next. Candidate terms are the page's gains.sources();
// --all-leaves uses every node of the tree. --pairs adds 2-term fits.
// Damage compares on Max. lib/arkh is a singleton: computes run one at a time.

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ArkhNode } from "@/lib/arkh/node";
import { DAMAGE_PAGE } from "@/lib/damage/pageConfig";
import { rankHypotheses, rankPairs, ratio, type DiagReading } from "@/lib/diagnose/hypotheses";
import { alerts, elasticities, totalWith, whatIf, type Mutation } from "@/lib/diagnose/sensitivity";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { KIT_PAGES } from "@/lib/readings/compute";
import { parseGameValue } from "@/lib/readings/format";
import { loadReadings, readingSave, READINGS_DIR } from "@/lib/readings/registry";
import type { Reading, StatKey } from "@/lib/readings/types";
import type { StatPageConfig } from "@/lib/statTracker/config";

const PAGES: Partial<Record<StatKey, StatPageConfig>> = { ...KIT_PAGES, damage: DAMAGE_PAGE };

export type Input = DiagReading & { r: Reading; page: StatPageConfig; save: unknown; tree: ArkhNode; siteText: string };

/** Each reading's site side, computed from its save. A reading that can't be
 *  diagnosed is skipped with the reason — never thrown. */
export async function prepare(ids: string[], all = loadReadings(), dir = READINGS_DIR) {
  const inputs: Input[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    const r = all.find((x) => x.id === id);
    const page = r && PAGES[r.stat];
    const save = r && page ? readingSave(r, dir) : null;
    if (!r) skipped.push(`${id}: unknown reading id (not in fixtures/readings.json)`);
    else if (!page) skipped.push(`${id}: ${r.stat} has no kit tracker (diagnose needs a page's gains.totalFromFlat)`);
    else if (!save) skipped.push(`${id}: save missing (${join(dir, r.saveFile)})`);
    else {
      const shown = parseGameValue(r.stat, r.game);
      if (!Number.isFinite(shown)) {
        skipped.push(`${id}: game text ${JSON.stringify(r.game)} is not a number`);
        continue;
      }
      let res;
      try {
        res = await page.compute(save, r.charIdx, r.map);
      } catch (e) {
        skipped.push(`${id}: compute failed (${e instanceof Error ? e.message : e})`);
        continue;
      }
      const { tree, total } = res;
      const siteText = headline(page, total);
      // Same text on screen: the display can't tell them apart, so the game's
      // number is taken to be the site's (ratio 1).
      const game = parseGameValue(r.stat, siteText) === shown ? total : shown;
      inputs.push({ r, page, save, tree, flat: flattenTree(tree), total, game, siteText, totalFromFlat: page.gains.totalFromFlat });
    }
  }
  return { inputs, skipped };
}

type Opts = { pairs: boolean; allLeaves: boolean; whatIf?: Mutation };

const headline = (page: StatPageConfig, x: number) => page.formatTotal(x) + (page.unit ?? "x");
const short = (p: string) => p.slice(p.indexOf(" / ") + 3);
const fmtF = (f: number) => (Number.isNaN(f) ? "free".padStart(9) : f.toPrecision(7).padStart(9));
/** [printed numbers, path] rows merged by their numbers, in first-seen order. */
const rows = (items: [string, string][]): [string, string[]][] => {
  const m = new Map<string, string[]>();
  for (const [k, p] of items) m.set(k, [...(m.get(k) ?? []), p]);
  return [...m];
};
const names = (ps: string[]) =>
  ps.length === 1 ? short(ps[0]) : `[${ps.length} terms] ${ps.slice(0, 3).map(short).join("; ")}${ps.length > 3 ? "; …" : ""}`;
const geomean = (fs: number[]) => {
  const ln = fs.filter(Number.isFinite).map(Math.log);
  return Math.exp(ln.reduce((a, b) => a + b, 0) / ln.length);
};

async function report(group: Input[], o: Opts) {
  const { page } = group[0];
  console.log(`\n== ${page.statName} — ${group.length} reading(s); columns below follow this order ==`);
  group.forEach((x, i) => {
    const same = x.game === x.total ? "  (same display)" : "";
    console.log(`[${i}] ${x.r.id}  ${x.r.charName} #${x.r.charIdx} map ${x.r.map}`);
    console.log(`    game ${x.r.game}  site ${x.siteText}  game/site ${ratio(x.game, x.total).toPrecision(10)}${same}`);
    const model = x.totalFromFlat(x.flat);
    if (Math.abs(model / x.total - 1) > 1e-9) console.log(`    ! totalFromFlat = ${model} ≠ tree total ${x.total}: the model below isn't the tree`);
  });

  const paths = [...new Set(group.flatMap((x) =>
    o.allLeaves ? Object.keys(x.flat).filter((p) => p.includes(" / ")) : x.page.gains.sources(x.flat, x.flat).map((s) => s.path)))];
  const es = group.map((x) => new Map(elasticities(x.flat, x.totalFromFlat, paths).map((e) => [e.path, e.e])));
  const maxE = (p: string) => Math.max(...es.map((m) => Math.abs(m.get(p) ?? 0)));
  const byE = [...paths].sort((a, b) => maxE(b) - maxE(a));
  // Terms with the same elasticity in every reading (all the plain multipliers)
  // move the total alike: one row, and one pair candidate, per distinct vector.
  const alike = rows(byE.map((p) => [es.map((m) => (m.get(p) ?? 0).toFixed(4).padStart(8)).join(" "), p]));
  console.log(`\n-- Top 20 elasticities d ln total / d ln term (${paths.length} terms, ${alike.length} distinct) --`);
  for (const [v, ps] of alike.slice(0, 20)) console.log(`  ${v}  ${names(ps)}`);

  const hyps = rankHypotheses(group, paths);
  const off = group.filter((x) => x.game !== x.total).length;
  console.log(`\n-- Hypotheses: one term × factor (${hyps.length} ranked; ${off} of ${group.length} reading(s) differ from the game) --`);
  console.log("   spread = max − min of ln factor across readings (0 = one factor explains all), then the factor per reading; free = that reading doesn't constrain the term");
  if (!hyps.length) console.log("  none: nothing to explain");
  else if (off < 2) console.log("  only one reading differs: every term that can reach it fits (spread 0 ties) — --what-if shows which next reading separates them");
  for (const [k, ps] of rows(hyps.map((h) => [`${h.spread.toExponential(2)} ${h.factors.map(fmtF).join(" ")}`, h.path])).slice(0, 15))
    console.log(`  ${k}  ${names(ps)}`);

  if (o.pairs) {
    // ponytail: pairs over the 30 most elastic distinct terms only (≤ 435 fits, ~40 s on 4 Damage
    // readings); all 146 sources would be ~10k fits — widen when a real hunt needs it.
    const reps = new Map(alike.slice(0, 30).map(([, ps]) => [ps[0], ps.length - 1]));
    const pairs = rankPairs(group, [...reps.keys()]);
    const nm = (p: string) => `${short(p)}${reps.get(p) ? ` (+${reps.get(p)} alike)` : ""}`;
    console.log(`\n-- Pairs: two terms × factors, least squares on ln(total/game) (${pairs.length} ranked${group.length < 3 ? "; < 3 readings: every pair fits exactly" : ""}) --`);
    for (const p of pairs.slice(0, 10))
      console.log(`  rms ${p.rms.toExponential(2)}  ×${p.factors[0].toPrecision(6)} ${nm(p.paths[0])}  &  ×${p.factors[1].toPrecision(6)} ${nm(p.paths[1])}`);
  }

  // One line per alert, with the readings that raise it ("0123"); * = a candidate term.
  const flagged = new Map<string, string>();
  group.forEach((x, i) => {
    for (const a of alerts(x.flat, x.tree)) flagged.set(`${a.kind}\t${a.path}`, (flagged.get(`${a.kind}\t${a.path}`) ?? "") + i);
  });
  console.log(`\n-- Alerts: leaves at 0, ×1 multipliers, runtime-only nodes (${flagged.size}; readings · kind · path, * = candidate term) --`);
  for (const [k, who] of [...flagged].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [kind, path] = k.split("\t");
    console.log(`  ${who.padEnd(group.length)}  ${kind.padEnd(12)} ${paths.includes(path) ? "*" : " "} ${short(path)}`);
  }

  if (o.whatIf) {
    const top = hyps.slice(0, 5);
    console.log(`\n-- What if ${o.whatIf}: the site after the change, and the game/site ratio each top hypothesis predicts --`);
    for (const x of group) {
      const env = whatIf(x.save, o.whatIf, x.r.charIdx);
      const map = o.whatIf.startsWith("map:") ? Number(o.whatIf.slice(4)) : x.r.map;
      const { tree, total } = await x.page.compute(env, x.r.charIdx, map);
      const flat = flattenTree(tree);
      console.log(`${x.r.id}: site ${x.siteText} → ${headline(page, total)} (×${(total / x.total).toPrecision(6)})`);
      for (const h of top) {
        const f = geomean(h.factors);
        const pred = totalWith(flat, x.totalFromFlat, [[h.path, f]]);
        console.log(`  game/site ${ratio(pred, total).toPrecision(8)}  game shows ${headline(page, pred)}  if ×${f.toPrecision(7)} ${short(h.path)}`);
      }
    }
  }
}

async function main(argv: string[]) {
  const ids: string[] = [];
  const o: Opts = { pairs: false, allLeaves: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pairs") o.pairs = true;
    else if (argv[i] === "--all-leaves") o.allLeaves = true;
    else if (argv[i] === "--what-if") o.whatIf = (argv[++i] ?? "") as Mutation;
    else ids.push(argv[i]);
  }
  if (!ids.length) throw new Error("usage: npx tsx scripts/diagnose.ts <reading-id…> [--pairs] [--all-leaves] [--what-if unequip:<slot>|map:<id>]");
  if (o.whatIf !== undefined) whatIf({}, o.whatIf); // a bad mutation fails before any compute

  const { inputs, skipped } = await prepare(ids);
  for (const s of skipped) console.log(`skipped ${s}`);
  const byStat = new Map<StatKey, Input[]>();
  for (const x of inputs) byStat.set(x.r.stat, [...(byStat.get(x.r.stat) ?? []), x]);
  for (const group of byStat.values()) await report(group, o);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

