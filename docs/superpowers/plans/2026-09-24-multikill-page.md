# Multikill Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/multikill` "Multikill Tracker": the character's AFK Multikill (N.js `WorkbenchStuff("MultiKillTOTAL")`, the `MULTIKILL: X%` line of the in-game AFK Info panel; Markhe on map 14 = **81706%**) term by term, with snapshots, Compare vs Observed Max and Biggest Gains (plus a "+1 damage tier" lever), on the statTracker kit and the AFK Gains plan's fidelity helpers.

**Architecture:** Engine: a shared damage-tier helper (`systems/common/overkill.ts`: the `OverkillStuffs` loop moved out of `coin.ts`, the AFK target's live HP with the prayer curses and Clamworks' `Clamz_HP`, the activation flag), which Coin's talent 643 also switches to in its own commit (spec M5); a custom descriptor (`defs/multikill.ts`: pools `base`/`perTier`/`tier`/`rules`/`status`, the pure `mkTotal` = ⌊B′ + T × P′⌋ with the W7 soft cap and the Crystal Glunko Cove override as rule rows, the root in %) and a `multikill` system (`systems/multikill/multikill.ts`, one case per N.js term) behind `computeMultikill.ts`. New ports sit next to their siblings: per-world Death Note pages and Measurement 9 (`coin/gambit.ts`), a generic Salt Lick (EXP's port), `getBuffBonuses` (`common/buffs.ts`), two star-sign keys. Kit: two optional hooks (`GainsModel.levers?`, `StatPageConfig.totalTitle?`). Page: the game's format, a what-if `GainsModel` over `mkTotal` with the "+1 damage tier" lever, an Observed Max collector on map 251 with a cron step, and the route, nav item and home card.

**Tech Stack:** Next.js 16 (app router), React, TypeScript, Tailwind, Vitest 2 + happy-dom + Testing Library, Playwright e2e (CI only), tsx scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-multikill-page-design.md` (pt-BR; decisions M1–M19 are binding).

**Base:** branch `feat/multikill-page`, created from the tip of `feat/afk-gains-page`, which is stacked on `feat/exp-multi-page`. **Both base plans must be present and fully executed:** the EXP plan (`docs/superpowers/plans/2026-09-24-exp-multi-page.md`, Tasks 1–10: the kit `lib/statTracker/*`, `components/statTracker/*`, `scripts/_shared/topStatCollector.ts`, `deriveGatedTalentsFor`, EXP's Salt Lick port) and the AFK plan (`docs/superpowers/plans/2026-09-24-afk-gains-page.md`, Tasks 1–8: the kit's `unit` option, the root `note` from `combine`, the leading-`_` registry regex, `prayersReal` with the super-bit branch, per-character `chipBonuses`, `STAR_SIGN_TERMS` / `starSignBonusReal`, `flurboShop` / `rooBonus` in `coin.ts`). Before Task 1 the controller runs these from `web/`: `git fetch origin`, `git switch feat/afk-gains-page`, `git pull --ff-only`, `git switch -c feat/multikill-page`. It then checks, and stops if anything is missing:
- `ls lib/statTracker/config.ts lib/statTracker/biggestGains.ts components/statTracker/StatCalculator.tsx scripts/_shared/topStatCollector.ts lib/arkh/computeAfk.ts lib/afkGains/pageConfig.ts`
- `grep -rn "export function prayersReal\|export function chipBonuses\|export function starSignBonusReal\|export const STAR_SIGN_TERMS\|export function directChildren\|export function computeGains\|export function profileFlat\|export function deriveGatedTalentsFor" lib scripts` (all 8 names must hit)
- `grep -n 'unit?: "x" | "%"' lib/statTracker/config.ts`, `grep -n "note?: string" lib/arkh/stats/tree-builder.ts` and `grep -n '\[A-Za-z_\]' scripts/updater/registry/gen-registry.ts`
- `grep -rln "SaltLick\|saltLick" lib/arkh/stats/systems/exp/` (Task 4 Step 1 reads the answer).

Finally it copies the spec and this plan from the scratchpad (`SP/night/2026-09-24-multikill-page-design.md`, `SP/night/2026-09-24-multikill-page.md`) to `docs/superpowers/specs/2026-09-24-multikill-page-design.md` and `docs/superpowers/plans/2026-09-24-multikill-page.md` and commits them. The controller pushes after each task and opens the PR with base `feat/afk-gains-page`, so the diff shows only Multikill (the base moves to `main` once AFK lands). Nobody merges: `main` only on the user's explicit order.

## Global Constraints

- All commands run from `web/` inside `C:/Users/Vinicius/ClaudeCowork/Leaderboard Ranking Sheet - Idleon/.claude/worktrees/social-auth-game-save-sync-ea785d` on branch `feat/multikill-page`.
- **Never run `npm run dev` / `next dev`.** Verify with `npx vitest run <paths>`, `npx vitest run` (full) and `npx tsc --noEmit -p tsconfig.json`. Playwright e2e runs in CI only.
- Never read, print or commit `web/.env.local` or anything under `web/__tests__/fixtures/gameAuth/`.
- **Private save tests.** The save lives only in `web/scripts/updater/golden/.cache/` (gitignored): `SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json"`. Tests that read it use `describe.skipIf(!existsSync(SAVE))` and read the file in `beforeAll`. Never commit a save. Other states (the Cove) come from an in-memory copy of that file (spec M19); never ask for a login or a new save.
- Engine tests need the window shim at the top of the file: `const g = globalThis as unknown as { window?: unknown }; if (!g.window) g.window = g;`
- The arkh state is a module singleton, and `loadSaveData` doesn't reset every field (`companionIds` is only assigned when non-empty, `starSignsUnlocked` only when `StarSg` is present). So:
  - keep synthetic-save tests in files that never load a real save (`overkill.test.ts`, `multikill-ports.test.ts`);
  - give synthetic envelopes an explicit `StarSg: {}`;
  - build synthetic OLA arrays sparse (a `0` at OLA[606] switches companion 0 on through the Pet-Bonus Token CSV);
  - put loops over real saves last in a file.
- A multikill compute on the private save costs ≈ 0.25 s (it loads the save, runs `computeMaxDamage` twice and `computeAccuracy` once). Any `it` that loops over several characters gets an explicit timeout: `30_000`; the cached-saves loop `120_000`.
- Site copy (UI strings) is in English. Code comments are in English, matching the density of the surrounding files.
- Stage only the files you changed (`git add <paths>`, never `git add -A` / `git add .`). Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push; the controller does.
- **Run the FULL suite (`npx vitest run`) and `tsc` before every commit**, not only the task's tests.
- N.js is the source of truth. The local copy is 25 MB: search it with small `node -e` scripts using `indexOf`/regex and print short slices; never `cat` or Read it whole. Path: `C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad/dr/N.js`.
- **`// @njs <Name>` tags.**
  - A tag must name an entry present in `web/data/njs-snapshot/formulas.json` or `lists.json`; the full-suite test `__tests__/updater/registry.guard.test.ts` enforces it.
  - Present (checked 2026-09-24): `MultiKillTOTAL`, `MultiKill_base`, `MultiKill_perTier`, `OverkillStuffs`, `OverkillQTY`, `DeathNoteRank`, `MonsterRespawnTimeReset`, `Clamz_HP`, `MeasurementBaseBonus`, `MeasurementMulti`, `MeasurementBonusTOTAL`, `_customBlock_SaltLick`, `_customBlock_GetBuffBonuses`, `_customBlock_Holes2`.
  - Absent, so prose only: `Cglunko_MKbase`, `Cglunko_MKtier`, `GetBuffBonuses`, `SaltLick`, `DamageDealed`, `PlayerAccTot`, `CardSetBonuses`, `CardBonusREAL`, `AchieveStatus`, `chipBonuses`.
  - After adding, moving or removing a tag, run `npx tsx scripts/updater/registry/gen-registry.ts` and commit the regenerated `scripts/updater/registry/formula-registry.gen.ts`.
  - Tag only the N.js function whose logic a file ports inline. Every other N.js reference is prose: `// N.js <expr> (@offset)`. Never write "@njs" in front of a word that isn't a snapshot name.
- **A new system's switch throws on unknown ids.** Task 3 makes every source id resolve, using `pending(name, neutral)` (0 in the sums, note `"pending port"`) for the 9 terms Tasks 4–5 port. Task 5 deletes `pending`, and a test asserts that no node carries the note `"pending port"`.
- **Check every helper signature against the real code before calling it.** Read on `feat/exp-multi-page` on 2026-09-24:
  - `computeStampBonusOfTypeX(type, s): TreeResult` (`w1/stamp.ts`); `etcBonus.resolve(n, { saveData, charIdx }): ArkhNode` (numeric id; `common/etcBonus.ts`); `achieveStatus(n, s): 0 | 1` (`common/achievement.ts`);
  - `talent.resolve(id, { saveData, charIdx, activeCharIdx }, { tab: 2 }?)` — `tab: 2` is the talent's second bonus, N.js `GetTalentNumber(2, id)`; the result is already wrapped (star talents, TalentCalc counters, account-wide max): never multiply by a counter again;
  - `computeVialByKey(key, s)`, `bubbleValByKey(key, ci, s)` (`w2/alchemy.ts`) and `arcadeBonus(idx, s)` (`w2/arcade.ts`) return `TreeResult`; `computeArtifactBonus(idx, ci, { saveData, charIdx })` (`w5/sailing.ts`) and `computeShinyBonusS(cat, s)` (`w4/breeding.ts`) return numbers;
  - `computeCardBonusByType(type, ci, s)` and `computeBoxReward(ci, key)` (`common/stats.ts`) return `{ val, children }`; `computeCardSetBonus(ci, key)` (`common/cards.ts`) returns `TreeResult`; `companions(id, s)` (`common/companions.ts`) returns the value (Sheepie, companion 4, reads 1);
  - `computeMaxDamage(ci, { saveData, charIdx })` and `computeAccuracy(ci, { saveData, charIdx })` (`common/derived-damage.ts`) return numbers; `cosmoBonus(s, 1, 3)` (`w5/hole.ts`); `getLOG(x)` (`formulas.ts`); `accountMapKills(m)` (`coin/accountKills.ts`);
  - `save/data.ts` exports `optionsListData`, `currentMapData`, `cauldronBubblesData`, `buffsActiveData`, `charClassData`, `labData`; `saveData` carries `towerData`, `saltLickData`, `ninjaData`, `holesData`, `riftData`, `companionIds`;
  - `label("Talent", 46)` = "Void Radius (Talent 46)"; 469 "Mana Is Life", 654 "Monolithialism", 58 "Master Of The System"; `label("Prayer", 16)` "Balance Of Pain"; `label("Arcade", 8)` "Multikill Per Tier Arcade Bonus (Arcade 8)"; `label("Artifact", 26)` has no friendly name (hence the literal "Trilobite Rock (Artifact 26)").
  - From the AFK plan (read the final code before use): `prayersReal(idx, cost, ci, s): TreeResult` (`w3/prayer.ts`), `chipBonuses(key, ci): number` (`w4/lab.ts`), `STAR_SIGN_TERMS` and `starSignBonusReal(key, ci, s): { val, children }` (`common/starSign.ts`).
  - From the EXP plan: `directChildren`, `computeGains`, `GainRow` (`lib/statTracker/biggestGains.ts`), `GainSource`, `GainsModel`, `StatPageConfig` (`lib/statTracker/config.ts`), `runTopCollector`, `profileFlat`, `StatCollectorConfig` (`scripts/_shared/topStatCollector.ts`), `deriveGatedTalentsFor` (`scripts/_shared/classGating.ts`).
- IdleonToolbox (GPL) is a read-only cross-check oracle; never copy its code.
- **Zero behavior change for Drop Rate, EXP Multi and AFK Gains; Coin Multi changes only in talent 643's tier (Task 2).** These must stay green, unedited unless a task says so:
  - `__tests__/lib/arkh/family-guy-dr.test.ts` (DR 363,893.46);
  - `__tests__/lib/arkh/coin-multi.*` (Markhe 6.88E35; `gambit7` 74.03532772764761);
  - `__tests__/lib/arkh/exp-multi.*`, `__tests__/lib/arkh/afk-gains.*`, `__tests__/lib/arkh/afk-fidelity.test.ts`;
  - `__tests__/lib/coinMulti/*`, `__tests__/lib/expMulti/*`, `__tests__/lib/afkGains/*`, `__tests__/lib/statTracker/*`, `__tests__/components/statTracker/*`, `__tests__/components/accountSaveOverPaste.test.tsx`.
- **Shared-helper changes are additive or number-preserving:** `coin/gambit.ts` gains the miniboss rank table, `overkillQTY` and `measurementBonusTotal` (Coin's `deathNoteSkulls` and Measurement 13 keep their numbers); EXP's Salt Lick port is generalized to any index (EXP's number is unchanged); `STAR_SIGN_TERMS` gains two keys; `Descriptor.combine` may return an optional root `fmt`; the kit gains two optional fields. `computeStarSignBonus`, `computePrayerReal`, `computeChipBonus`, `computeOverkillTier` and the private `getBuffBonus` of `derived-stats.ts` keep their behavior and callers.
- **The multikill tier is always `overkillStuffs` (`common/overkill.ts`), never `derived-damage.ts:computeOverkillTier`** (spec M5). `computeChipBonus` keeps feeding max damage and accuracy (M18). The "d21" bubble letter, the all-characters chip sum and `computeOverkillTier` stay as they are (M9 follow-ups).
- Don't add save keys to the loader: `AFKtarget_N` already arrives through `statCtx` as `ctx.afkTarget`.
- Save arrays may deserialize as objects with a `"length"` key; when iterating save arrays, skip non-numeric keys.

## Reference data (read-only)

- Scratchpad root `SP` = `C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad`
- `SP/mk/research.md`: the 33-row term inventory (N.js expression, arkh helper, status, IT name), the helpers, the IT gaps and the collector-map analysis.
- `SP/mk/njs_workbench_multikill.txt`: verbatim `DeathNoteRank`, `MultiKill_perTier`, `MultiKill_base`, `MultiKillTOTAL`, `OverkillQTY`. `SP/mk/njs_overkillstuffs.txt`: `OverkillStuffs` 0/1/2/3. `SP/mk/njs_helpers.txt`: `SaltLick`, `prayersReal`, `AchieveStatus`, `GetBuffBonuses`, `CardSetBonuses`, `StatueOnyxOwned`, `chipBonuses`, `StarSigns`, the Measurement functions, `Cglunko_*`, the `*ACTIVE` bubble gate and `MonsterRespawnTimeReset`. `SP/mk/njs_ui_afkinfo.txt` and `SP/mk/njs_consumers.txt`: display and consumers.
- `SP/mk/arkh-mk.mts`: every term with arkh helpers plus inline stand-ins for the missing ones (what Tasks 4–5 port). From `web/`: `npx tsx "SP/mk/arkh-mk.mts" scripts/updater/golden/.cache/arkhe-live-2026-09-23.json 8` prints the 11 characters (map, target, curse, max damage, tier, base, per tier, total) and Markhe's per-term JSON. Run probes as `.mts` files.
- `SP/mk/it-mk.mts`: the IT oracle. `cd "C:/Users/Vinicius/ClaudeCowork/Leaderboard Ranking Sheet - Idleon/web/scripts/updater/.cache/it-live" && ../../../../node_modules/.bin/tsx --tsconfig tsconfig.json "SP/mk/it-mk.mts" "<worktree>/web/scripts/updater/golden/.cache/arkhe-live-2026-09-23.json"`.
- `SP/mk/probe2.mts`: the W7 HP ladder and the tier on maps 301/306/310 with arkh's and IT's max damage. `SP/mkplan/coin643.mts`: Coin's talent-643 tier per character and map (before Task 2: zArkhe on 301 → 21, Markhe on 306 → 18).
- Validation save (private): `web/scripts/updater/golden/.cache/arkhe-live-2026-09-23.json` (raw `Holes`, `Ninja`, `Tower`, `SaltLick`, `CauldronBubbles`, `Lab` are JSON strings; `OptLacc` is an array).
  - 11 characters. **Markhe = index 8**, saved map 14, `AFKtarget_8` = `beanG` (FIGHTING, HP 300, Defence 1). Chips `[9,20,21,15,16,17,18]` (no Wood Chip 14 → no `mkill`); prayers `[12,1,3,5,14]` (no 16, no curse 0/7/8); `BuffsActive_8` = 94, 168, 167; `CauldronBubbles[8]` = `["c8","_11","c15"]`; Sheepie (companion 4) owned.
  - The other 10 sit on map 216 in cavern 3 (`Holes[0]` = `[3,3,3,3,3,3,3,3,-1,3,3,-1]`), aiming at `Bravery_Monument` (Paying_Respect, HP 42). **zArkhe = index 2**: prayers `[5,14,3,1,4,16,8]` → Jawbreaker curse 1180% (HP ×12.8) and Balance of Pain equipped. Warkhe (6) is class 4 (Voidwalker).
  - Account: `Tower[2]` = 51, `SaltLick[8]` = 10, `Ninja[105]` first 10 = `[107514, 143716, 169225, 869817, 182447, 51801, 93254, 30770, 21569, 7937]`, `Holes[22][9]` = 465, `Holes[11][28]` = 134799252388111, `Rift[0]` = 65, 245 enabled star signs (Seraph ×10), OLA[464] = 8, OLA[645] = 38, OLA[636] = 46.
  - Death Note pages: W1 300 · W2 220 · W3 280 · W4 260 · W5 260 · W6 280 · W7 460 · minibosses 58 (`DeathNoteMobs` sizes 15/11/14/13/13/14/24).
  - Max damage (arkh): Markhe 6.012923950472598e30, zArkhe 7.695927981974997e28; IT reads Markhe 2.4525655577153924e35 (spec M4, unreconciled).
- N.js offsets: `DeathNoteRank` @7751300; `MultiKill_perTier` @7751511; `MultiKill_base` @7754109; `MultiKillTOTAL` @7756167; `OverkillQTY` @7756378; `OverkillStuffs` @4075410; `GetBuffBonuses` @4257299; `SaltLick` @7774631; `prayersReal` @7774914; `chipBonuses` @5139280; `StarSigns` @6490716 (sign 47 @6506250, sign 78 @6513550); `MeasurementBaseBonus` @10914899, `MeasurementMulti` @10918723, `MeasurementBonusTOTAL` @10918979; `Cglunko_MKtier` @10969437, `Cglunko_upgBon` @10969789; `Clamz_HP` @10887166; `MonsterRespawnTimeReset` @6458543 (curse line @6466526, `w7a6` = `Clamz_HP` @6467129); `*ACTIVE` bubble gate @4460300; AFK Info fill @3768103, `MULTIKILL;_` row @3835457; W7 notice @20996964; THE_COVE @11988151.
- **Markhe, map 14: expected values** (arkh = IT on every term; full precision):

  | Pool | id → value |
  |---|---|
  | `base` | sign47 150 · saltLick8 30 · stampC19 166 · deathNoteBuilding 102 · etc29 30.450000000000003 · ach148 1 · ach122 6 · ach123 2 · talent654 576 → Σ **1063.45** |
  | `perTier` | deathNoteWorld 300 (W1) · deathNoteMini 58 · vialOverkill 101.92 · buff46 0 · talent58 265.7718120805369 · arcade8 20.09950248756219 · artifact26 150 · buff469 0 · chipMkill 0 · etc71 195.16191214168592 · meas9 281.3841523937517 · card80 0 · sign78 30 · prayer16 0 · shiny4 80 · box13b 9.782608695652174 · bubbleMKtier 89.11312573906189 · cardSet11 0 → Σ **1581.2331135382508** |
  | `tier` | **51** (beanG HP 300, E = 2) · `active` 1 (FIGHTING: the AFK Info shows the line) |
  | total | 1063.45 + 51 × 1581.2331135382508 = 81706.3388 → **81706** |

- **Scenario anchors** (the same save):

  | Scenario | Character / map | Expected |
  |---|---|---|
  | W7 | Markhe, 301 | B′ 114.409 · raw P 1741.2331135382508 (W7 page 460) → P′ 127.96466227076502 · tier **24** (estimate) → **3185** (IT's max damage: tier 30 → 3953) · "reduced by ~93%" |
  | Collector map | Markhe, 251 | W6 page 280 · tier 51 → **80686**; all 11 characters at tier 51 |
  | Cove | ARKHE (0), copy with `Holes[0][0] = 17`, 216 | B′ 38 × 100 = **3800** · P′ 46 × 1 = **46** · T 51 → **6146** |
  | Clamworks | Markhe, 306 | HP 1e16·30^8 = **6.561e27**, no curse → tier **4** (estimate) → **626** |
  | Curses | zArkhe (2), 301 | Jawbreaker 1180% → HP ×12.8 → tier 21 → **19** → **2754** (3032 without the factor) |
  | Flag "3" | all 11 on their saved maps | active 1; only Markhe's target is FIGHTING |
  | Coin (M5) | zArkhe 301 / Markhe 306 | talent 643's tier 21 → **19** / 18 → **4**; Markhe on map 14 stays **6.88E35** |
  | IT, saved map 216 | the other 10 | ARKHE 77116 · ARKHELUCK 106167 · zArkhe 107748 · farkhe 77116 · Darkhe 77116 · Parkhe 106167 · Warkhe 105652 · Sarkhe 107748 · Barkhe 106167 · Arkhiiiiii 106167 |

## File structure

| File | Task | Responsibility |
|---|---|---|
| `web/lib/statTracker/config.ts` | 1 | `GainsModel.levers?`, `StatPageConfig.totalTitle?` |
| `web/lib/statTracker/biggestGains.ts` | 1 | `computeGains` ranks the levers |
| `web/components/statTracker/StatCalculator.tsx` | 1 | Headline tooltip from `totalTitle` |
| `web/lib/arkh/stats/systems/common/overkill.ts` | 2 | `multikillTier`, `Overkill`, `overkillStuffs`, `overkillActive` |
| `web/lib/arkh/stats/systems/coin/coin.ts` | 2 | Talent 643's tier from `overkillStuffs` (M5) |
| `web/lib/arkh/stats/defs/multikill.ts` | 3 | `MK_ROOT`, `MK_NODES`, `MK_RULES`, `MK_POOLS`, `mkSoftCap`, `MkParts`, `mkHalves`, `mkTotal`, the descriptor |
| `web/lib/arkh/stats/tree-builder.ts`, `web/lib/arkh/computeStat.ts` | 3 | Optional root `fmt` from `combine` |
| `web/lib/arkh/stats/systems/multikill/multikill.ts` | 3–5 | `multikill` system (one case per N.js term), `MK_CLASS_TALENTS` |
| `web/lib/arkh/stats/registry.ts` | 3 | Register `multikill` |
| `web/lib/arkh/computeMultikill.ts` | 3, 6 | `computeArkhMultikill`, `computeArkhMultikillPools`, `combineMultikillPools`, `MK_COLLECTOR_MAP` |
| `web/lib/arkh/stats/systems/coin/gambit.ts` | 4 | `overkillQTY` (worlds + minibosses), `measurementBonusTotal` |
| `web/lib/arkh/stats/systems/exp/saltLick.ts` | 4 | Generic `saltLick(i, s)` |
| `web/lib/arkh/stats/systems/common/starSign.ts` | 5 | `STAR_SIGN_TERMS.MultiKill`, `STAR_SIGN_TERMS["78"]` |
| `web/lib/arkh/stats/systems/common/buffs.ts` | 5 | `getBuffBonuses` |
| `web/lib/multikill/format.ts` | 6 | `formatMultikill` |
| `web/scripts/update-top-multikill.ts` | 7 | Collector config |
| `web/lib/multikill/topMultikill.ts` + `.meta.ts` | 7 | Generated Observed Max |
| `.github/workflows/refresh-top-max.yml` | 7 | Cron step |
| `web/lib/multikill/gains.ts` | 8 | `multikillGainsModel` |
| `web/lib/multikill/pageConfig.ts` | 8 | `MULTIKILL_PAGE` |
| `web/app/multikill/{page.tsx,MultikillPageClient.tsx}` | 9 | Route |
| `web/components/TopNav.tsx`, `web/app/page.tsx`, `web/e2e/homepage.spec.ts` | 9 | Navigation |
| `web/scripts/updater/registry/formula-registry.gen.ts` | 2–5 | Regenerated |

---

### Task 1: Kit hooks — `GainsModel.levers?` and `StatPageConfig.totalTitle?`

**Files:**
- Modify: `web/lib/statTracker/config.ts`
- Modify: `web/lib/statTracker/biggestGains.ts`
- Modify: `web/components/statTracker/StatCalculator.tsx`
- Test: `web/__tests__/lib/statTracker/biggestGains.test.ts`, `web/__tests__/components/statTracker/StatCalculator.test.tsx` (append)

**Interfaces:**
- Consumes: `GainsModel`, `GainRow`, `computeGains`, `StatPageConfig`, `StatCalculator` and the test helpers `model` / `P` (biggestGains test) and `testConfig` / `loader` / `save()` (StatCalculator test), as the EXP plan (Tasks 6–7) and AFK Task 1 left them.
- Produces:
  - `GainsModel.levers?(yoursFlat): GainRow[]` — rows the model computes itself (spec M13). `computeGains` ranks them with the source rows, drops the ones without a positive finite gain, and never counts them in `comparableSources`;
  - `StatPageConfig.totalTitle?(x): string` — the headline's tooltip. Omitted, it stays what AFK Task 1 made it (`100·total` with 2 decimals for `unit: "%"`, the exponent form for `"x"`). Multikill needs it because its total is already a percent.

- [ ] **Step 1: Write the failing tests.** In `__tests__/lib/statTracker/biggestGains.test.ts` add `import type { GainsModel } from "@/lib/statTracker/config";` next to the other imports, and inside its `describe`:

```ts
  it("ranks the model's levers with the sources, without counting them as comparable", () => {
    const lever = { path: "Root / Step", group: "Levers", source: "+1 step", display: "raw" as const, you: 1, max: 2, gainPct: 60 };
    const withLevers: GainsModel = { ...model, levers: () => [lever, { ...lever, path: "Root / Flat", source: "flat", gainPct: 0 }] };
    const res = computeGains(withLevers, { [`${P} / A`]: 100, [`${P} / B`]: 200 }, { [`${P} / A`]: 400 });
    expect(res.comparableSources).toBe(1);
    expect(res.rows.map((r) => r.source)).toEqual(["A", "+1 step"]); // 75% then 60%; the 0% lever is dropped
  });
```

In `__tests__/components/statTracker/StatCalculator.test.tsx`, inside its `describe`:

```tsx
  it("uses the config's totalTitle for the headline tooltip", async () => {
    const tree = { name: "Test Multi", val: 81706, fmt: "%" as const, children: [] };
    const pct: StatPageConfig = {
      ...testConfig,
      unit: "%",
      formatTotal: (x) => String(Math.floor(x)),
      totalTitle: (x) => x.toLocaleString("en-US") + "%",
      compute: async () => ({ tree, total: tree.val }),
    };
    render(<StatCalculator config={pct} />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText("81706%")).toHaveAttribute("title", "81,706%");
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/lib/statTracker/biggestGains.test.ts __tests__/components/statTracker/StatCalculator.test.tsx`
Expected: FAIL. `levers` and `totalTitle` are not fields of their types (type errors), the lever row is missing and the tooltip reads `8170600.00%`.

- [ ] **Step 3: Implement.**

`lib/statTracker/config.ts`: add `import type { GainRow } from "./biggestGains";` (a type-only cycle with `biggestGains.ts`, erased at runtime). In `GainsModel`, after `totalFromFlat`:

```ts
  /** Optional steps the model computes itself — no Observed Max — ranked
   *  with the source rows but never counted as comparable sources, e.g.
   *  Multikill's "+1 damage tier". */
  levers?(yoursFlat: Record<string, number>): GainRow[];
