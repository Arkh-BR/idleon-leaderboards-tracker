# Tome no `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Tome's quantities and points come from a `lib/game` port of the N.js `_customEvent_TomeQTY`, so neither `/tome` nor `DNSM.TomeQTYtot` imports `lib/arkh`.

**Architecture:** `lib/game/njs/TomeQTY.ts` builds the 124 quantities from the game's blocks. `Summoning("TomePTS")` turns each into points, and `DNSM.TomeQTYtot` sums them. `lib/tome/compute.ts` keeps its API and reads them. A comparer against a frozen copy of today's `computeTome` gates every task.

**Tech Stack:** TypeScript, Vitest; Node 22 for the clean run.

**Spec:** `docs/superpowers/specs/2026-11-10-tome-on-lib-game-design.md`

## Global Constraints

- N.js (`web/scripts/updater/.cache/N.new.js`; RAW offsets in `@offset` comments, Ruling JJ) is the only truth. IdleonToolbox and corgan are never references.
- No runtime `@/lib/arkh` import in new code; `lib/arkh` may re-export (Ruling B). The guard is `__tests__/lib/game/noArkhImports.test.ts`.
- `lib/game` conventions: `block`, `Ctx`, `attr`/`asNum`/`listAt`, strict reads, `runtime()`/`assumed()` for session values, `PORTED` per module. Run `npx tsx scripts/updater/registry/gen-registry.ts` after a new sub-case; `__tests__/updater` must pass.
- A shared `lib/game/njs` block changed: `npx tsx scripts/characterize.ts <stat> --recent 5 --map 251` for damage, coinMulti, dropRateV2, expMulti, afkGains, multikill, artifactFind. Expect 0 unexplained.
- Only the 5 newest saves (`newestSaves`, `lib/diagnose/characterize.ts`). Never loop over every save, never run `__tests__/lib/arkh`, never add files to `golden/.cache/`, never `npm run dev`.
- Tests: `npx vitest run <files> --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2` from `web/`.
- Stage by path, never `git add -A`. Commit messages end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never build a git worktree with a `node_modules` junction and then `git worktree remove --force` it: that deletes `web/node_modules`.
- Site text stays in English.

## Review Focus

1. A save the engine refuses (pre-migration): `/tome` shows the friendly message from `pageError`. The IT `parsedData.tomePoints` path still works.
2. A task whose quantity reads a session value (DR record, money record): `assumed:`, never a page error.
3. `DNSM.TomeQTYtot` is computed once per state; the Damage page doesn't rebuild the 124 quantities per call.
4. A task the save never reached (0): 0 points, not `MISSING`.
5. The oracle is never the page's compute: the comparer keeps comparing against the frozen copy after the switch.

---

### Task 1: The block, the comparer, quantities 0–41

