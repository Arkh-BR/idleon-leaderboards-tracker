# AFK Gains Rate (Fighting) Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/afk-gains` "AFK Gains Tracker": the character's Fighting AFK gains rate (N.js `AFKgainrates("Fighting")`, the AFK GAINS RATE line of the in-game AFK Info panel; Markhe on map 14 = **42231%**) term by term, with snapshots, Observed Max and Biggest Gains, on the statTracker kit that the EXP Multi plan builds.

**Architecture:** Engine: a custom descriptor (`defs/afk-gains.ts`: pools `fight`/`all`/`multi`/`rules`, the pure `afkRate`, and a combine that builds G1–G3 plus the three map rules) and an `afk` system (`systems/afk/afk.ts`, one case per N.js term) behind `computeAfk.ts`. The fidelity fixes (active star signs, super-bit prayers, per-character chips, Void Set, Divinity major, Flurbo/Roo) are new functions next to the old ones, which keep feeding DR/Coin. Kit: one new option (`unit: "%"`). Page: a config (`lib/afkGains/pageConfig.ts`) with its own what-if `GainsModel` over `afkRate`, an Observed Max collector config with a cron step, and the route, nav item and home card.

**Tech Stack:** Next.js 16 (app router), React, TypeScript, Tailwind, Vitest 2 + happy-dom + Testing Library, Playwright e2e (CI only), tsx scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-afk-gains-page-design.md` (pt-BR; decisions A1–A11 are binding).

**Base:** branch `feat/afk-gains-page`, created from the tip of `feat/exp-multi-page` **after the whole EXP plan (`docs/superpowers/plans/2026-09-24-exp-multi-page.md`, Tasks 1–10) has been executed**. This plan needs the EXP kit (`lib/statTracker/*`, `components/statTracker/*`, `scripts/_shared/topStatCollector.ts`, `deriveGatedTalentsFor`) and the two EXP Task 3 helpers `votingMulti(ctx)` and `compassBonus(idx, s)` (`lib/arkh/stats/systems/exp/compass.ts`, which does not exist yet at the time of writing). Before Task 1, the controller runs these from `web/`: `git fetch origin`, `git switch feat/exp-multi-page`, `git pull --ff-only`, `git switch -c feat/afk-gains-page`. It then checks `ls lib/statTracker/config.ts components/statTracker/StatSnapshotSection.tsx scripts/_shared/topStatCollector.ts lib/arkh/stats/systems/exp/compass.ts` and `grep -rn "export function votingMulti\|export function deriveGatedTalentsFor\|export function directChildren" lib scripts` (stop if any is missing). Finally it commits the spec and this plan to `docs/superpowers/{specs,plans}/2026-09-24-afk-gains-page*.md`. The controller pushes after each task and opens the PR with base `feat/exp-multi-page`. Nobody merges.

## Global Constraints

- All commands run from `web/` inside `C:/Users/Vinicius/ClaudeCowork/Leaderboard Ranking Sheet - Idleon/.claude/worktrees/social-auth-game-save-sync-ea785d` on branch `feat/afk-gains-page`.
- **Never run `npm run dev` / `next dev`.** Verify with `npx vitest run <paths>`, `npx vitest run` (full) and `npx tsc --noEmit -p tsconfig.json`. Playwright e2e runs in CI only.
- Never read, print or commit `web/.env.local` or anything under `web/__tests__/fixtures/gameAuth/`.
- Private saves live only in `web/scripts/updater/golden/.cache/` (gitignored). Tests that read them use `describe.skipIf(!existsSync(SAVE))` and read the file in `beforeAll`. Never commit a save.
- Engine tests need the window shim at the top of the file: `const g = globalThis as unknown as { window?: unknown }; if (!g.window) g.window = g;`
- The arkh state is a module singleton, and `loadSaveData` doesn't reset every field. For example, `companionIds` is only assigned when non-empty, and `starSignsUnlocked` only when `StarSg` is present. So:
  - keep synthetic-save tests in files that never load a real save;
  - give synthetic envelopes an explicit `StarSg: {}`;
  - build synthetic OLA arrays sparse, because a `0` at OLA[606] switches companion 0 on through the Pet-Bonus Token CSV;
  - put loops over real saves last in a file.
- Site copy (UI strings) is in English. Code comments are in English, matching the density of the surrounding files.
- Stage only the files you changed (`git add <paths>`, never `git add -A` / `git add .`). Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push; the controller does.
- **Run the FULL suite (`npx vitest run`) and `tsc` before every commit**, not only the task's tests.
- N.js is the source of truth. The local copy is 25 MB: search it with small `node -e` scripts using `indexOf`/regex and print short slices; never `cat` or Read it whole. It lives at `C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad/dr/N.js`.
- **`// @njs <Name>` tags.**
  - A tag must name an entry present in `web/data/njs-snapshot/formulas.json` or `lists.json`. The full-suite test `__tests__/updater/registry.guard.test.ts` enforces this.
  - After adding, removing or renaming a tag, run `npx tsx scripts/updater/registry/gen-registry.ts` and commit the regenerated `scripts/updater/registry/formula-registry.gen.ts`.
  - Tag only the N.js function whose logic a file ports inline, not every helper it reuses.
  - Every other N.js reference gets plain prose: `// N.js <expr> (@offset)`.
  - Task 2 widens the scanner so underscore-led names (`_customBlock_*`, which the snapshot uses) register.
- **A new system's switch throws on unknown ids.** Task 2 therefore makes every source id resolve, using `pending(name)` (0, note `"pending port"`) for the 8 terms that Tasks 3–4 port. Task 4 deletes `pending`, and a test asserts that no node carries the note `"pending port"`.
- **Check every helper signature against the real code before calling it.** The call forms below were read from the code on 2026-09-24. For example:
  - `fountainBonusTotal(saveData, t, i)`;
  - `divinityData` is an export of `save/data.ts`, not a `saveData` field;
  - `etcBonus.resolve(n, { saveData, charIdx })` returns a % node;
  - `votingMulti` and `compassBonus` come from EXP Task 3, so read their final signatures before use.
- IdleonToolbox (GPL) is a read-only cross-check oracle; never copy its code.
- **Zero behavior change for Drop Rate, Coin Multi and EXP Multi**: numbers, localStorage keys, stored snapshots (flat-tree paths). These must stay green, unedited unless a task says so:
  - `__tests__/lib/arkh/family-guy-dr.test.ts` (DR 363,893.46);
  - `__tests__/lib/arkh/coin-multi.*` (Markhe 6.88E35);
  - `__tests__/lib/arkh/exp-multi.*`;
  - `__tests__/lib/coinMulti/*`, `__tests__/lib/expMulti/*`, `__tests__/components/statTracker/*`, `__tests__/components/accountSaveOverPaste.test.tsx`.
- Only additive changes to shared engine helpers: new functions, new table entries, and an optional return field that nothing else sets. `computeStarSignBonus`, `hasBonusMajor`, `computePrayerReal`, `computeChipBonus` and `getSetBonus` keep their behavior and their callers (spec "Fora de escopo").
- Don't add save keys to the loader: everything is already exposed, and `AFKtarget_N` is deliberately unused (spec A9).
- `talent.resolve(id, …)` already returns the wrapped value (TalentCalc counters, star talents). Never multiply by a counter again.
- Save arrays may deserialize as objects with a `"length"` key; when iterating save arrays, skip non-numeric keys.

## Reference data (read-only)

- Scratchpad root `SP` = `C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad`
- `SP/afk/afkfn.txt`: the verbatim N.js `_customBlock_AFKgainrates`. The Fighting branch is the `"Fighting"==d?(…)` part.
- `SP/night/starsigns_fn.txt`: the verbatim N.js `_customBlock_StarSigns` (DL build, 2nd pass, Seraph).
- `SP/afk/research.md`: the per-term inventory (N.js expression, arkh helper, status, IT name), the IT bugs and the map notes.
- `SP/afk/arkh-afk.mts`: a probe that evaluates every term with the existing helpers (4 decimals). From `web/`: `npx tsx "SP/afk/arkh-afk.mts" scripts/updater/golden/.cache/arkhe-live-2026-09-23.json 8 14`. Run probes as `.mts` files: with `tsx -e`, the `save/data.ts` exports read as their pre-load snapshot.
- `SP/afk/it-afk.mts`: the IT oracle runner. Run it from the MAIN checkout's `web/` (`C:/Users/Vinicius/ClaudeCowork/Leaderboard Ranking Sheet - Idleon/web`): `TSX_TSCONFIG_PATH=scripts/updater/.cache/it-live/tsconfig.json node --import tsx "SP/afk/it-afk.mts" "<worktree>/web/scripts/updater/golden/.cache/arkhe-live-2026-09-23.json" Markhe`. It prints `#8 Markhe … afkGains 418.94730659590607` plus IT's breakdown.
- Validation save (private): `web/scripts/updater/golden/.cache/arkhe-live-2026-09-23.json`.
  - 11 characters. Markhe = index 8, Royal Guardian, class level 1900, saved map 14 (`beanG`, FIGHTING).
  - The other 10 sit on map 216 in cavern 3 (`Holes[0]` = `[3,3,3,3,3,3,3,3,-1,3,3,-1]`), so they read 0% there.
  - `enabledStarSigns` = 245, Seraph ×10. Markhe equips signs `61,34,23`; the FightAFK signs come from the unlocked range. Her chips are `[9,20,21,15,16,17,18]` (a star chip, no `fafk`).
  - Prayers `[12,1,3,5,14,-1,…]` (Ruck Sack equipped). `bun_u` = 1, `GemItemsPurchased[9]` = 1, active vote 32, OLA[638] = 58, OLA[643] = 33.
  - Arcane slot-2 kills only on map 1 (441,562) and map 156 (37).
- N.js offsets:
  - AFK and display: `_customBlock_AFKgainrates` @4421667; AFK Info fighting row @3790178; type dispatch @3786279; Cove panel @11987854.
  - Fidelity helpers: `_customBlock_StarSigns` @6490716 (2nd pass @6491933, Seraph @6514021); `_customBlock_prayersReal` @7774914; `_customBlock_chipBonuses` @5139280 (filled by `RecalcChipBonuses` @7900506); `_customBlock_GetSetBonus` @11008519; `Bonus_MAJOR` @10683007.
  - Shops and upgrades: `_customBlock_FlurboShop` @7827791; `RooBonuses` @10827396; `CompassBonus` @10989794.
  - The Cove: `Cglunko_AFKgains` @10969315; `Cglunko_upgBon` @10969789.
- **Markhe, map 14: expected values** (arkh = N.js, full precision; IT agrees on every term except the ones marked).

  | Pool | id → value |
  |---|---|
  | `fight` | base 40 · fam8 4.369959677419355 · boxFightAFK 8.478260869565217 · talent88 18.616874135546336 · bribe3 5 · talent268 0 · cardSet10 0 · talent448 0 · talent621 6.340248962655601 · card43 0 · talent79 0 · etc20 62.58095607084296 · **etc59 719.5619263172074** (IT 699.2619263172074) · starFightAFK 120 · guild4 5 · prayer4 0 · curse12 −89 · chipFafk 0 · cardW6d1 7 → Σ 907.9482260332369 |
  | `all` | merit 2 · arcade6 8.039800995024876 · compass57 10.8 · voidSet 10 · flurbo7 5 · divMajor 30 · divMinor5 268.9841724997589 · comp6 8 · comp25 50 · shrine8 6.075 · talent650 2.5 · winBonus11 212.93999999999997 · **goldFoodAllAFK 5500.8382581543565** (IT 5492.85043625293) · cardW6d3 10.5 · roo5 1361.25 · vote6 0 · eventShop5 20 · vault23 59.1 · bunU 30 → Σ 7596.027231649141 |
  | `multi` | arcaneMapAfk 0 (map 14; 30.158131799045954 on map 1; 0.037 on map 156) · etc92 396.613269898924 |
  | totals | Σ 8503.975457682378 → G1 85.03975457682378 · G2 1 · G3 4.96613269898924 · **rate 422.31870591798446 → "42231"** · map 1: 549.6821378607555 → "54968" · map 306: 84.46374118359688 → "8446" · map 0: 0 |
  | IT | `getAfkGain` = 418.94730659590607. Its three proven bugs: base/100 (−0.396·MULTI), `etc59` without `account` (−20.3 pts), golden food (−7.9878 pts). Together they give 418.9473 + 0.678878219·4.96613 = 422.3187. |

## File structure

| File | Task | Responsibility |
|---|---|---|
| `web/lib/statTracker/config.ts` | 1 | `StatPageConfig.unit?: "x" \| "%"` |
| `web/components/statTracker/StatCalculator.tsx` | 1 | Headline number and its title in the config's unit |
| `web/components/statTracker/StatSnapshotSection.tsx` | 1 | Saved notice and history-table value in the config's unit |
| `web/lib/arkh/stats/defs/afk-gains.ts` | 2 | `AFK_ROOT`, `AFK_NODES`, `AFK_POOLS`, `AfkParts`, `afkRate`, the custom descriptor |
| `web/lib/arkh/stats/tree-builder.ts`, `web/lib/arkh/computeStat.ts` | 2 | Pass an optional root `note` returned by `combine` |
| `web/lib/arkh/stats/systems/afk/afk.ts` | 2–4 | `afk` system (one case per N.js term), `AFK_CLASS_TALENTS` |
| `web/lib/arkh/stats/registry.ts` | 2 | Register `afk` |
| `web/lib/arkh/computeAfk.ts` | 2, 5 | `computeArkhAfkGains`, `computeArkhAfkPools`, `combineAfkPools`, `bestAfkMapIdx` |
| `web/scripts/updater/registry/gen-registry.ts` (+ `formula-registry.gen.ts`) | 2–4 | Underscore-led `@njs` names; the regenerated registry |
| `web/lib/arkh/stats/systems/w3/prayer.ts` | 3 | `prayersReal` (with the super-bit branch) |
| `web/lib/arkh/stats/systems/w4/lab.ts` | 3 | `chipBonuses` (active character only) |
| `web/lib/arkh/stats/systems/common/starSign.ts` | 3 | `STAR_SIGN_TERMS`, `starSignBonusReal` |
| `web/lib/arkh/stats/systems/w3/setBonus.ts` | 4 | `void` in `SET_DATA`; the weapon part in `checkSetEquipped` |
| `web/lib/arkh/stats/systems/w5/divinity.ts` | 4 | `bonusMajorReal` |
| `web/lib/arkh/stats/systems/coin/coin.ts` | 4 | `flurboShop`, `rooBonus` (Coin's `flurbo4`/`roo6` call them) |
| `web/lib/arkh/stats/systems/exp/exp.ts` | 2, 4 | `@njs _customBlock_ExpMulti` tag (Task 2); `flurbo2` calls `flurboShop` (Task 4) |
| `web/scripts/update-top-afk.ts` | 6 | Collector config |
| `web/lib/afkGains/topAfkGains.ts` + `.meta.ts` | 6 | Generated Observed Max |
| `.github/workflows/refresh-top-max.yml` | 6 | Cron step |
| `web/lib/afkGains/pageConfig.ts` | 7 | `formatAfkGains`, `afkGainsModel`, `AFK_PAGE` |
| `web/app/afk-gains/{page.tsx,AfkGainsPageClient.tsx}` | 8 | Route |
| `web/components/TopNav.tsx`, `web/app/page.tsx`, `web/e2e/homepage.spec.ts` | 8 | Navigation |

---

### Task 1: Kit option `unit` (headline, snapshot notice, history table)

**Files:**
- Modify: `web/lib/statTracker/config.ts`
- Modify: `web/components/statTracker/StatCalculator.tsx`
- Modify: `web/components/statTracker/StatSnapshotSection.tsx`
- Test: `web/__tests__/components/statTracker/StatCalculator.test.tsx`, `web/__tests__/components/statTracker/StatSnapshotSection.test.tsx` (append)

**Interfaces:**
- Consumes: `StatPageConfig`, `StatCalculator`, `StatCalculatorState`, `StatSnapshotSection` and the test helpers `testConfig` / `loader` / `save()` / `state()` (EXP plan Tasks 6–7).
- Produces: `StatPageConfig.unit?: "x" | "%"`. When omitted, it is `"x"`, as today. With `"%"`, `formatTotal` returns the percent number and the kit prints it followed by `"%"` in the calculator headline, the snapshot notice and the history table. The headline's `title` becomes `(100·total).toFixed(2) + "%"`. Biggest Gains and Compare don't change.

- [ ] **Step 1: Write the failing tests.** Append to `StatCalculator.test.tsx` (add `import type { StatPageConfig } from "@/lib/statTracker/config";` next to the other imports) inside its `describe`:

```tsx
  it("prints a % stat's headline in its unit, with the percent as the title", async () => {
    const tree = { name: "Test Multi", val: 422.31870591798446, fmt: "x" as const, children: [] };
    const pct: StatPageConfig = {
      ...testConfig,
      unit: "%",
      formatTotal: (x) => String(Math.floor(100 * x)),
      compute: async () => ({ tree, total: tree.val }),
    };
    render(<StatCalculator config={pct} />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText("42231%")).toHaveAttribute("title", "42231.87%");
  });

  it("keeps the multiplier unit by default", async () => {
    const tree = { name: "Test Multi", val: 12.5, fmt: "x" as const, children: [] };
    render(<StatCalculator config={{ ...testConfig, compute: async () => ({ tree, total: 12.5 }) }} />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText("12.50x")).toHaveAttribute("title", "1.250000e+1x");
  });
```

Append to `StatSnapshotSection.test.tsx` inside its `describe`:

```tsx
  it("prints a % stat in the notice and the history table", async () => {
    const pct = { ...testConfig, unit: "%" as const, formatTotal: (x: number) => String(Math.floor(100 * x)) };
    localStorage.setItem(pct.storage.collapse, "0");
    render(<StatSnapshotSection config={pct} state={{ ...state(), total: 422.31870591798446 }} />);
    fireEvent.click(screen.getByText(/Save snapshot/));
    expect(screen.getByText(/Snapshot saved for Alpha — Test Multi 42231% on W1 · Spore Meadows/)).toBeInTheDocument();
    expect(await screen.findByText("42231%")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/components/statTracker`
Expected: FAIL on the two `%` cases. The headline and the notice print `42231x`, and `unit` is not a field of `StatPageConfig` (type error in the test).

- [ ] **Step 3: Implement.**

`lib/statTracker/config.ts`: add this field to `StatPageConfig`, right after `formatTotal`:

```ts
  /** Headline unit, default "x". "%": formatTotal returns the percent number
   *  (AFK Gains: ⌊100·rate⌋) and the kit prints it with "%" — calculator
   *  headline, snapshot notice and history table. Biggest Gains and Compare
   *  don't change. */
  unit?: "x" | "%";
