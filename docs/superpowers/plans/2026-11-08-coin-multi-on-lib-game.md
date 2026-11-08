# Coin Multi on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Coin Multi page (`/coin-multi`, the statTracker kit) computes on `lib/game`, ported from N.js `ArbitraryCode("MonsterCash")` (raw `N.new.js` @4047005). The page switches once the spec's criteria pass.

**Architecture:** This repeats the Drop Rate V2 migration (`docs/superpowers/plans/2026-11-07-drop-rate-on-lib-game.md`, merged in PR #76): inventory, oracle, port the open rows, the core plus map rules, adapter, characterize, switch. The earlier migrations already ported 291 of the 321 sub-cases Coin reaches. The work is the 30 open rows (`ArbitraryCode("MonsterCash")` included) and the tracker.

**Tech Stack:** TypeScript, Vitest, tsx scripts, `lib/game` (GameState, Ctx, block, runtime, assumed, attr/asNum, migrations), `lib/diagnose` (njsClosure, njsCalls, verifyMap, characterize).

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`. Read "Migração", "Critérios pra trocar um tracker", and Rulings A–RR. They all apply unchanged. The page's design is `docs/superpowers/specs/2026-09-23-coin-multi-page-design.md`.

## Global Constraints

- **Every Global Constraint of the Drop Rate plan applies verbatim, with the branch `feat/coin-game`:**
  - N.js is the only truth.
  - One module per `_customBlock_`, with literal args. `@offset` comments cite the RAW `scripts/updater/.cache/N.new.js` (Ruling JJ).
  - `attr`/`asNum` use N.js names, and `asNum` goes at every `c.asNumber` site.
  - No silent zeros and no unstated stand-ins: only `runtime()`/`assumed()`, each one stated. That includes a stand-in for a per-session cache.
  - Real-save tests use `skipIf` and load lazily, never in a describe body. Seed-only edges run on a synthetic envelope.
  - KNOWN proofs use the narrowest seed or patch of the cause, never the leaf's own key (`OWN`), with seeded≠unseeded on both sides and exact counts.
  - No runtime `@/lib/arkh` import from the trackers (`noArkhImports.test.ts`). The exceptions are `lib/game/data` and `lib/tome`.
  - The gate includes `__tests__/updater` and `__tests__/lib/arkh`, and the formula registry is regenerated.
  - Never add files to `scripts/updater/golden/.cache/`, because every `.json` there joins GOLDEN_SAVES. Captures go in `golden/.cache/captures/`.
  - Copy is in English. Never `npm run dev`. Never commit to main. Stage only the files you touched, and never stage `docs/game-engine-coverage.md`.
  - The trailer is exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **What the Coin Multi page counts today (product decisions, kept):**
  - The "Total Coin Bonus from all sources" line of Upgrade Vault → upgrade 2 "Monster Tax", for the logged-in character.
  - Two terms depend on the map: the guild term (`GuildBonuses(8)·(1+⌊CurrentMap/50⌋)`) and `TalentCalc(643)`, the multikill tier against the AFK target. N.js reads `CurrentMap`, so that is `ctx.map`.
  - The weekly vote is shown but not ranked (`COIN_VOTE_NAME`).
  - The groups, their order, names and kinds (`pct`, `raw`, `min4`) stay as `COIN_GROUPS` declares them.
- **Adapter rule (from the DR final review):** a node the block did not call may not throw on the page where the game computes. Read it guarded and fall back to a noted leaf.
- **Before opening the PR:** the controller runs the full suite once in a clean worktree with no private saves and no N.js cache, on Node 22 (`npx -y node@22`), as CI does. The classifier refuses Node 22 for subagents.

## Review Focus

1. **The in-game reading is the ground truth.** No Coin reading is recorded yet.
   - The user reads the Monster Tax line after a fresh game start. The display notates big values (`1e16` and over as `NotateNumber(x,"Big")`), so `lib/coinMulti/format.ts` decides how it compares.
   - The shiny-pet session cache (`scripts/dr-debug/README.md`) hits Coin through STR/AGI/WIS, which read the shiny meal multi.
2. **Talent 643 (Coins For Charon):** the tier is against the character's AFK target, with exponent 5 from map 300 on and a ceiling of 51. There is no fight-map check in N.js, and lib/arkh's `computeOverkillTier` forcing tier 1 off fight maps is wrong. Rulings V and GG decide whose target counts, through `lib/game/afkTarget.ts`. Test a town map, a no-monster map and a map ≥ 300.
3. **The guild term:** `⌊CurrentMap/50⌋` at the world edges (49/50, 299/300) and on maps past the last world.
4. **The Death Note padding:** the DR migration found that lib/game's load steps don't run the KillsLeft2Advance padding of `_customEvent_AddNewStuff` (@19916401), so HourZero's Death Note is refused. Coin's Gambit path may read it. If it does, port that load step in `lib/game/migrations.ts`, with the same re-audit as the other load steps; if it doesn't, say so with evidence.
5. **Observed Max:** the Compare and Biggest Gains reference (`topCoinMulti`) stays on lib/arkh, as for Damage, AFK, EXP and DR V2. It is measured on map 301. The methodology says so.

---

### Task 1: Coin inventory and oracle

**Files:**
- Create: `docs/superpowers/plans/2026-11-08-coin-multi-inventory.md`. Generate it with `cd web && npx tsx scripts/njs-closure.ts --mark ArbitraryCode MonsterCash > ../docs/superpowers/plans/2026-11-08-coin-multi-inventory.md`.
- Modify: `__tests__/lib/game/inventory.test.ts` (add `Coin: "../docs/superpowers/plans/2026-11-08-coin-multi-inventory.md"`).
- Modify: `__tests__/lib/game/support/arkhOracle.ts`. Add the Coin helpers next to the DR ones, with the same disk cache, as an optional `coin` section. Extract the WeakMap-plus-disk-slot pattern into one helper keyed by section instead of adding a fourth copy (deferred from the DR review), and give the shared entry type a neutral name.
- Test: `__tests__/lib/game/arkhOracle.test.ts`.

**Interfaces:**
- `arkhCoinLeaves(save, ci, map): Record<sourceId, number>`: one value per `COIN_GROUPS` source id (`lib/arkh/stats/defs/coin-multi.ts`).
- `arkhCoinMulti(save, ci, map): number`: lib/arkh's total (`computeArkhCoinMulti(...).total`).

- [ ] **Step 1:** Generate the inventory and register it in the guard. On 08/11 it held 291 `[x]`, 0 `[~]` and 30 open sub-case rows.
- [ ] **Step 2:** Write the failing tests:
  - recombining the groups from `arkhCoinLeaves` through `applyGroupStep` (`lib/statTracker/groups.ts`) equals `computeArkhCoinMulti(...).total` to a relative 1e-9 on ARKHE ci 8, on maps 251 and 301;
  - the key set equals the `COIN_GROUPS` source ids.
- [ ] **Step 3–5:** FAIL → implement → pass.
- [ ] **Step 6:** Commit `test(game): Coin inventory and lib/arkh oracle for the Coin tree`.

The in-game reading is the controller's and the user's (Ruling MM), before the merge.

### Task 2: Port the open Coin rows

Use the same per-family steps as the DR plan's Task 2:
- an oracle loop over every real save and character, against `arkhCoinLeaves`, in `__tests__/lib/game/njs/coinTerms.test.ts`, on map 301 unless the term depends on the map;
- a literal port;
- declare `PORTED`;
- regenerate every inventory the guard compares;
- commit `feat(game): port <family> for Coin`.

**Scope:** the open rows of the Coin inventory, plus an oracle loop for EVERY Coin source leaf. The generated inventory is the authority. These were open on 08/11:
- `Stuff2`: `CoinDropMulti`, `CardsCollected`;
- the `Holes` Gambit family (via `Holes2`): `GambitBonuses` 7, `GambitPts` (777, 99, 0–5), `GambitPtsREQ`, `GambitPTSmulti`, `StudyBolaiaBonuses` (13, 0), `JarCollectibleBonus` (23, 30), `B_UPG` (78 e=10, 50, 79, 98 e=1);
- `Sailing("ArtifactBonus",1,0)`;
- `Thingies("FriendBonusStatz",5,0)`;
- `MainframeBonus` 9 and 113;
- `FarmingStuffs("CropSCbonus",4,0)`;
- `TalentCalc` 643 and 644;
- `ArcaneType("ArcaneUpgBonus",47,0)`.

Port only what Coin reaches: a wider port needs a reason in the report. Resolve each open row: port it, or declare it unreached with N.js evidence.

- [ ] **Step 1–4:** Commit once per family as it passes, following the KNOWN rules.
- [ ] **Step 5:** Report the leaves checked (pairs, KNOWN, mismatches), any new lib/arkh bug with its N.js evidence, and the Death Note answer (Review Focus 4).

### Task 3: ArbitraryCode("MonsterCash") core and map rules

**Files:**
- Modify: `lib/game/njs/ArbitraryCode.ts`. Add the `MonsterCash` sub-case and declare it in `PORTED`.
- Test: `__tests__/lib/game/njs/coinMulti.test.ts`, plus a synthetic `coinMultiEdges.test.ts` that runs in CI.

**Behaviour:** read it in N.js @4047005; do not take it from this plan.
- The 22 multiplicative factors and the additive pool, in N.js order and float order.
- The Cash bubbles (`DNSM.AlchBubbles.CashSTR/AGI/WIS` against the floored stats).
- The `min4` companions and the `raw` factors as N.js writes them.
- The guild term on `ctx.map`, and `TalentCalc(643)` per Review Focus 2.

- [ ] **Step 1:** Write the failing tests:
  - the total equals lib/arkh's on every real save and character, on maps 301, 251, 150 (town), 33 (no monster) and 40 (dungeon, Ruling Y), with KNOWN entries propagated through their narrow causes (as `dropRate.test.ts` does), asserting the per-reason counts as well as the total;
  - synthetic edges: each group kind (a `min4` at 3.9, 4 and 4.1); the guild term at maps 49/50 and 299/300; `TalentCalc(643)` under and over map 300 and at the tier ceiling; every factor in isolation at a distinct value, so a swapped argument fails in CI.
- [ ] **Step 2–4:** FAIL → implement → pass. The inventory reaches 0 open, or the rows that remain are `[~]` with reasons.
- [ ] **Step 5:** Commit `feat(game): port MonsterCash for Coin`.

### Task 4: Tracker adapter

**Files:**
- Create `lib/game/trackers/coinMulti.ts` and register `TRACKERS.coinMulti` (`(ctx) => ArbitraryCode(ctx, "MonsterCash")`). The key is the readings `StatKey`.
- Add `"coinMulti"` to the hardcoded `TRACKERS` key list in `__tests__/lib/game/trackers/damage.test.ts`.
- Move the display config (`COIN_ROOT`, `COIN_GROUPS`, `COIN_VOTE_NAME`, `CoinGroup`, `CoinGroupKind`) to `lib/coinMulti/layers.ts`. lib/arkh re-exports it (Ruling B), and `pageConfig.ts` imports from `layers.ts`.
- Add `lib/coinMulti/layers.ts` to the oracle's `arkhSourceHash` file list.
- Follow `lib/game/trackers/dropRate.ts`. Use the shared helpers in `trackers/page.ts`, and move the repeated `o` closure there as `optFrom` rather than copying it a third time. Use `COIN_VOTE_NAME` for the vote's name, never a string copy.

**Produces:** `computeGameCoinMulti(save, charIdx, mapIdx): StatResult`.
- The tree has lib/arkh's shape and names.
- The total comes from the one `ArbitraryCode("MonsterCash")` call.
- A recombination guard checks the tree against `groupedGainsModel(COIN_ROOT, COIN_GROUPS, { skip: [COIN_VOTE_NAME] })` at a relative 1e-9.
- It uses the Ruling L trim and the per-envelope state.
- Any lib/arkh note built from the save that the adapter can't reproduce from game data is listed in the report, so the controller can ask the user before the switch.

- [ ] **Step 1:** Write the failing tests:
  - totals and names equal lib/arkh's over every save and character, on the Task 3 maps;
  - the readings show their game text (skip if none exist);
  - a committed per-map assertion that the tree is at most 2× lib/arkh's;
  - every flagged note survives;
  - the page model's total equals the tree total.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Commit `feat(game): Coin Multi tracker on lib/game`.

### Task 5: Characterize and switch

- **Characterize:** run `characterize coinMulti --map <m>` on the Task 3 maps. Expect 0 unexplained, with every refusal explained.
- **verify-map:** run `verify-map coinMulti` once a reading exists, and document the result.
- **Performance:** measure warm and cold against lib/arkh with a committed `web/scripts/perf-coin.ts` that asserts the two engines give equal totals.
- **Map sweep:** a test runs `computeGameCoinMulti` over every map the Coin picker offers (skipIf, lazy) and expects no throw and a finite value. If a map can't have a value in the game, report it to the user; don't decide.
- **Switch:**
  - `COIN_PAGE.compute` goes through `withPageErrors` with a dynamic import of lib/game.
  - The readings dispatch for `coinMulti` (in `KIT_PAGES`) follows it.
  - The Observed Max collector stays on lib/arkh. Add the methodology sentence the other pages have.
- **Spec:** add "Decisões da migração do Coin Multi" to `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md` with this migration's user decisions and rulings, continuing the letters from SS. The code may cite only rulings the spec defines.
- **Finish:**
  - Run the full suite on Node 24, including `__tests__/updater` and `__tests__/lib/arkh`, plus `tsc`.
  - Commit `feat(coin-multi): the page computes on lib/game`.
  - The controller runs the clean-worktree Node 22 suite, pushes, opens the PR and checks the Vercel preview.

---

Out of this plan:
- DR V1 (`/drop-rate`), which needs its own design first;
- Multikill, after this one;
- the Observed Max collectors on lib/game (Damage, AFK, EXP, DR, Coin);
- the `/stats` explorer.