**Files:**
- Create: `web/lib/game/njs/TomeQTY.ts`
- Create: `web/__tests__/lib/game/support/arkhTome.ts` (a verbatim copy of today's `lib/tome/compute.ts`, plus whatever it imports from `lib/tome` that later tasks change, under a support path; it may import `lib/arkh`)
- Create: `web/__tests__/lib/game/support/tomeCompare.ts`, `web/__tests__/lib/game/njs/tomeQty.test.ts`

**Interfaces:**
- Produces:
  - `TomeQTY: (ctx: Ctx) => readonly number[]`, a `block` keyed by the state, length `CustomLists.Tome.length`. Indices not ported yet throw `NotPorted("TomeQTY", "<i>")` when read through `tomeQty(ctx, i)`.
  - `tomeQty(ctx: Ctx, i: number): number`.
  - `compareTome(save: unknown): { qty: string[]; pts: string[] }`, plus `TOME_KNOWN` (regex on `"qty[i]"` or `"pts[i]"`, and `why`) and `PENDING_QTY: Set<number>`.

- [ ] **Step 1: Failing tests.**
  - Synthetic, per ported index: a value worked out from the N.js expression.
  - Real save (`skipIf`): `compareTome` on the 5 newest saves, with no difference outside `TOME_KNOWN` for every non-pending index.
- [ ] **Step 2: Run them.** Expected: FAIL (module missing).
- [ ] **Step 3: Port the event** from @5739264 up to the line that sets `TomeQTY[41]`, in order.
  - The OLA[198]/[200] maxima are kept in memory. The DR record uses the same `assumed:` as migration block 378 (`lib/game/migrations.ts`).
  - Port any missing block sub-case, adding sub-cases only.
- [ ] **Step 4: Run the tests and `tsc`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(tome): the Tome quantities on lib/game, 0–41`.

### Task 2: Quantities 42–83

**Files:** `TomeQTY.ts`, `tomeQty.test.ts`, `tomeCompare.ts` (shrink `PENDING_QTY`), plus the blocks that need sub-cases.

- [ ] Steps 1–5 as in Task 1, for indices 42–83. Run characterize if a shared block changed. Commit `feat(tome): the Tome quantities on lib/game, 42–83`.

### Task 3: Quantities 84–123, points and the engine's total

**Files:** `TomeQTY.ts`, `web/lib/game/njs/Summoning.ts` (`TomePCT`, `TomePTS`), `web/lib/game/njs/DNSM.ts` (`DNSM_TomeQTYtot`), `web/lib/game/errors.ts` (`IncompleteTome` removed if unused), `tomeCompare.ts` (`PENDING_QTY` gone), tests.

**Interfaces:**
- Produces: `Summoning(ctx, "TomePCT", g, 0)` and `Summoning(ctx, "TomePTS", g, 0)` (@10915591 and the TomePCT case). `DNSM_TomeQTYtot(ctx)` = Σ `TomePTS` over every task, inside the existing `assumed("Tome.totalPoints", …)`, whose note changes to say it is the N.js sum.

- [ ] **Step 1: Failing tests.**
  - Synthetic: `TomePCT` and `TomePTS` for one task of each curve type in `CustomLists.Tome`.
  - Synthetic: `DNSM_TomeQTYtot` sums them.
  - Real save: `compareTome` checks every quantity and every task's points, and the total against the frozen `computeTome`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Drop the `lib/tome` import from `DNSM.ts`.
  - Remove the `lib/tome` exception from `noArkhImports` and from `artifactFind.test.ts`'s "next test", so lib/game reaches no lib/arkh at all.
  - Update the Ruling K comments in `trackers/artifactFind.ts` and `trackers/damage.ts`.
- [ ] **Step 4: Run the tests, `__tests__/updater` after `gen-registry`, and characterize on all seven stats.** Expected: 0 unexplained. A Tome total that differs from before must be explained in `TOME_KNOWN`.
- [ ] **Step 5: Commit** `feat(tome): Tome points and the engine's Tome total on lib/game`.

### Task 4: Switch the Tome page

**Files:**
- `web/lib/tome/compute.ts` (`rawValue` = `TomeQTY[computeIdx]`, `pts` = `TomePTS`; labels and the IT/LB paths kept)
- `web/lib/tome/extractors.ts` (no `lib/arkh` import; delete what only the old compute used, after grepping every importer)
- `web/app/tome/TomePageClient.tsx`, `web/components/tome/{TomeRawPanel,BestTomePanel}.tsx` (`pageError` for a refused save)
- `web/scripts/updater/golden/{engines,cases}.ts`
- `web/__tests__/lib/game/noArkhImports.test.ts` (walk `lib/tome`)

**Interfaces:**
- Consumes: `tomeQty`, `Summoning("TomePTS")`. `computeTome(input)` keeps its signature and `TomeResult` shape.

- [ ] **Step 1:** extend `noArkhImports` to walk `lib/tome`. Expected: FAIL naming `compute.ts`/`extractors.ts`.
- [ ] **Step 2: Switch.** A save the engine refuses gives the LB fallback rows (as an unreadable save does today) and an `error` field the panels show through `pageError`. Keep the `parsedData.tomePoints` override.
- [ ] **Step 3: Run** the guard, the Tome component tests, the golden harness (`npx tsx scripts/updater/golden/run.ts`), `tsc`, and `compareTome` (it must still use the frozen oracle).
- [ ] **Step 4: Commit** `feat(tome): the Tome page runs on lib/game`.
