# Coin Multi Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/coin-multi` ("Coin Multi Tracker"): each character's monster-coin multiplier computed from the save, faithful to N.js `ArbitraryCode("MonsterCash")`. It gets the full source tree, personal snapshots, Compare vs Observed Max and 💡 Biggest Gains, as a fork of the Drop Rate page.

**Architecture:**
- **Engine** (`web/lib/arkh`, shared, additive only):
  - A new descriptor `coin-multi` defines 22 multiplicative groups plus one additive group.
  - A single new `coin` system resolves every source. It reuses existing helpers and ports the missing or partial ones from N.js.
  - Entry points live in `computeCoin.ts`.
- **UI and Observed Max collector:** forks of the Drop Rate files under `components/coinMulti`, `lib/coinMulti`, `app/coin-multi` and `scripts/update-top-coin.ts`.
- **Generic pieces reused as-is:** `DeepView`, `ProfileNameLoader`, `treeFlatten` and `extract`.

**Tech Stack:** Next.js 16 (app router, client components), TypeScript, Vitest 2 + happy-dom + Testing Library, Playwright e2e, tsx scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-23-coin-multi-page-design.md`

## Global Constraints

- **Site copy:** in English.
- **Never run `npm run dev` / `next dev`.** Verify with `npx vitest run`, `npx tsc --noEmit -p tsconfig.json` (from `web/`), tsx scripts and the Vercel preview.
- **Drop Rate must not change behaviour.**
  - `web/__tests__/lib/arkh/family-guy-dr.test.ts` still reads Markhe = 363,893.46 exactly.
  - The golden tests and every DR/Talents test stay green and **unedited**.
  - No edits to `components/dropRate/*`, `lib/dropRate/*`, `app/drop-rate/*`, `scripts/update-top-dr.ts` or `scripts/_shared/{top8DrCards,classGating}.ts`. Importing their exports is allowed.
- **Engine changes are additive.** The only allowed edit to existing engine code is the one this plan names: a new export in `farming.ts` (Task 2) plus the registry entry (Task 1).
- **Sources of truth:**
  - N.js (live, sha `6de681a96813`, `https://www.legendsofidleon.com/ytGl5oc/N.js`) is the source of truth.
  - IdleonToolbox's live parser is a cross-check only. Where they differ, follow N.js and write the deviation in a code comment.
  - Never copy IdleonToolbox code (GPL-3.0); port from N.js.
- **`getbonus2`:** every `maxTalentBonus(id, activeCharIdx, saveData)` call passes the **active** character index (lesson of PRs #27/#28).
- **Private saves are never committed.**
  - They live in `web/scripts/updater/golden/.cache/` (gitignored).
  - Tests that need them use `describe.skipIf(!existsSync(SAVE))`, with the file read inside `beforeAll`.
- **Page storage keys:**

  | Purpose | Key |
  |---|---|
  | Snapshots | `coin-multi-tracker.v1` |
  | Pasted save | `coin-multi-tracker.last-upload.v1` |
  | Player name | `coin-multi-tracker.playerName` |
  | Collapse state | `coin-multi.snapshot-section.collapsed.v1` |

- **Git:**
  - Stage only the files a task names; no `git add -A`.
  - Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Work on branch `feat/coin-multi-page`. Never merge to `main`.

## Rulings (plan vs spec)

1. **No card-slot cap in the Observed Max collector** (spec §3 listed a fork of `top8DrCards`).
   - Why: the coin formula has a single equipped-card source (`CardBonusREAL(11)`). Its per-source max is one character's real loadout, so it can't exceed 8 slots. `7·CardLv("w5b1")` uses the card's level, which is account-wide, not a slot.
   - Cost if wrong: none; the cap only matters with two card sources.
2. **No `categorize.ts` rules** (spec §1 listed them).
   - Why: each coin group is already its own bucket node, and `DeepView` renders it. The Per World tab is turned off with `showWorldView={false}`.
   - Cost if wrong: cosmetic.
3. **Vault 37 is not an IT divergence** (spec risk 1 retracted for it).
   - Why: `VaultKillzTotal(9)` = Σ min(100, bubble lv) over cauldrons 0–3, which is what IT does.
   - The known IT gaps are four, and all are folded into the total test (Task 5):
     - `7·CardLv("w5b1")` in the additive group, which IT omits;
     - Measurement 13 inside Gambit 7: IT adds the miniboss skulls (`OverkillQTY(7)`) to `MeasurementQTYfound(6)`, which N.js sums over worlds 0–6 only;
     - `TalentCalc(643)` = talent × `OverkillStuffs("2")`, the multikill tier (51 for Markhe on map 14): IT uses ×1 (found in Task 1);
     - golden food: N.js adds `JellyOperation("RoG_BonusQTY",10)` to the golden-food multiplier; IT omits it (found in Task 1).
4. **In-game precision.**
   - The game shows the coin multi at ≤ 3–4 significant digits: "Big" notation (e.g. `6.77E35`), or truncation to 0.1M/0.1B.
   - So the validation test (Task 12) compares the display string.
   - Full-precision fidelity comes from the per-group IdleonToolbox cross-check (Tasks 1–5).
5. **Gambit 7 gets its own task (Task 5)**, with the port written out in full.
   - Its multiplier pulls seven cavern sub-terms; Measurement 13 needs a Deathnote skull count the engine never ported.
   - Checked while planning on the reference save: every sub-term equals IdleonToolbox's except Measurement 13 (79.0333 in IT vs 77.1284 in N.js, 58 miniboss skulls), so Gambit 7 = **74.03532772764761** (IT: 74.04491048389032).
6. **Where the game shows the value** (spec risk 4, resolved): Upgrade Vault → upgrade 2 "Monster Tax" → the line "Total Coin Bonus from all sources: …x". N.js @11794293 fills its `~` with `ArbitraryCode("MonsterCash")` for the **active character on its current map**.
7. **The map drives two terms** (found in Task 1): the guild world, and talent 643's multikill tier (the AFK monster's HP; exponent 5 from map 300). The `talent643` source follows the selected map; the collector uses map 301 (W7's first fighting map; 300 is a town).

## Reference values (IdleonToolbox live `getCashMulti`)

These values come from IdleonToolbox's live `getCashMulti`, run on the signed-in save fetched 2026-09-23 05:25 UTC, for Markhe (char 8) on map 14.

**Checks so far:**
- The product of the group factors below reproduces IT's total **exactly**: 6.773746899414287e+35. That confirms the group shapes.
- Expected per-source values were obtained by running IT's parser on that exact file.

**Save file:** Task 1 copies it to `web/scripts/updater/golden/.cache/arkhe-live-2026-09-23.json`.

| Group | IT Σ inside the group | Notes |
|---|---|---|
| g01 bubbles | 96072522.0188378 | |
| g02 comp24 | 5 | raw companion value |
| g03 comp38 | 3 | |
| g04 comp45 | 0.5 | |
| g05 comp159 | 1.5 | |
| g06 | 0.5 | |
| g07 | 0.6 | |
| g08 etc77 | 136.0876673693313 | |
| g09 | 20 | |
| g10 | 40 | |
| g11 | 51.9675 | |
| g12 etc100 | 530.625 | |
| g13 | 50 | |
| g14 gambit7 | 74.04491048389032 | N.js: 74.03532772764761 (Ruling 5) |
| g15 | 250 | |
| g16 | 478.9864015395238 | |
| g17 | 151458.79261439998 | meal 120491.29261439998 + artifact 22800 + roo 8167.5 + vote 0 |
| g18 | 20695.660925624787 | arena 0.5 + 1, friend 0, statue 2069416.0925624787 ÷ 100 |
| g19 | 17114049662317.4 | mainframe 17114049124783.2 + vault34 12292.8 + vault37 525241.4 |
| g20 | 40 | |
| g21 | 0 | |
| g22 | 36937.47294540802 | divinity 5379.683449995177 + crop depot 31557.789495412842 |
| g23 | 69877.71279617335 | IT has no w5b1 term, see below |

Per-source detail for g23 (IT): t657 46.666666666666664, vial 101.92, etc3 2088.704016863951, card11 0, t22+t643+t644 1306.4712107932967, flurbo 25, arcade10+11 60.298507462686565, box13c 23.4, guild 16.666666666666668 (×1 at map 14), gold food 41196.37827189698, vault17 6544.72745582309, achievements 35, vault2 4657.08, vault14 3349, vault31 2206.4, ola420 150, vault70 8070.

## File Structure

**Create — engine**

| File | Contents |
|---|---|
| `web/lib/arkh/stats/defs/coin-multi.ts` | `COIN_GROUPS`, `groupFactor`, `COIN_ROOT`, the descriptor and its `combine` |
| `web/lib/arkh/stats/systems/coin/coin.ts` | The `coin` system (one id per N.js term) and `COIN_CLASS_TALENTS` |
| `web/lib/arkh/stats/systems/coin/accountKills.ts` | `accountMapKills`, `vaultKillzTotal`, `cardsCollected` |
| `web/lib/arkh/stats/systems/coin/divinityMinor.ts` | `divinityMinorSum`, `pocketDivOwned` |
| `web/lib/arkh/stats/systems/coin/gambit.ts` | `gambitBonus` and its cavern sub-terms |
| `web/lib/arkh/computeCoin.ts` | `computeArkhCoinMulti`, `computeArkhCoinPools`, `combineCoinPools` |

**Create — page**

| File | Contents |
|---|---|
| `web/lib/coinMulti/format.ts` | In-game display (`formatCoinMulti`) |
| `web/lib/coinMulti/storage.ts` | Snapshot store |
| `web/lib/coinMulti/mapOptions.ts` | `buildCoinMapOptions` |
| `web/lib/coinMulti/biggestGains.ts` | Multi-group gain math |
| `web/lib/coinMulti/topCoinMulti.ts`, `topCoinMulti.meta.ts` | Generated by Task 10 |
| `web/components/coinMulti/CoinCalculator.tsx` | Calculator |
| `web/components/coinMulti/CoinSnapshotSection.tsx` | Snapshot history |
| `web/components/coinMulti/CoinBiggestGains.tsx` | Biggest Gains tab |
| `web/app/coin-multi/page.tsx`, `CoinMultiPageClient.tsx` | Route and page client |

**Create — collector**

| File | Contents |
|---|---|
| `web/scripts/update-top-coin.ts` | Observed Max collector |
| `web/scripts/_shared/coinClassGating.ts` | Class gating for coin talents |

**Create — tests**
- `web/__tests__/lib/arkh/coin-multi.combine.test.ts`
- `web/__tests__/lib/arkh/coin-multi.save.test.ts` (private save)
- `web/__tests__/lib/coinMulti/format.test.ts`
- `web/__tests__/lib/coinMulti/storage.test.ts`
- `web/__tests__/lib/coinMulti/mapOptions.test.ts`
- `web/__tests__/lib/coinMulti/biggestGains.test.ts`
- `web/__tests__/components/CoinCalculator.keepView.test.tsx`
- `web/__tests__/components/CoinBiggestGains.test.tsx`
- `web/__tests__/scripts/coin-class-gating.test.ts`

**Modify**
- `web/lib/arkh/stats/registry.ts`: register `coin`.
- `web/lib/arkh/stats/systems/w6/farming.ts`: add an exported `cropSCbonMulti`; existing code untouched.
- `web/components/TopNav.tsx` and `web/app/page.tsx`: nav item and home card.
- Test files: `web/__tests__/components/TopNav.test.tsx`, `web/__tests__/components/accountSaveOverPaste.test.tsx`, `web/e2e/homepage.spec.ts`.
- `.github/workflows/refresh-top-max.yml`: new collector step.

---

### Task 1: Coin engine skeleton + sources the engine already computes

**Files:**
- Create: `web/lib/arkh/stats/defs/coin-multi.ts`, `web/lib/arkh/stats/systems/coin/coin.ts`, `web/lib/arkh/computeCoin.ts`
- Modify: `web/lib/arkh/stats/registry.ts` (import + catalog entry)
- Test: `web/__tests__/lib/arkh/coin-multi.combine.test.ts`, `web/__tests__/lib/arkh/coin-multi.save.test.ts`

**Interfaces:**
- Produces:
  - `COIN_ROOT = "Coin Multi"`;
  - `type CoinGroupKind = "pct" | "raw" | "min4"`;
  - `type CoinGroup = { key; name; kind; sources: readonly string[] }`;
  - `COIN_GROUPS: readonly CoinGroup[]` (23 entries, keys `g01`…`g23`);
  - `groupFactor(kind, sum): number`;
  - default export `coinMultiDesc: Descriptor`;
  - `computeArkhCoinMulti(raw, charIdx, mapIdx = 0): { tree: ArkhNode; total: number }`;
  - `computeArkhCoinPools(raw, charIdx, mapIdx = 0): Record<string, Pool>`;
  - `combineCoinPools(pools): { tree; total }`;
  - `coin` system `{ resolve(id: string, ctx: SystemCtx): ArkhNode }`;
  - `COIN_CLASS_TALENTS = [22, 657, 643, 644]`.
- Tree shape (later tasks rely on it):
  - The root is `"Coin Multi"` (fmt `x`, val = total).
  - The root has one child per group, in `COIN_GROUPS` order: name = group name, val = group **factor**, fmt `x`.
  - Each group node's children are its source items, in `sources` order.
  - The flat path of a source is `Coin Multi / <group name> / <item name>`.
- Group sums: `pct` items are in percentage points; `raw` and `min4` items are raw values.

- [ ] **Step 1: Copy the private save used by the tests** (from `web/`)

```bash
cp "C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad/dr/save-live.json" scripts/updater/golden/.cache/arkhe-live-2026-09-23.json
git status --short scripts/updater/golden/.cache
```
Expected: the `git status` line prints nothing (the folder is gitignored).

- [ ] **Step 2: Write the failing combine test** — `web/__tests__/lib/arkh/coin-multi.combine.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { combineCoinPools } from "@/lib/arkh/computeCoin";
import { COIN_GROUPS, COIN_ROOT, groupFactor } from "@/lib/arkh/stats/defs/coin-multi";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: vals.reduce((a, b) => a + b, 0),
  product: 0,
});
const empty = (): Record<string, Pool> =>
  Object.fromEntries(COIN_GROUPS.map((g) => [g.key, pool()]));

describe("Coin Multi combine (N.js ArbitraryCode MonsterCash)", () => {
  it("applies each group shape", () => {
    expect(groupFactor("pct", 50)).toBe(1.5);
    expect(groupFactor("raw", 0.5)).toBe(1.5);
    expect(groupFactor("min4", 5)).toBe(5); // 1 + min(4, 5)
    expect(groupFactor("min4", 1.5)).toBe(2.5);
  });

  it("has 23 groups in game order, the last one additive", () => {
    expect(COIN_GROUPS).toHaveLength(23);
    expect(COIN_GROUPS.map((g) => g.key)).toEqual(
      Array.from({ length: 23 }, (_, i) => `g${String(i + 1).padStart(2, "0")}`)
    );
    expect(COIN_GROUPS[17].kind).toBe("raw"); // arena · friend · statue: no /100
    expect(COIN_GROUPS[22].kind).toBe("pct");
  });

  it("an empty save multiplies to 1", () => {
    const r = combineCoinPools(empty());
    expect(r.total).toBe(1);
    expect(r.tree.name).toBe(COIN_ROOT);
    expect(r.tree.children).toHaveLength(23);
  });

  it("multiplies every group factor and keeps the items", () => {
    const p = empty();
    p.g01 = pool(100, 50); // pct → 2.5
    p.g02 = pool(5); // min4 → 5
    p.g03 = pool(3); // raw → 4
    p.g18 = pool(0.5, 0, 1, 20694.16); // raw → 20696.66
    p.g23 = pool(10, 20); // pct → 1.3
    const r = combineCoinPools(p);
    expect(r.total).toBeCloseTo(2.5 * 5 * 4 * 20696.66 * 1.3, 6);
    expect(r.tree.children![0]).toMatchObject({ name: COIN_GROUPS[0].name, val: 2.5, fmt: "x" });
    expect(r.tree.children![0].children).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`Cannot find module '@/lib/arkh/computeCoin'`)

Run from `web/`: `npx vitest run __tests__/lib/arkh/coin-multi.combine.test.ts`

- [ ] **Step 4: Create the descriptor** — `web/lib/arkh/stats/defs/coin-multi.ts`

```ts
// ===== COIN MULTI DESCRIPTOR =====
// N.js ArbitraryCode("MonsterCash") (live sha 6de681a96813): 22 multiplicative
// factors and one additive group, in game order. Every term is a source of
// the `coin` system (systems/coin/coin.ts); a group's shape lives here:
//   pct → 1 + Σ/100      raw → 1 + Σ      min4 → 1 + min(4, Σ)

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

export type CoinGroupKind = "pct" | "raw" | "min4";
export type CoinGroup = {
  key: string;
  name: string;
  kind: CoinGroupKind;
  sources: readonly string[];
};

export const COIN_ROOT = "Coin Multi";

export const COIN_GROUPS: readonly CoinGroup[] = [
  { key: "g01", name: "🫧 Cash Bubbles", kind: "pct", sources: ["bubbleSTR", "bubbleAGI", "bubbleWIS"] },
  { key: "g02", name: "🐾 Companion 24", kind: "min4", sources: ["comp24"] },
  { key: "g03", name: "🐾 Coin Drop Multi", kind: "raw", sources: ["comp38"] },
  { key: "g04", name: "🐾 Companion 45", kind: "min4", sources: ["comp45"] },
  { key: "g05", name: "🐾 Companion 159", kind: "min4", sources: ["comp159"] },
  { key: "g06", name: "🛍️ Event Shop 9", kind: "raw", sources: ["eventShop9"] },
  { key: "g07", name: "🛍️ Event Shop 20", kind: "raw", sources: ["eventShop20"] },
  { key: "g08", name: "🎽 Bonus Money Gear", kind: "pct", sources: ["etc77"] },
  { key: "g09", name: "🍣 Sushi 18", kind: "pct", sources: ["sushi18"] },
  { key: "g10", name: "🍣 Sushi 37", kind: "pct", sources: ["sushi37"] },
  { key: "g11", name: "🔬 Research Grid", kind: "pct", sources: ["grid149", "grid169"] },
  { key: "g12", name: "🎽 Extra Money Gear", kind: "pct", sources: ["etc100"] },
  { key: "g13", name: "🧰 Gold Set", kind: "pct", sources: ["goldSet"] },
  { key: "g14", name: "🎰 Gambit", kind: "pct", sources: ["gambit7"] },
  { key: "g15", name: "🎁 Cash Bundle", kind: "pct", sources: ["bunY"] },
  { key: "g16", name: "🌪️ Dust Walker", kind: "pct", sources: ["dustWalker"] },
  { key: "g17", name: "🍽️ Meal · Artifact · Roo · Vote", kind: "pct", sources: ["mealCash", "artifact1", "roo6", "vote34"] },
  { key: "g18", name: "🏟️ Arena · Friend · Statue", kind: "raw", sources: ["arena5", "friend5", "arena14", "statue19"] },
  { key: "g19", name: "💻 Lab · Vault Kills", kind: "pct", sources: ["mainframe9", "vault34", "vault37"] },
  { key: "g20", name: "🌟 Pristine Charm 16", kind: "pct", sources: ["pristine16"] },
  { key: "g21", name: "🙏 Jawbreaker Prayer", kind: "pct", sources: ["prayer8"] },
  { key: "g22", name: "⛪ Divinity · Crop Depot", kind: "pct", sources: ["divMinor3", "cropSC4"] },
  {
    key: "g23",
    name: "➕ Additive Pool",
    kind: "pct",
    sources: [
      "talent657", "vialCash", "etc3", "card11", "cardW5b1", "talent22",
      "flurbo4", "arcade10", "arcade11", "box13c", "guild8", "talent643",
      "talent644", "goldFood", "vault17", "ach235", "ach350", "ach376",
      "vault2", "vault14", "vault31", "ola420", "vault70",
    ],
  },
];

export function groupFactor(kind: CoinGroupKind, sum: number): number {
  if (kind === "pct") return 1 + sum / 100;
  if (kind === "raw") return 1 + sum;
  return 1 + Math.min(4, sum);
}

const KIND_NOTE: Record<CoinGroupKind, string> = {
  pct: "× (1 + Σ/100)",
  raw: "× (1 + Σ)",
  min4: "× (1 + min(4, Σ))",
};

const pools: Record<string, SourceSpec[]> = {};
for (const g of COIN_GROUPS) {
  pools[g.key] = g.sources.map((id) => ({ system: "coin", id }));
}

const coinMultiDesc: Descriptor = {
  id: "coin-multi",
  name: COIN_ROOT,
  scope: "character+map",
  category: "economy",
  pools,
  combine(p) {
    let total = 1;
    const children: ArkhNode[] = [];
    for (const g of COIN_GROUPS) {
      const items = p[g.key]?.items ?? [];
      const sum = items.reduce((a, it) => a + (Number(it.val) || 0), 0);
      const factor = groupFactor(g.kind, sum);
      total *= factor;
      children.push({ name: g.name, val: factor, fmt: "x", note: KIND_NOTE[g.kind], children: items });
    }
    return { val: total, children };
  },
};

export default coinMultiDesc;
```

- [ ] **Step 5: Create the entry points** — `web/lib/arkh/computeCoin.ts`

```ts
// ===== ARKH COIN MULTI ENTRY POINT =====
// Loads the save into the arkh state singleton and runs the coin-multi
// descriptor. mapIdx only feeds the guild term (×(1 + ⌊map/50⌋)).

import { loadSaveData } from "./save/loader";
import { saveData } from "./state";
import * as data from "./save/data";
import { buildTree, buildPools, type Pool } from "./stats/tree-builder";
import { getCatalog } from "./stats/registry";
import coinMultiDesc, { COIN_ROOT } from "./stats/defs/coin-multi";
import type { ArkhNode } from "./node";

export type ArkhCoinResult = { tree: ArkhNode; total: number };

function ctxFor(charIdx: number, mapIdx: number) {
  return { saveData, charIdx, activeCharIdx: charIdx, mapBon: data.mapBonData, mapIdx };
}

export function computeArkhCoinMulti(rawEnvelope: any, charIdx: number, mapIdx: number = 0): ArkhCoinResult {
  loadSaveData(rawEnvelope);
  const tree = buildTree(coinMultiDesc, getCatalog(), ctxFor(charIdx, mapIdx));
  return { tree, total: tree.val };
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhCoinPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  loadSaveData(rawEnvelope);
  return buildPools(coinMultiDesc, getCatalog(), ctxFor(charIdx, mapIdx));
}

export function combineCoinPools(pools: Record<string, Pool>): ArkhCoinResult {
  const r = coinMultiDesc.combine(pools, {} as never);
  return { tree: { name: COIN_ROOT, val: r.val, fmt: "x", children: r.children }, total: r.val };
}
```

- [ ] **Step 6: Create the `coin` system with every source the engine already computes** — `web/lib/arkh/stats/systems/coin/coin.ts`

```ts
// ===== COIN SYSTEM =====
// One id per term of N.js ArbitraryCode("MonsterCash"). Each returns what the
// formula adds inside its group; defs/coin-multi.ts owns the group shapes.
// Existing helpers are reused as-is; terms the engine never ported live in
// this folder so the Drop Rate paths stay untouched.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { getLOG } from "../../../formulas";
import { optionsListData } from "../../../save/data";
import { eventShopOwned } from "../../../game-helpers";
import { label } from "../../entity-names";
import { bubbleValByKey, computeVialByKey } from "../w2/alchemy";
import {
  computeMealBonus,
  computeStatueBonusGiven,
  computeCardBonusByType,
  computeBoxReward,
} from "../common/stats";
import { companions } from "../common/companions";
import { etcBonus } from "../common/etcBonus";
import { sushiRoG } from "../w7/sushi";
import { gridBonusValue } from "../w4/lab";
import { getSetBonus } from "../w3/setBonus";
import { maxTalentBonus, talent } from "../common/talent";
import { friend } from "../common/friend";
import { vaultUpgBonus } from "../common/vault";
import { pristineBon } from "../w5/pristine";
import { computePrayerReal } from "../w3/prayer";
import { computeCardLv } from "../common/cards";
import { arcadeBonus } from "../w2/arcade";
import { guild } from "../common/guild";
import { goldFoodBonuses } from "../common/goldenFood";
import { achieveStatus } from "../common/achievement";

/** Class talents in the coin formula (per-char GetTalentNumber / TalentCalc).
 *  Talent 433 is account-wide (getbonus2) so it isn't listed. */
