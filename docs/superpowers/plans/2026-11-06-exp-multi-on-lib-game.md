# EXP Multi on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The EXP Multi tracker computes on `lib/game`, ported from N.js `ExpMulti(0)` (`_customBlock_ExpMulti` @4260536). The page switches once the spec's criteria pass.

**Architecture:** This follows the AFK Gains migration (`docs/superpowers/plans/2026-11-05-afk-gains-on-lib-game.md`, merged in PR #74): inventory, oracle, port the open rows, core plus map rules, adapter, characterize, switch. Damage and AFK already ported 277 of the 295 sub-cases that EXP reaches, so the work is the 18 open rows, ExpMulti itself and the tracker.

**Tech Stack:** TypeScript, Vitest, tsx scripts, `lib/game` (GameState, Ctx, block, runtime, assumed, attr/asNum, migrations), `lib/diagnose` (njsClosure, njsCalls, verifyMap, characterize).

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`. Read "Migração", "Critérios pra trocar um tracker", and the Artifact Find (A–P), Damage (Q–Z) and AFK (AA–GG) decisions. They all apply unchanged. The EXP page design is `docs/superpowers/specs/2026-09-24-exp-multi-page-design.md`.

## Global Constraints

- **Every Global Constraint of the AFK plan applies verbatim, with the branch `feat/exp-game`:**
  - N.js is the only truth.
  - One module per `_customBlock_`, with literal args and `@offset` comments.
  - `attr`/`asNum` use N.js names, and `asNum` goes at every `c.asNumber` site.
  - No silent zeros: only `runtime()`/`assumed()`, each one stated.
  - Real-save tests use `skipIf` and load lazily, never in a describe body. Seed-only edges run on a synthetic envelope.
  - KNOWN proofs use the narrowest seed, never the leaf's own key (`OWN`), with seeded≠unseeded and exact counts.
  - Migrations are re-audited per family, walking the braces.
  - The gate includes `__tests__/updater` and `__tests__/lib/arkh`, and the formula registry is regenerated.
  - Never add files to `scripts/updater/golden/.cache/`: every `.json` there joins GOLDEN_SAVES. Captures go in `golden/.cache/captures/`.
  - Copy is in English. Never `npm run dev`. Never commit to main. Stage only touched files, and never stage `docs/game-engine-coverage.md`.
  - The trailer is exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **What the EXP page counts today (product decisions, kept):**
  - The "Class EXP" multiplier of the Player Info panel.
  - The map sets the Arcane map bonus and whether Shiny Medallions applies (the medallion of the map's monster).
  - The circumstantial sources (`EXP_CIRCUMSTANTIAL_SOURCE_NAMES`: those that apply only to the account's lowest-level character, and the like) keep their current page treatment.
  - The weekly vote is shown but not ranked.
  - Rulings V (the AFK target follows `ctx.map`), Y (a dungeon map counts as outside a dungeon) and GG (on the character's own map, the target is the saved one) apply. They decide which monster's medallion counts.
- **Before opening the PR:** the controller runs the full suite once in a clean worktree with no private saves and no N.js cache, on Node 22 (`npx -y node@22`), as CI does. The classifier refuses Node 22 for subagents.

## Review Focus

1. **The in-game readings are ground truth.** EXP has none yet.
   - Task 1 records them from the Player Info "Class EXP" line (format like `1327414553₸x`), after a fresh game start.
   - The shiny-pet session cache (`scripts/dr-debug/README.md`) hits EXP directly: the EXP pool has a shiny source, and LUK reads the shiny meal multi.
2. **Map rules:**
   - the Arcane map bonus (its slot, read from N.js);
   - Shiny Medallions, which uses the map's monster, so Rulings V and GG decide whose monster;
   - a no-monster map, where the medallion must be 0 and never throw;
   - a dungeon map (Ruling Y).

   Task 5 sweeps every map the EXP picker offers.
3. **LUK is the curve's input.** `TotalStats("LUK")` comes from the Damage migration, already validated against readings. ExpMulti writes `DNSM.ExpGainLUK` scratch keys: they stay locals, and their float order must follow N.js.
4. **`ExpMulti(999)` and the other ExpMulti branches** that `ExpMulti(0)` reaches: port each one the closure reaches, or prove it unreached.
5. **Observed Max:** the Compare and Biggest Gains reference stays on lib/arkh, as for Damage and AFK. The methodology says so.

---

### Task 0: njsPrelude stops at a negated dispatch; EXP inventory

**Files:**
- Modify: `lib/diagnose/njsCalls.ts` (`njsPrelude`).
- Test: `__tests__/lib/diagnose/njsCalls.test.ts`.
- Create: `docs/superpowers/plans/2026-11-06-exp-multi-inventory.md` (generated, `--mark ExpMulti 0`).
- Regenerate: the Damage and AFK inventories, because their guard compares them.

**The bug (deferred from the AFK final review):** `njsPrelude` keeps a negated dispatch block (`if("Fighting"!=d){…}`, at about body offset 409 of `AFKgainrates`) whose calls never run for the named sub-case. That block is the `!=` form of a `"X"==p` test on the dispatching param. As a result, verify-map lists 5 `[x]` calls as missing. A negated block on the param must leave the named sub-case's prelude.
- For a named sub-case X: drop a `"X"!=p` block.
- Keep a `"Y"!=p` block for another name Y, since it runs for X.

- [ ] **Step 1:** Write the failing tests.
  - Synthetic: `function(d){x=F();if("A"!=d){G()}if("A"==d)return H(x)}`. The slice of `"A"` holds F and H, and not G. The slice of `"B"` (`if("B"==d)`) holds F and G.
  - Real file (skipIf, lazy): the AFKgainrates("Fighting") slice no longer holds `TalentEnh(79)`, `CardBonusREAL(46)`, `GuildBonuses(7)`, `chipBonuses("safk")` or `EtcBonuses("24")`.
- [ ] **Step 2–4:** FAIL → implement → pass. Regenerate the AFK and Damage inventories. A row that leaves an inventory because it was over-reported must also leave `unreached.ts` if it was declared there (TalentEnh(79)). Keep `inventory.test.ts` and the orphan test green.
- [ ] **Step 5:** Generate the EXP inventory. Report the counts: 277 of 295 ported on 06/11, before this fix.
- [ ] **Step 6:** Commit `fix(diagnose): a negated dispatch leaves the prelude; EXP inventory`.

### Task 1: EXP oracle and readings

**Files:**
- Modify: `__tests__/lib/game/support/arkhOracle.ts`. Add EXP helpers next to the AFK and Damage ones, with the same disk cache, as an optional `exp` section.
- Modify: `fixtures/readings.json`. Saves go in `scripts/updater/golden/.cache/readings/`.
- Test: `__tests__/lib/game/arkhOracle.test.ts`.

**Interfaces:**
- `arkhExpLeaves(save, ci, map): Record<sourceId, number>`: one value per `EXP_GROUPS` source id (`lib/arkh/stats/defs/exp-multi.ts`, a grouped descriptor like Damage's).
- `arkhExpMulti(save, ci, map): number`: lib/arkh's total (`lib/arkh/computeExp.ts`).

- [ ] **Step 1:** Write the failing tests:
  - recombining the groups from `arkhExpLeaves` (mult and pct, `max1` for g04) equals `computeArkhExpMulti(...).total` to a relative 1e-9 on ARKHE ci 8, on map 251 and on a map with a medallion;
  - the key set equals the `EXP_GROUPS` ids.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5 (controller and user, not a subagent):** record at least 2 EXP readings.
  - The user reads the Player Info "Class EXP" line after a fresh game start. The controller captures the save at the same moment (README §1, built-in browser).
  - Add each one with `stat: "expMulti"`.
  - Pick characters whose map has a monster (for the medallion).
- [ ] **Step 6:** Commit `test(game): lib/arkh oracle for the EXP tree`.

### Task 2: Port the open EXP rows

Use the same per-family steps as the AFK plan's Task 2:
- an oracle loop over every real save and character, against `arkhExpLeaves`, on map 251 unless the term is map-dependent;
- a literal port;
- declare `PORTED`;
- regenerate the inventory;
- commit `feat(game): port <family> for EXP`.

**Scope:** the open rows of the EXP inventory, plus an oracle loop for EVERY EXP source leaf. That includes the rows Damage and AFK already ported, because EXP reads them with other args. These were open on 06/11, but the generated inventory is the authority:
- `GamingStatType("MSA_Bonus",4,0)`
- `Windwalker("TotalTitanKills",0,0)`
- `Holes("B_UPG",47,0)`
- `Breeding("PetArenaCrucBonus","0",15,0)`
- `MenagerieStuff("BoostQTY",23,0)`
- `Thingies` `DancingCoralBonus`, `CoralKidUpgBonus` (2) and `FriendBonusStatz` (1)
- `Spelunk("BigFishBonuses",4,0)`
- `WorkbenchStuff("AdditionExtraEXPnDR",0,0)`
- the `ResearchStuff` Grid_Bonus e=2 family and `Minehead("GlimboTotalTrades")`, which were `[~]` for Damage and AFK

Resolve each open row: port it, or declare it unreached with N.js evidence.

- [ ] **Step 1–4:** Commit once per family as it passes, following the KNOWN rules.
- [ ] **Step 5:** Report the leaves checked (pairs, KNOWN, mismatches) and any new lib/arkh bug, with its N.js evidence.

### Task 3: ExpMulti core and map rules

**Files:**
- Create: `lib/game/njs/ExpMulti.ts` (a numeric dispatcher; `0` plus every branch the closure reaches, such as `999`; everything else throws `NotPorted`).
- Test: `__tests__/lib/game/njs/expMulti.test.ts`, plus a synthetic `expMultiEdges.test.ts` that runs in CI.

**Behaviour:** read it in N.js @4260536; do not take it from this plan.
- The LUK curve, with the `DNSM.ExpGainLUK*` scratch kept as locals, in N.js float order.
- The groups as N.js multiplies and adds them.
- The Arcane map bonus slot.
- The Shiny Medallion of `ctx.map`'s monster, through `lib/game/afkTarget.ts` (Rulings V/GG). A map with no monster gives the game's value, never a throw.

- [ ] **Step 1:** Write the failing tests:
  - the total equals lib/arkh's on every real save and character, on map 251, a medallion map, a no-monster map, a town map (150) and a dungeon map, with KNOWN entries propagated by seeding their narrow causes (as `afkGains.test.ts` does);
  - pairs that differ only through Ruling V/GG (a kept target) are proven by forcing the map's default target, as `support/afkKept.ts` does, with exact counts;
  - synthetic edges: each map rule at its edge.
- [ ] **Step 2–4:** FAIL → implement → pass. The inventory reaches 0 open, or the remaining rows are `[~]` with reasons.
- [ ] **Step 5:** Commit `feat(game): port ExpMulti for EXP`.

### Task 4: Tracker adapter

**Files:**
- Create `lib/game/trackers/expMulti.ts` and register `TRACKERS.expMulti`.
- Move the display config (`EXP_ROOT`, `EXP_GROUPS`, `EXP_VOTE_NAME`, plus `EXP_CIRCUMSTANTIAL_SOURCE_NAMES` if it is display config) to `lib/expMulti/layers.ts`. lib/arkh re-exports it (Ruling B).
- The model to follow is `lib/game/trackers/afkGains.ts` and `damage.ts`. Use the shared `takeFrom`/`near` in `trackers/page.ts`.

**Produces:** `computeGameExpMulti(save, charIdx, mapIdx): StatResult`.
- The tree has lib/arkh's shape and names.
- The total comes from the one `ExpMulti(0)` call.
- A recombination guard checks the tree against `groupedGainsModel(EXP_GROUPS)` (the page's Biggest Gains model) at a relative 1e-9.
- It uses the Ruling L trim and the per-envelope state.

- [ ] **Step 1:** Write the failing tests:
  - totals and names equal lib/arkh's over every save and character, on the Task 3 maps;
  - the readings show their game text (skip if none exist);
  - a committed per-map assertion that the tree is at most 2× lib/arkh's;
  - every note survives;
  - the page model's total equals the tree total.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Commit `feat(game): EXP Multi tracker on lib/game`.

### Task 5: Characterize and switch

- **Characterize:** run `characterize expMulti --map <m>` on the Task 3 maps. Expect 0 unexplained, with every refusal explained. A kept-target waiver must be a proof (`support/afkKept.ts`), never a blanket one.
- **verify-map:** run `verify-map expMulti` and document the result.
- **Performance:** measure warm and cold against lib/arkh with a committed `web/scripts/perf-exp.ts` that asserts the two engines give equal totals.
- **Map sweep:** a test runs `computeGameExpMulti` over every map the EXP picker offers (skipIf, lazy) and expects no throw and a finite value. If a map can't have a value in the game, report it to the user; don't decide.
- **Switch:**
  - `EXP_PAGE.compute` goes through `withPageErrors` with a dynamic import of lib/game.
  - The readings dispatch for `expMulti` (in `KIT_PAGES`) follows it.
  - The Observed Max collector stays on lib/arkh. Add the methodology sentence the Damage and AFK pages have.
- **Finish:**
  - Run the full suite on Node 24, including `__tests__/updater` and `__tests__/lib/arkh`, plus `tsc`.
  - Commit `feat(exp-multi): the page computes on lib/game`.
  - The controller runs the clean-worktree Node 22 suite, pushes, opens the PR and checks the Vercel preview.

---

Out of this plan:
- the Observed Max collectors on lib/game (Damage, AFK, EXP), which is the next plan;
- Drop Rate, Coin and Multikill, in the order the user set on 05/11;
- EXP for skills other than Class EXP;
- the `/stats` explorer.