```

In `StatPageConfig`, right after `unit?`:

```ts
  /** The headline's tooltip. Default: the exponent form ("x"), or 100·total
   *  with 2 decimals for a "%" rate (AFK Gains). A stat whose total is
   *  already a percent (Multikill) passes its own. */
  totalTitle?(x: number): string;
```

`lib/statTracker/biggestGains.ts`, in `computeGains`, right before `rows.sort(...)`:

```ts
  // Model-computed steps (Multikill's "+1 damage tier"): ranked with the rows,
  // never comparable sources — they have no Observed Max.
  for (const lever of model.levers?.(yoursFlat) ?? []) {
    if (Number.isFinite(lever.gainPct) && lever.gainPct > 0) rows.push(lever);
  }
```

`components/statTracker/StatCalculator.tsx`: the headline span's `title` (AFK Task 1's version) becomes:

```tsx
            title={
              total !== null
                ? config.totalTitle
                  ? config.totalTitle(total)
                  : unit === "%"
                    ? (100 * total).toFixed(2) + "%"
                    : total.toExponential(6) + "x"
                : undefined
            }
```

- [ ] **Step 4: Run.** `npx vitest run __tests__/lib/statTracker __tests__/components/statTracker __tests__/lib/coinMulti __tests__/lib/expMulti __tests__/lib/afkGains` must PASS: nobody else sets the two fields, so AFK's `42231.87%` tooltip and every Coin/EXP/AFK ranking are unchanged. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 5: Commit**

```bash
git add lib/statTracker/config.ts lib/statTracker/biggestGains.ts components/statTracker/StatCalculator.tsx __tests__/lib/statTracker/biggestGains.test.ts __tests__/components/statTracker/StatCalculator.test.tsx
git commit -m "feat(statTracker): gains levers and a headline tooltip option

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared damage-tier helper; Coin's talent 643 on it (spec M5)

This is the spec's separate Coin commit: the only change outside the Multikill page.

**Files:**
- Create: `web/lib/arkh/stats/systems/common/overkill.ts`
- Modify: `web/lib/arkh/stats/systems/coin/coin.ts`
- Modify: `web/scripts/updater/registry/formula-registry.gen.ts` (regenerated)
- Test: `web/__tests__/lib/arkh/overkill.test.ts` (new, synthetic only), `web/__tests__/lib/arkh/coin-multi.save.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `prayersReal` (AFK Task 3), `computeMaxDamage`, `computeAccuracy`, `MapAFKtarget`, `MONSTERS`, `currentMapData`, `optionsListData`.
- Produces, from `@/lib/arkh/stats/systems/common/overkill`:
  - `multikillTier(hp, maxDmg, exponent): number` (moved unchanged from `coin.ts`);
  - `type Overkill` and `overkillStuffs(ci, map, ctx: { saveData; afkTarget? }): Overkill` — target (M1), static HP, curses, live HP, exponent, max damage, tier, `tierAt` ("0") and `nextAt` ("1");
  - `type OverkillActive` and `overkillActive(ok, ci, s): OverkillActive` — flag "3" and its three parts. It is a separate function so Coin never pays for `computeAccuracy`.

- [ ] **Step 1: Write the failing tests.** `web/__tests__/lib/arkh/overkill.test.ts`:

```ts
// Synthetic saves for the shared damage-tier helper (spec M5). This file never
// loads a real save: the arkh state is a singleton and loadSaveData doesn't
// reset every field. The OLA array is sparse on purpose (OLA[606]).
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { multikillTier, overkillActive, overkillStuffs } from "@/lib/arkh/stats/systems/common/overkill";
import { FORMULA_REGISTRY } from "@/scripts/updater/registry/formula-registry.gen";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("multikillTier (N.js OverkillStuffs '2')", () => {
  it("tier k from HP·E^k; tier 1 below HP·E²", () => {
    expect(multikillTier(100, 399, 2)).toBe(1);
    expect(multikillTier(100, 400, 2)).toBe(2);
    expect(multikillTier(100, 799, 2)).toBe(2);
    expect(multikillTier(100, 800, 2)).toBe(3);
    expect(multikillTier(10, 10 * 5 ** 7 - 1, 5)).toBe(6);
    expect(multikillTier(10, 10 * 5 ** 7, 5)).toBe(7);
  });

  it("caps at 51 and reads 1 without a target HP", () => {
    expect(multikillTier(1, 1e300, 2)).toBe(51);
    expect(multikillTier(0, 1e30, 2)).toBe(1);
  });
});

