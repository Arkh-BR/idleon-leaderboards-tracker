# Talents no `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/talents-level` computes on `lib/game`, with the same tree paths, and no runtime import of `lib/arkh`.

**Architecture:** one entry (`lib/game/trackers/talents.ts`) builds a talent's tree from `lib/game` blocks. The shared rows come from `lib/dropRate/explain/talent.ts`; this page's families live in `lib/talentsLevel/explain/`. A path-by-path comparer against `lib/arkh` on the 5 newest saves gates each family, and the page switches engine only in the last task.

**Tech Stack:** TypeScript, Vitest. Node 22 for the clean run.

**Spec:** `docs/superpowers/specs/2026-11-09-talents-on-lib-game-design.md`

## Global Constraints

- N.js (`web/scripts/updater/.cache/N.new.js`, RAW offsets in `@offset` comments, Ruling JJ) is the only truth. IdleonToolbox and corgan are never references.
- No runtime import of `@/lib/arkh` in new code. `lib/arkh` may re-export from the new homes (Ruling B). Guard: `__tests__/lib/game/noArkhImports.test.ts`.
- `lib/game` conventions: `block`, `Ctx`, `attr`/`asNum`/`listAt`, strict reads, `runtime()`/`assumed()` for session-only values, `PORTED` updated when a sub-case is added.
- Run `npx tsx scripts/updater/registry/gen-registry.ts` after adding a sub-case or an `@njs` annotation.
- Validation uses only the 5 newest saves (`newestSaves` in `lib/diagnose/characterize.ts`). Never loop over every save or run `__tests__/lib/arkh`.
- Tests: `npx vitest run <files> --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=2` from `web/`.
- Never run `npm run dev`. Saves stay out of git. Stage by path, never `git add -A`, never `docs/game-engine-coverage.md`.
- Commit messages end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Site text stays in English. Row names, order, formats and notes are the current ones, because the Hypothetical tab compares by path.
- A shared `lib/game/njs` block changed: run `npx tsx scripts/characterize.ts <stat> --recent 5 --map 251` for damage, coinMulti, dropRateV2, expMulti, afkGains and multikill.
- Subagents cannot write report files: return the report as text.

## Review Focus

1. A talent id with no formula data: a leaf with the note `no formula data`, never a page error.
2. A character without the talent (level 0): `Active` 0, and `Super Levels` with the "would give +X" note when it could be super.
3. A save without `SLpre_i`: the other preset reads as empty, as today, not a thrown error.
4. A wrap counter that exists only in a running game: an `assumed:` note and the row, not a page error.
5. Asking for the other preset, then the active one, gives the first answer again: the derived state must not leak through `stateOf`'s cache.

---

### Task 1: The entry, the comparer, and the plain talents

**Files:**
- Create: `web/lib/game/trackers/talents.ts`
- Create: `web/lib/talentsLevel/explain/plain.ts`
- Create: `web/__tests__/lib/game/support/talentCompare.ts`
- Create: `web/__tests__/lib/game/trackers/talents.test.ts`
- Modify: `web/lib/dropRate/explain/talent.ts`
- Move: `web/lib/arkh/stats/entity-names.ts` to `web/lib/talentsLevel/entityNames.ts` and its `.gen` table to `web/lib/game/data/generated/` (update `scripts/gen-entity-names.ts`); `lib/arkh` re-exports.

