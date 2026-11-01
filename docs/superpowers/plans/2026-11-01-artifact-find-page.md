# Artifact Find Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/artifact-find` page that computes the Skill Info "Artifact Find" multi (`Sailing("BoatArtiMulti", 0)`) from the save, with tree, Biggest Gains, Compare vs Observed Max and History — same kit as Coin/EXP/AFK.

**Architecture:** New grouped descriptor + `artifact` system in the arkh engine (7 new N.js ports, the rest reuse existing helpers), a `computeArtifactFind` entry, two opt-in kit flags (`noMap` on the page config, `perFamily: false` on the collector), and a page config wired like `lib/expMulti`.

**Tech Stack:** TypeScript, Next.js app router, vitest + @testing-library/react, tsx scripts.

**Spec:** `docs/superpowers/specs/2026-10-31-artifact-find-page-design.md`

## Global Constraints

- N.js is the only source of truth; every new port carries an `@njs` tag naming its block (registry guard must stay green).
- Site copy in English; replies to the user in Portuguese.
- Total = `BoatArtiMulti(0)` — boat 0 fixed, character selector only, no map.
- Observed Max: one account-wide reference (no class family, no gated talents), candidates from focus board `"sailing"`.
- No visible change to existing pages: `noMap` and `perFamily` default to today's behaviour.
- Work on branch `feat/artifact-find-page`; stage only touched files; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never merge to main without an explicit request.
- Never run `npm run dev`; verify with `npx tsc --noEmit`, `npx vitest run`, the Vercel preview.
- All commands run from `web/`.

## Review Focus

1. Account without Sailing (no `Boats`/`Captains`, short arrays) → total 1, no throw. Pinned by the smoke test (Task 3) and the empty-state port tests (Task 1).
2. Boat 0 with no captain (`Boats[0][0] = -1`) → captain term 0. Pinned in Task 1.
3. Menagerie unlock 22 moves Sticker 2 from the additive pool to its own factor — never both. Pinned in Task 2.
4. Save without a Tome score (`totalTomePoints` 0) → `LoreEpiBon` 0, never NaN. Pinned in Task 2.
5. A character without Artifosho equipped still gets it when the sign is unlocked as infinite. `starSignBonusReal` already walks the infinite signs; Task 2 adds a second case with the sign only in `starSignsUnlocked` (enabled count > 61) expecting 15.

---

### Task 1: Boat & captain ports (sailing)

**Files:**
- Modify: `lib/arkh/state.ts` (add `boatsData: any[]`, `captainsData: any[]`, defaults `[]`)
- Modify: `lib/arkh/save/loader.ts:109` (next to `sailingData`: `parseSaveKey(save, "Boats")`, `parseSaveKey(save, "Captains")`)
- Modify: `lib/arkh/stats/systems/w5/sailing.ts`
- Test: `__tests__/lib/arkh/artifact-find-ports.test.ts`

**Interfaces:**
- Produces (all in `systems/w5/sailing.ts`):
  - `captBonusCalc(type: number, captainIdx: number, s: SaveData): number` — `@njs _customBlock_CaptBonusCalc`
  - `captainsOfType6(s: SaveData): number` — `NONdummies[60]`: count of `Captains[0..min(30,len))` with `[0] == 6`
  - `nightmarinerTotLv(s: SaveData): number` — `@njs NightmarinerTotLV`: `Σ_{e<20} max(0, Boats[e][3] + Boats[e][5] − 600)` (missing boat → 0)
  - `daveyJonesBonus(boatIdx: number, s: SaveData): number` — `@njs DaveyJonesBonus`

- [ ] **Step 1: Write the failing tests** (synthetic `SaveData` via `{ ...saveData, boatsData, captainsData, … }`)