```

`components/statTracker/StatCalculator.tsx`: declare `const unit = config.unit ?? "x";` inside the component, then replace the headline value span (EXP Task 7 wrote it as `total !== null ? config.formatTotal(total) + "x" : "—"` with the title `total !== null ? total.toExponential(6) + "x" : undefined`) with:

```tsx
          <span
            className="text-2xl font-extrabold text-gold tabular-nums"
            title={
              total !== null
                ? unit === "%"
                  ? (100 * total).toFixed(2) + "%"
                  : total.toExponential(6) + "x"
                : undefined
            }
          >
            {total !== null ? config.formatTotal(total) + unit : "—"}
          </span>
```

`components/statTracker/StatSnapshotSection.tsx`:
- in the component, add `const unit = config.unit ?? "x";`;
- in `onSave`, the notice becomes `` `Snapshot saved for ${snap.charName} — ${config.statName} ${config.formatTotal(snap.value)}${unit} on ${state.mapLabel}${nodeCount > 0 ? ` (${nodeCount} tree nodes captured)` : ""}` ``;
- pass `unit={unit}` and `formatTotal={config.formatTotal}` to `<HistoryTable …>`;
- `HistoryTable` gains the props `unit: "x" | "%"` and `formatTotal: (x: number) => string`;
- its value cell becomes:

```tsx
                <td className="px-2 py-2 text-right font-mono text-gold">
                  {unit === "%" ? (
                    <span title={String(s.value)}>{formatTotal(s.value)}%</span>
                  ) : (
                    <Num value={s.value} unit="x" />
                  )}
                </td>
```

- [ ] **Step 4: Run.** First `npx vitest run __tests__/components/statTracker __tests__/lib/statTracker __tests__/lib/coinMulti __tests__/lib/expMulti`, which must PASS: Coin and EXP don't set `unit`, so their tests are unchanged. Then `npx vitest run` (full) and `npx tsc --noEmit -p tsconfig.json` must be PASS and clean.

- [ ] **Step 5: Commit**

```bash
git add lib/statTracker/config.ts components/statTracker/StatCalculator.tsx components/statTracker/StatSnapshotSection.tsx __tests__/components/statTracker/StatCalculator.test.tsx __tests__/components/statTracker/StatSnapshotSection.test.tsx
git commit -m "feat(statTracker): unit option — a stat can read as % (headline, snapshots)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: AFK descriptor, system skeleton and entry point

**Files:**
- Create: `web/lib/arkh/stats/defs/afk-gains.ts`
- Create: `web/lib/arkh/stats/systems/afk/afk.ts`
- Create: `web/lib/arkh/computeAfk.ts`
- Modify: `web/lib/arkh/stats/tree-builder.ts` (optional `note` from `combine` onto the root)
- Modify: `web/lib/arkh/computeStat.ts` (same in `combineStatPools`)
- Modify: `web/lib/arkh/stats/registry.ts` (import `afk`, add `afk: afk as unknown as SystemResolver,` after `exp`)
- Modify: `web/scripts/updater/registry/gen-registry.ts` (underscore-led names), `web/lib/arkh/stats/systems/exp/exp.ts` (its stale "regex can't capture" comment becomes a tag), `web/scripts/updater/registry/formula-registry.gen.ts` (regenerated)
- Test: `web/__tests__/lib/arkh/afk-gains.combine.test.ts`, `web/__tests__/lib/arkh/afk-gains.smoke.test.ts`, `web/__tests__/lib/arkh/afk-gains.save.test.ts` (new)

**Interfaces:**
- Consumes:
  - `StatGroup` (`defs/grouped.ts`); `Descriptor`, `SourceSpec`, `Pool` (`tree-builder.ts`);
  - `computeStatTree`, `computeStatPools`, `combineStatPools`, `StatResult` (`computeStat.ts`);
  - from EXP Task 3: `votingMulti(ctx: SystemCtx): number` (exported from `systems/coin/coin.ts`) and `compassBonus(idx: number, s): number` (`systems/exp/compass.ts`). Read both first; if either returns a node or tree, use `.val`.
- Produces:
  - from `@/lib/arkh/stats/defs/afk-gains`:
    - `AFK_ROOT = "AFK Gains Rate"`;
    - `AFK_NODES` (`pool`, `arcane`, `etc92`, `clam`, `cove`, `type`);
    - `AFK_POOLS: readonly StatGroup[]`;
    - `type AfkParts`;
    - `afkRate(p: AfkParts): number`;
    - default `afkGainsDesc`;
  - the `afk` system and `AFK_CLASS_TALENTS = [79, 88, 268, 448] as const`, from `@/lib/arkh/stats/systems/afk/afk`;
  - from `@/lib/arkh/computeAfk`: `computeArkhAfkGains(raw, ci, map = 0) → StatResult`, `computeArkhAfkPools(raw, ci, map = 0) → Record<string, Pool>`, `combineAfkPools(pools) → StatResult`;
  - `Descriptor.combine` may return `note?: string`, which the root carries.

- [ ] **Step 1: Create the descriptor** `web/lib/arkh/stats/defs/afk-gains.ts`. It is complete: later tasks don't change it.

```ts
// ===== AFK GAINS RATE DESCRIPTOR =====
// N.js k._customBlock_AFKgainrates("Fighting") (@4421667): the fighting AFK
// gains rate the AFK Info panel prints as ⌊100·rate⌋% (spec A1–A3):
//   rate = max(.01, v)
//   v    = Cove rate                 on map 216 in cavern 17 (replaces all)
//        = 0.2 × Σ/100 × G2 × G3     on map 306 (Clamworks)
//        = Σ/100 × G2 × G3           elsewhere
//   Σ = 40 (base) + fight terms + ALL terms, G2 = 1 + arcane₂/100, G3 = 1 + Etc92/100
// × 0 when the map's AFK target isn't a fight (A9). Not a product of "1 + x"
// groups, so this is its own descriptor (not groupedDescriptor); afkRate() is
// the only copy of the shape (combine here + the Biggest Gains what-if).

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";
import type { StatGroup } from "./grouped";

export const AFK_ROOT = "AFK Gains Rate";

/** Tree node names. Fixed, so snapshot and Observed Max paths never move with
 *  the map (the monster and the AFK type go in the notes). */
export const AFK_NODES = {
  pool: "⚔️ Fighting AFK pool",
  arcane: "🗺️ Arcane map bonus (slot 2)",
  etc92: "🎽 AFK Gains multi gear (Etc 92)",
  clam: "🦪 Clamworks ×0.2 (map 306)",
  cove: "🏝️ Crystal Glunko Cove (map 216, cavern 17)",
  type: "🎯 AFK target type",
} as const;

/** Source pools (ids = the afk system's cases, N.js order). `fight` and `all`
 *  both land in G1; they stay separate so a future skill selector only swaps
 *  `fight`. `kind` only feeds the collector's neutral value for a zeroed
 *  class talent. */
export const AFK_POOLS: readonly StatGroup[] = [
  {
    key: "fight",
    name: "Fighting terms",
    kind: "pct",
    sources: [
      "base", "fam8", "boxFightAFK", "talent88", "bribe3", "talent268", "cardSet10", "talent448",
      "talent621", "card43", "talent79", "etc20", "etc59", "starFightAFK", "guild4", "prayer4",
      "curse12", "chipFafk", "cardW6d1",
    ],
  },
  {
    key: "all",
    name: "ALL (every AFK type)",
    kind: "pct",
    sources: [
      "merit", "arcade6", "compass57", "voidSet", "flurbo7", "divMajor", "divMinor5", "comp6",
      "comp25", "shrine8", "talent650", "winBonus11", "goldFoodAllAFK", "cardW6d3", "roo5",
      "vote6", "eventShop5", "vault23", "bunU",
    ],
  },
  { key: "multi", name: "MULTI", kind: "pct", sources: ["arcaneMapAfk", "etc92"] },
  { key: "rules", name: "Map rules", kind: "mult", sources: ["clamworks306", "cglunkoCove", "afkType"] },
];

export type AfkParts = {
  /** Σ of the fight + ALL pools, base 40 included. */
  sum: number;
  arcane: number;
  etc92: number;
  /** R1: 0.2 on map 306, else 1. */
  clam: number;
  /** R2: the Cove's rate when active, else 0. */
  cove: number;
  /** R3: 1 for a fight (or the Cove), 0 for Nothing / Paying_Respect / no definition. */
  type: number;
};

/** The one copy of the rate's shape. N.js adds the 0.4 base outside Σ/100;
 *  here it's the 40 inside Σ — equal up to float rounding (1e-16).
 *  ponytail: sum order differs from N.js's nesting at that level only. */
export function afkRate(p: AfkParts): number {
  const v = p.cove > 0 ? p.cove : (p.sum / 100) * (1 + p.arcane / 100) * (1 + p.etc92 / 100) * p.clam;
  return p.type * Math.max(0.01, v);
}

const num = (n: ArkhNode | undefined, dflt: number): number => {
  const v = Number(n?.val);
  return Number.isFinite(v) ? v : dflt;
};

const pools: Record<string, SourceSpec[]> = {};
for (const g of AFK_POOLS) pools[g.key] = g.sources.map((id) => ({ system: "afk", id }));

const afkGainsDesc: Descriptor = {
  id: "afk-gains",
  name: AFK_ROOT,
  scope: "character+map",
  category: "progression",
  pools,
  // No ctx: the Observed Max collector calls combine without one
  // (combineStatPools). Everything map-dependent arrives as a `rules` source.
  combine(p) {
    const items = (k: string) => p[k]?.items ?? [];
    const pool = [...items("fight"), ...items("all")];
    const [arcane, etc92] = items("multi");
    const [clam, cove, type] = items("rules");
    const parts: AfkParts = {
      sum: pool.reduce((a, it) => a + (Number(it.val) || 0), 0),
      arcane: num(arcane, 0),
      etc92: num(etc92, 0),
      clam: num(clam, 1),
      cove: num(cove, 0),
      type: num(type, 1),
    };
    const children: ArkhNode[] = [
      { name: AFK_NODES.pool, val: parts.sum / 100, fmt: "x", note: "Σ/100", children: pool },
      { name: AFK_NODES.arcane, val: 1 + parts.arcane / 100, fmt: "x", note: "× (1 + Σ/100)", children: arcane ? [arcane] : [] },
      { name: AFK_NODES.etc92, val: 1 + parts.etc92 / 100, fmt: "x", note: "× (1 + Σ/100)", children: etc92 ? [etc92] : [] },
      ...items("rules"),
    ];
    return { val: afkRate(parts), children, note: "max(1%, ·)" };
  },
};

export default afkGainsDesc;
```

