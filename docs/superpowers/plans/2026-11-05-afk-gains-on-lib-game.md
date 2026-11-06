# AFK Gains on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AFK Gains Rate tracker computes on `lib/game`, ported from N.js `AFKgainrates("Fighting")` (@4421667). The page switches once the spec's criteria pass.

**Architecture:** This uses the same method as the Damage migration (`docs/superpowers/plans/2026-11-04-damage-on-lib-game.md`, merged in PR #73): inventory, oracle, port what is still open, core plus map rules, adapter, characterize, then switch. Damage already ported most of what AFK reads (about 146 of 163 sub-cases), so this plan is short.

**Tech Stack:** TypeScript, Vitest, tsx scripts, `lib/game` (GameState, Ctx, block, runtime, assumed, attr/asNum, migrations), `lib/diagnose` (njsClosure, njsCalls, verifyMap, characterize).

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md`: "Migração", "Critérios pra trocar um tracker", the Artifact Find decisions (Rulings A–P) and the Damage decisions (Rulings Q–Z). They all apply unchanged.

## Global Constraints

- Every Global Constraint of the Damage plan applies verbatim, with the branch `feat/afk-game`. In short:
  - N.js is the only truth.
  - One module per `_customBlock_`, with literal args and `@offset` comments.
  - `attr`/`asNum` use N.js names, and `asNum` goes at every `c.asNumber` site.
  - No silent zeros: only `runtime()` and `assumed()`, each one stated.
  - Copy is in English. Never `npm run dev`. Never commit to main. Stage only touched files.
  - The commit trailer is exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Lessons from the Damage plan, now binding:**
  - **Real-save tests:** use `skipIf` and lazy loads. A describe body never reads a save or the N.js file: vitest runs skipped describe bodies, and CI has neither.
  - **Synthetic edge tests:** seed-only edge tests run on a synthetic envelope, so CI exercises them.
  - **KNOWN_ARKH_DIFFS proofs:**
    - Seed the narrowest cause, never the block key of the leaf under test (the `OWN` table assertion).
    - The seeded value must differ from the unseeded one.
    - The test asserts the exact KNOWN count.
    - Reuse the existing reasons (`STAT_WHY`). Don't re-prove them.
  - **Migrations re-audit:** every family re-audits the "Not ported" list in `lib/game/migrations.ts` for the keys it reads, walking the DoOnceREAL/CSver gates through the braces.
  - **Gate before each commit:** the full gate includes `__tests__/updater`. The formula registry goes stale when a `lib/game/njs` module is added, so regenerate it the way commit e2b6ef2 did.
- **What the AFK page counts today (product decisions, kept):**
  - Fighting AFK only (`"Fighting"`).
  - The Arcane map bonus is slot 2 (`ArcaneType("ArcaneMapMulti_bon",2,0)`).
  - On map 306 (Clamworks) the rate is ×0.2.
  - On map 216 (Crystal Glunko Cove, cavern 17) the Cove rate replaces everything.
  - A map whose AFK target is not a fight gives ×0.
  - The weekly vote is shown but not ranked in Biggest Gains.
  - Ruling V (the AFK target follows `ctx.map`) and Ruling Y (a dungeon map counts as outside a dungeon, under an `assumed:` note) apply.
- **Before opening the PR:** run the full suite once in a clean worktree with no private saves and no N.js cache, on Node 22 (`npx -y node@22`), as CI does. The controller runs this, because the classifier refuses Node 22 for subagents.

## Review Focus

1. **The in-game readings are ground truth, and AFK has none yet.** Task 1 records them. Every value must match the AFK Info panel's text (`⌊100·rate⌋%`). Mind the session-cache trap in `scripts/dr-debug/README.md` (shiny pets): take the reading right after a fresh game start.
2. **Map rules:**
   - map 306 (×0.2);
   - map 216 (the Cove replaces everything);
   - a map whose AFK target is not a fight (×0, never a throw);
   - a dungeon map (Ruling Y);
   - an ordinary fight map.

   Task 5's sweep runs every map the AFK picker offers.
3. **The prelude:** `AFKgainrates`' 29 calls before the `"Fighting"` dispatch (cards, guild, sigil, chips, prayers, Divinity, Vault, Arcane map multi, Etc92…). The inventory missed them until Task 0. They must all be in the tree, and each must be compared with its lib/arkh leaf.
4. **The weekly vote and other server-wide or live values** (`VotingBonusz` 6, event shop) come from the save's `serverVars`, as in Damage, and are never silent zeros.
5. **Observed Max:** the Compare and Biggest Gains reference stays on lib/arkh (as in Damage). The methodology says so.

---

### Task 0: njs-closure keeps the prelude; AFK inventory

**Files:**
- Modify: `lib/diagnose/njsCalls.ts` (`njsSlice`, or where `njsClosure` takes a named sub-case's slice).
- Test: `__tests__/lib/diagnose/njsCalls.test.ts`.
- Create: `docs/superpowers/plans/2026-11-05-afk-gains-inventory.md` (generated, `--mark`).
- Regenerate: `docs/superpowers/plans/2026-11-04-damage-inventory.md`, plus any other inventory a guard test compares.

**The bug, as the user reported it on 05/11 (decided: fix it after Damage merged):** a named sub-case's slice starts at its `if("<name>"==d)` and drops the code the game runs before the dispatch.
- `AFKgainrates`: 2213 chars and 29 calls before `if("Fighting"==d)`.
- `SkillStats`: 22 calls, as measured that day. Confirm its shape when you fix it.

**The fix:** the slice of a named sub-case is the function's prelude (everything before its first named dispatch) followed by the named block. When a function has no prelude, nothing changes.

- [ ] **Step 1:** Write the failing tests.
  - Synthetic: a function `function(d){x=F(1);if("A"==d)return G(x);if("B"==d)return H()}`. The slice of `"A"` holds `F(1)` and `G`, and not `H`.
  - Real file (skipIf, lazy): the closure of `AFKgainrates("Fighting")` holds `TalentEnh(79)`, `Divinity("Bonus_MAJOR")`, `ArcaneType("ArcaneMapMulti_bon",2,0)`, `EtcBonuses("92")` and `Summoning("VotingBonusz",6,0)`.
- [ ] **Step 2–4:** FAIL → implement → pass. Run `__tests__/lib/diagnose` and `__tests__/lib/game`.
- [ ] **Step 5:** Regenerate the Damage inventory with the command in its header.
  - Rows the fix adds that Damage's modules already cover stay `[x]`.
  - An added row that is open is a gap in a shipped tracker. Report it with its N.js slice. Don't port it in this task.
  - `inventory.test.ts` must pass.
- [ ] **Step 6:** Generate the AFK inventory: `--mark AFKgainrates Fighting`, with the command written in its header the same way. Report the counts: ported, `[~]` and open. The rough measure on 05/11 was 146 of 163 ported.
- [ ] **Step 7:** Commit `fix(diagnose): a named sub-case keeps the function's prelude; AFK inventory`.

### Task 1: AFK oracle and readings

**Files:**
- Modify: `__tests__/lib/game/support/arkhOracle.ts`. Add AFK helpers next to the Damage ones, with the same disk cache keyed by the save sha1 and a lib/arkh content hash.
- Modify: `fixtures/readings.json`. The saves go in `scripts/updater/golden/.cache/readings/`, which is gitignored.
- Test: `__tests__/lib/game/arkhOracle.test.ts`.

**Interfaces:**
- `arkhAfkLeaves(save, ci, map): Record<sourceId, number>`: lib/arkh's AFK tree (`lib/arkh/computeAfk.ts`, `lib/arkh/stats/defs/afk-gains.ts`), with one value per `AFK_POOLS` source id plus the arcane, etc92, clam, cove and type nodes.
- `arkhAfkRate(save, ci, map): number`: lib/arkh's total.

- [ ] **Step 1:** Write the failing tests. Rebuilding `afkRate()` from `arkhAfkLeaves` gives lib/arkh's total (relative 1e-9) on ARKHE ci 8, on map 251, 306 and 216.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5 (controller and user, not a subagent):** record at least 3 AFK readings.
  - The user reads the AFK GAINS RATE line of the in-game AFK Info panel for a character and map. Pick 3 characters of different classes, with one on map 306 or 216 if possible.
  - The controller captures the save at the same moment, following the capture section (§1) of `scripts/dr-debug/README.md` in the built-in browser.
  - Add each reading to `fixtures/readings.json` with `stat: "afkGains"`.
- [ ] **Step 6:** Commit `test(game): lib/arkh oracle for the AFK tree; AFK readings`.

### Task 2: Port the open AFK rows

Same per-family steps as the Damage plan's Tasks 3–7:
- the failing oracle loop over every real save and character, against `arkhAfkLeaves`, on map 251 unless the term is map-dependent;
- a literal port;
- pass, and declare `PORTED`;
- regenerate the inventory;
- commit `feat(game): port <family> for AFK`.

**Scope:** the open rows of the AFK inventory, plus an oracle loop for EVERY AFK leaf. Rows Damage already ported still get their AFK loop, because AFK reads them with other args. Expected from the N.js slice:
- `TalentEnh(79)`;
- `ArcaneType("ArcaneMapMulti_bon",2,0)`;
- `Divinity("Bonus_MAJOR")` and `Divinity("Bonus_Minor",-1,5)`;
- `Holes2("Cglunko_AFKgains",0,0)`;
- `FlurboShop(7)`;
- `Summoning("RooBonuses",5,0)`, `("EventShopOwned",5,0)` and `("VaultUpgBonus",23,0)`;
- `GoldFoodBonuses("AllAFK")`;
- `CardLv` for `w6d1` and `w6d3`;
- `chipBonuses("safk")` and `("fafk")`.

The generated inventory is the authority, not this list.

- [ ] **Step 1–4:** One commit per family as it passes, with the KNOWN rules from Global Constraints.
- [ ] **Step 5:** Report the leaves checked: pairs, KNOWN, mismatches, and any new lib/arkh bug with its N.js evidence.

### Task 3: AFKgainrates core and map rules

**Files:**
- Create: `lib/game/njs/AFKgainrates.ts`, holding the `"Fighting"` sub-case and its prelude. Every other sub-case throws `NotPorted`.
- Test: `__tests__/lib/game/njs/afkGains.test.ts`, plus a synthetic `afkGainsEdges.test.ts` that runs in CI.

**Behaviour (read it in N.js @4421667, don't take it from here):**
- `max(.01, v)`.
- The Cove replaces the rate on map 216 in cavern 17.
- ×0.2 on map 306.
- ×0 when the map's AFK target is not a fight. Use `lib/game/afkTarget.ts`, Ruling V.

All of these depend on `ctx.map`.

- [ ] **Step 1:** Write the failing tests.
  - The total equals lib/arkh's on every real save and character, on maps 251, 306, 216 and one non-fight map, with KNOWN entries propagated from the leaves by seeding their narrow causes (as `damage.test.ts` did).
  - Synthetic: each map rule at its edge, plus the .01 floor.
- [ ] **Step 2–4:** FAIL → implement → pass. Regenerate the inventory: it reaches 0 open, or the remaining rows are `[~]` with their reasons.
- [ ] **Step 5:** Commit `feat(game): port AFKgainrates for AFK`.

### Task 4: Tracker adapter

**Files:**
- Create `lib/game/trackers/afkGains.ts` and register `TRACKERS.afkGains`.
- Move the display config (`AFK_ROOT`, `AFK_NODES`, `AFK_VOTE_NAME`, `AFK_POOLS`, `afkRate`) to `lib/afkGains/layers.ts`, with lib/arkh re-exporting it (Ruling B).
- The model to follow is `lib/game/trackers/damage.ts`.

**Produces:** `computeGameAfkGains(save, charIdx, mapIdx): StatResult`.
- The tree has the same shape and names as lib/arkh's.
- The total comes from the one `AFKgainrates("Fighting")` call.
- A recombination guard checks that `afkRate()` over the tree equals the total (relative 1e-9).
- It uses the Ruling L trim and the per-envelope state cache (`trackers/page.ts`).

- [ ] **Step 1:** Write the failing tests:
  - totals and names equal lib/arkh's over every save and character, on the Task 3 maps;
  - the readings show their game text;
  - the tree is at most 2× lib/arkh's (a committed assertion);
  - every `runtime:`/`assumed:` note survives;
  - `damageGainsModel`'s AFK counterpart, `afkGainsModel.totalFromFlat`, equals the total on the lib/game tree.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5:** Commit `feat(game): AFK Gains tracker on lib/game`.

### Task 5: Characterize and switch

- **Characterize:** run `characterize afkGains` on maps 251, 306, 216 and a non-fight map. The result must be 0 unexplained, with every refusal explained.
- **verify-map:** run `verify-map afkGains` and document the result.
- **Performance:** measure warm and cold against lib/arkh. The user's rule is "no perceptible slowdown".
- **Map sweep:** a test runs `computeGameAfkGains` over every map the AFK picker offers, for one real save (skipIf), with no throw and a finite rate. If a map cannot have a value in the game, ask the user, as was done for Damage's maps 3/33/34/35.
- **Switch:**
  - `AFK_PAGE.compute` and the readings dispatch for `afkGains` use lib/game.
  - The Observed Max collector stays on lib/arkh. Add the methodology sentence the Damage page has.
  - Keep the page's refusal wrapper (`lib/statTracker/pageErrors.ts`).
- **Finish:**
  - Run the full suite on Node 24, including `__tests__/updater`, and `tsc`.
  - Commit `feat(afk-gains): the page computes on lib/game`.
  - The controller runs the clean-worktree Node 22 suite, pushes, opens the PR and checks the Vercel preview.

---

Out of this plan:
- the Observed Max collectors on lib/game (Damage and AFK);
- EXP, Drop Rate, Coin and Multikill, which come next in the order the user set on 05/11;
- AFK for skills other than Fighting;
- the `/stats` explorer.
