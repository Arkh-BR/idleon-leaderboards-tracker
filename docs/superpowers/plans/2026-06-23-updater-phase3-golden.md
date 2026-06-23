# Updater Redesign — Phase 3: Golden Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Numerically validate the four ported engines (DR, Tome, Cooking, Talents) against real saves so the updater/cron can prove a port is correct (ground-truth), catch regressions (versioned baseline), and cover terms no real save exercises yet (synthetic cases) — closing the loop that lets the future agent's auto-port be trusted (the "golden rule").

**Architecture:** A `golden/` module under the updater. `checks.ts` holds the pure comparison logic (ground-truth + regression) — fully unit-tested in CI with synthetic data, no network. `engines.ts` wraps each ported engine into a uniform `runX(save) → summary` call. `saves.ts` fetches reference saves (ARKHE + top players) via the existing `fetchProfileSave`/`gatherCandidates`. `run.ts` orchestrates fetch → engines → checks vs `baseline.json`, emitting a report; it's invoked by the updater/cron (live). `golden.test.ts` runs the synthetic cases + checks logic in CI.

**Tech Stack:** TypeScript, tsx, vitest (`__tests__/**`, run from `web/`). Reuses `lib/arkh/computeDR.ts` (`computeArkhDropRate`), `lib/tome/compute.ts` (`computeTome`), `lib/cookingMastery/tree.ts` (`expRateTree`) + `lib/arkh/save/loader` (`loadSaveData`) + `lib/arkh/state` (`saveData`), `lib/talentsLevel/compute.ts` (`computeTalentTreesForChars`), and `scripts/_shared/itProfiles.ts` (`fetchProfileSave`, `gatherCandidates`).

**All commands run from `web/`.** Ground-truth lives in the save's top-level `extraData` block (`dropRate`, `tomePoints[]`). Engines consume the raw envelope (`{ data, charNames, extraData, ... }`).

---

## File Structure

- Create: `web/scripts/updater/golden/checks.ts` — pure comparison logic (ground-truth + regression). Unit-tested.
- Create: `web/scripts/updater/golden/engines.ts` — uniform `runDR/runTome/runCooking/runTalents(save) → EngineSummary`.
- Create: `web/scripts/updater/golden/cases.ts` — synthetic injection cases (e.g. Pet2 hat rack).
- Create: `web/scripts/updater/golden/saves.ts` — reference-save fetch + cache (reuses `itProfiles`).
- Create: `web/scripts/updater/golden/baseline.json` — versioned expected summaries per save.
- Create: `web/scripts/updater/golden/run.ts` — orchestrator (live fetch + checks + report; `--update` rewrites baseline).
- Create: `web/__tests__/updater/golden.test.ts` — CI: checks logic + synthetic cases (no network).
- Modify (Task 6): `web/scripts/updater/run.ts` — surface a golden summary line/section.

---

### Task 1: Comparison logic (`checks.ts`) — the testable core

**Files:**
- Create: `web/scripts/updater/golden/checks.ts`
- Test: `web/__tests__/updater/golden.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/updater/golden.test.ts
import { describe, it, expect } from "vitest";
import { compareGroundTruth, compareRegression, type EngineSummary } from "../../scripts/updater/golden/checks";

describe("golden checks", () => {
  it("flags a per-task Tome mismatch beyond tolerance", () => {
    const got = { tomeByTask: [10, 20, 30], drTotal: 5, cookingExp: 100, talentsTotal: 50 } as EngineSummary;
    const truth = { tomePoints: [10, 20, 31], dropRate: 5 };
    const ms = compareGroundTruth("ARKHE", got, truth, { tomeTol: 0, drTolPct: 1 });
    expect(ms.some((m) => m.kind === "tome" && m.key === "task#2")).toBe(true);
  });

  it("passes Tome when per-task matches and DR within tolerance", () => {
    const got = { tomeByTask: [10, 20, 30], drTotal: 100, cookingExp: 0, talentsTotal: 0 } as EngineSummary;
    const truth = { tomePoints: [10, 20, 30], dropRate: 100.5 }; // 0.5% off
    const ms = compareGroundTruth("ARKHE", got, truth, { tomeTol: 0, drTolPct: 1 });
    expect(ms.length).toBe(0);
  });

  it("flags a regression when a summary value drifts from baseline", () => {
    const base = { ARKHE: { tomeTotal: 1000, drTotal: 5, cookingExp: 100, talentsTotal: 50 } };
    const got: EngineSummary = { tomeByTask: [], tomeTotal: 1000, drTotal: 5, cookingExp: 110, talentsTotal: 50 };
    const ms = compareRegression("ARKHE", got, base, 0); // 0% tolerance
    expect(ms.some((m) => m.kind === "regression" && m.key === "cookingExp")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/updater/golden.test.ts`
