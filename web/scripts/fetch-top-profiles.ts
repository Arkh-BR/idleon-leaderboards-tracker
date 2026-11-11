// Download the top players' public profiles ONCE per refresh run, for every collector to read with --saves-dir.
//
// The candidates are the union of every collector's list: the #1 of each leaderboard plus the top 10 of each collector's focus
// board. Each profile is fetched one time, with a pause between requests (the volume agreed with Idleon Toolbox's owner:
// ~100 requests every 3 days; ask before it grows past ~2,000 a day). Files land in --out as <name>.json, on the runner only:
// nothing is committed.
//
// Run (from web/):  npx tsx scripts/fetch-top-profiles.ts --out <dir> [--limit N]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchProfileSave, gatherCandidates } from "./_shared/itProfiles";

/** The focus boards of every collector that reads these saves (update-top-*.ts `focusBoard`). */
export const FOCUS_BOARDS = ["dropRate", "cashMulti", "totalLevels", "afkTime", "monstersKilled", "sailing", "totalTomePoints"] as const;
const THROTTLE_MS = 500;
const MIN_SAVES = 20;

/** A player name safe as a file name (IT names are game names; anything with a path character is skipped). */
export const safeName = (name: string): boolean => /^[^\\/:*?"<>|]+$/.test(name) && name !== "." && name !== "..";

async function main(argv: string[]): Promise<void> {
  const o = argv.indexOf("--out");
  const out = o >= 0 ? argv[o + 1] : undefined;
  if (!out) {
    console.error("usage: npx tsx scripts/fetch-top-profiles.ts --out <dir> [--limit N]");
    process.exit(1);
  }
  const l = argv.indexOf("--limit");
  const limit = l >= 0 ? Number(argv[l + 1]) || undefined : undefined;
  mkdirSync(out, { recursive: true });

  console.log("→ Gathering candidates from leaderboards…");
  const candidates = (await gatherCandidates({ focusBoard: FOCUS_BOARDS, limit })).filter(safeName);
  console.log(`  ✓ ${candidates.length} candidates`);

  let saved = 0;
  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const save = await fetchProfileSave(name);
    if (save) {
      writeFileSync(join(out, `${name}.json`), JSON.stringify(save));
      saved++;
    }
    console.log(`  [${i + 1}/${candidates.length}] ${name}${save ? "" : "  · skipped (no save)"}`);
    if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  console.log(`\n✓ ${saved} / ${candidates.length} profiles saved to ${out}`);
  if (!limit && saved < MIN_SAVES) {
    console.error(`× only ${saved} profiles (< ${MIN_SAVES}): the collectors would refuse to publish anyway`);
    process.exit(1);
  }
}

if (require.main === module)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
