# Observed Max collectors on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the nine `scripts/update-top-*.ts` collectors build their references on `lib/game`, with the pages' own math, and import nothing from `lib/arkh`.

**Architecture:** keep the runner's contract (pools, best per position, families, gating, one combine per profile, the renderer). Each collector reads the page's `lib/game` tree into pools and combines with the page's gains model; DR V1 keeps its own rules (user decision B).

**Tech Stack:** TypeScript, Vitest, tsx; Node 22 for the clean run.

**Spec:** `docs/superpowers/specs/2026-11-10-observed-max-collectors-on-lib-game-design.md`

## Global Constraints

- No `@/lib/arkh` import in `scripts/_shared/*` or `scripts/update-top-*.ts`. The one exception is the temporary `scripts/compare-top-ref.ts`, which is deleted with `lib/arkh`.
- Never fetch from the network or run a collector against the IdleonToolbox endpoint. Offline runs only, with `--saves-dir scripts/updater/golden/.cache --newest 5`.
- Only the 5 newest saves (`newestSaves`, `lib/diagnose/characterize.ts`). Never loop over every save, never run `__tests__/lib/arkh`, never add files to `golden/.cache/`, never `npm run dev`.
- Generated files keep their names, constants and exports (`<P>_FAMILY_FLAT`, `<P>_PROFILE_OVERRIDES`, `<P>_CLASS_PROFILE`, the `flatForClass` function, `<P>_GENERATED_AT`, `<P>_PLAYERS_SCANNED`). Don't commit regenerated `lib/<stat>/top*.ts` files: the cron regenerates them after merge.
- Tests: `npx vitest run <files> --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2` from `web/`.
- Never build a git worktree with a `node_modules` junction and then `git worktree remove --force` it.
- Stage by path. Commit messages end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A top player's save that `lib/game` refuses: counted and named in the log, the run goes on, and the 20-player floor still holds.
2. A character with no map that passes `bestMap`'s filter: skipped with a reason, not a crash.
3. A source that only some characters have: the best per position stays aligned (items are fixed per pool, never filtered).
4. The gated class talents still drop to their neutral value for a class that can't have them.
5. Speed: ms per character is printed in the compare script. A collector over 12 minutes for 100 players is a finding.

---

### Task 1: The runner off `lib/arkh`

**Files:** `web/scripts/_shared/{topStatCollector,classGating,hackers}.ts`; delete `frankenstein.ts` and `reconcile.ts` with their tests; `web/__tests__/scripts/topStatCollector.test.ts`.

**Interfaces:**
- Produces:
  - `type Pool = { items: Node[] }`;
  - `collectReference(cfg: StatCollectorConfig, saves: Iterable<{ name: string; save: unknown }>): { ref; best; scanned: number; skipped: string[]; refusedChars: string[] }`;
  - the `--newest N` flag;
  - `StatCollectorConfig.computePools(save: unknown, ci: number): Record<string, Pool>` and `combine(pools): { tree: Node; total: number }`.

- [ ] Failing tests:
  - `collectReference` on two synthetic players gives the best per position and the family split;
  - gated talents go to their neutral value;
  - a refusing character is counted.
- [ ] Implement it. Today's collectors keep compiling, because the node shape is the same. Run the tests and `tsc`, then commit.

### Task 2: Shared helpers and the validation harness

**Files:** `web/scripts/_shared/gamePools.ts`, `web/__tests__/scripts/gamePools.test.ts`, `web/scripts/compare-top-ref.ts` (temporary), `web/__tests__/scripts/gameCollectors.test.ts` (the round trip, filled in by Tasks 3–5).

**Interfaces:** `poolsOf(tree, parents)`, `groupedCombine(root, groups, model)`, `bestMap(save, ci, score, accept)`.

- [ ] Failing synthetic tests for each helper. Then, on the 5 newest saves, `bestMap` picks the same map as `lib/arkh`'s `bestDrMapIdx`, `bestAfkMapIdx` and `bestExpMapIdx` (or a difference explained in N.js). Implement it, then commit.

### Task 3: Coin, EXP, DR V2, Artifact Find

**Files:** `web/scripts/update-top-{coin,exp,dr2,artifact}.ts`, `web/lib/{coinMulti,expMulti,dropRateV2,artifactFind}/layers.ts` (class-talent lists), `gameCollectors.test.ts`.

- [ ] Write the round trip and `compare-top-ref` for these four. Every difference goes back to the tracker tests' KNOWN rows; report ms per character. Commit.

### Task 4: Damage, AFK Gains, Multikill

**Files:** `web/scripts/update-top-{damage,afk,multikill}.ts`, `web/lib/game/trackers/damage.ts` (export `layerOf`), `web/lib/{damage,afkGains,multikill}/layers.ts`, the existing collector tests (rewritten off `lib/arkh`), `gameCollectors.test.ts`.

- [ ] Same as Task 3. The Damage Reliquarium handling moves into its `computePools`. Commit.

### Task 5: DR V1, faithful to its rules

**Files:** `web/lib/game/trackers/dropRateV1.ts` (split into `v1Rows` and `v1Assemble`; `dropRateV1.test.ts` stays green), `web/scripts/update-top-dr.ts`, `web/scripts/_shared/top8DrCards.ts` (off `lib/arkh`), `web/lib/dropRate/arcaneBonus.ts` (deleted if nothing else uses it), `gameCollectors.test.ts`.

- [ ] Keep, by row id:
  - the two accumulators (non-ES and ES);
  - the Family Bonus 68 graft onto the ES profile;
  - the 8-card cap;
  - the talent 279 and 24 profiles;
  - the `TOP_DR` constants the page imports.
- [ ] Round trip and compare on 5 saves; commit.

### Task 6: Cleanup

**Files:**
- `web/scripts/update-top-talents.ts` (type import and generated header);
- `.github/workflows/refresh-top-max.yml` (comments);
- the pageConfig headers and the methodology sentence that says the reference is "still computed by the previous engine";
- `web/__tests__/lib/game/noArkhImports.test.ts`: a test that `scripts/_shared` and `scripts/update-top-*.ts` import no `lib/arkh`.

- [ ] The guard fails first, then passes. Run the full set of collector tests and `tsc`, then commit.