Expected: FAIL — cannot resolve `golden/checks`.

- [ ] **Step 3: Implement `checks.ts`**

```ts
// web/scripts/updater/golden/checks.ts
// Pure comparison logic for the golden harness. No I/O — fed summaries and
// truth/baseline objects, returns structured mismatches.

export type EngineSummary = {
  /** Tome points per task (compute-index order), for per-task ground-truth. */
  tomeByTask: number[];
  /** Sum of tomeByTask, for regression. */
  tomeTotal: number;
  /** Arkh DR multiplier for the reference char. */
  drTotal: number;
  /** Cooking Mastery exp-rate (expRateTree.val). */
  cookingExp: number;
  /** Sum of effective levels over a fixed talent probe set. */
  talentsTotal: number;
};

export type GroundTruth = { tomePoints?: number[]; dropRate?: number };
export type Mismatch = { kind: "tome" | "dr" | "regression"; key: string; expected: number; actual: number };

const pctDiff = (a: number, b: number): number =>
  b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / Math.abs(b) * 100;

/** Ground-truth: per-task Tome vs extraData.tomePoints (exact within tomeTol),
 *  DR vs extraData.dropRate (within drTolPct percent — looser, save↔read desync). */
export function compareGroundTruth(
  save: string,
  got: EngineSummary,
  truth: GroundTruth,
  opts: { tomeTol: number; drTolPct: number },
): Mismatch[] {
  const out: Mismatch[] = [];
  if (Array.isArray(truth.tomePoints)) {
    const n = Math.min(got.tomeByTask.length, truth.tomePoints.length);
    for (let i = 0; i < n; i++) {
      if (Math.abs(got.tomeByTask[i] - truth.tomePoints[i]) > opts.tomeTol) {
        out.push({ kind: "tome", key: `task#${i}`, expected: truth.tomePoints[i], actual: got.tomeByTask[i] });
      }
    }
  }
  if (typeof truth.dropRate === "number" && pctDiff(got.drTotal, truth.dropRate) > opts.drTolPct) {
    out.push({ kind: "dr", key: save, expected: truth.dropRate, actual: got.drTotal });
  }
  return out;
}

export type Baseline = Record<string, { tomeTotal: number; drTotal: number; cookingExp: number; talentsTotal: number }>;