describe("overkillStuffs — the AFK target's live HP", () => {
  const ola: number[] = [];
  ola[464] = 8;
  const owned = Array(20).fill(0);
  owned[8] = 50; // Jawbreaker lv 50: round(200 × 5.9) = 1180%
  const load = (prayers: number[]) =>
    loadSaveData({
      charNames: ["A"],
      data: { StarSg: {}, OptLacc: ola, PrayOwned: owned, Prayers_0: prayers, CurrentMap_0: 14 },
    });

  it("an equipped curse multiplies the HP: Jawbreaker lv 50 → ×12.8 (E = 5 in W7)", () => {
    load([8, -1, -1, -1, -1, -1]);
    const ok = overkillStuffs(0, 301, { saveData });
    expect(ok).toMatchObject({ target: "w7a1", clam: false, staticHp: 7e13, exponent: 5 });
    expect(ok.curses).toEqual([0, 0, 1180]);
    expect(ok.curse).toBeCloseTo(12.8, 12);
    expect(ok.hp / (7e13 * 12.8)).toBeCloseTo(1, 12);
  });

  it("Clamworks (w7a6) is Clamz_HP = 1e16·30^OLA[464], never cursed", () => {
    load([8, -1, -1, -1, -1, -1]);
    const ok = overkillStuffs(0, 306, { saveData });
    expect(ok).toMatchObject({ target: "w7a6", clam: true, curse: 1 });
    expect(ok.hp).toBe(1e16 * Math.pow(30, 8)); // 6.561e27, not the table's 1e18
  });

  it("the saved map measures against AFKtarget_N, other maps against MapAFKtarget (spec M1)", () => {
    load([-1, -1, -1, -1, -1, -1]);
    expect(overkillStuffs(0, 14, { saveData, afkTarget: "w6a1" }).target).toBe("w6a1");
    expect(overkillStuffs(0, 1, { saveData, afkTarget: "w6a1" }).target).toBe("mushG");
    expect(overkillStuffs(0, 14, { saveData }).target).toBe("beanG");
  });

  it("OverkillStuffs('3') needs the Death Note built (TowerInfo[2] > 0.5)", () => {
    load([-1, -1, -1, -1, -1, -1]);
    expect(overkillActive(overkillStuffs(0, 14, { saveData }), 0, saveData)).toMatchObject({
      deathNote: false,
      active: false,
    });
  });

  it("registers the port under N.js's names for the updater", () => {
    expect(FORMULA_REGISTRY["OverkillStuffs"]).toEqual(["lib/arkh/stats/systems/common/overkill.ts"]);
    expect(FORMULA_REGISTRY["Clamz_HP"]).toEqual(["lib/arkh/stats/systems/common/overkill.ts"]);
  });
});
```

Append to `__tests__/lib/arkh/coin-multi.save.test.ts`, at the end of the file:

```ts
// Spec M5: talent 643's tier measures the target's live HP — the character's
// prayer curses (MonsterRespawnTimeReset @6466526) and Clamworks' Clamz_HP
// (@10887166). Markhe carries no curse, so her 6.88E35 above is unchanged.
describe.skipIf(!existsSync(SAVE))("Coin talent 643 — the game's target HP (spec M5)", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });
  const tierOf = (name: string, map: number): number => {
    const t = computeArkhCoinMulti(save, save.charNames.indexOf(name), map).tree;
    const gi = COIN_GROUPS.findIndex((x) => x.sources.includes("talent643"));
    const n = t.children![gi].children![COIN_GROUPS[gi].sources.indexOf("talent643")];
    return Number(n.children!.find((c) => c.name === "Multikill tier (selected map)")!.val);
  };

  it("zArkhe's Jawbreaker curse (1180%, HP ×12.8): tier 21 → 19 on map 301", () => {
    expect(tierOf("zArkhe", 301)).toBe(19);
  });

  it("Clamworks (map 306) measures Clamz_HP = 1e16·30^8, not the table's 1e18: tier 18 → 4", () => {
    expect(tierOf("Markhe", 306)).toBe(4);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/overkill.test.ts __tests__/lib/arkh/coin-multi.save.test.ts`
Expected: FAIL. `common/overkill.ts` doesn't exist, and Coin still reads tiers 21 and 18.

- [ ] **Step 3: Create** `web/lib/arkh/stats/systems/common/overkill.ts`:

```ts
// ===== OVERKILL (damage tier) =====
// N.js RunCodeOfTypeXforThingY("OverkillStuffs", b) (@4075410): the damage
// tier the AFK Info's purple bar shows ("2"), its two thresholds ("0", "1")
// and the multikill activation flag ("3"), measured against the AFK target's
// HP as performETCaction("MonsterRespawnTimeReset") (@6458543) leaves it:
// every monster's HP × (1 + (curse 0 + curse 7 + curse 8)/100) — Big Brain
// Time, Midas Minded, Jawbreaker, equipped by this character (@6466526) —
// THEN the Clamworks clam w7a6 set to Thingies("Clamz_HP") = 1e16·30^OLA[464]
// (@10887166, @6467129), so the clam never carries the curses.
// Shared by Coin's talent 643 and the Multikill page (spec M5). Not
// derived-damage.ts:computeOverkillTier (MapAFKtarget + a FIGHTING gate, no
// curses), which keeps feeding talent.resolve(643)'s wrap.

import { MapAFKtarget } from "../../data/game/customlists.js";
import { MONSTERS } from "../../data/game/monsters.js";
import { optionsListData, currentMapData } from "../../../save/data";
import { prayersReal } from "../w3/prayer";
import { computeAccuracy, computeMaxDamage } from "./derived-damage";
import type { SaveData } from "../../../state";

// @njs OverkillStuffs
/** OverkillStuffs("2"): t = 1; for f = 0..49: Max ≥ HP·E·E^(f+1) → t = f + 2,
 *  else stop. So tier k ⇔ HP·E^k ≤ Max < HP·E^(k+1); 1 below HP·E²; cap 51.
 *  Moved unchanged from coin.ts. */
export function multikillTier(hp: number, maxDmg: number, exponent: number): number {
  if (hp <= 0) return 1;
  let tier = 1;
  for (let st = 0; st < 50; st++) {
    if (maxDmg >= hp * exponent * Math.pow(exponent, st + 1)) tier = st + 2;
    else break;
  }
  return tier;
}

export type Overkill = {
  map: number;
  /** AFKtarget_N on the character's own saved map, MapAFKtarget[map] elsewhere (spec M1). */
  target: string;
  /** The Clamworks clam (w7a6): Clamz_HP, never cursed. */
  clam: boolean;
  /** The table's MonsterHPTotal, or Clamz_HP for the clam. */
  staticHp: number;
  /** Curses 0 / 7 / 8 in % (0 for the clam). */
  curses: [number, number, number];
  /** 1 + Σ curses/100. */
  curse: number;
  hp: number;
  /** OverkillEXPONENT: 5 on maps ≥ 300, else 2. */
  exponent: number;
  maxDmg: number;
  tier: number;
  /** OverkillStuffs("0"): HP at tier 1, else HP·E^tier. */
  tierAt: number;
  /** OverkillStuffs("1"): HP·E^(tier+1). */
  nextAt: number;
};

// @njs MonsterRespawnTimeReset
// @njs Clamz_HP
export function overkillStuffs(ci: number, map: number, ctx: { saveData: SaveData; afkTarget?: string }): Overkill {
  const s = ctx.saveData;
  const savedMap = Number((currentMapData as any)?.[ci]);
  const target = String((map === savedMap && ctx.afkTarget ? ctx.afkTarget : (MapAFKtarget as any)[map]) ?? "");
  const clam = target === "w7a6";
  const curses = [0, 7, 8].map((d) => (clam ? 0 : Number(prayersReal(d, 1, ci, s).val) || 0)) as [number, number, number];
  const curse = 1 + (curses[0] + curses[1] + curses[2]) / 100;
  const staticHp = clam
    ? 1e16 * Math.pow(30, Number((optionsListData as any[])[464]) || 0)
    : Number((MONSTERS as any)[target]?.MonsterHPTotal) || 0;
  const hp = staticHp * curse;
  const exponent = map >= 300 ? 5 : 2;
  let maxDmg = 0;
  try {
    maxDmg = computeMaxDamage(ci, { saveData: s, charIdx: ci }) || 0;
  } catch {
    maxDmg = 0;
  }
  const tier = multikillTier(hp, maxDmg, exponent);
  return {
    map, target, clam, staticHp, curses, curse, hp, exponent, maxDmg, tier,
    tierAt: tier === 1 ? hp : hp * Math.pow(exponent, tier),
    nextAt: hp * Math.pow(exponent, tier + 1),
  };
}

export type OverkillActive = {
  active: boolean;
  maxOk: boolean;
  deathNote: boolean;
  accOk: boolean;
  accuracy: number;
  defence: number;
  /** The target's AFKtype; the AFK Info prints the MULTIKILL line only for "FIGHTING". */
  type: string;
};

/** OverkillStuffs("3"): Max ≥ HP·E && TowerInfo[2] > 0.5 (Death Note built)
 *  && PlayerAccTot() > 1.5·Defence(target). The game applies the multikill
 *  only when it holds, and prints the AFK Info line only for a FIGHTING
 *  target (@3835457). */
export function overkillActive(ok: Overkill, ci: number, s: SaveData): OverkillActive {
  const mon = (MONSTERS as any)[ok.target];
  const defence = Number(mon?.Defence) || 0;
  const accuracy = computeAccuracy(ci, { saveData: s, charIdx: ci });
  const maxOk = ok.maxDmg >= ok.hp * ok.exponent;
  const deathNote = (Number((s.towerData as any)?.[2]) || 0) > 0.5;
  const accOk = accuracy > 1.5 * defence;
  return {
    active: maxOk && deathNote && accOk,
    maxOk, deathNote, accOk, accuracy, defence,
    type: String(mon?.AFKtype ?? "no definition"),
  };
}
```

- [ ] **Step 4: Switch Coin's talent 643.** In `systems/coin/coin.ts`:
  - delete the private `multikillTier` function and the comment block above it ("N.js OverkillStuffs("2") loop, parametrized directly …");
  - add `import { overkillStuffs } from "../common/overkill";`;
  - replace the whole `case "talent643"` (from its `// @njs OverkillStuffs` line to the case's closing brace; the tag moves to `overkill.ts`) with:

```ts
    // Talent 643 (Coins For Charon): TalentCalc(643) = GetTalentNumber(1,643)
    // × OverkillStuffs("2") (N.js @4075410). talent.resolve() applies the
    // shared wrap's tier (computeOverkillTier: MapAFKtarget of the saved map,
    // a FIGHTING gate, no curses), so dividing it back out recovers the bare
    // GetTalentNumber(1,643); overkillStuffs (common/overkill.ts) then gives
    // the game's tier for the viewed map: AFKtarget_N on the saved map, the
    // HP with the character's prayer curses, Clamz_HP on map 306 (spec M5).
    case "talent643": {
      const r = talent.resolve(643, tctx);
      if (!(Number(r.val) > 0)) return r;
      const t0 = computeOverkillTier(ci, { saveData: s, charIdx: ci });
      const tv = Number(r.val) / t0.tier;
      const map = ctx.mapIdx ?? Number((currentMapData as any)?.[ci]);
      const ok = overkillStuffs(ci, map, ctx);
      return node(
        r.name,
        tv * ok.tier,
        [
          ...(r.children ?? []),
          node("Multikill tier (selected map)", ok.tier, null, { fmt: "raw", note: `Map ${ok.map} · target ${ok.target}` }),
        ],
        { fmt: "+" }
      );
    }
```

  - run `grep -n "MONSTERS\|MapAFKtarget\|computeMaxDamage" lib/arkh/stats/systems/coin/coin.ts` and drop each import that nothing uses any more (the derived-damage import becomes `import { computeOverkillTier } from "../common/derived-damage";`).

Then regenerate the registry: `npx tsx scripts/updater/registry/gen-registry.ts`. `OverkillStuffs` now maps to `overkill.ts` only; `MonsterRespawnTimeReset` and `Clamz_HP` are new keys.

- [ ] **Step 5: Run.** `npx vitest run __tests__/lib/arkh/overkill.test.ts __tests__/lib/arkh/coin-multi.save.test.ts __tests__/lib/arkh/coin-multi.smoke.test.ts __tests__/lib/arkh/coin-multi.combine.test.ts __tests__/lib/coinMulti __tests__/updater/registry.guard.test.ts` must PASS. The existing Coin cases stay green unedited: Markhe on 14 and in town (6.88E35), "moves only guild8 and talent643" (no curse on Markhe) and ARKHELUCK's AFKtarget_N case (no curse). Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 6: Commit**

```bash
git add lib/arkh/stats/systems/common/overkill.ts lib/arkh/stats/systems/coin/coin.ts scripts/updater/registry/formula-registry.gen.ts __tests__/lib/arkh/overkill.test.ts __tests__/lib/arkh/coin-multi.save.test.ts
git commit -m "fix(coin): talent 643's multikill tier uses the target's live HP (prayer curses, Clamworks)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Multikill descriptor, system skeleton and entry point

**Files:**
- Create: `web/lib/arkh/stats/defs/multikill.ts`
- Create: `web/lib/arkh/stats/systems/multikill/multikill.ts`
- Create: `web/lib/arkh/computeMultikill.ts`
- Modify: `web/lib/arkh/stats/tree-builder.ts`, `web/lib/arkh/computeStat.ts` (optional root `fmt` from `combine`)
- Modify: `web/lib/arkh/stats/registry.ts` (import `multikill`, add `multikill: multikill as unknown as SystemResolver,` after the `afk` entry)
- Modify: `web/scripts/updater/registry/formula-registry.gen.ts` (regenerated)
- Test: `web/__tests__/lib/arkh/multikill.combine.test.ts`, `web/__tests__/lib/arkh/multikill.smoke.test.ts`, `web/__tests__/lib/arkh/multikill.save.test.ts` (new)

**Interfaces:**
- Consumes: `overkillStuffs`, `overkillActive` (Task 2); `prayersReal`, `chipBonuses` (AFK Task 3); `Descriptor`, `SourceSpec`, `Pool` (`tree-builder.ts`); `computeStatTree`, `computeStatPools`, `combineStatPools`, `StatResult` (`computeStat.ts`).
- Produces:
  - from `@/lib/arkh/stats/defs/multikill`: `MK_ROOT = "Multikill"`, `MK_NODES` (`base`, `tier`, `tierW7`, `perTier`, `active`), `MK_RULES` (`softCap`, `cove`), `MK_POOLS`, `mkSoftCap(v)`, `type MkParts`, `mkHalves(p)`, `mkTotal(p)`, default `multikillDesc`;
  - the `multikill` system and `MK_CLASS_TALENTS = [46, 469] as const`, from `@/lib/arkh/stats/systems/multikill/multikill`;
  - from `@/lib/arkh/computeMultikill`: `computeArkhMultikill(raw, ci, map = 0) → StatResult`, `computeArkhMultikillPools(raw, ci, map = 0) → Record<string, Pool>`, `combineMultikillPools(pools) → StatResult`;
  - `Descriptor.combine` may return `fmt?: NodeFmt`, which the root carries (default `"x"`).

- [ ] **Step 1: Create the descriptor** `web/lib/arkh/stats/defs/multikill.ts`. It is complete: later tasks don't change it.

```ts
// ===== MULTIKILL DESCRIPTOR =====
// N.js WorkbenchStuff("MultiKillTOTAL") (@7756167): the AFK Info panel's
// "MULTIKILL: X%" line (spec M1):
//   MK = ⌊ B′ + T × P′ ⌋
//   B  = Σ of the 9 MultiKill_base terms (@7754109)
//   P  = Σ of the 18 MultiKill_perTier terms (@7751511)
//   T  = OverkillStuffs("2"), the damage tier 1–51 (common/overkill.ts)
//   B′, P′ = B and P after the Shimmerfin Deep soft cap (map ≥ 300), or
//            replaced by the Crystal Glunko Cove (map 216 + cavern 17)
// Linear in the tier — not a product of groups — so this is its own
// descriptor (not groupedDescriptor). combine() is a pure function of the
// pools (the Observed Max collector calls it without a ctx), so the map rules
// arrive as sources of the `rules` pool (spec M14). mkTotal() is the one copy
// of the formula: combine here, the Biggest Gains what-if
// (lib/multikill/gains.ts) and the collector all go through it.

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

export const MK_ROOT = "Multikill";

/** The root's children. Fixed names, so snapshot and Observed Max paths never
 *  move — except the tier: a W7 map names it by its ×5 ladder, so neither
 *  Biggest Gains nor Compare meets the map-251 (×2) reference there (M12). */
export const MK_NODES = {
  base: "Base Multikill",
  tier: "Damage Tier",
  tierW7: "Damage Tier (W7 ×5 ladder)",
  perTier: "Multikill per Tier",
  active: "Active in AFK",
} as const;

/** Rule rows each half carries on the maps where they apply (M2/M14). */
export const MK_RULES = {
  softCap: "Shimmerfin Deep soft cap",
  cove: "Crystal Glunko Cove",
} as const;

/** Source ids of the `multikill` system, N.js order. */
export const MK_POOLS: Record<"base" | "perTier" | "tier" | "rules" | "status", readonly string[]> = {
  base: ["sign47", "saltLick8", "stampC19", "deathNoteBuilding", "etc29", "ach148", "ach122", "ach123", "talent654"],
  perTier: [
    "deathNoteWorld", "deathNoteMini", "vialOverkill", "buff46", "talent58", "arcade8", "artifact26", "buff469",
    "chipMkill", "etc71", "meas9", "card80", "sign78", "prayer16", "shiny4", "box13b", "bubbleMKtier", "cardSet11",
  ],
  tier: ["tier"],
  rules: ["softCap", "cove"],
  status: ["active"],
};

// @njs MultiKill_base
// @njs MultiKill_perTier
/** The Shimmerfin Deep soft cap N.js applies to each sum on maps ≥ 300.
 *  Practically continuous (the steps at 50, 100 and 250 are under 0.05); the
 *  top bracket has no ceiling (slope 1/50). */
export function mkSoftCap(v: number): number {
  if (v >= 250) return 98.14 + (v - 250) / 50;
  if (v >= 200) return 95.6 + (v - 200) / 20;
  if (v >= 150) return 90.6 + (v - 150) / 10;
  if (v >= 100) return 80.6 + (v - 100) / 5;
  if (v >= 50) return 47.3 + (v - 50) / 1.5;
  if (v >= 20) return 20 + (v - 20) / 1.1;
  return v;
}

export type MkParts = {
  /** B: Σ of the base sources. */
  base: number;
  /** P: Σ of the per-tier sources. */
  perTier: number;
  /** T: the damage tier. */
  tier: number;
  /** Map ≥ 300. */
  softCap: boolean;
  /** Map 216 in cavern 17: the Cove's two replacement values. */
  cove: { base: number; perTier: number } | null;
};

/** B′ and P′. N.js applies the Cove after the soft cap; they never meet (216 < 300). */
export function mkHalves(p: MkParts): { base: number; perTier: number } {
  if (p.cove) return p.cove;
  return p.softCap ? { base: mkSoftCap(p.base), perTier: mkSoftCap(p.perTier) } : { base: p.base, perTier: p.perTier };
}

// @njs MultiKillTOTAL
export function mkTotal(p: MkParts): number {
  const h = mkHalves(p);
  return Math.floor(h.base + p.tier * h.perTier);
}

const num = (n: ArkhNode | undefined, dflt: number): number => {
  const v = Number(n?.val);
  return Number.isFinite(v) ? v : dflt;
};
const sum = (xs: ArkhNode[]): number => xs.reduce((a, it) => a + (Number(it.val) || 0), 0);

/** The rule row a half carries on this map: the soft cap (Σ → capped, with the
 *  W7 notice's "reduced by ~X%") or the Cove's replacement value. */
function ruleRows(p: MkParts, raw: number, value: number): ArkhNode[] {
  if (p.cove) return [{ name: MK_RULES.cove, val: value, fmt: "+", note: `replaces Σ ${raw.toFixed(2)} (map 216, cavern 17)` }];
  if (!p.softCap) return [];
  const cut = Math.max(0, Math.round(100 * (1 - value / Math.max(1, raw))));
  return [{ name: MK_RULES.softCap, val: value, fmt: "+", note: `Σ ${raw.toFixed(2)} → ${value.toFixed(3)} · reduced by ~${cut}%` }];
}

const pools: Record<string, SourceSpec[]> = {};
for (const [key, ids] of Object.entries(MK_POOLS)) pools[key] = ids.map((id) => ({ system: "multikill", id }));

const multikillDesc: Descriptor = {
  id: "multikill",
  name: MK_ROOT,
  scope: "character+map",
  category: "progression",
  pools,
  // No ctx: the Observed Max collector calls combine without one
  // (combineStatPools). Everything map-dependent arrives as a source.
  combine(p) {
    const items = (k: string) => p[k]?.items ?? [];
    const base = items("base");
    const perTier = items("perTier");
    const [tier] = items("tier");
    const [soft, cove] = items("rules");
    const parts: MkParts = {
      base: sum(base),
      perTier: sum(perTier),
      tier: num(tier, 1),
      softCap: num(soft, 0) === 1,
      cove: num(cove, 0) === 1 ? { base: num(cove?.children?.[0], 0), perTier: num(cove?.children?.[1], 0) } : null,
    };
    const h = mkHalves(parts);
    const children: ArkhNode[] = [
      { name: MK_NODES.base, val: h.base, fmt: "+", note: "B′", children: [...base, ...ruleRows(parts, parts.base, h.base)] },
      tier ?? { name: MK_NODES.tier, val: 1, fmt: "raw" },
      {
        name: MK_NODES.perTier,
        val: h.perTier,
        fmt: "+",
        note: "P′ (× Damage Tier)",
        children: [...perTier, ...ruleRows(parts, parts.perTier, h.perTier)],
      },
      ...items("status"),
    ];
    return { val: mkTotal(parts), children, note: "⌊B′ + T × P′⌋", fmt: "%" };
  },
};

export default multikillDesc;
```

- [ ] **Step 2: Let `combine` set the root's `fmt`.**

`tree-builder.ts`: extend the node import to `import type { ArkhNode, NodeFmt } from "../node";`; the `Descriptor.combine` return type (AFK Task 2's `{ val: number; children: ArkhNode[]; note?: string }`) becomes `{ val: number; children: ArkhNode[]; note?: string; fmt?: NodeFmt }`; in `buildTree`, `fmt: "x",` becomes `fmt: result.fmt ?? "x",` (keep the comment above it).

`computeStat.ts`: in `combineStatPools`, `fmt: "x"` becomes `fmt: r.fmt ?? "x"`. No other descriptor returns a `fmt`, so DR, Coin, EXP and AFK trees are unchanged.

- [ ] **Step 3: Create** `web/lib/arkh/computeMultikill.ts`:

```ts
// ===== ARKH MULTIKILL ENTRY POINT =====
// mapIdx drives the map terms: the Death Note page (⌊map/50⌋), the W7 soft
// cap and ×5 tier ladder (map ≥ 300), the AFK target (AFKtarget_N on the
// saved map, MapAFKtarget elsewhere — spec M1), Clamworks' HP (306) and the
// Crystal Glunko Cove (216 + cavern 17). See computeStat.ts.

import multikillDesc from "./stats/defs/multikill";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhMultikill(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(multikillDesc, rawEnvelope, charIdx, mapIdx);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhMultikillPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(multikillDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineMultikillPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(multikillDesc, pools);
}
```

- [ ] **Step 4: Write the failing tests.**

`web/__tests__/lib/arkh/multikill.combine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mkSoftCap, mkTotal, MK_NODES, MK_ROOT, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { combineMultikillPools } from "@/lib/arkh/computeMultikill";
import type { ArkhNode } from "@/lib/arkh/node";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const n = (name: string, val: number, children?: ArkhNode[]): ArkhNode => ({ name, val, ...(children ? { children } : {}) });
const pool = (...items: ArkhNode[]): Pool => ({ items, sum: 0, product: 0 });
const pools = (o: { base?: number[]; perTier?: number[]; tier?: number; soft?: boolean; cove?: [number, number] } = {}) => ({
  base: pool(...(o.base ?? [1063.45]).map((v, i) => n(`b${i}`, v))),
  perTier: pool(...(o.perTier ?? [1581.2331135382508]).map((v, i) => n(`p${i}`, v))),
  tier: pool(n(MK_NODES.tier, o.tier ?? 51)),
  rules: pool(
    n(MK_RULES.softCap, o.soft ? 1 : 0),
    n(MK_RULES.cove, o.cove ? 1 : 0, [n("base", o.cove?.[0] ?? 0), n("perTier", o.cove?.[1] ?? 0)])
  ),
  status: pool(n(MK_NODES.active, 1)),
});

describe("mkSoftCap (Shimmerfin Deep)", () => {
  it.each<[number, number]>([
    [0, 0], [19.5, 19.5], [20, 20], [50, 47.3], [100, 80.6], [150, 90.6], [200, 95.6], [250, 98.14], [300, 99.14], [1063.45, 114.409],
  ])("%s → %s", (v, out) => expect(mkSoftCap(v)).toBeCloseTo(out, 9));

  it("the steps at 50, 100 and 250 are under 0.05", () => {
    for (const e of [50, 100, 250]) expect(Math.abs(mkSoftCap(e) - mkSoftCap(e - 1e-9))).toBeLessThan(0.05);
  });
});

describe("mkTotal", () => {
  it("floors B + T × P", () =>
    expect(mkTotal({ base: 1063.45, perTier: 1581.2331135382508, tier: 51, softCap: false, cove: null })).toBe(81706));
  it("the soft cap applies to both halves", () =>
    expect(mkTotal({ base: 1063.45, perTier: 1741.2331135382508, tier: 24, softCap: true, cove: null })).toBe(3185));
  it("the Cove replaces both sums", () =>
    expect(mkTotal({ base: 99999, perTier: 99999, tier: 51, softCap: false, cove: { base: 3800, perTier: 46 } })).toBe(6146));
});

describe("Multikill combine", () => {
  it("builds ⌊B′ + T × P′⌋ with four children and the root in %", () => {
    const { tree, total } = combineMultikillPools(pools({ base: [600, 463.45] }));
    expect(total).toBe(81706);
    expect(tree).toMatchObject({ name: MK_ROOT, fmt: "%", note: "⌊B′ + T × P′⌋" });
    expect(tree.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    expect(tree.children![0]).toMatchObject({ fmt: "+", note: "B′" });
    expect(tree.children![0].val).toBeCloseTo(1063.45, 9);
    expect(tree.children![0].children).toHaveLength(2); // no rule row off W7 and the Cove
  });

  it("appends a soft-cap row to each half on a W7 map", () => {
    const { tree, total } = combineMultikillPools(pools({ perTier: [1741.2331135382508], tier: 24, soft: true }));
    expect(total).toBe(3185);
    const [b, , p] = tree.children!;
    expect(b.val).toBeCloseTo(114.409, 9);
    expect(b.children!.at(-1)).toMatchObject({ name: MK_RULES.softCap });
    expect(p.children!.at(-1)!.note).toMatch(/reduced by ~93%$/);
  });

  it("the Cove row replaces each half's value", () => {
    const { tree, total } = combineMultikillPools(pools({ cove: [3800, 46] }));
    expect(total).toBe(6146);
    expect(tree.children![0]).toMatchObject({ val: 3800 });
    expect(tree.children![0].children!.at(-1)).toMatchObject({ name: MK_RULES.cove, val: 3800 });
    expect(tree.children![2].children!.at(-1)).toMatchObject({ name: MK_RULES.cove, val: 46 });
  });
});
```

`web/__tests__/lib/arkh/multikill.smoke.test.ts`:

```ts
// CI smoke test — no private save. Every Multikill source must resolve on an
// empty envelope (the multikill switch throws on unknown ids), and the map
// rules must work on synthetic saves. Synthetic OLA arrays are sparse on
// purpose: a 0 at OLA[606] would switch companion 0 on (Pet-Bonus Token CSV).
import { describe, it, expect } from "vitest";
import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { MK_NODES, MK_POOLS, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { FORMULA_REGISTRY } from "@/scripts/updater/registry/formula-registry.gen";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const EMPTY = { charNames: ["A"], data: { StarSg: {} } };

describe("Multikill smoke test", () => {
  it("resolves every source on an empty save: 4 children, 9 and 18 sources, total 0", () => {
    const { tree, total } = computeArkhMultikill(EMPTY, 0, 14);
    expect(total).toBe(0);
    expect(tree.fmt).toBe("%");
    expect(tree.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    expect(tree.children![0].children).toHaveLength(MK_POOLS.base.length);
    expect(tree.children![2].children).toHaveLength(MK_POOLS.perTier.length);
  });

  it("a W7 map adds the soft-cap row to both halves and names the tier by its ×5 ladder", () => {
    const t = computeArkhMultikill(EMPTY, 0, 301).tree;
    expect(t.children![0].children!.at(-1)!.name).toBe(MK_RULES.softCap);
    expect(t.children![2].children!.at(-1)!.name).toBe(MK_RULES.softCap);
    expect(t.children![1].name).toBe(MK_NODES.tierW7);
    expect(t.children![1].children!.find((c) => c.name === "Exponent")!.val).toBe(5);
  });

  it("Clamworks (map 306) measures against Clamz_HP = 1e16·30^OLA[464]", () => {
    const ola: number[] = [];
    ola[464] = 8;
    const t = computeArkhMultikill({ charNames: ["A"], data: { StarSg: {}, OptLacc: ola } }, 0, 306).tree;
    expect(t.children![1].children!.find((c) => c.name === "Target HP")!.val).toBe(1e16 * Math.pow(30, 8));
  });

  it("the Crystal Glunko Cove (map 216, cavern 17) replaces both sums", () => {
    const ola: number[] = [];
    ola[645] = 38; // Cglunko_upgBon(15) = OLA[645]·RandoListo2[13][15] (100)
    ola[636] = 46; // Cglunko_upgBon(6)  = OLA[636]·RandoListo2[13][6]  (1)
    const cove = (cavern: number) => ({ charNames: ["A"], data: { StarSg: {}, OptLacc: ola, Holes: [[cavern]], CurrentMap_0: 216 } });
    const t = computeArkhMultikill(cove(17), 0, 216).tree;
    expect(t.children![0]).toMatchObject({ val: 3800 });
    expect(t.children![2]).toMatchObject({ val: 46 });
    expect(t.children![0].children!.at(-1)!.name).toBe(MK_RULES.cove);
    expect(t.val).toBe(Math.floor(3800 + Number(t.children![1].val) * 46));
    // Another cavern: the plain sums (0 on this save) and no rule row.
    const off = computeArkhMultikill(cove(3), 0, 216).tree;
    expect(off.val).toBe(0);
    expect(off.children![0].children).toHaveLength(MK_POOLS.base.length);
  });

  it("registers the port under N.js's names for the updater", () => {
    expect(FORMULA_REGISTRY["MultiKillTOTAL"]).toEqual(["lib/arkh/stats/defs/multikill.ts"]);
    expect(FORMULA_REGISTRY["MultiKill_perTier"]).toEqual([
      "lib/arkh/stats/defs/multikill.ts",
      "lib/arkh/stats/systems/multikill/multikill.ts",
    ]);
  });
});
```

`web/__tests__/lib/arkh/multikill.save.test.ts`. `close` and `srcIn` sit at module level because Tasks 4–6 add more `describe`s:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { MK_NODES, MK_POOLS } from "@/lib/arkh/stats/defs/multikill";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getMultiKillBase / getMultiKillPerTier
// on this exact file (SP/mk/it-mk.mts), term by term via SP/mk/arkh-mk.mts,
// unless a comment says N.js ≠ IT (spec M8).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

const close = (actual: number, expected: number) => {
  if (expected === 0) expect(actual).toBe(0);
  else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
};

/** A source's value by pool position (root children: base, tier, per tier, status). */
const srcIn = (tree: ArkhNode, id: string): number => {
  const kids = tree.children!;
  if (MK_POOLS.base.includes(id)) return Number(kids[0].children![MK_POOLS.base.indexOf(id)].val);
  if (MK_POOLS.perTier.includes(id)) return Number(kids[2].children![MK_POOLS.perTier.indexOf(id)].val);
  if (id === "tier") return Number(kids[1].val);
  if (id === "active") return Number(kids[3].val);
  throw new Error(`not a source: ${id}`);
};

describe.skipIf(!existsSync(SAVE))("Multikill — Markhe on map 14 vs IdleonToolbox", () => {
  let save: any;
  let tree: ArkhNode;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    tree = computeArkhMultikill(save, save.charNames.indexOf("Markhe"), 14).tree;
  });
  const src = (id: string) => srcIn(tree, id);

  it("has the four root children; the tier's note names the map and target", () => {
    expect(tree.children!.map((c) => c.name)).toEqual([MK_NODES.base, MK_NODES.tier, MK_NODES.perTier, MK_NODES.active]);
    expect(tree.children![0].children).toHaveLength(MK_POOLS.base.length); // no rule row on map 14
    expect(tree.children![1].note).toBe("Map 14 · beanG"); // tier 51: no "estimate" (M17)
  });

  it.each<[string, number]>([
    // Base Multikill
    ["stampC19", 166], // StampC19 is the only "Overkill" stamp
    ["deathNoteBuilding", 102], // TowerInfo[2] = 51, ×2
    ["etc29", 30.450000000000003],
    ["ach148", 1],
    ["ach122", 6],
    ["ach123", 2],
    ["talent654", 576], // MONOLITHIALISM × onyx statues
    // Multikill per Tier
    ["vialOverkill", 101.92],
    ["talent58", 265.7718120805369], // account-wide × ⌊OLA[158]/5⌋
    ["arcade8", 20.09950248756219],
    ["artifact26", 150], // Trilobite Rock
    ["chipMkill", 0], // no Wood Chip in slots [9,20,21,15,16,17,18]
    ["etc71", 195.16191214168592],
    ["card80", 0],
    ["prayer16", 0], // Balance of Pain isn't equipped (12,1,3,5,14)
    ["shiny4", 80],
    ["box13b", 9.782608695652174],
    // No Multikill card set equipped. IT keys this set as "CardSet9", N.js as
    // "{%_Multikill_Per_Tier" — probably the same, unconfirmed (spec risk 4).
    ["cardSet11", 0],
    // Tier and status
    ["tier", 51],
    ["active", 1],
  ])("%s", (id, expected) => close(src(id), expected));
});
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/multikill.combine.test.ts __tests__/lib/arkh/multikill.smoke.test.ts __tests__/lib/arkh/multikill.save.test.ts`
Expected: the combine test already passes (it only needs Steps 1–3); the smoke and save tests FAIL. The `multikill` system is missing, so every item reads `[multikill] not implemented` (wrong names, values and tier), and the registry has no `MultiKillTOTAL` key.

- [ ] **Step 6: Create the system** `web/lib/arkh/stats/systems/multikill/multikill.ts`. Here is the full file. The terms Tasks 4–5 port are `pending` cases, so the switch never throws on a known id:

```ts
// ===== MULTIKILL SYSTEM =====
// One id per term of N.js WorkbenchStuff("MultiKill_base") (@7754109) and
// ("MultiKill_perTier") (@7751511) — % amounts the two sums add — plus the
// formula's other inputs: the damage tier (OverkillStuffs "2"), the two map
// rules and the activation flag (OverkillStuffs "3", a status row only —
// spec M2). defs/multikill.ts owns the shape ⌊B′ + T × P′⌋. Existing helpers
// are called as they are; the new ports live next to their siblings
// (common/overkill.ts, coin/gambit.ts, common/buffs.ts, exp/saltLick.ts).

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData } from "../../../save/data";
import { label } from "../../entity-names";
import { RandoListo2 } from "../../data/game/customlists.js";
import { MK_NODES, MK_RULES } from "../../defs/multikill";
import { talent } from "../common/talent";
import { etcBonus } from "../common/etcBonus";
import { achieveStatus } from "../common/achievement";
import { computeBoxReward, computeCardBonusByType } from "../common/stats";
import { computeCardSetBonus } from "../common/cards";
import { overkillActive, overkillStuffs } from "../common/overkill";
import { computeStampBonusOfTypeX } from "../w1/stamp";
import { computeVialByKey } from "../w2/alchemy";
import { arcadeBonus } from "../w2/arcade";
import { prayersReal } from "../w3/prayer";
import { chipBonuses } from "../w4/lab";
import { computeShinyBonusS } from "../w4/breeding";
import { computeArtifactBonus } from "../w5/sailing";

/** Class talents of the formula (per-character buffs) — spec M16. 654 is a
 *  star talent (every class) and 58 is account-wide, so neither is gated. */
export const MK_CLASS_TALENTS = [46, 469] as const;

const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });
const factor = (name: string, v: number, children?: ArkhNode[] | null): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x" });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
/** Terms ported in a later task of the Multikill plan; neutral in Σ until then. */
const pending = (name: string, neutral: number): ArkhNode =>
  node(name, neutral, null, { fmt: "+", note: "pending port" });

// @njs MultiKill_base
// @njs MultiKill_perTier
function resolveMultikill(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const map = ctx.mapIdx ?? (Number((currentMapData as any)?.[ci]) || 0);

  switch (id) {
    // ── Base Multikill (N.js order) ──
    case "sign47":
      return pending("Star signs (Multikill)", 0);
    case "saltLick8":
      return pending("Salt Lick 8 (Multikill)", 0);
    // N.js StampBonusOfTypeX("Overkill") — only StampC19 has that type.
    case "stampC19": {
      const r = computeStampBonusOfTypeX("Overkill", s);
      return pct("Stamps (Overkill)", r.val, r.children);
    }
    // N.js 2*TowerInfo[2]: the Death Note building's level ×2.
    case "deathNoteBuilding": {
      const lv = Number((s.towerData as any)?.[2]) || 0;
      return pct("Death Note building ×2", 2 * lv, [raw("Building level (TowerInfo[2])", lv)]);
    }
    // N.js EtcBonuses("29") / ("71") — numeric ids (a string id drops gallery items).
    case "etc29":
    case "etc71": {
      const n = Number(id.slice(3));
      const e = etcBonus.resolve(n, { saveData: s, charIdx: ci });
      return pct(n === 29 ? "Multikill gear (Etc 29)" : "Multikill per tier gear (Etc 71)", Number(e.val) || 0, e.children);
    }
    // N.js Math.min(5, AchieveStatus(148)) + 6*AchieveStatus(122) + 2*AchieveStatus(123).
    case "ach148":
      return pct(label("Achievement", 148), Math.min(5, achieveStatus(148, s)));
    case "ach122":
    case "ach123": {
      const n = Number(id.slice(3));
      const w = n === 122 ? 6 : 2;
      return pct(`${label("Achievement", n)} × ${w}`, w * achieveStatus(n, s));
    }
    // N.js StatueOnyxOwned*GetTalentNumber(1,654) (star talent) and
    // getbonus2(1,58,-1)*⌊OLA[158]/5⌋ (account-wide): talent.resolve applies
    // both wraps already. The label keeps "(Talent n)".
    case "talent654":
    case "talent58": {
      const n = Number(id.slice(6));
      const t = talent.resolve(n, tctx);
      return pct(label("Talent", n), Number(t.val) || 0, t.children);
    }

    // ── Multikill per Tier (N.js order) ──
    case "deathNoteWorld":
      return pending(`Death Note (W${Math.floor(map / 50) + 1} page)`, 0);
    case "deathNoteMini":
      return pending("Death Note (minibosses)", 0);
    // N.js AlchVials.Overkill.
    case "vialOverkill": {
      const r = computeVialByKey("Overkill", s);
      return pct("Vials (Overkill)", r.val, r.children);
    }
    case "buff46":
      return pending(label("Talent", 46), 0);
    // N.js ArcadeBonus(8).
    case "arcade8": {
      const r = arcadeBonus(8, s);
      return pct(label("Arcade", 8), r.val, r.children);
    }
    // N.js Sailing("ArtifactBonus",26,0): Trilobite Rock, 25 × its tier.
    case "artifact26":
      return pct("Trilobite Rock (Artifact 26)", computeArtifactBonus(26, ci, { saveData: s, charIdx: ci } as any));
    case "buff469":
      return pending(label("Talent", 469), 0);
    // N.js chipBonuses("mkill"): the active character's lab chips (Wood Chip, 15).
    case "chipMkill":
      return pct("Lab chip (mkill)", chipBonuses("mkill", ci));
    case "meas9":
      return pending("Measurement 9 (Multikill per tier)", 0);
    // N.js CardBonusREAL(80).
    case "card80": {
      const r = computeCardBonusByType(80, ci, s);
      return pct("Cards (Card Type 80)", r.val, r.children);
    }
    case "sign78":
      return pending("Star signs (Multikill per tier)", 0);
    // N.js prayersReal(16,0): Balance of Pain, super-bit branch included.
    case "prayer16": {
      const r = prayersReal(16, 0, ci, s);
      return pct(label("Prayer", 16), r.val, r.children);
    }
    // N.js Breeding("ShinyBonusS","Nah",4,-1).
    case "shiny4":
      return pct("Shiny Pets (Breeding 4)", computeShinyBonusS(4, s));
    // N.js BoxRewards["13b"] (Utilitarian Capsule).
    case "box13b": {
      const r = computeBoxReward(ci, "13b");
      return pct("Post Office 13b", r.val, r.children);
    }
    case "bubbleMKtier":
      return pending("MR_MASSACRE bubble (MKtierACTIVE)", 0);
    // N.js CardSetBonuses(0,"11") = Cards[3]["{%_Multikill_Per_Tier"].
    case "cardSet11": {
      const r = computeCardSetBonus(ci, "11");
      return pct("Card Set 11 (Multikill per tier)", r.val, r.children);
    }

    // ── Damage tier, map rules, status ──
    // N.js OverkillStuffs("2") against the target's live HP (common/overkill.ts,
    // spec M1/M5). Named by ladder: the ×5 W7 tier never meets the map-251
    // reference (M12). "estimate" below the cap: arkh's max damage isn't
    // reconciled with the game yet (M4, M17).
    case "tier": {
      const ok = overkillStuffs(ci, map, ctx);
      const hpKids = ok.clam
        ? [raw("Clamworks HP (1e16 × 30^OLA[464])", ok.staticHp)]
        : [
            raw("Static HP", ok.staticHp),
            factor("Prayer curses", ok.curse, [
              raw(`Curse: ${label("Prayer", 0)}`, ok.curses[0]),
              raw(`Curse: ${label("Prayer", 7)}`, ok.curses[1]),
              raw(`Curse: ${label("Prayer", 8)}`, ok.curses[2]),
            ]),
          ];
      const note = `${ok.tier < 51 ? "estimate — max damage isn't reconciled with the game yet · " : ""}Map ${ok.map} · ${ok.target}`;
      return node(
        ok.exponent === 5 ? MK_NODES.tierW7 : MK_NODES.tier,
        ok.tier,
        [
          raw("Max Damage", ok.maxDmg),
          node("Target HP", ok.hp, hpKids, { fmt: "raw" }),
          raw("Exponent", ok.exponent),
          raw("Tier reached at", ok.tierAt),
          raw("Next tier at", ok.nextAt),
        ],
        { fmt: "raw", note }
      );
    }
    // N.js MultiKill_base / _perTier on maps ≥ 300: the Shimmerfin Deep soft
    // cap on both sums (combine applies mkSoftCap; the per-tier bypass
    // e = 8675309 only feeds the W7 notice).
    case "softCap":
      return node(MK_RULES.softCap, map >= 300 ? 1 : 0, null, {
        fmt: "raw",
        note: map >= 300 ? "Shimmerfin Deep (map ≥ 300)" : `map ${map}: no soft cap`,
      });
    // N.js 216==CurrentMap && 17==Holes[0][me] → each sum is REPLACED by
    // Holes2("Cglunko_MKbase") = Cglunko_upgBon(15) and ("Cglunko_MKtier") =
    // Cglunko_upgBon(6), Cglunko_upgBon(b) = OLA[630+b]·RandoListo2[13][b]
    // (@10969437). combine reads the first two children (×100 and ×1).
    // @njs _customBlock_Holes2
    case "cove": {
      const cavern = Number((s.holesData as any)?.[0]?.[ci]);
      const on = map === 216 && cavern === 17;
      const upg = (b: number) => ola(630 + b) * (Number((RandoListo2 as any)[13]?.[b]) || 0);
      return node(
        MK_RULES.cove,
        on ? 1 : 0,
        [raw("Cglunko MK base (upgrade 15)", upg(15)), raw("Cglunko MK per tier (upgrade 6)", upg(6)), raw("Cavern (Holes[0][char])", cavern)],
        { fmt: "raw", note: on ? "replaces both sums" : "inactive: not map 216 in cavern 17" }
      );
    }
    // N.js OverkillStuffs("3"). The headline never uses it (spec M2): the game
    // applies the multikill only when it's 1, and prints the AFK Info line
    // only for a FIGHTING target (@3835457).
    case "active": {
      const ok = overkillStuffs(ci, map, ctx);
      const a = overkillActive(ok, ci, s);
      const note = !a.active
        ? "inactive: the game applies no multikill"
        : a.type === "FIGHTING"
          ? "the AFK Info shows the MULTIKILL line"
          : `the AFK Info hides the MULTIKILL line (${ok.target} is ${a.type})`;
      return node(
        MK_NODES.active,
        a.active ? 1 : 0,
        [
          raw("Max damage ≥ HP × E", a.maxOk ? 1 : 0),
          raw("Death Note built (TowerInfo[2] > 0.5)", a.deathNote ? 1 : 0),
          node("Accuracy > 1.5 × Defence", a.accOk ? 1 : 0, [raw("Accuracy", a.accuracy), raw("Target Defence", a.defence)], { fmt: "raw" }),
        ],
        { fmt: "raw", note }
      );
    }

    default:
      throw new Error(`multikill: unknown source "${id}"`);
  }
}

export const multikill = { resolve: resolveMultikill };
```

- [ ] **Step 7: Register it.** `lib/arkh/stats/registry.ts`: add `import { multikill } from "./systems/multikill/multikill";` and `multikill: multikill as unknown as SystemResolver,` after the `afk` entry. Regenerate: `npx tsx scripts/updater/registry/gen-registry.ts` (new keys `MultiKillTOTAL`, `MultiKill_base`, `MultiKill_perTier`; `_customBlock_Holes2` gains the system file).

- [ ] **Step 8: Run the tests.** Fix values by re-reading N.js, not by editing expectations. An expectation may change only with a `// N.js ≠ IT:` comment that cites the N.js offset.

Run: `npx vitest run __tests__/lib/arkh/multikill.combine.test.ts __tests__/lib/arkh/multikill.smoke.test.ts __tests__/lib/arkh/multikill.save.test.ts __tests__/updater/registry.guard.test.ts __tests__/lib/arkh/grouped.test.ts __tests__/lib/arkh/afk-gains.combine.test.ts __tests__/lib/arkh/family-guy-dr.test.ts __tests__/lib/arkh/coin-multi.save.test.ts`
Expected: PASS (other roots still read `fmt: "x"`). Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 9: Commit**

```bash
git add lib/arkh/stats/defs/multikill.ts lib/arkh/stats/systems/multikill/multikill.ts lib/arkh/computeMultikill.ts lib/arkh/stats/tree-builder.ts lib/arkh/computeStat.ts lib/arkh/stats/registry.ts scripts/updater/registry/formula-registry.gen.ts __tests__/lib/arkh/multikill.combine.test.ts __tests__/lib/arkh/multikill.smoke.test.ts __tests__/lib/arkh/multikill.save.test.ts
git commit -m "feat(arkh): Multikill descriptor, system and entry point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Death Note pages, minibosses, Measurement 9 and Salt Lick 8

**Files:**
- Modify: `web/lib/arkh/stats/systems/coin/gambit.ts` (miniboss rank table, `overkillQTY`, `measurementBonusTotal`)
- Modify or create: `web/lib/arkh/stats/systems/exp/saltLick.ts` (generic `saltLick`; see Step 1), plus `web/lib/arkh/stats/systems/exp/exp.ts` only in case (c)
- Modify: `web/lib/arkh/stats/systems/multikill/multikill.ts` (cases `saltLick8`, `deathNoteWorld`, `deathNoteMini`, `meas9`)
- Modify: `web/scripts/updater/registry/formula-registry.gen.ts` (regenerated)
- Test: `web/__tests__/lib/arkh/multikill-ports.test.ts` (new, synthetic only), `web/__tests__/lib/arkh/multikill.save.test.ts` (append)

**Interfaces:**
- Consumes: Task 3's `resolveMultikill`, `pct`, `raw`, `pending`; `accountMapKills`; `cosmoBonus`; `getLOG`; EXP's Salt Lick port.
- Produces:
  - `overkillQTY(w: number, s: SaveData): number` and `measurementBonusTotal(i: number, s: SaveData): number`, exported from `systems/coin/gambit.ts`. `deathNoteSkulls(s)` becomes Σ `overkillQTY(0..6)`, and `gambitPtsMulti` reads `measurementBonusTotal(13, s)`; Coin's numbers don't move;
  - `saltLick(i: number, s: SaveData): number`, exported from `systems/exp/saltLick.ts` (EXP's number doesn't move).

- [ ] **Step 1: Settle the Salt Lick port** (EXP Task 4 wrote it; its final export wasn't known when this plan was written). Read `lib/arkh/stats/systems/exp/saltLick.ts` and `grep -n "saltLick\|SaltLick" lib/arkh/stats/systems/exp/exp.ts`. Then:
  - **(a)** it exports a function that takes the index (`(i: number, s) => number`, any name): use it as is. Below, `saltLick` means that name; import it under that name.
  - **(b)** it only serves index 3 (for example `saltLick3(s)`, or a literal 3 inside): replace its body with the generic function below and keep the old export as a one-line wrapper (`export const saltLick3 = (s: SaveData): number => saltLick(3, s);`), so `exp.ts` needs no edit.
  - **(c)** there's no port file (EXP inlined it in `exp.ts`): create `lib/arkh/stats/systems/exp/saltLick.ts` with the function below, and make EXP's `saltLick3` case call `saltLick(3, s)` with the same node name and `fmt`.

In cases (b) and (c), the generic function is:

```ts
import { SaltLicks } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

/** N.js SaltLick(i) (@7774631): lv > 0 ? lv·SaltLicks[i][3] : 0, lv = the
 *  save's SaltLick[i]. EXP reads index 3 (0.2/level), Multikill index 8 (3/level). */
// @njs _customBlock_SaltLick
export function saltLick(i: number, s: SaveData): number {
  const lv = Number((s.saltLickData as any)?.[i]) || 0;
  return lv > 0 ? lv * (Number((SaltLicks as any)[i]?.[3]) || 0) : 0;
}
```

In every case, `__tests__/lib/arkh/exp-multi.save.test.ts` must stay green unedited.

- [ ] **Step 2: Write the failing tests.** `web/__tests__/lib/arkh/multikill-ports.test.ts` (fix the `saltLick` import if Step 1 landed on case (a) with another name):

```ts
// Synthetic saves for the Multikill ports (spec M6). This file never loads a
// real save: the arkh state is a singleton and loadSaveData doesn't reset
// every field, so each envelope spells out what it relies on.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { overkillQTY } from "@/lib/arkh/stats/systems/coin/gambit";
import { saltLick } from "@/lib/arkh/stats/systems/exp/saltLick";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("overkillQTY — the Death Note pages", () => {
  it("7 = the minibosses: table 7842 over the first 10 Ninja[105] entries (NinjaInfo[30])", () => {
    const ninja: unknown[] = [];
    ninja[105] = [99, 100, 250, 1e3, 5e3, 25e3, 1e5, 1e6, 0, 0, 1e9, 1e9];
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Ninja: ninja } });
    expect(overkillQTY(7, saveData)).toBe(0 + 1 + 2 + 3 + 4 + 5 + 7 + 10);
  });

  it("a world page without kills is 0", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {} } });
    expect(overkillQTY(0, saveData)).toBe(0);
  });
});