export const COIN_CLASS_TALENTS = [22, 657, 643, 644] as const;

type Tree = { val: number; children: ArkhNode[] | null };
const add = (name: string, r: Tree, note?: string): ArkhNode =>
  node(name, r.val, r.children, { fmt: "+", note });
const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });

const BUBBLES: Record<string, { name: string; key: string; stat: number; label: string }> = {
  bubbleSTR: { name: "Penny of Strength", key: "CashSTR", stat: 0, label: "STR" },
  bubbleAGI: { name: "Dollar of Agility", key: "CashAGI", stat: 1, label: "AGI" },
  bubbleWIS: { name: "Nickel of Wisdom", key: "CashWIS", stat: 2, label: "WIS" },
};

const ACH_WEIGHT: Record<number, number> = { 235: 5, 350: 10, 376: 20 };

function resolveCoin(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;

  switch (id) {
    // G1 — CashSTR·⌊STR/250⌋ + CashAGI·⌊AGI/250⌋ + CashWIS·⌊WIS/250⌋. The stat
    // is the save's PVStatList (what the game wrote from TotalStats).
    case "bubbleSTR":
    case "bubbleAGI":
    case "bubbleWIS": {
      const b = BUBBLES[id];
      const statVal = Number((s as any).statList?.[ci]?.[b.stat]) || 0;
      const steps = Math.floor(statVal / 250);
      const bub = bubbleValByKey(b.key, ci, s);
      return node(
        `${b.name} (${b.key})`,
        bub.val * steps,
        [
          node("Bubble", bub.val, bub.children, { fmt: "raw" }),
          raw(`Total ${b.label}`, statVal),
          raw(`⌊${b.label} / 250⌋`, steps),
        ],
        { fmt: "+" }
      );
    }
    // G2–G5 — companion values; the group applies min(4, ·) or 1 + v.
    case "comp24":
    case "comp38":
    case "comp45":
    case "comp159": {
      const n = Number(id.slice(4));
      return node(label("Companion", n), companions(n, s), null, { fmt: "raw" });
    }
    // G6/G7 — (1 + .5·EventShopOwned(9)) and (1 + .6·EventShopOwned(20)).
    case "eventShop9":
    case "eventShop20": {
      const n = id === "eventShop9" ? 9 : 20;
      const coeff = n === 9 ? 0.5 : 0.6;
      const owned = eventShopOwned(n, s.cachedEventShopStr || "");
      return node(`Event Shop ${n} (×${coeff})`, coeff * owned, [raw("Owned", owned)], { fmt: "raw" });
    }
    // EtcBonuses("77"/"100"/"3") — numeric ids (a string id drops gallery items).
    case "etc77":
    case "etc100":
    case "etc3":
      return etcBonus.resolve(Number(id.slice(3)), { saveData: s, charIdx: ci });
    case "sushi18":
    case "sushi37":
      return sushiRoG.resolve(Number(id.slice(5)), ctx as any);
    case "grid149":
    case "grid169": {
      const n = Number(id.slice(4));
      return node(`Research Grid ${n}`, gridBonusValue(n, s), null, { fmt: "+" });
    }
    case "goldSet":
      return add("Gold Set", getSetBonus("GOLD_SET"));
    // G15 — (1 + 250·bun_y/100). Don't call bundle.resolve: it recurses on any
    // bundle id other than bun_v/bun_p.
    case "bunY": {
      const owned = Number((s.bundlesData as any)?.bun_y) === 1 ? 1 : 0;
      return node("Cash Bundle (bun_y)", 250 * owned, [raw("Owned", owned)], { fmt: "+" });
    }
    // G16 — max(1, getbonus2(1,433,-1))·getLOG(OLA[362]), active-char context.
    case "dustWalker": {
      const tv = Math.max(1, maxTalentBonus(433, ci, s));
      const lg = getLOG(ola(362));
      return node(
        `${label("Talent", 433)} × log(OLA[362])`,
        tv * lg,
        [raw("Talent 433 (getbonus2, min 1)", tv), raw("log10(OLA[362])", lg)],
        { fmt: "+" }
      );
    }
    case "mealCash":
      return add("Meals (Cash)", computeMealBonus("Cash", s));
    // G18 adds these WITHOUT /100 — except the statue, which is /100.
    case "friend5":
      return friend.resolve(5, { saveData: s });
    case "statue19": {
      const r = computeStatueBonusGiven(19, ci, s);
      return node(
        `${label("Statue", 19)} ÷ 100`,
        r.val / 100,
        [node("Statue bonus", r.val, r.children, { fmt: "raw" })],
        { fmt: "raw" }
      );
    }
    case "pristine16":
      return node(label("Pristine", 16), pristineBon(16, s), null, { fmt: "+" });
    case "prayer8":
      return add(label("Prayer", 8), computePrayerReal(8, 0, ci, s));
    // G23 terms.
    case "talent657":
    case "talent22":
    case "talent643":
    case "talent644":
      return talent.resolve(Number(id.slice(6)), tctx);
    case "vialCash":
      return add("Cash Vial (MonsterCash)", computeVialByKey("MonsterCash", s));
    case "card11":
      return add("Money Cards (Card Type 11)", computeCardBonusByType(11, ci, s));
    case "cardW5b1": {
      const lv = computeCardLv("w5b1", s);
      return node(`${label("Card", "w5b1")} × 7`, 7 * lv, [raw("Card Lv", lv)], { fmt: "+" });
    }
    case "arcade10":
    case "arcade11": {
      const n = Number(id.slice(6));
      return add(label("Arcade", n), arcadeBonus(n, s));
    }
    // BoxRewards["13c"] — computeBoxReward applies the slot thresholds
    // (postOffice.resolve doesn't).
    case "box13c":
      return add("Post Office 13c", computeBoxReward(ci, "13c"));
    case "guild8": {
      const gn = guild.resolve(8, { saveData: s } as any);
      const world = 1 + Math.floor((ctx.mapIdx ?? 0) / 50);
      return node(
        "Guild 8 × World",
        (Number(gn.val) || 0) * world,
        [gn, node("1 + ⌊map / 50⌋", world, null, { fmt: "x" })],
        { fmt: "+" }
      );
    }
    case "goldFood":
      return node(
        "Golden Food (MonsterCash)",
        goldFoodBonuses("MonsterCash", ci, undefined, s).total,
        null,
        { fmt: "+" }
      );
    case "ach235":
    case "ach350":
    case "ach376": {
      const n = Number(id.slice(3));
      const w = ACH_WEIGHT[n];
      return node(`${label("Achievement", n)} × ${w}`, w * achieveStatus(n, s), null, { fmt: "+" });
    }
    case "vault2":
      return node(label("Vault", 2), vaultUpgBonus(2, s), null, { fmt: "+" });
    case "vault17": {
      const v = vaultUpgBonus(17, s);
      const lg = getLOG(ola(340));
      return node(
        `${label("Vault", 17)} × log(OLA[340])`,
        v * lg,
        [raw("Vault 17", v), raw("log10(OLA[340])", lg)],
        { fmt: "+" }
      );
    }
    case "ola420":
      return node("Ninja Extra Cash (OLA[420])", ola(420), null, { fmt: "+" });
    default:
      // Ported by Tasks 2–5; 0 keeps the product valid meanwhile.
      return node(`${id} (not ported yet)`, 0, null, { note: "coin:" + id });
  }
}

export const coin = { resolve: resolveCoin };
```

- [ ] **Step 7: Register the system** — in `web/lib/arkh/stats/registry.ts` add `import { coin } from "./systems/coin/coin";` after the `familyBonus` import, and `coin: coin as unknown as SystemResolver,` as the last entry of `_systems`.

- [ ] **Step 8: Run the combine test — expect PASS**

Run: `npx vitest run __tests__/lib/arkh/coin-multi.combine.test.ts`

- [ ] **Step 9: Write the private-save test** — `web/__tests__/lib/arkh/coin-multi.save.test.ts`

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { COIN_GROUPS } from "@/lib/arkh/stats/defs/coin-multi";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getCashMulti on this exact file for
// Markhe on map 14 (see the plan's reference table).
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("Coin Multi — Markhe on map 14 vs IdleonToolbox", () => {
  let tree: ArkhNode;
  beforeAll(() => {
    const save = JSON.parse(readFileSync(SAVE, "utf8"));
    tree = computeArkhCoinMulti(save, save.charNames.indexOf("Markhe"), 14).tree;
  });

  const src = (id: string): number => {
    const gi = COIN_GROUPS.findIndex((x) => x.sources.includes(id));
    const si = COIN_GROUPS[gi].sources.indexOf(id);
    return Number(tree.children![gi].children![si].val) || 0;
  };
  const sum = (...ids: string[]) => ids.reduce((a, id) => a + src(id), 0);
  const close = (actual: number, expected: number) => {
    if (expected === 0) expect(actual).toBe(0);
    else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
  };

  it.each([
    ["cash bubbles", () => sum("bubbleSTR", "bubbleAGI", "bubbleWIS"), 96072522.0188378],
    ["companion 24", () => src("comp24"), 5],
    ["companion 38", () => src("comp38"), 3],
    ["companion 45", () => src("comp45"), 0.5],
    ["companion 159", () => src("comp159"), 1.5],
    ["event shop 9", () => src("eventShop9"), 0.5],
    ["event shop 20", () => src("eventShop20"), 0.6],
    ["bonus money gear (etc 77)", () => src("etc77"), 136.0876673693313],
    ["sushi 18", () => src("sushi18"), 20],
    ["sushi 37", () => src("sushi37"), 40],
    ["research grid", () => sum("grid149", "grid169"), 51.9675],
    ["extra money gear (etc 100)", () => src("etc100"), 530.625],
    ["gold set", () => src("goldSet"), 50],
    ["cash bundle", () => src("bunY"), 250],
    ["dust walker", () => src("dustWalker"), 478.9864015395238],
    ["meal", () => src("mealCash"), 120491.29261439998],
    ["friend 5", () => src("friend5"), 0],
    ["statue 19 ÷ 100", () => src("statue19"), 2069416.0925624787 / 100],
    ["pristine 16", () => src("pristine16"), 40],
    ["prayer 8", () => src("prayer8"), 0],
    ["talent 657", () => src("talent657"), 46.666666666666664],
    ["talents 22 + 643 + 644", () => sum("talent22", "talent643", "talent644"), 1306.4712107932967],
    ["cash vial", () => src("vialCash"), 101.92],
    ["money gear (etc 3)", () => src("etc3"), 2088.704016863951],
    ["money cards", () => src("card11"), 0],
    ["arcade 10 + 11", () => sum("arcade10", "arcade11"), 60.298507462686565],
    ["post office 13c", () => src("box13c"), 23.4],
    ["guild × world", () => src("guild8"), 16.666666666666668],
    ["golden food", () => src("goldFood"), 41196.37827189698],
    ["vault 17 × log", () => src("vault17"), 6544.72745582309],
    ["achievements", () => sum("ach235", "ach350", "ach376"), 35],
    ["vault 2", () => src("vault2"), 4657.08],
    ["ninja extra cash", () => src("ola420"), 150],
  ])("%s", (_name, get, expected) => close(get(), expected));
});
```

- [ ] **Step 10: Run it — every case must PASS.**

Run: `npx vitest run __tests__/lib/arkh/coin-multi.save.test.ts`

A case can fail when an existing helper differs from IdleonToolbox. For each failing case:
1. Print our node's value.
2. Read the N.js term (N.js copy: the session scratchpad `dr/N.js`, or download `https://www.legendsofidleon.com/ytGl5oc/N.js`).
3. Decide with N.js as the truth:
   - if our helper is right, keep our value, change the expected value to it, and add a `// N.js ≠ IT: <why>` comment on that case;
   - if our helper is wrong, fix it **inside `coin.ts`** (never in the shared helper).

- [ ] **Step 11: Full suite + types** (from `web/`)

Run: `npx vitest run` — all green; the DR tests are untouched.
Run: `npx tsc --noEmit -p tsconfig.json` — exit 0.

- [ ] **Step 12: Commit** (from the repo root)