- [ ] **Step 2: Let `combine` put a note on the root.**

`tree-builder.ts`: the `Descriptor.combine` return type becomes `{ val: number; children: ArkhNode[]; note?: string }`. In `buildTree`, add `...(result.note ? { note: result.note } : {}),` after `children: result.children,` in the returned node.

`computeStat.ts`: `combineStatPools` becomes:

```ts
export function combineStatPools(desc: Descriptor, pools: Record<string, Pool>): StatResult {
  const r = desc.combine(pools, {} as never);
  return {
    tree: { name: desc.name, val: r.val, fmt: "x", children: r.children, ...(r.note ? { note: r.note } : {}) },
    total: r.val,
  };
}
```

No other descriptor returns a `note`, so DR, Coin and EXP trees are unchanged.

- [ ] **Step 3: Create `computeAfk.ts`**

```ts
// ===== ARKH AFK GAINS ENTRY POINT =====
// mapIdx drives the map terms: arcane slot 2, Clamworks' ×0.2 (306), the
// Crystal Glunko Cove (216 + cavern 17) and whether the map's default AFK
// target is a fight (spec A9). See computeStat.ts.

import afkGainsDesc from "./stats/defs/afk-gains";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhAfkGains(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(afkGainsDesc, rawEnvelope, charIdx, mapIdx);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhAfkPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(afkGainsDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineAfkPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(afkGainsDesc, pools);
}
```

- [ ] **Step 4: Write the failing tests.**

`web/__tests__/lib/arkh/afk-gains.combine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { afkRate, AFK_NODES, AFK_ROOT } from "@/lib/arkh/stats/defs/afk-gains";
import { combineAfkPools } from "@/lib/arkh/computeAfk";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: 0,
  product: 0,
});
const pools = (o: { fight?: number[]; all?: number[]; multi?: number[]; rules?: number[] } = {}) => ({
  fight: pool(...(o.fight ?? [40])),
  all: pool(...(o.all ?? [])),
  multi: pool(...(o.multi ?? [0, 0])),
  rules: pool(...(o.rules ?? [1, 0, 1])),
});

describe("AFK Gains Rate combine", () => {
  it("is Σ/100 × (1 + arcane/100) × (1 + Etc92/100), with the base 40 inside Σ", () => {
    const { tree, total } = combineAfkPools(pools({ fight: [40, 60], all: [100], multi: [30, 400] }));
    expect(total).toBeCloseTo(2 * 1.3 * 5, 12);
    expect(tree).toMatchObject({ name: AFK_ROOT, fmt: "x", note: "max(1%, ·)" });
    expect(tree.children!.slice(0, 3).map((c) => c.name)).toEqual([AFK_NODES.pool, AFK_NODES.arcane, AFK_NODES.etc92]);
    expect(tree.children![0]).toMatchObject({ val: 2, fmt: "x", note: "Σ/100" });
    expect(tree.children![0].children).toHaveLength(3); // fight, then ALL
    expect(tree.children![1].val).toBeCloseTo(1.3, 12);
    expect(tree.children![2].val).toBe(5);
    expect(tree.children).toHaveLength(6); // + the three map rules
  });

  it("Clamworks multiplies by 0.2", () => {
    expect(combineAfkPools(pools({ fight: [40, 60], rules: [0.2, 0, 1] })).total).toBeCloseTo(0.2, 12);
  });

  it("the Cove replaces the whole rate", () => {
    expect(combineAfkPools(pools({ fight: [40, 960], multi: [30, 400], rules: [0.2, 1.67, 1] })).total).toBe(1.67);
  });

  it("never drops below 1%", () => {
    expect(combineAfkPools(pools({ fight: [40, -140] })).total).toBe(0.01);
  });

  it("a target that isn't a fight is 0, Cove or not", () => {
    expect(combineAfkPools(pools({ rules: [1, 0, 0] })).total).toBe(0);
    expect(combineAfkPools(pools({ rules: [1, 2, 0] })).total).toBe(0);
  });

  it("afkRate reproduces Markhe's map-14 rate from its parts", () => {
    expect(afkRate({ sum: 8503.975457682378, arcane: 0, etc92: 396.613269898924, clam: 1, cove: 0, type: 1 })).toBeCloseTo(422.31870591798446, 9);
  });
});
```

`web/__tests__/lib/arkh/afk-gains.smoke.test.ts`:

```ts
// CI smoke test — no private save. Every AFK source must resolve on an empty
// envelope (the afk switch throws on unknown ids), and the map rules must work
// on synthetic saves. Synthetic OLA arrays are sparse on purpose: a 0 at
// OLA[606] would switch companion 0 on (Pet-Bonus Token CSV).
import { describe, it, expect } from "vitest";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { AFK_POOLS } from "@/lib/arkh/stats/defs/afk-gains";
import { FORMULA_REGISTRY } from "@/scripts/updater/registry/formula-registry.gen";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const EMPTY = { charNames: ["A"], data: {} };

describe("AFK Gains smoke test", () => {
  it("resolves every source on an empty save; map 1 is the bare 40% base", () => {
    const { tree, total } = computeArkhAfkGains(EMPTY, 0, 1);
    expect(total).toBe(0.4);
    expect(tree.children).toHaveLength(6);
    const [fight, all] = AFK_POOLS;
    expect(tree.children![0].children).toHaveLength(fight.sources.length + all.sources.length);
    expect(tree.children![1].children).toHaveLength(1);
    expect(tree.children![2].children).toHaveLength(1);
  });

  it("a town (map 0, target Nothing) and a map without a target definition (3, JungleZ) are 0", () => {
    expect(computeArkhAfkGains(EMPTY, 0, 0).total).toBe(0);
    expect(computeArkhAfkGains(EMPTY, 0, 3).total).toBe(0);
  });

  it("a skill map (6, Copper = MINING) keeps the fighting rate, with a note", () => {
    const t = computeArkhAfkGains(EMPTY, 0, 6).tree;
    expect(t.val).toBe(0.4);
    expect(t.children![5].note).toMatch(/MINING/);
  });

  it("Clamworks (map 306) is ×0.2", () => {
    expect(computeArkhAfkGains(EMPTY, 0, 306).total).toBeCloseTo(0.08, 12);
  });

  it("the Crystal Glunko Cove (map 216, cavern 17) replaces the rate; ×1.3 with bun_u", () => {
    const ola: number[] = [];
    ola[638] = 58;
    ola[643] = 33;
    const cove = (cavern: number, bundles: Record<string, number>) => ({
      charNames: ["A"],
      data: { Holes: [[cavern]], OptLacc: ola, BundlesReceived: bundles },
    });
    // (10 + OLA[638]·RandoListo2[13][8] + OLA[643]·RandoListo2[13][13])/100 = (10 + 58·1 + 33·3)/100
    expect(computeArkhAfkGains(cove(17, { bun_u: 1 }), 0, 216).total).toBeCloseTo(1.67 * 1.3, 12);
    expect(computeArkhAfkGains(cove(17, {}), 0, 216).total).toBeCloseTo(1.67, 12);
    // Another cavern: MapAFKtarget[216] is "Nothing" → 0 (spec A9).
    expect(computeArkhAfkGains(cove(3, { bun_u: 1 }), 0, 216).total).toBe(0);
  });

  it("registers the port under N.js's AFKgainrates for the updater", () => {
    expect(FORMULA_REGISTRY["_customBlock_AFKgainrates"]).toEqual(["lib/arkh/stats/systems/afk/afk.ts"]);
  });
});
```

`web/__tests__/lib/arkh/afk-gains.save.test.ts`. `close` and `srcIn` are at module level because Task 5 adds a second `describe`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { AFK_POOLS } from "@/lib/arkh/stats/defs/afk-gains";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getAfkGain breakdown on this exact
// file for Markhe on map 14 (SP/afk/it-afk.mts), unless a comment says
// N.js ≠ IT (spec A7: IT has three proven bugs).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

const close = (actual: number, expected: number) => {
  if (expected === 0) expect(actual).toBe(0);
  else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
};

/** A source's value, found by its pool position (G1 = fight then ALL). */
const srcIn = (tree: ArkhNode, id: string): number => {
  const [fight, all, multi, rules] = AFK_POOLS.map((p) => p.sources);
  const kids = tree.children!;
  if (fight.includes(id)) return Number(kids[0].children![fight.indexOf(id)].val);
  if (all.includes(id)) return Number(kids[0].children![fight.length + all.indexOf(id)].val);
  if (multi.includes(id)) return Number(kids[1 + multi.indexOf(id)].children![0].val);
  return Number(kids[3 + rules.indexOf(id)].val);
};

describe.skipIf(!existsSync(SAVE))("AFK Gains Rate — Markhe on map 14 vs IdleonToolbox", () => {
  let tree: ArkhNode;
  beforeAll(() => {
    const save = JSON.parse(readFileSync(SAVE, "utf8"));
    tree = computeArkhAfkGains(save, save.charNames.indexOf("Markhe"), 14).tree;
  });
  const src = (id: string) => srcIn(tree, id);

  it.each<[string, number]>([
    // fight pool
    ["base", 40],
    ["fam8", 4.369959677419355],
    ["boxFightAFK", 8.478260869565217],
    ["talent88", 18.616874135546336],
    ["bribe3", 5],
    ["talent268", 0],
    ["cardSet10", 0],
    ["talent448", 0],
    ["talent621", 6.340248962655601],
    ["card43", 0],
    ["talent79", 0],
    ["etc20", 62.58095607084296],
    // N.js ≠ IT: IT calls getStatsFromGear(ch, 59) without `account` → 699.2619263172074
    // (loses the Silkrode chip ×2 and Well-Dressed); N.js EtcBonuses("59") has them.
    ["etc59", 719.5619263172074],
    ["guild4", 5],
    ["cardW6d1", 7],
    // ALL pool
    ["merit", 2],
    ["arcade6", 8.039800995024876],
    ["compass57", 10.8],
    ["divMinor5", 268.9841724997589],
    ["comp6", 8],
    ["comp25", 50],
    ["shrine8", 6.075],
    ["talent650", 2.5],
    ["winBonus11", 212.93999999999997],
    // N.js ≠ IT: IT 5492.85043625293; arkh's golden-food multi is the one
    // validated to the cent on the DR (talent 209 getbonus2, PR #28).
    ["goldFoodAllAFK", 5500.8382581543565],
    ["cardW6d3", 10.5],
    ["vote6", 0], // vote 32 is the active one on this save
    ["eventShop5", 20],
    ["vault23", 59.1],
    ["bunU", 30],
    // MULTI and the map rules
    ["arcaneMapAfk", 0], // map 14 has no slot-2 kills
    ["etc92", 396.613269898924],
    ["clamworks306", 1],
    ["cglunkoCove", 0],
    ["afkType", 1], // beanG is FIGHTING
  ])("%s", (id, expected) => close(src(id), expected));
});
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/afk-gains.combine.test.ts __tests__/lib/arkh/afk-gains.smoke.test.ts __tests__/lib/arkh/afk-gains.save.test.ts`
Expected: FAIL. The `afk` system is missing, so every item reads `[afk] not implemented`, and the registry has no `_customBlock_AFKgainrates` key.

- [ ] **Step 6: Create the system** `web/lib/arkh/stats/systems/afk/afk.ts`. Here is the full file. It already has the Task-3/4 terms as `pending` cases, so the switch never throws on a known id:

```ts
// ===== AFK GAINS SYSTEM =====
// One id per term of N.js k._customBlock_AFKgainrates("Fighting") (@4421667,
// live sha 6de681a96813; verbatim text in SP/afk/afkfn.txt). Pool terms return
// a % amount (defs/afk-gains.ts sums them into Σ); the map rules return what
// afkRate() reads: R1 a factor, R2 the Cove's replacement rate, R3 0 or 1.
// Existing helpers are reused as-is. The spec A4 fixes are new functions next
// to the old ones, which keep feeding the Drop Rate.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData } from "../../../save/data";
import { eventShopOwned } from "../../../game-helpers";
import { label } from "../../entity-names";
import { MapAFKtarget, RandoListo2 } from "../../data/game/customlists.js";
import { MONSTERS } from "../../data/game/monsters.js";
import { AFK_NODES } from "../../defs/afk-gains";
import { talent } from "../common/talent";
import { companions } from "../common/companions";
import { etcBonus } from "../common/etcBonus";
import { familyBonus } from "../common/familyBonus";
import { guild } from "../common/guild";
import { goldFoodBonuses } from "../common/goldenFood";
import { vaultUpgBonus } from "../common/vault";
import { computeBoxReward, computeCardBonusByType } from "../common/stats";
import { computeCardLv, computeCardSetBonus } from "../common/cards";
import { arcadeBonus } from "../w2/arcade";
import { votingBonusz } from "../w2/voting";
import { getBribeBonus } from "../w3/bribe";
import { computeShrine } from "../w3/construction";
import { computeWinBonus } from "../w6/summoning";
import { computeArcaneMapMultiBon } from "../mc/tesseract";
import { divinityMinorSum } from "../coin/divinityMinor";
import { votingMulti } from "../coin/coin";
import { compassBonus } from "../exp/compass";

/** Class talents of the formula (per-character GetTalentNumber) — spec A10.
 *  621 (Tick Tock) and 650 (Rando Event Looty) are star talents of every class. */
export const AFK_CLASS_TALENTS = [79, 88, 268, 448] as const;

const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
const factor = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x", note });
/** Terms ported in a later task of the AFK plan; 0 (neutral in Σ) until then. */
const pending = (name: string): ArkhNode => node(name, 0, null, { fmt: "+", note: "pending port" });