```ts
it("captain bonus adds level × value for each matching slot", () => {
  const s = sd({ captainsData: [[3, 3, 0, 32, 0, 31, 43], [6, 1, 3, 10, 0, 5, 7]] });
  expect(captBonusCalc(3, 0, s)).toBe(32 * 31);   // slot 1 matches
  expect(captBonusCalc(3, 1, s)).toBe(10 * 7);    // slot 2 matches
  expect(captBonusCalc(3, -1, s)).toBe(0);        // no captain
});
it("counts type-6 captains among the first 30", () => {
  expect(captainsOfType6(sd({ captainsData: [[6], [2], [6]] }))).toBe(2);
});
it("Nightmariner total sums upgrades above 600 over 20 boats", () => {
  expect(nightmarinerTotLv(sd({ boatsData: [[0, 0, 0, 442, 0, 442], [0, 0, 0, 100, 0, 100]] }))).toBe(284);
});
it("Davey Jones triples once boat upgrades reach 400 with Grid 105", () => {
  const base = sd({ boatsData: [[0, 0, 0, 200, 0, 200]], gemItemsData: { 8: 2 }, gridLevels: { 105: 1 } });
  expect(daveyJonesBonus(0, base)).toBeCloseTo((1 + (100 + legendPTSbonus(11, base)) / 100) * 3, 12);
  expect(daveyJonesBonus(0, { ...base, gridLevels: {} })).toBeCloseTo(1 + (100 + legendPTSbonus(11, base)) / 100, 12);
});
it("empty sailing state yields neutral values", () => {
  const s = sd({});
  expect([captBonusCalc(3, 0, s), captainsOfType6(s), nightmarinerTotLv(s)]).toEqual([0, 0, 0]);
  expect(daveyJonesBonus(0, s)).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run** `npx vitest run __tests__/lib/arkh/artifact-find-ports.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement the four functions + state/loader fields.**
  `daveyJonesBonus(b) = (1 + (50·gemItemsData[8] + legendPTSbonus(11, s))/100) · (1 + 2·clamp01(⌊(Boats[b][3] + Boats[b][5] + 99600)/1e5⌋ · round(gridLevels[105])))` — `Grid_Bonus(105, 1)` is the raw grid level.

- [ ] **Step 4: Run the test** → PASS. Regenerate the registry `npx tsx scripts/updater/registry/gen-registry.ts`, then `npx vitest run __tests__/updater/registry.guard.test.ts` → PASS (each `@njs` name must exist in the N.js snapshot).

- [ ] **Step 5: Commit** `feat(arkh): port sailing captain, Davey Jones and Nightmariner terms`

### Task 2: Remaining new terms

**Files:**
- Modify: `lib/arkh/stats/systems/common/starSign.ts` (add `"61": [{ sign: 61, val: 15 }]` to `STAR_SIGN_TERMS`, N.js @6557415)
- Modify: `lib/arkh/stats/systems/exp/sticker.ts`
- Create: `lib/arkh/stats/systems/artifact/terms.ts`
- Test: `__tests__/lib/arkh/artifact-find-ports.test.ts` (same file)

**Interfaces:**
- Produces:
  - `stickerBonusSlot(idx: number, slot: 99 | 100, s: SaveData): number` in `sticker.ts` — `@njs StickerBonus`: returns 0 when `idx ∈ {1,2}` and (`slot==99` && `menagerieUnlockOwned(22)==1` or `slot==100` && `==0`), else `stickerBonus(idx, s)`.
  - In `artifact/terms.ts`:
    - `fractalIslandBonus(idx: number, s: SaveData): number` — `@njs FractalIslandBonus`: `OLA[184] ≥ [24, 200, 750, 2500, 1e4, 2e4, 4e4, 6e4][idx] ? 1 : 0`
    - `killroyBonus0(s: SaveData): number` — `@njs KillroyBonuses`: `1 + OLA[228]/(300 + OLA[228])`
    - `nightmarinerBon0(s: SaveData): number` — `@njs NightmarinerBon`: `menagerieUnlockOwned(13)==1 ? max(1, 1 + 1999·T/(T + 1e4)) : 1`, `T = nightmarinerTotLv(s)`
    - `holesBUpg55(s: SaveData): number` — `@njs B_UPG`: `Holes[13][55] ? 10·⌊getLOG(Holes[9][11])⌋ : 0`
    - `loreEpiBon(idx: number, s: SaveData): number` — `@njs LoreEpiBon`: if `Spelunk[13][2] > idx`: `(1 + (grimoireUpgBonus(17, …) + getSetBonus("TROLL_SET").val)/100) · a · f(tome − b)` with `a|b = Spelunky[21][idx].split("|")`, `f(x) = ⌊max(0,x)/100⌋^0.7 / (25 + ⌊max(0,x)/100⌋^0.7)`, `tome = s.totalTomePoints` (N.js `GenInfo[84]` = `TomeQTYtot`); else 0.

