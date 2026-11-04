# Game Engine — Foundation + Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the diagnosis tooling that works on today's engine (readings registry, game-format comparison, capture button, `diagnose`, `save-diff`) and the core of the new N.js-mirroring engine `lib/game` (GameState, Ctx/cache/trace, strict mode, call-diff, verification map). Trackers migrate in later plans, one per tracker.

**Architecture:** Phase 1 tools read the kit's `StatPageConfig` (compute + `gains.totalFromFlat`) so they run against `lib/arkh` now and `lib/game` later. Phase 2 adds `web/lib/game/` with pure `(ctx, …args) → number` functions, a per-Ctx cache, an opt-in trace that records every term, and a strict save accessor that throws instead of returning 0.

**Tech Stack:** Next.js 16 / TypeScript, vitest, tsx scripts. All paths below are relative to `web/` unless stated.

**Spec:** `docs/superpowers/specs/2026-11-03-game-engine-rewrite-design.md` (repo root)

## Global Constraints

- N.js is the only source of truth: the full live game code is `scripts/updater/.cache/N.new.js`. The repo-root `N.js` is stale, and `data/njs-snapshot/formulas.json` entries are elided. IdleonToolbox and corgan are never references. New `lib/game` code is written from N.js, never copied from `lib/arkh`.
- Saves and readings that carry account data stay out of git, under `scripts/updater/golden/.cache/readings/`. Only metadata goes in `fixtures/readings.json`. Real-save tests use `describe.skipIf(!existsSync(...))`.
- The session token (`gameAuth.session.v1`) never enters a reading bundle.
- Site copy is in English. Never run `npm run dev`. Verify with `npx tsc --noEmit` and `npx vitest run`.
- Branch `feat/game-engine`; `git fetch` first; never commit to main; stage only touched files (never `git add -A`). Commit messages are in English and end with exactly one line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The kit (`components/statTracker/*`, `lib/statTracker/*`) only gains opt-in behaviour: existing pages must render the same unless `?debug=1` is on.

## Review Focus

- A reading whose save file is missing: the readings test and `diagnose` skip it with a clear message and never crash. Tests in Task 3 and Task 5.
- Game strings with thousands separators, glyph units (`💎16310₸`) or `%`/`x` suffixes: the format registry compares strings exactly as the game prints them. Tests in Task 2.
- `diagnose` on a reading where site and game already match: ratio 1, no hypotheses ranked as causes, no division by zero. Test in Task 5.
- `buildGameState` on a save that is missing a key a function reads: strict mode throws `MissingSaveKey` naming the key; it never returns 0. Test in Task 7.
- The trace being off: `lib/game` returns the same number and allocates no trace nodes. Test in Task 8.

---

## Phase 1 — Foundation (works on today's engine)

### Task 1: Readings registry

**Files:**
- Create: `lib/readings/types.ts`, `lib/readings/registry.ts`, `fixtures/readings.json`, `scripts/readings/import.ts`
- Test: `__tests__/lib/readings/registry.test.ts`

**Interfaces:**
- Produces:
  - `type StatKey = "damage" | "dropRateV2" | "coinMulti" | "expMulti" | "afkGains" | "multikill" | "artifactFind" | "maxHp" | "maxMp" | "accuracy" | "str" | "agi" | "wis" | "luk" | "tomeScore" | "tomeTask"`
  - `type Reading = { id: string; stat: StatKey; charIdx: number; charName: string; map: number; capturedAt: string; game: string; extra?: Record<string, string>; task?: number; saveFile: string; saveSha1: string }`. `game` is the exact text the game shows; `extra` holds other panel values captured at the same time (key = StatKey); `task` is the Tome computeIdx when `stat` is `"tomeTask"`.
  - `READINGS_DIR = "scripts/updater/golden/.cache/readings/"`
  - `loadReadings(): Reading[]` reads `fixtures/readings.json`; `readingSave(r: Reading): unknown | null` returns the envelope, or null when the file is missing.
  - `scripts/readings/import.ts <bundle.json>…` takes a bundle `{ reading: Omit<Reading,"saveFile"|"saveSha1">, envelope }`, writes the envelope to `READINGS_DIR/<id>.json`, computes its sha1 and upserts the metadata into `fixtures/readings.json`, sorted by id.

- [ ] **Step 1: Failing tests** in `registry.test.ts`:
  - `loadReadings()` returns an array whose ids are unique.
  - `readingSave` returns null for a reading whose file doesn't exist.
  - An import round-trip writes the envelope and the metadata and is idempotent: running it twice leaves one entry. Use a temp dir through an optional `dir` argument on the import function, and export the function from the script.