// @njs _customBlock_AFKgainrates
function resolveAfk(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const map = ctx.mapIdx ?? (Number((currentMapData as any)?.[ci]) || 0);
  const cavern = Number((s.holesData as any)?.[0]?.[ci]);
  const cove = map === 216 && cavern === 17;

  switch (id) {
    // ── Fighting terms (N.js order) ──
    // N.js (.4 + (…)/100): the 0.4 base as a visible 40% source (spec A3).
    case "base":
      return pct("Base fighting rate (40%)", 40);
    // N.js DNSM.FamBonusQTYs["8"] — the active char's Family Guy buff included.
    case "fam8":
      return familyBonus.resolve(4, tctx);
    // N.js DNSM.BoxRewards.fightAFK (Civil War Memory Box).
    case "boxFightAFK": {
      const r = computeBoxReward(ci, "fightAFK");
      return pct("Post Office (fightAFK)", r.val, r.children);
    }
    // N.js GetTalentNumber(1,n) / TalentCalc(650): talent.resolve already
    // returns the wrapped value. The label keeps "(Talent n)" — the
    // collector's class gating matches that suffix.
    case "talent88":
    case "talent268":
    case "talent448":
    case "talent621":
    case "talent79":
    case "talent650": {
      const n = Number(id.slice(6));
      const t = talent.resolve(n, tctx);
      return pct(label("Talent", n), Number(t.val) || 0, t.children);
    }
    case "bribe3": {
      const r = getBribeBonus("3", s);
      return pct(label("Bribe", 3), r.val, r.children);
    }
    case "cardSet10": {
      const r = computeCardSetBonus(ci, "10");
      return pct("Card Set 10 (Fight AFK)", r.val, r.children);
    }
    case "card43": {
      const r = computeCardBonusByType(43, ci, s);
      return pct("Cards (Card Type 43)", r.val, r.children);
    }
    // N.js EtcBonuses("20") / ("59") — numeric ids (a string id drops gallery items).
    case "etc20":
    case "etc59":
      return etcBonus.resolve(Number(id.slice(3)), { saveData: s, charIdx: ci });
    case "starFightAFK":
      return pending("Star signs (FightAFK)");
    case "guild4":
      return guild.resolve(4, tctx);
    case "prayer4":
      return pending(label("Prayer", 4));
    case "curse12":
      return pending("Ruck Sack curse (Prayer 12)");
    case "chipFafk":
      return pending("Lab chip (fafk)");
    // N.js CardLv("w6d1") ×1.
    case "cardW6d1":
      return pct("Card w6d1 (Fighting AFK, passive)", computeCardLv("w6d1", s));

    // ── ALL (every AFK type) ──
    // N.js Tasks[2][1][2] > charIdx → AFKgainzzALL = 2 (the W2 merit).
    case "merit": {
      const lv = Number((s.tasksGlobalData as any)?.[2]?.[1]?.[2]) || 0;
      return pct("W2 merit: +2% AFK Gains for your first characters", lv > ci ? 2 : 0, [
        raw("Merit level (Tasks[2][1][2])", lv),
      ]);
    }
    case "arcade6": {
      const r = arcadeBonus(6, s);
      return pct(label("Arcade", 6), r.val, r.children);
    }
    // N.js Windwalker("CompassBonus",57,0): CompassUpg[57][9] = 0, so no
    // compass 39/80 factor (EXP Task 3's compassBonus handles both branches).
    case "compass57":
      return pct("Compass 57", compassBonus(57, s));
    case "voidSet":
      return pending("Void Set Bonus");
    case "flurbo7":
      return pending("Flurbo Shop 7 (AFK Gains)");
    case "divMajor":
      return pending("Divinity major bonus ×30 (type 0)");
    // N.js Divinity("Bonus_Minor",-1,5).
    case "divMinor5":
      return pct("Divinity minor bonus 5", divinityMinorSum(5, ci, s));
    case "comp6":
    case "comp25": {
      const n = Number(id.slice(4));
      return pct(label("Companion", n), companions(n, s));
    }
    // N.js Shrine(8) — its map gate isn't modelled (spec A5, like DR and EXP).
    case "shrine8":
      return pct(label("Shrine", 8), computeShrine(8, s), null, "treated as always active (spec A5)");
    case "winBonus11":
      return pct("Summoning win bonus 11", computeWinBonus(11, null, s));
    case "goldFoodAllAFK":
      return pct("Golden food (AllAFK)", goldFoodBonuses("AllAFK", ci, undefined, s).total);
    // N.js 1.5*CardLv("w6d3").
    case "cardW6d3": {
      const lv = computeCardLv("w6d3", s);
      return pct("Card w6d3 ×1.5 (All AFK, passive)", 1.5 * lv, [raw("Card level", lv)]);
    }
    case "roo5":
      return pending("Kangaroo AFK Gains (Roo 5)");
    // N.js Summoning("VotingBonusz",6,0): 0 unless vote 6 is the active one.
    case "vote6": {
      const m = votingMulti(ctx);
      return pct("Vote 6 (AFK Gains)", votingBonusz(6, m, s), [factor("Voting multi", m)]);
    }
    // N.js 20*EventShopOwned(5).
    case "eventShop5": {
      const owned = eventShopOwned(5, s.cachedEventShopStr || "");
      return pct("Event Shop 5 (×20)", 20 * owned, [raw("Owned", owned)]);
    }
    case "vault23":
      return pct(label("Vault", 23), vaultUpgBonus(23, s));
    // N.js 1==BundlesReceived.bun_u → AFKgainzzALL += 30 (after MULTI, still in ALL).
    case "bunU": {
      const owned = Number((s.bundlesData as any)?.bun_u) === 1 ? 1 : 0;
      return pct("AFK Bundle (bun_u)", 30 * owned, [raw("Owned", owned)]);
    }

    // ── MULTI ──
    // N.js ArcaneType("ArcaneMapMulti_bon",2,0) = min(bonMAX, ArcaneMapMulti(MapBon[map][2])).
    case "arcaneMapAfk": {
      const kills = Number((ctx.mapBon as any)?.[map]?.[2]) || 0;
      return pct(
        "Arcane map bonus (slot 2, AFK)",
        computeArcaneMapMultiBon(2, { ...ctx, mapIdx: map } as any),
        [raw("Kills (mapBon[map][2])", kills)]
      );
    }
    case "etc92":
      return etcBonus.resolve(92, { saveData: s, charIdx: ci });

    // ── Map rules (spec A3 / A9) ──
    // N.js 306==CurrentMap → AFKgainzzDNz = .2*(…the same sum…).
    case "clamworks306":
      return factor(AFK_NODES.clam, map === 306 ? 0.2 : 1, null, map === 306 ? "Clamworks: AFK gains are 1/5" : `map ${map}: no effect`);
    // N.js 216==CurrentMap && 17==Holes[0][ci] → AFKgainzzDNz =
    // Holes2("Cglunko_AFKgains") × (1 + 30·min(1, bun_u)/100), with
    // Cglunko_AFKgains = (10 + Cglunko_upgBon(8) + Cglunko_upgBon(13))/100 (@10969315)
    // and Cglunko_upgBon(i) = OLA[630+i]·RandoListo2[13][i] (@10969789).
    // @njs _customBlock_Holes2
    case "cglunkoCove": {
      const u8 = ola(638) * (Number((RandoListo2 as any)[13]?.[8]) || 0);
      const u13 = ola(643) * (Number((RandoListo2 as any)[13]?.[13]) || 0);
      const bun = Math.min(1, Number((s.bundlesData as any)?.bun_u) || 0);
      const rate = ((10 + u8 + u13) / 100) * (1 + (30 * bun) / 100);
      return factor(
        AFK_NODES.cove,
        cove ? rate : 0,
        [raw("Cavern (Holes[0][char])", cavern), raw("Cglunko upgrade 8", u8), raw("Cglunko upgrade 13", u13), raw("AFK Bundle (bun_u)", bun)],
        cove ? "replaces the whole rate" : "inactive: not map 216 in cavern 17"
      );
    }
    // AFK Info dispatch (@3786279): the panel shows AFKgainrates(type of the
    // AFK target); "Nothing" / "Paying_Respect" print a literal 0%. The page
    // uses the map's default target (spec A9 — AFKtarget_N only describes the
    // saved map); the Cove counts as a fight (@11987854).
    case "afkType": {
      const monster = String((MapAFKtarget as any)[map] ?? "");
      const type = cove ? "FIGHTING" : String((MONSTERS as any)[monster]?.AFKtype ?? "no definition");
      const none = type === "Nothing" || type === "Paying_Respect" || type === "no definition";
      const skill = !none && type !== "FIGHTING";
      return factor(
        AFK_NODES.type,
        none ? 0 : 1,
        null,
        `Map ${map} · ${cove ? "Crystal Glunko Cove" : monster} · ${type}` +
          (skill ? " — skill target: this page shows the fighting rate" : "")
      );
    }

    default:
      throw new Error(`afk: unknown source "${id}"`);
  }
}

export const afk = { resolve: resolveAfk };
```

Verify before running: `votingMulti` is really exported from `systems/coin/coin.ts`. If EXP Task 3 put it elsewhere, fix the import (`grep -rn "export function votingMulti" lib/arkh`). Also check the return types of `votingMulti` and `compassBonus` (see Interfaces).

- [ ] **Step 7: Register the system and the `@njs` names.**
  - `lib/arkh/stats/registry.ts`: add `import { afk } from "./systems/afk/afk";` and `afk: afk as unknown as SystemResolver,` after the `exp` entry.
  - `scripts/updater/registry/gen-registry.ts`: allow a leading underscore. The snapshot keys N.js functions as `_customBlock_*`, and the current regex silently skips them:

```ts
// First char may be "_": the snapshot keys N.js functions as _customBlock_*.
const ANNOT = /\/\/\s*@njs\s+([A-Za-z_][A-Za-z0-9_]*(?:\[[0-9]+\])?)/g;
```

  - `lib/arkh/stats/systems/exp/exp.ts`: the comment above `resolveExp` says the guard's regex can't capture `_customBlock_ExpMulti`, which is no longer true. Replace that sentence with a `// @njs _customBlock_ExpMulti` line; the name is in `formulas.json`.
  - Regenerate: `npx tsx scripts/updater/registry/gen-registry.ts`. The registry now also lists the pre-existing `_customBlock_Companions` (`stats/data/common/companions.ts`) and `_customBlock_JellyOperation` (`stats/data/w7/jelly.ts`) tags; both are in `formulas.json`. If the guard then reports a newly captured underscore name that is missing from the snapshot, turn that tag into plain prose.

- [ ] **Step 8: Run the tests.** Fix values by re-reading N.js, not by editing expectations. An expectation may change only with a `// N.js ≠ IT:` comment that cites the N.js offset.

Run: `npx vitest run __tests__/lib/arkh/afk-gains.combine.test.ts __tests__/lib/arkh/afk-gains.smoke.test.ts __tests__/lib/arkh/afk-gains.save.test.ts __tests__/updater/registry.guard.test.ts __tests__/lib/arkh/family-guy-dr.test.ts __tests__/lib/arkh/coin-multi.save.test.ts __tests__/lib/arkh/exp-multi.save.test.ts`
Expected: PASS. The save test runs locally because the private save exists. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 9: Commit**

```bash
git add lib/arkh/stats/defs/afk-gains.ts lib/arkh/stats/systems/afk/afk.ts lib/arkh/computeAfk.ts lib/arkh/stats/tree-builder.ts lib/arkh/computeStat.ts lib/arkh/stats/registry.ts lib/arkh/stats/systems/exp/exp.ts scripts/updater/registry/gen-registry.ts scripts/updater/registry/formula-registry.gen.ts __tests__/lib/arkh/afk-gains.combine.test.ts __tests__/lib/arkh/afk-gains.smoke.test.ts __tests__/lib/arkh/afk-gains.save.test.ts
git commit -m "feat(arkh): AFK Gains Rate descriptor, system and entry point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Active star signs, super-bit prayers, per-character chips

**Files:**
- Modify: `web/lib/arkh/stats/systems/w3/prayer.ts` (add `prayersReal`)
- Modify: `web/lib/arkh/stats/systems/w4/lab.ts` (add `chipBonuses`)
- Modify: `web/lib/arkh/stats/systems/common/starSign.ts` (add `STAR_SIGN_TERMS`, `starSignBonusReal`)
- Modify: `web/lib/arkh/stats/systems/afk/afk.ts` (cases `starFightAFK`, `prayer4`, `curse12`, `chipFafk`)
- Modify: `web/scripts/updater/registry/formula-registry.gen.ts` (regenerated)
- Test: `web/__tests__/lib/arkh/afk-fidelity.test.ts` (new), `web/__tests__/lib/arkh/afk-gains.save.test.ts` (append)

**Interfaces:**
- Consumes: Task 2's `resolveAfk`, `pct` and `pending`.
- Produces (the Multikill plan reuses all three):
  - `prayersReal(idx: number, cost: number, ci: number, saveData: SaveData): TreeResult`, in `systems/w3/prayer.ts`;
  - `chipBonuses(key: string, ci: number): number`, in `systems/w4/lab.ts`;
  - `STAR_SIGN_TERMS: Record<string, readonly SignTerm[]>` and `starSignBonusReal(key: string, ci: number, saveData: SaveData): StarSignTree`, in `systems/common/starSign.ts`.

- [ ] **Step 1: Write the failing tests.**

`web/__tests__/lib/arkh/afk-fidelity.test.ts`:

```ts
// Synthetic saves for the AFK fidelity helpers (spec A4). This file never
// loads a real save: the arkh state is a singleton and loadSaveData doesn't
// reset every field, so each envelope spells out what it relies on.
import { describe, it, expect } from "vitest";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { prayersReal, computePrayerReal } from "@/lib/arkh/stats/systems/w3/prayer";
import { chipBonuses, computeChipBonus } from "@/lib/arkh/stats/systems/w4/lab";
import { starSignBonusReal, computeStarSignBonus } from "@/lib/arkh/stats/systems/common/starSign";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("starSignBonusReal (FightAFK)", () => {
  const load = (signs: string, lv: number, extra: Record<string, unknown> = {}) =>
    loadSaveData({ charNames: ["A"], data: { PVtStarSign_0: signs, Lv0_0: [lv], StarSg: {}, ...extra } });
  const STAR_CHIP = { Lab: [[], [15, -1, -1, -1, -1, -1, -1]] }; // Silkrode Nanochip ("star")

  it("sign 54 equipped at or above the enabled count costs 7", () => {
    load("54", 120);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(-7);
    expect(computeStarSignBonus("FightAFK", 0, saveData).val).toBe(6); // the DR's reading is untouched
  });

  it("sign 56 needs class level 100", () => {
    load("56", 99);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(0);
    load("56", 100);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(4);
  });

  it("a sign that isn't equipped (and no enabled signs) doesn't count", () => {
    load("12", 120);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(0);
  });

  it("one star chip with 0 enabled signs doubles the equipped positives, not a negative total", () => {
    load("19,28", 120, STAR_CHIP);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(16);
    load("19,54", 120, STAR_CHIP);
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(-5);
  });

  it("Seraph multiplies positive totals only", () => {
    load("19", 120, { StarSg: { Seraph_Cosmos: 1 } }); // Seraph 1.1 (no Arcane 40, summoning 0)
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBeCloseTo(2.2, 12);
    load("54", 120, { StarSg: { Seraph_Cosmos: 1 } });
    expect(starSignBonusReal("FightAFK", 0, saveData).val).toBe(-7);
  });
});