- [ ] **Step 1: Write the failing tests**

```ts
it("Fractal Island 3 needs 2500 hours", () => {
  expect(fractalIslandBonus(3, sdOla({ 184: 2499 }))).toBe(0);
  expect(fractalIslandBonus(3, sdOla({ 184: 2500 }))).toBe(1);
});
it("Killroy 0 saturates toward 2", () => {
  expect(killroyBonus0(sdOla({ 228: 300 }))).toBeCloseTo(1.5, 12);
});
it("Sticker 2 lives in exactly one slot, chosen by Menagerie unlock 22", () => {
  const locked = sdSticker({ unlock22: false }), open = sdSticker({ unlock22: true });
  expect(stickerBonusSlot(2, 99, locked)).toBeGreaterThan(0);
  expect(stickerBonusSlot(2, 100, locked)).toBe(0);
  expect(stickerBonusSlot(2, 99, open)).toBe(0);
  expect(stickerBonusSlot(2, 100, open)).toBeGreaterThan(0);
});
it("Lore episode bonus is 0 without a Tome score or before the episode", () => {
  expect(loreEpiBon(3, sd({ totalTomePoints: 0, spelunkData: { 13: [0, 0, 9] } }))).toBe(0);
  expect(loreEpiBon(3, sd({ totalTomePoints: 60000, spelunkData: { 13: [0, 0, 3] } }))).toBe(0);
});
it("Artifosho counts when equipped", () => {
  expect(starSignBonusReal("61", 0, sdSign({ equipped: "61" })).val).toBe(15);
});
```

- [ ] **Step 2: Run** the test file → FAIL.
- [ ] **Step 3: Implement** the functions above (reuse `menagerieUnlockOwned` from `data/w7/menagerie.ts`, `getLOG` from `formulas`, `grimoireUpgBonus` from `systems/mc/grimoire.ts` with the same grimoire game data its other callers pass).
- [ ] **Step 4: Run** → PASS; regenerate the registry and run `__tests__/updater/registry.guard.test.ts` (as in Task 1) → PASS.
- [ ] **Step 5: Commit** `feat(arkh): port Fractal Island, Killroy, Nightmariner, B_UPG 55, Lore episode and Artifosho terms`

### Task 3: Descriptor, system and entry point

