// Golden harness orchestrator: fetch reference saves, summarize each engine,
// validate against each save's EMBEDDED reference (extraData from a Copy-for-
// Support save, or parsedData from the IT profiles API — same fields), and run
// the synthetic cases.
//   npx tsx scripts/updater/golden/run.ts
// Tome ground-truth is exact & account-wide → FATAL. DR ground-truth has
// char/map noise → INFORMATIONAL. Synthetic cases → FATAL. Regression-vs-
// baseline is intentionally omitted (fetched saves change as players play).
import { referenceProfiles, getSave } from "./saves";
import { summarize } from "./engines";
import { compareGroundTruth } from "./checks";
import { runCases } from "./cases";

async function main(): Promise<void> {
  const g = globalThis as any;
  if (!g.window) g.window = g;

  let fatal = 0;
  let checked = 0;
  for (const name of await referenceProfiles()) {
    const save = await getSave(name);
    if (!save) { console.warn(`· ${name}: no save, skipped`); continue; }
    checked++;
    const got = summarize(save);
    const gt = save.extraData ?? save.parsedData ?? {};
    const ms = compareGroundTruth(
      name,
      got,
      { tomePoints: gt.tomePoints, dropRate: gt.dropRate },
      { tomeTol: 0, drTolPct: 8 },
    );
    const tome = ms.filter((m) => m.kind === "tome");
    const dr = ms.filter((m) => m.kind === "dr");
    if (tome.length) {
      fatal += tome.length;
      console.log(`· ${name}: ❌ ${tome.length} Tome per-task mismatch(es)`);
      for (const m of tome.slice(0, 5)) console.log(`    ${m.key}: got ${m.actual}, ref ${m.expected}`);
    } else {
      console.log(`· ${name}: ✅ Tome ${got.tomeTotal} (per-task matches ref)`);
    }
    for (const m of dr) {
      console.log(`    ⚠️ DR ${name}: got ${Math.round(m.actual)} vs ref ${Math.round(m.expected)} (char/map noise — informational)`);
    }
  }

  const cases = runCases();
  const failedCases = cases.filter((c) => !c.ok);
  for (const c of failedCases) { fatal++; console.log(`· synthetic ❌ ${c.name}`); }
  if (!failedCases.length) console.log(`· synthetic: ✅ ${cases.length} case(s)`);

  console.log(
    fatal
      ? `\n[golden] ❌ ${fatal} fatal issue(s) over ${checked} save(s)`
      : `\n[golden] ✅ all ground-truth + synthetic checks pass (${checked} save(s))`,
  );
  if (fatal) process.exitCode = 1;
}

main().catch((e) => { console.error("[golden] ERRO:", e); process.exit(1); });
