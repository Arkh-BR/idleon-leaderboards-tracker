# Remove `lib/arkh` and relicense to MIT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** nothing in the repo imports `web/lib/arkh`, the directory is deleted, and the repo's license is MIT.

**Architecture:** the tools that still compare against `lib/arkh` become `lib/game`-only. The tests that used `lib/arkh` as an oracle lose that part, and keep their synthetic and `lib/game`-only checks. The last Arkh-derived runtime file (`lib/dropRate/arcaneBonus.ts`) is replaced with a `lib/game` read. Then `lib/arkh` is deleted and the license swapped.

**Spec:** the user's decisions of 2026-11-10 (memory `game-engine-rewrite`, `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`): delete `lib/arkh`, relicense to MIT, keep the inherited row labels.

## Global Constraints

- N.js (`web/scripts/updater/.cache/N.new.js`) is the only truth.
- Never fetch, never run any `scripts/update-top-*.ts`, never `npm run dev`. Never loop over every save. Never add files to `golden/.cache/`.
- NEVER create a git worktree with a `node_modules` junction and then `git worktree remove --force` it.
- Stage by path, never `git add -A`. Commit messages end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `npx vitest run <files> --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2` from `web/`.
- Keep the inherited labels and tree shapes (user decision).
- Don't touch the user's untracked files under `web/scripts/` (check-cook-analysis, check-cook-tree, check-cook-whatif, validate-friend, validate-hatrack, check-dungeon, check-tome-gains).

## Review Focus

1. A synthetic test that lived in the same file as a lib/arkh parity test must survive the cut.
2. `characterize` and the dr-debug tools must still answer the question they exist for (site vs game value) without lib/arkh.
3. The updater's golden harness still guards formula changes after losing its lib/arkh engine.
4. The DR page's map picker gives the same map as `arcaneBonus.ts` did.
5. Nothing outside `lib/arkh` breaks when it is deleted: `tsc`, the clean suite, and the Next build's imports.

---

### Task 1: Tools off `lib/arkh`

**Files:** `web/scripts/characterize.ts` and `web/lib/diagnose/*` (whatever reads `lib/arkh`), `web/scripts/dr-debug/{bisect,build-envelope,tree-diff}.ts` plus `web/scripts/dr-debug/README.md`, `web/scripts/updater/golden/{engines,cases,run}.ts` plus `web/scripts/updater/README.md`, and delete `web/scripts/compare-top-ref.ts`.

- [ ] For each tool, keep what it is for:
  - characterize prints the lib/game value and trace per pair and the refusals;
  - dr-debug bisects and diffs two lib/game trees;
  - golden validates lib/game totals against references.
  - Replace the lib/arkh side with lib/game, or drop it where it was only the oracle.
- [ ] Tests for these tools pass, and `tsc` is clean. Commit.

### Task 2: Tests off `lib/arkh`

**Files:**
- delete `web/__tests__/lib/arkh/`;
- in every other test file that imports `lib/arkh` (≈70: `__tests__/lib/game/**`, `__tests__/lib/<stat>/**`, `__tests__/scripts/**`, the support files `arkhOracle.ts`, `arkhTalent.ts`, `arkhTome*`, `v1Compare.ts`, `talentCompare.ts`, `tomeCompare.ts`, `damageProof.ts`), remove the lib/arkh comparisons and keep every check that doesn't need lib/arkh.

- [ ] List each file, and for each either delete it (if it only compared against lib/arkh) or cut the lib/arkh parts. Delete the oracle support files once nothing imports them.
- [ ] The clean suite still has every synthetic test it had; report the before/after test counts per file.
- [ ] Commit.

### Task 3: The last runtime import, and the directory

**Files:**
- `web/lib/dropRate/arcaneBonus.ts`: replace it with a lib/game read (`ArcaneType`, or `bestMap`'s rule in `scripts/_shared/gamePools.ts`), then delete it;
- `web/components/dropRate/DrCalculator.tsx`;
- delete `web/lib/arkh/`;
- `web/__tests__/lib/game/noArkhImports.test.ts` becomes a check that nothing imports `lib/arkh`;
- comments across `web/lib` that say "lib/arkh re-exports" (Ruling B) are reworded or removed;
- `.gitignore` or config references to `lib/arkh`, if any.

- [ ] The DR page's picker gives the same map as before on the 5 newest saves.
- [ ] `tsc`, the clean Node 22 suite, and a grep showing no `lib/arkh` import anywhere.
- [ ] Commit.

### Task 4: MIT

**Files:** `LICENSE` (the MIT text, `Copyright (c) 2026 Arkh-BR`), `web/package.json` (and the root one if it has a `license` field), `README.md` (license section and credits), and any `SPDX`/GPL mention in source headers (grep `GPL`).

- [ ] Keep the credits that describe where game data comes from (the game itself). Drop any claim that GPL applies. Mention that earlier versions were published under GPL-3.0.
- [ ] Commit.