**Files:**
- Create: `lib/arkh/stats/defs/artifact-find.ts`
- Create: `lib/arkh/stats/systems/artifact/artifact.ts`
- Modify: `lib/arkh/stats/registry.ts:134` (register `artifact`)
- Create: `lib/arkh/computeArtifactFind.ts`
- Test: `__tests__/lib/arkh/artifact-find.smoke.test.ts`, `__tests__/lib/arkh/artifact-find.combine.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2 exports; existing `computeArtifactBonus(3, ci, ctx)`, `computeShinyBonusS(21, s)`, `getBribeBonus("34", s)`, `arcadeBonus(32|66, s)`, `gridBonusValue(106|109, s)`, `vaultUpgBonus(63, s)`, `companions(43|56|154, s)`, `s.companionLv2Ids.has(154)`, `computeButtonBonus(3, s)`, `computeVialByKey("6turtle", s)`, `eventShopOwned(48, s.cachedEventShopStr)`, `sushiRoG.resolve(7, ctx)`, `computeWinBonus(3, null, s)`, `jellyRoGBonus(19, s)`, `mainframeBonus(14, s)`, `pristineBon(2, s)`, `votingBonusz(20, undefined, s)`, `computeMonumentROGbonus(1, 2, s)`, `computeExoticBonus(45, s)`, `computePaletteBonus(5, s)`, `superBitType(26, gamingData[12])`, `spelunkData[6].length`, `starSignBonusReal("61", ci, s)`.
- Produces:
  - `ARTI_ROOT = "Artifact Find"`, `ARTI_VOTE_NAME`, `ARTI_GROUPS: readonly StatGroup[]` — group `a` kind `pct` with sources `artifact3, captain, shiny21, fractal3, bribe34, captains6, arcade32, arcade66, bUpg55, sticker2add, grid109, vault63` (fractal3 = `20·fractalIslandBonus(3)`, captains6 = `25·min(30, captainsOfType6)`, captain = `captBonusCalc(3, Boats[0][0])`); then one group per spec factor M1–M23 in spec order — `pct` for the `1 + x/100` factors (M1, M2, M6, M7, M8, M10, M11, M12, M14, M15, M16, M17, M20, M21, M22), `raw` for M18 (`1 + Companions(43)`), `mult` with `max1: true` for M4 (`min(2, 1 + 2·C154) + lv2`), M5 (Killroy), M9 (`1.5^slugs`), M19 (`C56/5`), M23 (`1.02^n · superBit26`), plain `mult` for M3 (Nightmariner) and M13 (Davey Jones).
  - `computeArkhArtifactFind(raw: any, charIdx: number): StatResult`, `computeArkhArtifactPools(raw: any, charIdx: number): Record<string, Pool>`, `combineArtifactPools(pools): StatResult` — wrap `computeStatTree/Pools(desc, raw, charIdx, 0)`.
  - Boat index is the constant `SKILL_INFO_BOAT = 0` in `artifact.ts`.

- [ ] **Step 1: Write the failing tests**
  - smoke: `computeArkhArtifactFind({ charNames: ["A"], data: {} }, 0)` → `total === 1`, `tree.children.length === ARTI_GROUPS.length`.
  - combine: hand pools → `combineArtifactPools({ a: pool(100), …neutral… }).total === 2`; a `mult max1` group with source 0.5 contributes 1.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** descriptor, `resolveArtifact(id, ctx)` switch (throws on unknown id, like `resolveCoin`), registry entry, entry file. No outer `max(1, …)`: every factor is ≥ 1 (`// ponytail:` comment saying so).
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit` → no errors.
- [ ] **Step 5: Commit** `feat(arkh): Artifact Find descriptor (Sailing BoatArtiMulti, boat 0)`

### Task 4: In-game validation on a real save

**Files:**
- Test: `__tests__/lib/arkh/artifact-find.save.test.ts`

- [ ] **Step 1: Get the reading.** Ask the user (AskUserQuestion) for a Skill Info → Sailing screenshot with the logged-in character, and capture the save at that moment per `scripts/dr-debug/README.md` into `scripts/updater/golden/.cache/arkhe-live-<date>.json`.
- [ ] **Step 2: Write the test** — `describe.skipIf(!existsSync(SAVE))`, compute for the character in the screenshot, assert `formatArtifactFind(total)` equals the game text and `total` within 0.01% of the read number.
- [ ] **Step 3: Run.** If it fails, bisect per the playbook (two readings, term-by-term vs N.js) and fix the port in Tasks 1–3's files, each fix with its own unit test.
- [ ] **Step 4: Commit** `test(arkh): pin Artifact Find to the in-game Skill Info reading`

### Task 5: Kit — page without map

**Files:**
- Modify: `lib/statTracker/config.ts` (`noMap?: true` on `StatPageConfig`, doc comment)
- Modify: `components/statTracker/StatCalculator.tsx:229-257`
- Test: `__tests__/components/statTracker/StatCalculator.test.tsx`

**Interfaces:**
- Produces: `StatPageConfig.noMap?: true` — calculator hides the map `<select>`, labels the row "Character:", calls `config.compute(save, charIdx, 0)`.

- [ ] **Step 1: Write the failing test** — render with `{ ...testConfig, noMap: true }`, load `save()`: `screen.getAllByRole("combobox")` has length 1 and `screen.getByText("Character:")` exists; with `testConfig` the existing two-select tests still pass.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the component tests → PASS.
- [ ] **Step 5: Commit** `feat(statTracker): optional page without the map selector`

### Task 6: Collector — one account-wide reference

**Files:**
- Modify: `scripts/_shared/topStatCollector.ts` (`perFamily?: false` on `StatCollectorConfig`)
- Create: `scripts/update-top-artifact.ts`
- Create (generated): `lib/artifactFind/topArtifactFind.ts`, `lib/artifactFind/topArtifactFind.meta.ts`
- Modify: `../.github/workflows/refresh-top-max.yml` (step after Multikill, same shape: `continue-on-error: true`, `timeout-minutes: 12`, `npx tsx scripts/update-top-artifact.ts`; add the two files to the commit step's paths)
- Test: `__tests__/scripts/topStatCollector.test.ts`

**Interfaces:**
- Consumes: `computeArkhArtifactPools`, `combineArtifactPools`, `ARTI_ROOT`, `ARTI_GROUPS` (Task 3).
- Produces: with `perFamily: false` every char merges into family key `"all"`; generated `TOP_ARTI_FAMILY_FLAT = { all: … }`, `TOP_ARTI_DEFAULT_FAMILY = "all"`, empty `TOP_ARTI_CLASS_PROFILE`; `topArtifactFlatForClass(classKey)` returns the `all` flat for any key. `ClassFamily` widens to `ClassFamily | "all"` only inside the collector.

- [ ] **Step 1: Write the failing test** — `buildFamilyReference` fed `{ all: mergeBest(…) }` with `gated: []` returns `defaultFamily: "all"`, `classProfile` `{}`; the generated lookup (same `new Function` harness as the existing test) returns the `all` flat for `"Royal_Guardian"` and `null`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the flag (family key = `cfg.perFamily === false ? "all" : classFamilyOfIndex(…)`; skip the class-profile loop when `"all"`), then the script (`focusBoard: "sailing"`, `gated: []`, `constPrefix: "TOP_ARTI"`, `flatForClassFn: "topArtifactFlatForClass"`).
- [ ] **Step 4: Generate** `npx tsx scripts/update-top-artifact.ts --saves-dir scripts/updater/.cache/saves-fresh` → "✓ Scanned 83 players", files written; run the test file → PASS.
- [ ] **Step 5: Commit** `feat(observed-max): Artifact Find reference (account-wide) + cron step`

### Task 7: Page

**Files:**
- Create: `lib/artifactFind/format.ts`, `lib/artifactFind/pageConfig.ts`
- Create: `app/artifact-find/page.tsx`, `app/artifact-find/ArtifactFindPageClient.tsx` (copy the `app/exp-multi` pair)
- Modify: `components/TopNav.tsx:16-21` (`{ href: "/artifact-find", label: "🏺 Artifact Find" }` after Multikill)
- Modify: `app/page.tsx` (ShortcutCard after Multikill: icon 🏺, title "Artifact Find Tracker", cta "Open Artifact Find")
- Test: `__tests__/lib/artifactFind/format.test.ts`, `__tests__/lib/artifactFind/pageConfig.test.ts`

**Interfaces:**
- Consumes: `computeArkhArtifactFind` (Task 3), `noMap` (Task 5), `topArtifactFlatForClass` + meta (Task 6), `notateBig`/`notateMultiplierInfo` from `lib/coinMulti/format.ts`.
- Produces: `formatArtifactFind(x: number): string` — Skill Info rule: `x > 1e4 ? notateBig(x) : notateMultiplierInfo(x)`; `ARTIFACT_PAGE: StatPageConfig` with `noMap: true`, storage keys `artifact-find-tracker.last-upload.v1`, `artifact-find-tracker.playerName`, `artifact-find-tracker.v1`, `artifact-find.snapshot-section.collapsed.v1`, export prefix `artifact-find-snapshots`, label `artifact-find-tracker`; `gains: groupedGainsModel(ARTI_ROOT, ARTI_GROUPS, { skip: [ARTI_VOTE_NAME] })`.

- [ ] **Step 1: Write the failing tests** — format: `formatArtifactFind(12345.6)` = `notateBig(12345.6)`, `formatArtifactFind(523.4)` = `notateMultiplierInfo(523.4)`; pageConfig: storage keys as above, `noMap === true`, `loadTop().flatForClass(null)` non-empty, the vote row absent from `gains.sources`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Copy (English): subtitle "Computes your Sailing Artifact Find multiplier from your save — the number in the Skill Info. Select a character. All processing local in your browser."; methodologyNote says the reference is the best value of each source across the top players, measured on boat 0 like the Skill Info, and the weekly vote isn't ranked.
- [ ] **Step 4: Run** `npx tsc --noEmit` and `npx vitest run` → all PASS.
- [ ] **Step 5: Commit** `feat(artifact-find): Artifact Find tracker page`

### Task 8: Ship

- [ ] **Step 1:** `git fetch` + rebase on `origin/main`; regenerated `top*` conflicts keep ours.
- [ ] **Step 2:** push, open PR (body: problem, change, checks, `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), bind it, wait for CI + Vercel.
- [ ] **Step 3:** open the Vercel preview `/artifact-find` with the user's save; the headline equals Task 4's reading; Biggest Gains lists sources. Report to the user; merge only on request.
