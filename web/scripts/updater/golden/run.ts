// Golden harness orchestrator: fetch reference saves, summarize each engine,
// validate against each save's EMBEDDED reference (extraData from a Copy-for-
// Support save, or parsedData from the IT profiles API — same fields), and run
// the synthetic cases.
//   npx tsx scripts/updater/golden/run.ts
// Tome ground-truth: the engine's INDEPENDENT per-task computation (the IT
// override is stripped in engines.ts) vs the save's reference tomePoints,
// within ±1 to absorb rounding boundaries → FATAL on larger gaps. DR is a loose
// cross-check only: summarize() takes max-over-chars at mapIdx=0, which
// structurally differs from IT's active-char/active-map dropRate, so large gaps
// are EXPECTED and NOT validated here (a real DR golden via computeArkhDRPools /
// mergeBest is future work) → INFORMATIONAL. Synthetic cases → FATAL.
// Regression-vs-baseline is intentionally omitted (fetched saves change as
// players play).
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
    const hasTomeRef = Array.isArray(gt.tomePoints) && gt.tomePoints.length > 0;
    const ms = compareGroundTruth(
      name,
      got,
      { tomePoints: gt.tomePoints, dropRate: gt.dropRate },
      // tomeTol=1 absorbs rounding off-by-ones. drTolPct only gates whether the
      // DR line prints; DR is informational + methodology-mismatched (see
      // header), so the exact threshold isn't meaningful — kept loose at 8.
      { tomeTol: 1, drTolPct: 8 },
    );
    const tome = ms.filter((m) => m.kind === "tome");
    const dr = ms.filter((m) => m.kind === "dr");
    if (!hasTomeRef) {
      // No embedded reference (some profiles ship no tomePoints) — we cannot
      // validate Tome for this save. Say so plainly instead of a vacuous "✅".
      console.log(`· ${name}: ⊘ Tome ${got.tomeTotal} (no reference in save — not validated)`);
    } else if (tome.length) {
      fatal += tome.length;
      console.log(`· ${name}: ❌ ${tome.length} Tome per-task mismatch(es)`);
      for (const m of tome.slice(0, 5)) console.log(`    ${m.key}: got ${m.actual}, ref ${m.expected}`);
    } else {
      console.log(`· ${name}: ✅ Tome ${got.tomeTotal} (per-task within ±1 of ref)`);
    }
    for (const m of dr) {
      console.log(`    ⚠️ DR ${name}: got ${Math.round(m.actual)} vs ref ${Math.round(m.expected)} (methodology mismatch — informational, not validated)`);
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