describe("prayersReal", () => {
  const NONE = [-1, -1, -1, -1, -1, -1];
  // Prayer level 11 → scale 1 + 10/10 = 2. Gaming[12] holds the super bits
  // as N2L letters: 9 = "i", 39 = "M", 53 = "肥".
  const load = (prayers: number[], bits: string) =>
    loadSaveData({
      charNames: ["A"],
      data: {
        StarSg: {},
        Prayers_0: prayers,
        PrayOwned: [0, 0, 0, 0, 11, 11, 0, 0, 0, 0, 0, 0, 11],
        Gaming: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, bits],
      },
    });

  it("no prayer equipped + Super Bit 9: 0.2 × base × level scale", () => {
    load(NONE, "i");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(2); // round(0.2 · 5 · 2)
    expect(computePrayerReal(4, 0, 0, saveData).val).toBe(0); // the old helper stays equipped-only
  });

  it("Super Bits 9 + 39 + 53 add up", () => {
    load(NONE, "iM肥");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(6); // round(0.6 · 5 · 2)
  });

  it("curses, prayer 5 and a locked prayer give 0 in that branch", () => {
    load(NONE, "i");
    expect(prayersReal(12, 1, 0, saveData).val).toBe(0);
    expect(prayersReal(5, 0, 0, saveData).val).toBe(0);
    expect(prayersReal(0, 0, 0, saveData).val).toBe(0); // PrayOwned[0] = 0
  });

  it("an equipped prayer keeps the equipped branch", () => {
    load([4, -1, -1, -1, -1, -1], "i");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(10); // round(5 · 2)
  });

  it("Super Bit 53 alone doesn't open the branch", () => {
    load(NONE, "肥");
    expect(prayersReal(4, 0, 0, saveData).val).toBe(0);
  });
});

describe("chipBonuses", () => {
  it("sums only the active character's lab chips", () => {
    loadSaveData({ charNames: ["A", "B"], data: { StarSg: {}, Lab: [[], [7, -1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1]] } });
    expect(chipBonuses("fafk", 0)).toBe(15); // Conductive Software
    expect(chipBonuses("fafk", 1)).toBe(0);
    expect(computeChipBonus("fafk")).toBe(15); // the account-wide helper is unchanged
  });

  it("counts chip 0 (only -1 is an empty slot)", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Lab: [[], [0, 0, -1, -1, -1, -1, -1]] } });
    expect(chipBonuses("def", 0)).toBe(20); // Grounded Nanochip ×2
  });
});
```

Append inside the `describe` of `afk-gains.save.test.ts`:

```ts
  it.each<[string, number]>([
    // Signs 19 + 28 + 56 come from the unlocked range (enabled 245; 29 and 54
    // are below it, so no penalty): 12 × Seraph 10.
    ["starFightAFK", 120],
    ["prayer4", 0],
    ["curse12", -89], // Ruck Sack equipped, level 50: round(15 · 5.9)
    ["chipFafk", 0],
  ])("%s", (id, expected) => close(src(id), expected));
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/afk-fidelity.test.ts __tests__/lib/arkh/afk-gains.save.test.ts`
Expected: FAIL. The three exports are missing, and `starFightAFK` / `curse12` read 0 (pending).

- [ ] **Step 3: Implement.**

`systems/w3/prayer.ts`: add `import { superBitType } from "../../../game-helpers";` and:

```ts
/** N.js prayersReal(idx, cost) (@7774914) with both branches. With no prayer
 *  equipped (every Prayers_ci slot is −1) and Super Bit 9 or 39 owned, each
 *  unlocked prayer — not 5, not a curse — gives
 *  round((0.2·SB9 + 0.2·SB39 + 0.2·SB53)·PrayerInfo[idx][3]·max(1, 1 + (lv−1)/10)).
 *  Otherwise it's the equipped branch of computePrayerReal, which DR/Coin keep. */
// @njs _customBlock_prayersReal
export function prayersReal(idx: number, cost: number, ci: number, saveData: SaveData): TreeResult {
  const slots = (prayersPerCharData as any)[ci];
  const noneEquipped = Array.isArray(slots) && slots.length > 0 && slots.every((p: unknown) => Number(p) === -1);
  const g12 = (saveData.gamingData as any)?.[12];
  const sb9 = superBitType(9, g12);
  const sb39 = superBitType(39, g12);
  if ((sb9 !== 1 && sb39 !== 1) || !noneEquipped) return computePrayerReal(idx, cost, ci, saveData);
  const lv = Number((saveData.prayOwnedData as any)?.[idx]) || 0;
  if (idx === 5 || cost === 1 || !(lv > 0.5)) return treeResult(0);
  const bits = 0.2 * sb9 + (0.2 * sb39 + 0.2 * superBitType(53, g12));
  const base = prayerBaseBonus(idx);
  const scale = Math.max(1, 1 + (lv - 1) / 10);
  return treeResult(Math.round(bits * base * scale), [
    node("Super Bits 9/39/53 (no prayer equipped)", bits, null, { fmt: "x" }),
    node("Base Bonus", base, null, { fmt: "raw" }),
    node("Prayer Lv", lv, null, { fmt: "raw" }),
    node("Level Scale", scale, null, { fmt: "x" }),
  ]);
}
```

`systems/w4/lab.ts` (it already imports `labData` and `ChipDesc`):

```ts
/** N.js chipBonuses(key) (@5139280) = DNSM.ChipBbonusz[key], which
 *  RecalcChipBonuses (@7900506) fills from the ACTIVE character's seven lab
 *  slots (Lab[1+ci], −1 = empty): Σ ChipDesc[c][11] over chips whose [10] is
 *  `key`. computeChipBonus sums every character's chips (the DR's reading). */
// @njs _customBlock_chipBonuses
// @njs RecalcChipBonuses
export function chipBonuses(key: string, ci: number): number {
  const slots = (labData as any)?.[1 + ci];
  if (!slots) return 0;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const c = Number(slots[i]);
    if (!Number.isFinite(c) || c === -1) continue;
    const row = (ChipDesc as any)[c | 0];
    if (row && row[10] === key) total += Number(row[11]) || 0;
  }
  return total;
}
```

`systems/common/starSign.ts`: extend the imports to `import { labData, starSignData } from "../../../save/data";`, `import { StarSigns } from "../../data/game/customlists.js";` and `import { chipBonuses } from "../w4/lab";` (there is no import cycle: `lab.ts` never reaches `starSign.ts`). Then append:

```ts
// ── Active star signs (the faithful per-key sum) ────────────────────────
// N.js _customBlock_StarSigns (@6490716). A sign counts only when it is in
// StarSignsDL = the character's equipped signs (PVtStarSign_ci) ∪ every
// k < enabledStarSigns whose name is in StarSignsUnlocked. Some lines only
// apply while the sign is at or above the enabled count (29, 54) or above a
// class level (56). One star chip with no enabled signs re-adds the equipped
// signs (2nd pass, @6491933) unless pass 1 went negative (N.js restores the
// negatives); Seraph multiplies positive totals only (@6514021).
// computeStarSignBonus above keeps the DR's "every listed sign" reading.

type SignTerm = {
  sign: number;
  val: number;
  /** Only while sign ≥ enabledStarSigns (N.js `sign > enabled − 1`). */
  notEnabled?: boolean;
  /** Only when the class level Lv0[0] is above this. */
  lvAbove?: number;
};

// @njs _customBlock_StarSigns
export const STAR_SIGN_TERMS: Record<string, readonly SignTerm[]> = {
  FightAFK: [
    { sign: 19, val: 2 },
    { sign: 28, val: 6 },
    { sign: 29, val: -6, notEnabled: true },
    { sign: 54, val: -7, notEnabled: true },
    { sign: 56, val: 4, lvAbove: 99 },
  ],
};

export function starSignBonusReal(key: string, ci: number, saveData: SaveData): StarSignTree {
  const terms = STAR_SIGN_TERMS[key] ?? [];
  const enabled = getEnabledStarSigns(saveData);
  const lv = Number((saveData.lv0AllData as any)?.[ci]?.[0]) || 0;
  const equipped = new Set(String((starSignData as any)?.[ci] ?? "").split(","));
  const active = new Set(equipped);
  const unlocked = saveData.starSignsUnlocked;
  const names = StarSigns as unknown as string[][];
  if (unlocked && typeof unlocked === "object" && !Array.isArray(unlocked)) {
    for (let k = 0; k < enabled && k < names.length; k++) {
      const nm = names[k]?.[0];
      if (nm && nm in unlocked) active.add(String(k));
    }
  }
  const counted = (dl: Set<string>) =>
    terms.filter(
      (t) => dl.has(String(t.sign)) && (!t.notEnabled || t.sign > enabled - 1) && (t.lvAbove == null || lv > t.lvAbove)
    );
  const sumOf = (ts: readonly SignTerm[]) => ts.reduce((a, t) => a + t.val, 0);
  const pass1 = counted(active);
  const sum1 = sumOf(pass1);
  const again = chipBonuses("star", ci) === 1 && !(enabled >= 1) && sum1 >= 0 ? counted(equipped) : [];
  const base = sum1 + sumOf(again);
  const seraph = base > 0 ? computeSeraphMulti(ci, saveData) : 1;
  const children: ArkhNode[] = pass1.map((t) => node(label("Star Sign", t.sign), t.val, null, { fmt: "+" }));
  if (again.length) children.push(node("Star chip: equipped signs count twice", sumOf(again), null, { fmt: "+" }));
  if (seraph !== 1) children.push(node("Seraph Multi", seraph, null, { fmt: "x" }));
  return { val: base * seraph, children };
}
```

`systems/afk/afk.ts`: import `prayersReal` (`../w3/prayer`), `chipBonuses` (`../w4/lab`) and `starSignBonusReal` (`../common/starSign`), then replace the four pending cases:

```ts
    // N.js DNSM.StarSigns.FightAFK — the active-signs port (spec A4).
    case "starFightAFK": {
      const r = starSignBonusReal("FightAFK", ci, s);
      return pct("Star signs (FightAFK)", r.val, r.children);
    }
    // N.js prayersReal(4,0) — with the super-bit branch (spec A4).
    case "prayer4": {
      const r = prayersReal(4, 0, ci, s);
      return pct(label("Prayer", 4), r.val, r.children);
    }
    // N.js −prayersReal(12,1): the Ruck Sack curse (0 in the super-bit branch).
    case "curse12": {
      const r = prayersReal(12, 1, ci, s);
      return pct("Ruck Sack curse (Prayer 12)", -r.val, r.children);
    }
    // N.js chipBonuses("fafk") — the active character's chips only.
    case "chipFafk":
      return pct("Lab chip (fafk)", chipBonuses("fafk", ci));
```

Regenerate the registry: `npx tsx scripts/updater/registry/gen-registry.ts`.

- [ ] **Step 4: Run.** `npx vitest run __tests__/lib/arkh/afk-fidelity.test.ts __tests__/lib/arkh/afk-gains.save.test.ts __tests__/lib/arkh/afk-gains.smoke.test.ts __tests__/updater/registry.guard.test.ts __tests__/lib/arkh/family-guy-dr.test.ts __tests__/lib/arkh/coin-multi.save.test.ts` must PASS. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 5: Commit**

```bash
git add lib/arkh/stats/systems/w3/prayer.ts lib/arkh/stats/systems/w4/lab.ts lib/arkh/stats/systems/common/starSign.ts lib/arkh/stats/systems/afk/afk.ts scripts/updater/registry/formula-registry.gen.ts __tests__/lib/arkh/afk-fidelity.test.ts __tests__/lib/arkh/afk-gains.save.test.ts
git commit -m "feat(arkh): active star signs, super-bit prayers and per-character chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Void Set, Divinity major, Flurbo 7 and Roo 5; the tree is complete

**Files:**
- Modify: `web/lib/arkh/stats/systems/w3/setBonus.ts` (`void` entry; the weapon part in `checkSetEquipped`)
- Modify: `web/lib/arkh/stats/systems/w5/divinity.ts` (add `bonusMajorReal`)
- Modify: `web/lib/arkh/stats/systems/coin/coin.ts` (export `flurboShop`, `rooBonus`; `flurbo4` and `roo6` call them)
- Modify: `web/lib/arkh/stats/systems/exp/exp.ts` (`flurbo2` calls `flurboShop`)
- Modify: `web/lib/arkh/stats/systems/afk/afk.ts` (cases `voidSet`, `flurbo7`, `divMajor`, `roo5`; delete `pending`)
- Modify: `web/scripts/updater/registry/formula-registry.gen.ts` (regenerated)
- Test: `web/__tests__/lib/arkh/afk-fidelity.test.ts` (append), `web/__tests__/lib/arkh/afk-gains.save.test.ts` (append)

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `setBonus.resolve("void", { saveData, charIdx })`, which returns 10 when the set is unlocked;
  - `bonusMajorReal(ci: number, type: number, saveData: SaveData): boolean`;
  - `flurboShop(idx: number, s: SaveData): { val: number; children: ArkhNode[] }`;
  - `rooBonus(idx: number, coef: number, s: SaveData): { val: number; children: ArkhNode[] }`;
  - a complete AFK tree: no `"pending port"` note left, Markhe total 422.31870591798446.

- [ ] **Step 1: Write the failing tests.** Append to `afk-fidelity.test.ts` (add `import { setBonus } from "@/lib/arkh/stats/systems/w3/setBonus";` and `import { bonusMajorReal, hasBonusMajor } from "@/lib/arkh/stats/systems/w5/divinity";` to the imports):

```ts
describe("Void Set (setBonus 'void', spec A11)", () => {
  // VOID_SET = 4 armor pieces + 2 of its tools + 1 of its weapons (EquipmentSets[3] = ["2","1","10",…]).
  const gear = (weapon: string) => ({
    charNames: ["A"],
    data: {
      StarSg: {},
      EquipOrder_0: [
        ["EquipmentHats54", weapon, "EquipmentShirts27", "EquipmentPants21", "EquipmentShoes22"],
        ["EquipmentTools11", "EquipmentToolsHatchet7"],
      ],
    },
  });

  it("is unlocked by the 7 worn parts, without OLA[379]", () => {
    loadSaveData(gear("EquipmentSword3"));
    expect(setBonus.resolve("void", { saveData, charIdx: 0 }).val).toBe(10);
  });

  it("needs the weapon: armor + tools alone are 6 of 7 parts", () => {
    loadSaveData(gear("Blank"));
    expect(setBonus.resolve("void", { saveData, charIdx: 0 }).val).toBe(0);
  });
});

describe("bonusMajorReal", () => {
  it("Gem Shop item 9 turns on the type-0 major only", () => {
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, GemItemsPurchased: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(true);
    expect(bonusMajorReal(0, 2, saveData)).toBe(false);
    expect(hasBonusMajor(0, 0, saveData)).toBe(false); // the DR helper is untouched
  });

  it("Polytheism: talent 505's god (SL505 mod 10) while the god rank is past it", () => {
    const div = Array(26).fill(0);
    div[12] = 1; // char 0 linked to Arctis (type 2), so hasBonusMajor(…, 0) is false
    div[25] = 3;
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Divinity: div, SL_0: { 505: 10 } } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(true); // god 0 = Snehebatu (type 0), 3 > 0
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Divinity: div, SL_0: { 505: 11 } } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(false); // god 1 is type 2
    const unlinked = [...div];
    unlinked[12] = -1;
    loadSaveData({ charNames: ["A"], data: { StarSg: {}, Divinity: unlinked, SL_0: { 505: 10 } } });
    expect(bonusMajorReal(0, 0, saveData)).toBe(false); // not linked → no Polytheism
  });
});
```