describe("saltLick(i) — N.js SaltLick", () => {
  it("is the level × SaltLicks[i][3]", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, SaltLick: [0, 0, 0, 5, 0, 0, 0, 0, 7] } });
    expect(saltLick(8, saveData)).toBe(21); // 3 per level
    expect(saltLick(3, saveData)).toBeCloseTo(1, 12); // .2 per level (EXP's term)
    expect(saltLick(0, saveData)).toBe(0);
  });
});
```

Append to `multikill.save.test.ts`: add `import { loadSaveData } from "@/lib/arkh/save/loader";`, `import { saveData } from "@/lib/arkh/state";` and `import { deathNoteSkulls, overkillQTY } from "@/lib/arkh/stats/systems/coin/gambit";` to the imports, then inside the Markhe `describe`:

```ts
  it.each<[string, number]>([
    ["saltLick8", 30], // SaltLick[8] = 10, 3 per level
    ["deathNoteWorld", 300], // map 14 → the W1 page (15 mobs at 20)
    ["deathNoteMini", 58],
    ["meas9", 281.3841523937517], // Holes[22][9] = 465 ("40TOT") × the Gloomie multi (log10 1.35e14)
  ])("%s", (id, expected) => close(src(id), expected));

  it("names the Death Note row by its world (spec M11)", () => {
    expect(tree.children![2].children![0].name).toBe("Death Note (W1 page)");
  });

  it("Death Note pages W1–W7 and the minibosses", () => {
    loadSaveData(save);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((w) => overkillQTY(w, saveData))).toEqual([300, 220, 280, 260, 260, 280, 460, 58]);
    expect(deathNoteSkulls(saveData)).toBe(2060); // Σ W1–W7: Coin's Measurement 13 input
  });
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/multikill-ports.test.ts __tests__/lib/arkh/multikill.save.test.ts`
Expected: FAIL. `overkillQTY` isn't exported (and, in cases b/c, `saltLick` isn't either); the four terms read 0 (pending).

- [ ] **Step 4: Implement the gambit ports.** In `systems/coin/gambit.ts`:
  - the two description lines under `// ===== GAMBIT (coin) =====` become `// Port of N.js Holes("GambitBonuses", b) and its point pipeline, the Death` and `// Note pages (WorkbenchStuff OverkillQTY) and Measurements 9 and 13.`;
  - extend the customlists import to `import { HolesInfo, DeathNoteMobs, MapAFKtarget, NinjaInfo } from "../../data/game/customlists.js";`;
  - replace `deathNoteRank`, `deathNoteSkulls` and `measurement13` with:

```ts
// @njs DeathNoteRank
/** N.js WorkbenchStuff("DeathNoteRank", kills, e): one mob's skull value;
 *  e = 7842 is the miniboss table. */
function deathNoteRank(kills: number, s: SaveData, mini = false): number {
  if (mini) {
    if (kills < 100) return 0;
    if (kills < 250) return 1;
    if (kills < 1e3) return 2;
    if (kills < 5e3) return 3;
    if (kills < 25e3) return 4;
    if (kills < 1e5) return 5;
    return kills < 1e6 ? 7 : 10;
  }
  if (kills < 25e3) return 0;
  if (kills < 1e5) return 1;
  if (kills < 2.5e5) return 2;
  if (kills < 5e5) return 3;
  if (kills < 1e6) return 4;
  if (kills < 5e6) return 5;
  if (kills < 1e8) return 7;
  // RiftStuff("riftBonus", 3) = Rift[0] >= 5·(3 + 1).
  return kills > 1e9 && (Number((s.riftData as any[])?.[0]) || 0) >= 20 ? 20 : 10;
}

// @njs OverkillQTY
/** N.js WorkbenchStuff("OverkillQTY", w) (@7756378): the Death Note page of
 *  world w (0–6: Σ rank of every DeathNoteMobs[w] mob over the account's kills
 *  on its map) or, for w = 7, the minibosses (Σ rank of Ninja[105][i] for the
 *  NinjaInfo[30] bosses, table 7842). */
export function overkillQTY(w: number, s: SaveData): number {
  if (w === 7) {
    const kills = ((s.ninjaData as any[]) ?? [])[105] ?? [];
    const bosses = ((NinjaInfo as unknown as unknown[][])[30] ?? []).length;
    let t = 0;
    for (let i = 0; i < bosses; i++) t += deathNoteRank(Number(kills[i]) || 0, s, true);
    return t;
  }
  const mapOf = MapAFKtarget as unknown as string[];
  let t = 0;
  for (const mob of (DeathNoteMobs as unknown as string[][])[w] ?? []) {
    const m = mapOf.indexOf(mob);
    t += deathNoteRank(m >= 0 ? accountMapKills(m) : 0, s);
  }
  return t;
}

/** Σ OverkillQTY(0..6): the Death Note skulls MeasurementQTYfound(6) counts
 *  (no minibosses). */
export function deathNoteSkulls(s: SaveData): number {
  let n = 0;
  for (let w = 0; w < 7; w++) n += overkillQTY(w, s);
  return n;
}

// @njs MeasurementBaseBonus
/** N.js Holes("MeasurementBaseBonus", i) (@10914899): (1 + Cosmo(1,3)/100) ×
 *  (HolesInfo[55][i] has "TOT" ? n·lv/(100 + lv) : n·lv), lv = Holes[22][i]. */
function measurementBase(i: number, s: SaveData): number {
  const lv = H(s, 22, i);
  const raw = info(55, i);
  const cosmo = 1 + cosmoBonus(s, 1, 3) / 100;
  return raw.includes("TOT")
    ? cosmo * ((Number(raw.replace("TOT", "")) * lv) / (100 + lv))
    : cosmo * Number(raw) * lv;
}

// @njs MeasurementMulti
/** N.js Holes("MeasurementMulti", type) (@10918723), q = MeasurementQTYfound(type, 99):
 *  1 + 18q/100, or 1 + (18q + 8(q − 5))/100 from q = 5. Ported types: 0 =
 *  log10 of the Gloomie kills (Holes[11][28]), 6 = the Death Note skulls / 125.
 *  ponytail: any other type reads q = 0 (×1) — port it before reading that measurement. */
function measurementMulti(type: number, s: SaveData): number {
  const q = type === 0 ? getLOG(H(s, 11, 28)) : type === 6 ? deathNoteSkulls(s) / 125 : 0;
  return q < 5 ? 1 + (18 * q) / 100 : 1 + (18 * q + 8 * (q - 5)) / 100;
}

// @njs MeasurementBonusTOTAL
/** N.js Holes("MeasurementBonusTOTAL", i) (@10918979) = MeasurementBaseBonus(i)
 *  × MeasurementMulti(HolesInfo[52][i]). Gambit reads 13 (type 6), Multikill
 *  reads 9 (type 0). */
export function measurementBonusTotal(i: number, s: SaveData): number {
  return measurementBase(i, s) * measurementMulti(Number(info(52, i)), s);
}
```

  - in `gambitPtsMulti`, `measurement13(s)` becomes `measurementBonusTotal(13, s)`.

- [ ] **Step 5: Wire the four cases.** In `systems/multikill/multikill.ts` add `import { measurementBonusTotal, overkillQTY } from "../coin/gambit";` and `import { saltLick } from "../exp/saltLick";`, then replace the four pending cases:

```ts
    // N.js SaltLick(8): the level × SaltLicks[8][3] (3 per level, max 10).
    case "saltLick8": {
      const lv = Number((s.saltLickData as any)?.[8]) || 0;
      return pct("Salt Lick 8 (Multikill)", saltLick(8, s), [raw("Level (SaltLick[8])", lv)]);
    }
```

```ts
    // N.js OverkillQTY(⌊CurrentMap/50⌋): the Death Note page of the map's
    // world. The name carries the world, so Biggest Gains and Compare only
    // meet the map-251 reference (W6) on a W6 map (spec M11).
    case "deathNoteWorld": {
      const w = Math.floor(map / 50);
      return pct(`Death Note (W${w + 1} page)`, overkillQTY(w, s));
    }
    // N.js OverkillQTY(7): the 10 minibosses (table 7842 over Ninja[105]).
    case "deathNoteMini":
      return pct("Death Note (minibosses)", overkillQTY(7, s));
```

```ts
    // N.js Holes("MeasurementBonusTOTAL",9,0): the "40TOT" base × the
    // Gloomie-kills multi (type 0).
    case "meas9":
      return pct("Measurement 9 (Multikill per tier)", measurementBonusTotal(9, s));
```

Regenerate the registry: `npx tsx scripts/updater/registry/gen-registry.ts`.

- [ ] **Step 6: Run.** `npx vitest run __tests__/lib/arkh/multikill-ports.test.ts __tests__/lib/arkh/multikill.save.test.ts __tests__/lib/arkh/multikill.smoke.test.ts __tests__/lib/arkh/coin-multi.save.test.ts __tests__/lib/arkh/exp-multi.save.test.ts __tests__/updater/registry.guard.test.ts` must PASS: Coin's `gambit7` stays 74.03532772764761 and Markhe 6.88E35; EXP's Salt Lick value is unchanged. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 7: Commit** (add `lib/arkh/stats/systems/exp/exp.ts` only in case (c); skip `saltLick.ts` in case (a))