```bash
git add web/lib/arkh/stats/defs/coin-multi.ts web/lib/arkh/stats/systems/coin/coin.ts web/lib/arkh/computeCoin.ts web/lib/arkh/stats/registry.ts web/__tests__/lib/arkh/coin-multi.combine.test.ts web/__tests__/lib/arkh/coin-multi.save.test.ts
git commit -m "feat(coin): coin-multi descriptor + coin system with the engine's existing sources" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Missing sources — vault kills, cards collected, flurbo, crop depot 4, pet arena, Roo

**Files:**
- Create: `web/lib/arkh/stats/systems/coin/accountKills.ts`
- Modify: `web/lib/arkh/stats/systems/coin/coin.ts` (new cases), `web/lib/arkh/stats/systems/w6/farming.ts` (new export `cropSCbonMulti`, existing code untouched)
- Test: `web/__tests__/lib/arkh/coin-multi.save.test.ts` (new cases)

**Interfaces:**
- Consumes: Task 1's `coin.ts` switch and the save test's `src/sum/close` helpers.
- Produces:
  - `accountMapKills(map: number): number`;
  - `vaultKillzTotal(k: number, saveData): number`;
  - `cardsCollected(saveData): number`;
  - `cropSCbonMulti(saveData): number`.

**N.js semantics (sha `6de681a96813`):**
- **`Summoning("VaultKillzTotal", k)`** builds a list:

  | k | Value |
  |---|---|
  | 0–3 | Kills of every player on maps **14, 24, 13, 8**, as `MapDetails[m][0][0] − KillsLeft2Advance[m][0]` summed over players |
  | 4–7 | `kills < 10 ? 0 : ⌊getLOG(kills)⌋` of those |
  | 8 | Count of `Tasks[3][d][f] == 1` for d = 0..3 |
  | 9 | `round(Σ_{c=0..3} Σ_i min(100, CauldronInfo[c][i]))` |

- **`Stuff2("CardsCollected")`**: distinct `CardStuff[b][k][0] != "Blank"` with `Cards[0][key] >= 1`.
- **`FlurboShop(4)`**: `ArbitraryCode5Inputs(DungPassiveStats2[4][3], [4][1], [4][2], DungUpg[5][4])`, which is `formulaEval`.
- **`FarmingStuffs("CropSCbonus", 4)`**: `Ninja("EmporiumBonus", 23) == 1 ? 15·round(#FarmCrop)·CropSCbonMulti : 0`.
- **`Breeding("PetArenaBonus", "0", i)`**: `OLA[89] >= RANDOlist[53][i] ? 1 : 0`. The formula uses `.5·PA5 + PA14`.
- **`Summoning("RooBonuses", 6)`**: `3·(1 + Legend26/100)·(1 + Comp51)·(1 + RooAll/100)·max(0, ⌈(OLA[271] − 6)/7⌉)`.
  - `RooAll = 50·MF1 + 50·MF3 + 50·MF6 + 50·MF8 + 50·min(1, MF11) + 25·max(0, MF11 − 1)`.
  - `MF(k) = OLA[279] > k ? (k == 11 ? OLA[279] − 11 : 1) : 0`.
  - Base 3 and offset 6 were checked in the N.js text (@10827396).

- [ ] **Step 1: Add the failing cases** to the `it.each` table in `coin-multi.save.test.ts`

```ts
    ["flurbo 4", () => src("flurbo4"), 25],
    ["crop depot 4", () => src("cropSC4"), 31557.789495412842],
    ["pet arena 5 (×0.5) + 14", () => sum("arena5", "arena14"), 1.5],
    ["kangaroo (Roo 6)", () => src("roo6"), 8167.5],
    ["vault 14 × kills(4)", () => src("vault14"), 3349],
    ["vault 31 × kills(7)", () => src("vault31"), 2206.4],
    ["vault 34 × kills(8)", () => src("vault34"), 12292.8],
    ["vault 37 × kills(9)", () => src("vault37"), 525241.4],
    ["vault 70 × cards collected", () => src("vault70"), 8070],
```

- [ ] **Step 2: Run** `npx vitest run __tests__/lib/arkh/coin-multi.save.test.ts`. Expect FAIL: the 9 new cases read 0.

- [ ] **Step 3: Create** `web/lib/arkh/stats/systems/coin/accountKills.ts`

```ts
// ===== ACCOUNT KILL COUNTERS (coin) =====
// Ports of N.js Summoning("VaultKillzTotal", k) and Stuff2("CardsCollected").

import { mapKillReq } from "../../data/common/maps";
import { klaData, numCharacters, cauldronInfoData } from "../../../save/data";
import { getLOG } from "../../../formulas";
import { CardStuff } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

/** N.js: MapDetails[m][0][0] − KillsLeft2Advance[m][0], summed over every player. */
export function accountMapKills(m: number): number {
  let total = 0;
  for (let ci = 0; ci < numCharacters; ci++) {
    const row = (klaData as any[])[ci]?.[m];
    if (!Array.isArray(row)) continue;
    total += mapKillReq(m) - (Number(row[0]) || 0);
  }
  return total;
}

// VaultKillzTotal order: kills on maps 14, 24, 13, 8 (0–3), ⌊log10⌋ of those
// (4–7), Tasks[3] completions (8), Σ min(100, bubble lv) (9).
const VK_MAPS = [14, 24, 13, 8] as const;

export function vaultKillzTotal(k: number, saveData: SaveData): number {
  if (k >= 0 && k <= 3) return accountMapKills(VK_MAPS[k]);
  if (k >= 4 && k <= 7) {
    const kills = accountMapKills(VK_MAPS[k - 4]);
    return kills < 10 ? 0 : Math.floor(getLOG(kills));
  }
  if (k === 8) {
    const t3 = ((saveData.tasksGlobalData as any[]) ?? [])[3] ?? [];
    let n = 0;
    for (let d = 0; d < 4; d++) for (const v of t3[d] ?? []) if (Number(v) === 1) n++;
    return n;
  }
  if (k === 9) {
    let n = 0;
    for (let c = 0; c < 4; c++) {
      for (const lv of (cauldronInfoData as any[])[c] ?? []) n += Math.min(100, Number(lv) || 0);
    }
    return Math.round(n);
  }
  return 0;
}

/** N.js Stuff2("CardsCollected"): distinct CardStuff cards with Cards[0][key] ≥ 1. */
export function cardsCollected(saveData: SaveData): number {
  const owned = (saveData.cards0Data ?? {}) as Record<string, unknown>;
  let n = 0;
  for (const row of CardStuff as unknown as unknown[][]) {
    for (const card of row ?? []) {
      const key = String((card as unknown[])?.[0] ?? "Blank");
      if (key !== "Blank" && Number(owned[key]) >= 1) n++;
    }
  }
  return n;
}
```

- [ ] **Step 4: Add `cropSCbonMulti` to `web/lib/arkh/stats/systems/w6/farming.ts`.** Append at the end of the file; leave the `cropSC7` branch as it is. The factors are the ones that branch already uses.

```ts
/** N.js FarmingStuffs("CropSCbonMulti") — shared by every Crop Depot bonus
 *  (the same factors the cropSC7 branch above multiplies). */
export function cropSCbonMulti(saveData: SaveData): number {
  const mf17 = mainframeBonus(17, saveData);
  const grim22 = grimoireUpgBonus22(saveData);
  const exotic40Lv = Number((saveData.farmUpgData as any)?.[60]) || 0;
  const exotic40 = exotic40Lv > 0 ? (20 * exotic40Lv) / (1000 + exotic40Lv) : 0;
  const vault79 = vaultUpgBonus(79, saveData);
  return (1 + mf17 / 100) * (1 + (grim22 + exotic40 + vault79) / 100);
}
```

- [ ] **Step 5: Add the cases to `resolveCoin`** in `coin.ts`.

New imports:
```ts
import { formulaEval } from "../../../formulas";
import { emporiumBonus } from "../../../game-helpers";
import { DungPassiveStats2, RANDOlist } from "../../data/game/customlists.js";
import { legendPTSbonus } from "../w7/spelunking";
import { cropSCbonMulti } from "../w6/farming";
import { vaultKillzTotal, cardsCollected } from "./accountKills";
```
Extend the existing `getLOG` / `eventShopOwned` import lines instead of duplicating them. Then add these cases before `default:`:

```ts
    case "flurbo4": {
      const row = ((DungPassiveStats2 as any[])[4] ?? []) as unknown[];
      const lv = Number((s.dungUpgData as any[])?.[5]?.[4]) || 0;
      const v = formulaEval(String(row[3]), Number(row[1]), Number(row[2]), lv);
      return node("Flurbo Shop 4 (Monster Cash)", v, [raw("Level", lv)], { fmt: "+" });
    }
    case "cropSC4": {
      const unlocked = emporiumBonus(23, (s.ninjaData as any[])?.[102]?.[9]) ? 1 : 0;
      const crops = Math.round(s.farmCropCount || 0);
      const multi = cropSCbonMulti(s);
      return node(
        "Crop Depot Bonus 4 (Cash)",
        unlocked ? 15 * crops * multi : 0,
        [raw("Emporium 23 unlocked", unlocked), raw("Crops found", crops), node("Depot multi", multi, null, { fmt: "x" })],
        { fmt: "+" }
      );
    }
    case "arena5":
    case "arena14": {
      const i = id === "arena5" ? 5 : 14;
      const coeff = i === 5 ? 0.5 : 1;
      const wave = ola(89);
      const req = Number((RANDOlist as any[])[53]?.[i]);
      const owned = Number.isFinite(req) && wave >= req ? 1 : 0;
      return node(
        `Pet Arena bonus ${i}${coeff !== 1 ? " (×0.5)" : ""}`,
        coeff * owned,
        [raw("Arena wave (OLA[89])", wave), raw("Wave needed", req)],
        { fmt: "raw" }
      );
    }
    case "roo6": {
      const mf = (k: number) => (ola(279) > k ? (k === 11 ? ola(279) - 11 : 1) : 0);
      const all = 50 * mf(1) + 50 * mf(3) + 50 * mf(6) + 50 * mf(8) + 50 * Math.min(1, mf(11)) + 25 * Math.max(0, mf(11) - 1);
      const legend = legendPTSbonus(26, s);
      const c51 = companions(51, s);
      const steps = Math.max(0, Math.ceil((ola(271) - 6) / 7));
      return node(
        "Kangaroo Cash (Roo 6)",
        3 * (1 + legend / 100) * (1 + c51) * (1 + all / 100) * steps,
        [raw("Legend 26", legend), raw("Companion 51", c51), raw("Megafeathers %", all), raw("⌈(OLA[271] − 6) / 7⌉", steps)],
        { fmt: "+" }
      );
    }
    case "vault14":
    case "vault31":
    case "vault34":
    case "vault37": {
      const n = Number(id.slice(5));
      const k = n === 14 ? 4 : n === 31 ? 7 : n === 34 ? 8 : 9;
      const v = vaultUpgBonus(n, s);
      const kills = vaultKillzTotal(k, s);
      return node(`${label("Vault", n)} × VaultKillzTotal(${k})`, v * kills, [raw(`Vault ${n}`, v), raw(`VaultKillzTotal(${k})`, kills)], { fmt: "+" });
    }
    case "vault70": {
      const v = vaultUpgBonus(70, s);
      const cards = cardsCollected(s);
      return node(`${label("Vault", 70)} × cards collected`, v * cards, [raw("Vault 70", v), raw("Cards collected", cards)], { fmt: "+" });
    }
```

- [ ] **Step 6: Run the save test — every case must PASS.** For any mismatch, apply Task 1 Step 10: N.js is the truth, and fixes stay inside the coin folder.

- [ ] **Step 7: Full suite + types** (`npx vitest run`, `npx tsc --noEmit -p tsconfig.json`)

- [ ] **Step 8: Commit**

```bash
git add web/lib/arkh/stats/systems/coin/accountKills.ts web/lib/arkh/stats/systems/coin/coin.ts web/lib/arkh/stats/systems/w6/farming.ts web/__tests__/lib/arkh/coin-multi.save.test.ts
git commit -m "feat(coin): vault kills, cards collected, flurbo, crop depot 4, pet arena, Roo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Partial sources — artifact 1, mainframe 9, vote 34

**Files:**
- Modify: `web/lib/arkh/stats/systems/coin/coin.ts`
- Test: `web/__tests__/lib/arkh/coin-multi.save.test.ts`

**Interfaces:**
- Consumes: `accountMapKills` (Task 2).
- Produces: cases `artifact1`, `mainframe9`, `vote34`. Shared helpers stay untouched (`computeArtifactBonus`, `mainframeBonus`, `votingBonusz` are also used by damage/DR).

**N.js semantics:**
- **Artifact 1 (Maneki Kat)** = the artifact's base × tier (what `computeArtifactBonus(1, …)` returns) × `CalcTalentMAP["620"]`. That map entry is the **level of the highest character** (max `Lv0[0]` over players).
- **`MainframeBonus(9)`** = (`LabMainBonus[9][5] + MainframeBonus(113)`, i.e. `mainframeBonus(9, s)`) × `⌊kills/1e6⌋` while `kills/1e6 < 1e8`, else × `kills/1e6`.
  - `kills` = the green-mushroom map's account kills.
  - That map is `MapAFKtarget.indexOf("mushG")` = **1**.
- **`VotingBonusz(34)`** = `votingBonusz(34, multi, s)`, with:
  `multi = (1 + Comp161/100) · (1 + Meritoc9/100) · (1 + (Comp41 + Dream[13] + Cosmo(2,3) + WinBonus22 + 17·EventShop7 + 13·EventShop16 + Comp19 + Palette32 + Legend22 + SushiRoG50)/100)`.
  - It only differs from 0 in weeks when vote 34 wins, so the save test pins 0.

- [ ] **Step 1: Add the failing cases**

```ts
    ["artifact 1 × highest level", () => src("artifact1"), 22800],
    ["mainframe 9 × green mushroom kills", () => src("mainframe9"), 17114049124783.2],
    ["vote 34 (inactive this week)", () => src("vote34"), 0],
```

- [ ] **Step 2: Run the save test.** Expect FAIL on artifact 1 and mainframe 9.

- [ ] **Step 3: Add the cases** to `coin.ts`.

New imports:
```ts
import { numCharacters, dreamData } from "../../../save/data";
import { computeArtifactBonus } from "../w5/sailing";
import { mainframeBonus } from "../w4/lab";
import { votingBonusz } from "../w2/voting";
import { computeMeritocBonusz } from "../w7/meritoc";
import { computeWinBonus } from "../w6/summoning";
import { computePaletteBonus } from "../w7/spelunking";
import { cosmoBonus } from "../w5/hole";
import { accountMapKills } from "./accountKills";
```
Merge the `save/data`, `lab`, `spelunking` and `accountKills` imports with the existing lines. Then add:

```ts
    case "artifact1": {
      const base = computeArtifactBonus(1, ci, { saveData: s, charIdx: ci } as any);
      let top = 0;
      for (let c = 0; c < numCharacters; c++) top = Math.max(top, Number((s.lv0AllData as any[])?.[c]?.[0]) || 0);
      return node(`${label("Artifact", 1)} × highest level`, base * top, [raw("Artifact bonus", base), raw("Highest char level", top)], { fmt: "+" });
    }
    case "mainframe9": {
      const base = mainframeBonus(9, s);
      const k = accountMapKills(1) / 1e6; // map 1 = MapAFKtarget "mushG"
      const mult = k < 1e8 ? Math.floor(k) : k;
      return node("Lab Mainframe 9 × green mushroom kills", base * mult, [raw("Mainframe 9", base), raw("Kills / 1e6", mult)], { fmt: "+" });
    }
    case "vote34": {
      const es = (n: number) => eventShopOwned(n, s.cachedEventShopStr || "");
      const inner =
        companions(41, s) + (Number((dreamData as any[])[13]) || 0) + cosmoBonus(s, 2, 3) +
        computeWinBonus(22, null, s) + 17 * es(7) + 13 * es(16) + companions(19, s) +
        computePaletteBonus(32, s) + legendPTSbonus(22, s) +
        (Number(sushiRoG.resolve(50, ctx as any).val) || 0);
      const multi = (1 + companions(161, s) / 100) * (1 + computeMeritocBonusz(9, s) / 100) * (1 + inner / 100);
      return node("Vote 34 (Cash)", votingBonusz(34, multi, s), [node("Voting multi", multi, null, { fmt: "x" })], { fmt: "+" });
    }
```

- [ ] **Step 4: Run the save test — all PASS** (N.js is the truth for any mismatch, as in Task 1 Step 10).

- [ ] **Step 5: Full suite + types, then commit**

```bash
git add web/lib/arkh/stats/systems/coin/coin.ts web/__tests__/lib/arkh/coin-multi.save.test.ts
git commit -m "feat(coin): artifact 1, mainframe 9 and vote 34 as N.js computes them for coins" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Divinity minor bonus summed over linked characters

**Files:**
- Create: `web/lib/arkh/stats/systems/coin/divinityMinor.ts`
- Modify: `web/lib/arkh/stats/systems/coin/coin.ts`
- Test: `web/__tests__/lib/arkh/coin-multi.save.test.ts`

**Interfaces:**
- Produces: `divinityMinorSum(type, activeCharIdx, saveData): number`, `pocketDivOwned(type, saveData): number`.

**N.js semantics** (`Divinity("Bonus_Minor", -1, e)`, @10684830; `DivMinorBonus` @10688050; `PocketDivOwned` @10903585):
- **`everyone`** = `Companions(0) == 1 || PocketDivOwned(e) == 1 || OLA[425] == e + 1`.
- For each player slot f = 0..11:
  - **Not everyone**, or e ∉ {3, 5}: add `DivMinorBonus(f, Divinity[f+12])` when the linked god `Divinity[f+12] != -1` and `GodsInfo[linked][13] == e`.
  - **Otherwise**: add `DivMinorBonus(f, godIdxWithMinorType(e))` for every existing player.
- **`DivMinorBonus(f, godIdx)`** = `max(1, Y2ACTIVE) · (1 + CoralKid3/100) · Lv0_f[14] / (60 + Lv0_f[14]) · GodsInfo[GodsInfo[godIdx][13]][3]`.
  - `Y2ACTIVE` is the **active** player's bubble Y2 (same rule as `talent.ts`).
  - `CoralKid3` = `OLA[430]` (as `talent.ts` reads it).
- **`PocketDivOwned(e)`** = 1 when either condition holds, else 0:
  - `GodsInfo[Holes[11][29]][13] == e && CosmoBonusQTY(2,0) > 0`;
  - `GodsInfo[Holes[11][30]][13] == e && CosmoBonusQTY(2,0) > 1`.

- [ ] **Step 1: Add the failing case**

```ts
    ["divinity minor (Cash)", () => src("divMinor3"), 5379.683449995177],
```

- [ ] **Step 2: Run the save test.** Expect FAIL (value 0).

- [ ] **Step 3: Create** `web/lib/arkh/stats/systems/coin/divinityMinor.ts`

```ts
// ===== DIVINITY MINOR BONUS (coin) =====
// Port of N.js Divinity("Bonus_Minor", -1, type): the sum, over players, of
// each one's minor bonus for the god whose minor type is `type`.

import { GodsInfo } from "../../data/game/customlists.js";
import {
  divinityData,
  optionsListData,
  numCharacters,
  cauldronInfoData,
  cauldronBubblesData,
} from "../../../save/data";
import { formulaEval } from "../../../formulas";
import { bubbleParams } from "../../data/w2/alchemy";
import { DIVINITY_MINOR_DENOM } from "../../data/game-constants";
import { companions } from "../common/companions";
import { cosmoBonus } from "../w5/hole";
import type { SaveData } from "../../../state";

const gods = () => GodsInfo as unknown as unknown[][];
const minorType = (godIdx: unknown) => Number(gods()[Number(godIdx) | 0]?.[13]);

/** N.js Holes("PocketDivOwned", type). */
export function pocketDivOwned(type: number, saveData: SaveData): number {
  const h11 = (((saveData.holesData as any[]) ?? [])[11] ?? []) as unknown[];
  const cosmo = cosmoBonus(saveData, 2, 0);
  if (minorType(h11[29]) === type && cosmo > 0) return 1;
  if (minorType(h11[30]) === type && cosmo > 1) return 1;
  return 0;
}

/** N.js AlchBubbles.Y2ACTIVE for the active char (the rule talent.ts uses). */
function y2Active(activeCi: number, saveData: SaveData): number {
  const bp = bubbleParams(3, 21) as any;
  const lv = Number((cauldronInfoData as any[])?.[3]?.[21]) || 0;
  const val = bp && lv > 0 ? formulaEval(bp.formula, bp.x1, bp.x2, lv) : 0;
  const allBubbles = !!saveData.companionIds?.has(4);
  const equipped = !!(cauldronBubblesData as any[])?.[activeCi]?.includes?.("d21");
  return allBubbles || equipped ? val : 0;
}

/** N.js Divinity("DivMinorBonus", f, godIdx). */
function divMinorBonus(f: number, godIdx: number, activeCi: number, saveData: SaveData): number {
  const lv = Number((saveData.lv0AllData as any[])?.[f]?.[14]) || 0;
  const coral = Number((optionsListData as any[])[430]) || 0;
  const x1 = Number(gods()[minorType(godIdx) | 0]?.[3]) || 0;
  return (
    Math.max(1, y2Active(activeCi, saveData)) *
    (((1 + coral / 100) * lv) / (DIVINITY_MINOR_DENOM + lv)) *
    x1
  );
}

export function divinityMinorSum(type: number, activeCi: number, saveData: SaveData): number {
  const typeOfGod: number[] = [];
  for (let g = 0; g < 10; g++) typeOfGod.push(minorType(g));
  const everyone =
    companions(0, saveData) === 1 ||
    pocketDivOwned(type, saveData) === 1 ||
    Number((optionsListData as any[])[425]) === type + 1;
  let sum = 0;
  for (let f = 0; f < 12; f++) {
    if (!everyone || (type !== 3 && type !== 5)) {
      const linked = Number((divinityData as any[])[f + 12]);
      if (Number.isFinite(linked) && linked !== -1 && minorType(linked) === type) {
        sum += divMinorBonus(f, linked, activeCi, saveData);
      }
    } else if (f < numCharacters) {
      sum += divMinorBonus(f, typeOfGod.indexOf(type), activeCi, saveData);
    }
  }
  return sum;
}
```

- [ ] **Step 4: Add the case** to `coin.ts`. Add `import { divinityMinorSum } from "./divinityMinor";`, then:

```ts
    case "divMinor3":
      return node("Divinity minor bonus (Cash)", divinityMinorSum(3, ci, s), null, { fmt: "+" });
```

- [ ] **Step 5: Run the save test — PASS.** On a mismatch, print the per-player contributions (f, linked god, `Lv0_f[14]`, value) and compare each piece against the N.js text above.

- [ ] **Step 6: Full suite + types, then commit**

```bash
git add web/lib/arkh/stats/systems/coin/divinityMinor.ts web/lib/arkh/stats/systems/coin/coin.ts web/__tests__/lib/arkh/coin-multi.save.test.ts
git commit -m "feat(coin): divinity minor bonus summed over linked characters" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gambit 7 + engine wrap-up (total vs IdleonToolbox)

**Files:**
- Create: `web/lib/arkh/stats/systems/coin/gambit.ts`
- Modify: `web/lib/arkh/stats/systems/coin/coin.ts`
- Test: `web/__tests__/lib/arkh/coin-multi.save.test.ts`

**Interfaces:**
- Consumes: `accountMapKills` (Task 2).
- Produces:
  - `gambitBonus(b, saveData): number`;
  - `gambitPoints(saveData): number`;
  - `gambitPtsMulti(saveData): number`;
  - `gambitPtsReq(b): number`;
  - `deathNoteSkulls(saveData): number`.

**N.js semantics** (Holes @10908001–10953577, WorkbenchStuff @7751300–7756378):
- **`GambitPts(b)`** for b = 0..5: `(b == 0 ? 100 : 200)·(v + 3⌊v/10⌋ + 10⌊v/60⌋)`, where `v = Holes[11][65 + b]`.
- **Total points:** `GambitPts(777) = Σ_{b=0..5} GambitPts(b) · GambitPTSmulti`.
- **`GambitPTSmulti`** = `1 + (MeasurementBonusTOTAL(13) + StudyBolaiaBonuses(13) + B_UPG(78,10) + MonumentROGbonuses(2,7) + JarCollectibleBonus(23) + JarCollectibleBonus(30) + ArcaneUpgBonus(47))/100`.
  - **`MeasurementBonusTOTAL(13)`** = `MeasurementBaseBonus(13) · MeasurementMulti(HolesInfo[52][13])`.
    - Base: `HolesInfo[55][13]` = `"10TOT"`, so `(1 + CosmoBonusQTY(1,3)/100) · 10·L/(100 + L)`, with `L = Holes[22][13]`. A value without "TOT" would be `(1 + Cosmo/100)·value·L`.
    - Multi: `HolesInfo[52][13]` = 6, so `QTY = MeasurementQTYfound(6, 99) = Σ_{w=0..6} OverkillQTY(w) / 125`, and `multi = QTY < 5 ? 1 + 18·QTY/100 : 1 + (18·QTY + 8·(QTY − 5))/100`.
  - **`OverkillQTY(w)`** (w = 0..6) = Σ over the mobs of `DeathNoteMobs[w]` of `DeathNoteRank(kills)`.
    - `kills` = account kills on the map `MapAFKtarget.indexOf(mob)`, or 0 when the mob has no map.
    - Index 7 (minibosses) is **not** part of `MeasurementQTYfound(6)`.
  - **`DeathNoteRank(k)`**:

    | Kills | Skulls |
    |---|---|
    | < 25K | 0 |
    | < 100K | 1 |
    | < 250K | 2 |
    | < 500K | 3 |
    | < 1M | 4 |
    | < 5M | 5 |
    | < 100M | 7 |
    | above | 20 when `k > 1e9` and `Rift[0] >= 20`, else 10 |

  - **`StudyBolaiaBonuses(13)`** = `Holes[26][13]·HolesInfo[70][13]` (the generic branch; 3 and 9 are special).
  - **`B_UPG(78, 10)`**: 78 has no special case, so it returns `e` = 10 once bought (`Holes[13][78] != 0`), else 0.
  - **`JarCollectibleBonus(b)`** = `Holes[24][b]·HolesInfo[67][b].split("|")[1]·(1 + Legend29/100)`.
- **`GambitPtsREQ(b)`** = `2000 + 1000(b+1)(1 + b/5)·1.26^b`.
- **`GambitBonuses(b ≥ 1)`**: 0 when points < REQ(b). Otherwise, split `HolesInfo[71][b]` into `val|scale`: return `val·getLOG(points)` when `scale == 1`, else `val`. `HolesInfo[71][7]` = `"10|1|…"`.

**Checked while planning on the reference save** (Ruling 5):
- Every GambitPTSmulti sub-term equals IdleonToolbox's except Measurement 13, where IT also counts the 58 miniboss skulls (2118 vs 2060).
- Expected N.js values:

  | Term | Value |
  |---|---|
  | Skulls | 2060 |
  | Measurement 13 | 77.12842105263158 |
  | Multi | 8.623284210526316 |
  | Points | 25324947.302310467 |
  | **Gambit 7** | **74.03532772764761** |

- [ ] **Step 1: Add the failing cases**

In the `it.each` table:

```ts
    // N.js ≠ IT: IT adds the miniboss skulls to Measurement 13 (IT: 74.04491048389032).
    ["gambit 7", () => src("gambit7"), 74.03532772764761],
```

And a new `it` after the `it.each`:

```ts
  it("total = IdleonToolbox's total, corrected for the four terms where IT departs from N.js", () => {
    const IT_TOTAL = 6.773746899414287e35;
    // Additive group (g23): IT's Σ plus what N.js adds on top of it —
    // 7·CardLv("w5b1") (IT omits it), talent 643's multikill tier (IT uses ×1)
    // and golden food's JellyOperation RoG 10 term (IT omits it).
    const IT_ADDITIVE = 69877.71279617335;
    const IT_TALENT643 = 20.941558441558442;
    const IT_GOLD_FOOD = 41196.37827189698;
    const delta = src("cardW5b1") + (src("talent643") - IT_TALENT643) + (src("goldFood") - IT_GOLD_FOOD);
    const additive = (1 + (IT_ADDITIVE + delta) / 100) / (1 + IT_ADDITIVE / 100);
    // Gambit 7: IT counts miniboss skulls in Measurement 13; N.js doesn't.
    const IT_GAMBIT7 = 74.04491048389032;
    const gambit = (1 + src("gambit7") / 100) / (1 + IT_GAMBIT7 / 100);
    expect(Math.abs(tree.val / (IT_TOTAL * additive * gambit) - 1)).toBeLessThan(1e-9);
  });
```

- [ ] **Step 2: Run the save test.** Expect FAIL on gambit 7 and the total.

- [ ] **Step 3: Create** `web/lib/arkh/stats/systems/coin/gambit.ts`

```ts
// ===== GAMBIT (coin) =====
// Port of N.js Holes("GambitBonuses", b) and its point pipeline, with the
// Deathnote skull count Measurement 13 needs (WorkbenchStuff OverkillQTY).

import { HolesInfo, DeathNoteMobs, MapAFKtarget } from "../../data/game/customlists.js";
import { getLOG } from "../../../formulas";
import { legendPTSbonus } from "../w7/spelunking";
import { computeMonumentROGbonus, cosmoBonus } from "../w5/hole";
import { arcaneUpgBonus } from "../mc/tesseract";
import { accountMapKills } from "./accountKills";
import type { SaveData } from "../../../state";

const H = (s: SaveData, row: number, i: number) =>
  Number((((s.holesData as any[]) ?? [])[row] ?? [])[i]) || 0;
const info = (row: number, i: number) =>
  String(((HolesInfo as unknown as unknown[][])[row] ?? [])[i] ?? "");

/** N.js WorkbenchStuff("DeathNoteRank", kills, 0): one mob's skull value. */
function deathNoteRank(kills: number, s: SaveData): number {
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

/** Σ_{w=0..6} N.js WorkbenchStuff("OverkillQTY", w): the Deathnote skulls of
 *  worlds 1–7. Index 7 (minibosses) isn't part of MeasurementQTYfound(6). */
export function deathNoteSkulls(s: SaveData): number {
  const mapOf = MapAFKtarget as unknown as string[];
  let n = 0;
  for (const mobs of (DeathNoteMobs as unknown as string[][]).slice(0, 7)) {
    for (const mob of mobs) {
      const m = mapOf.indexOf(mob);
      n += deathNoteRank(m >= 0 ? accountMapKills(m) : 0, s);
    }
  }
  return n;
}

/** N.js Holes("MeasurementBonusTOTAL", 13) = MeasurementBaseBonus(13) ×
 *  MeasurementMulti(HolesInfo[52][13] = 6 → Deathnote skulls / 125). */
function measurement13(s: SaveData): number {
  const lv = H(s, 22, 13);
  const raw = info(55, 13); // "10TOT"
  const cosmo = 1 + cosmoBonus(s, 1, 3) / 100;
  const base = raw.includes("TOT")
    ? cosmo * ((Number(raw.replace("TOT", "")) * lv) / (100 + lv))
    : cosmo * Number(raw) * lv;
  const qty = deathNoteSkulls(s) / 125;
  const multi = qty < 5 ? 1 + (18 * qty) / 100 : 1 + (18 * qty + 8 * (qty - 5)) / 100;
  return base * multi;
}

/** N.js Holes("StudyBolaiaBonuses", b), generic branch (b ∉ {3, 9}). */
function studyBolaia(b: number, s: SaveData): number {
  return H(s, 26, b) * Number(info(70, b));
}

/** N.js Holes("JarCollectibleBonus", b). */
function jarCollectible(b: number, s: SaveData): number {
  return H(s, 24, b) * Number(info(67, b).split("|")[1]) * (1 + legendPTSbonus(29, s) / 100);
}

/** N.js Holes("GambitPTSmulti"). B_UPG(78, 10) has no special case: 10 once bought. */
export function gambitPtsMulti(s: SaveData): number {
  const bUpg78 = H(s, 13, 78) !== 0 ? 10 : 0;
  return (
    1 +
    (measurement13(s) +
      studyBolaia(13, s) +
      bUpg78 +
      computeMonumentROGbonus(2, 7, s) +
      jarCollectible(23, s) +
      jarCollectible(30, s) +
      arcaneUpgBonus(47, s)) /
      100
  );
}

/** N.js Holes("GambitPts", 777). */
export function gambitPoints(s: SaveData): number {
  let sum = 0;
  for (let b = 0; b <= 5; b++) {
    const v = H(s, 11, 65 + b);
    sum += (b === 0 ? 100 : 200) * (v + 3 * Math.floor(v / 10) + 10 * Math.floor(v / 60));
  }
  return sum * gambitPtsMulti(s);
}

export function gambitPtsReq(b: number): number {
  return 2e3 + 1e3 * (b + 1) * (1 + b / 5) * Math.pow(1.26, b);
}

/** N.js Holes("GambitBonuses", b) for b ≥ 1. */
export function gambitBonus(b: number, s: SaveData): number {
  const pts = gambitPoints(s);
  if (pts < gambitPtsReq(b)) return 0;
  const [val, scale] = info(71, b).split("|");
  return Number(scale) === 1 ? Number(val) * getLOG(pts) : Number(val);
}
```

- [ ] **Step 4: Add the case** to `coin.ts`. Add `import { gambitBonus, gambitPoints, deathNoteSkulls } from "./gambit";`, then:

```ts
    case "gambit7":
      return node(
        "Gambit 7 (Cash)",
        gambitBonus(7, s),
        [raw("Gambit points", gambitPoints(s)), raw("Deathnote skulls (Measurement 13)", deathNoteSkulls(s))],
        { fmt: "+" }
      );
```

Every source id in `COIN_GROUPS` is resolved now, so replace the temporary `default:` branch from Task 1 with a loud failure (a typo in an id must not read as 0):

```ts
    default:
      throw new Error(`coin: unknown source "${id}"`);
```

- [ ] **Step 5: Run the save test — every case PASS, the total included.** If the total is off, a group's items differ from IT without a documented reason. Either fix it (N.js is the truth), or document it and fold its ratio into the total test.

- [ ] **Step 6: Full suite + types. The DR regression must still read 363,893.46.**

Run: `npx vitest run` and `npx tsc --noEmit -p tsconfig.json`.

- [ ] **Step 7: Commit**

```bash
git add web/lib/arkh/stats/systems/coin/gambit.ts web/lib/arkh/stats/systems/coin/coin.ts web/__tests__/lib/arkh/coin-multi.save.test.ts
git commit -m "feat(coin): gambit 7 with the Deathnote skull count; engine total matches IdleonToolbox up to its two known gaps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: In-game display format

**Files:**
- Create: `web/lib/coinMulti/format.ts`
- Test: `web/__tests__/lib/coinMulti/format.test.ts`

**Interfaces:**
- Produces:
  - `formatCoinMulti(x: number): string` (what the game prints, no trailing "x");
  - `notateBig(d)`;
  - `notateMultiplierInfo(d)`.

**N.js** (@11794100, MonsterCash stat line):
- `> 1e16` → `NotateNumber(x,"Big")`;
- `> 1e10` → `⌊x/1e8⌋/10 + "B"`;
- `> 1e7` → `⌊x/1e5⌋/10 + "M"`;
- else `NotateNumber(x,"MultiplierInfo")`.

In `NotateNumber`:
- **"Big"** is the generic ladder (K…QQ with `Math.ceil`), then `⌊d/10^e·100⌋/100 + "E" + e` with `e = ⌊getLOG(d)⌋`.
- **"MultiplierInfo"** is 2-decimal rounding (with an `M` form above 1e6).
- The game's `#` characters are placeholders it strips.

- [ ] **Step 1: Write the failing test** — `web/__tests__/lib/coinMulti/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { formatCoinMulti, notateBig, notateMultiplierInfo } from "@/lib/coinMulti/format";

describe("formatCoinMulti — the game's MonsterCash stat line", () => {
  it.each([
    [6.773746899414287e35, "6.77E35"], // Markhe, map 14 (IdleonToolbox value)
    [5e16, "50Q"], // Big ladder, ceil
    [3.5e11, "350B"], // ⌊x/1e8⌋/10 + "B" (truncates)
    [12345678, "12.3M"], // ⌊x/1e5⌋/10 + "M" (truncates)
    [1234567, "1.23M"], // MultiplierInfo M form
    [1234.5, "1234.50"],
    [5, "5.00"],
    [2.34, "2.34"],
  ])("%s → %s", (x, shown) => expect(formatCoinMulti(x)).toBe(shown));

  it("keeps the game's getLOG quirk at exact powers of ten", () => {
    // getLOG = ln/2.30259 lands just under 22 for 1e22, so the game prints 10E21.
    expect(notateBig(1e22)).toBe("10E21");
  });

  it("MultiplierInfo pads to two decimals", () => {
    expect(notateMultiplierInfo(1.5)).toBe("1.50");
    expect(notateMultiplierInfo(2_000_000)).toBe("2.00M");
  });

  it("non-finite reads as a dash", () => expect(formatCoinMulti(NaN)).toBe("—"));
});
```

- [ ] **Step 2: Run it — FAIL** (module missing): `npx vitest run __tests__/lib/coinMulti/format.test.ts`

- [ ] **Step 3: Create** `web/lib/coinMulti/format.ts`

```ts
// The game's own display of ArbitraryCode("MonsterCash") (N.js @11794100),
// kept literal so the in-game validation compares like for like.

import { getLOG } from "@/lib/arkh/formulas";

/** N.js NotateNumber(d, "Big"): the generic ladder (ceil), then E-notation. */
export function notateBig(d: number): string {
  if (d < 1e3) return `${Math.floor(d)}`;
  if (d < 1e4) return `${Math.ceil(d / 10) / 100}K`;
  if (d < 1e5) return `${Math.ceil(d / 100) / 10}K`;
  if (d < 1e6) return `${Math.ceil(d / 1e3)}K`;
  if (d < 1e7) return `${Math.ceil(d / 1e4) / 100}M`;
  if (d < 1e8) return `${Math.ceil(d / 1e5) / 10}M`;
  if (d < 1e9) return `${Math.ceil(d / 1e6)}M`;
  if (d < 1e10) return `${Math.ceil(d / 1e7) / 100}B`;
  if (d < 1e11) return `${Math.ceil(d / 1e8) / 10}B`;
  if (d < 1e12) return `${Math.ceil(d / 1e9)}B`;
  if (d < 1e13) return `${Math.ceil(d / 1e10) / 100}T`;
  if (d < 1e14) return `${Math.ceil(d / 1e11) / 10}T`;
  if (d < 1e15) return `${Math.ceil(d / 1e12)}T`;
  if (d < 1e16) return `${Math.ceil(d / 1e13) / 100}Q`;
  if (d < 1e17) return `${Math.ceil(d / 1e14) / 10}Q`;
  if (d < 1e18) return `${Math.ceil(d / 1e15)}Q`;
  if (d < 1e19) return `${Math.ceil(d / 1e16) / 100}QQ`;
  if (d < 1e20) return `${Math.ceil(d / 1e17) / 10}QQ`;
  if (d < 1e21) return `${Math.ceil(d / 1e18)}QQ`;
  const e = Math.floor(getLOG(d));
  return `${Math.floor((d / Math.pow(10, e)) * 100) / 100}E${e}`;
}

/** N.js NotateNumber(d, "MultiplierInfo") without its "#" placeholder. */
export function notateMultiplierInfo(d: number): string {
  if (d > 1e6) {
    const c = Math.round((d / 1e6) * 100);
    if (c % 100 === 0) return `${Math.round(d / 1e6)}.00M`;
    if (c % 10 === 0) return `${Math.round((d / 1e6) * 10) / 10}0M`;
    return `${c / 100}M`;
  }
  const c = Math.round(100 * d);
  if (c % 100 === 0) return `${Math.round(d)}.00`;
  if (c % 10 === 0) return `${Math.round(10 * d) / 10}0`;
  return `${c / 100}`;
}

/** What the game prints for the coin multi (without the trailing "x"). */
export function formatCoinMulti(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (x > 1e16) return notateBig(x);
  if (x > 1e10) return `${Math.floor(x / 1e8) / 10}B`;
  if (x > 1e7) return `${Math.floor(x / 1e5) / 10}M`;
  return notateMultiplierInfo(x);
}
```

- [ ] **Step 4: Run it — PASS.** Then commit:

```bash
git add web/lib/coinMulti/format.ts web/__tests__/lib/coinMulti/format.test.ts
git commit -m "feat(coin): the game's coin multi display format" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Snapshot storage + Snapshot History section

**Files:**
- Create: `web/lib/coinMulti/storage.ts`, `web/components/coinMulti/CoinSnapshotSection.tsx`
- Test: `web/__tests__/lib/coinMulti/storage.test.ts`

**Interfaces:**
- Consumes: `formatCoinMulti` (Task 6), `flattenTree` / `FlatTree` (`@/lib/dropRate/treeFlatten`), `listCharacters` (`@/lib/dropRate/extract`), `formatRelativeTime` (`@/lib/format`).
- Produces:
  - `type CoinSnapshot`;
  - `addSnapshot`, `listSnapshots`, `listTrackedChars`, `clearChar`, `deleteSnapshot`, `exportAllAsJson`, `importFromJson`;
  - `buildCoinSnapshot(save, charIndex, computedCoinMulti, mapName, flatTree?)`;
  - default export `CoinSnapshotSection`. Props:
    - `state: CoinCalculatorState | null`, a type imported from Task 8's `CoinCalculator`, whose fields are listed there;
    - `onSelectBaseline?`, `selectedBaselineAt?`, `headerExtra?`.

  Task 8 creates the calculator. Until then, declare the used fields locally with the same names, `{ charIndex, charName, totalCoin, mapLabel, save, coinTree }`. That keeps this task compiling on its own, and the `import type` is switched in Task 8.

- [ ] **Step 1: Write the failing storage test** — `web/__tests__/lib/coinMulti/storage.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  addSnapshot, listSnapshots, listTrackedChars, deleteSnapshot,
  exportAllAsJson, importFromJson, buildCoinSnapshot, type CoinSnapshot,
} from "@/lib/coinMulti/storage";

const snap = (charName: string, capturedAt: number, v = 2): CoinSnapshot => ({
  capturedAt, saveUpdatedAt: null, charIndex: 0, charName, level: 100,
  computedCoinMulti: v, mapName: "Spore Meadows",
});

beforeEach(() => localStorage.clear());

describe("coin multi snapshot storage", () => {
  it("keeps its own key, per character, oldest first", () => {
    addSnapshot(snap("A", 2));
    addSnapshot(snap("A", 1));
    addSnapshot(snap("B", 3));
    expect(listTrackedChars()).toEqual(["A", "B"]);
    expect(listSnapshots("A").map((s) => s.capturedAt)).toEqual([1, 2]);
    expect(localStorage.getItem("coin-multi-tracker.v1")).toBeTruthy();
    expect(localStorage.getItem("drop-rate-tracker.v1")).toBeNull();
  });

  it("deletes one snapshot", () => {
    addSnapshot(snap("A", 1));
    addSnapshot(snap("A", 2));
    deleteSnapshot("A", 1);
    expect(listSnapshots("A").map((s) => s.capturedAt)).toEqual([2]);
  });

  it("round-trips export → import, deduping by capturedAt", () => {
    addSnapshot(snap("A", 1));
    const text = exportAllAsJson();
    localStorage.clear();
    addSnapshot(snap("A", 1, 9));
    const res = importFromJson(text);
    expect(res).toMatchObject({ ok: true, charsImported: 1, snapshotsImported: 1 });
    expect(listSnapshots("A")).toHaveLength(1);
  });

  it("rejects a foreign file", () => {
    expect(importFromJson("{}")).toMatchObject({ ok: false, error: "Not a valid coin-multi-tracker export" });
  });

  it("builds a snapshot from a save", () => {
    const save = { charNames: ["Alpha"], lastUpdated: 5, data: { PVStatList_0: [1, 1, 1, 1, 321] } };
    expect(buildCoinSnapshot(save, 0, 7.5, "Map", { "Coin Multi": 7.5 })).toMatchObject({
      charIndex: 0, charName: "Alpha", level: 321, saveUpdatedAt: 5,
      computedCoinMulti: 7.5, mapName: "Map", flatTree: { "Coin Multi": 7.5 },
    });
  });
});
```

- [ ] **Step 2: Run it — FAIL** (module missing).

- [ ] **Step 3: Create** `web/lib/coinMulti/storage.ts`. This forks `lib/dropRate/storage.ts` with its own key and type.

```ts
// localStorage adapter for Coin Multi snapshots — own key, per character.
//   key 'coin-multi-tracker.v1' → { snapshotsByChar: { [charName]: CoinSnapshot[] } }

import { listCharacters } from "@/lib/dropRate/extract";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";

const STORAGE_KEY = "coin-multi-tracker.v1";
const MAX_SNAPSHOTS_PER_CHAR = 500;

export type CoinSnapshot = {
  capturedAt: number;
  saveUpdatedAt: number | null;
  charIndex: number;
  charName: string;
  level: number;
  computedCoinMulti: number;
  mapName: string;
  /** Path → value for every node of the coin tree (for Δ comparisons). */
  flatTree?: FlatTree;
};

type Store = { snapshotsByChar: Record<string, CoinSnapshot[]> };

const emptyStore = (): Store => ({ snapshotsByChar: {} });

function readStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.snapshotsByChar && typeof parsed.snapshotsByChar === "object") {
      return parsed as Store;
    }
  } catch {
    // corrupt store — fall through to fresh
  }
  return emptyStore();
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded or storage disabled — silently drop
  }
}