- [ ] **Step 2:** `npx vitest run __tests__/lib/readings/registry.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement. Seed `fixtures/readings.json` with the 2026-11-03 readings. Copy their saves from `scripts/updater/golden/.cache/arkhe-live-2026-11-03-*.json` and the Tome capture in the session scratchpad (`C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon/967c7c34-7dc8-48f7-ac14-a3b0bc4913a8/scratchpad/cap-tome/envelope.json`) into `READINGS_DIR` by running the import on one bundle per reading.

  | Save | Reading | Value | Extra |
  |---|---|---|---|
  | arkhe | damage, ARKHE #0 | `💎9030₸~16475₸` | maxHp `396T`, maxMp `31863341`, str `92,009,075` |
  | markhe-weapon | damage, Markhe #8 | `💎16310₸~22776₸` | maxHp `344T`, maxMp `31940684` |
  | markhe-noweapon | damage, Markhe #8 | `💎13013₸~18171₸` | maxHp `338T`, maxMp `31940684`, str `81,085,001`, agi `23,083,334`, wis `23,204,437`, luk `20,777,867`, accuracy `5.83E35` |
  | farkhe | damage, farkhe #3 | `💎47604339₸~86857861₸` | maxHp `771B`, maxMp `5.1B`, str `23,245,932`, agi `22,527,290`, wis `69,001,715`, luk `20,084,444`, accuracy `2.77E35` |
  | Tome capture | tomeScore | `55,439 PTS` | — |
  | Tome capture | tomeTask 15 | `253 PTS` | — |

  All readings are on map 150 except the Tome ones, which use map 0.
- [ ] **Step 4:** Tests pass; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(readings): in-game readings registry (metadata committed, saves private)`.

### Task 2: Game display formatters

**Files:**
- Create: `lib/readings/format.ts`
- Test: `__tests__/lib/readings/format.test.ts`

**Interfaces:**
- Consumes: the existing game formatters (`lib/damage/format.ts` `formatDamageLine`, `lib/multikill/format.ts`, `lib/coinMulti/format.ts` `notateBig`/`formatCoinMulti`, `lib/expMulti/format.ts`, `lib/afkGains/pageConfig.ts` `formatAfkGains`, `lib/artifactFind/format.ts`, `lib/dropRateV2/format.ts`).
- Produces: `formatGameValue(stat: StatKey, v: { value: number; min?: number }): string`, which prints exactly what the game shows. Map:
  - damage → `formatDamageLine(min, value)`;
  - maxHp / accuracy → N.js `NotateNumber(…, "Big")`. Confirm in N.js that the Player Info uses it for these lines; accuracy at ≥1e33 prints `5.83E35` with an uppercase E.
  - maxMp → `Math.round` with no separators;
  - str/agi/wis/luk → `CommaNotation` (thousands with commas) below 1e9;
  - tomeScore / tomeTask → `"<n with commas> PTS"`;
  - the kit trackers → their page's `formatTotal` + unit.
- Also produces `normalizeGameText(s: string): string`, which trims and collapses inner whitespace before comparison.

- [ ] **Step 1: Failing tests** covering every stat key. Use the strings in the Task 1 table, plus one value per kit tracker taken from its own existing format test.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Cite the N.js Player Info offsets (@6710738 and the STR/HP/accuracy pushes) in comments. **Step 4:** pass + tsc.
- [ ] **Step 5: Commit** `feat(readings): game display formatters per stat`.

### Task 3: Readings test