```bash
git add lib/arkh/stats/systems/coin/gambit.ts lib/arkh/stats/systems/exp/saltLick.ts lib/arkh/stats/systems/multikill/multikill.ts scripts/updater/registry/formula-registry.gen.ts __tests__/lib/arkh/multikill-ports.test.ts __tests__/lib/arkh/multikill.save.test.ts
git commit -m "feat(arkh): Death Note pages, Measurement 9 and Salt Lick 8 for Multikill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Star signs 47/78, buffs 46/469, MR_MASSACRE — the tree is complete

**Files:**
- Modify: `web/lib/arkh/stats/systems/common/starSign.ts` (two `STAR_SIGN_TERMS` keys)
- Create: `web/lib/arkh/stats/systems/common/buffs.ts`
- Modify: `web/lib/arkh/stats/systems/multikill/multikill.ts` (cases `sign47`, `sign78`, `buff46`, `buff469`, `bubbleMKtier`; delete `pending`)
- Modify: `web/scripts/updater/registry/formula-registry.gen.ts` (regenerated)
- Test: `web/__tests__/lib/arkh/multikill-ports.test.ts` (append), `web/__tests__/lib/arkh/multikill.save.test.ts` (append)

**Interfaces:**
- Consumes: Tasks 3–4; `starSignBonusReal` (AFK Task 3); `talent.resolve`; `bubbleValByKey`; `companions`.
- Produces:
  - `STAR_SIGN_TERMS.MultiKill` (sign 47 +15) and `STAR_SIGN_TERMS["78"]` (sign 78 +3);
  - `getBuffBonuses(c: number, b: number, ci: number, s: SaveData): number`, from `systems/common/buffs.ts`;
  - a complete Multikill tree: no `"pending port"` note left; Markhe 81706.

- [ ] **Step 1: Write the failing tests.** Append to `multikill-ports.test.ts`, adding `import { getBuffBonuses } from "@/lib/arkh/stats/systems/common/buffs";`, `import { starSignBonusReal } from "@/lib/arkh/stats/systems/common/starSign";`, `import { computeArkhMultikill } from "@/lib/arkh/computeMultikill";` and `import { MK_POOLS } from "@/lib/arkh/stats/defs/multikill";` to the imports:

```ts
describe("starSignBonusReal — the Multikill keys", () => {
  it("sign 47 gives 15 and sign 78 gives 3 when equipped; nothing otherwise", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, PVtStarSign_0: "47,78", Lv0_0: [100] } });
    expect(starSignBonusReal("MultiKill", 0, saveData).val).toBe(15);
    expect(starSignBonusReal("78", 0, saveData).val).toBe(3);
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, PVtStarSign_0: "12", Lv0_0: [100] } });
    expect(starSignBonusReal("MultiKill", 0, saveData).val).toBe(0);
  });
});

describe("getBuffBonuses — N.js GetBuffBonuses", () => {
  // Talent 469's y is decay(40, 100) at lv 10 = 3.6363…; talent 46's y is
  // bigBase(400, 5) = 450; talent 45's x is 165 (> 0).
  const load = (cls: number, buffs: number[]) =>
    loadSaveData({
      charNames: ["A"],
      data: { StarSg: {}, CharacterClass_0: cls, BuffsActive_0: buffs.map((b) => [b, 100, 100]), SL_0: { 45: 10, 46: 10, 469: 10 } },
    });

  it("is the talent's second bonus while its buff is active, else 0", () => {
    load(32, []);
    expect(getBuffBonuses(469, 2, 0, saveData)).toBe(0);
    load(32, [469]);
    expect(getBuffBonuses(469, 2, 0, saveData)).toBeCloseTo(40 * 10 / 110, 12);
  });

  it("Void Radius (46) also needs class 4 or 5 and an active buff 45", () => {
    load(4, [46]);
    expect(getBuffBonuses(46, 2, 0, saveData)).toBe(0);
    load(7, [45, 46]);
    expect(getBuffBonuses(46, 2, 0, saveData)).toBe(0);
    load(4, [45, 46]);
    expect(getBuffBonuses(46, 2, 0, saveData)).toBe(450);
  });

  it("buff 615 reads 1", () => {
    load(1, [615]);
    expect(getBuffBonuses(615, 1, 0, saveData)).toBe(1);
  });
});

describe("MR_MASSACRE gate (AlchBubbles.MKtierACTIVE)", () => {
  const lv = Array(16).fill(0);
  lv[15] = 100; // CauldronInfo[3][15]: MR_MASSACRE
  const bubble = (equipped: string[]) => {
    const t = computeArkhMultikill(
      { charNames: ["A"], data: { StarSg: {}, CauldronInfo: [[], [], [], lv], CauldronBubbles: [equipped] } },
      0,
      14
    ).tree;
    return Number(t.children![2].children![MK_POOLS.perTier.indexOf("bubbleMKtier")].val);
  };

  it('needs "c15" equipped without Sheepie (cauldron letters _ a b c)', () => {
    expect(bubble(["c15"])).toBeGreaterThan(0);
    expect(bubble(["d15"])).toBe(0);
    expect(bubble([])).toBe(0);
  });
});
```

Append inside the Markhe `describe` of `multikill.save.test.ts`:

```ts
  it.each<[string, number]>([
    ["sign47", 150], // Cullingo 15 × Seraph 10 (245 enabled signs: the unlocked range counts)
    ["sign78", 30], // Killian Maximus 3 × Seraph 10
    ["buff46", 0], // no Void Radius buff (BuffsActive_8 = 94, 168, 167)
    ["buff469", 0],
    ["bubbleMKtier", 89.11312573906189], // Sheepie owned (and "c15" equipped)
  ])("%s", (id, expected) => close(src(id), expected));

  it("Base Multikill = 1063.45", () => close(Number(tree.children![0].val), 1063.45));
  it("Multikill per Tier = 1581.2331…", () => close(Number(tree.children![2].val), 1581.2331135382508));
  it("total = IdleonToolbox = the AFK Info's MULTIKILL: 81706%", () => expect(tree.val).toBe(81706));
  it("active, and the AFK Info shows the line (beanG is FIGHTING)", () => {
    expect(src("active")).toBe(1);
    expect(tree.children![3].note).toBe("the AFK Info shows the MULTIKILL line");
  });

  it("no source is left unported", () => {
    const notes: string[] = [];
    const walk = (n: ArkhNode) => {
      if (n.note === "pending port") notes.push(n.name);
      n.children?.forEach(walk);
    };
    walk(tree);
    expect(notes).toEqual([]);
  });
```

And, after the Markhe `describe`, a new one:

```ts
describe.skipIf(!existsSync(SAVE))("Multikill — the other ten characters vs IdleonToolbox", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });

  // Their saved map is 216 (cavern 3, no Cove), target Bravery_Monument: tier 51.
  it.each<[string, number]>([
    ["ARKHE", 77116], ["ARKHELUCK", 106167], ["zArkhe", 107748], ["farkhe", 77116], ["Darkhe", 77116],
    ["Parkhe", 106167], ["Warkhe", 105652], ["Sarkhe", 107748], ["Barkhe", 106167], ["Arkhiiiiii", 106167],
  ])("%s on the saved map", (name, expected) => {
    const ci = save.charNames.indexOf(name);
    expect(computeArkhMultikill(save, ci, Number(save.data["CurrentMap_" + ci])).total).toBe(expected);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/multikill-ports.test.ts __tests__/lib/arkh/multikill.save.test.ts`
Expected: FAIL. `buffs.ts` doesn't exist, the two star-sign keys are missing, the five terms read 0 (pending) and Markhe's total is 75481.

- [ ] **Step 3: Implement.**

`systems/common/starSign.ts`: add two entries to `STAR_SIGN_TERMS`, after `FightAFK`:

```ts
  // Multikill (spec M6): sign 47 Cullingo → StarSigns.MultiKill += 15
  // (@6506250); sign 78 Killian Maximus → StarSigns["78"] += 3 (@6513550).
  MultiKill: [{ sign: 47, val: 15 }],
  "78": [{ sign: 78, val: 3 }],
```

Create `systems/common/buffs.ts`:

```ts
// ===== BUFF BONUSES =====
// N.js GetBuffBonuses(c, b) (@4257299): talent c's bonus b (1 = x, 2 = y)
// while buff c is active on the character (BuffsActive_ci, a runtime state the
// save captures), else 0; buff 615 reads 1; buff 46 (Void Radius) also needs
// class 4 or 5 and a positive GetBuffBonuses(45, 1). derived-stats.ts keeps
// its private, ungated getBuffBonus for HP/MP.

import { buffsActiveData, charClassData } from "../../../save/data";
import { talent } from "./talent";
import type { SaveData } from "../../../state";

function buffOn(c: number, ci: number): boolean {
  const list = (buffsActiveData as any[])[ci];
  if (!list || typeof list !== "object") return false;
  for (const k of Object.keys(list)) {
    if (k === "length") continue;
    if (Number(list[k]?.[0]) === c) return true;
  }
  return false;
}

// @njs _customBlock_GetBuffBonuses
export function getBuffBonuses(c: number, b: number, ci: number, s: SaveData): number {
  if (!buffOn(c, ci)) return 0;
  if (c === 615) return 1;
  if (c === 46) {
    const cls = Number((charClassData as any[])[ci]) || 0;
    if (!((cls === 4 || cls === 5) && getBuffBonuses(45, 1, ci, s) > 0)) return 0;
  }
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  return Number(talent.resolve(c, tctx, b === 2 ? { tab: 2 } : undefined).val) || 0;
}
```

`systems/multikill/multikill.ts`: extend the imports (`cauldronBubblesData` joins the `save/data` import, `bubbleValByKey` joins the `w2/alchemy` import; add `import { companions } from "../common/companions";`, `import { starSignBonusReal } from "../common/starSign";` and `import { getBuffBonuses } from "../common/buffs";`), replace the five pending cases and **delete the `pending` helper**:

```ts
    // N.js DNSM.StarSigns.MultiKill: sign 47 Cullingo +15 (@6506250), × Seraph —
    // the active-signs port (equipped ∪ unlocked below the enabled count).
    case "sign47": {
      const r = starSignBonusReal("MultiKill", ci, s);
      return pct("Star signs (Multikill)", r.val, r.children);
    }
```

```ts
    // N.js GetBuffBonuses(46,2): Void Radius's y while its buff is active,
    // for class 4/5 with buff 45. The name keeps "(Talent 46)": the collector
    // gates that suffix (spec M16).
    case "buff46":
      return pct(label("Talent", 46), getBuffBonuses(46, 2, ci, s), null, "active buff only");
```

```ts
    // N.js GetBuffBonuses(469,2): Mana Is Life's y while its buff is active.
    case "buff469":
      return pct(label("Talent", 469), getBuffBonuses(469, 2, ci, s), null, "active buff only");
```

```ts
    // N.js DNSM.StarSigns["78"]: sign 78 Killian Maximus +3 (@6513550), × Seraph.
    case "sign78": {
      const r = starSignBonusReal("78", ci, s);
      return pct("Star signs (Multikill per tier)", r.val, r.children);
    }
```

```ts
    // N.js AlchBubbles.MKtierACTIVE (MR_MASSACRE, cauldron 3 bubble 15): an
    // ACTIVE key exists only with Companions(4) (Sheepie) or "c15" in
    // CauldronBubbles[char] — cauldron letters are _ a b c (@4460300).
    case "bubbleMKtier": {
      const sheepie = companions(4, s) === 1 ? 1 : 0;
      const list = (cauldronBubblesData as any[])[ci];
      const equipped = (Array.isArray(list) ? list : Object.values(list ?? {})).includes("c15") ? 1 : 0;
      const r = bubbleValByKey("MKtierACTIVE", ci, s);
      return pct("MR_MASSACRE bubble (MKtierACTIVE)", sheepie || equipped ? r.val : 0, [
        raw("Sheepie (Companion 4)", sheepie),
        raw('Equipped ("c15")', equipped),
        ...(r.children ?? []),
      ]);
    }
```

Regenerate the registry: `npx tsx scripts/updater/registry/gen-registry.ts`.

- [ ] **Step 4: Run.** `npx vitest run __tests__/lib/arkh` must PASS, including `afk-gains.*` and `afk-fidelity.test.ts` (the new sign keys don't touch `FightAFK`), `coin-multi.*` and `family-guy-dr.test.ts`. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 5: Commit**

```bash
git add lib/arkh/stats/systems/common/starSign.ts lib/arkh/stats/systems/common/buffs.ts lib/arkh/stats/systems/multikill/multikill.ts scripts/updater/registry/formula-registry.gen.ts __tests__/lib/arkh/multikill-ports.test.ts __tests__/lib/arkh/multikill.save.test.ts
git commit -m "feat(arkh): star signs 47/78, buffs 46/469 and MR_MASSACRE — the Multikill tree is complete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Game format, collector map and map scenarios

**Files:**
- Create: `web/lib/multikill/format.ts`
- Modify: `web/lib/arkh/computeMultikill.ts` (add `MK_COLLECTOR_MAP`)
- Test: `web/__tests__/lib/multikill/format.test.ts` (new), `web/__tests__/lib/arkh/multikill.save.test.ts` (append a `describe`), `web/__tests__/lib/arkh/multikill.smoke.test.ts` (append; must stay last)

**Interfaces:**
- Produces: `formatMultikill(v: number): string` (`"81706"`; the kit's `unit: "%"` adds the `"%"`); `MK_COLLECTOR_MAP = 251` from `@/lib/arkh/computeMultikill`.

- [ ] **Step 1: Write the failing tests.** `web/__tests__/lib/multikill/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatMultikill } from "@/lib/multikill/format";

// N.js @3835457: "MULTIKILL;_" + Math.floor(MK) + "%" — no thousands separator.
describe("formatMultikill (the AFK Info's MULTIKILL line)", () => {
  it.each<[number, string]>([
    [81706, "81706"],
    [81706.99, "81706"],
    [3185, "3185"],
    [626, "626"],
    [0, "0"],
  ])("%s → %s", (v, s) => expect(formatMultikill(v)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatMultikill(NaN)).toBe("—"));
});
```

Append to `multikill.save.test.ts` (add `MK_COLLECTOR_MAP` to the `@/lib/arkh/computeMultikill` import, `MK_RULES` to the defs import and `import { formatMultikill } from "@/lib/multikill/format";`):

```ts
describe.skipIf(!existsSync(SAVE))("Multikill — map scenarios on the ARKHE save", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });
  const idx = (name: string) => save.charNames.indexOf(name);
  const kid = (t: ArkhNode, name: string) => t.children!.find((c) => c.name === name)!;

  it("Markhe on map 14 prints like the game: 81706", () => {
    expect(formatMultikill(computeArkhMultikill(save, idx("Markhe"), 14).total)).toBe("81706");
  });

  it("map 301: soft cap on both halves, tier 24 from arkh's max damage (an estimate) → 3185%", () => {
    const t = computeArkhMultikill(save, idx("Markhe"), 301).tree;
    close(Number(t.children![0].val), 114.409);
    close(Number(t.children![2].val), 127.96466227076502); // raw Σ 1741.2331… (W7 page 460)
    expect(t.children![1]).toMatchObject({ name: MK_NODES.tierW7, val: 24 });
    expect(t.children![1].note).toMatch(/^estimate/); // IT's max damage gives tier 30 → 3953 (spec M4)
    expect(t.children![2].children!.at(-1)).toMatchObject({ name: MK_RULES.softCap });
    expect(t.children![2].children!.at(-1)!.note).toMatch(/reduced by ~93%$/);
    expect(t.val).toBe(3185);
  });

  it("map 251 (the collector's): the W6 page and tier 51 → 80686%; every character is at the cap", () => {
    const t = computeArkhMultikill(save, idx("Markhe"), MK_COLLECTOR_MAP).tree;
    expect(t.children![2].children![0]).toMatchObject({ name: "Death Note (W6 page)", val: 280 });
    expect(t.val).toBe(80686);
    for (let ci = 0; ci < save.charNames.length; ci++) {
      expect(computeArkhMultikill(save, ci, MK_COLLECTOR_MAP).tree.children![1].val, save.charNames[ci]).toBe(51);
    }
  }, 30_000);

  // N.js ≠ IT: IT's getMultiKillTotal ignores the Cove override; N.js replaces
  // both sums on map 216 in cavern 17 (@7754109, @7751511).
  it("the Crystal Glunko Cove (a copy with ARKHE in cavern 17): 38×100 + 51 × 46×1 → 6146% (spec M19)", () => {
    const copy = JSON.parse(JSON.stringify(save));
    const holes = typeof copy.data.Holes === "string" ? JSON.parse(copy.data.Holes) : copy.data.Holes;
    holes[0][0] = 17;
    copy.data.Holes = typeof copy.data.Holes === "string" ? JSON.stringify(holes) : holes;
    const t = computeArkhMultikill(copy, 0, 216).tree;
    expect([t.children![0].val, t.children![1].val, t.children![2].val]).toEqual([3800, 51, 46]);
    expect(t.val).toBe(6146);
  });

  // N.js ≠ IT: IT's getMultiKillTotal keeps w7a6's static 1e18 HP; N.js sets
  // Clamz_HP after the curses (@6467129).
  it("Clamworks (map 306): HP = 1e16·30^8 = 6.561e27, no curse → tier 4 (estimate) → 626%", () => {
    const t = computeArkhMultikill(save, idx("Markhe"), 306).tree;
    const tier = t.children![1];
    expect(kid(tier, "Target HP").val).toBe(1e16 * Math.pow(30, 8));
    expect(tier.val).toBe(4);
    expect(tier.note).toMatch(/^estimate/);
    expect(t.val).toBe(626);
  });

  it("zArkhe's Jawbreaker curse (1180%, HP ×12.8): tier 21 → 19 on map 301 → 2754% (3032% without it)", () => {
    const t = computeArkhMultikill(save, idx("zArkhe"), 301).tree;
    const tier = t.children![1];
    close(Number(kid(tier, "Target HP").children!.find((c) => c.name === "Prayer curses")!.val), 12.8);
    expect(tier.val).toBe(19);
    expect(t.val).toBe(2754);
  });

  it("OverkillStuffs('3') is on for all 11; only Markhe's AFK Info shows the line", () => {
    for (let ci = 0; ci < save.charNames.length; ci++) {
      const status = computeArkhMultikill(save, ci, Number(save.data["CurrentMap_" + ci])).tree.children![3];
      expect(status.val, save.charNames[ci]).toBe(1);
      expect(status.note).toMatch(ci === idx("Markhe") ? /shows the MULTIKILL line/ : /hides the MULTIKILL line/);
    }
  }, 30_000);
});
```

Append to `multikill.smoke.test.ts` (add `import { existsSync, readdirSync, readFileSync } from "node:fs";` at the top); it must stay the last `describe` of the file:

```ts
describe("Multikill on the cached saves", () => {
  // Keep last: it loads real saves into the arkh singleton.
  const CACHE = "scripts/updater/golden/.cache";
  const cached = existsSync(CACHE) ? readdirSync(CACHE).filter((f) => f.endsWith(".json")) : [];
  it.skipIf(cached.length === 0)("every character gives a finite total on maps 14, 251 and 301", () => {
    for (const f of cached) {
      const save = JSON.parse(readFileSync(`${CACHE}/${f}`, "utf8"));
      for (let c = 0; c < (save.charNames?.length ?? 0); c++) {
        for (const m of [14, 251, 301]) {
          expect(Number.isFinite(computeArkhMultikill(save, c, m).total), `${f} #${c} map ${m}`).toBe(true);
        }
      }
    }
  }, 120_000);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/lib/multikill/format.test.ts __tests__/lib/arkh/multikill.save.test.ts __tests__/lib/arkh/multikill.smoke.test.ts`
Expected: FAIL. `lib/multikill/format.ts` and `MK_COLLECTOR_MAP` don't exist. The scenario values themselves already hold: they're regression anchors on Tasks 2–5.

- [ ] **Step 3: Implement.**

`web/lib/multikill/format.ts`:

```ts
// The game's own display of MultiKillTOTAL on the AFK Info panel:
// "MULTIKILL;_" + Math.floor(MK) + "%" (N.js @3835457) — no thousands
// separator. Returns the number without the "%" (the kit's unit adds it).
export function formatMultikill(v: number): string {
  return Number.isFinite(v) ? String(Math.floor(v)) : "—";
}
```

Append to `lib/arkh/computeMultikill.ts`:

```ts
/** Spec M7: the Observed Max collector measures every character on map 251
 *  (w6a1). Every endgame character is at the tier-51 cap there, so the
 *  reference doesn't depend on the unreconciled max damage. Moving it to 301
 *  is a follow-up of the max-damage reconciliation. */