export function buildCoinSnapshot(
  save: any,
  charIndex: number,
  computedCoinMulti: number,
  mapName: string,
  flatTree?: FlatTree
): CoinSnapshot {
  const ch = listCharacters(save).find((c) => c.charIndex === charIndex);
  if (!ch) throw new Error(`Character index ${charIndex} not present in save`);
  const updated = Number(save?.lastUpdated);
  return {
    capturedAt: Date.now(),
    saveUpdatedAt: Number.isFinite(updated) ? updated : null,
    charIndex: ch.charIndex,
    charName: ch.charName,
    level: ch.level,
    computedCoinMulti,
    mapName,
    flatTree,
  };
}

export function addSnapshot(snapshot: CoinSnapshot): void {
  const store = readStore();
  const list = store.snapshotsByChar[snapshot.charName] ?? [];
  list.push(snapshot);
  if (list.length > MAX_SNAPSHOTS_PER_CHAR) list.splice(0, list.length - MAX_SNAPSHOTS_PER_CHAR);
  store.snapshotsByChar[snapshot.charName] = list;
  writeStore(store);
}

export function listSnapshots(charName: string): CoinSnapshot[] {
  return [...(readStore().snapshotsByChar[charName] ?? [])].sort((a, b) => a.capturedAt - b.capturedAt);
}