/** Regression: summary values vs the versioned baseline (within tolPct percent). */
export function compareRegression(save: string, got: EngineSummary, baseline: Baseline, tolPct: number): Mismatch[] {
  const base = baseline[save];
  if (!base) return [];
  const out: Mismatch[] = [];
  const keys: (keyof typeof base)[] = ["tomeTotal", "drTotal", "cookingExp", "talentsTotal"];
  for (const k of keys) {
    if (pctDiff(got[k], base[k]) > tolPct) {
      out.push({ kind: "regression", key: k, expected: base[k], actual: got[k] });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/updater/golden.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/scripts/updater/golden/checks.ts web/__tests__/updater/golden.test.ts
git commit -m "feat(golden): ground-truth + regression comparison logic"
```

---

### Task 2: Engine wrappers (`engines.ts`)

**Files:**
- Create: `web/scripts/updater/golden/engines.ts`

**Context:** Each engine has a different call shape; this wraps them into one `summarize(save) → EngineSummary`. The talent probe set is a small fixed list of DR-relevant talents on char 0 (stable, enough to catch a talent-formula regression). `computeTome` rows carry a compute-index `ci`; `extraData.tomePoints` is indexed by that same compute index — **VERIFY this with a real save before finalizing** (Step 2).

- [ ] **Step 1: Implement `engines.ts`**

```ts
// web/scripts/updater/golden/engines.ts
import { computeArkhDropRate } from "../../../lib/arkh/computeDR";
import { computeTome } from "../../../lib/tome/compute";
import { computeTalentTreesForChars } from "../../../lib/talentsLevel/compute";
import { loadSaveData } from "../../../lib/arkh/save/loader";
import { saveData } from "../../../lib/arkh/state";
import { expRateTree } from "../../../lib/cookingMastery/tree";
import type { EngineSummary } from "./checks";

// Fixed talent probe (char 0): DR talents — stable across saves, enough to
// catch a talent-formula regression. (279/24/655 are the DR talents in the
// drop-rate pool.)
const TALENT_PROBE = { charIdx: 0, talentIds: [279, 24, 655] };

export function summarize(save: any): EngineSummary {
  // Tome (also yields per-task for ground-truth).
  const tome = computeTome(save);
  const tomeByTask: number[] = [];
  for (const r of tome.rows) {
    const ci = (r as { ci?: number }).ci;
    if (typeof ci === "number") tomeByTask[ci] = (r as { pts?: number }).pts ?? 0;
  }

  // DR (char 0, map 0 — stable reference; ground-truth uses a loose tolerance
  // because extraData.dropRate is the active char on its current map).
  const drTotal = computeArkhDropRate(save, 0, 0).total;

  // Cooking exp-rate (expRateTree needs the arkh state loaded).
  loadSaveData(save);
  const cookingExp = expRateTree(saveData).val;

  // Talents: sum effective levels over the probe set.
  let talentsTotal = 0;
  const trees = computeTalentTreesForChars(save, [TALENT_PROBE]);
  for (const c of trees) for (const node of c.trees.values()) talentsTotal += node.val || 0;

  return { tomeByTask, tomeTotal: tome.totalPts, drTotal, cookingExp, talentsTotal };
}
```

- [ ] **Step 2: Verify against a real save (prototyping check — REQUIRED before commit)**

There is a real save at the repo root: `../save 28-05.json` (relative to `web/`). Run a throwaway probe to confirm (a) `summarize` runs without throwing, and (b) `tomeByTask` lines up with `extraData.tomePoints`:

Run:
```
npx tsx -e "import('./scripts/updater/golden/engines.ts').then(async ({summarize})=>{const fs=await import('node:fs');const save=JSON.parse(fs.readFileSync('../save 28-05.json','utf8'));const s=summarize(save);console.log('drTotal',s.drTotal,'tomeTotal',s.tomeTotal,'cookingExp',s.cookingExp,'talentsTotal',s.talentsTotal);const tp=save.extraData?.tomePoints||[];let mism=0;for(let i=0;i<Math.min(s.tomeByTask.length,tp.length);i++){if((s.tomeByTask[i]??0)!==tp[i])mism++;}console.log('tome per-task mismatches vs extraData:',mism,'of',tp.length);})"
```
Expected: prints finite numbers; tome per-task mismatches should be 0 or very low. **If mismatches are high, the `ci` indexing assumption is wrong** — inspect `computeTome` rows vs `tomePoints` ordering and fix the `tomeByTask` mapping (the index may be task-order, not `ci`) before committing. Record the finding in the commit message.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/updater/golden/engines.ts
git commit -m "feat(golden): uniform engine summary wrappers"
```

---

### Task 3: Reference saves (`saves.ts`)

**Files:**
- Create: `web/scripts/updater/golden/saves.ts`

**Context:** Reuses `fetchProfileSave`/`gatherCandidates`. ARKHE is always included; top players come from the DR + Tome focus boards. Fetched saves are cached to `golden/.cache/<name>.json` (add `web/scripts/updater/golden/.cache/` to `.gitignore`) so repeated runs and prototyping don't hammer the API.

- [ ] **Step 1: Implement `saves.ts`**

```ts
// web/scripts/updater/golden/saves.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchProfileSave, gatherCandidates } from "../../_shared/itProfiles";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, ".cache");

/** ARKHE + a small set of diverse top players (DR + Tome boards). */
export async function referenceProfiles(limit = 6): Promise<string[]> {
  const names = new Set<string>(["ARKHE"]);
  for (const board of ["dropRate", "totalTomePoints"]) {
    for (const n of await gatherCandidates({ focusBoard: board, limit })) names.add(n);
  }
  return [...names];
}

/** Fetch a save, using the on-disk cache when present. Returns null on failure. */
export async function getSave(name: string, useCache = true): Promise<any | null> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${name}.json`);
  if (useCache && existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const save = await fetchProfileSave(name);
  if (save) writeFileSync(path, JSON.stringify(save), "utf8");
  return save;
}
```

- [ ] **Step 2: Add the cache dir to `.gitignore`**

Append to `web/.gitignore` (create if missing):
```
scripts/updater/golden/.cache/
```

- [ ] **Step 3: Smoke-test the fetch (network; skip if offline)**

Run: `npx tsx -e "import('./scripts/updater/golden/saves.ts').then(async m=>{const s=await m.getSave('ARKHE');console.log('ARKHE save:', s? 'ok, has extraData='+!!s.extraData : 'null');})"`
Expected: `ARKHE save: ok, has extraData=true` (or `null` if the API is unreachable — acceptable; the harness skips null saves).

- [ ] **Step 4: Commit**

```bash
git add web/scripts/updater/golden/saves.ts web/.gitignore
git commit -m "feat(golden): reference-save fetch + cache (reuses itProfiles)"
```

---

### Task 4: Synthetic cases (`cases.ts`) + CI wiring

**Files:**
- Create: `web/scripts/updater/golden/cases.ts`
- Test: `web/__tests__/updater/golden.test.ts` (extend)

**Context:** Synthetic cases inject minimal state and assert an engine reacts — covering terms no real save exercises yet. Mirrors the `validate-hatrack.ts` pattern (inject companion 31, expect the hatrack multi to rise). These run in CI (no network).

- [ ] **Step 1: Implement `cases.ts`**

```ts
// web/scripts/updater/golden/cases.ts
// Synthetic golden cases: inject minimal state and assert an engine reacts the
// expected way. Catches term-level regressions that no real save covers yet.
import { hatrackBonusMulti } from "../../../lib/arkh/stats/systems/w7/gallery";
import { loadSaveData } from "../../../lib/arkh/save/loader";
import { saveData } from "../../../lib/arkh/state";

export type GoldenCase = { name: string; run: () => boolean; note: string };

export const CASES: GoldenCase[] = [
  {
    name: "Pet2 (companion 31) adds +15 to hat-rack multi",
    note: "guards the 2026-06 hat-rack term",
    run: () => {
      // Minimal save: empty companion set, then inject 31.
      loadSaveData({ data: {}, charNames: ["a"] } as any);
      if (!saveData.companionIds) (saveData as any).companionIds = new Set<number>();
      saveData.companionIds.delete(31);
      const before = hatrackBonusMulti(saveData).val;
      saveData.companionIds.add(31);
      const after = hatrackBonusMulti(saveData).val;
      return Math.abs(after - before - 0.15) < 1e-9;
    },
  },
];

export function runCases(): { name: string; ok: boolean; note: string }[] {
  return CASES.map((c) => {
    let ok = false;
    try { ok = c.run(); } catch { ok = false; }
    return { name: c.name, ok, note: c.note };
  });
}
```

- [ ] **Step 2: Extend the CI test to run the cases**

Append to `web/__tests__/updater/golden.test.ts`:
```ts
import { runCases } from "../../scripts/updater/golden/cases";

describe("golden synthetic cases", () => {
  it("all synthetic cases pass", () => {
    const results = runCases();
    const failed = results.filter((r) => !r.ok).map((r) => r.name);
    expect(failed, `failed: ${failed.join(", ")}`).toEqual([]);
  });
});
```

- [ ] **Step 3: Run**

Run: `npx vitest run __tests__/updater/golden.test.ts`
Expected: PASS (checks 3 + cases 1). If the Pet2 case fails, the hat-rack term regressed — investigate `hatrackBonusMulti`/`companionBonus(31)`.

- [ ] **Step 4: Commit**

```bash
git add web/scripts/updater/golden/cases.ts web/__tests__/updater/golden.test.ts
git commit -m "feat(golden): synthetic cases + CI wiring"
```

---

### Task 5: Orchestrator (`run.ts`) + baseline

**Files:**
- Create: `web/scripts/updater/golden/run.ts`
- Create: `web/scripts/updater/golden/baseline.json` (generated by `--update`)

**Context:** Fetches the reference saves, summarizes each, runs ground-truth + regression, prints a report. `--update` writes the current summaries as the new baseline (reviewed in the PR). Tolerances: `tomeTol=0` (exact per-task), `drTolPct=2` (desync), regression `tolPct=0.5`.

- [ ] **Step 1: Implement `run.ts`**

```ts
// web/scripts/updater/golden/run.ts
// Golden harness orchestrator: fetch reference saves, summarize each engine,
// compare vs extraData ground-truth and the versioned baseline, print a report.
//   npx tsx scripts/updater/golden/run.ts           # check vs baseline
//   npx tsx scripts/updater/golden/run.ts --update   # rewrite baseline.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { referenceProfiles, getSave } from "./saves";
import { summarize } from "./engines";
import { compareGroundTruth, compareRegression, type Baseline, type Mismatch } from "./checks";
import { runCases } from "./cases";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(__dirname, "baseline.json");
const UPDATE = process.argv.includes("--update");

async function main(): Promise<void> {
  const g = globalThis as any;
  if (!g.window) g.window = g;

  const baseline: Baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
  const fresh: Baseline = {};
  const allMismatches: { save: string; ms: Mismatch[] }[] = [];

  for (const name of await referenceProfiles()) {
    const save = await getSave(name);
    if (!save) { console.warn(`· ${name}: no save, skipped`); continue; }
    const got = summarize(save);
    fresh[name] = { tomeTotal: got.tomeTotal, drTotal: got.drTotal, cookingExp: got.cookingExp, talentsTotal: got.talentsTotal };
    const truth = { tomePoints: save.extraData?.tomePoints, dropRate: save.extraData?.dropRate };
    const ms = [
      ...compareGroundTruth(name, got, truth, { tomeTol: 0, drTolPct: 2 }),
      ...(UPDATE ? [] : compareRegression(name, got, baseline, 0.5)),
    ];
    if (ms.length) allMismatches.push({ save: name, ms });
    console.log(`· ${name}: ${ms.length ? "⚠️ " + ms.length + " mismatch(es)" : "ok"}`);
  }

  const cases = runCases();
  const failedCases = cases.filter((c) => !c.ok);
  for (const c of failedCases) console.log(`· synthetic FAIL: ${c.name}`);

  if (UPDATE) {
    writeFileSync(BASELINE, JSON.stringify(fresh, null, 2) + "\n", "utf8");
    console.log(`[golden] baseline updated (${Object.keys(fresh).length} saves)`);
  } else {
    const total = allMismatches.reduce((n, x) => n + x.ms.length, 0) + failedCases.length;
    console.log(total ? `\n[golden] ❌ ${total} issue(s)` : "\n[golden] ✅ all good");
    for (const { save, ms } of allMismatches)
      for (const m of ms) console.log(`  ${save} · ${m.kind} ${m.key}: expected ${m.expected}, got ${m.actual}`);
    if (total) process.exitCode = 1;
  }
}

main().catch((e) => { console.error("[golden] ERRO:", e); process.exit(1); });
```

- [ ] **Step 2: Generate the initial baseline**

Run: `npx tsx scripts/updater/golden/run.ts --update`
Expected: fetches saves, writes `baseline.json` with one entry per reachable save (ARKHE + top players). If the API is unreachable, the file may be sparse — that's acceptable; re-run later to fill it.

- [ ] **Step 3: Verify a check run passes against the fresh baseline**

Run: `npx tsx scripts/updater/golden/run.ts`
Expected: `[golden] ✅ all good` (ground-truth may still flag DR if a save's active-char/map desync exceeds 2% — if so, note it; the per-task Tome ground-truth should be clean).

- [ ] **Step 4: Commit**

```bash
git add web/scripts/updater/golden/run.ts web/scripts/updater/golden/baseline.json
git commit -m "feat(golden): orchestrator + initial baseline"
```

---

### Task 6: Surface golden in the updater report

**Files:**
- Modify: `web/scripts/updater/run.ts`

**Context:** The updater's report should note whether the golden synthetic cases pass (cheap, no network) so a regression shows up alongside the formula impact. The full save-based golden stays in `golden/run.ts` (network) for the cron, not the updater's offline path.

- [ ] **Step 1: Import and call `runCases` in the report**

In `web/scripts/updater/run.ts`, add near the `./impact` import:
```ts
import { runCases } from "./golden/cases";
```
In `main()`, build a golden line and add it to the `report` array right after the `buildImpactReport(...)` entry:
```ts
    (() => {
      const c = runCases();
      const failed = c.filter((x) => !x.ok).map((x) => x.name);
      return failed.length
        ? `## Golden (sintéticos)\n\n- ❌ ${failed.length} caso(s) falhando: ${failed.join(", ")}`
        : `## Golden (sintéticos)\n\n- ✅ ${c.length} caso(s) sintético(s) OK`;
    })(),
    "",
```

- [ ] **Step 2: Verify**

Run: `npx tsx scripts/updater/run.ts --no-fetch --dry`
Expected: early-returns "sem mudanças" (hash matches) — no crash. (The golden line appears in the report only on the change path; the synthetic cases are also covered by `golden.test.ts` in CI.)

- [ ] **Step 3: Full updater suite + tsc**

Run: `npx vitest run __tests__/updater/` — expect all pass.
Run: `npx tsc --noEmit` — only the 3 pre-existing `__tests__/components/*` errors; none in `scripts/updater/**` or `golden/**`.

- [ ] **Step 4: Commit**

```bash
git add web/scripts/updater/run.ts
git commit -m "feat(golden): surface synthetic-case status in the updater report"
```

---

## Self-Review

**Spec coverage (Phase 3 scope, spec §5):**
- Ground-truth (extraData) → `compareGroundTruth` (Tome per-task exact; DR loose) — Task 1, wired Task 5. ✓
- Regression (versioned baseline) → `compareRegression` + `baseline.json` — Task 1/5. ✓
- Synthetic cases → `cases.ts` + CI — Task 4. ✓
- 4 features + leaderboards: DR/Tome/Cooking/Talents covered by `summarize`. **Leaderboards: not a separate check** — most leaderboard stats are the same `extraData` values (dropRate, etc.) already ground-truthed; a dedicated leaderboard check is deferred (note below), since the four engines are the formula-bearing surface.
- Reference saves (ARKHE + top players) → `saves.ts`. ✓
- Runs in updater + CI → Task 6 (synthetic line in report) + `golden.test.ts` (CI checks+cases). Full save-based run is `golden/run.ts` (network, cron). ✓

**Placeholder scan:** every code step has complete code; the one prototyping dependency (Tome `ci` vs task-order indexing) is an explicit verify-step (Task 2 Step 2) with a documented fix path, not a placeholder.

**Type consistency:** `EngineSummary` (incl. `tomeTotal`) defined in `checks.ts` (Task 1), produced by `summarize` (Task 2), consumed by `compareRegression`/`run.ts`. `Baseline`/`Mismatch`/`GroundTruth` shared from `checks.ts`. `runCases` shape identical in Task 4/5/6.

**Known follow-ups:** dedicated leaderboard-stat ground-truth (beyond the shared extraData values); broaden the talent probe set; add more synthetic cases as new terms land.