export const MK_COLLECTOR_MAP = 251;
```

- [ ] **Step 4: Run.** `npx vitest run __tests__/lib/multikill __tests__/lib/arkh/multikill.save.test.ts __tests__/lib/arkh/multikill.smoke.test.ts` must PASS. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 5: Commit**

```bash
git add lib/multikill/format.ts lib/arkh/computeMultikill.ts __tests__/lib/multikill/format.test.ts __tests__/lib/arkh/multikill.save.test.ts __tests__/lib/arkh/multikill.smoke.test.ts
git commit -m "feat(multikill): game format, collector map and map scenarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Observed Max collector and cron step

**Files:**
- Create: `web/scripts/update-top-multikill.ts`
- Create (generated): `web/lib/multikill/topMultikill.ts`, `web/lib/multikill/topMultikill.meta.ts`
- Modify: `.github/workflows/refresh-top-max.yml`
- Test: `web/__tests__/scripts/multikillCollector.test.ts` (new)

**Interfaces:**
- Consumes: `runTopCollector`, `profileFlat`, `StatCollectorConfig` (EXP Task 8), `deriveGatedTalentsFor`; `computeArkhMultikillPools`, `combineMultikillPools`, `MK_COLLECTOR_MAP`, `MK_ROOT`, `MK_NODES`, `MK_RULES`, `MK_CLASS_TALENTS`.
- Produces (generated): `TOP_MULTIKILL_FLAT`, `TOP_MULTIKILL_PROFILE_OVERRIDES`, `TOP_MULTIKILL_CLASS_PROFILE`, `topMultikillFlatForClass(classKey: string | null | undefined)`; `TOP_MULTIKILL_GENERATED_AT`, `TOP_MULTIKILL_PLAYERS_SCANNED`, `TOP_MULTIKILL_HYPOTHETICAL_TOTAL`, `TOP_MULTIKILL_BEST`.

- [ ] **Step 1: Write the failing test** `web/__tests__/scripts/multikillCollector.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveGatedTalentsFor } from "@/scripts/_shared/classGating";
import { profileFlat } from "@/scripts/_shared/topStatCollector";
import { MK_CLASS_TALENTS } from "@/lib/arkh/stats/systems/multikill/multikill";
import { MK_NODES, MK_ROOT, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { combineMultikillPools } from "@/lib/arkh/computeMultikill";
import { topMultikillFlatForClass } from "@/lib/multikill/topMultikill";
import { TOP_MULTIKILL_PLAYERS_SCANNED } from "@/lib/multikill/topMultikill.meta";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const P = (...items: Array<[string, number]>): Pool => ({ items: items.map(([name, val]) => ({ name, val })), sum: 0, product: 0 });
const T46 = `${MK_ROOT} / ${MK_NODES.perTier} / Void Radius (Talent 46)`;
const T469 = `${MK_ROOT} / ${MK_NODES.perTier} / Mana Is Life (Talent 469)`;

describe("Multikill Observed Max", () => {
  it("gates Void Radius and Mana Is Life, never Monolithialism or Master Of The System (spec M16)", () => {
    expect(deriveGatedTalentsFor(MK_CLASS_TALENTS).map((t) => t.id).sort((a, b) => a - b)).toEqual([46, 469]);
    expect(deriveGatedTalentsFor([654, 58])).toEqual([]);
  });

  it("profileFlat zeroes the two gated buffs in the per-tier sum (groups: [] → neutral 0)", () => {
    const best = {
      base: P(["Base source", 100]),
      perTier: P(["Void Radius (Talent 46)", 40], ["Mana Is Life (Talent 469)", 60], ["Per-tier source", 100]),
      tier: P([MK_NODES.tier, 51]),
      rules: P([MK_RULES.softCap, 0], [MK_RULES.cove, 0]),
      status: P([MK_NODES.active, 1]),
    };
    const flat = profileFlat({ root: MK_ROOT, groups: [], combine: combineMultikillPools }, best, [46, 469]);
    expect(flat[T46]).toBe(0);
    expect(flat[T469]).toBe(0);
    expect(flat[MK_ROOT]).toBe(100 + 51 * 100);
  });

  it("the generated reference sits on the W6 page at tier 51; a Royal Guardian never sees the gated buffs", () => {
    expect(TOP_MULTIKILL_PLAYERS_SCANNED).toBeGreaterThanOrEqual(20);
    const top = topMultikillFlatForClass(null);
    expect(top[MK_ROOT]).toBeGreaterThan(0);
    expect(top[`${MK_ROOT} / ${MK_NODES.tier}`]).toBe(51);
    expect(top[`${MK_ROOT} / ${MK_NODES.perTier} / Death Note (W6 page)`]).toBeGreaterThan(0);
    expect(topMultikillFlatForClass("Royal_Guardian")[T46]).toBe(0);
    expect(topMultikillFlatForClass("Royal_Guardian")[T469]).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run __tests__/scripts/multikillCollector.test.ts`. It must FAIL because `@/lib/multikill/topMultikill` doesn't exist yet.

- [ ] **Step 3: Collector config** `web/scripts/update-top-multikill.ts`. It follows `update-top-afk.ts`: the window shim sits before the imports, and the file runs as CJS under tsx.

```ts
// Refresh the bundled top-player Multikill reference in
// lib/multikill/topMultikill.ts (+ .meta.ts). Every character is measured on
// map 251 (w6a1, MK_COLLECTOR_MAP — spec M7): every endgame character is at
// the tier-51 cap there, so MK = B + 51·P doesn't depend on the unreconciled
// max damage, and the Death Note row is the W6 page. Candidates: the #1 of
// every board plus the top 10 of Monsters Killed (M15). Talents 46/469 are
// gated per class (M16); both sit in the per-tier sum, so `groups: []` makes
// their neutral value 0.
//
// Run (from web/):  npx tsx scripts/update-top-multikill.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhMultikillPools, combineMultikillPools, MK_COLLECTOR_MAP } from "../lib/arkh/computeMultikill";
import { MK_ROOT } from "../lib/arkh/stats/defs/multikill";
import { MK_CLASS_TALENTS } from "../lib/arkh/stats/systems/multikill/multikill";

runTopCollector({
  label: "Multikill",
  focusBoard: "monstersKilled",
  root: MK_ROOT,
  groups: [],
  computePools: (save, ci) => computeArkhMultikillPools(save, ci, MK_COLLECTOR_MAP),
  combine: combineMultikillPools,
  gated: deriveGatedTalentsFor(MK_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "multikill", "topMultikill.ts"),
  metaFile: join(__dirname, "..", "lib", "multikill", "topMultikill.meta.ts"),
  constPrefix: "TOP_MULTIKILL",
  flatForClassFn: "topMultikillFlatForClass",
  scriptName: "scripts/update-top-multikill.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`mergeBest` keeps the best value of each source position across everyone: the tier (51), the W6 Death Note page, and the `rules`/`status` items (0 and 1 on map 251). The collector's logs print totals with an "x"; that's cosmetic.

- [ ] **Step 4: Generate the reference** (network, read-only public API; a few minutes). `lib/multikill/` exists since Task 6.

Run: `npx tsx scripts/update-top-multikill.ts --limit 3` (smoke, which writes a 3-player file), then `npx tsx scripts/update-top-multikill.ts` (the full run overwrites it).
Expected: "✓ Scanned N players" with N ≥ 20, the gated talents listed as `46, 469`, and both files written.
If the IT API is unreachable, retry once with `--slow`. If it still fails, stop and report BLOCKED with the error. Don't hand-write the file and don't build it from the golden caches (9 top-player saves in the main checkout, 2 in this worktree — below the collector's 20-player floor; see the self-review).

- [ ] **Step 5: Cron.** In `.github/workflows/refresh-top-max.yml`, as AFK Task 6 left it:
  - rename the workflow `name:` to `Refresh top DR, coin, EXP, AFK, multikill & talent max`;
  - in the header comment, add "Multikill" to the list of pages; after the AFK line add `#   • web/lib/multikill/topMultikill.ts      (+ .meta.ts)`; change "All five collectors" to "All six collectors";
  - change the job's `timeout-minutes: 45` to `60`: Coin, EXP, AFK and Multikill each allow 12 minutes, so a 45-minute cap could cancel the commit step;
  - after the "Refresh top-player AFK Gains max" step add:

```yaml
      - name: Refresh top-player Multikill max
        working-directory: web
        continue-on-error: true
        timeout-minutes: 12
        run: npx tsx scripts/update-top-multikill.ts
```

  - append `web/lib/multikill/topMultikill.ts web/lib/multikill/topMultikill.meta.ts` to `files=` and change the commit message to `chore: auto-refresh top DR + coin + EXP + AFK + multikill + talent max snapshots`.

- [ ] **Step 6: Run.** `npx vitest run __tests__/scripts` must PASS. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 7: Commit**

```bash
git add scripts/update-top-multikill.ts lib/multikill/topMultikill.ts lib/multikill/topMultikill.meta.ts ../.github/workflows/refresh-top-max.yml __tests__/scripts/multikillCollector.test.ts
git commit -m "feat(multikill): Observed Max collector + cron step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Page config — the what-if gains model and `MULTIKILL_PAGE`

**Files:**
- Create: `web/lib/multikill/gains.ts`, `web/lib/multikill/pageConfig.ts`
- Test: `web/__tests__/lib/multikill/pageConfig.test.ts` (new)

**Interfaces:**
- Consumes: the kit's `StatPageConfig`, `GainsModel`, `GainSource`, `GainRow`, `directChildren`, `computeGains` (with Task 1's hooks); `MK_ROOT`, `MK_NODES`, `MK_RULES`, `mkTotal`, `MkParts`; `formatMultikill` (Task 6); the generated `topMultikill*` (Task 7); `formatNum` (`lib/numberFormat.ts`).
- Produces: `multikillGainsModel: GainsModel` (`lib/multikill/gains.ts`); `MULTIKILL_PAGE: StatPageConfig` (`lib/multikill/pageConfig.ts`).

- [ ] **Step 1: Write the failing test** `web/__tests__/lib/multikill/pageConfig.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import { multikillGainsModel } from "@/lib/multikill/gains";
import { formatMultikill } from "@/lib/multikill/format";
import { MK_NODES, MK_ROOT, MK_RULES } from "@/lib/arkh/stats/defs/multikill";
import { combineMultikillPools, computeArkhMultikill } from "@/lib/arkh/computeMultikill";
import { computeGains } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import type { ArkhNode } from "@/lib/arkh/node";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe("Multikill page config", () => {
  it("uses its own storage keys, the % unit and the game's format", () => {
    expect(MULTIKILL_PAGE.storage).toEqual({
      save: "multikill-tracker.last-upload.v1",
      name: "multikill-tracker.playerName",
      snapshots: "multikill-tracker.v1",
      collapse: "multikill.snapshot-section.collapsed.v1",
      exportPrefix: "multikill-snapshots",
      exportLabel: "multikill-tracker",
    });
    expect(MULTIKILL_PAGE).toMatchObject({
      statName: "Multikill",
      gainLabel: "Multikill",
      emoji: "💥",
      calculatorTitle: "Multikill Calculator",
      totalLabel: "Total Multikill",
      unit: "%",
      errPrefix: "Multikill compute failed",
      mapTitle: "The map sets the Death Note page, the W7 soft cap and ×5 tier ladder, the target's HP and the Crystal Glunko Cove",
    });
    expect(MULTIKILL_PAGE.formatTotal).toBe(formatMultikill);
    expect(MULTIKILL_PAGE.gains).toBe(multikillGainsModel);
    expect(MULTIKILL_PAGE.totalTitle!(81706)).toBe("81,706%");
  });

  it("loads the Observed Max for a class", async () => {
    const top = await MULTIKILL_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });
});

describe("Multikill what-if gains model (synthetic)", () => {
  const n = (name: string, val: number, children?: ArkhNode[]): ArkhNode => ({ name, val, ...(children ? { children } : {}) });
  const pool = (...items: ArkhNode[]): Pool => ({ items, sum: 0, product: 0 });
  type Opt = { base?: number; perTier?: number; tier?: number; w7?: boolean; cove?: [number, number] };
  const flatOf = (o: Opt = {}) =>
    flattenTree(
      combineMultikillPools({
        base: pool(n("Base A", 600), n("Base B", (o.base ?? 1063.45) - 600)),
        perTier: pool(n("Death Note (W1 page)", 300), n("Per tier X", (o.perTier ?? 1581.2331135382508) - 300)),
        tier: pool(n(o.w7 ? MK_NODES.tierW7 : MK_NODES.tier, o.tier ?? 51, [n("Exponent", o.w7 ? 5 : 2), n("Next tier at", 1.5e31)])),
        rules: pool(
          n(MK_RULES.softCap, o.w7 ? 1 : 0),
          n(MK_RULES.cove, o.cove ? 1 : 0, [n("base", o.cove?.[0] ?? 0), n("perTier", o.cove?.[1] ?? 0)])
        ),
        status: pool(n(MK_NODES.active, 1)),
      }).tree
    );
  const W7: Opt = { perTier: 1741.2331135382508, tier: 24, w7: true };
  const A = `${MK_ROOT} / ${MK_NODES.base} / Base A`;
  const X = `${MK_ROOT} / ${MK_NODES.perTier} / Per tier X`;
  const DN = (w: number) => `${MK_ROOT} / ${MK_NODES.perTier} / Death Note (W${w} page)`;
  const TIER = `${MK_ROOT} / ${MK_NODES.tier}`;

  it.each<[string, Opt, number]>([
    ["map 14", {}, 81706],
    ["the W7 soft cap", W7, 3185],
    ["the Cove", { cove: [3800, 46] }, 6146],
  ])("totalFromFlat = the tree (%s): one mkTotal for both (spec M14)", (_n, o, want) => {
    const flat = flatOf(o);
    expect(flat[MK_ROOT]).toBe(want);
    expect(multikillGainsModel.totalFromFlat(flat)).toBe(want);
  });

  it("a base source is worth ×1 and a per-tier source ×T", () => {
    const flat = flatOf();
    const { rows } = computeGains(multikillGainsModel, flat, { [A]: 700, [X]: flat[X] + 100 });
    const gain = (s: string) => rows.find((r) => r.source === s)!.gainPct;
    expect(gain("Base A")).toBeCloseTo((81806 / 81706 - 1) * 100, 9);
    expect(gain("Per tier X")).toBeCloseTo((86806 / 81706 - 1) * 100, 9); // +6.24%
  });

  it("in W7 the soft cap flattens a per-tier source: +100 is +1.5%", () => {
    const flat = flatOf(W7);
    const { rows } = computeGains(multikillGainsModel, flat, { [X]: flat[X] + 100 });
    expect(rows.find((r) => r.source === "Per tier X")!.gainPct).toBeCloseTo((3233 / 3185 - 1) * 100, 9);
  });

  it("in the Cove the sources don't move the total", () => {
    expect(computeGains(multikillGainsModel, flatOf({ cove: [3800, 46] }), { [A]: 5000 }).rows).toEqual([]);
  });

  it("the tier ranks against the reference below map 300, never in W7 (spec M12)", () => {
    const below = computeGains(multikillGainsModel, flatOf({ tier: 40 }), { [TIER]: 51 });
    expect(below.rows.find((r) => r.source === MK_NODES.tier)).toMatchObject({ you: 40, max: 51, display: "raw" });
    const w7 = computeGains(multikillGainsModel, flatOf(W7), { [TIER]: 51 });
    expect(w7.comparableSources).toBe(0);
    expect(w7.rows.map((r) => r.source)).toEqual(["+1 damage tier"]);
  });

  it("'+1 damage tier' is a lever: the next tier's gain and the ×E text; gone at 51 (spec M13)", () => {
    const [lever] = multikillGainsModel.levers!(flatOf(W7));
    expect(lever).toMatchObject({ source: "+1 damage tier", you: 24, max: 25, display: "raw" });
    expect(lever.gainPct).toBeCloseTo((3313 / 3185 - 1) * 100, 9); // +4.0%
    expect(lever.group).toBe("needs ×5 more max damage (next tier at 1.500E31)");
    expect(multikillGainsModel.levers!(flatOf())).toEqual([]);
  });

  it("the Death Note row only meets a reference on the same world (spec M11)", () => {
    const flat = flatOf();
    expect(computeGains(multikillGainsModel, flat, { [DN(6)]: 280 }).comparableSources).toBe(0);
    expect(computeGains(multikillGainsModel, flat, { [DN(1)]: 300 }).comparableSources).toBe(1);
  });
});