**Interfaces:**
- Produces:
  - `type TalentOpts = { presetIdx?: 0 | 1; forceSuperActive?: boolean }`
  - `computeGameTalent(save: unknown, charIdx: number, talentId: number, opts?: TalentOpts): ArkhNode`
  - `presetState(save: unknown, charIdx: number, presetIdx: 0 | 1): GameState` (the derived envelope, built fresh, never put in `stateOf`'s cache)
  - in `explain/talent.ts`: `TalentRowsOpts` gains `split?: boolean` (a separate `Super Levels` row), `forceSuper?: boolean`, `capOf?: (c: Ctx, id: number, who: number) => ArkhNode | null`
  - `compareTalent(save: unknown, ci: number, id: number, opts: TalentOpts): V1Diff` and `TALENT_KNOWN` (same shape as `V1_KNOWN`), `PENDING_WRAPS`/`PENDING_BOOSTERS` sets of ids skipped until their task lands.
- Consumes: `talentLevelRows`, `guarded`, `raw`, `row` from `explain/talent.ts`; `getbonus2`, `GetTalentNumber`.

- [ ] **Step 1: Write the failing tests.** In `talents.test.ts`, synthetic:
  - an unknown id gives `{ name: label, val: 0, note: "no formula data" }`;
  - a level-0 talent has `Active` 0 and a `Super Levels` row whose `Active` child is 0;
  - star 627 has `Max Level` = `5 * (Tasks[2][0][3] + 1)` over a lower saved `SM`;
  - star 641 has `Max Level` = the live `maxBookLv` over a lower saved `SM`;
  - `presetState` leaves the source envelope and `stateOf(save)` unchanged, and a save without `SLpre_0` reads level 0.
  And a `describe.skipIf(no saves)` running `compareTalent` on the newest save for every non-pending talent of each character's class (`TALENT_TABS_BY_CLASS`), both presets, expecting an empty diff outside `TALENT_KNOWN`.
- [ ] **Step 2: Run them.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Root name is `label("Talent", id)`. Common talent note is `${formula}(${x1},${x2},${effectiveLv})`. Account-wide ids (`isAccountWideTalent`, except 328 and 655) use `Reference Character` through `talentLevelRows(c, id, { best: true, split: true })`. The star rows follow the table in the spec. `Max Level`: `STAR_TASK_MAX` and 641–647 raise the account-wide `SM`.
- [ ] **Step 4: Run the tests, the DR V1 comparer (`compareV1` on the newest save) and `tsc`.** Expected: PASS; V1 rows unchanged.
- [ ] **Step 5: Commit** `feat(talents): the talent tree on lib/game, plain talents`.

### Task 2: Cap boosters

**Files:**
- Create: `web/lib/talentsLevel/capBoosters.ts` (moved table; `lib/arkh/.../talent-cap-boosters.ts` re-exports)
- Create: `web/lib/talentsLevel/explain/capBoosters.ts`
- Modify: `web/lib/game/trackers/talents.ts`, `talentCompare.ts` (clear `PENDING_BOOSTERS`), `talents.test.ts`

**Interfaces:**
- Produces: `capBoosterRow(c: Ctx, id: number, who: number): ArkhNode | null`, passed as `capOf`.
- Consumes: `computeGameTalent`'s internal builder, with `{ tab: 2 }` for `kind: "y"` boosters and account-wide mode for `scope: "account-wide"`.

- [ ] **Step 1: Failing synthetic tests:** cap = base + boosters; a bubble clamp uses `min(raw, CauldronInfo[chap][slot])` with rows `Booster Raw` and `<label> Lv`; saved `SM` above the formula gives `Saved SkillLevelsMAX (override)` and the max; equal gives `(verified)`; saved 0 keeps the formula with no row.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Rows named as today: `Talent Cap (base + boosters)`, `Base Cap (hardcoded)`, each `b.label`, the source tree under the source's own name.
- [ ] **Step 4: Run the tests and `compareTalent` for the 12 talents.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(talents): cap boosters on lib/game`.

### Task 3: Wraps with plain counters

**Files:**
- Create: `web/lib/talentsLevel/wraps.ts` (the table, `readCounter`, `applyWrap`), `web/lib/talentsLevel/explain/wraps.ts`
- Modify: `web/lib/game/trackers/talents.ts`, `talentCompare.ts`, `talents.test.ts`
- Modify: `web/lib/arkh/stats/data/common/talent-final-bonus-wraps.ts` only if a shared type moves (keep it working for `lib/arkh`).

**Interfaces:**
- Produces: `TALENT_WRAPS: Record<number, TalentWrapSpec>` with the same fields as today, except `wrapWithSave`/`extraBaseKids` take `(…, ctx: Ctx)`; `wrapRow(c: Ctx, id: number, name: string, raw: number, kids: ArkhNode[], effectiveLv: number): ArkhNode | null`.
- Counter kinds this task covers: `OLA`, `Lv0`, `PetsStored`, `MinigameHiscore`, `TotalStat`, `PlayerHPmax`, `PlayerMPmax`, `PlayerSpeedBonus`, `SkillStats`, `GrimoireUpgTotal`, `ArcaneUpgTotal`, `CompassUpgTotal`, `TotBreedzWWz`, `StatueOnyx`, `TotalTitanKills`, `InvStorageOwned`. `CalcTalent` stays in `PENDING_WRAPS` until Task 4.

- [ ] **Step 1: Failing synthetic tests:** a `logMul` wrap active and inactive (`inactiveVal`, `inactiveNote`), a `wrapWithLv` using the tab-2 curve (talent 282), and `InvStorageOwned` going through `assumed:`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Each counter reads a `lib/game` block: `TotalStats`, `PlayerHPmax`, `PlayerMPmax`, `PlayerSpeedBonus`, `Summoning`/`ArcaneType`/`Windwalker` and the items count in `WorkbenchStuff.ts`. A total the game has no block for is summed from its N.js source, cited with `@offset`. A counter that differs from `lib/arkh` because `lib/arkh` is wrong goes in `TALENT_KNOWN` with the N.js evidence.
- [ ] **Step 4: Run the tests and `compareTalent` for the covered wraps.** Expected: PASS, with any difference listed.
- [ ] **Step 5: Commit** `feat(talents): final-bonus wraps with plain counters`.

### Task 4: Wraps with `TalentCalc` counters

**Files:**
- Modify: `web/lib/game/njs/TalentCalc.ts` (only the sub-cases missing), `web/lib/talentsLevel/wraps.ts`, `talentCompare.ts` (clear `PENDING_WRAPS`), `talents.test.ts`

**Interfaces:**
- Consumes: `TalentCalc(ctx, id)` for ids 31, 57, 59, 110, 125, 146, 209, 305, 430, 470, 485, 595, 616, 620, 643, 644, 650, 656.

- [ ] **Step 1: List which ids `TalentCalc` already answers** (the `PORTED` export). For each missing id, read its case in the RAW N.js and port it.
- [ ] **Step 2: Failing synthetic test per ported case**, values worked out from the N.js expression.
- [ ] **Step 3: Implement.** A counter the game fills only while running (a rift kill tracker, the overkill tier) goes through `runtime()`/`assumed()` with the reason. Where `lib/arkh` stubbed one to 0 and the save does hold it, follow the N.js and list it in `TALENT_KNOWN`.
- [ ] **Step 4: Run the tests, `compareTalent` for all 18, and `characterize --recent 5 --map 251`** on the six stats if `TalentCalc` changed.
- [ ] **Step 5: Commit** `feat(talents): final-bonus wraps with TalentCalc counters`.

### Task 5: To Max, Unbooked and the data tables

**Files:**
- Modify: `web/lib/talentsLevel/toMax.ts`, `unbooked.ts`, `charClass.ts`, `accountWideTalents.ts`
- Modify: `web/lib/arkh/stats/data/common/account-wide-talents.ts` (re-export from the new home); `scripts/gen-account-wide-talents.ts` (output path)
- Create: `web/__tests__/lib/talentsLevel/toMax.test.ts`

**Interfaces:**
- Produces: `maxBookLv(ctx: Ctx): number` exported from `explain/talent.ts` (the value of `maxBookLvRow`, N.js `WorkbenchStuff("maxBookLv", 0, 0)`); `computeTalentsToMax(save)` and `computeUnbooked(save)` keep their signatures and return types.

- [ ] **Step 1: Failing synthetic tests:** a talent below cap in one preset is listed; saved `SM` 0 falls back to `maxBookLv`; a cap-booster talent is left out of Unbooked; star tabs are skipped.
- [ ] **Step 2: Run them.** Expected: FAIL (still on `lib/arkh`, or wrong shape).
- [ ] **Step 3: Implement** on `stateOf` + `makeCtx`, with `SL`, `SM`, `SLpre` read via `opt`.
- [ ] **Step 4: Compare both scans with `lib/arkh` on the 5 newest saves** (a temporary script, not committed) and run the tests. Expected: deep equal.
- [ ] **Step 5: Commit** `feat(talents): To Max and Unbooked on lib/game`.

### Task 6: Switch the page

**Files:**
- Modify: `web/lib/talentsLevel/compute.ts`, `web/lib/talentsLevel/topTalents.ts` (type import), `web/app/talents-level/TalentsLevelPageClient.tsx` (type imports, `pageError` on the catch), `web/scripts/updater/golden/engines.ts` if the signature needs it
- Modify: `web/__tests__/lib/game/noArkhImports.test.ts` (walk `lib/talentsLevel`)

**Interfaces:**
- Consumes: `computeGameTalent`. `computeTalentEffective`, `computeTalentTreesForChars` and `getActivePresetIdx` keep their exported signatures; `useMaxResearchBaseLevel` is dropped after checking no caller passes it.

- [ ] **Step 1: Extend `noArkhImports`** to walk `lib/talentsLevel`. Run it. Expected: FAIL naming `compute.ts`.
- [ ] **Step 2: Switch `compute.ts`.** `computeTalentTreesForChars` keeps skipping a talent that throws.
- [ ] **Step 3: Run** `noArkhImports`, `talents.test.ts`, `tsc`, and the registry generator. Expected: PASS.
- [ ] **Step 4: Commit** `feat(talents): the Talents page runs on lib/game`.