export function listTrackedChars(): string[] {
  return Object.keys(readStore().snapshotsByChar).sort();
}

export function clearChar(charName: string): void {
  const store = readStore();
  delete store.snapshotsByChar[charName];
  writeStore(store);
}

export function deleteSnapshot(charName: string, capturedAt: number): void {
  const store = readStore();
  const list = store.snapshotsByChar[charName];
  if (!list) return;
  store.snapshotsByChar[charName] = list.filter((s) => s.capturedAt !== capturedAt);
  writeStore(store);
}

export function exportAllAsJson(): string {
  return JSON.stringify(readStore(), null, 2);
}

export function importFromJson(jsonText: string): {
  ok: boolean;
  charsImported: number;
  snapshotsImported: number;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || !parsed.snapshotsByChar || typeof parsed.snapshotsByChar !== "object") {
      return { ok: false, charsImported: 0, snapshotsImported: 0, error: "Not a valid coin-multi-tracker export" };
    }
    const incoming = parsed.snapshotsByChar as Record<string, CoinSnapshot[]>;
    const store = readStore();
    let chars = 0;
    let snaps = 0;
    for (const [charName, list] of Object.entries(incoming)) {
      if (!Array.isArray(list)) continue;
      const existing = new Map<number, CoinSnapshot>();
      for (const s of store.snapshotsByChar[charName] ?? []) existing.set(s.capturedAt, s);
      for (const s of list) {
        if (s && typeof s.capturedAt === "number") {
          existing.set(s.capturedAt, s);
          snaps++;
        }
      }
      const merged = [...existing.values()].sort((a, b) => a.capturedAt - b.capturedAt);
      if (merged.length > MAX_SNAPSHOTS_PER_CHAR) merged.splice(0, merged.length - MAX_SNAPSHOTS_PER_CHAR);
      store.snapshotsByChar[charName] = merged;
      chars++;
    }
    writeStore(store);
    return { ok: true, charsImported: chars, snapshotsImported: snaps };
  } catch (e) {
    return { ok: false, charsImported: 0, snapshotsImported: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 4: Run the storage test — PASS.**

- [ ] **Step 5: Create** `web/components/coinMulti/CoinSnapshotSection.tsx`.

Copy `web/components/dropRate/SnapshotSection.tsx` verbatim to this path, then apply these edits:
1. **Imports.**
   - Replace the `extract`, `storage` and `DrCalculator` imports with:
     ```ts
     import {
       addSnapshot, buildCoinSnapshot, clearChar, deleteSnapshot, exportAllAsJson,
       importFromJson, listSnapshots, listTrackedChars, type CoinSnapshot,
     } from "@/lib/coinMulti/storage";
     import { formatCoinMulti } from "@/lib/coinMulti/format";
     ```
   - Keep `formatRelativeTime` from `@/lib/format`, and keep `flattenTree` / `FlatTree`.
2. **Types and constants.**
   - Delete the `EnrichedSnapshot` type and the unused `STORAGE_KEY`.
   - Use `CoinSnapshot` everywhere `EnrichedSnapshot` appears.
   - Set `COLLAPSE_KEY = "coin-multi.snapshot-section.collapsed.v1"`.
3. **`state` prop type.** Declare it locally as below; Task 8 replaces it with `import type { CoinCalculatorState } from "./CoinCalculator"`:
   ```ts
   type CoinState = {
     charIndex: number | null;
     charName: string;
     totalCoin: number | null;
     mapLabel: string;
     save: any;
     coinTree: import("@/lib/arkh/node").ArkhNode | null;
   };
   ```
4. **`canSave`:** `!!state && state.charIndex !== null && state.totalCoin !== null && !!state.save`.
5. **`onSave` body:**
   ```ts
   const flat = flattenTree(state.coinTree);
   const nodeCount = Object.keys(flat).length;
   const snap = buildCoinSnapshot(state.save, state.charIndex!, state.totalCoin!, state.mapLabel, nodeCount > 0 ? flat : undefined);
   addSnapshot(snap);
   setNotice(`Snapshot saved for ${snap.charName} — Coin Multi ${formatCoinMulti(snap.computedCoinMulti)}x on ${state.mapLabel}${nodeCount > 0 ? ` (${nodeCount} tree nodes captured)` : ""}`);
   refresh();
   setViewChar(snap.charName);
   ```
6. **Export filename:** `coin-multi-snapshots-${new Date().toISOString().slice(0, 10)}.json`.
7. **`HistoryTable` columns:**
   - The headers become `Captured`, `Coin Multi`, `Δ`, `Map`, `Compare`, and an empty last column. The `Luck` column is removed.
   - Value cell: `formatCoinMulti(s.computedCoinMulti) + "x"`, with `title={String(s.computedCoinMulti)}`.
   - Δ cell: the ratio against the previous row, `(cur / prev − 1) × 100`, formatted `+1.23%` (emerald) or `-1.23%` (red). It shows `—` without a previous row and `0` when equal.
   - The `Luck` `<td>` is removed.

- [ ] **Step 6: Types + suite** (`npx tsc --noEmit -p tsconfig.json`, `npx vitest run`).

- [ ] **Step 7: Commit**

```bash
git add web/lib/coinMulti/storage.ts web/components/coinMulti/CoinSnapshotSection.tsx web/__tests__/lib/coinMulti/storage.test.ts
git commit -m "feat(coin): snapshot storage and history section" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Map options + Coin Calculator

**Files:**
- Create: `web/lib/coinMulti/mapOptions.ts`, `web/components/coinMulti/CoinCalculator.tsx`
- Modify: `web/components/coinMulti/CoinSnapshotSection.tsx` (switch the local `CoinState` to `import type { CoinCalculatorState } from "./CoinCalculator"`), `web/__tests__/components/accountSaveOverPaste.test.tsx` (new Coin case)
- Test: `web/__tests__/lib/coinMulti/mapOptions.test.ts`, `web/__tests__/components/CoinCalculator.keepView.test.tsx`

**Interfaces:**
- Consumes:
  - `computeArkhCoinMulti` (Task 1) and `formatCoinMulti` (Task 6);
  - reused as-is: `DeepView` (`@/components/dropRate/DeepView`, prop `showWorldView`), `ProfileNameLoader` (prop `storageKey`), `accountAutoLoads` (`@/lib/gameAuth/session`);
  - `listCharacters` / `parseSave` / `CharSummary` (`@/lib/dropRate/extract`), `getCharClassKey` (`@/lib/talentsLevel/charClass`).
- Produces:
  - `buildCoinMapOptions(save): CoinMapOption[]`, with `CoinMapOption = { index, name, world, label }`, and `worldOf(mapIdx): number`;
  - `type CoinCalculatorState = { charIndex; charName; classKey; charSummary; totalCoin; mapIndex; mapLabel; save; coinTree; computeError }`;
  - default export `CoinCalculator` with the same props as `DrCalculator`: `onStateChange`, `compareBaseline`, `snapshotSlot`, `extraTabs`, `extraTabsFirst`, `defaultView`.

- [ ] **Step 1: Write the failing map-options test** — `web/__tests__/lib/coinMulti/mapOptions.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildCoinMapOptions, worldOf } from "@/lib/coinMulti/mapOptions";

describe("coin multi map options", () => {
  it("world = ⌊map / 50⌋ + 1 (the guild term's factor)", () => {
    expect(worldOf(14)).toBe(1);
    expect(worldOf(50)).toBe(2);
    expect(worldOf(300)).toBe(7);
  });

  it("lists named maps with a world prefix, skips placeholders, keeps current maps", () => {
    const opts = buildCoinMapOptions({ data: { CurrentMap_0: 14, CurrentMap_1: 999 } });
    const byIdx = new Map(opts.map((o) => [o.index, o]));
    expect(byIdx.get(1)?.label).toBe("W1 · Spore Meadows");
    expect(byIdx.has(4)).toBe(false); // PlayerSelect
    expect(byIdx.has(44)).toBe(false); // Z
    expect(byIdx.get(999)?.label).toBe("W20 · Map 999"); // a char's map is always listed
    expect(opts.map((o) => o.index)).toEqual([...opts.map((o) => o.index)].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 2: Run it — FAIL.** Then create `web/lib/coinMulti/mapOptions.ts`:

```ts
// Map list for the Coin Multi page. The map drives two terms: the guild
// world, GuildBonuses(8)·(1 + ⌊map/50⌋), and talent 643's multikill tier
// (the AFK monster's HP; exponent 5 from map 300).

import { MAP_NAMES } from "@/lib/dropRate/mapNames";

export type CoinMapOption = { index: number; name: string; world: number; label: string };

const SKIP = new Set(["", "PlayerSelect", "Z", "Nothing"]);

export function worldOf(mapIdx: number): number {
  return Math.floor(mapIdx / 50) + 1;
}

export function buildCoinMapOptions(save: unknown): CoinMapOption[] {
  const idx = new Set<number>();
  MAP_NAMES.forEach((n, i) => {
    if (n && !SKIP.has(n) && !n.startsWith("Tutorial")) idx.add(i);
  });
  const data = (save as { data?: Record<string, unknown> })?.data ?? {};
  for (const k in data) {
    if (!k.startsWith("CurrentMap_")) continue;
    const v = Number(data[k]);
    if (Number.isFinite(v)) idx.add(v);
  }
  return [...idx]
    .sort((a, b) => a - b)
    .map((i) => {
      const name = (MAP_NAMES[i] || `Map ${i}`).replace(/_/g, " ");
      return { index: i, name, world: worldOf(i), label: `W${worldOf(i)} · ${name}` };
    });
}
```

Run the test — PASS.

- [ ] **Step 3: Write the failing calculator test** — `web/__tests__/components/CoinCalculator.keepView.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

type LoaderProps = { onSave: (s: unknown, meta?: { refresh?: boolean }) => void; storageKey: string };
let loader: LoaderProps | null = null;
vi.mock("@/components/ProfileNameLoader", () => ({
  default: (props: LoaderProps) => {
    loader = props;
    return null;
  },
}));
vi.mock("@/lib/arkh/computeCoin", () => ({
  computeArkhCoinMulti: () => {
    throw new Error("stub");
  },
}));

import CoinCalculator from "@/components/coinMulti/CoinCalculator";

const save = () => ({
  charNames: ["Alpha", "Beta"],
  data: { PVStatList_0: [1, 1, 1, 1, 100], PVStatList_1: [1, 1, 1, 1, 90], CurrentMap_0: 2, CurrentMap_1: 14 },
});
const charSelect = () => screen.getAllByRole("combobox")[0] as HTMLSelectElement;
const mapSelect = () => screen.getAllByRole("combobox")[1] as HTMLSelectElement;

describe("CoinCalculator", () => {
  it("uses its own name key", () => {
    render(<CoinCalculator />);
    expect(loader!.storageKey).toBe("coin-multi-tracker.playerName");
  });

  it("keeps the map on refresh, re-derives it on a fresh load", () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
    fireEvent.change(mapSelect(), { target: { value: "8" } }); // Poopy Sewers
    act(() => loader!.onSave(save(), { refresh: true }));
    expect(mapSelect().value).toBe("8");
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
  });

  it("switching character jumps to that character's map", () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(save()));
    fireEvent.change(charSelect(), { target: { value: "1" } });
    expect(mapSelect().value).toBe("14");
  });

  it("shows the compute error with its own prefix", async () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText(/Coin multi compute failed: stub/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it — FAIL** (module missing).

- [ ] **Step 5: Create** `web/components/coinMulti/CoinCalculator.tsx`

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listCharacters, parseSave, type CharSummary } from "@/lib/dropRate/extract";
import { getCharClassKey } from "@/lib/talentsLevel/charClass";
import DeepView, { type DeepViewExtraTab } from "@/components/dropRate/DeepView";
import ProfileNameLoader from "@/components/ProfileNameLoader";
import { accountAutoLoads } from "@/lib/gameAuth/session";
import { buildCoinMapOptions, type CoinMapOption } from "@/lib/coinMulti/mapOptions";
import { formatCoinMulti } from "@/lib/coinMulti/format";
import type { ArkhNode } from "@/lib/arkh/node";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";

const SAVE_KEY = "coin-multi-tracker.last-upload.v1";
const NAME_KEY = "coin-multi-tracker.playerName";
const ERR_PREFIX = "Coin multi compute failed";

export type CoinCalculatorState = {
  charIndex: number | null;
  charName: string;
  /** PascalCase class key of the selected char (picks the per-class Observed Max). */
  classKey: string | null;
  charSummary: CharSummary | null;
  totalCoin: number | null;
  mapIndex: number;
  mapLabel: string;
  save: any;
  coinTree: ArkhNode | null;
  /** Compute error ("Coin multi compute failed: …") or null. */
  computeError: string | null;
};

type Props = {
  onStateChange?: (s: CoinCalculatorState) => void;
  compareBaseline?: { flatTree: FlatTree; capturedAt: number; charName: string } | null;
  snapshotSlot?: React.ReactNode;
  extraTabs?: DeepViewExtraTab[];
  extraTabsFirst?: boolean;
  defaultView?: string;
};

export default function CoinCalculator({
  onStateChange,
  compareBaseline,
  snapshotSlot,
  extraTabs,
  extraTabsFirst,
  defaultView,
}: Props) {
  const [jsonText, setJsonText] = useState("");
  const [save, setSave] = useState<any | null>(null);
  const [chars, setChars] = useState<CharSummary[]>([]);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [mapIdx, setMapIdx] = useState<number>(0);
  const [mapOptions, setMapOptions] = useState<CoinMapOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [coinTree, setCoinTree] = useState<ArkhNode | null>(null);
  const [coinTotal, setCoinTotal] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);

  // A refresh of the same account (auto-update / Sync now) keeps the map;
  // a fresh load re-derives it from the save.
  const keepViewRef = useRef(false);
  const lastCharIdxRef = useRef(charIdx);

  const applyParsedSave = useCallback(
    (parsed: any, opts: { silent?: boolean; keepView?: boolean } = {}) => {
      try {
        const list = listCharacters(parsed);
        if (list.length === 0) {
          if (!opts.silent) setError("Save parsed but no characters found.");
          return false;
        }
        keepViewRef.current = !!opts.keepView;
        setSave(parsed);
        setChars(list);
        setCharIdx((prev) => (list.some((c) => c.charIndex === prev) ? prev : list[0].charIndex));
        const maps = buildCoinMapOptions(parsed);
        setMapOptions(maps);
        const data = (parsed as any)?.data ?? {};
        const fallbackChar =
          opts.keepView && list.some((c) => c.charIndex === lastCharIdxRef.current)
            ? lastCharIdxRef.current
            : list[0].charIndex;
        const currentMap = Number(data[`CurrentMap_${fallbackChar}`]) || 0;
        const fallback = maps.some((m) => m.index === currentMap) ? currentMap : maps[0]?.index ?? 0;
        setMapIdx((prev) => (opts.keepView && maps.some((m) => m.index === prev) ? prev : fallback));
        setError(null);
        return true;
      } catch (e) {
        if (!opts.silent) setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    []
  );

  const stageSave = useCallback(
    (text: string, opts: { silent?: boolean } = {}) => {
      let parsed: unknown;
      try {
        parsed = parseSave(text);
      } catch (e) {
        if (!opts.silent) setError(e instanceof Error ? e.message : String(e));
        return false;
      }
      const ok = applyParsedSave(parsed, opts);
      if (ok) {
        try {
          window.localStorage.setItem(SAVE_KEY, text);
        } catch {
          // quota exceeded
        }
      }
      return ok;
    },
    [applyParsedSave]
  );

  // Restore a pasted save unless the name loader / signed-in account will
  // put one on screen (this effect runs after the loader's).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(NAME_KEY) || accountAutoLoads()) return;
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) stageSave(raw, { silent: true });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing character jumps to that character's current map.
  useEffect(() => {
    if (!save || chars.length === 0) return;
    const charChanged = lastCharIdxRef.current !== charIdx;
    lastCharIdxRef.current = charIdx;
    if (keepViewRef.current && !charChanged) return;
    const data = (save as any)?.data ?? {};
    const currentMap = Number(data[`CurrentMap_${charIdx}`]) || 0;
    setMapIdx(mapOptions.some((m) => m.index === currentMap) ? currentMap : mapOptions[0]?.index ?? 0);
  }, [charIdx, save, chars.length, mapOptions]);

  useEffect(() => {
    if (!save || chars.length === 0) {
      setCoinTree(null);
      setCoinTotal(null);
      setComputing(false);
      return;
    }
    let cancelled = false;
    setComputing(true);
    (async () => {
      try {
        const mod = await import("@/lib/arkh/computeCoin");
        if (cancelled) return;
        const result = mod.computeArkhCoinMulti(save, charIdx, mapIdx);
        setCoinTree(result.tree);
        setCoinTotal(result.total);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(`${ERR_PREFIX}: ` + (e instanceof Error ? e.message : String(e)));
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [save, charIdx, mapIdx, chars.length]);

  useEffect(() => {
    if (!onStateChange) return;
    const ch = chars.find((c) => c.charIndex === charIdx);
    const map = mapOptions.find((m) => m.index === mapIdx);
    onStateChange({
      charIndex: ch ? ch.charIndex : null,
      charName: ch?.charName ?? "",
      classKey: save && ch ? getCharClassKey(save, ch.charIndex) : null,
      charSummary: ch ?? null,
      totalCoin: coinTotal,
      mapIndex: mapIdx,
      mapLabel: map?.name ?? `Map ${mapIdx}`,
      save,
      coinTree,
      computeError: error && error.startsWith(ERR_PREFIX) ? error : null,
    });
  }, [charIdx, mapIdx, coinTotal, coinTree, chars, mapOptions, save, onStateChange, error]);

  const onLoad = () => {
    if (!jsonText.trim()) {
      setError("Paste a raw save JSON first.");
      return;
    }
    if (stageSave(jsonText)) setJsonText("");
  };

  return (
    <div>
      <h1 className="flex items-baseline gap-3 mb-1 mt-2">
        <span className="text-3xl font-extrabold text-gold">🪙 Coin Multi Calculator</span>
      </h1>
      <p className="text-center text-xs text-zinc-500 mb-4">
        Computes every character&apos;s monster coin multiplier from your save. Select character &amp; map. All
        processing local in your browser.
      </p>

      <ProfileNameLoader
        storageKey={NAME_KEY}
        onSave={(s, meta) => applyParsedSave(s, { keepView: meta?.refresh })}
        onError={(msg) => setError(msg)}
      >
        <details className="rounded-lg bg-zinc-900/40 p-3 border border-zinc-800">
          <summary className="cursor-pointer select-none flex items-center gap-2 flex-wrap">
            <span className="dt-arrow text-zinc-500 text-sm">▸</span>
            <span className="font-semibold text-gold">📋 Or paste a save manually</span>
            <span className="text-xs text-zinc-500 font-normal">
              Uses the &ldquo;Copy for Support&rdquo; button on{" "}
              <a
                href="https://idleontoolbox.com"
                target="_blank"
                rel="noreferrer"
                className="text-gold hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                idleontoolbox.com
              </a>
            </span>
          </summary>
          <div className="flex flex-col gap-3 mt-3">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='Paste the output of "Copy for Support" here (Ctrl+V)…'
              className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={onLoad}
              className="self-start px-4 py-1.5 text-sm font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
            >
              Load pasted save
            </button>
          </div>
        </details>
      </ProfileNameLoader>

      {snapshotSlot && <div className="mb-4">{snapshotSlot}</div>}

      <div className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800 flex flex-col gap-3">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-sm text-zinc-400 font-medium">Character &amp; map:</span>
          <select
            value={charIdx}
            disabled={chars.length === 0}
            onChange={(e) => setCharIdx(Number(e.target.value))}
            className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-sky-300 disabled:opacity-40"
          >
            {chars.length === 0 ? (
              <option value={0}>-- load save first --</option>
            ) : (
              chars.map((c) => (
                <option key={c.charIndex} value={c.charIndex}>
                  {`${c.charName} (Lv ${c.level})`}
                </option>
              ))
            )}
          </select>
          <select
            value={mapIdx}
            disabled={chars.length === 0}
            onChange={(e) => setMapIdx(Number(e.target.value))}
            title="The map sets the guild bonus world and Coins For Charon's multikill tier"
            className="px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-sky-300 disabled:opacity-40"
          >
            {mapOptions.map((m) => (
              <option key={m.index} value={m.index}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}

        <div className="p-2 rounded border border-zinc-800 bg-zinc-950/60 flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Total Coin Multi</span>
          <span
            className="text-2xl font-extrabold text-gold tabular-nums"
            title={coinTotal !== null ? coinTotal.toExponential(6) + "x" : undefined}
          >
            {coinTotal !== null ? formatCoinMulti(coinTotal) + "x" : "—"}
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 mb-4">
        {computing ? (
          <p className="text-sm text-zinc-500 italic">Computing…</p>
        ) : (
          <DeepView
            tree={coinTree}
            baseline={compareBaseline ?? null}
            extraTabs={extraTabs}
            extraTabsFirst={extraTabsFirst}
            defaultView={defaultView}
            showWorldView={false}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Point the snapshot section at the real type.** In `CoinSnapshotSection.tsx`, replace the local `CoinState` type with `import type { CoinCalculatorState } from "./CoinCalculator";` and use `CoinCalculatorState` for the `state` prop.

- [ ] **Step 7: Add the Coin case** to `web/__tests__/components/accountSaveOverPaste.test.tsx`.
  - Next to the existing `computeDR` mock, add:
    ```ts
    vi.mock("@/lib/arkh/computeCoin", () => ({ computeArkhCoinMulti: () => { throw new Error("stub"); } }));
    ```
  - Import `CoinCalculator from "@/components/coinMulti/CoinCalculator"`.
  - Add this case inside the existing `describe`:

```tsx
  it("Coin Multi — account save already loaded this visit", async () => {
    localStorage.setItem("coin-multi-tracker.last-upload.v1", OLD_PASTE);
    await loadAccountThisVisit();
    render(<CoinCalculator />);
    await waitFor(() => expect(shownChar()).toBe(ACCOUNT_CHAR));
  });
```

- [ ] **Step 8: Run the new tests + full suite + types — all PASS**

Run: `npx vitest run __tests__/components/CoinCalculator.keepView.test.tsx __tests__/components/accountSaveOverPaste.test.tsx`, then `npx vitest run` and `npx tsc --noEmit -p tsconfig.json`.

- [ ] **Step 9: Commit**

```bash
git add web/lib/coinMulti/mapOptions.ts web/components/coinMulti/CoinCalculator.tsx web/components/coinMulti/CoinSnapshotSection.tsx web/__tests__/lib/coinMulti/mapOptions.test.ts web/__tests__/components/CoinCalculator.keepView.test.tsx web/__tests__/components/accountSaveOverPaste.test.tsx
git commit -m "feat(coin): calculator with map picker, account/paste loading and deep tree" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 💡 Biggest Gains (multi-group math + tab)

**Files:**
- Create: `web/lib/coinMulti/biggestGains.ts`, `web/components/coinMulti/CoinBiggestGains.tsx`
- Test: `web/__tests__/lib/coinMulti/biggestGains.test.ts`, `web/__tests__/components/CoinBiggestGains.test.tsx`

**Interfaces:**
- Consumes: `COIN_GROUPS`, `COIN_ROOT`, `CoinGroupKind` (Task 1); `FlatTree` (`@/lib/dropRate/treeFlatten`).
- Produces:
  - `computeCoinGains(yoursFlat, refFlat): { rows: CoinGainRow[]; comparableSources: number }`;
  - `splitCoinGains(rows, threshold?)`;
  - `MINOR_GAIN_THRESHOLD_PCT = 0.05`;
  - `CoinGainRow = { path; group; source; kind; you; max; gainPct }`;
  - default export `CoinBiggestGains({ yoursFlat, classKey, computeError?, loadReference? })`. Its default `loadReference` lazy-imports `@/lib/coinMulti/topCoinMulti` (Task 10).

**Math:** the coin multi is a product of group factors. Raising one source from `you` to `max` multiplies the total by the group's new factor ÷ its old factor:
- **pct:** `(1 + (S − you + max)/100) / (1 + S/100)`, where `S = (factor − 1)·100`;
- **raw:** `(1 + (S − you + max)) / (1 + S)`, where `S = factor − 1`;
- **min4:** `(1 + min(4, max)) / (1 + min(4, you))`.

- [ ] **Step 1: Write the failing math test** — `web/__tests__/lib/coinMulti/biggestGains.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { computeCoinGains, splitCoinGains } from "@/lib/coinMulti/biggestGains";
import { COIN_GROUPS, COIN_ROOT } from "@/lib/arkh/stats/defs/coin-multi";

const G = (key: string) => `${COIN_ROOT} / ${COIN_GROUPS.find((g) => g.key === key)!.name}`;

describe("Coin Multi biggest gains", () => {
  it("pct group: the new group factor over the old one", () => {
    const yours = { [G("g23")]: 4, [`${G("g23")} / A`]: 100, [`${G("g23")} / B`]: 200 }; // S = 300
    const ref = { [`${G("g23")} / A`]: 400 };
    const { rows } = computeCoinGains(yours, ref);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "A", kind: "pct", you: 100, max: 400 });
    expect(rows[0].gainPct).toBeCloseTo(75, 9); // (1 + 6) / 4 − 1
  });

  it("raw group has no /100", () => {
    const yours = { [G("g18")]: 3, [`${G("g18")} / X`]: 0.5 }; // S = 2
    const ref = { [`${G("g18")} / X`]: 1.5 };
    expect(computeCoinGains(yours, ref).rows[0].gainPct).toBeCloseTo(100 / 3, 9); // 4/3 − 1
  });

  it("min4 group caps both sides at 4", () => {
    const yours = { [G("g02")]: 3, [`${G("g02")} / C`]: 2 };
    const ref = { [`${G("g02")} / C`]: 9 };
    expect(computeCoinGains(yours, ref).rows[0].gainPct).toBeCloseTo(200 / 3, 9); // 5/3 − 1
  });

  it("ignores sources at the max and sources without a reference; sorts descending", () => {
    const yours = {
      [G("g23")]: 2, [`${G("g23")} / A`]: 50, [`${G("g23")} / B`]: 50,
      [G("g13")]: 1.5, [`${G("g13")} / Gold Set`]: 50,
    };
    const ref = { [`${G("g23")} / A`]: 50, [`${G("g23")} / B`]: 150, [`${G("g13")} / Gold Set`]: 50 };
    const res = computeCoinGains(yours, ref);
    expect(res.comparableSources).toBe(3);
    expect(res.rows.map((r) => r.source)).toEqual(["B"]);
  });

  it("splits minor gains below 0.05%", () => {
    const rows = [
      { path: "a", group: "g", source: "a", kind: "pct" as const, you: 0, max: 1, gainPct: 2 },
      { path: "b", group: "g", source: "b", kind: "pct" as const, you: 0, max: 1, gainPct: 0.01 },
    ];
    const { major, minor } = splitCoinGains(rows);
    expect(major.map((r) => r.path)).toEqual(["a"]);
    expect(minor.map((r) => r.path)).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Run it — FAIL.** Then create `web/lib/coinMulti/biggestGains.ts`:

```ts
// Biggest Gains for the Coin Multi page. The coin multi is a product of 23
// group factors, so matching the Observed Max on one source multiplies the
// total by that group's new factor over its current one:
//   pct : (1 + (S − you + max)/100) / (1 + S/100)
//   raw : (1 + (S − you + max)) / (1 + S)
//   min4: (1 + min(4, max)) / (1 + min(4, you))
// S is the group's current sum, recovered from its factor in the flat tree.

import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import { COIN_GROUPS, COIN_ROOT, type CoinGroupKind } from "@/lib/arkh/stats/defs/coin-multi";

export const MINOR_GAIN_THRESHOLD_PCT = 0.05;

export type CoinGainRow = {
  path: string;
  group: string;
  source: string;
  kind: CoinGroupKind;
  you: number;
  max: number;
  /** % the total Coin Multi rises if this source matched the Observed Max. */
  gainPct: number;
};

function directChildren(a: FlatTree, b: Record<string, number>, parent: string): string[] {
  const prefix = `${parent} / `;
  const out = new Set<string>();
  for (const flat of [a, b]) {
    for (const p of Object.keys(flat)) {
      if (p.startsWith(prefix) && !p.slice(prefix.length).includes(" / ")) out.add(p);
    }
  }
  return [...out];
}

export function computeCoinGains(
  yoursFlat: FlatTree,
  refFlat: Record<string, number>
): { rows: CoinGainRow[]; comparableSources: number } {
  const rows: CoinGainRow[] = [];
  let comparableSources = 0;
  for (const g of COIN_GROUPS) {
    const groupPath = `${COIN_ROOT} / ${g.name}`;
    const factor = Number(yoursFlat[groupPath]);
    if (!Number.isFinite(factor)) continue;
    const S = g.kind === "pct" ? (factor - 1) * 100 : factor - 1;
    for (const path of directChildren(yoursFlat, refFlat, groupPath)) {
      const max = refFlat[path];
      if (typeof max !== "number" || !Number.isFinite(max)) continue;
      const you = Number(yoursFlat[path]) || 0;
      const ratio =
        g.kind === "min4"
          ? (1 + Math.min(4, max)) / (1 + Math.min(4, you))
          : g.kind === "pct"
            ? (1 + (S - you + max) / 100) / (1 + S / 100)
            : (1 + (S - you + max)) / (1 + S);
      const gainPct = (ratio - 1) * 100;
      if (!Number.isFinite(gainPct)) continue;
      comparableSources++;
      if (gainPct > 0) {
        rows.push({ path, group: g.name, source: path.slice(path.lastIndexOf(" / ") + 3), kind: g.kind, you, max, gainPct });
      }
    }
  }
  rows.sort((a, b) => b.gainPct - a.gainPct);
  return { rows, comparableSources };
}

export function splitCoinGains(
  rows: CoinGainRow[],
  threshold: number = MINOR_GAIN_THRESHOLD_PCT
): { major: CoinGainRow[]; minor: CoinGainRow[] } {
  const major: CoinGainRow[] = [];
  const minor: CoinGainRow[] = [];
  for (const r of rows) (r.gainPct >= threshold ? major : minor).push(r);
  return { major, minor };
}
```

Run — PASS.

- [ ] **Step 3: Write the failing component test** — `web/__tests__/components/CoinBiggestGains.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoinBiggestGains from "@/components/coinMulti/CoinBiggestGains";
import { COIN_GROUPS, COIN_ROOT } from "@/lib/arkh/stats/defs/coin-multi";

const G = `${COIN_ROOT} / ${COIN_GROUPS[22].name}`;
const yours = { [G]: 4, [`${G} / Alpha Source`]: 100, [`${G} / Beta Source`]: 200 };
const ref = { [`${G} / Alpha Source`]: 400, [`${G} / Beta Source`]: 200 };

describe("CoinBiggestGains", () => {
  it("asks for a save first", () => {
    render(<CoinBiggestGains yoursFlat={null} classKey={null} loadReference={async () => ref} />);
    expect(screen.getByText(/Load a save above/)).toBeInTheDocument();
  });

  it("ranks sources by the coin multi they would add", async () => {
    render(<CoinBiggestGains yoursFlat={yours} classKey={null} loadReference={async () => ref} />);
    expect(await screen.findByText(/Biggest win/)).toBeInTheDocument();
    expect(screen.getAllByText("Alpha Source").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+75.0%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Beta Source")).toBeNull(); // already at the max
  });

  it("shows the compute error banner", () => {
    render(<CoinBiggestGains yoursFlat={yours} classKey={null} computeError="Coin multi compute failed: x" loadReference={async () => ref} />);
    expect(screen.getByText(/Coin multi compute failed: x/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it — FAIL.** Then create `web/components/coinMulti/CoinBiggestGains.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import { computeCoinGains, splitCoinGains, type CoinGainRow } from "@/lib/coinMulti/biggestGains";

/** Compact k/M/B/T formatting for large percentages and contributions. */
function notate(n: number): string {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(a < 10 && !Number.isInteger(n) ? 2 : 0);
}

/** Gain percentages: one decimal below 10,000%, compact above. */
const fmtGain = (p: number) => (p < 1e4 ? p.toFixed(1) : notate(p));

const METHODOLOGY_NOTE =
  "Coin gain = how much your total Coin Multi would rise if this source matched the top players " +
  "(Observed Max). Every group multiplies the total, so a source's gain is its group's new factor " +
  "over the current one. Values are a ceiling, not a one-level step.";

export type LoadReference = (classKey: string | null) => Promise<Record<string, number>>;

const defaultLoadReference: LoadReference = async (classKey) => {
  const mod = await import("@/lib/coinMulti/topCoinMulti");
  return mod.topCoinFlatForClass(classKey) as Record<string, number>;
};

const Banner = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-red-400 py-4">⚠ {children}</p>
);
const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-zinc-500 text-center py-10">{children}</p>
);

function fmtContribution(row: CoinGainRow, v: number): string {
  if (row.kind === "pct") return `+${notate(v)}%`;
  return notate(v);
}

export default function CoinBiggestGains({
  yoursFlat,
  classKey,
  computeError = null,
  loadReference = defaultLoadReference,
}: {
  yoursFlat: FlatTree | null;
  classKey: string | null;
  computeError?: string | null;
  loadReference?: LoadReference;
}) {
  const [ref, setRef] = useState<Record<string, number> | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [showMinor, setShowMinor] = useState(false);

  useEffect(() => {
    if (!yoursFlat || computeError) return;
    let cancelled = false;
    setRef(null);
    setRefError(null);
    loadReference(classKey)
      .then((r) => !cancelled && setRef(r))
      .catch((e) => !cancelled && setRefError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [yoursFlat, classKey, computeError, loadReference]);

  if (computeError) return <Banner>{computeError}</Banner>;
  if (!yoursFlat) return <Hint>Load a save above to see your biggest Coin Multi gains.</Hint>;
  if (refError) return <Banner>Coin multi compute failed: {refError}</Banner>;
  if (!ref) {
    return (
      <p className="text-sm text-zinc-500 text-center py-10">
        <span className="inline-block animate-spin mr-2">⏳</span>
        Loading top-player reference…
      </p>
    );
  }

  const result = computeCoinGains(yoursFlat, ref);
  if (result.comparableSources === 0) {
    return <Hint>No comparable top-player reference for this character yet — can&apos;t rank Coin Multi gains.</Hint>;
  }
  if (result.rows.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200/90 text-center">
        🎉 You&apos;re at or above the Observed Max on every source — nothing to gain here. Nice.
      </div>
    );
  }

  const { major, minor } = splitCoinGains(result.rows);
  const visible = showMinor ? result.rows : major;

  return (
    <div className="space-y-4">
      {visible.length > 0 ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
          💡 <strong>Biggest win →</strong> improve <strong>{visible[0].source}</strong> for{" "}
          <strong>+{fmtGain(visible[0].gainPct)}%</strong> Coin Multi
        </div>
      ) : (
        <div className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
          No high-impact gains — toggle &ldquo;Show minor sources&rdquo; to see the rest.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Source</th>
              <th className="text-right font-medium px-3 py-2">You</th>
              <th className="text-right font-medium px-3 py-2">Observed Max</th>
              <th className="text-right font-medium px-3 py-2">Coin gain</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.path} className={`border-t border-zinc-800/70 ${i === 0 ? "bg-emerald-500/5" : ""}`}>
                <td className="px-3 py-2">
                  <div className="text-zinc-200">{row.source}</div>
                  <div className="text-[11px] text-zinc-500">{row.group}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{fmtContribution(row, row.you)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{fmtContribution(row, row.max)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="text-emerald-300 font-semibold">+{fmtGain(row.gainPct)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showMinor}
          onChange={(e) => setShowMinor(e.target.checked)}
          className="accent-emerald-500"
          disabled={minor.length === 0}
        />
        Show minor sources
        {minor.length > 0 && <span className="text-zinc-600">({minor.length} below {"<"}0.05%)</span>}
      </label>

      <p className="text-[11px] text-zinc-500 leading-snug">{METHODOLOGY_NOTE}</p>
    </div>
  );
}
```

- [ ] **Step 5: Run both tests + full suite + types — PASS.** The default `loadReference` imports `@/lib/coinMulti/topCoinMulti`, which Task 10 generates. For `tsc` to pass now, create a placeholder with the same exports:

```ts
// web/lib/coinMulti/topCoinMulti.ts — replaced by scripts/update-top-coin.ts (Task 10).
type FlatMap = Readonly<Record<string, number>>;
export const TOP_COIN_FLAT: FlatMap = {};
export const TOP_COIN_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {};
export const TOP_COIN_CLASS_PROFILE: Readonly<Record<string, string>> = {};
export function topCoinFlatForClass(classKey: string | null | undefined): FlatMap {
  const profile = classKey ? TOP_COIN_CLASS_PROFILE[classKey] : undefined;
  const override = profile ? TOP_COIN_PROFILE_OVERRIDES[profile] : undefined;
  return override ? { ...TOP_COIN_FLAT, ...override } : TOP_COIN_FLAT;
}
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/coinMulti/biggestGains.ts web/components/coinMulti/CoinBiggestGains.tsx web/lib/coinMulti/topCoinMulti.ts web/__tests__/lib/coinMulti/biggestGains.test.ts web/__tests__/components/CoinBiggestGains.test.tsx
git commit -m "feat(coin): Biggest Gains with multi-group math" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Observed Max collector, class gating, cron

**Files:**
- Create:
  - `web/scripts/_shared/coinClassGating.ts`;
  - `web/scripts/update-top-coin.ts`;
  - `web/lib/coinMulti/topCoinMulti.meta.ts`, which the collector generates;
  - `web/lib/coinMulti/topCoinMulti.ts`, which the collector regenerates in place of Task 9's placeholder.
- Modify: `.github/workflows/refresh-top-max.yml`
- Test: `web/__tests__/scripts/coin-class-gating.test.ts`

**Interfaces:**
- Consumes:
  - `computeArkhCoinPools`, `combineCoinPools`, `COIN_ROOT`, `COIN_CLASS_TALENTS` (Task 1);
  - `gatherCandidates`, `fetchProfileSave` (`scripts/_shared/itProfiles.ts`);
  - `allClassKeys`, `profileKey`, `GatedTalent` (`scripts/_shared/classGating.ts`, imported, not edited);
  - `flattenTree`, `listCharacters`.
- Produces:
  - `deriveGatedCoinTalents(): GatedTalent[]`;
  - generated `TOP_COIN_FLAT`, `TOP_COIN_PROFILE_OVERRIDES`, `TOP_COIN_CLASS_PROFILE`, `topCoinFlatForClass(classKey)`;
  - generated `TOP_COIN_GENERATED_AT`, `TOP_COIN_PLAYERS_SCANNED`, `TOP_COIN_HYPOTHETICAL_TOTAL`, `TOP_COIN_BEST`.

**Model** (same as the DR collector, minus the DR-only parts):
- **Players:** the #1 of every IT leaderboard plus the top 10 of the `cashMulti` board.
- **Per character:** coin pools at `BEST_MAP = 301` (w7a1 Refraction Bend: world 7, the top guild factor, and a real multikill tier; map 300 is a town).
- **Merge:** keep the best value per pool item; the item index is the same source for every save.
- **Base profile:** one `combineCoinPools` pass with the class-specific talents zeroed.
- **Per-profile override:** the talents the class owns.
- **No card cap** (Ruling 1).
- **Safety:** refuses to write when fewer than 20 players were scanned.

- [ ] **Step 1: Write the failing gating test** — `web/__tests__/scripts/coin-class-gating.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { deriveGatedCoinTalents } from "@/scripts/_shared/coinClassGating";
import { allClassKeys } from "@/scripts/_shared/classGating";
import { COIN_CLASS_TALENTS } from "@/lib/arkh/stats/systems/coin/coin";

describe("coin class gating", () => {
  it("gates only coin talents that some — not all — classes have", () => {
    const all = allClassKeys().length;
    for (const g of deriveGatedCoinTalents()) {
      expect(COIN_CLASS_TALENTS as readonly number[]).toContain(g.id);
      expect(g.owners.size).toBeGreaterThan(0);
      expect(g.owners.size).toBeLessThan(all);
    }
  });
});
```

- [ ] **Step 2: Run it — FAIL.** Then create `web/scripts/_shared/coinClassGating.ts`:

```ts
// Per-class gating of the Coin Multi reference: the coin formula's class
// talents (COIN_CLASS_TALENTS) count only for classes whose tabs include them.
// Mirrors classGating.deriveGatedTalents, over the coin talent list.

import { TALENT_TABS_BY_CLASS } from "../../lib/talentsLevel/talentTabs.gen";
import { isAccountWideTalent } from "../../lib/arkh/stats/data/common/account-wide-talents";
import { COIN_CLASS_TALENTS } from "../../lib/arkh/stats/systems/coin/coin";
import type { GatedTalent } from "./classGating";

export function deriveGatedCoinTalents(): GatedTalent[] {
  const classKeys = Object.keys(TALENT_TABS_BY_CLASS);
  const out: GatedTalent[] = [];
  for (const id of COIN_CLASS_TALENTS) {
    if (isAccountWideTalent(id)) continue;
    const owners = new Set<string>();
    for (const c of classKeys) {
      const tabs = (TALENT_TABS_BY_CLASS as any)[c]?.tabs ?? [];
      if (tabs.some((t: any) => t.talents.some((x: any) => x.id === id))) owners.add(c);
    }
    if (owners.size === 0 || owners.size === classKeys.length) continue;
    out.push({ id, owners });
  }
  return out;
}
```

Run — PASS.

- [ ] **Step 3: Create** `web/scripts/update-top-coin.ts`

```ts
// Refresh the bundled top-player Coin Multi reference in
// lib/coinMulti/topCoinMulti.ts (+ .meta.ts). Same model as update-top-dr.ts:
// every char of every candidate at map 301 (world 7 for the guild term),
// the best value per source across everyone, then ONE combine() pass — the
// tree and the total come from the same math a real save uses. Class talents
// are gated per class.
//
// Run (from web/):  npx tsx scripts/update-top-coin.ts   [--limit N] [--slow]
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { gatherCandidates, fetchProfileSave } from "./_shared/itProfiles";
import { computeArkhCoinPools, combineCoinPools } from "../lib/arkh/computeCoin";
import { COIN_ROOT } from "../lib/arkh/stats/defs/coin-multi";
import type { Pool } from "../lib/arkh/stats/tree-builder";
import { flattenTree } from "../lib/dropRate/treeFlatten";
import { listCharacters } from "../lib/dropRate/extract";
import { allClassKeys, profileKey } from "./_shared/classGating";
import { deriveGatedCoinTalents } from "./_shared/coinClassGating";

const argv = process.argv.slice(2);
const THROTTLE_MS = argv.includes("--slow") ? 1500 : 400;
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
})();
// Never publish a shrunken reference (the Tome cron lesson); --limit is a smoke test.
const MIN_PLAYERS = LIMIT ? 1 : 20;
// The map feeds the guild world (⌊map/50⌋ + 1) and talent 643's multikill
// tier. 301 (w7a1) is W7's first fighting map; 300 is a town (tier 1).
const BEST_MAP = 301;

const OUTPUT_FILE = join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.ts");
const META_FILE = join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.meta.ts");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Best = { player: string; char: string; total: number };

function mergeBest(acc: Record<string, Pool> | null, incoming: Record<string, Pool>): Record<string, Pool> {
  if (!acc) {
    const init: Record<string, Pool> = {};
    for (const pn in incoming) init[pn] = { items: [...incoming[pn].items], sum: 0, product: 0 };
    return init;
  }
  for (const pn in incoming) {
    const inc = incoming[pn];
    if (!acc[pn]) {
      acc[pn] = { items: [...inc.items], sum: 0, product: 0 };
      continue;
    }
    const cur = acc[pn];
    const n = Math.min(cur.items.length, inc.items.length);
    for (let i = 0; i < n; i++) {
      if ((Number(inc.items[i].val) || 0) > (Number(cur.items[i].val) || 0)) cur.items[i] = inc.items[i];
    }
  }
  return acc;
}

/** Best pools with some class talents zeroed → one combine() → flat map. */
function profileFlat(best: Record<string, Pool>, zeroTalentIds: number[]): Record<string, number> {
  const clone: Record<string, Pool> = {};
  for (const pn in best) {
    const items = best[pn].items.map((it) =>
      zeroTalentIds.some((id) => it.name.endsWith(`(Talent ${id})`)) ? { ...it, val: 0 } : { ...it }
    );
    let sum = 0;
    let product = 1;
    for (const it of items) {
      const v = Number(it.val) || 0;
      sum += v;
      product *= v !== 0 ? v : 1;
    }
    clone[pn] = { items, sum, product };
  }
  const combined = combineCoinPools(clone);
  const flat = flattenTree(combined.tree);
  flat[COIN_ROOT] = combined.total;
  return flat;
}

async function main() {
  console.log("→ Gathering candidates from leaderboards…");
  const candidates = await gatherCandidates({ limit: LIMIT ?? undefined, focusBoard: "cashMulti" });
  console.log(`  ✓ ${candidates.length} candidates`);

  let bestPools: Record<string, Pool> | null = null;
  let bestTotal: Best | null = null;
  let scanned = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    process.stdout.write(`  [${i + 1}/${candidates.length}] ${name.padEnd(20)}`);
    const save = await fetchProfileSave(name);
    let chars: { charIndex: number; charName: string }[] = [];
    try {
      chars = save ? listCharacters(save) : [];
    } catch {
      chars = [];
    }
    if (!save || chars.length === 0) {
      console.log("  · skipped");
      skipped++;
      if (i < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let playerBest = 0;
    let playerBestChar = "";
    for (const ch of chars) {
      try {
        const pools = computeArkhCoinPools(save, ch.charIndex, BEST_MAP);
        const total = combineCoinPools(pools).total;
        if (Number.isFinite(total) && total > playerBest) {
          playerBest = total;
          playerBestChar = ch.charName;
        }
        bestPools = mergeBest(bestPools, pools);
      } catch {
        // skip a char that fails to compute
      }
    }
    if (!bestTotal || playerBest > bestTotal.total) bestTotal = { player: name, char: playerBestChar, total: playerBest };
    scanned++;
    console.log(`  ✓ best ${playerBest.toExponential(3)}x (${playerBestChar})`);
    if (i < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  if (!bestPools || scanned < MIN_PLAYERS) {
    console.error(`× only ${scanned} players scanned (< ${MIN_PLAYERS}); refusing to publish`);
    process.exit(1);
  }

  // Base = every class-specific coin talent zeroed; each profile adds back
  // the talents its classes own. Zeroing keeps the paths, so the page merges
  // {...base, ...override}.
  const gated = deriveGatedCoinTalents();
  const baseFlat = profileFlat(bestPools, gated.map((x) => x.id));
  const classProfile: Record<string, string> = {};
  const overrides: Record<string, Record<string, number>> = {};
  let maxProfileTotal = baseFlat[COIN_ROOT] || 0;
  for (const c of allClassKeys()) {
    const owned = gated.filter((x) => x.owners.has(c)).map((x) => x.id);
    const key = profileKey(owned);
    classProfile[c] = key;
    if (key === "base" || overrides[key]) continue;
    const pf = profileFlat(bestPools, gated.filter((x) => !owned.includes(x.id)).map((x) => x.id));
    const d: Record<string, number> = {};
    for (const k in pf) if (baseFlat[k] !== pf[k]) d[k] = pf[k];
    overrides[key] = d;
    maxProfileTotal = Math.max(maxProfileTotal, pf[COIN_ROOT] || 0);
  }

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · gated talents: ${gated.map((x) => x.id).join(", ") || "none"}`);
  console.log(`  · best per-class ceiling: ${maxProfileTotal.toExponential(3)}x`);
  console.log(`  · best real player: ${bestTotal?.total.toExponential(3)}x by ${bestTotal?.player} (${bestTotal?.char})`);

  emitFiles(baseFlat, overrides, classProfile, bestTotal, maxProfileTotal, scanned);
}

function emitFiles(
  baseFlat: Record<string, number>,
  overrides: Record<string, Record<string, number>>,
  classProfile: Record<string, string>,
  best: Best | null,
  hypotheticalTotal: number,
  scanned: number
) {
  const now = new Date().toISOString();
  writeFileSync(
    META_FILE,
    [
      "// Top-player Coin Multi reference — metadata only (small, statically",
      "// imported). The path table lives in topCoinMulti.ts and is lazy-loaded.",
      "// Both auto-refreshed by scripts/update-top-coin.ts.",
      "",
      `export const TOP_COIN_GENERATED_AT = ${JSON.stringify(now)};`,
      `export const TOP_COIN_PLAYERS_SCANNED = ${scanned};`,
      "// Best Coin Multi a single CLASS's best-of-each-source build reaches.",
      `export const TOP_COIN_HYPOTHETICAL_TOTAL = ${hypotheticalTotal};`,
      "// Highest Coin Multi of a single real player, for context.",
      `export const TOP_COIN_BEST = ${JSON.stringify(best ?? { player: "", char: "", total: 0 })};`,
      "",
    ].join("\n")
  );
  console.log(`\n✓ Wrote ${META_FILE}`);

  const obj = (m: Record<string, number>) => {
    const lines: string[] = ["{"];
    for (const path of Object.keys(m).sort()) {
      if (!Number.isFinite(m[path])) continue;
      lines.push(`    ${JSON.stringify(path)}: ${m[path]},`);
    }
    lines.push("  }");
    return lines.join("\n");
  };
  const overrideEntries = Object.keys(overrides)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${obj(overrides[k])},`)
    .join("\n");

  writeFileSync(
    OUTPUT_FILE,
    [
      "// Top-player Coin Multi reference — best-of-each-source pools run through",
      "// ONE combine() pass (the same coin math a real save uses), gated PER CLASS",
      "// for the coin formula's class talents. Use topCoinFlatForClass(classKey).",
      "// Large file: lazy-load it, don't import statically.",
      `// Generated ${now} · ${scanned} players. Refresh: scripts/update-top-coin.ts.`,
      "",
      "type FlatMap = Readonly<Record<string, number>>;",
      "",
      `export const TOP_COIN_FLAT: FlatMap = ${obj(baseFlat)};`,
      "",
      "export const TOP_COIN_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {",
      overrideEntries,
      "};",
      "",
      `export const TOP_COIN_CLASS_PROFILE: Readonly<Record<string, string>> = ${JSON.stringify(classProfile, null, 2)};`,
      "",
      "/** The top Coin Multi reference for a class — base merged with its profile. */",
      "export function topCoinFlatForClass(classKey: string | null | undefined): FlatMap {",
      "  const profile = classKey ? TOP_COIN_CLASS_PROFILE[classKey] : undefined;",
      "  const override = profile ? TOP_COIN_PROFILE_OVERRIDES[profile] : undefined;",
      "  return override ? { ...TOP_COIN_FLAT, ...override } : TOP_COIN_FLAT;",
      "}",
      "",
    ].join("\n")
  );
  console.log(`✓ Wrote ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Generate the first reference** (network: IT profiles endpoint, ~2 min). Run from `web/`:
1. Smoke test first: `node --import tsx scripts/update-top-coin.ts --limit 3`. Expect it to print 3 players with finite totals.
2. Full run: `node --import tsx scripts/update-top-coin.ts`. Expect `Scanned ≥ 20`; it writes both files.

Check:
- `topCoinMulti.ts` has `"Coin Multi"` and 23 `"Coin Multi / <group>"` keys;
- no `NaN` / `Infinity`;
- `TOP_COIN_HYPOTHETICAL_TOTAL` ≥ the best real player.

(`npx tsx` has hung locally in this repo; CI uses `npx tsx` and works.)

- [ ] **Step 5: Add the cron step** in `.github/workflows/refresh-top-max.yml`.

After the "Refresh top-player Drop Rate max" step, add:

```yaml
      - name: Refresh top-player Coin Multi max
        working-directory: web
        run: npx tsx scripts/update-top-coin.ts
```

In the commit step:
- set `files="web/lib/dropRate/topDropRate.ts web/lib/dropRate/topDropRate.meta.ts web/lib/coinMulti/topCoinMulti.ts web/lib/coinMulti/topCoinMulti.meta.ts web/lib/talentsLevel/topTalents.ts"`;
- change the commit message to `chore: auto-refresh top DR + coin + talent max snapshots`;
- add `web/lib/coinMulti/topCoinMulti.ts` (+ `.meta.ts`) to the header comment's list.

- [ ] **Step 6: Full suite + types, then commit**

```bash
git add web/scripts/_shared/coinClassGating.ts web/scripts/update-top-coin.ts web/lib/coinMulti/topCoinMulti.ts web/lib/coinMulti/topCoinMulti.meta.ts web/__tests__/scripts/coin-class-gating.test.ts .github/workflows/refresh-top-max.yml
git commit -m "feat(coin): top-player Observed Max collector, class gating and cron step" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Page, navigation, home card

**Files:**
- Create: `web/app/coin-multi/page.tsx`, `web/app/coin-multi/CoinMultiPageClient.tsx`
- Modify: `web/components/TopNav.tsx`, `web/app/page.tsx`, `web/__tests__/components/TopNav.test.tsx`, `web/e2e/homepage.spec.ts`

**Interfaces:**
- Consumes:
  - `CoinCalculator` + `CoinCalculatorState` (Task 8), `CoinSnapshotSection` (Task 7), `CoinBiggestGains` (Task 9);
  - `topCoinMulti` + meta (Task 10), `flattenTree`, `DeepViewExtraTab`, `AnonExcludedNote`.

- [ ] **Step 1: Failing nav test.** In `web/__tests__/components/TopNav.test.tsx`, "renders all nav items", add:

```ts
    expect(screen.getByText(/Coin Multi/i)).toBeInTheDocument();
```

Run: `npx vitest run __tests__/components/TopNav.test.tsx`. Expect FAIL.

- [ ] **Step 2: Nav + home.**
  - In `web/components/TopNav.tsx` `ITEMS`, after the Drop Rate entry, add `{ href: "/coin-multi", label: "🪙 Coin Multi" },`.
  - In `web/app/page.tsx`, after the Drop Rate `ShortcutCard`, add:

```tsx
        <ShortcutCard
          href="/coin-multi"
          icon="🪙"
          title="Coin Multi Tracker"
          description="Every term of the game's coin formula on your save, per character and map, with snapshots and a top-player comparison."
          cta="Open Coin Multi"
        />
```

In `web/e2e/homepage.spec.ts` `cards`, after the Drop Rate line, add `{ title: "Coin Multi Tracker", desc: "coin formula" },`.

Run the nav test — PASS.

- [ ] **Step 3: Page shell** — `web/app/coin-multi/page.tsx`

```tsx
import type { Metadata } from "next";
import CoinMultiPageClient from "./CoinMultiPageClient";

export const metadata: Metadata = {
  title: "Coin Multi Tracker",
  description:
    "Your Idleon monster coin multiplier, source by source, computed from your save — per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function CoinMultiPage() {
  return <CoinMultiPageClient />;
}
```

- [ ] **Step 4: Page client** — `web/app/coin-multi/CoinMultiPageClient.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import CoinCalculator, { type CoinCalculatorState } from "@/components/coinMulti/CoinCalculator";
import CoinSnapshotSection from "@/components/coinMulti/CoinSnapshotSection";
import CoinBiggestGains from "@/components/coinMulti/CoinBiggestGains";
import AnonExcludedNote from "@/components/AnonExcludedNote";
import type { DeepViewExtraTab } from "@/components/dropRate/DeepView";
import { flattenTree, type FlatTree } from "@/lib/dropRate/treeFlatten";
import { TOP_COIN_GENERATED_AT, TOP_COIN_PLAYERS_SCANNED } from "@/lib/coinMulti/topCoinMulti.meta";

type Baseline = { flatTree: FlatTree; capturedAt: number; charName: string };

export default function CoinMultiPageClient() {
  const [calcState, setCalcState] = useState<CoinCalculatorState | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [compareTop, setCompareTop] = useState(false);
  const [topMod, setTopMod] = useState<typeof import("@/lib/coinMulti/topCoinMulti") | null>(null);
  const [topLoading, setTopLoading] = useState(false);

  const toggleTop = async () => {
    if (compareTop) {
      setCompareTop(false);
      return;
    }
    if (!topMod) {
      setTopLoading(true);
      try {
        setTopMod(await import("@/lib/coinMulti/topCoinMulti"));
      } finally {
        setTopLoading(false);
      }
    }
    setCompareTop(true);
  };

  const classKey = calcState?.classKey ?? null;
  const topBaseline = useMemo<Baseline | null>(() => {
    if (!compareTop || !topMod) return null;
    return {
      flatTree: topMod.topCoinFlatForClass(classKey) as FlatTree,
      capturedAt: Date.parse(TOP_COIN_GENERATED_AT),
      charName: `Observed Max (${TOP_COIN_PLAYERS_SCANNED} top players)`,
    };
  }, [compareTop, topMod, classKey]);

  const yoursFlat = useMemo<FlatTree | null>(
    () => (calcState?.coinTree ? flattenTree(calcState.coinTree) : null),
    [calcState?.coinTree]
  );

  const gainsTabs = useMemo<DeepViewExtraTab[]>(
    () => [
      {
        id: "biggest-gains",
        label: "💡 Biggest Gains",
        title: "Rank your coin sources by how much Coin Multi matching the top players would give",
        render: () => (
          <CoinBiggestGains yoursFlat={yoursFlat} classKey={classKey} computeError={calcState?.computeError ?? null} />
        ),
      },
    ],
    [yoursFlat, classKey, calcState?.computeError]
  );

  const compareBlock = (
    <button
      type="button"
      onClick={toggleTop}
      disabled={topLoading}
      className={`whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors disabled:opacity-50 ${
        compareTop
          ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
          : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
      }`}
      title="Compare every coin source against the best value observed across the top players"
    >
      🏅 {topLoading ? "Loading…" : compareTop ? "Comparing vs Observed Max" : "Compare vs Observed Max"}
    </button>
  );

  const snapshotBlock = (
    <div className="flex flex-col gap-3">
      <CoinSnapshotSection
        state={calcState}
        onSelectBaseline={(b) => {
          setBaseline(b);
          if (b) setCompareTop(false);
        }}
        selectedBaselineAt={baseline?.capturedAt ?? null}
        headerExtra={compareBlock}
      />
      <div className="text-center">
        <AnonExcludedNote>
          Anonymous players are excluded from the top-player comparison — anonymous profiles have no public
          save to compute from.
        </AnonExcludedNote>
      </div>
    </div>
  );

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <CoinCalculator
        onStateChange={setCalcState}
        compareBaseline={compareTop ? topBaseline : baseline}
        snapshotSlot={snapshotBlock}
        extraTabs={gainsTabs}
        extraTabsFirst
        defaultView="biggest-gains"
      />
      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Coin Multi is computed locally from your save — every term of the game&apos;s coin formula, group by group.
      </footer>
    </main>
  );
}
```

- [ ] **Step 5: Full suite + types — PASS.** No dev server; the page is checked on the Vercel preview in Task 12.

- [ ] **Step 6: Commit**

```bash
git add web/app/coin-multi/page.tsx web/app/coin-multi/CoinMultiPageClient.tsx web/components/TopNav.tsx web/app/page.tsx web/__tests__/components/TopNav.test.tsx web/e2e/homepage.spec.ts
git commit -m "feat(coin): /coin-multi page, nav item and home card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Validation against the game + PR

**Files:**
- Modify: `web/__tests__/lib/arkh/coin-multi.save.test.ts` (in-game case)

This task needs the user. The controller asks for one reading; implementers don't message the user.

- [ ] **Step 1: Controller — get one reading.** The game shows the value in the **Upgrade Vault → upgrade 2 "Monster Tax"**, on the line "Total Coin Bonus from all sources: …x". It is computed for the character that is logged in, on its current map (Ruling 6).
  - Ask the user, in pt-BR, for:
    - the logged-in character;
    - the map it is on;
    - the value on that line, exactly as shown.
  - At the same moment, fetch the signed-in save with the device flow. The script is `C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad/dr/fetch-save.mts`, and the user approves the login.
  - Store the save as `web/scripts/updater/golden/.cache/coin-ingame-YYYY-MM-DD.json` (gitignored).
  - The map index is the save's `CurrentMap_<charIdx>`. Check that it matches the map the user named.

- [ ] **Step 2: Add the in-game case** as a new `describe` at the end of `coin-multi.save.test.ts`. The four `INGAME` values come from Step 1.

```ts
// In-game reading (Upgrade Vault → Monster Tax → "Total Coin Bonus from all
// sources") on the save fetched at the same moment. The game shows ≤ 3–4
// significant digits, so the check compares formatCoinMulti's string.
const INGAME = { file: "scripts/updater/golden/.cache/coin-ingame-YYYY-MM-DD.json", char: "CharName", map: 0, shown: "0.00E0" };

describe.skipIf(!existsSync(INGAME.file))("Coin Multi matches the game's stat panel", () => {
  it(`${INGAME.char} on map ${INGAME.map} reads ${INGAME.shown}`, () => {
    const save = JSON.parse(readFileSync(INGAME.file, "utf8"));
    const { total } = computeArkhCoinMulti(save, save.charNames.indexOf(INGAME.char), INGAME.map);
    expect(formatCoinMulti(total)).toBe(INGAME.shown);
  });
});
```
(Add `import { formatCoinMulti } from "@/lib/coinMulti/format";`.)

- [ ] **Step 3: Run it — PASS.** If it fails:
  1. Rerun the IT cross-check on the new save (group by group).
  2. Fix any term that disagrees with N.js inside the coin folder.
  3. Repeat.

  Stop and report to the controller if no N.js-backed fix closes the gap.

- [ ] **Step 4: Final checks**
  - `npx vitest run`: all green, including `family-guy-dr.test.ts` (363,893.46) and the golden tests.
  - `npx tsc --noEmit -p tsconfig.json`: exit 0.
  - `git diff origin/main --stat -- web/components/dropRate web/lib/dropRate web/app/drop-rate web/scripts/update-top-dr.ts`: empty (DR untouched).

- [ ] **Step 5: Commit, push, open the PR** (no merge)

```bash
git add web/__tests__/lib/arkh/coin-multi.save.test.ts
git commit -m "test(coin): coin multi matches the game's stat panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/coin-multi-page
gh pr create --base main --head feat/coin-multi-page --title "feat: Coin Multi page (coin formula tracker)" --body-file "$SCRATCH/pr-body.md"
```

`$SCRATCH` is the session scratchpad. Write `pr-body.md` there first; it covers:
- the spec and plan links;
- the 22 + 1 group formula;
- the IT cross-check and its two documented gaps (w5b1, Measurement 13 miniboss skulls);
- the in-game reading;
- the untouched DR.

End the body with the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` line. Then check the Vercel preview (`/coin-multi` renders, no console errors) and report. Merge only when the user asks.