describe.skipIf(!existsSync(SAVE))("Multikill what-if on the ARKHE save", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });
  const markhe = () => save.charNames.indexOf("Markhe");

  it.each<[number, number]>([
    [14, 81706],
    [301, 3185],
    [306, 626],
    [251, 80686],
  ])("Markhe on map %i: totalFromFlat = the tree = %i", (map, want) => {
    const t = computeArkhMultikill(save, markhe(), map).tree;
    expect(t.val).toBe(want);
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(want);
  });

  it("the Cove copy (ARKHE in cavern 17): totalFromFlat = 6146", () => {
    const copy = JSON.parse(JSON.stringify(save));
    const holes = typeof copy.data.Holes === "string" ? JSON.parse(copy.data.Holes) : copy.data.Holes;
    holes[0][0] = 17;
    copy.data.Holes = typeof copy.data.Holes === "string" ? JSON.stringify(holes) : holes;
    const t = computeArkhMultikill(copy, 0, 216).tree;
    expect(multikillGainsModel.totalFromFlat(flattenTree(t))).toBe(6146);
  });

  it("Markhe on map 301: +1 damage tier, 24 → 25, is +4.0%", () => {
    const [lever] = multikillGainsModel.levers!(flattenTree(computeArkhMultikill(save, markhe(), 301).tree));
    expect(lever).toMatchObject({ you: 24, max: 25 });
    expect(lever.gainPct).toBeCloseTo((3313 / 3185 - 1) * 100, 9);
    expect(lever.group).toMatch(/^needs ×5 more max damage \(next tier at /);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run __tests__/lib/multikill/pageConfig.test.ts`. It must FAIL (modules missing).

- [ ] **Step 3: `gains.ts`**

```ts
// Biggest Gains for the Multikill page (spec M3, EXP D10): a what-if over the
// flat tree through the same mkTotal the tree uses (M14). The sources are the
// 27 of the character's own save (the Death Note row carries its world, so it
// only meets a same-world reference — M11); the damage tier ranks against the
// reference only on the ×2 ladder (a W7 tier is named apart — M12); "+1 damage
// tier" is a lever the model computes itself (M13).

import { directChildren, type GainRow } from "@/lib/statTracker/biggestGains";
import type { GainSource, GainsModel } from "@/lib/statTracker/config";
import { MK_NODES, MK_ROOT, MK_RULES, mkTotal, type MkParts } from "@/lib/arkh/stats/defs/multikill";
import { formatNum } from "@/lib/numberFormat";

const pathOf = (name: string) => `${MK_ROOT} / ${name}`;
const HALVES = [MK_NODES.base, MK_NODES.perTier] as const;

/** A half's sources and rule rows, read back from the flat tree. */
function half(flat: Record<string, number>, name: string) {
  const parent = pathOf(name);
  const out = { sum: 0, soft: false, cove: null as number | null, sources: [] as string[] };
  for (const p of directChildren(parent, flat)) {
    const leaf = p.slice(parent.length + 3);
    if (leaf === MK_RULES.softCap) out.soft = true;
    else if (leaf === MK_RULES.cove) out.cove = Number(flat[p]) || 0;
    else {
      out.sum += Number(flat[p]) || 0;
      out.sources.push(p);
    }
  }
  return out;
}

/** The damage tier's path: ×2 ladder below map 300, ×5 in W7. */
function tierPath(flat: Record<string, number>): string | null {
  for (const name of [MK_NODES.tier, MK_NODES.tierW7]) if (typeof flat[pathOf(name)] === "number") return pathOf(name);
  return null;
}

/** mkTotal's inputs from a flat tree: B and P are the direct children minus
 *  the rule rows; the soft cap applies when its row exists; the Cove row's
 *  value replaces its half. */
function partsFromFlat(flat: Record<string, number>): MkParts {
  const b = half(flat, MK_NODES.base);
  const p = half(flat, MK_NODES.perTier);
  const tp = tierPath(flat);
  return {
    base: b.sum,
    perTier: p.sum,
    tier: tp ? Number(flat[tp]) || 1 : 1,
    softCap: b.soft,
    cove: b.cove !== null ? { base: b.cove, perTier: p.cove ?? 0 } : null,
  };
}

export const multikillGainsModel: GainsModel = {
  sources(yoursFlat) {
    const out: GainSource[] = [];
    for (const g of HALVES) {
      const gp = pathOf(g);
      for (const p of half(yoursFlat, g).sources) out.push({ path: p, group: g, source: p.slice(gp.length + 3), display: "pct" });
    }
    const tp = tierPath(yoursFlat);
    if (tp === pathOf(MK_NODES.tier)) out.push({ path: tp, group: MK_NODES.tier, source: MK_NODES.tier, display: "raw" });
    return out;
  },
  totalFromFlat: (flat) => mkTotal(partsFromFlat(flat)),
  levers(yoursFlat): GainRow[] {
    const p = partsFromFlat(yoursFlat);
    const tp = tierPath(yoursFlat);
    const now = mkTotal(p);
    if (!tp || p.tier >= 51 || !(now > 0)) return [];
    const E = Number(yoursFlat[`${tp} / Exponent`]) || 2;
    const next = Number(yoursFlat[`${tp} / Next tier at`]) || 0;
    return [
      {
        path: `${tp} / +1`,
        group: `needs ×${E} more max damage (next tier at ${formatNum(next)})`,
        source: "+1 damage tier",
        display: "raw",
        you: p.tier,
        max: p.tier + 1,
        gainPct: (mkTotal({ ...p, tier: p.tier + 1 }) / now - 1) * 100,
      },
    ];
  },
};
```

- [ ] **Step 4: `pageConfig.ts`**

```ts
// Multikill page: the statTracker kit's config for N.js
// WorkbenchStuff("MultiKillTOTAL") — the AFK Info panel's MULTIKILL line.

import type { StatPageConfig } from "@/lib/statTracker/config";
import { formatMultikill } from "./format";
import { multikillGainsModel } from "./gains";
import { TOP_MULTIKILL_GENERATED_AT, TOP_MULTIKILL_PLAYERS_SCANNED } from "./topMultikill.meta";

export const MULTIKILL_PAGE: StatPageConfig = {
  statName: "Multikill",
  gainLabel: "Multikill",
  emoji: "💥",
  calculatorTitle: "Multikill Calculator",
  subtitle:
    "Computes every character's AFK multikill from your save — the MULTIKILL line of the in-game AFK Info panel. Select character & map. All processing local in your browser.",
  totalLabel: "Total Multikill",
  mapTitle:
    "The map sets the Death Note page, the W7 soft cap and ×5 tier ladder, the target's HP and the Crystal Glunko Cove",
  errPrefix: "Multikill compute failed",
  storage: {
    save: "multikill-tracker.last-upload.v1",
    name: "multikill-tracker.playerName",
    snapshots: "multikill-tracker.v1",
    collapse: "multikill.snapshot-section.collapsed.v1",
    exportPrefix: "multikill-snapshots",
    exportLabel: "multikill-tracker",
  },
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeMultikill").then((m) => m.computeArkhMultikill(save, charIdx, mapIdx)),
  formatTotal: formatMultikill,
  unit: "%",
  // The total is already the game's floored percent; the tooltip adds separators.
  totalTitle: (x) => (Number.isFinite(x) ? Math.floor(x).toLocaleString("en-US") + "%" : "—"),
  gains: multikillGainsModel,
  loadTop: () =>
    import("./topMultikill").then((m) => ({
      flatForClass: (classKey: string | null) => m.topMultikillFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_MULTIKILL_GENERATED_AT, playersScanned: TOP_MULTIKILL_PLAYERS_SCANNED },
  methodologyNote:
    "Multikill gain = how much your Multikill would rise if this source matched the top players " +
    "(Observed Max), recomputed through the game's formula ⌊Base + Tier × Per Tier⌋. Values are a ceiling, " +
    "not a one-level step. The top players are measured on map 251 (World 6, every endgame character at " +
    "the tier-51 cap), so the Death Note row is only compared on a World 6 map and the damage tier only " +
    "outside World 7. \"+1 damage tier\" is a step, not a reference: it needs ×2 more max damage (×5 in World 7).",
  compareTitle: "Compare every Multikill source against the best value observed across the top players",
  gainsTabTitle: "Rank your Multikill sources by how much Multikill matching the top players would give",
  footer:
    "Multikill is computed locally from your save — every term of the game's multikill formula, base and per damage tier.",
};
```

- [ ] **Step 5: Run.** `npx vitest run __tests__/lib/multikill` must PASS. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 6: Commit**

```bash
git add lib/multikill/gains.ts lib/multikill/pageConfig.ts __tests__/lib/multikill/pageConfig.test.ts
git commit -m "feat(multikill): page config — what-if gains with the +1 damage tier lever

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Route, navigation, home card; final verification

**Files:**
- Create: `web/app/multikill/page.tsx`, `web/app/multikill/MultikillPageClient.tsx`
- Modify: `web/components/TopNav.tsx`, `web/app/page.tsx`, `web/e2e/homepage.spec.ts`
- Test: `web/__tests__/components/TopNav.test.tsx`, `web/__tests__/components/statTracker/StatCalculator.test.tsx` (extend)

**Interfaces:**
- Consumes: `MULTIKILL_PAGE` (Task 8), `StatPageClient` (EXP Task 7).
- Produces: the route `/multikill`, the nav item "💥 Multikill" after "💤 AFK Gains", the home card "Multikill Tracker".

- [ ] **Step 1: Write the failing tests.**
  - `__tests__/components/TopNav.test.tsx`: add `expect(screen.getByText(/Multikill/i)).toBeInTheDocument();` to "renders all nav items".
  - `__tests__/components/statTracker/StatCalculator.test.tsx`: add a top-level `vi.mock("@/lib/arkh/computeMultikill", () => ({ computeArkhMultikill: () => { throw new Error("stub"); } }));` next to the other engine mocks, `import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";`, and:

```tsx
  it("renders the Multikill config", () => {
    render(<StatCalculator config={MULTIKILL_PAGE} />);
    expect(loader!.storageKey).toBe("multikill-tracker.playerName");
    expect(screen.getByText(/Multikill Calculator/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run** `npx vitest run __tests__/components/TopNav.test.tsx __tests__/components/statTracker/StatCalculator.test.tsx`. It must FAIL: the nav has no "Multikill" item. The config case already passes, since it depends on Task 8.

- [ ] **Step 3: Route.**

`web/app/multikill/MultikillPageClient.tsx`:

```tsx
"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function MultikillPageClient() {
  return <StatPageClient config={MULTIKILL_PAGE} />;
}
```

`web/app/multikill/page.tsx`:

```tsx
import type { Metadata } from "next";
import MultikillPageClient from "./MultikillPageClient";

export const metadata: Metadata = {
  title: "Multikill Tracker",
  description:
    "Your Idleon AFK multikill, source by source, computed from your save — base, damage tier and per-tier sources, per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function MultikillPage() {
  return <MultikillPageClient />;
}
```

- [ ] **Step 4: Navigation**
  - `components/TopNav.tsx`: add `{ href: "/multikill", label: "💥 Multikill" },` right after the `{ href: "/afk-gains", label: "💤 AFK Gains" },` item.
  - `app/page.tsx`: after the AFK Gains `ShortcutCard` add:

```tsx
        <ShortcutCard
          href="/multikill"
          icon="💥"
          title="Multikill Tracker"
          description="Every term of the game's multikill formula on your save — base, damage tier and per-tier sources — per character and map, with snapshots and a top-player comparison."
          cta="Open Multikill"
        />
```

  - `e2e/homepage.spec.ts`: add `{ title: "Multikill Tracker", desc: "multikill formula" },` after the AFK Gains card entry. It runs in CI only.

- [ ] **Step 5: Run.** `npx vitest run` (full) must PASS, including `family-guy-dr.test.ts`, `coin-multi.*`, `exp-multi.*` and `afk-gains.*`. `npx tsc --noEmit -p tsconfig.json` must be clean. Also check that `git status` shows only this task's files and that nothing under `web/scripts/updater/golden/.cache/` is tracked.

- [ ] **Step 6: Commit**

```bash
git add app/multikill/page.tsx app/multikill/MultikillPageClient.tsx components/TopNav.tsx app/page.tsx e2e/homepage.spec.ts __tests__/components/TopNav.test.tsx __tests__/components/statTracker/StatCalculator.test.tsx
git commit -m "feat(multikill): Multikill Tracker page, nav item and home card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand-off (controller, after the push).**
  - Open the PR with base `feat/afk-gains-page`, then check the Vercel preview of `/multikill`: headline `81706%` style (no separator, `81,706%` on hover), tree root in %, map selector, Snapshot History, Compare vs Observed Max, and Biggest Gains with "+1 damage tier" on a W7 map.
  - The spec's done criterion is the game reading. Ask the user for Markhe's AFK Info on `beanG`: the expected line is `MULTIKILL: 81706%` on the cached 2026-09-23 save. A fresh reading needs a save from the same moment, taken **without logging in** (public IT profile or "Copy for Support"). The Stats panel's "Max Dmg", read at the same time, decides M4 (arkh 6.01e30 vs IT 2.45e35 on the cached save).
  - Don't merge.

---

## Self-review

**Spec coverage.** Each spec item, and where the plan covers it:

| Spec item | Where it lands |
|---|---|
| M1 headline = `MultiKillTOTAL` per char and map; default the saved map; target `AFKtarget_N` on the saved map, `MapAFKtarget` elsewhere; `⌊MK⌋ + "%"` without separator; route `/multikill`, title "Multikill Tracker", nav "💥 Multikill" after the AFK item | T3 (`mkTotal`), T2 (target rule in `overkillStuffs`), T6 (`formatMultikill` → "81706"), T8 (`unit: "%"`, `totalTitle`), T9 (route, nav, home card, e2e) |
| M2 own descriptor, root `⌊B′ + T × P′⌋`; "Base Multikill" 9 sources, "Damage Tier" with Max Damage / Target HP (Static HP, Prayer curses) / Exponent / thresholds, "Multikill per Tier" 18 sources; soft-cap rows; Cove override; Clamworks HP; flag "3" as a status row; headline always `MultiKillTOTAL` | T3 (descriptor, rule rows, tier and status nodes, smoke), T2 (Clamworks HP, flag "3" parts), T4–T5 (the missing sources), T6 (scenarios) |
| M3 Biggest Gains by what-if with its own `totalFromFlat`; the tier as a source; "+1 tier" as the big lever | T8 (`multikillGainsModel`), T1 (the kit hook) |
| M4 max damage = `computeMaxDamage`; the W7 tier labelled an estimate; reconciliation is a follow-up | T2 (`overkillStuffs`), T3 (tier note), T6 (301/306 notes), T9 (the "Max Dmg" reading) |
| M5 shared tier helper from Coin's `multikillTier` + curse factor; Coin's 643 on it in a separate commit; Markhe stays 6.88E35; never `computeOverkillTier` | T2 (commit of its own; zArkhe 301 → 19, Markhe 306 → 4) |
| M6 ports: Salt Lick 8, Death Note per world, minibosses, Measurement 9, soft cap, Cove, MR_MASSACRE gate, buffs 46/469, chip "mkill", card 80, card set 11, prayer 16 (super bit) | T4 (Salt Lick, Death Note, minibosses, Measurement 9), T3 (soft cap, Cove, chip, card 80, card set 11, prayer 16), T5 (signs, buffs, MR_MASSACRE) |
| M7 collector on map 251 | T6 (`MK_COLLECTOR_MAP`, all 11 at 51), T7 (collector) |
| M8 oracle IT, term by term; the 11 characters; `// N.js ≠ IT:` on the gaps | T3–T5 (save tests: per term, 1063.45 / 1581.2331 / 51 / 81706, ten characters), T6 (Cove and Clamworks comments) |
| M9 side bugs are follow-ups | Global Constraints (untouched) |
| M10 stacked branch, own PR, merge only by the user | Base, T9 hand-off |
| M11 Death Note row named by its world | T4 (name), T8 (same-world test) |
| M12 tier compared only below map 300 | T3 (W7 tier named by its ladder), T8 (test), T6 (name check) |
| M13 `GainsModel.levers?`; "+1 tier" gone at 51; "needs ×E more max damage (next tier at X)" | T1 (kit + test), T8 (lever, text, 51) |
| M14 map rules as pool items; pure `combine`; `mkTotal` shared by combine, what-if and collector | T3 (`rules`/`status` pools, `mkTotal`), T8 (`totalFromFlat` = the tree on 81706 / 3185 / 6146 / 626 / 80686), T7 (collector's `combine`) |
| M15 focus board `monstersKilled` | T7 |
| M16 gating 46/469; `groups: []` | T5 (names end in "(Talent n)"), T7 (gating + `profileFlat` zeroes both) |
| M17 estimate whenever T < 51 | T3 (note), T6 (301, 306) |
| M18 `computeChipBonus` untouched; "mkill" from the per-character `chipBonuses` | T3 (`chipMkill`), Global Constraints |
| M19 the Cove through an in-memory copy | T6, T8 |
| Tests: `mkSoftCap` edges and the top bracket; `multikillTier` thresholds and cap; `mkTotal` floor / soft cap / Cove; empty-envelope smoke (finite, 4 children, 9 and 18) | T3, T2 |
| Tests: cached saves finite on maps 14, 251, 301 | T6 |
| Tests: scenarios 301 (3185), 251 (80686), Cove (6146), 306 (626), curses (2754), flag "3" | T6 |
| Tests: Coin 6.88E35 + the two new assertions | T2 |
| Tests: gains model (totalFromFlat = combine, base and per-tier what-if, tier out in W7, lever gone at 51, Death Note same world); levers in `biggestGains.test.ts`; `formatMultikill`; `pageConfig` keys and `unit`; collector; UI (calculator title, name key), TopNav, home e2e | T8, T1, T6, T7, T9 |
| Game reading `MULTIKILL: 81706%` + "Max Dmg" | T9 Step 7 |

**Decisions this plan adds (not in the spec).**

1. **A second optional kit field, `StatPageConfig.totalTitle`.** The spec's only kit change is `levers?`, but AFK's `unit: "%"` prints the headline tooltip as `100·total`, which assumes a rate. Multikill's total is already a percent (81706 would read 8170600.00%). The default keeps AFK, Coin and EXP unchanged.
2. **`combine` may return the root's `fmt`.** The spec wants the tree root in %. `buildTree` and `combineStatPools` hard-code `"x"`; they now take `result.fmt ?? "x"`, next to AFK's root `note`.
3. **The W7 tier node is named "Damage Tier (W7 ×5 ladder)".** M12 says the tier is compared with the Observed Max only below map 300. The spec's mechanism (the model drops the tier in W7) covers Biggest Gains only; Compare matches paths and would still badge the W7 tier with the ×2 reference's 51. The rename covers both, like M11 does for the Death Note. The model still reads E from the tree for the lever text.
4. **`overkillActive` is separate from `overkillStuffs`** (same file), so Coin's talent 643 never pays for `computeAccuracy`.
5. **The lever's text rides in the row's `group` line** (the grey subtitle under the source), so `StatBiggestGains` needs no change.
6. **The collector stops BLOCKED instead of publishing from the cache.** Spec risk 8 (build the reference from the cached top-player saves) conflicts with the collector's 20-player floor: the golden caches hold 9 top-player saves (main checkout) and 2 (this worktree), and the collector has no cache mode. Same call as EXP Task 8 and AFK Task 6.
7. **The refresh workflow's job timeout goes from 45 to 60 minutes** (four 12-minute collector steps).
8. **Salt Lick: a three-way preflight** (Task 4 Step 1), since EXP Task 4's final export wasn't on the base branch when this plan was written.
9. **Multi-character loops get explicit timeouts** (≈0.25 s per compute).
