# Artifact Find on `lib/game` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Artifact Find tracker computes on the new engine (`lib/game`), ported from N.js `Sailing("BoatArtiMulti", 0)`, and the page switches to it once the spec's switch criteria pass.

**Architecture:** One module per N.js function (`lib/game/njs/<Fn>.ts`), holding only the sub-cases Artifact Find reaches. Save reads go through the N.js attribute names, using a map generated from the game's own save loader. A tracker adapter (`lib/game/trackers/artifactFind.ts`) builds the page tree from the trace. `lib/arkh` is only a characterization oracle in tests and is never a source.

**Tech Stack:** TypeScript, Vitest, tsx scripts, the `lib/game` core (`GameState`, `Ctx`, `block`, `runtime`) and `lib/diagnose` (njsCalls, verifyMap) from PR #69.

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md` (sections "Arquitetura do motor", "Migração": order 1 = Artifact Find, "Critérios pra trocar um tracker").

## Global Constraints

- The live N.js (`web/scripts/updater/.cache/N.new.js`) is the only source of truth. `lib/arkh`, corgan and IdleonToolbox may be **read** to understand intent; never copy their code or structure.
- One module per N.js function: `lib/game/njs/<Fn>.ts` exports `export const <Fn> = block("<Fn>", (ctx, ...args) => …)`. The name equals the `_customBlock_<Fn>` suffix and the args mirror the N.js call literally, trailing literals included (`Summoning(ctx, "VaultUpgBonus", 63, 0)`). Sub-cases are a `switch` on the string, as in the game. Port only the sub-cases this plan reaches. Any other sub-case throws `NotPorted("<Fn>", sub)`.
- Save reads go through `attr`/`asNum` (Task 2) using the N.js attribute name (`"OptionsListAccount"`, not `"OptLacc"`).
- Game data comes only from `lib/game/data`. Constants are taken from N.js and cited with an `@<offset>` comment.
- No silent zeros:
  - a value the save cannot give goes through `runtime()`;
  - an absent index read through `asNum` is 0 only where N.js itself calls `c.asNumber` (it returns 0 for null), and it is visible in the trace;
  - any other missing read throws.
- Real-save tests use `describe.skipIf(!existsSync(...))`. Saves stay out of git.
- Site copy is in English. Never run `npm run dev`. Verify with `npx tsc --noEmit -p .` and `npx vitest run`.
- Branch `feat/artifact-find-game`. `git fetch` first. Never commit to main. Stage only touched files.
- Commit messages are in English and end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Accounts without Sailing progress:** an absent `Boats`, `Captains`, `Sailing[3]` or `Spelunk[6]`. Expect the same total `lib/arkh` gives, or a named error only where the game itself would crash. Never `NaN`. Covered by Task 10's characterization across all saves (throws are counted).
2. **Switching character:** only the per-character terms may change (Artifact 3's Sailing-level part, `DNSM.StarSigns["61"]`). Task 9 test.
3. **The weekly vote:** vote 20 active (× VotingBonuszMulti) against inactive (0). Task 6 synthetic test.
4. **Tier-6 captains:** `NONdummies[60]` is session-only. Per the user decision of 2026-11-03 it is counted, `25 × min(30, n)`. Task 4 test with 31 captains gives 750.
5. **Float order:** the product runs in N.js order, so totals match `lib/arkh` to a relative 1e-9 and the game's display. Task 9 and Task 10.

---

### Task 1: Port inventory (exact transitive closure)

**Files:**
- Modify: `lib/diagnose/njsCalls.ts` (each `Call` also carries `args?: (string | number)[]`, the literal args up to the first non-literal)
- Create: `scripts/njs-closure.ts`, `docs/superpowers/plans/2026-11-04-artifact-find-inventory.md` (generated, committed)
- Test: `__tests__/lib/diagnose/njsClosure.test.ts`

**Interfaces:**
- Produces:
  - `njsClosure(norm: string, fn: string, args: (string | number)[]): { calls: { fn: string; args: (string | number)[]; depth: number }[]; attrs: string[]; dnsm: string[] }`. It is a transitive walk over the exact sub-case slices, using `njsSlice` with the full args.
    - `attrs` lists the `getGameAttribute("X")` names read.
    - `dnsm` lists the `DNSM.h.<Name>` keys read.
  - CLI: `njs-closure <Fn> [args…]` prints the inventory as a markdown checklist, grouped by function.

- [ ] **Step 1: Failing tests.**
  - On a synthetic bundle, the closure follows one level of a named sub-case and stops at non-literal args.
  - Real file (skipIf): the closure of `Sailing("BoatArtiMulti", 0)` contains `Sailing("ArtifactBonus",3,0)`, `Summoning("VaultUpgBonus",63,0)` and `Summoning("VotingBonusz",20,0)`.
  - `attrs` contains `Captains` and `Boats`, and `dnsm` contains `StarSigns` and `AlchVials`.
- [ ] **Step 2–4:** FAIL → implement → pass, plus `tsc`.
- [ ] **Step 5:** Generate the inventory for `Sailing BoatArtiMulti 0`.
- [ ] **Step 6: Commit** `feat(diagnose): njs-closure lists what a formula reaches`.

The inventory is the checklist for Tasks 4–8: every row must be ported or explicitly marked `runtime()`.

### Task 2: Save attributes by their N.js names

**Files:**
- Create: `scripts/updater/gen-save-attrs.ts`, `lib/game/data/saveAttrs.gen.ts` (generated, committed), `lib/game/attr.ts`
- Modify: `lib/game/errors.ts` (add `UnknownAttribute`, `NotPorted`), `lib/diagnose/njsCalls.ts` (`traceCalls` also skips `absent:` nodes)
- Test: `__tests__/lib/game/attr.test.ts`, `__tests__/updater/gen-save-attrs.test.ts`

**Interfaces:**
- Consumes: `GameState.get`, `num`/`opt`, `charKey` (`lib/game/state.ts`); `traceNode` (`lib/game/trace.ts`).
- Produces:
  - `SAVE_ATTRS: Readonly<Record<string, { key: string; perPlayer: boolean }>>`: the attribute name maps to its save key, extracted from the N.js cloud-load code. The loader uses `getLoadList`, `getLoadMap`, `getLoadString`, `getLoadJsonList` and `getLoadSparseList`, with a literal key or `"<Key>_" + player`.
  - `attr(ctx: Ctx, name: string, ...idx: (string | number)[]): unknown`
    - per-player keys read `charKey(key, ctx.player)`;
    - throws `UnknownAttribute(name)` when the name isn't in `SAVE_ATTRS`, and `MissingSaveKey` when the save lacks the key;
    - returns `undefined` for an absent index.
  - `asNum(ctx: Ctx, name: string, ...idx: (string | number)[]): number` is N.js `c.asNumber(getGameAttribute(name)[…])`. It follows N.js @1688426: null gives 0, a number stays itself, a boolean gives 1 or 0, and a string goes through `parseFloat`. When it returns 0 for null while tracing, it pushes a leaf `{ block: "(absent)", args: [address], value: 0, note: "absent: asNumber(null) = 0" }`.
  - `asNumber(v: unknown): number`: the same conversion, for values already in hand.

- [ ] **Step 1: Failing tests.**
  - `SAVE_ATTRS.OptionsListAccount` is `{ key: "OptLacc", perPlayer: false }`, and a per-player attribute loaded as `"CardEquip_" + …` has `perPlayer: true`.
  - On the golden ARKHE save (`scripts/updater/golden/.cache/arkhe-live-2026-11-03-markhe-weapon.json`, skipIf), every attribute in `ARTIFACT_ATTRS` resolves without throwing. `ARTIFACT_ATTRS` is exported by the test and fixed at: Boats, Captains, Sailing, OptionsListAccount, Spelunk, plus every `attrs` entry of Task 1's inventory.
  - `asNum` on an absent index gives 0 and, when tracing, an `(absent)` leaf.
  - `attr` on a name outside the map throws `UnknownAttribute`.
  - `asNumber("1.5")` is 1.5, and `asNumber(true)` is 1.
  - `traceCalls` ignores `(absent)` nodes.
- [ ] **Step 2–4:** FAIL → implement (generator plus its run, then `attr.ts`) → pass, plus `tsc`.
- [ ] **Step 5: Commit** `feat(game): save attributes by their N.js names`.

### Task 3: Oracle helper for port tests

**Files:**
- Create: `__tests__/lib/game/support/arkhOracle.ts`
- Test: `__tests__/lib/game/arkhOracle.test.ts`

**Interfaces:**
- Produces:
  - `GOLDEN_SAVES: string[]`: the paths in `scripts/updater/golden/.cache/*.json` and `scripts/updater/.cache/saves-fresh/*.json` that exist.
  - `arkhArtifactLeaf(save: unknown, ci: number, sourceId: string): number`. It returns the `val` of the node for `sourceId` in `lib/arkh`'s Artifact Find tree: the group in `ARTI_GROUPS`, then the index of the source in that group's `sources`.
  - `gameCtx(save: unknown, ci: number, trace?: boolean): Ctx` = `makeCtx(buildGameState(save), { player: ci, map: 0, trace })`.
  - `KNOWN_ARKH_DIFFS: { save: string; ci?: number; source: string; why: string }[]`: starts empty. Tasks 4–10 add the differences where N.js proves `lib/arkh` wrong, each with its `@offset` evidence.

- [ ] **Step 1: Failing test:** on one golden save, `arkhArtifactLeaf(save, 8, "vault63")` equals the value read straight from `computeArkhArtifactFind`'s tree.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5: Commit** `test(game): lib/arkh as the Artifact Find characterization oracle`.

### Tasks 4–8: Port the inventory, family by family

All five tasks follow the same steps, and each owns the inventory rows of its functions:

- **Step 1: Failing test.** For each source id the task owns, over every save in `GOLDEN_SAVES` and every character, the `lib/game` term equals `arkhArtifactLeaf(save, ci, id)`, using `toBeCloseTo` with a relative 1e-9. The term is the expression exactly as `BoatArtiMulti` uses it: before `/100` for a `pct` group, the whole factor for a `mult` group. Add one synthetic test per edge listed in the task.
- **Step 2:** Run it and see it fail.
- **Step 3:** Port each sub-case from N.js, citing the `@offset`. Sub-cases called through other sub-cases are ported in the task that owns their function, even when only reached indirectly.
- **Step 4:** Pass, plus `tsc`. Tick the inventory rows.
- **Step 5:** Commit `feat(game): port <family> for Artifact Find`.

A difference against the oracle is not automatically our bug. If N.js says `lib/arkh` is wrong, keep the N.js value. Add the case to `KNOWN_ARKH_DIFFS` in the test with the N.js evidence, and report it as DONE_WITH_CONCERNS.

### Task 4: Sailing
- **Functions:** `njs/Sailing.ts` with sub-cases `ArtifactBonus` (index 3, plus what the inventory reaches), `DaveyJonesBonus`, `SlabboBonus_AllMulti`, and `BoatArtiMulti`, which is left for Task 9. Also `njs/CaptBonusCalc.ts` and `njs/ReturnClasses.ts`, if the inventory reaches them.
- **Sources:** `artifact3`, `captain`, `captains6`, `davey`.
- **Ruling:** `NONdummies[60]` is not in the save, so it gets `lib/game/njs/NONdummies.ts` → `NONdummies60(ctx)`. That function replays the map-200 load code (@10634243): the count of `Captains[g][0] == 6` over the first `min(30, Captains.length)`. User decision of 2026-11-03.
- **Edges:** 31 type-6 captains give 25 × 30 = 750; no captains gives 0.

### Task 5: Pets and companions
- **Functions:** `Breeding` (`ShinyBonusS` and its deps), `Companions` (154, 43, 56, plus any the inventory reaches), `CompLV2`, `MenagerieStuff` (`NightmarinerBon`, `NightmarinerTotLV`, `UnlockOwned`).
- **Sources:** `shiny21`, `comp154`, `comp43`, `comp56`, `nightmariner`.
- **Edges:** a companion not owned gives 0, so its factor is 1.

### Task 6: Events, shops and votes
- **Functions:** `RandomEvent` (`FractalIslandBonus`, `KillroyBonuses`), `GetBribeBonus`, `Stuff2` (`PurpleChestSlugsOwned`), and `Summoning` (`VaultUpgBonus` 63, `WinBonus` 3, `VotingBonusz` 20, `VotingBonuszMulti`, `EventShopOwned`, `GrimoireUpgBonus`, plus the inventory's deps).
- **Sources:** `fractal3`, `bribe34`, `killroy`, `slugs`, `vault63`, `win3`, `vote20`.
- **Edges:** a synthetic save with vote 20 active gives base × multi, and with another vote active it gives 0.

### Task 7: Account upgrades
- **Functions:** `ArcadeBonus` (32, 66), `Holes` (`B_UPG` 55, `MonumentROGbonuses` 1 2, `CosmoBonusQTY`, plus deps), `FarmingStuffs` (`StickerBonus` 2 99 / 2 100, `ExoticBonusQTY` 45), `ResearchStuff` (`Grid_Bonus` 109, 106).
- **Sources:** `arcade32`, `arcade66`, `bUpg55`, `sticker2add`, `sticker2mult`, `grid109`, `grid106`, `monument1_2`, `exotic45`.
- **Edges:** Sticker 2 sits in one slot only, 99 or 100 depending on Menagerie unlock 22, never both.

### Task 8: W7 systems and the DNSM caches
- **Functions:** `Minehead` (`Button_Bonuses` 3, plus deps), `SushiStuff` (`RoG_BonusQTY` 7, `UniqueSushi`), `JellyOperation` (`RoG_BonusQTY` 19), `MainframeBonus` (14), `Thingies` (`LoreEpiBon` 3, plus deps), `Ninja` (`PristineBon` 2), `GamingStatType` (`PaletteBonus` 5, `SuperBitType` 26).
- **Sources:** `button3`, `sushi7`, `jelly19`, `mainframe14`, `loreEpi3`, `pristine2`, `palette5`, `spelunkBit26`, `starSign61`, `vialTurtle`.
- **Ruling:** the game fills `DNSM` in code outside the `_customBlock_` functions. Find its writer in N.js and cite the offset. Then port each read key as `lib/game/njs/DNSM.ts` → `DNSM_StarSigns(ctx, "61")` (per character) and `DNSM_AlchVials(ctx, "6turtle")`, each a `block` named `DNSM.StarSigns` / `DNSM.AlchVials`. These are not `_customBlock_` names, so `njsTextOf` marks them "unchecked". That is accepted, and the row says so.
- **Edges:** star sign 61 not equipped gives 0 for that character only.

### Task 9: `BoatArtiMulti` and the tracker adapter

**Files:**
- Modify: `lib/game/njs/Sailing.ts` (the `BoatArtiMulti` sub-case: the exact N.js expression, factors in N.js order), `lib/game/trackers/index.ts` (register `artifactFind`)
- Create: `lib/artifactFind/groups.ts` (moved from `lib/arkh/stats/defs/artifact-find.ts`: `ARTI_GROUPS`, `ARTI_ROOT`, `ARTI_VOTE_NAME`, which are display config; the `lib/arkh` def re-imports them), `lib/game/trackers/artifactFind.ts`
- Test: `__tests__/lib/game/trackers/artifactFind.test.ts`

**Interfaces:**
- Produces:
  - `computeGameArtifactFind(save: unknown, charIdx: number): StatResult`, with the same `{ tree, total }` as `computeArkhArtifactFind`. The tree's group/source names, order and `kind`s equal `ARTI_GROUPS`. Each source node also carries its N.js trace as children.
  - `TRACKERS.artifactFind = (ctx) => Sailing(ctx, "BoatArtiMulti", 0, 0)`.

- [ ] **Step 1: Failing tests.**
  - Over `GOLDEN_SAVES`, every character's total equals `computeArkhArtifactFind`'s to a relative 1e-9, apart from the rows in `KNOWN_ARKH_DIFFS`.
  - The tree's group and source names equal `lib/arkh`'s.
  - Switching character on one save changes only `artifact3` and `starSign61` (Review Focus 2).
  - The 2026-11-01 save reads `formatArtifactFind(total) === "167Q"`.
- [ ] **Step 2–4:** FAIL → implement → pass, plus `tsc`.
- [ ] **Step 5: Commit** `feat(game): Artifact Find tracker on lib/game`.

### Task 10: Characterize, seed the reading, switch

**Files:**
- Create: `scripts/characterize.ts`, `lib/diagnose/characterize.ts`
- Modify: `lib/artifactFind/pageConfig.ts` (`compute` → `computeGameArtifactFind`), `lib/readings/compute.ts` (artifactFind dispatches with map 0), `fixtures/readings.json` (+ the reading)
- Test: `__tests__/lib/diagnose/characterize.test.ts`

**Interfaces:**
- Produces: `characterize(saves: string[], a: (s, ci) => StatResult, b: (s, ci) => StatResult): { save: string; ci: number; a?: number; b?: number; rel?: number; error?: string }[]`, with only the rows that differ by more than a relative 1e-9 or that throw. It also returns the total time of each engine over all saves (spec risk "Desempenho": if `lib/game` is slower than `lib/arkh`, the switch is blocked). CLI: `characterize artifactFind` writes `reports/characterize-artifactFind.md`.

- [ ] **Step 1: Failing test:** synthetic: two engines that differ on one save give exactly one row, and a throwing engine gives an `error` row.
- [ ] **Step 2–4:** FAIL → implement → pass.
- [ ] **Step 5: Run the switch criteria (spec "Critérios pra trocar um tracker"):**
  - `characterize artifactFind` over all saves: every row is in `KNOWN_ARKH_DIFFS` with its N.js evidence, or it gets fixed;
  - zero `error` rows that `lib/arkh` doesn't also have;
  - `verify-map artifactFind`: 0 not ported; unchecked only for the DNSM rows from Task 8.
- [ ] **Step 6: Seed the reading.** Copy the 2026-11-01 save into `READINGS_DIR` and add `{ stat: "artifactFind", charName: "Markhe", game: "167Q", map: 0 }`. The readings test passes.
- [ ] **Step 7: Switch** the page and the readings dispatch to `computeGameArtifactFind`. The Observed Max collector (`scripts/update-top-artifact.ts`) stays on `lib/arkh` pools in this plan.
- [ ] **Step 8:** Full suite, `tsc`, push `feat/artifact-find-game`; the Vercel preview's `/artifact-find` renders the same total as before for a loaded save.
- [ ] **Step 9: Commit** `feat(artifact-find): the page computes on lib/game`.

---

Out of this plan: the Observed Max collector and Biggest Gains pools on `lib/game` (spec step 12, "Demais usos"), the `/stats` explorer (parked by the user on 2026-11-04), and the next tracker (Coin Multi).
