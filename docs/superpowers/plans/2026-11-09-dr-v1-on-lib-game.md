# Drop Rate V1 on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `/drop-rate` page computes on `lib/game`, with the same 15-level tree and the same paths it has today.

**Architecture:** The formula is already ported: the total is the `TotalStats(ctx, "Drop_Rarity")` the V2 page uses. New code in `lib/dropRate/explain/` rebuilds V1's rows family by family, reading only `lib/game`. A path-by-path comparator against lib/arkh, on the newest saves, drives each family, and a `PENDING` list shrinks to empty. The page switches once, in the last task.

**Tech Stack:** TypeScript, Vitest, tsx scripts, `lib/game` (Ctx, block, runtime, assumed, attr/asNum, trackers/page.ts).

**Spec:** `docs/superpowers/specs/2026-11-09-dr-v1-on-lib-game-design.md`. The engine's rules and Rulings A–FFF are in `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`.

## Global Constraints

- Branch `feat/dr-v1-game`. Never commit to main. Stage only the files you touched, by path; never stage `docs/game-engine-coverage.md`. The trailer is exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- N.js (`web/scripts/updater/.cache/N.new.js`) is the only truth. `@offset` comments cite the raw file (Ruling JJ). lib/arkh is the comparison target only: **no runtime `@/lib/arkh` import from `lib/dropRate/explain`, `lib/dropRate/systems.ts` or the tracker** (`noArkhImports.test.ts`), and no logic copied from it. Read a value from the `lib/game` block the game uses.
- **Validation uses the newest saves only (user decision, 09/11).** The real-save test runs on the 5 most recently modified saves and maps 251, 301, 216 and 150. Never run the full suite with private saves, `__tests__/lib/arkh`, or a loop over every save.
- No silent zeros and no unstated stand-ins: only `runtime()`/`assumed()`, each stated. A row the game's block doesn't compute is read guarded and becomes a noted leaf, never a page error.
- Real-save tests use `skipIf` and load lazily, never in a describe body. Each family also has a synthetic test that runs in CI.
- Copy is in English. Never `npm run dev`. Never add files to `scripts/updater/golden/.cache/`.
- Vitest on Node 24: `npx vitest run <files> --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2`; re-run alone a file a worker crash took down.
- Subagents return their report as text: the harness refuses subagent report files.
- **Before opening the PR:** the controller runs the suite in a clean worktree on Node 22 (`npx -y node@22`), and the user checks the in-game value.

## Review Focus

1. **Paths are the contract.** Snapshots and the Compare key on `flattenTree` paths, including the `#i` suffix of same-named siblings (for example the two `🎁 Bundles` runs of Post-Processing). A path that changes silently loses a player's history comparison. Task 1's comparator fails on any missing or extra path.
2. **A locked or unowned source** keeps its V1 row with value 0 and its note (a class-gated talent, a companion not owned). Each family's synthetic test pins it.
3. **The Crystal Glunko Cove** (map 216, cavern 17): lib/arkh's V1 has no Cove and shows a total the game doesn't. The new total is the game's. Task 1 adds a root row `🏝️ Crystal Glunko Cove` only while active, and the guard allows for it, so no other path changes.
4. **An old save** refuses through `withPageErrors` with the friendly message, not engine text. Task 7 tests it.
5. **The chip override** (`chipGalleryActive`: auto, on, off) must keep moving the Gallery rows and the total as it does today. Task 3 owns the seed and Task 7 the page wiring.

---

### Task 1: Foundation, skeleton tree and comparator