Append inside the `describe` of `afk-gains.save.test.ts`:

```ts
  it.each<[string, number]>([
    // N.js ≠ arkh getSetBonus: SET_BONUS_VALUES has no VOID_SET (0 on this
    // save, 421.822 total); IT is right here (10).
    ["voidSet", 10],
    ["flurbo7", 5],
    ["divMajor", 30],
    ["roo5", 1361.25],
  ])("%s", (id, expected) => close(src(id), expected));

  it("fighting pool Σ/100", () => close(Number(tree.children![0].val), 85.03975457682378));
  it("Etc 92 factor", () => close(Number(tree.children![2].val), 4.96613269898924));

  // N.js ≠ IT: IT getAfkGain = 418.94730659590607. Its three proven bugs are
  // base/100 ((0.4 + S)/100·MULTI instead of (0.4 + S/100)·MULTI, −0.396·MULTI),
  // etc59 without `account` (−20.3 pts) and golden food (−7.9878 pts):
  // 418.9473 + 0.678878219·4.96613 = 422.3187.
  it("total = IT reconciled → the panel's 42231%", () => {
    close(tree.val, 422.31870591798446);
    expect(Math.floor(100 * tree.val)).toBe(42231);
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

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/afk-fidelity.test.ts __tests__/lib/arkh/afk-gains.save.test.ts`
Expected: FAIL. `void` is not in `SET_DATA` (0), `bonusMajorReal` is missing, the four terms are pending, and the total is 419.66.

- [ ] **Step 3: Implement.**

`systems/w3/setBonus.ts`:
- `SET_DATA` gains `void: { key: "VOID_SET", bonus: equipSetBonus("VOID_SET") },`;
- `SET_FRIENDLY_NAMES` gains `void: "Void Set Bonus",`;
- in `checkSetEquipped`, after the tools block and before `return partsOn >= partsReq;`, add:

```ts
  // N.js GetSetBonus "PartsOn" (@11008519): when EquipmentSets[set][3][1] is
  // 1, one weapon from the set's third list worn in the gear row is a part
  // too (VOID_SET: 4 armor + 2 tools + 1 weapon). EFAUNT's is 0 → unchanged.
  // @njs _customBlock_GetSetBonus
  if (specialCap === 1) {
    const weapons = (setDef[2] || []) as string[];
    for (let s = 0; s < 16; s++) {
      const item = row0[s] || row0[String(s)];
      if (item && weapons.indexOf(item) !== -1) {
        partsOn++;
        break;
      }
    }
  }
```

`systems/w5/divinity.ts`: change the data import to `import { divinityData, optionsListData, skillLvData } from "../../../save/data";` and append:

```ts
/** N.js Divinity("Bonus_MAJOR", ci, type) (@10683007): hasBonusMajor plus the
 *  two paths it misses — Gem Shop item 9 (type 0 only) and Polytheism
 *  (talent 505: god SL505 mod 10, while Divinity[25] > that index, only for a
 *  character linked to a god). hasBonusMajor stays as the DR reads it. */
// @njs Bonus_MAJOR
export function bonusMajorReal(ci: number, type: number, saveData: SaveData): boolean {
  if (hasBonusMajor(ci, type, saveData)) return true;
  if (type === 0 && Number((saveData.gemItemsData as any)?.[9]) === 1) return true;
  const linked = (divinityData as any)?.[ci + 12];
  if (linked == null || Number(linked) === -1) return false;
  const sl505 = Number((skillLvData as any)?.[ci]?.[505]) || 0;
  if (!(sl505 > 0)) return false;
  const g = sl505 - 10 * Math.floor(sl505 / 10);
  return godsType(g) === type && (Number((divinityData as any)?.[25]) || 0) > g;
}
```

`systems/coin/coin.ts`: add `import type { SaveData } from "../../../state";` if it's missing, then these module-level functions after the `raw` helper:

```ts
/** N.js FlurboShop(idx) (@7827791): DungPassiveStats2[idx] at level
 *  DungUpg[5][idx]. Coin's flurbo4, EXP's flurbo2 and AFK's flurbo7. */
// @njs _customBlock_FlurboShop
export function flurboShop(idx: number, s: SaveData): { val: number; children: ArkhNode[] } {
  const row = ((DungPassiveStats2 as any[])[idx] ?? []) as unknown[];
  const lv = Number((s.dungUpgData as any[])?.[5]?.[idx]) || 0;
  return { val: formulaEval(String(row[3]), Number(row[1]), Number(row[2]), lv), children: [raw("Level", lv)] };
}

/** N.js Summoning("RooBonuses", idx) (@10827396): coef·(1 + Legend26/100)·
 *  (1 + Companions(51))·(1 + RooBonusAll/100)·max(0, ⌈(OLA[271] − idx)/7⌉),
 *  RooBonusAll = the megafeather %. N.js coef per idx 0–6: 3, 3, 5, 2, 2, .5, 3. */
// @njs RooBonuses
export function rooBonus(idx: number, coef: number, s: SaveData): { val: number; children: ArkhNode[] } {
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const mf = (k: number) => (ola(279) > k ? (k === 11 ? ola(279) - 11 : 1) : 0);
  const all = 50 * mf(1) + 50 * mf(3) + 50 * mf(6) + 50 * mf(8) + 50 * Math.min(1, mf(11)) + 25 * Math.max(0, mf(11) - 1);
  const legend = legendPTSbonus(26, s);
  const c51 = companions(51, s);
  const steps = Math.max(0, Math.ceil((ola(271) - idx) / 7));
  return {
    val: coef * (1 + legend / 100) * (1 + c51) * (1 + all / 100) * steps,
    children: [raw("Legend 26", legend), raw("Companion 51", c51), raw("Megafeathers %", all), raw(`⌈(OLA[271] − ${idx}) / 7⌉`, steps)],
  };
}
```

Then Coin's cases call them. The node name, value and children are identical, so Coin's snapshot paths don't move:

```ts
    case "flurbo4": {
      const r = flurboShop(4, s);
      return node("Flurbo Shop 4 (Monster Cash)", r.val, r.children, { fmt: "+" });
    }
```

```ts
    case "roo6": {
      const r = rooBonus(6, 3, s);
      return node("Kangaroo Cash (Roo 6)", r.val, r.children, { fmt: "+" });
    }
```

`systems/exp/exp.ts`, case `flurbo2`: EXP Task 3 inlined coin's flurbo lines with index 2 there (the spec's "Reuso: EXP (flurbo2)"). Replace the inline `DungPassiveStats2`/`formulaEval` lines with `const r = flurboShop(2, s);`, keep the node's name and fmt, and use `r.val` / `r.children`. Import `flurboShop` from `../coin/coin` and drop the imports that become unused. `exp-multi.save.test.ts` must stay green.

`systems/afk/afk.ts`: import `setBonus` (`../w3/setBonus`), `bonusMajorReal` (`../w5/divinity`) and extend the coin import to `import { votingMulti, flurboShop, rooBonus } from "../coin/coin";`. Replace the last four pending cases and **delete the `pending` helper**:

```ts
    // N.js GetSetBonus("VOID_SET","Bonus",0,0): OLA[379] ∪ worn parts (spec A11).
    case "voidSet":
      return setBonus.resolve("void", { saveData: s, charIdx: ci });
    case "flurbo7": {
      const r = flurboShop(7, s);
      return pct("Flurbo Shop 7 (AFK Gains)", r.val, r.children);
    }
    // N.js 30*Divinity("Bonus_MAJOR", ci, 0) — Snehebatu's +30% AFK Gains.
    case "divMajor": {
      const on = bonusMajorReal(ci, 0, s) ? 1 : 0;
      return pct("Divinity major bonus ×30 (type 0)", 30 * on, [raw("Major bonus active", on)]);
    }
    // N.js Summoning("RooBonuses",5,0) — coefficient .5, offset 5.
    case "roo5": {
      const r = rooBonus(5, 0.5, s);
      return pct("Kangaroo AFK Gains (Roo 5)", r.val, r.children);
    }
```

Regenerate the registry: `npx tsx scripts/updater/registry/gen-registry.ts`.

- [ ] **Step 4: Run.** First `npx vitest run __tests__/lib/arkh` must PASS. This includes `coin-multi.save.test.ts` (flurbo4 = 25, roo6 = 8167.5, total 6.88E35), `exp-multi.*`, `family-guy-dr.test.ts` and the AFK files. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 5: Commit**

