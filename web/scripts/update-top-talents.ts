// Refresh the bundled top-player Talents reference in
// lib/talentsLevel/topTalents.ts by fetching each top player's save and
// running OUR talent engine on every simple (tab 1-5) talent.
//
// HYPOTHETICAL-MAX model (same spirit as the DR collector): for each simple
// talent we keep the best Base Level, Bonus Levels, Super Levels and Points
// Invested seen across all top players, then the hypothetical Effective
// Level is base + bonus + super (recomputed, higher than any single
// player). The /talents Tree tab uses these as a per-row reference.
//
// Run:  npx tsx web/scripts/update-top-talents.ts
// Knobs: --limit N   cap candidate set (smoke test)
//        --slow       1500ms between players
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeTalentTreesForChars } from "../lib/talentsLevel/compute";
import { entityName } from "../lib/corgan/stats/entity-names";
import { TALENT_TABS_BY_CLASS } from "../lib/talentsLevel/talentTabs.gen";
import { getCharClassKey } from "../lib/talentsLevel/charClass";
import { listCharacters } from "../lib/dropRate/extract";
import type { CorganNode } from "../lib/corgan/node";

const argv = process.argv.slice(2);
const SLOW = argv.includes("--slow");
const THROTTLE_MS = SLOW ? 1500 : 400;
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
})();

const OUTPUT_FILE = join(__dirname, "..", "lib", "talentsLevel", "topTalents.ts");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function childByName(node: CorganNode | undefined, name: string): CorganNode | undefined {
  return node?.children?.find((c) => c.name === name);
}
const num = (n: unknown) => Number(n) || 0;

type Acc = { name: string; base: number; bonus: number; sup: number; invested: number };

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  const candidates = await gatherCandidates({ limit: LIMIT ?? undefined });
  console.log(`  ✓ ${candidates.length} candidates`);

  const acc = new Map<number, Acc>();
  let scanned = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const tag = `[${i + 1}/${candidates.length}]`;
    process.stdout.write(`  ${tag} ${name.padEnd(20)}`);
    const save = await fetchProfileSave(name);
    if (!save) {
      console.log("  · skipped (no save)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let chars: { charIndex: number }[] = [];
    try {
      chars = listCharacters(save);
    } catch {
      console.log("  · skipped (parse)");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }

    // Build one job per char (simple talents = tab 1-5, skip the star
    // "Special Talent" tabs), then resolve them all with a single save load.
    const jobs: { charIdx: number; talentIds: number[] }[] = [];
    for (const ch of chars) {
      const classKey = getCharClassKey(save, ch.charIndex);
      if (!classKey) continue;
      const cls = TALENT_TABS_BY_CLASS[classKey];
      if (!cls) continue;
      const ids: number[] = [];
      const seen = new Set<number>();
      for (const tab of cls.tabs) {
        if (tab.name.startsWith("Special Talent")) continue;
        for (const t of tab.talents) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            ids.push(t.id);
          }
        }
      }
      jobs.push({ charIdx: ch.charIndex, talentIds: ids });
    }

    let touched = 0;
    const results = computeTalentTreesForChars(save, jobs);
    for (const { trees } of results) {
      for (const [id, tree] of trees) {
        const eff = childByName(tree, "Effective Level");
        if (!eff) continue; // not a simple-talent shape
        const baseNode = childByName(eff, "Base Level");
        const base = num(baseNode?.val);
        const bonus = num(childByName(eff, "Bonus Levels")?.val);
        const sup = num(childByName(eff, "Super Levels")?.val);
        const invested = num(childByName(baseNode, "Points Invested")?.val);
        const cur =
          acc.get(id) ??
          ({
            name: entityName("talent", id) || `Talent ${id}`,
            base: 0,
            bonus: 0,
            sup: 0,
            invested: 0,
          } as Acc);
        cur.base = Math.max(cur.base, base);
        cur.bonus = Math.max(cur.bonus, bonus);
        cur.sup = Math.max(cur.sup, sup);
        cur.invested = Math.max(cur.invested, invested);
        acc.set(id, cur);
        touched++;
      }
    }
    scanned++;
    console.log(`  ✓ ${touched} talent rows`);
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · ${acc.size} simple talents referenced`);

  emitFile(acc, scanned);
}

function emitFile(acc: Map<number, Acc>, scanned: number) {
  const now = new Date().toISOString();
  const lines: string[] = [
    "// Top-player Talents reference — hypothetical-max Base/Bonus/Super per",
    "// simple talent (best seen across the scanned top players). Effective =",
    "// base + bonus + super (recomputed, higher than any single player). The",
    "// /talents Tree tab uses these as a per-row reference. Auto-refreshed by",
    "// scripts/update-top-talents.ts.",
    "//",
    `// Snapshot generated: ${now}`,
    `// Players scanned: ${scanned}`,
    "",
    "export type TopTalentRef = {",
    "  name: string;",
    "  effective: number;",
    "  base: number;",
    "  bonus: number;",
    "  super: number;",
    "  invested: number;",
    "};",
    "",
    `export const TOP_TALENTS_GENERATED_AT = ${JSON.stringify(now)};`,
    `export const TOP_TALENTS_PLAYERS_SCANNED = ${scanned};`,
    "",
    "export const TOP_TALENTS: Readonly<Record<number, TopTalentRef>> = {",
  ];
  for (const id of [...acc.keys()].sort((a, b) => a - b)) {
    const a = acc.get(id)!;
    const effective = a.base + a.bonus + a.sup;
    lines.push(
      `  ${id}: { name: ${JSON.stringify(a.name)}, effective: ${effective}, base: ${a.base}, bonus: ${a.bonus}, super: ${a.sup}, invested: ${a.invested} },`
    );
  }
  lines.push("};", "");
  writeFileSync(OUTPUT_FILE, lines.join("\n"));
  console.log(`\n✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
