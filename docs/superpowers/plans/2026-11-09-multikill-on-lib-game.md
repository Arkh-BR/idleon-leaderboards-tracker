# Multikill on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Multikill page (`/multikill`, the statTracker kit) computes on `lib/game`, ported from N.js `WorkbenchStuff("MultiKillTOTAL")` (raw `N.new.js` @7810403). The page switches once the spec's criteria pass.

**Architecture:** This repeats the Coin Multi migration (`docs/superpowers/plans/2026-11-08-coin-multi-on-lib-game.md`, merged in PR #77): inventory, oracle, port the open rows, the core plus map rules, adapter, characterize, switch. The earlier migrations already ported 684 of the 749 sub-cases Multikill reaches. Of the 65 open rows, about 45 are the masterclass forms and the dungeon branch, already proven unreached for Damage, so the real work is about 20 rows and the tracker. Multikill's tree is not grouped: it is ⌊B′ + T × P′⌋ with its own `multikillGainsModel`.

**Tech Stack:** TypeScript, Vitest, tsx scripts, `lib/game` (GameState, Ctx, block, runtime, assumed, attr/asNum, migrations), `lib/diagnose` (njsClosure, njsCalls, verifyMap, characterize).

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`. Read "Migração", "Critérios pra trocar um tracker", and Rulings A–YY. They all apply unchanged. The page's design is `docs/superpowers/specs/2026-09-24-multikill-page-design.md` (decisions M1–M19).

## Global Constraints

- **Every Global Constraint of the Coin plan applies verbatim, with the branch `feat/multikill-game`:**
  - N.js is the only truth.
  - One module per `_customBlock_`, with literal args. `@offset` comments cite the RAW `scripts/updater/.cache/N.new.js` (Ruling JJ).
  - `attr`/`asNum` use N.js names, and `asNum` goes at every `c.asNumber` site.
  - No silent zeros and no unstated stand-ins: only `runtime()`/`assumed()`, each one stated. That includes a stand-in for a per-session cache.
  - Real-save tests use `skipIf` and load lazily, never in a describe body. Seed-only edges run on a synthetic envelope.
  - KNOWN proofs use the narrowest seed or patch of the cause, never the leaf's own key (`OWN`), with seeded≠unseeded on both sides, exact per-reason counts and a drop-one check. A reason that doesn't move a total never counts as an explanation for it.
  - No runtime `@/lib/arkh` import from the trackers (`noArkhImports.test.ts`). The exceptions are `lib/game/data` and `lib/tome`.
  - The gate includes `__tests__/updater` and `__tests__/lib/arkh`, and the formula registry is regenerated.
  - Port only what Multikill reaches; a wider port needs a reason in the report.
  - A node the block did not call may not throw on the page where the game computes. Read it guarded and fall back to a noted leaf.
  - Never add files to `scripts/updater/golden/.cache/`, because every `.json` there joins GOLDEN_SAVES. Captures go in `golden/.cache/captures/`.
  - Copy is in English. Never `npm run dev`. Never commit to main. Stage only the files you touched, and never stage `docs/game-engine-coverage.md`.
  - The trailer is exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **What the Multikill page counts today (product decisions, kept):**
  - The "MULTIKILL: X%" line of the AFK Info panel: ⌊B′ + T × P′⌋ (M1, M2).
  - The map sets the Death Note page (⌊map/50⌋), the World 7 soft cap and ×5 tier ladder (map ≥ 300), the target's HP and the Crystal Glunko Cove (map 216 in cavern 17, which replaces both sums).
  - The target follows Rulings V/GG through `lib/game/afkTarget.ts`.
  - The tier row is named by its ladder (`MK_NODES.tier` or `MK_NODES.tierW7`), and the Observed Max is measured on map 251 (M7, M12).
  - "Active in AFK" is a status row and never enters the headline (M2).
- **Map picker:** maps whose AFK target has no monster definition (3, 33, 34, 35) can't compute, because N.js throws in `OverkillStuffs`. They leave the Multikill picker through `loadMonsterMapFilter` (`lib/statTracker/mapFilter.ts`), the same decision the user made for Damage and Coin. The sweep reports any other map that refuses.
- **Before opening the PR:** the controller runs the full suite once in a clean worktree with no private saves and no N.js cache, on Node 22 (`npx -y node@22`), as CI does. The classifier refuses Node 22 for subagents.

## Review Focus

1. **The in-game reading is the ground truth.** No Multikill reading is recorded yet. The user reads the AFK Info panel's "MULTIKILL" line after a fresh game start, which the game prints only for a FIGHTING target. The shiny-pet session cache (`scripts/dr-debug/README.md`) can hit the tier through Max Damage.
2. **The tier against lib/arkh.** The tier reads `DamageDealed("Max")`, and lib/game's Damage differs from lib/arkh's by proven causes. Below tier 51, those causes move the tier, so expect a larger KNOWN family on World 7 maps than Coin's two pairs. Each pair is proven by seeding lib/arkh's narrow Damage cause, never by waiving the tier.
3. **Map rules:**
   - the soft cap's brackets at maps ≥ 300 (20, 50, 100, 150, 200, 250), and the `e = 8675309` per-tier bypass, which only feeds the W7 notice;
   - the Cove on map 216, at its edges;
   - the Death Note world at the page edges (49/50, 299/300);
   - the Clamworks target (map 306), which is never cursed;
   - a town map and a dungeon map (Ruling Y).
4. **The page model reads the tier's children by name.** `multikillGainsModel` reads `Exponent`, `Next tier at` and `Max Damage`, and `pageConfig.ts` drops the rows under the tier and status nodes from the reference. The adapter must keep those names exactly.
5. **Observed Max:** the Compare and Biggest Gains reference (`topMultikill`) stays on lib/arkh, as for the other pages, measured on map 251. The methodology says so.

---

### Task 1: Multikill inventory and oracle

**Files:**
- Create: `docs/superpowers/plans/2026-11-09-multikill-inventory.md`. Generate it with `cd web && npx tsx scripts/njs-closure.ts --mark WorkbenchStuff MultiKillTOTAL > ../docs/superpowers/plans/2026-11-09-multikill-inventory.md`.
- Modify: `__tests__/lib/game/inventory.test.ts` (add `Multikill: "../docs/superpowers/plans/2026-11-09-multikill-inventory.md"`).
- Modify: `lib/game/unreached.ts`. Add the Multikill root to the rows that are unreached for the same reason as for Damage: the masterclass forms (`Grimoire_*`, `Compass_*`, `Arcane_*`, their `UpgTotal` and `ArcaneUpgBonus` rows) and the dungeon branch (`DungeonStat`, `DungeonCalc("TraitBonus")`, `TotalStats("Dung_Power")` if that is its path). Check each row against N.js. The mark applies only when every root that reaches the row is listed.
- Modify: `__tests__/lib/game/support/arkhOracle.ts`. Add the Multikill helpers next to the Coin ones, through `sectionCache`, as an optional `mk` section.
- Test: `__tests__/lib/game/arkhOracle.test.ts`.

**Interfaces:**
- `arkhMkLeaves(save, ci, map): Record<sourceId, number>`: one value per `MK_POOLS` source id (`lib/arkh/stats/defs/multikill.ts`), including `tier`, `softCap`, `cove` and `active`.
- `arkhMultikill(save, ci, map): number`: lib/arkh's total (`computeArkhMultikill(...).total`).

- [ ] **Step 1:** Generate the inventory, extend `unreached.ts`, and register the inventory in the guard. Regenerate every inventory the guard compares. Report the counts: 684 `[x]` and 65 open before the `unreached.ts` edit on 09/11.
- [ ] **Step 2:** Write the failing tests:
  - recombining the leaves through `mkTotal` equals `computeArkhMultikill(...).total` exactly on ARKHE ci 8, on maps 251 and 301;
  - the key set equals the `MK_POOLS` ids.
- [ ] **Step 3–5:** FAIL → implement → pass.
- [ ] **Step 6:** Commit `test(game): Multikill inventory and lib/arkh oracle for the Multikill tree`.

The in-game reading is the controller's and the user's (Ruling SS), before the merge.

### Task 2: Port the open Multikill rows

Use the same per-family steps as the Coin plan's Task 2:
- an oracle loop over every real save and character, against `arkhMkLeaves`, in `__tests__/lib/game/njs/mkTerms.test.ts`, on map 251 unless the term depends on the map;
- synthetic CI edges in `mkEdges.test.ts` for any branch no real save reaches, with hand-computed values;
- a literal port;
- declare `PORTED`;
- regenerate every inventory the guard compares;
- commit `feat(game): port <family> for Multikill`.

**Scope:** the open rows the Task 1 inventory still shows, plus an oracle loop for EVERY source leaf. These were open on 09/11 and aren't the forms or the dungeon:
- `ArbitraryCode("StatueOnyxOwned")`;
- `Holes2`: `Cglunko_MKbase`, `Cglunko_MKtier`;
- `GetBuffBonuses`: 46, 469, 45, 40;
- `WorkbenchStuff("OverkillQTY")`, `Summoning("TomeBonus",1,0)`, `RiftStuff("RiftSkillETC",2)`, `Thingies("FriendBonusStatz",2,0)`;
- `SkillStats("AllEfficiencies")` and the `B_UPG` rows it reaches (49 e=15, 50/79/98 e=1): first check whether Multikill's path can reach it, and declare it unreached with evidence if it can't.

`MultiKillTOTAL`, `MultiKill_base` and `MultiKill_perTier` are Task 3.

- [ ] **Step 1–4:** Commit once per family as it passes, following the KNOWN rules.
- [ ] **Step 5:** Report the leaves checked (pairs, nonzero pairs, KNOWN, mismatches) and any new lib/arkh bug with its N.js evidence.

### Task 3: MultiKillTOTAL core and map rules

**Files:**
- Modify: `lib/game/njs/WorkbenchStuff.ts`. Add `MultiKillTOTAL` (@7810403), `MultiKill_base` (@7808345) and `MultiKill_perTier` (@7805748), and declare them in `PORTED`.
- Modify: `lib/game/njs/RunCodeOfTypeXforThingY.ts` if `OverkillStuffs` "3" (the active status) isn't ported yet. The adapter needs it.
- Test: `__tests__/lib/game/njs/multikill.test.ts`, plus a synthetic `multikillEdges.test.ts` that runs in CI.

**Behaviour:** read it in N.js; do not take it from this plan.
- The 9 base terms and the 18 per-tier terms, in N.js order and float order.
- The soft cap inside each half and the Cove after it, from `ctx.map`.
- `e = 8675309` (the per-tier bypass that feeds the W7 notice): port it if the closure reaches it.

- [ ] **Step 1:** Write the failing tests:
  - the total equals lib/arkh's on every real save and character, on maps 251, 301, 306, 216, 14, 150 and 40, with KNOWN entries propagated through their narrow causes (as `coinMulti.test.ts` does, per-reason counts and drop-one included);
  - on map 33 every pair refuses with the literal `InvalidSaveValue` message;
  - a committed token-for-token test of each of the three sub-cases against the raw slice (the `MonsterCash` test in `coinMultiEdges.test.ts` is the model);
  - synthetic edges: every base and per-tier term in isolation at a distinct value; each soft-cap bracket just under and at its edge; the Cove (cavern 17 or another, map 216 or another); the Death Note world at 49/50 and 299/300; the tier at the ceiling.
- [ ] **Step 2–4:** FAIL → implement → pass. The inventory reaches 0 open, or the rows that remain are `[~]` with reasons.
- [ ] **Step 5:** Commit `feat(game): port MultiKillTOTAL for Multikill`.

### Task 4: Tracker adapter

**Files:**
- Create `lib/game/trackers/multikill.ts` and register `TRACKERS.multikill` (`(ctx) => WorkbenchStuff(ctx, "MultiKillTOTAL")`). The key is the readings `StatKey`.
- Add `"multikill"` to the hardcoded `TRACKERS` key list in `__tests__/lib/game/trackers/damage.test.ts`.
- Move the display config and the page's pure formula (`MK_ROOT`, `MK_NODES`, `MK_RULES`, `MK_POOLS`, `mkSoftCap`, `MkParts`, `mkHalves`, `mkTotal`) to `lib/multikill/layers.ts`. lib/arkh re-exports them (Ruling B), and `lib/multikill/pageConfig.ts` and `gains.ts` import from `layers.ts`.
- Add `lib/multikill/layers.ts` to the oracle's `arkhSourceHash` file list.
- Follow `lib/game/trackers/coinMulti.ts`, and use `optFrom` and `finishTree` from `trackers/page.ts` where they fit a non-grouped tree. Don't copy them.

**Produces:** `computeGameMultikill(save, charIdx, mapIdx): StatResult`.
- The tree has lib/arkh's shape and names, including the tier's children (`Max Damage`, `Target HP` with its curse rows or `Clamworks HP`, `Exponent`, `Tier reached at`, `Next tier at`), the rule rows and the `Active in AFK` node with its gates.
- The total comes from the one `MultiKillTOTAL` call.
- A guard checks the tree against `multikillGainsModel.totalFromFlat` exactly.
- It uses the Ruling L trim and the per-envelope state.
- If lib/arkh labels the tier an estimate (M17), the label goes, because lib/game's Max Damage is validated against the game. Say so in the report.
- Any lib/arkh note built from the save that the adapter can't reproduce from game data is listed in the report, so the controller can ask the user before the switch.

- [ ] **Step 1:** Write the failing tests:
  - totals, names and formats equal lib/arkh's over every save and character, on the Task 3 maps;
  - the readings show their game text (skip if none exist);
  - a committed per-map assertion that the tree is at most 2× lib/arkh's;
  - every flagged note survives;
  - the page model's total equals the tree total, and its levers still resolve (`Exponent`, `Next tier at`, `Max Damage`).
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Commit `feat(game): Multikill tracker on lib/game`.

### Task 5: Characterize and switch

- **Characterize:** run `characterize multikill --map <m>` on the Task 3 maps. Expect 0 unexplained, with every refusal explained.
- **verify-map:** run `verify-map multikill` once a reading exists, and document the result.
- **Performance:** measure warm and cold against lib/arkh with a committed `web/scripts/perf-multikill.ts` that asserts the two engines give equal totals.
- **Map sweep:** a test runs `computeGameMultikill` over every map the picker offers (skipIf, lazy) and expects no throw and a finite value. `MULTIKILL_PAGE` gets `loadMapFilter: loadMonsterMapFilter`, and the test pins that the filter drops exactly the maps with no monster target. If another map can't have a value in the game, report it to the user; don't decide.
- **Switch:**
  - `MULTIKILL_PAGE.compute` goes through `withPageErrors` with a dynamic import of lib/game.
  - The readings dispatch for `multikill` (in `KIT_PAGES`) follows it.
  - The Observed Max collector stays on lib/arkh. Add the methodology sentence the other pages have.
- **Spec:** add "Decisões da migração do Multikill" to `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md` with this migration's user decisions and rulings, continuing the letters from ZZ. The code may cite only rulings the spec defines.
- **Finish:**
  - Run the full suite on Node 24, including `__tests__/updater` and `__tests__/lib/arkh`, plus `tsc`.
  - Commit `feat(multikill): the page computes on lib/game`.
  - The controller runs the clean-worktree Node 22 suite, pushes, opens the PR and checks the Vercel preview.

---

Out of this plan:
- DR V1 (`/drop-rate`), which needs its own design first;
- the Observed Max collectors on lib/game (Damage, AFK, EXP, DR, Coin, Multikill);
- the `/stats` explorer.