```bash
git add lib/arkh/stats/systems/w3/setBonus.ts lib/arkh/stats/systems/w5/divinity.ts lib/arkh/stats/systems/coin/coin.ts lib/arkh/stats/systems/exp/exp.ts lib/arkh/stats/systems/afk/afk.ts scripts/updater/registry/formula-registry.gen.ts __tests__/lib/arkh/afk-fidelity.test.ts __tests__/lib/arkh/afk-gains.save.test.ts
git commit -m "feat(arkh): Void Set, Divinity major, Flurbo 7 and Roo 5 for AFK Gains

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Best AFK map and map scenarios

**Files:**
- Modify: `web/lib/arkh/computeAfk.ts` (add `bestAfkMapIdx`)
- Test: `web/__tests__/lib/arkh/afk-gains.save.test.ts` (append a second `describe`), `web/__tests__/lib/arkh/afk-gains.smoke.test.ts` (append)

**Interfaces:**
- Consumes: `statCtx` (`computeStat.ts`), `computeArcaneMapMultiBon` (`mc/tesseract.ts`), `MapAFKtarget`, `MONSTERS`, `currentMapData`.
- Produces: `bestAfkMapIdx(rawEnvelope: any, charIdx: number): number`.

- [ ] **Step 1: Write the failing tests.** Append to `afk-gains.save.test.ts`, adding `bestAfkMapIdx` to its `@/lib/arkh/computeAfk` import:

```ts
describe.skipIf(!existsSync(SAVE))("AFK Gains Rate — map scenarios on the ARKHE save", () => {
  let save: any;
  let ci: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    ci = save.charNames.indexOf("Markhe");
  });

  it("map 1: arcane slot 2 = 30.158… → 549.68 (54968%)", () => {
    const t = computeArkhAfkGains(save, ci, 1).tree;
    close(srcIn(t, "arcaneMapAfk"), 30.158131799045954);
    close(t.val, 549.6821378607555);
    expect(Math.floor(100 * t.val)).toBe(54968);
  });

  it("map 306 (Clamworks): ×0.2 → 84.46 (8446%)", () => {
    const t = computeArkhAfkGains(save, ci, 306).tree;
    expect(srcIn(t, "clamworks306")).toBe(0.2);
    close(t.val, 84.46374118359688);
    expect(Math.floor(100 * t.val)).toBe(8446);
  });

  it("a town and a non-Cove cavern read 0%", () => {
    expect(computeArkhAfkGains(save, ci, 0).total).toBe(0);
    expect(computeArkhAfkGains(save, save.charNames.indexOf("Darkhe"), 216).total).toBe(0); // cavern 3
  });

  it("the best AFK map is 1 (slot-2 kills only on maps 1 and 156)", () => {
    expect(bestAfkMapIdx(save, ci)).toBe(1);
  });
});
```

Append to `afk-gains.smoke.test.ts`: import `bestAfkMapIdx` next to `computeArkhAfkGains` and add `import { existsSync, readdirSync, readFileSync } from "node:fs";` at the top. The cached-saves case must stay the last one in the file:

```ts
describe("AFK best map and cached saves", () => {
  it("with no slot-2 kills it falls back to the character's own fighting map, else 301", () => {
    expect(bestAfkMapIdx({ charNames: ["A"], data: { CurrentMap_0: 14 } }, 0)).toBe(14);
    expect(bestAfkMapIdx({ charNames: ["A"], data: { CurrentMap_0: 306 } }, 0)).toBe(301); // Clamworks is never a candidate
    expect(bestAfkMapIdx({ charNames: ["A"], data: { CurrentMap_0: 0 } }, 0)).toBe(301); // town
  });

  // Keep last: it loads real saves into the arkh singleton.
  const CACHE = "scripts/updater/golden/.cache";
  const cached = existsSync(CACHE) ? readdirSync(CACHE).filter((f) => f.endsWith(".json")) : [];
  it.skipIf(cached.length === 0)("every cached save gives a finite rate for every character on its best map", () => {
    for (const f of cached) {
      const save = JSON.parse(readFileSync(`${CACHE}/${f}`, "utf8"));
      for (let c = 0; c < (save.charNames?.length ?? 0); c++) {
        const total = computeArkhAfkGains(save, c, bestAfkMapIdx(save, c)).total;
        expect(Number.isFinite(total), `${f} #${c}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run __tests__/lib/arkh/afk-gains.save.test.ts __tests__/lib/arkh/afk-gains.smoke.test.ts`
Expected: FAIL (`bestAfkMapIdx` is not exported). The map 1/306/0 cases already pass: they're regression anchors on Tasks 2–4.

- [ ] **Step 3: Implement.** Append to `computeAfk.ts`:

```ts
import { loadSaveData } from "./save/loader";
import { currentMapData } from "./save/data";
import { statCtx } from "./computeStat";
import { MapAFKtarget } from "./stats/data/game/customlists.js";
import { MONSTERS } from "./stats/data/game/monsters.js";
import { computeArcaneMapMultiBon } from "./stats/systems/mc/tesseract";

/** Spec A6: the fighting map (default target FIGHTING; never 216 or 306)
 *  with the highest arcane slot-2 bonus — among fighting maps it's the only
 *  term that moves (the shrine is treated as global). Ties → the lowest
 *  index. No slot-2 kills anywhere → the character's own map when it's a
 *  candidate, else 301 (W7's first fighting map, Coin's BEST_MAP). The
 *  Observed Max collector measures every character here. */
export function bestAfkMapIdx(rawEnvelope: any, charIdx: number): number {
  loadSaveData(rawEnvelope);
  const ctx = statCtx(rawEnvelope, charIdx, 0);
  const targets = MapAFKtarget as unknown as string[];
  const isFight = (m: number) =>
    m !== 216 && m !== 306 && (MONSTERS as any)[targets[m]]?.AFKtype === "FIGHTING";
  let best = -1;
  let bestScore = 0;
  for (let m = 0; m < targets.length; m++) {
    if (!isFight(m)) continue;
    const score = computeArcaneMapMultiBon(2, { ...ctx, mapIdx: m } as any);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (best >= 0) return best;
  const own = Number((currentMapData as any)?.[charIdx]) || 0;
  return isFight(own) ? own : 301;
}
```

Merge the `./computeStat` import into the existing one; don't duplicate it.

- [ ] **Step 4: Run.** `npx vitest run __tests__/lib/arkh/afk-gains.save.test.ts __tests__/lib/arkh/afk-gains.smoke.test.ts` must PASS. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 5: Commit**

```bash
git add lib/arkh/computeAfk.ts __tests__/lib/arkh/afk-gains.save.test.ts __tests__/lib/arkh/afk-gains.smoke.test.ts
git commit -m "feat(afk): best AFK map and map scenarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Observed Max collector and cron step

**Files:**
- Create: `web/scripts/update-top-afk.ts`
- Create (generated): `web/lib/afkGains/topAfkGains.ts`, `web/lib/afkGains/topAfkGains.meta.ts`
- Modify: `.github/workflows/refresh-top-max.yml`
- Test: `web/__tests__/scripts/afkCollector.test.ts` (new)

**Interfaces:**
- Consumes:
  - `runTopCollector`, `StatCollectorConfig` (`scripts/_shared/topStatCollector.ts`, EXP Task 8) and `deriveGatedTalentsFor(ids)` (`scripts/_shared/classGating.ts`, EXP Task 8);
  - `computeArkhAfkPools`, `combineAfkPools`, `bestAfkMapIdx`, `AFK_ROOT`, `AFK_POOLS`, `AFK_NODES`, `AFK_CLASS_TALENTS`.
- Produces (generated):
  - `TOP_AFK_FLAT`, `TOP_AFK_PROFILE_OVERRIDES`, `TOP_AFK_CLASS_PROFILE`, `topAfkFlatForClass(classKey: string | null | undefined)`;
  - `TOP_AFK_GENERATED_AT`, `TOP_AFK_PLAYERS_SCANNED`, `TOP_AFK_HYPOTHETICAL_TOTAL`, `TOP_AFK_BEST`.

- [ ] **Step 1: Write the failing test** `web/__tests__/scripts/afkCollector.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveGatedTalentsFor } from "@/scripts/_shared/classGating";
import { AFK_CLASS_TALENTS } from "@/lib/arkh/stats/systems/afk/afk";
import { AFK_NODES, AFK_ROOT } from "@/lib/arkh/stats/defs/afk-gains";
import { topAfkFlatForClass } from "@/lib/afkGains/topAfkGains";
import { TOP_AFK_PLAYERS_SCANNED } from "@/lib/afkGains/topAfkGains.meta";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const T88 = `${AFK_ROOT} / ${AFK_NODES.pool} / Idle Brawling (Talent 88)`;

describe("AFK Gains Observed Max", () => {
  it("gates the four class AFK talents and never the star talents (spec A10)", () => {
    expect(deriveGatedTalentsFor(AFK_CLASS_TALENTS).map((t) => t.id).sort((a, b) => a - b)).toEqual([79, 88, 268, 448]);
    expect(deriveGatedTalentsFor([621, 650])).toEqual([]);
  });

  it("the generated reference keeps Idle Brawling for a Royal Guardian and zeroes it for a Wizard", () => {
    expect(TOP_AFK_PLAYERS_SCANNED).toBeGreaterThanOrEqual(20);
    expect(topAfkFlatForClass(null)[AFK_ROOT]).toBeGreaterThan(0);
    expect(topAfkFlatForClass("Royal_Guardian")[T88]).toBeGreaterThan(0); // Warrior tab (Rage Basics)
    expect(topAfkFlatForClass("Wizard")[T88]).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run __tests__/scripts/afkCollector.test.ts`. It must FAIL because `@/lib/afkGains/topAfkGains` doesn't exist yet.

- [ ] **Step 3: Collector config** `web/scripts/update-top-afk.ts`. It follows `update-top-exp.ts`: the window shim sits before the imports, and the file runs as CJS under tsx.

```ts
// Refresh the bundled top-player AFK Gains Rate reference in
// lib/afkGains/topAfkGains.ts (+ .meta.ts). Each character is measured on its
// save's best Arcane AFK map (bestAfkMapIdx: the fighting map with the highest
// arcane slot-2 bonus — spec A6); talents 79/88/268/448 are gated per class
// (A10). Neutral values are 0 (they're all in the fighting pool); the map
// rules stay neutral because the chosen map is never 216 or 306.
//
// Run (from web/):  npx tsx scripts/update-top-afk.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhAfkPools, combineAfkPools, bestAfkMapIdx } from "../lib/arkh/computeAfk";
import { AFK_ROOT, AFK_POOLS } from "../lib/arkh/stats/defs/afk-gains";
import { AFK_CLASS_TALENTS } from "../lib/arkh/stats/systems/afk/afk";

runTopCollector({
  label: "AFK Gains Rate",
  focusBoard: "afkTime",
  root: AFK_ROOT,
  groups: AFK_POOLS,
  computePools: (save, ci) => computeArkhAfkPools(save, ci, bestAfkMapIdx(save, ci)),
  combine: combineAfkPools,
  gated: deriveGatedTalentsFor(AFK_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "afkGains", "topAfkGains.ts"),
  metaFile: join(__dirname, "..", "lib", "afkGains", "topAfkGains.meta.ts"),
  constPrefix: "TOP_AFK",
  flatForClassFn: "topAfkFlatForClass",
  scriptName: "scripts/update-top-afk.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`mergeBest` keeps the highest value of each source across all characters. For `curse12` (negative) that means the value closest to 0, so Biggest Gains shows what the Ruck Sack curse costs.

- [ ] **Step 4: Generate the reference** (network, read-only public API; takes a few minutes). `lib/afkGains/` doesn't exist yet and the collector's `writeFileSync` won't create it:

Run: `mkdir -p lib/afkGains`, then `npx tsx scripts/update-top-afk.ts --limit 3` (smoke, which writes a 3-player file), then `npx tsx scripts/update-top-afk.ts` (the full run overwrites it).
Expected: "✓ Scanned N players" with N ≥ 20, the gated talents listed as `79, 88, 268, 448`, and both files written.
If the IT API is unreachable, retry once with `--slow`. If it still fails, stop and report BLOCKED with the error. Don't hand-write the file, and don't build it from the golden cache: that cache holds 9 top-player saves, below the collector's 20-player floor (see the self-review).

- [ ] **Step 5: Cron.** In `.github/workflows/refresh-top-max.yml`, as left by EXP Task 8:
  - rename the workflow `name:` to `Refresh top DR, coin, EXP, AFK & talent max`;
  - in the header comment, add "AFK Gains" to the list of pages; after the EXP line add `#   • web/lib/afkGains/topAfkGains.ts        (+ .meta.ts)`; change "All four collectors" to "All five collectors";
  - change the job's `timeout-minutes: 30` to `45`. The Coin, EXP and AFK steps each allow 12 minutes, so a 30-minute job cap could cancel the commit step before `continue-on-error` gets a chance;
  - after the "Refresh top-player EXP Multi max" step add:

```yaml
      - name: Refresh top-player AFK Gains max
        working-directory: web
        continue-on-error: true
        timeout-minutes: 12
        run: npx tsx scripts/update-top-afk.ts
```

  - append `web/lib/afkGains/topAfkGains.ts web/lib/afkGains/topAfkGains.meta.ts` to `files=` and change the commit message to `chore: auto-refresh top DR + coin + EXP + AFK + talent max snapshots`.

- [ ] **Step 6: Run.** `npx vitest run __tests__/scripts` must PASS. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 7: Commit**

```bash
git add scripts/update-top-afk.ts lib/afkGains/topAfkGains.ts lib/afkGains/topAfkGains.meta.ts ../.github/workflows/refresh-top-max.yml __tests__/scripts/afkCollector.test.ts
git commit -m "feat(afk): Observed Max collector + cron step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Page config — the game's format, the what-if gains model, `AFK_PAGE`

**Files:**
- Create: `web/lib/afkGains/pageConfig.ts`
- Test: `web/__tests__/lib/afkGains/pageConfig.test.ts` (new)

**Interfaces:**
- Consumes:
  - from the kit: `StatPageConfig`, `GainsModel`, `GainSource` (`lib/statTracker/config.ts`); `directChildren`, `computeGains` (`lib/statTracker/biggestGains.ts`);
  - `afkRate`, `AFK_NODES`, `AFK_ROOT`; the generated `topAfkGains*`.
- Produces: `formatAfkGains(v: number): string` (returns `"42231"`; the kit adds the `"%"`), `afkGainsModel: GainsModel`, `AFK_PAGE: StatPageConfig`.

- [ ] **Step 1: Write the failing test** `web/__tests__/lib/afkGains/pageConfig.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { AFK_PAGE, afkGainsModel, formatAfkGains } from "@/lib/afkGains/pageConfig";
import { AFK_NODES, AFK_ROOT } from "@/lib/arkh/stats/defs/afk-gains";
import { combineAfkPools, computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { computeGains } from "@/lib/statTracker/biggestGains";
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe("AFK Gains page config", () => {
  it("uses its own storage keys and the % unit", () => {
    expect(AFK_PAGE.storage).toEqual({
      save: "afk-gains-tracker.last-upload.v1",
      name: "afk-gains-tracker.playerName",
      snapshots: "afk-gains-tracker.v1",
      collapse: "afk-gains.snapshot-section.collapsed.v1",
      exportPrefix: "afk-gains-snapshots",
      exportLabel: "afk-gains-tracker",
    });
    expect(AFK_PAGE).toMatchObject({
      statName: "AFK Gains Rate",
      gainLabel: "AFK",
      emoji: "💤",
      calculatorTitle: "AFK Gains Calculator",
      totalLabel: "AFK Gains Rate (Fighting)",
      unit: "%",
      errPrefix: "AFK gains compute failed",
    });
    expect(AFK_PAGE.formatTotal).toBe(formatAfkGains);
  });

  // N.js @3790178: ""+Math.floor(100*rate)+"%" (the kit adds the "%").
  it.each<[number, string]>([
    [422.31870591798446, "42231"],
    [549.6821378607555, "54968"],
    [84.46374118359688, "8446"],
    [0.4, "40"],
    [0.01, "1"],
    [0, "0"],
    // 100 × 0.29 is 28.999999999999996 in floats; the game's JS prints 28 too.
    [0.29, "28"],
  ])("formatAfkGains(%s) → %s", (v, s) => expect(formatAfkGains(v)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatAfkGains(NaN)).toBe("—"));

  it("loads the Observed Max for a class", async () => {
    const top = await AFK_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });
});

describe("AFK what-if gains model (synthetic)", () => {
  const P = (...items: Array<[string, number]>): Pool => ({ items: items.map(([name, val]) => ({ name, val })), sum: 0, product: 0 });
  const flatOf = (clam: number, cove: number, type: number) =>
    flattenTree(
      combineAfkPools({
        fight: P(["Base fighting rate (40%)", 40], ["A", 100]),
        all: P(["B", 60]),
        multi: P(["Arcane", 0], ["Etc 92", 0]),
        rules: P([AFK_NODES.clam, clam], [AFK_NODES.cove, cove], [AFK_NODES.type, type]),
      }).tree
    );
  const A = `${AFK_ROOT} / ${AFK_NODES.pool} / A`;

  it("ranks a pool source by the rate it would add", () => {
    const { rows } = computeGains(afkGainsModel, flatOf(1, 0, 1), { [A]: 300 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "A", group: AFK_NODES.pool, display: "pct", you: 100, max: 300 });
    expect(rows[0].gainPct).toBeCloseTo(100, 9); // Σ 200 → 400
  });

  it("no row while the Cove replaces the rate", () => {
    expect(computeGains(afkGainsModel, flatOf(1, 2.171, 1), { [A]: 300 }).rows).toEqual([]);
  });

  it("nothing is comparable when the target isn't a fight", () => {
    const r = computeGains(afkGainsModel, flatOf(1, 0, 0), { [A]: 300 });
    expect(r.rows).toEqual([]);
    expect(r.comparableSources).toBe(0);
  });

  it("totalFromFlat mirrors the tree", () => {
    for (const [clam, cove, type] of [[1, 0, 1], [0.2, 0, 1], [1, 2.171, 1], [1, 0, 0]]) {
      const flat = flatOf(clam, cove, type);
      expect(afkGainsModel.totalFromFlat(flat)).toBeCloseTo(flat[AFK_ROOT], 12);
    }
  });
});

describe.skipIf(!existsSync(SAVE))("AFK what-if gains on the ARKHE save (Markhe)", () => {
  let save: any;
  let ci: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    ci = save.charNames.indexOf("Markhe");
  });

  it.each([14, 1, 306, 0])("totalFromFlat = the tree's total on map %i", (map) => {
    const t = computeArkhAfkGains(save, ci, map).tree;
    expect(Math.abs(afkGainsModel.totalFromFlat(flattenTree(t)) - t.val)).toBeLessThanOrEqual(1e-12 * Math.max(1, t.val));
  });

  it.each([14, 306])("+100 pts on a fighting-pool source is +100/Σ on map %i", (map) => {
    const flat = flattenTree(computeArkhAfkGains(save, ci, map).tree);
    const path = `${AFK_ROOT} / ${AFK_NODES.pool} / Golden food (AllAFK)`;
    const { rows } = computeGains(afkGainsModel, flat, { [path]: flat[path] + 100 });
    expect(rows[0].gainPct).toBeCloseTo((100 / 8503.975457682378) * 100, 9); // +1.1759%
  });

  it("a town leaves Biggest Gains empty", () => {
    const town = flattenTree(computeArkhAfkGains(save, ci, 0).tree);
    const ref = flattenTree(computeArkhAfkGains(save, ci, 14).tree);
    const r = computeGains(afkGainsModel, town, ref);
    expect(r.rows).toEqual([]);
    expect(r.comparableSources).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run __tests__/lib/afkGains/pageConfig.test.ts`. It must FAIL (module missing).

- [ ] **Step 3: `pageConfig.ts`**

```ts
// AFK Gains Rate page: the statTracker kit's config for N.js
// AFKgainrates("Fighting") — the AFK Info panel's AFK GAINS RATE line.

import type { GainSource, GainsModel, StatPageConfig } from "@/lib/statTracker/config";
import { directChildren } from "@/lib/statTracker/biggestGains";
import { AFK_NODES, AFK_ROOT, afkRate } from "@/lib/arkh/stats/defs/afk-gains";
import { TOP_AFK_GENERATED_AT, TOP_AFK_PLAYERS_SCANNED } from "./topAfkGains.meta";

/** The AFK Info panel's number (N.js @3790178: ""+Math.floor(100*rate)+"%"),
 *  on every map — the Cove's own panel format isn't used (spec). The kit
 *  appends the "%" (StatPageConfig.unit). */
export function formatAfkGains(v: number): string {
  return Number.isFinite(v) ? String(Math.floor(100 * v)) : "—";
}

const pathOf = (name: string) => `${AFK_ROOT} / ${name}`;
const GROUPS = [AFK_NODES.pool, AFK_NODES.arcane, AFK_NODES.etc92];

/** Biggest Gains what-if (spec A3, EXP D10): the sources are G1–G3's direct
 *  children; totalFromFlat rebuilds afkRate's parts from the same paths. The
 *  map rules (R1–R3) aren't progress, so they never rank. */
export const afkGainsModel: GainsModel = {
  sources(yoursFlat, refFlat) {
    const out: GainSource[] = [];
    for (const g of GROUPS) {
      const gp = pathOf(g);
      for (const p of directChildren(gp, yoursFlat, refFlat)) {
        out.push({ path: p, group: g, source: p.slice(gp.length + 3), display: "pct" });
      }
    }
    return out;
  },
  totalFromFlat(flat) {
    const sum = (g: string) => directChildren(pathOf(g), flat).reduce((a, p) => a + (Number(flat[p]) || 0), 0);
    const rule = (name: string, dflt: number) => {
      const v = flat[pathOf(name)];
      return typeof v === "number" && Number.isFinite(v) ? v : dflt;
    };
    return afkRate({
      sum: sum(AFK_NODES.pool),
      arcane: sum(AFK_NODES.arcane),
      etc92: sum(AFK_NODES.etc92),
      clam: rule(AFK_NODES.clam, 1),
      cove: rule(AFK_NODES.cove, 0),
      type: rule(AFK_NODES.type, 1),
    });
  },
};

export const AFK_PAGE: StatPageConfig = {
  statName: "AFK Gains Rate",
  gainLabel: "AFK",
  emoji: "💤",
  calculatorTitle: "AFK Gains Calculator",
  subtitle:
    "Computes every character's fighting AFK gains rate from your save — the AFK GAINS RATE line of the in-game AFK Info panel. Select character & map. All processing local in your browser.",
  totalLabel: "AFK Gains Rate (Fighting)",
  mapTitle:
    "The map sets the Arcane map bonus (slot 2), Clamworks' ×0.2 (map 306), the Crystal Glunko Cove (map 216) and whether the map's AFK target is a fight",
  errPrefix: "AFK gains compute failed",
  storage: {
    save: "afk-gains-tracker.last-upload.v1",
    name: "afk-gains-tracker.playerName",
    snapshots: "afk-gains-tracker.v1",
    collapse: "afk-gains.snapshot-section.collapsed.v1",
    exportPrefix: "afk-gains-snapshots",
    exportLabel: "afk-gains-tracker",
  },
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeAfk").then((m) => m.computeArkhAfkGains(save, charIdx, mapIdx)),
  formatTotal: formatAfkGains,
  unit: "%",
  gains: afkGainsModel,
  loadTop: () =>
    import("./topAfkGains").then((m) => ({
      flatForClass: (classKey: string | null) => m.topAfkFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_AFK_GENERATED_AT, playersScanned: TOP_AFK_PLAYERS_SCANNED },
  methodologyNote:
    "AFK gain = how much your AFK Gains Rate would rise if this source matched the top players " +
    "(Observed Max), recomputed through the game's formula. Values are a ceiling, not a one-level step. " +
    "Each top player is measured on their best Arcane AFK map (slot 2), so that row reflects the map " +
    "choice too.",
  compareTitle: "Compare every AFK gains source against the best value observed across the top players",
  gainsTabTitle: "Rank your AFK sources by how much AFK Gains Rate matching the top players would give",
  footer:
    "AFK Gains Rate is computed locally from your save — every term of the game's fighting AFK formula, pool by pool.",
};
```

- [ ] **Step 4: Run.** `npx vitest run __tests__/lib/afkGains` must PASS. Then `npx vitest run` (full) must PASS and `npx tsc --noEmit -p tsconfig.json` must be clean.

- [ ] **Step 5: Commit**

```bash
git add lib/afkGains/pageConfig.ts __tests__/lib/afkGains/pageConfig.test.ts
git commit -m "feat(afk): page config — game format and what-if gains

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Route, navigation, home card; final verification

**Files:**
- Create: `web/app/afk-gains/page.tsx`, `web/app/afk-gains/AfkGainsPageClient.tsx`
- Modify: `web/components/TopNav.tsx`, `web/app/page.tsx`, `web/e2e/homepage.spec.ts`
- Test: `web/__tests__/components/TopNav.test.tsx`, `web/__tests__/components/statTracker/StatCalculator.test.tsx` (extend)

**Interfaces:**
- Consumes: `AFK_PAGE` (Task 7), `StatPageClient` (EXP Task 7).
- Produces: the route `/afk-gains`, the nav item "💤 AFK Gains", the home card "AFK Gains Tracker".

- [ ] **Step 1: Write the failing tests.**
  - `__tests__/components/TopNav.test.tsx`: add `expect(screen.getByText(/AFK Gains/i)).toBeInTheDocument();` to "renders all nav items".
  - `__tests__/components/statTracker/StatCalculator.test.tsx`: add a top-level `vi.mock("@/lib/arkh/computeAfk", () => ({ computeArkhAfkGains: () => { throw new Error("stub"); } }));` next to the existing EXP/Coin mocks, `import { AFK_PAGE } from "@/lib/afkGains/pageConfig";`, and:

```tsx
  it("renders the AFK Gains config", () => {
    render(<StatCalculator config={AFK_PAGE} />);
    expect(loader!.storageKey).toBe("afk-gains-tracker.playerName");
    expect(screen.getByText(/AFK Gains Calculator/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run** `npx vitest run __tests__/components/TopNav.test.tsx __tests__/components/statTracker/StatCalculator.test.tsx`. It must FAIL: the nav has no "AFK Gains" item. The config case already passes, since it depends on Task 7.

- [ ] **Step 3: Route.**

`web/app/afk-gains/AfkGainsPageClient.tsx`:

```tsx
"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { AFK_PAGE } from "@/lib/afkGains/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function AfkGainsPageClient() {
  return <StatPageClient config={AFK_PAGE} />;
}
```

`web/app/afk-gains/page.tsx`:

```tsx
import type { Metadata } from "next";
import AfkGainsPageClient from "./AfkGainsPageClient";

export const metadata: Metadata = {
  title: "AFK Gains Tracker",
  description:
    "Your Idleon fighting AFK gains rate, source by source, computed from your save — per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function AfkGainsPage() {
  return <AfkGainsPageClient />;
}
```

- [ ] **Step 4: Navigation**
  - `components/TopNav.tsx`: add `{ href: "/afk-gains", label: "💤 AFK Gains" },` right after the `{ href: "/exp-multi", label: "✨ EXP Multi" },` item.
  - `app/page.tsx`: after the EXP Multi `ShortcutCard` add:

```tsx
        <ShortcutCard
          href="/afk-gains"
          icon="💤"
          title="AFK Gains Tracker"
          description="Every term of the game's fighting AFK gains formula on your save, per character and map, with snapshots and a top-player comparison."
          cta="Open AFK Gains"
        />
```

  - `e2e/homepage.spec.ts`: add `{ title: "AFK Gains Tracker", desc: "AFK gains formula" },` after the EXP Multi card entry. It runs in CI only.

- [ ] **Step 5: Run.** `npx vitest run` (full) must PASS, including `family-guy-dr.test.ts`, `coin-multi.*` and `exp-multi.*`. `npx tsc --noEmit -p tsconfig.json` must be clean. Also check that `git status` shows only this task's files and that nothing under `web/scripts/updater/golden/.cache/` is tracked.

- [ ] **Step 6: Commit**

```bash
git add app/afk-gains/page.tsx app/afk-gains/AfkGainsPageClient.tsx components/TopNav.tsx app/page.tsx e2e/homepage.spec.ts __tests__/components/TopNav.test.tsx __tests__/components/statTracker/StatCalculator.test.tsx
git commit -m "feat(afk): AFK Gains Tracker page, nav item and home card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand-off (controller, after the push).**
  - Open the PR with base `feat/exp-multi-page`, then check the Vercel preview of `/afk-gains`: headline in "%", tree root in "x", map selector, Snapshot History, Compare vs Observed Max, Biggest Gains.
  - The spec's done criterion is the game reading. Ask the user for Markhe's AFK Info → AFK GAINS RATE on map 14. The expected value is `42231%` on the cached 2026-09-23 save. For a fresh reading, the save must come from the same moment, taken **without logging in** (public IT profile or "Copy for Support").
  - Don't merge.

---

## Self-review

**Spec coverage.** Each spec item, and where the plan covers it:

| Spec item | Where it lands |
|---|---|
| A1 Fighting-only scope, route `/afk-gains`, title "AFK Gains Tracker", nav "💤 AFK Gains" after "✨ EXP Multi"; `ALL`/`MULTI` as named pools | T7 (copy), T8 (route, nav, home card, e2e card), T2 (`fight`/`all`/`multi`/`rules` pools) |
| A2 headline `⌊100·rate⌋%`; the kit option `unit: "x" \| "%"` (headline, `title`, notice, snapshot table; Coin/EXP unchanged) | T1 (kit + tests), T7 (`formatAfkGains` → "42231", `unit: "%"`) |
| A3 shape: base-40 source, `.01` floor, ×0.2 on 306, Cove replacement on 216/cavern 17; custom descriptor; the single `afkRate`; custom `totalFromFlat`; G1 "⚔️ Fighting AFK pool" (Σ/100), G2 arcane slot 2, G3 Etc 92, R1–R3 with fixed names; root note "max(1%, ·)" | T2 (descriptor, combine, root-note plumbing, tests), T7 (`afkGainsModel`) |
| A4 active star signs (equipped ∪ unlocked < enabled, sign 54's −7, level gates, star-chip 2nd pass, Seraph positive only) | T3 |
| A4 `prayersReal` with the super-bit branch (curse 0, prayer 5 excluded) | T3 |
| A4 per-character `chipBonuses` over `Lab[1+ci]` | T3 |
| A4 Divinity major with gem 9 + Polytheism | T4 (`bonusMajorReal`) |
| A4/A11 VOID_SET via `SET_DATA` (+10 on the save, equipped-parts fallback) | T4 |
| A4 flurbo 7 / roo 5 extracted from `coin.ts` (`flurboShop`, `rooBonus`; Coin unchanged, EXP `flurbo2` reuses) | T4 |
| A4 merit W2 and `bun_u` inline | T2 |
| A4 compass 57 via EXP's `compassBonus` (EXP Task 3; `systems/exp/compass.ts` isn't on the base branch yet) | T2 |
| A4 vote 6 via EXP's `votingMulti` | T2 |
| A5 shrine 8 ungated (with a note) | T2 |
| A6 collector map (best slot-2 fighting map, not 216/306, lowest-index ties, fallback own map / 301) | T5 (`bestAfkMapIdx` + tests), T6 |
| A7 oracle reconciliation (`N.js ≠ IT` comments; 422.3187 not 418.9473) | T2–T4 save tests |
| A8 branch/PR | "Base", T8 hand-off |
| A9 AFK-type rule (map default target; Nothing / Paying_Respect / no definition → 0; Cove = fight; skill target → fighting rate + note) | T2 (`afkType` + smoke), T5 (town, 216/cavern 3), T7 (no rows) |
| A10 gating 79/88/268/448 (not 621/650) | T2 (`AFK_CLASS_TALENTS`), T6 (gating test + generated per-class reference) |
| Config table (keys, copy, `mapTitle`, methodology, no `legacyValueKey`) | T7 |
| Observed Max: `afkTime`, neutral values, `curse12` closest to 0, cron step | T6 |
| Tests: smoke (empty envelope, map 1 → "40", map 0 → 0, cached saves finite) | T2, T5, T7 (format) |
| Tests: per-term save (Markhe, index 8, map 14 → 422.3187 → "42231") | T2–T4 |
| Tests: map 1 (549.68), 306 (×0.2 → 84.46), town (0%) | T5 |
| Tests: synthetic A4 checks and the Cove | T2–T4 |
| Tests: GainsModel (1e-12 on maps 14/1/306/0; +100 pts → +1.1759% also on 306; no rows for Cove/Nothing) | T7 |
| Tests: kit | T1, T6 |
| DR/Coin/EXP protected | every task runs the full suite; T4 re-checks Coin 6.88E35 after the extraction |
| Game reading | T8 Step 7 |

**Decisions this plan adds (not in the spec).**

1. `gen-registry.ts` accepts underscore-led `@njs` names. Its regex required a letter first, so the spec's `// @njs _customBlock_AFKgainrates` would have registered nothing. Regenerating also picks up two existing tags (`companions.ts`, `jelly.ts`), both present in `formulas.json`; EXP's resolver gets its `_customBlock_ExpMulti` tag instead of the now-false comment.
2. A11's "just add `void` to `SET_DATA`" isn't enough. `checkSetEquipped` never counted the set's weapon part (`EquipmentSets[set][3][1] == 1`, N.js @11008519), so VOID_SET's 7 parts (4 armor + 2 tools + 1 weapon) could never be met from gear. T4 adds that branch. EFAUNT has no weapon part, so the DR is unchanged.
3. The root note "max(1%, ·)" needs `Descriptor.combine` to return an optional `note`, which `buildTree` and `combineStatPools` pass through. No other descriptor returns one.
4. Spec risk 9 (build the reference from cached saves if the API fails) conflicts with the collector's 20-player floor: the golden cache holds 9 top-player saves. T6 therefore stops BLOCKED, like EXP Task 8, instead of publishing a shrunken reference.
5. The refresh workflow's job timeout goes from 30 to 45 minutes, so three 12-minute collector steps can't let the job cap cancel the commit step.