**Files:**
- Create: `lib/readings/compute.ts`, `__tests__/readings/readings.save.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2; the page configs `lib/<tracker>/pageConfig.ts` (`compute`); `computeTome` (`lib/tome/compute`); `computeTotalStat` (`lib/arkh/stats/systems/common/stats`), `computePlayerHPmax`/`computePlayerMPmax` (`derived-stats`) and `computeAccuracy` (`derived-damage`).
- Produces: `computeReadingValue(r: Reading, save: unknown): Promise<{ value: number; min?: number }>`. Today it dispatches to `lib/arkh`; later plans swap each stat to `lib/game` behind this same function.

- [ ] **Step 1: Test** `it.each(loadReadings())`. For each reading with a save present, assert `normalizeGameText(formatGameValue(r.stat, await computeReadingValue(r, save))) === normalizeGameText(r.game)`, and do the same for every `extra` entry. Readings without a save are skipped through `it.skipIf`, with the reading id in the test name.
- [ ] **Step 2:** Run the test: green on today's engine, because every seeded reading already matches the game. If one fails, the formatter or dispatch is wrong; fix it and don't loosen the assert.
- [ ] **Step 3: Commit** `test(readings): every recorded in-game reading guards the code`.

### Task 4: "Record in-game reading" (debug)

**Files:**
- Create: `components/statTracker/RecordReading.tsx`, `lib/readings/catalog.ts`
- Modify: `components/statTracker/StatCalculator.tsx` (render `RecordReading` only when `?debug=1`), `lib/statTracker/config.ts` (optional `readingStat?: StatKey` on `StatPageConfig`), each kit page config (set `readingStat`)
- Test: `__tests__/components/statTracker/RecordReading.test.tsx`

**Interfaces:**
- Consumes: the calculator's `save`, `charIdx`, `mapIdx`, `chars`; Task 1 types.
- Produces:
  - `INTERMEDIATES: Record<StatKey, StatKey[]>`: which other panel values the form asks for. For damage: maxHp, maxMp, str, agi, wis, luk, accuracy. For others: as the spec catalog says, empty by default.
  - The form fields: the stat's game text plus optional intermediates.
  - "Download" saves `reading-<stat>-<charName>-<yyyymmddHHMM>.json` = `{ reading, envelope: save }` via a Blob link. The envelope is the loaded save object; assert it has no `gameAuth` or token fields.

- [ ] **Step 1: Failing test** (testing-library):
  - Without `?debug=1` the button doesn't render.
  - With it, filling the stat field and clicking Download creates a Blob whose JSON has `reading.stat`, `charIdx`, `map`, the typed `game`, and the `envelope`.
  - No key matching `/token|session/i` appears anywhere in the JSON.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. The copy is in English: "Record in-game reading", and the hint "Type exactly what the game shows". **Step 4:** pass + the kit tests (`__tests__/components/statTracker`) unchanged + tsc.
- [ ] **Step 5: Commit** `feat(readings): debug "Record in-game reading" on every tracker`.

### Task 5: `diagnose`

**Files:**
- Create: `lib/diagnose/sensitivity.ts`, `lib/diagnose/hypotheses.ts`, `scripts/diagnose.ts`
- Test: `__tests__/lib/diagnose/diagnose.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `flattenTree` (`lib/dropRate/treeFlatten.ts`); each tracker's `gains.totalFromFlat` and `gains.sources`.
- Produces:
  - `elasticities(flat, totalFromFlat, paths): { path: string; e: number }[]`. Each is a numeric d ln total / d ln leaf, with a ±0.1% central difference; a leaf at 0 gets e = 0 and is flagged.
  - `requiredFactor(flat, totalFromFlat, path, targetTotal): number | null`: the factor on that leaf that makes `totalFromFlat` hit the target, by bisection on [1e-3, 1e6], or null if it can't be reached.
  - `rankHypotheses(readings: { flat; total; game; totalFromFlat }[], paths): { path; factors: number[]; spread: number }[]`. The 1-parameter hypotheses (one leaf per path) are ranked by the relative spread of the required factor across readings. Pairs of leaves are an opt-in flag (`--pairs`), solved by least squares on log ratios.
  - `alerts(flat, tree): { path; kind: "zero" | "neutral" | "runtime-note" }[]`: leaves that are exactly 0 or 1 (in mult groups), and nodes whose note contains "active buff only" / "runtime".
  - `whatIf(envelope, mutation: "unequip:<slot>" | "map:<id>")`: mutates a copy of the envelope (equip slot → "Blank" with its stone upgrades cleared; or the char's CurrentMap) so `diagnose --what-if` prints, for the top 5 hypotheses, the predicted game/site ratio after the change.
- CLI: `npx tsx scripts/diagnose.ts <id…> [--pairs] [--what-if <mutation>]`. It prints the per-reading ratio, the top 20 elasticities, the ranked hypotheses with required factors, the alerts and the what-if table.

- [ ] **Step 1: Failing tests** with synthetic trees and `totalFromFlat` (no saves):
  - For `total = a·b`, the elasticity of `a` is 1.
  - For `total = cap(a)` with `cap(v) = v^0.5`, the elasticity is 0.5.
  - The factor `requiredFactor` returns, when re-applied, hits the target.
  - With two readings generated from the same true missing factor on leaf `x`, `rankHypotheses` ranks `x` first with spread < 1e-9.
  - When site = game, the ratio is 1, every required factor is 1, and nothing is ranked as a cause.
  - `whatIf("unequip:1")` sets slot 1 to Blank on a minimal envelope.
- [ ] **Step 2:** FAIL. **Step 3:** Implement the library, then the CLI on top (the CLI is not unit-tested). **Step 4:** pass + tsc.
- [ ] **Step 5:** Smoke-run the CLI on the four damage readings (they already match, so the expected output is ratio ≈ 1 and no strong hypothesis). Paste the output in the commit body.
- [ ] **Step 6: Commit** `feat(diagnose): sensitivity, hypotheses across readings, alerts, what-if`.

### Task 6: `save-diff`

**Files:**
- Create: `lib/diagnose/saveDiff.ts`, `scripts/save-diff.ts`
- Test: `__tests__/lib/diagnose/saveDiff.test.ts`

**Interfaces:**
- Produces:
  - `diffSaves(a, b): { path: string; before: unknown; after: unknown }[]`: a deep diff over `envelope.data`, parsing JSON-string values the way the loader does. Paths look like `EquipOrder_8[0][1]`.
  - `diffTrees(flatA, flatB, minRel = 1e-9)`: the changed leaves.
  - CLI: `save-diff <a.json> <b.json> [--stat <StatKey> --char <n> --map <m>]`.

- [ ] **Step 1: Failing tests** on minimal envelopes: a changed nested array element, an added key, a JSON-string field parsed before the diff, and a tree diff that drops changes below the threshold.
- [ ] **Step 2–4:** FAIL → implement → pass + tsc.
- [ ] **Step 5: Commit** `feat(diagnose): save-diff and tree-diff between two saves`.

---

## Phase 2 — Core of `lib/game`

### Task 7: GameState + strict accessors

**Files:**
- Create: `lib/game/state.ts`, `lib/game/errors.ts`
- Test: `__tests__/lib/game/state.test.ts`

**Interfaces:**
- Produces:
  - `class MissingSaveKey extends Error { key: string }`.
  - `buildGameState(envelope): GameState`. It parses every `data` key, turns JSON strings into values, deep-freezes the result, and keeps `charNames`, `serverVars`, `companion` and `guildData`.
  - Accessors:
    - `GameState.get(key: string): unknown` throws `MissingSaveKey`;
    - `num(state, key, ...idx): number` throws on missing or non-finite values;
    - `opt(state, key, ...idx): unknown | undefined` is the explicit "may be absent" accessor;
    - `charKey(key, ci)` builds `` `${key}_${ci}` ``.

- [ ] **Step 1: Failing tests:**
  - `num` on a present nested value returns the number.
  - A missing key throws `MissingSaveKey` with the exact key path in its message.
  - `opt` on a missing key returns undefined.
  - The state is frozen: mutating it throws in strict mode.
  - JSON-string keys are parsed.
  - Over every save in `scripts/updater/golden/.cache/*.json`, `buildGameState` succeeds (skipIf no saves).
- [ ] **Step 2–4:** FAIL → implement → pass + tsc.
- [ ] **Step 5: Commit** `feat(game): immutable GameState with strict accessors`.

### Task 8: Ctx, cache, trace, Runtime

**Files:**
- Create: `lib/game/ctx.ts`, `lib/game/trace.ts`
- Test: `__tests__/lib/game/ctx.test.ts`

**Interfaces:**
- Consumes: Task 7.
- Produces:
  - `type Ctx = { state: GameState; player: number; map: number; cache: Map<string, number>; trace: TraceNode | null }`; `makeCtx(state, { player, map, trace?: boolean }): Ctx`; `withPlayer(ctx, player): Ctx` (a new cache; the state is shared).
  - `block<A extends unknown[]>(name: string, fn: (ctx: Ctx, ...a: A) => number): (ctx: Ctx, ...a: A) => number`. It wraps a mirrored N.js function: it memoizes on `name + JSON.stringify(args)` in `ctx.cache`; when `ctx.trace` is set, it appends `TraceNode { block: name, args, value, children }` with the calls made inside as children; and it throws if the value is not finite.
  - `type TraceNode = { block: string; args: unknown[]; value: number; children: TraceNode[]; note?: string }`.
  - `runtime(ctx, name: string, note: string): number` returns 0 and records a TraceNode with `note: "runtime: …"`. It is the only sanctioned "not computable from the save" value.

- [ ] **Step 1: Failing tests:**
  - A `block` called twice with the same args runs `fn` once.
  - Trace on: nested blocks produce a nested trace with args and values.
  - Trace off: the same value and `ctx.trace === null` (no nodes allocated).
  - A NaN result throws with the block name.
  - `runtime` returns 0 and leaves a noted node.
  - `withPlayer` doesn't share the cache.
- [ ] **Step 2–4:** FAIL → implement → pass + tsc.
- [ ] **Step 5: Commit** `feat(game): Ctx with game-like cache, opt-in trace and Runtime values`.

### Task 9: N.js call-diff

**Files:**
- Create: `lib/diagnose/njsCalls.ts`, `scripts/njs-calls.ts`
- Test: `__tests__/lib/diagnose/njsCalls.test.ts`

**Interfaces:**
- Consumes: `scripts/updater/extract-formulas.ts` (`extractFormulas` + its normalizer), for the raw block bodies of `scripts/updater/.cache/N.new.js`; Task 8 traces.
- Produces:
  - `njsCalls(blockBody: string): { block: string; arg0?: string | number }[]` collects every `_customBlock_X(` / `m.X(` / `x.X(` call with its first literal argument (string or number). The same regex family as the updater; it must handle `m._customBlock_Summoning("VaultUpgBonus",20,0)` and `k.GetTalentNumber(1,95)`.
  - `traceCalls(trace: TraceNode)`: the same shape, from our trace.
  - `callDiff(expected, actual): { missing: …; extra: … }`.
  - CLI: `njs-calls <BlockName> [<subcase>]` prints the N.js calls of that block, and of that sub-case branch when it is a `"X"==d?…` dispatcher.

- [ ] **Step 1: Failing tests:**
  - On a synthetic body `"VaultUpgBonus"==d?m._customBlock_Summoning("VaultUpgBonus",20,0)*x._customBlock_TotalStats("STR"):0`, the result is `[{block:"Summoning",arg0:"VaultUpgBonus"},{block:"TotalStats",arg0:"STR"}]`.
  - `callDiff` reports a missing `TotalStats` when the trace lacks it.
  - On the real `N.new.js` (skipIf the file is absent), the `ArtifactBonus` 25 sub-branch of `_customBlock_Sailing` contains a `TotalStats` call. This is the case that would have caught the Artifact 25 bug.
- [ ] **Step 2–4:** FAIL → implement → pass + tsc.
- [ ] **Step 5: Commit** `feat(diagnose): N.js call-diff (what the game calls vs what we call)`.

### Task 10: Verification map + game data entry

**Files:**
- Create: `lib/game/data/index.ts`, `lib/diagnose/verifyMap.ts`, `scripts/verify-map.ts`
- Test: `__tests__/lib/diagnose/verifyMap.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 8, 9.
- Produces:
  - `lib/game/data/index.ts` re-exports the updater-generated N.js lists (`lib/arkh/stats/data/game/*.js`: customlists, items, custommaps, monsters…) as the `lib/game` data entry point. They are game data generated from N.js, not corgan code; a later plan moves the files physically.
  - `verifyMap(trace: TraceNode, readings: Reading[], readingStatOf: (block: string) => StatKey[]): { block: string; status: "validated" | "derived" | "runtime" }[]`, where "validated" means a reading of a stat whose trace contains that block exists.
  - CLI: `verify-map <StatKey>` writes `reports/verify-<stat>.md`. Add `web/reports/` to `.gitignore` if it isn't there.

- [ ] **Step 1: Failing tests:** on a synthetic trace with three blocks (one covered by a reading, one with a runtime note, one plain), the statuses are exactly validated, runtime and derived.
- [ ] **Step 2–4:** FAIL → implement → pass + tsc.
- [ ] **Step 5:** Full suite (`npx vitest run --reporter=dot`), tsc and push `feat/game-engine`.
- [ ] **Step 6: Commit** `feat(game): data entry point and verification map`.

---

## Next plans (one per tracker; out of this plan)

These follow the order in the spec: Artifact Find → Coin → EXP → AFK → Damage (+ overkill) → Multikill → DR V2 → DR V1 (migrate or retire) → Tome → Talents → Cooking → remaining `lib/arkh` users → delete `lib/arkh` + MIT. Each one ports the N.js blocks its tracker needs into `lib/game/njs/`, adds the `lib/game/trackers/<tracker>.ts` adapter that returns `{ tree, total }`, and switches `computeReadingValue` and the page to it only when the spec's switch criteria pass.
