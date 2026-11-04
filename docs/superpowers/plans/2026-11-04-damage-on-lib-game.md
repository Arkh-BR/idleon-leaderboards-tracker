# Damage on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Damage tracker computes on `lib/game`, ported from N.js `DamageDealed("Max")` and the character stats it reads (STR/AGI/WIS/LUK, HP, MP, Accuracy). The page switches once the spec's criteria pass.

**Architecture:** This is the same method as the Artifact Find migration (`docs/superpowers/plans/2026-11-04-artifact-find-on-lib-game.md`, merged in PR #72): inventory, oracle, port families, adapter, characterize, switch. Every module, tool and convention from that plan is reused. The 35 ported `lib/game/njs/*` modules are extended, never duplicated. The character stats (`TotalStats` and friends) are the shared base that Coin Multi, EXP, AFK and Multikill will reuse.

**Tech Stack:** TypeScript, Vitest, tsx scripts, `lib/game` (GameState, Ctx, block, runtime, assumed, attr/asNum, migrations), `lib/diagnose` (njsClosure, njsCalls, verifyMap, characterize).

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`: "Migração", "Critérios pra trocar um tracker", and the section "Decisões da migração do Artifact Find (2026-11-04)". Its rulings A–P apply here unchanged.

## Global Constraints

- Every Global Constraint of the Artifact Find plan applies verbatim:
  - N.js is the only truth;
  - one module per `_customBlock_`, with literal args and `@offset` comments;
  - `attr`/`asNum` with N.js names, and `asNum` at every `c.asNumber` site;
  - no silent zeros: only `runtime()` and `assumed()`, each stated;
  - real-save tests use `skipIf` and load lazily (in `beforeAll` or inside the test, never in a describe body);
  - copy in English, never `npm run dev`;
  - branch `feat/damage-game`, never commit to main, stage only touched files;
  - the trailer is exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Rulings A–P (spec section) apply. Relevant here:
  - C: whoever needs a sub-case first ports it.
  - E: refuse a key only where the game itself would have no value; old saves go through `lib/game/migrations.ts`.
  - F: rows not reached are marked `[~]`.
  - H: keys with no load gate get the loader's empty value.
  - J: `assumed()` for runtime state that has a stated stand-in.
  - L: the page tree is at most 2× lib/arkh's.
- **What Damage counts today (product decisions on the page):**
  - Active buffs (talents 108/124), the masterclass forms (Wraith, Tempest, Tesseract) and the dungeon branch are not counted. In lib/game they are `runtime()` values with a note, never a silent 0.
  - Map 43 (the Royal Guardian arena) replaces Max, and map 306 (Clamworks) divides it. That is `ctx.map`.
- **Before opening the PR:** run the full suite once in a clean worktree with no private saves and no N.js cache, on Node 22 (`npx -y node@22`), the same way CI runs it. A test that reads a save or N.js in a describe body passes locally and breaks CI.

## Review Focus

1. **The in-game readings are ground truth.** 4 Damage readings, with HP/MP/STR/AGI/WIS/LUK/Accuracy extras, all from 2026-11-03.
   - Every value must match the game in its display format.
   - farkhe's Damage is `knownGaps: ["damage"]` (about 1.2e-6 under the game). If lib/game closes the gap, remove the entry.
2. **Map rules:** map 43 (the arena replaces Max), map 306 (divides it), and any other map (neutral).
3. **Per-character terms:** almost everything is per character here (class, talents, equipment, cards). Switching characters must recompute those terms while reusing the account-level ones.
4. **Soft caps and the Reliquarium exponent:** floats in N.js order. Totals must match lib/arkh to a relative 1e-9 (or be a KNOWN entry) and the game display.
5. **Runtime-only inputs** (buffs, forms, dungeon) show as `runtime()` leaves and never become a hidden 0.

---

### Task 0: Core tidy-up before the next tracker (deferred M5–M7)

**Files:**
- Modify: `lib/game/state.ts` and `lib/game/migrations.ts` (M5), `lib/game/njs/DNSM.ts` (M6), every `NotPorted` call site (M7).
- Modify: the spec section "Decisões…" (one line per convention).
- Test: the existing `__tests__/lib/game/*`.

**M5: refuse at build time.**
- `buildGameState` throws the migration refusal itself, instead of storing it and throwing on every `data` read.
- `GameState.data` becomes a plain frozen field again.

**M6: one DNSM convention.**
- A DNSM cache that BoatArtiMulti-like formulas read by key is a per-key `block("DNSM.<Name>")` that returns a number.
- A cache whose consumers are already per-id blocks may stay a plain function that returns a Map.
- Write the rule in DNSM.ts's header and in the spec.

**M7: one `NotPorted` sub format.** Use `"<Sub>"` for a named sub-case, `"<Sub>:<arg>=<value>"` for an argument outside the ported set, and `"<state>"` for a game-state condition (e.g. `"CurrentMap=41"`). Apply it across lib/game and update the tests that pin messages.

- [ ] **Step 1:** Write the failing tests: `buildGameState` throws on an unreplayable save (no half-valid state); the DNSM rule is documented; the `NotPorted` messages follow the format.
- [ ] **Step 2–4:** FAIL → implement → pass. The full lib/game suite and `tsc` stay green.
- [ ] **Step 5:** Commit `refactor(game): refuse at build, one DNSM and NotPorted convention`.

### Task 1: Inventory, with numeric dispatchers narrowed

**Files:**
- Modify: `lib/diagnose/njsCalls.ts`.
- Create: `docs/superpowers/plans/2026-11-04-damage-inventory.md` (generated).

**The tool change (`njsClosure`):**
- When a function dispatches on a number (`MainframeBonus(14)`, `ArcadeBonus(32)`, `AchieveStatus(235)`, `TalentCalc(643)`, `Companions(n)`…), slice with `njsNumericBranch`. Mark it whole body only when no branch exists.
- Keep the existing "whole body" rule for named sub-cases that have no slice.
- This is Task 1's deferred minor from the Artifact Find plan. The first Damage closure has 230 whole-body rows, so it is needed now.

**The inventory roots:** `DamageDealed("Max")` plus the stats the readings show: `TotalStats` "STR"/"AGI"/"WIS"/"LUK", `PlayerHPmax`, `PlayerMPmax`, and the accuracy block. Find each root and its args in N.js, and cite them.

- [ ] **Step 1:** Write the failing tests:
  - synthetic: a numeric dispatcher is sliced to its branch;
  - real file (skipIf, lazy): `MainframeBonus(14)` is no longer whole body, and the Damage closure has fewer whole-body rows than 230.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Generate the inventory. Mark the rows the 35 ported modules already cover as ported, rows unreachable for these args as `[~]` (Ruling F), and the rest `[ ]`. Report the counts.
- [ ] **Step 6:** Commit `feat(diagnose): njs-closure narrows numeric dispatchers; Damage inventory`.

### Task 2: Generic lib/arkh oracle

**Files:**
- Modify: `__tests__/lib/game/support/arkhOracle.ts` (add generic helpers; the Artifact Find ones keep working).
- Test: `__tests__/lib/game/arkhOracle.test.ts`.

**Interfaces it produces:**
- `arkhDamageLeaf(pathOrSave, ci, map, sourceId): number`: the `val` of the node for `sourceId` in lib/arkh's Damage tree. Walk the layered `DMG_LAYERS` descriptor (`lib/arkh/stats/defs/damage.ts`), cached per (path, ci, map).
- `arkhStat(pathOrSave, ci, stat: "str" | "agi" | "wis" | "luk" | "maxHp" | "maxMp" | "accuracy"): number`: what the readings extras compare against today, through lib/readings' compute dispatch or the lib/arkh function it calls.
- `KNOWN_ARKH_DIFFS` gains a `stat` field (default `"artifactFind"`) so that one list serves both trackers.

- [ ] **Step 1:** Write the failing tests:
  - the product and sum of the layer values rebuilds lib/arkh's Max (relative 1e-9), for every source id and layer on ARKHE ci 8 and map 251;
  - `arkhStat` equals the readings test's value on the 4 Damage readings.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Commit `test(game): lib/arkh oracle for the Damage tree and the stats`.

### Tasks 3–9: Port the inventory, family by family

Same steps as the Artifact Find plan's "Tasks 4–8" section:
- write the failing oracle loop over every real save and character (on map 251 unless the family is map-dependent);
- port literally;
- pass, and tick the inventory;
- commit.

Two additions to those steps:
- Where a family owns a stat that a reading shows (STR, AGI, WIS, LUK, HP, MP, Accuracy), its test also checks lib/game against the reading's game text, in the display format, for the 4 readings.
- Where lib/arkh and the game disagree, the game wins, with N.js evidence.

Each family also re-audits `migrations.ts`'s "Not ported" list for the keys it reads, and ports any load step that writes them. The list was scoped to Artifact Find.

### Task 3: Character stats
- **Functions:** `TotalStats` (the STR/AGI/WIS/LUK sub-cases and every one Damage reads), `PlayerHPmax`, `PlayerMPmax`, `PlayerSpeedBonus`, `ReturnClasses`, `Windwalker`, `ArcaneType`, `SkillStats`, plus the accuracy block.
- **Validation:** lib/arkh's stat values, and the readings.

### Task 4: Talents and buffs
- **Functions:** `GetTalentNumber`, `TalentCalc` (the numbers Damage reads), `getbonus2` (super talents in any preset, as on PR #56), `GetBuffBonuses`.
- **Active buffs:** talents 108/124 are `runtime()` with the note "active buff, not counted".

### Task 5: Equipment, cards, sets and food
- **Functions:** `EtcBonuses`, `CardBonusREAL`, `CardSetBonuses`, `GetSetBonus` (extend), `RunCodeOfTypeXforThingY` (CardLv), `FoodBonuses`, `TotalFoodBonuses`, `GoldFoodBonuses`, `MealBonus`.

### Task 6: Alchemy, stamps, statues, prayers, shrines, lab
- **Functions:** `StampBonusOfTypeX`, `prayersReal`, `Shrine`, `SaltLick`, `Labb`, `chipBonuses` (extend), `MainframeBonus` (the indexes Damage reads), `AtomCollider`, `Bubbastuff`, the bubbles and vials through the DNSM caches (Task 0's convention).

### Task 7: Account systems (mostly extending the ported modules)
- **Functions:** `Summoning`/`Summoning2`, `Holes`/`Holes2`, `ArcadeBonus`, `GetBribeBonus`, `FarmingStuffs`, `Spelunk`, `Divinity`, `WorkbenchStuff`, `RiftStuff`, `GamingStatType`, `Ninja`, `Thingies`, `Sailing`, `Breeding`, `Dreamstuff`, `Companions`/`CompLV2`, `AchieveStatus`, `Minehead`, `JellyOperation`, `SushiStuff`, `ResearchStuff`, `FlurboShop`, `GuildBonuses`, `MenagerieStuff`.
- **Mind the lib/arkh gap:** lib/arkh's missing `Companions(0)` gate lives in `common/stats.ts` and `divinity`. Expect KNOWN entries there.

### Task 8: Damage core and map rules
- **Functions:** `DamageDealed` (Max, plus the Mastery path for Min), `RoyalG` (map 43), `Log2`, `getLOG`, `ArbitraryCode`/`ArbitraryCode5Inputs` (the sub-cases reached), and the soft caps and Reliquarium exponent exactly as N.js has them.
- **Dungeons and forms:** `DungeonStat`, `DungeonCalc` and `Dungon` are reached only in dungeon maps. Where the page does not count them (product decision), they are `runtime()`. The masterclass forms are `runtime()`.

### Task 9: Tracker adapter
- **Files:**
  - create `lib/game/trackers/damage.ts`;
  - register `TRACKERS.damage`;
  - move `DMG_LAYERS`/`DMG_NODES`/`DMG_RULES`/`DMG_ROOT`/`DMG_RAT`/`DMG_KEYS` (display config) to `lib/damage/layers.ts`, with lib/arkh re-exporting them (Ruling B).
- **Produces:** `computeGameDamage(save, charIdx, mapIdx): StatResult`.
  - It uses the same tree shape as lib/arkh's layered descriptor.
  - The total comes from the one `DamageDealed("Max")` call.
  - Min = Max × Mastery, so the page's `headline` keeps working.
  - It has a recombination guard (`TreeTotalMismatch`), the Ruling L trim and a state cache per envelope.
- [ ] **Step 1:** Write the failing tests:
  - totals over every real save, character and the three map cases equal lib/arkh (or are KNOWN);
  - the tree names equal lib/arkh's;
  - the 4 Damage readings read their game text (farkhe included if the gap closed);
  - the size stays within 2×;
  - every `runtime:`/`assumed:` note survives in the tree.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Commit `feat(game): Damage tracker on lib/game`.

### Task 10: Characterize and switch
- **Characterize:** run `characterize damage` with the three map cases. The result must be 0 unexplained, with every refusal explained.
- **verify-map damage:** run it and document the result.
- **Performance:** measure it. The user's rule is "no perceptible slowdown": warm switch at parity, and a cold call once per save.
- **Switch:**
  - `DAMAGE_PAGE.compute` and the readings dispatch for `damage` (and its extras, if lib/game owns them now) use lib/game;
  - the Observed Max collector stays on lib/arkh;
  - keep the page's refusal wrapper.
- **Finish:**
  - full suite on Node 22, plus the clean-worktree CI check (Global Constraints);
  - `tsc`;
  - push;
  - Vercel preview;
  - commit `feat(damage): the page computes on lib/game`.

---

Out of this plan:
- Coin Multi, EXP, AFK and Multikill (next, on top of these stats);
- Observed Max collectors on lib/game;
- the lab connection walk;
- the `/stats` explorer.
