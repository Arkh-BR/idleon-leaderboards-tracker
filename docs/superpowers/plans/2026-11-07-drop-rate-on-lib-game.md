# Drop Rate on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Drop Rate V2 page (`/drop-rate-v2`, the statTracker kit) computes on `lib/game`, ported from N.js `TotalStats("Drop_Rarity")` (the sub-case of `_customBlock_TotalStats` @4190432 in the raw `N.new.js`). The page switches once the spec's criteria pass.

**Architecture:** This repeats the EXP Multi migration (`docs/superpowers/plans/2026-11-06-exp-multi-on-lib-game.md`, merged in PR #75): inventory, oracle, port the open rows, the core plus map rules, adapter, characterize, switch. Damage, AFK and EXP already ported 270 of the 300 sub-cases Drop Rate reaches. The work is the 30 open rows (TotalStats("Drop_Rarity") itself included) and the tracker.

**Tech Stack:** TypeScript, Vitest, tsx scripts, `lib/game` (GameState, Ctx, block, runtime, assumed, attr/asNum, migrations), `lib/diagnose` (njsClosure, njsCalls, verifyMap, characterize).

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`. Read "Migração", "Critérios pra trocar um tracker", and the decisions A–P (Artifact Find), Q–Z (Damage), AA–GG (AFK) and HH–KK (EXP). They all apply unchanged. The page's design is `docs/superpowers/specs/2026-11-01-drop-rate-v2-design.md`.

## Global Constraints

- **Every Global Constraint of the EXP plan applies verbatim, with the branch `feat/drop-rate-game`:**
  - N.js is the only truth.
  - One module per `_customBlock_`, with literal args. `@offset` comments cite the RAW `scripts/updater/.cache/N.new.js` (Ruling JJ).
  - `attr`/`asNum` use N.js names, and `asNum` goes at every `c.asNumber` site.
  - No silent zeros: only `runtime()`/`assumed()`, each one stated.
  - Real-save tests use `skipIf` and load lazily, never in a describe body. Seed-only edges run on a synthetic envelope.
  - KNOWN proofs use the narrowest seed, never the leaf's own key (`OWN`), with seeded≠unseeded and exact counts.
  - No runtime `@/lib/arkh` import from the trackers (`noArkhImports.test.ts`). The exceptions are `lib/game/data` and `lib/tome`.
  - The gate includes `__tests__/updater` and `__tests__/lib/arkh`, and the formula registry is regenerated.
  - Never add files to `scripts/updater/golden/.cache/`, because every `.json` there joins GOLDEN_SAVES. Captures go in `golden/.cache/captures/`.
  - Copy is in English. Never `npm run dev`. Never commit to main. Stage only the files you touched, and never stage `docs/game-engine-coverage.md`.
  - The trailer is exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **What the Drop Rate V2 page counts today (product decisions, kept):**
  - The "Drop Rate" line of the Player Info panel, outside a dungeon (Ruling Y).
  - The map sets the Arcane map multiplier. On map 216, when the character's cavern is 17 (`Holes[0][charIdx]`), the Crystal Glunko Cove (`Holes2("Cglunko_DR")`) replaces the total. N.js reads `CurrentMap`, so that is `ctx.map`.
  - The weekly vote is shown but not ranked (`DR2_VOTE_NAME`).
  - The groups, their order, names and kinds (`pct`, `mult`, `add` with `below`, `max1`, `replace`) stay as `DR2_GROUPS` declares them.
- **Out of scope:** the V1 page (`/drop-rate`, `lib/arkh/computeDR` and DeepView) stays on lib/arkh here. The user decided on 07/11 that V1 migrates too, in its own plan after this one.
- **Before opening the PR:** the controller runs the full suite once in a clean worktree with no private saves and no N.js cache, on Node 22 (`npx -y node@22`), as CI does. The classifier refuses Node 22 for subagents.

## Review Focus

1. **The in-game readings are the ground truth.** No Drop Rate reading is recorded yet.
   - Task 1 records them from the Player Info "Drop Rate" line, after a fresh game start.
   - The shiny-pet session cache (`scripts/dr-debug/README.md`) hits DR twice: through the shiny source (`shiny0`) and through LUK, which reads the shiny meal multi.
2. **Map rules:**
   - the Arcane map multiplier (`ArcaneType("ArcaneMapMulti_bon",0,0)`, @4195156);
   - the Cove on map 216, at its edges: cavern 17 against another cavern, and map 216 against any other map;
   - a dungeon map, which counts as outside under Ruling Y, so the `-1!=Dungon()` branch (@4194086, `DungeonStat("DropRarity")`) is unreached;
   - a town map and a no-monster map.

   Task 5 sweeps every map the DR V2 picker offers.
3. **The chip cap:** `chipBonuses("dr")` adds only while the running total is under 5, capped at 5 (the `add`/`below` group). Test the edges just under 5, at 5 and over 5.
4. **The lib/arkh V2 issues still open:** star sign 69 in the gold food, and the Cove reading (memory of PR #61). Where lib/arkh is wrong, the pair becomes a KNOWN entry with N.js evidence and a narrow proof. Don't copy lib/arkh.
5. **Observed Max:** the Compare and Biggest Gains reference (`topDropRateV2`) stays on lib/arkh, as for Damage, AFK and EXP. The methodology says so.

---

### Task 1: Drop Rate inventory, oracle and readings

**Files:**
- Create: `docs/superpowers/plans/2026-11-07-drop-rate-inventory.md`. Generate it with `cd web && npx tsx scripts/njs-closure.ts --mark TotalStats Drop_Rarity > ../docs/superpowers/plans/2026-11-07-drop-rate-inventory.md`.
- Modify: `__tests__/lib/game/inventory.test.ts` (add `DR: "../docs/superpowers/plans/2026-11-07-drop-rate-inventory.md"`).
- Modify: `__tests__/lib/game/support/arkhOracle.ts`. Add the DR helpers next to the EXP ones, with the same disk cache, as an optional `dr` section.
- Modify: `fixtures/readings.json`. The saves go in `scripts/updater/golden/.cache/readings/`.
- Test: `__tests__/lib/game/arkhOracle.test.ts`.

**Interfaces:**
- `arkhDrLeaves(save, ci, map): Record<sourceId, number>`: one value per `DR2_GROUPS` source id (`lib/arkh/stats/defs/drop-rate-v2.ts`).
- `arkhDropRate(save, ci, map): number`: lib/arkh's total (`computeArkhDropRateV2(...).total`).

- [ ] **Step 1:** Generate the inventory and register it in the guard. On 07/11 it held 270 `[x]`, 0 `[~]` and 30 open sub-case rows.
- [ ] **Step 2:** Write the failing tests:
  - recombining the groups from `arkhDrLeaves` through `applyGroupStep` (`lib/statTracker/groups.ts`) equals `computeArkhDropRateV2(...).total` to a relative 1e-9 on ARKHE ci 8, on map 251 and on map 216 with a character in cavern 17 (or a seeded `Holes[0]`);
  - the key set equals the `DR2_GROUPS` source ids.
- [ ] **Step 3–5:** FAIL → implement → pass.
- [ ] **Step 6 (controller and user, not a subagent):** record at least 2 Drop Rate readings.
  - The user reads the Player Info "Drop Rate" line after a fresh game start. The controller captures the save at the same moment (README §1, built-in browser).
  - Add each one with `stat: "dropRateV2"`, the page's `readingStat`.
  - Pick characters on a map with a monster, and not map 216.
- [ ] **Step 7:** Commit `test(game): DR inventory and lib/arkh oracle for the DR tree`.

### Task 2: Port the open Drop Rate rows

Use the same per-family steps as the EXP plan's Task 2:
- an oracle loop over every real save and character, against `arkhDrLeaves`, on map 251 unless the term depends on the map;
- a literal port;
- declare `PORTED`;
- regenerate the inventory;
- commit `feat(game): port <family> for DR`.

**Scope:** the open rows of the DR inventory, plus an oracle loop for EVERY DR source leaf. That includes the rows Damage, AFK and EXP already ported, because DR reads some of them with other args. The generated inventory is the authority. These were open on 07/11:
- `Summoning("TomeBonus",2,0)` and `("TomeBonus",7,0)`;
- `FarmingStuffs("CropSCbonus",7,0)`;
- `Holes`: `B_UPG` 46, `MeasurementBonusTOTAL` 15, `MeasurementBaseBonus`, `MeasurementMulti`, `MeasurementQTYfound`;
- `Holes2`: `Cglunko_DR`, `Cglunko_Bdig`, `Cglunko_Pdig`;
- `Thingies("FriendBonusStatz",3,0)`;
- `RoyalG("TotalStatz",0,0)`;
- `ResearchStuff`: `Grid_Bonus` (the dynamic row and 168 with e=2), `TotalObsLVs`, `TotalOccurrencesFound`, `OccurrencesToBeFound`;
- `WorkbenchStuff("OverkillQTY",0..6,0)`, depth 4;
- `Minehead`: `GlimboDRmulti`, `GlimboTotalTrades`;
- `DungeonStat("DropRarity")` and `DungeonCalc("TraitBonus",6)`. These sit behind `-1!=Dungon()`, so declare them `[~]` in `lib/game/unreached.ts` with Ruling Y as the reason, unless the N.js shows another path to them.

Resolve each open row: port it, or declare it unreached with N.js evidence.

- [ ] **Step 1–4:** Commit once per family as it passes, following the KNOWN rules.
- [ ] **Step 5:** Report the leaves checked (pairs, KNOWN, mismatches) and any new lib/arkh bug, with its N.js evidence.

### Task 3: TotalStats("Drop_Rarity") core and map rules

**Files:**
- Modify: `lib/game/njs/TotalStats.ts`. Add the `Drop_Rarity` sub-case and declare it in `PORTED`. Damage already ported the shared part (@4156192–@4174547) and STR/AGI/WIS/LUK.
- Test: `__tests__/lib/game/njs/dropRate.test.ts`, plus a synthetic `dropRateEdges.test.ts` that runs in CI.

**Behaviour:** read it in N.js @4190432; do not take it from this plan.
- The `DropRateLUK` curve and its `1E3>` branch. The `DNSM.DropRateLUK*` and `TotStatMAP` scratch stay locals, in N.js float order.
- Every step in N.js order: the Σ, the chip cap, the bundles, the Workbench, OLA[232], and each post-processing factor.
- The Arcane map multiplier of `ctx.map`.
- The Cove (@4196607): `216==CurrentMap && 17==Holes[0][charIdx]` replaces the total with `Holes2("Cglunko_DR",0,0)`.
- `Dungon()` already gives `-1` with an `assumed:` leaf (Ruling Y). Don't port the in-dungeon branch.

- [ ] **Step 1:** Write the failing tests:
  - the total equals lib/arkh's on every real save and character, on map 251, map 216, a town map (150), a dungeon map and a no-monster map, with KNOWN entries propagated by seeding their narrow causes (as `expMulti.test.ts` does);
  - synthetic edges: the chip cap under, at and over 5; the Cove with cavern 17 against another cavern, and on map 216 against another map; the `1E3>` LUK branch on both sides.
- [ ] **Step 2–4:** FAIL → implement → pass. The inventory reaches 0 open, or the rows that remain are `[~]` with reasons.
- [ ] **Step 5:** Commit `feat(game): port TotalStats Drop_Rarity for DR`.

### Task 4: Tracker adapter

**Files:**
- Create `lib/game/trackers/dropRate.ts` and register `TRACKERS.dropRateV2` (`(ctx) => TotalStats(ctx, "Drop_Rarity")`; the key is the `StatKey` the readings and verify-map use).
- Move the display config (`DR2_ROOT`, `DR2_GROUPS`, `DR2_VOTE_NAME`) to `lib/dropRateV2/layers.ts`. lib/arkh re-exports it (Ruling B), and `pageConfig.ts` imports from `layers.ts`.
- Add `lib/dropRateV2/layers.ts` to the oracle's `arkhSourceHash` file list.
- Follow `lib/game/trackers/expMulti.ts`. Use the shared `takeFrom`/`near` in `trackers/page.ts`.

**Produces:** `computeGameDropRate(save, charIdx, mapIdx): StatResult`.
- The tree has lib/arkh's shape and names.
- The total comes from the one `TotalStats("Drop_Rarity")` call.
- A recombination guard checks the tree against `groupedGainsModel(DR2_ROOT, DR2_GROUPS, { skip: [DR2_VOTE_NAME] })` (the page's Biggest Gains model) at a relative 1e-9.
- It uses the Ruling L trim and the per-envelope state.

- [ ] **Step 1:** Write the failing tests:
  - totals and names equal lib/arkh's over every save and character, on the Task 3 maps;
  - the readings show their game text (skip if none exist);
  - a committed per-map assertion that the tree is at most 2× lib/arkh's;
  - every note survives;
  - the page model's total equals the tree total, and the `refToggle` group path (`DR2_ROOT / arcane name`) still resolves.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Commit `feat(game): Drop Rate tracker on lib/game`.

### Task 5: Characterize and switch

- **Characterize:** run `characterize dropRateV2 --map <m>` on the Task 3 maps. Expect 0 unexplained, with every refusal explained.
- **verify-map:** run `verify-map dropRateV2` and document the result.
- **Performance:** measure warm and cold against lib/arkh with a committed `web/scripts/perf-dr.ts` that asserts the two engines give equal totals.
- **Map sweep:** a test runs `computeGameDropRate` over every map the DR V2 picker offers (skipIf, lazy) and expects no throw and a finite value. If a map can't have a value in the game, report it to the user; don't decide.
- **Switch:**
  - `DR2_PAGE.compute` goes through `withPageErrors` with a dynamic import of lib/game.
  - The readings dispatch for `dropRateV2` (in `KIT_PAGES`, `lib/readings/compute.ts`) follows it.
  - The Observed Max collector stays on lib/arkh. Add the methodology sentence the Damage, AFK and EXP pages have.
- **Finish:**
  - Run the full suite on Node 24, including `__tests__/updater` and `__tests__/lib/arkh`, plus `tsc`.
  - Commit `feat(drop-rate): the V2 page computes on lib/game`.
  - The controller runs the clean-worktree Node 22 suite, pushes, opens the PR and checks the Vercel preview.

---

Out of this plan:
- the V1 page (`/drop-rate`), which migrates in its own plan (user decision, 07/11);
- the Observed Max collectors on lib/game (Damage, AFK, EXP, DR);
- Coin and Multikill, in the order the user set on 05/11;
- the `/stats` explorer.