**Files:**
- Create: `lib/dropRate/node.ts` (the `ArkhNode` type, moved; `lib/arkh/node` re-exports it, Ruling B).
- Create: `lib/dropRate/systems.ts`, rewritten from what `lib/arkh/stats/categorize.ts` exports (`SystemKey`, `WorldKey`, `decorateSystem`, `parseSystemFromBucketName`, `systemWorld`, `classifySystem`, `categorizePoolItems`). lib/arkh re-exports them. `components/dropRate/DeepView.tsx` imports from here.
- Create: `lib/dropRate/v1Sources.ts`, `lib/dropRate/explain/index.ts`, `lib/game/trackers/dropRateV1.ts`.
- Create: `__tests__/lib/game/trackers/dropRateV1.test.ts`, `__tests__/lib/game/support/v1Compare.ts`.
- Modify: `lib/diagnose/characterize.ts` (export `newestSaves(saves: string[], n: number): string[]`, moved from `scripts/characterize.ts`'s `--recent`).

**Interfaces:**
- `type Explainer = (ctx: Ctx, value: number) => ArkhNode[]`: the rows under a source. `EXPLAINERS: Record<string, Explainer>` in `explain/index.ts`, keyed by V1 source id; a task adds its family's entries.
- `V1_SOURCES`: one entry per source of `lib/arkh/stats/defs/drop-rate.ts`'s pools, in order: `{ id, pool, name, fmt, note?, from }`, where `from` finds the source's value in the trace of the one call. `lib/game/trackers/dropRate.ts` already maps every Drop Rate term to its call; reuse its `takeFrom`/`findCall` path.
- `computeGameDropRateV1(save: unknown, charIdx: number, mapIdx: number, opts?: { chipGalleryActive?: boolean }): { tree: ArkhNode; total: number }`.
- `compareV1(save, ci, map): { missing: string[]; extra: string[]; value: string[]; meta: string[] }` compares `flattenTree` paths, values (relative 1e-9), `fmt` and `note`.
- `PENDING: Set<string>`: V1 source ids whose rows aren't built yet. Differences below a pending source are ignored. `V1_KNOWN: { path: RegExp; why: string }[]`: a path where lib/arkh is wrong, with its N.js evidence.

- [ ] **Step 1:** Write the failing tests:
  - synthetic: the root's five children in V1's order and names; a Cove row only on map 216 in cavern 17;
  - real saves: `compareV1` on the 5 newest saves × 4 maps gives no `missing`/`extra`/`value`/`meta` outside `PENDING` and `V1_KNOWN`, with every source pending below its own row.
- [ ] **Step 2–4:** FAIL → implement → pass. The tree's pools, buckets (`systems.ts`), Total Sum, Chip Cap-Break and Post-Processing use V1's names, notes and order. A guard compares the rebuilt total with the block's on non-Cove pairs, in the form of Multikill's (`near` on the parts, so float order can't fire it).
- [ ] **Step 5:** Commit `feat(drop-rate): V1 tree skeleton on lib/game, and its comparator`.

### Task 2: Talent rows

**Files:** `lib/dropRate/explain/talent.ts`, synthetic tests in `__tests__/lib/dropRate/explain/talent.test.ts`.

The sources: talents 279, 24 and 655 and `royalGrade` 239, plus every other talent row that appears under another source. The rows are `Effective Level`, `Base Level`, `Max Book Lv Cap`, the `Bonus Levels` chain (Salt Lick, Merit Shop, Oxygen Atom, Sovereign Fury Relic, Summoning, Family Guy…) and the decay text. Read them from the `lib/game` talent blocks (`GetTalentNumber`, `getbonus2`, `TalentCalc`).

- [ ] **Step 1:** Synthetic test: a talent at level 0, at the book cap, and class-gated; assert the row names and values by hand.
- [ ] **Step 2–4:** FAIL → implement → pass. Remove these ids from `PENDING`; `compareV1` stays clean.
- [ ] **Step 5:** Commit `feat(drop-rate): V1 talent rows`.

### Task 3: Gallery, Hatrack, Cape Vine, Obols and equipment

**Files:** `lib/dropRate/explain/equipment.ts`, tests beside it.

The sources: `etcBonus` 2, 91 and 99, and `setBonus` efaunt. This covers Gallery (`Gallery Level`, `Gallery Bonus Multi`), Hatrack, Cape Vine, Obols and the equipment rows. It also owns the chip override: `opts.chipGalleryActive` becomes a seed on `chipBonuses("troph")` for the tree, stated as `assumed:` when it differs from automatic.

- [ ] **Step 1:** Synthetic tests: the override on, off and automatic, and an empty trophy/nametag; assert by hand.
- [ ] **Step 2–4:** FAIL → implement → pass. Shrink `PENDING`; `compareV1` stays clean.
- [ ] **Step 5:** Commit `feat(drop-rate): V1 gallery and equipment rows`.

### Task 4: Farming, Holes and World 6–7 sources

**Files:** `lib/dropRate/explain/world67.ts`, tests beside it.

The sources: `farm` (rank9, cropSC7, exotic59), `holes` (upg46, upg82, meas15, monument), `caveDR`, `grimoire`, `spelunkShop`, `legendPTS`, `emperor`, `grid`, `glimbo`, `minehead`, `menagerieBoost`, `pristine`, `rogDropMulti`, `vial`.

- [ ] **Step 1:** Synthetic tests: a locked source at 0 and one source per subsystem at a seeded value; assert by hand.
- [ ] **Step 2–4:** FAIL → implement → pass. Shrink `PENDING`; `compareV1` stays clean.
- [ ] **Step 5:** Commit `feat(drop-rate): V1 farming, holes and late-world rows`.

### Task 5: Cards, companions and food

**Files:** `lib/dropRate/explain/collections.ts`, tests beside it.

The sources: `card` (10, 101), `cardSet`, `cardSingle`, `companion`, `compMulti`, `goldenFood`, `stamp`, `alchemy`, `starSign`, `prayer`, `shiny`, `sigil`.

- [ ] **Step 1:** Synthetic tests: a companion not owned shows "Not owned — would grant +X" from `CompanionDB`; a card at each star; gold food's multi; assert by hand.
- [ ] **Step 2–4:** FAIL → implement → pass. Shrink `PENDING`; `compareV1` stays clean.
- [ ] **Step 5:** Commit `feat(drop-rate): V1 card, companion and food rows`.

### Task 6: The remaining sources

**Files:** `lib/dropRate/explain/simple.ts`, tests beside it.

Everything still in `PENDING`: `lukScaling`, `chip`, `arcade`, `guild`, `shrine`, `postOffice`, `dream`, `winBonus`, `tome`, `achievement`, `owl`, `voting`, `vault`, `friend`, `companion` leftovers, `ola`, `bundle`, `workshop`, `arcaneMap`, `royalStatue`, `familyBonus`, `cloudBonus`.

- [ ] **Step 1:** Synthetic tests: one row per source shape; assert by hand.
- [ ] **Step 2–4:** FAIL → implement → pass. `PENDING` is empty, and `compareV1` is clean on every newest-save pair with only `V1_KNOWN` differences.
- [ ] **Step 5:** Commit `feat(drop-rate): the remaining V1 rows`.

### Task 7: Switch the page

**Files:** `components/dropRate/DrCalculator.tsx`, `components/dropRate/ArkhTree.tsx`, `lib/dropRate/treeFlatten.ts` (type import), `app/drop-rate/DropRatePageClient.tsx` if its copy says otherwise, `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`.

- `DrCalculator` calls `computeGameDropRateV1` through a dynamic import and passes `chipGalleryActive`. Errors go through `pageError`, so an old save gets the friendly message.
- Spec: add "Decisões da migração do DR V1" with this migration's decisions, continuing the letters after FFF. The code may cite only rulings the spec defines.

- [ ] **Step 1:** Write the failing tests: `PENDING` is empty; the page's compute path imports no runtime `@/lib/arkh` (`noArkhImports`); an old save's error is the friendly one.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Run `tsc`, `__tests__/lib/game/trackers/dropRateV1.test.ts`, `__tests__/lib/dropRate`, `noArkhImports.test.ts` and `__tests__/updater`.
- [ ] **Step 6:** Commit `feat(drop-rate): the V1 page computes on lib/game`. The controller runs the clean-worktree Node 22 suite, pushes, opens the PR and checks the Vercel preview.

---

Out of this plan: the DR Max research tool, the debug scripts that import `lib/arkh/computeDR`, `/talents-level` and the Observed Max collector.
