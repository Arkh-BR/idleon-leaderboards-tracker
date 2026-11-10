// save-diff: what changed between two captured saves (e.g. before/after removing
// a weapon). From web/:
//
//   npx tsx scripts/save-diff.ts <a.json> <b.json> [--stat <StatKey> --char <n> --map <m>] [--limit 200]
//
// Prints the save keys that changed (path, before, after). With --stat it also
// computes that tracker's tree on both saves and prints the leaves that moved.
// Each list is capped at --limit lines; the total is always printed.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DAMAGE_PAGE } from "@/lib/damage/pageConfig";
import { diffSaves, diffTrees } from "@/lib/diagnose/saveDiff";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { KIT_PAGES } from "@/lib/readings/compute";
import type { StatKey } from "@/lib/readings/types";

const PAGES = { ...KIT_PAGES, damage: DAMAGE_PAGE }; // as scripts/diagnose.ts

const USAGE = "usage: npx tsx scripts/save-diff.ts <a.json> <b.json> [--stat <StatKey> --char <n> --map <m>] [--limit 200]";
const show = (v: unknown) => {
  const s = v === undefined ? "(absent)" : JSON.stringify(v);
  return s.length > 70 ? `${s.slice(0, 70)}… (${s.length} chars)` : s;
};
const num = (v: number | undefined) => (v === undefined ? "(absent)" : String(v));

function list<T>(title: string, rows: T[], limit: number, line: (r: T) => string) {
  console.log(`\n== ${title}: ${rows.length} ==`);
  for (const r of rows.slice(0, limit)) console.log(line(r));
  if (rows.length > limit) console.log(`… ${rows.length - limit} more (raise --limit)`);
}

async function main(argv: string[]) {
  const files: string[] = [];
  const f: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) f[argv[i].slice(2)] = argv[++i] ?? "";
    else files.push(argv[i]);
  }
  if (files.length !== 2) throw new Error(USAGE);
  const [a, b] = files.map((p) => JSON.parse(readFileSync(p, "utf8")));
  const limit = f.limit === undefined ? 200 : Number(f.limit);
  if (!(limit >= 0)) throw new Error(`--limit ${f.limit}: not a number`);

  list("Save keys changed", diffSaves(a, b), limit, (c) => `  ${c.path}: ${show(c.before)} -> ${show(c.after)}`);

  if (f.stat === undefined) return;
  const page = PAGES[f.stat as StatKey];
  if (!page) throw new Error(`--stat ${f.stat}: no kit tracker (one of ${Object.keys(PAGES).join(", ")})`);
  const char = Number(f.char);
  const map = f.map === undefined && page.noMap ? 0 : Number(f.map);
  if (f.char === undefined || !Number.isInteger(char) || !Number.isInteger(map)) throw new Error(`--stat needs --char <n> --map <m>\n${USAGE}`);

  const ra = await page.compute(a, char, map);
  const flatA = flattenTree(ra.tree);
  const rb = await page.compute(b, char, map); // sequential: the engine keeps module-level state
  console.log(`\n${page.statName}, char ${char}, map ${map}: total ${ra.total} -> ${rb.total}`);
  list("Tree leaves moved", diffTrees(flatA, flattenTree(rb.tree)), limit, (c) => {
    const r = c.before && c.after !== undefined ? ` (x${(c.after / c.before).toPrecision(6)})` : "";
    return `  ${c.path}: ${num(c.before)} -> ${num(c.after)}${r}`;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
