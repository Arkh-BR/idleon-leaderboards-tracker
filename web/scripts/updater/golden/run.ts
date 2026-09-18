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
// The embedded reference is computed by idleontoolbox.com's parser at the
// moment the PLAYER uploads, so it is exactly as fresh as the profile: a
// profile last uploaded before a game update carries the old task layout and
// the old companion values, and cannot validate anything newer. Such profiles
// are reported as "stale reference" and skipped instead of counting as fatal.
// (The live IT parser reads companion stage 2 — `upgradedBonus` — so fresh
// references DO exercise stage-2 values; only the local `web/lib/it` port lags.)
import { referenceProfiles, getSave } from "./saves";
import { summarize } from "./engines";
import { compareGroundTruth } from "./checks";
import { runCases } from "./cases";
import { TOME_TASKS } from "../../../lib/tome/tasks";

// 2026-08-25: Royal Guardian update (121 tome tasks, companion stage 2).
const REF_CUTOFF_MS = Date.UTC(2026, 7, 25);

/** When idleontoolbox.com parsed this profile (ms). `lastUpdated` has shipped in
 *  both seconds and milliseconds — normalise on magnitude. */
function referenceParsedAt(save: any): number {
  const t = Number(save?.lastUpdated) || 0;
  return t > 1e12 ? t : t * 1000;
}

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
    const parsedAt = referenceParsedAt(save);
    const staleRef =
      hasTomeRef && (gt.tomePoints.length !== TOME_TASKS.length || parsedAt < REF_CUTOFF_MS);
    const ms = compareGroundTruth(
      name,
      got,
      { tomePoints: staleRef ? undefined : gt.tomePoints, dropRate: gt.dropRate },
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
    } else if (staleRef) {
      const when = parsedAt ? new Date(parsedAt).toISOString().slice(0, 10) : "unknown date";
      const why =
        gt.tomePoints.length !== TOME_TASKS.length
          ? `${gt.tomePoints.length}-task layout from a pre-update IT parser`
          : "parsed before the 2026-08-25 update";
      console.log(
        `· ${name}: ⊘ Tome ${got.tomeTotal} (stale reference: ${why}, uploaded ${when} — not validated until the player re-uploads)`,
      );
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
