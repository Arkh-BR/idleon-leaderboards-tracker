# EXP Multi Page + statTracker Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/exp-multi` "EXP Multi Tracker" — the character's Class EXP multiplier (N.js `ExpMulti(0)`) term by term with snapshots, Observed Max and Biggest Gains — on a generic `statTracker` page kit that Coin Multi also migrates to.

**Architecture:** Engine: a shared grouped-descriptor helper (`defs/grouped.ts`) + generic compute entry (`computeStat.ts`); EXP gets its descriptor (`defs/exp-multi.ts`) and system (`systems/exp/*`). UI: the Coin Multi page layers become a config-driven kit (`lib/statTracker/*`, `components/statTracker/*`); Biggest Gains becomes a generic what-if over the flat tree (`totalFromFlat`). Observed Max: a shared collector core (`scripts/_shared/topStatCollector.ts`) with per-stat configs; cron step added.

**Tech Stack:** Next.js 16 (app router), React, TypeScript, Tailwind, Vitest 2 + happy-dom + Testing Library, Playwright e2e (CI only), tsx scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-exp-multi-page-design.md` (decisions D1–D10 are binding).

## Global Constraints

- All commands run from `web/` inside `C:/Users/Vinicius/ClaudeCowork/Leaderboard Ranking Sheet - Idleon/.claude/worktrees/social-auth-game-save-sync-ea785d` on branch `feat/exp-multi-page`.
- **Never run `npm run dev` / `next dev`.** Verify with `npx vitest run <paths>`, `npx vitest run` (full) and `npx tsc --noEmit -p tsconfig.json`.
- Never read, print or commit `web/.env.local` or anything under `web/__tests__/fixtures/gameAuth/`.
- Private saves live only in `web/scripts/updater/golden/.cache/` (gitignored). Tests that read them use `describe.skipIf(!existsSync(SAVE))` and read the file in `beforeAll`. Never commit a save.
- Engine tests need the window shim at the top of the file: `const g = globalThis as unknown as { window?: unknown }; if (!g.window) g.window = g;`
- Site copy (UI strings) in English. Code comments in English, matching the density of the surrounding files.
- Stage only the files you changed (`git add <paths>`, never `git add -A` / `git add .`). Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push; the controller does.
- N.js is the source of truth. Local copy (26 MB — search it with small `node -e` scripts using `indexOf`/regex and print short slices; never `cat`/Read it whole): `C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad/dr/N.js`. Every EXP source case carries an `@njs` comment naming the N.js call it ports.
- IdleonToolbox (GPL) is a read-only cross-check oracle; never copy its code.
- **Zero behavior change for Drop Rate and Coin Multi**: numbers, localStorage keys, stored snapshots. These must stay green, unedited unless a task says so: `__tests__/lib/arkh/family-guy-dr.test.ts` (DR 363,893.46), `__tests__/lib/arkh/coin-multi.*`, `__tests__/components/accountSaveOverPaste.test.tsx`, and the full suite.
- `talent.resolve(id, …)` already returns the wrapped value (TalentCalc counters, pow wraps, account-wide max mode). Never multiply by a counter again.
- Save arrays may deserialize as objects with a `"length"` key; when iterating save arrays skip non-numeric keys.
- Only additive changes to shared engine helpers/tables (new exports, new indices); don't change what DR/Coin callers get.

## Reference data (read-only)

- Scratchpad root `SP` = `C:/Users/Vinicius/AppData/Local/Temp/claude/C--Users-Vinicius-ClaudeCowork-Leaderboard-Ranking-Sheet---Idleon--claude-worktrees-social-auth-game-save-sync-ea785d/65bdb217-1f21-4e77-a7dd-780edc26683c/scratchpad`
- `SP/exp/expfn.txt` — the verbatim N.js `ExpMulti` function (the `d==0` branch is everything before `if(999==d)`).
- `SP/exp/terms.md` — per-term inventory (N.js expression, arkh helper, status, IT name). It misses one term: `Spelunk("BigFishBonuses",4,0)` (G7 `bigFish4`, arkh `computeBigFishBonus(4, s)` in `stats/systems/w7/spelunking.ts`).
- `SP/exp/semantics.md` — medallion gate (D1), game display ladder (D2), getbonus2 semantics, lowest-level block, Coral Kid, Workbench, arcane slot 1.
- `SP/exp/it-exp.mts` + `SP/exp/it-exp-markhe.txt` — IT oracle runner and its output for Markhe. Re-run (from the MAIN checkout's `web/`, i.e. `C:/Users/Vinicius/ClaudeCowork/Leaderboard Ranking Sheet - Idleon/web`):
  `ORACLE="C:/Users/Vinicius/ClaudeCowork/Leaderboard Ranking Sheet - Idleon/web/scripts/updater/.cache/it-live" TSX_TSCONFIG_PATH=scripts/updater/.cache/it-live/tsconfig.json node --import tsx "SP/exp/it-exp.mts" "<save.json>" <CharName>`
- Validation save (private): `web/scripts/updater/golden/.cache/arkhe-live-2026-09-23.json` (Markhe = char index 8, saved map 14, `AFKtarget_8`="beanG"; Darkhe = index 4 is the account's lowest-level char).
- IT reference for Markhe on map 14: **total 1.4504214791708842e19**; product of IT's 30 multiplicative factors 6.043968439458388e13; implied additive factor (G10) **239978.33438403253**. IT's additive breakdown lines are NOT in consistent units (their sum ×100 misses the implied factor by ~57%) — use them only as hints; the G10 check is the implied factor.

## File structure

| File | Task | Responsibility |
|---|---|---|
| `web/lib/arkh/stats/defs/grouped.ts` | 1 | Group kinds, `groupFactorOf`, `neutralValue`, `groupNote`, `groupedDescriptor` |
| `web/lib/arkh/stats/defs/coin-multi.ts` | 1 | Coin groups on top of `grouped.ts` (exports unchanged) |
| `web/lib/arkh/computeStat.ts` | 1 | `statCtx`, `computeStatTree`, `computeStatPools`, `combineStatPools` |
| `web/lib/arkh/computeCoin.ts` | 1 | Thin wrappers (API unchanged) |
| `web/lib/arkh/stats/defs/exp-multi.ts` | 2 | `EXP_ROOT`, `EXP_GROUPS`, descriptor |
| `web/lib/arkh/stats/systems/exp/exp.ts` | 2–4 | `resolveExp` switch (one id per N.js term), `EXP_CLASS_TALENTS` |
| `web/lib/arkh/stats/systems/exp/*.ts` | 3–4 | New ports that need their own file (lowest-level, bubba, sticker, dancing coral, food, salt lick, MSA) |
| `web/lib/arkh/stats/registry.ts` | 2 | Register `exp` |
| `web/lib/arkh/computeExp.ts` | 2, 5 | `computeArkhExpMulti`, `computeArkhExpPools`, `combineExpPools`, `bestExpMapIdx` |
| `web/lib/expMulti/format.ts` | 5 | `formatExpMulti` (game display ladder) |
| `web/lib/statTracker/config.ts` | 6 | `StatPageConfig`, `GainsModel`, `GainSource`, `StatResult` |
| `web/lib/statTracker/storage.ts` | 6 | `createSnapshotStore` |
| `web/lib/statTracker/biggestGains.ts` | 6 | `computeGains`, `splitGains`, `groupedGainsModel` |
| `web/lib/statTracker/mapOptions.ts` | 6 | `buildStatMapOptions`, `worldOf` |
| `web/components/statTracker/{StatCalculator,StatSnapshotSection,StatBiggestGains,StatPageClient}.tsx` | 7 | Config-driven page kit |
| `web/scripts/_shared/topStatCollector.ts` | 8 | Shared Observed Max collector |
| `web/scripts/_shared/classGating.ts` | 8 | + `deriveGatedTalentsFor(ids)` |
| `web/scripts/update-top-exp.ts` | 8 | EXP collector config |
| `web/lib/expMulti/topExpMulti.ts` + `.meta.ts` | 8 | Generated Observed Max |
| `.github/workflows/refresh-top-max.yml` | 8 | Cron step |
| `web/lib/expMulti/pageConfig.ts`, `web/app/exp-multi/{page.tsx,ExpMultiPageClient.tsx}` | 9 | EXP page |
| `web/components/TopNav.tsx`, `web/app/page.tsx`, `web/e2e/homepage.spec.ts` | 9 | Navigation |
| `web/lib/coinMulti/pageConfig.ts`, `web/app/coin-multi/CoinMultiPageClient.tsx`, `web/scripts/update-top-coin.ts` | 10 | Coin on the kit |

---

### Task 1: Grouped descriptors + generic compute entry

**Files:**
- Create: `web/lib/arkh/stats/defs/grouped.ts`
- Modify: `web/lib/arkh/stats/defs/coin-multi.ts`
- Create: `web/lib/arkh/computeStat.ts`
- Modify: `web/lib/arkh/computeCoin.ts`
- Test: `web/__tests__/lib/arkh/grouped.test.ts` (new); existing `web/__tests__/lib/arkh/coin-multi.*.test.ts` must pass unchanged

**Interfaces:**
- Produces: `GroupKind`, `StatGroup`, `groupFactorOf(g, vals)`, `neutralValue(kind)`, `groupNote(g)`, `groupedDescriptor(opts)` from `@/lib/arkh/stats/defs/grouped`; `StatResult`, `statCtx(raw, ci, map)`, `computeStatTree(desc, raw, ci, map?)`, `computeStatPools(desc, raw, ci, map?)`, `combineStatPools(desc, pools)` from `@/lib/arkh/computeStat`.

- [ ] **Step 1: Write the failing test** — `web/__tests__/lib/arkh/grouped.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupFactorOf, groupedDescriptor, neutralValue, groupNote } from "@/lib/arkh/stats/defs/grouped";
import { combineStatPools } from "@/lib/arkh/computeStat";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const pool = (...vals: number[]): Pool => ({
  items: vals.map((v, i) => ({ name: `s${i}`, val: v })),
  sum: 0,
  product: 0,
});

describe("grouped descriptors", () => {
  it("computes each kind's factor", () => {
    expect(groupFactorOf({ kind: "pct" }, [30, 20])).toBe(1.5);
    expect(groupFactorOf({ kind: "raw" }, [0.25, 0.25])).toBe(1.5);
    expect(groupFactorOf({ kind: "min4" }, [3, 3])).toBe(5);
    expect(groupFactorOf({ kind: "mult" }, [2, 3, 1.5])).toBe(9);
    expect(groupFactorOf({ kind: "mult", max1: true }, [0.5, 1])).toBe(1);
    expect(groupFactorOf({ kind: "mult" }, [0.5, 1])).toBe(0.5);
    expect(groupFactorOf({ kind: "mult" }, [])).toBe(1);
    expect(groupFactorOf({ kind: "pct" }, [])).toBe(1);
  });

  it("treats NaN as the kind's neutral element", () => {
    expect(groupFactorOf({ kind: "pct" }, [NaN, 50])).toBe(1.5);
    expect(groupFactorOf({ kind: "mult" }, [NaN, 4])).toBe(4);
    expect(neutralValue("mult")).toBe(1);
    expect(neutralValue("pct")).toBe(0);
    expect(neutralValue("min4")).toBe(0);
  });

  it("notes each kind", () => {
    expect(groupNote({ kind: "pct" })).toBe("× (1 + Σ/100)");
    expect(groupNote({ kind: "raw" })).toBe("× (1 + Σ)");
    expect(groupNote({ kind: "min4" })).toBe("× (1 + min(4, Σ))");
    expect(groupNote({ kind: "mult" })).toBe("× Π");
    expect(groupNote({ kind: "mult", max1: true })).toBe("× max(1, Π)");
  });

  it("multiplies the groups in order and keeps the items", () => {
    const desc = groupedDescriptor({
      id: "t",
      name: "Test",
      scope: "character",
      category: "test",
      system: "none",
      groups: [
        { key: "a", name: "A", kind: "mult", max1: true, sources: ["x", "y"] },
        { key: "b", name: "B", kind: "pct", sources: ["z"] },
      ],
    });
    expect(desc.pools.a).toEqual([{ system: "none", id: "x" }, { system: "none", id: "y" }]);
    const r = combineStatPools(desc, { a: pool(2, 3), b: pool(50) });
    expect(r.total).toBe(9);
    expect(r.tree.name).toBe("Test");
    expect(r.tree.fmt).toBe("x");
    expect(r.tree.children![0]).toMatchObject({ name: "A", val: 6, fmt: "x", note: "× max(1, Π)" });
    expect(r.tree.children![1]).toMatchObject({ name: "B", val: 1.5, note: "× (1 + Σ/100)" });
    expect(r.tree.children![0].children).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run __tests__/lib/arkh/grouped.test.ts`
Expected: FAIL (cannot resolve `@/lib/arkh/stats/defs/grouped`).

- [ ] **Step 3: Implement `grouped.ts`**

```ts
// ===== GROUPED DESCRIPTORS =====
// Shared shape of the "product of groups" stat formulas (Coin Multi, EXP
// Multi, …): each group turns its sources into one factor and the stat is
// the product of the factors, in game order.
//   pct  → 1 + Σ/100      raw → 1 + Σ      min4 → 1 + min(4, Σ)
//   mult → Π(sources): each source is already a factor; max1 wraps the
//          product in max(1, ·) like N.js's Math.max(1, …) blocks.

import type { ArkhNode } from "../../node";
import type { Descriptor, SourceSpec } from "../tree-builder";

export type GroupKind = "pct" | "raw" | "min4" | "mult";

export type StatGroup = {
  key: string;
  name: string;
  kind: GroupKind;
  /** mult only: the game wraps the product in Math.max(1, ·). */
  max1?: boolean;
  sources: readonly string[];
};

/** A group's factor from its source values. NaN counts as the kind's neutral
 *  element (0 in a sum, 1 in a product), like the old `Number(v) || 0`. */
export function groupFactorOf(g: Pick<StatGroup, "kind" | "max1">, vals: readonly number[]): number {
  if (g.kind === "mult") {
    const p = vals.reduce((a, v) => a * (Number.isNaN(v) ? 1 : v), 1);
    return g.max1 ? Math.max(1, p) : p;
  }
  const sum = vals.reduce((a, v) => a + (Number(v) || 0), 0);
  if (g.kind === "pct") return 1 + sum / 100;
  if (g.kind === "raw") return 1 + sum;
  return 1 + Math.min(4, sum);
}

/** The value a zeroed (e.g. class-gated) source takes in a group of this kind. */
export function neutralValue(kind: GroupKind): number {
  return kind === "mult" ? 1 : 0;
}

export function groupNote(g: Pick<StatGroup, "kind" | "max1">): string {
  if (g.kind === "pct") return "× (1 + Σ/100)";
  if (g.kind === "raw") return "× (1 + Σ)";
  if (g.kind === "min4") return "× (1 + min(4, Σ))";
  return g.max1 ? "× max(1, Π)" : "× Π";
}

export function groupedDescriptor(opts: {
  id: string;
  name: string;
  scope: string;
  category: string;
  system: string;
  groups: readonly StatGroup[];
}): Descriptor {
  const pools: Record<string, SourceSpec[]> = {};
  for (const g of opts.groups) pools[g.key] = g.sources.map((id) => ({ system: opts.system, id }));
  return {
    id: opts.id,
    name: opts.name,
    scope: opts.scope,
    category: opts.category,
    pools,
    combine(p) {
      let total = 1;
      const children: ArkhNode[] = [];
      for (const g of opts.groups) {
        const items = p[g.key]?.items ?? [];
        const factor = groupFactorOf(g, items.map((it) => Number(it.val)));
        total *= factor;
        children.push({ name: g.name, val: factor, fmt: "x", note: groupNote(g), children: items });
      }
      return { val: total, children };
    },
  };
}
```

- [ ] **Step 4: Rebuild `coin-multi.ts` on it** — keep every export the tests and Coin UI use (`COIN_ROOT`, `COIN_GROUPS`, `CoinGroupKind`, `CoinGroup`, `groupFactor(kind, sum)`, default descriptor). Replace the body after `COIN_GROUPS` with:

```ts
export function groupFactor(kind: CoinGroupKind, sum: number): number {
  return groupFactorOf({ kind }, [sum]);
}

const coinMultiDesc: Descriptor = groupedDescriptor({
  id: "coin-multi",
  name: COIN_ROOT,
  scope: "character+map",
  category: "economy",
  system: "coin",
  groups: COIN_GROUPS,
});

export default coinMultiDesc;
```

and change the type block at the top to:

```ts
import type { Descriptor } from "../tree-builder";
import { groupedDescriptor, groupFactorOf, type StatGroup } from "./grouped";

export type CoinGroupKind = "pct" | "raw" | "min4";
export type CoinGroup = StatGroup & { kind: CoinGroupKind };
```

Delete the now-unused `KIND_NOTE`, the manual `pools` loop, the inline `combine` and the `ArkhNode`/`SourceSpec` imports. Keep the header comment.

- [ ] **Step 5: Create `computeStat.ts`**

```ts
// ===== GENERIC STAT ENTRY POINT =====
// Loads the save into the arkh state singleton and runs a grouped stat
// descriptor (Coin Multi, EXP Multi, …) for one character on one map.
// mapIdx is the selected map; afkTarget is the character's saved
// AFKtarget_N (Coin's talent 643 reads it).

import { loadSaveData } from "./save/loader";
import { saveData } from "./state";
import * as data from "./save/data";
import { buildTree, buildPools, type Descriptor, type Pool } from "./stats/tree-builder";
import { getCatalog, type SystemCtx } from "./stats/registry";
import type { ArkhNode } from "./node";

export type StatResult = { tree: ArkhNode; total: number };

export function statCtx(rawEnvelope: any, charIdx: number, mapIdx: number): SystemCtx {
  const afkTargetRaw = rawEnvelope?.data?.["AFKtarget_" + charIdx];
  const afkTarget = afkTargetRaw != null && afkTargetRaw !== "" ? String(afkTargetRaw) : undefined;
  return { saveData, charIdx, activeCharIdx: charIdx, mapBon: data.mapBonData, mapIdx, afkTarget };
}

export function computeStatTree(desc: Descriptor, rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  loadSaveData(rawEnvelope);
  const tree = buildTree(desc, getCatalog(), statCtx(rawEnvelope, charIdx, mapIdx));
  return { tree, total: tree.val };
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeStatPools(
  desc: Descriptor,
  rawEnvelope: any,
  charIdx: number,
  mapIdx: number = 0
): Record<string, Pool> {
  loadSaveData(rawEnvelope);
  return buildPools(desc, getCatalog(), statCtx(rawEnvelope, charIdx, mapIdx));
}

export function combineStatPools(desc: Descriptor, pools: Record<string, Pool>): StatResult {
  const r = desc.combine(pools, {} as never);
  return { tree: { name: desc.name, val: r.val, fmt: "x", children: r.children }, total: r.val };
}
```

- [ ] **Step 6: Make `computeCoin.ts` thin** (same exported names and signatures):

```ts
// ===== ARKH COIN MULTI ENTRY POINT =====
// mapIdx feeds the guild term (×(1 + ⌊map/50⌋)) and talent 643's multikill
// tier (OverkillStuffs, rescaled to the selected map). See computeStat.ts.

import coinMultiDesc from "./stats/defs/coin-multi";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export type ArkhCoinResult = StatResult;

export function computeArkhCoinMulti(rawEnvelope: any, charIdx: number, mapIdx: number = 0): ArkhCoinResult {
  return computeStatTree(coinMultiDesc, rawEnvelope, charIdx, mapIdx);
}

/** Pools without combine() — the Observed Max collector merges these across saves. */
export function computeArkhCoinPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(coinMultiDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineCoinPools(pools: Record<string, Pool>): ArkhCoinResult {
  return combineStatPools(coinMultiDesc, pools);
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run __tests__/lib/arkh/grouped.test.ts __tests__/lib/arkh/coin-multi.combine.test.ts __tests__/lib/arkh/coin-multi.smoke.test.ts __tests__/lib/arkh/coin-multi.save.test.ts __tests__/lib/coinMulti __tests__/components/CoinBiggestGains.test.tsx __tests__/components/CoinCalculator.keepView.test.tsx`
Expected: PASS (the save test runs locally because the private save exists; it must still show Markhe 6.88E35).
Then: `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 8: Commit**

```bash
git add lib/arkh/stats/defs/grouped.ts lib/arkh/stats/defs/coin-multi.ts lib/arkh/computeStat.ts lib/arkh/computeCoin.ts __tests__/lib/arkh/grouped.test.ts
git commit -m "refactor(arkh): shared grouped descriptors + generic stat entry point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: EXP descriptor, system and the multiplicative groups (G1–G9)

**Files:**
- Create: `web/lib/arkh/stats/defs/exp-multi.ts`
- Create: `web/lib/arkh/stats/systems/exp/exp.ts`
- Modify: `web/lib/arkh/stats/registry.ts` (import `exp`, add `exp: exp as unknown as SystemResolver` after `coin`)
- Create: `web/lib/arkh/computeExp.ts`
- Test: `web/__tests__/lib/arkh/exp-multi.smoke.test.ts`, `web/__tests__/lib/arkh/exp-multi.save.test.ts` (both new)

**Interfaces:**
- Consumes: `groupedDescriptor`, `StatGroup` (Task 1); `computeStatTree`, `computeStatPools`, `combineStatPools`, `StatResult` (Task 1).
- Produces: `EXP_ROOT = "EXP Multi"`, `EXP_GROUPS: readonly StatGroup[]`, default `expMultiDesc` from `@/lib/arkh/stats/defs/exp-multi`; `exp` system + `EXP_CLASS_TALENTS = [35] as const` from `@/lib/arkh/stats/systems/exp/exp`; `computeArkhExpMulti(raw, ci, map?) → StatResult`, `computeArkhExpPools(raw, ci, map?) → Record<string, Pool>`, `combineExpPools(pools) → StatResult` from `@/lib/arkh/computeExp`.

- [ ] **Step 1: Create the descriptor** `web/lib/arkh/stats/defs/exp-multi.ts` (complete — later tasks don't change the group list):

```ts
// ===== EXP MULTI DESCRIPTOR =====
// N.js x._customBlock_ExpMulti(0) (@4238487–@4247524): the character's Class
// EXP multiplier, the "Class EXP:" line of the stats panel. Every term is a
// source of the `exp` system (systems/exp/exp.ts); the group shapes live here.
//   EXP = Workbench × (1 + LUK3/100) × LUK5 × (1 + Etc78/100)
//         × (1 + LUKcurve·(1 + T35/100)/1.8 + Σ/100)
// LUK5 is split into G3–G8. G10 carries the LUK curve as two % sources
// (luk + talent35) so class gating can zero Lucky Charms alone.

import { groupedDescriptor, type StatGroup } from "./grouped";

export const EXP_ROOT = "EXP Multi";

export const EXP_GROUPS: readonly StatGroup[] = [
  { key: "g01", name: "🛠️ Workbench", kind: "mult", sources: ["workbench"] },
  { key: "g02", name: "🎁 Bundle + Superbit", kind: "pct", sources: ["bunQ", "superbit19"] },
  { key: "g03", name: "🏅 Shiny Medallions", kind: "mult", sources: ["medallion429"] },
  {
    key: "g04",
    name: "🐾 Companions · Jelly · Lab",
    kind: "mult",
    max1: true,
    sources: [
      "comp37", "comp33", "comp160", "comp32", "comp168", "comp34", "comp145", "jelly30",
      "jelly62", "comp128", "gridExp", "sticker0", "superbit63", "zenith9", "comp50",
    ],
  },
  { key: "g05", name: "🎽 Gear · Card · Arcade · Vial", kind: "mult", sources: ["etc84", "card100", "arcade60", "vialClassExp"] },
  { key: "g06", name: "⚔️ Slayer Abominator", kind: "mult", sources: ["talent434"] },
  {
    key: "g07",
    name: "🗺️ Arcane · Spelunk · Reef · Sets",
    kind: "mult",
    sources: [
      "arcane1", "bigFish4", "dancingCoral3", "coralKid", "cardSet12", "bubba6", "sushi15",
      "cloud70", "fountain16", "royalStatue3",
    ],
  },
  { key: "g08", name: "💎 Classy Discoveries", kind: "mult", sources: ["classy"] },
  { key: "g09", name: "🎽 Class EXP Equip", kind: "pct", sources: ["etc78"] },
  {
    key: "g10",
    name: "➕ Additive Pool",
    kind: "pct",
    sources: [
      "luk", "talent35", "etc4", "boxMonsterExp", "food", "starSignMainXP", "vialMonsterExp",
      "bubbleExp", "card44",
      // ExpGainLUK2
      "merit3", "vault12", "cardSet0", "mealClexp", "weeklyBoss", "newbie", "divMinor4", "cardSet5",
      "statue10", "talent632", "shrine5", "saltLick3", "prayer0", "prayer2", "prayer9", "flurbo2",
      "ach57", "ach357", "ach61", "ach124", "ach188", "arcade12", "sigil8", "ach286", "shiny1",
      "msa4", "talent55",
      // ExpGainLUK6 (with ExpGainLUK4 inside it, after the monument)
      "cardSpring", "comp3", "comp50add", "shimmer179", "goldFood", "owl0", "vote15", "monument1_6",
      "compass51", "hole47", "win23", "grimoire24", "vault3", "vault35", "hole83",
      "ironSet", "exotic50", "ola421", "stampClassxp", "friend1", "comp47", "comp111", "button8",
      "comp128add",
    ],
  },
];

const expMultiDesc = groupedDescriptor({
  id: "exp-multi",
  name: EXP_ROOT,
  scope: "character+map",
  category: "progression",
  system: "exp",
  groups: EXP_GROUPS,
});

export default expMultiDesc;
```

- [ ] **Step 2: Create `computeExp.ts`**

```ts
// ===== ARKH EXP MULTI ENTRY POINT =====
// mapIdx drives the two map terms: the arcane map bonus (slot 1) and whether
// the Shiny Medallions talent applies (the map's default monster's medallion).

import expMultiDesc from "./stats/defs/exp-multi";
import { computeStatTree, computeStatPools, combineStatPools, type StatResult } from "./computeStat";
import type { Pool } from "./stats/tree-builder";

export function computeArkhExpMulti(rawEnvelope: any, charIdx: number, mapIdx: number = 0): StatResult {
  return computeStatTree(expMultiDesc, rawEnvelope, charIdx, mapIdx);
}

export function computeArkhExpPools(rawEnvelope: any, charIdx: number, mapIdx: number = 0): Record<string, Pool> {
  return computeStatPools(expMultiDesc, rawEnvelope, charIdx, mapIdx);
}

export function combineExpPools(pools: Record<string, Pool>): StatResult {
  return combineStatPools(expMultiDesc, pools);
}
```

- [ ] **Step 3: Write the smoke test** `web/__tests__/lib/arkh/exp-multi.smoke.test.ts`:

```ts
// CI smoke test — no private save. Every EXP source must resolve on an empty
// envelope (the exp switch throws on unknown ids).
import { describe, it, expect } from "vitest";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

describe("EXP Multi smoke test", () => {
  it("computes every source on an empty save without throwing", () => {
    const { tree, total } = computeArkhExpMulti({ charNames: ["A"], data: {} }, 0, 14);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(tree.children).toHaveLength(EXP_GROUPS.length);
    tree.children!.forEach((grp, i) => expect(grp.children).toHaveLength(EXP_GROUPS[i].sources.length));
  });
});
```

- [ ] **Step 4: Write the save test (G1–G9 part)** `web/__tests__/lib/arkh/exp-multi.save.test.ts`. Harness (copy exactly), then the table below:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhExpMulti } from "@/lib/arkh/computeExp";
import { EXP_GROUPS } from "@/lib/arkh/stats/defs/exp-multi";
import type { ArkhNode } from "@/lib/arkh/node";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Signed-in save of ARKHE (2026-09-23 05:25 UTC, gitignored golden cache).
// Expected values = IdleonToolbox's live getClassExpMulti on this exact file
// for Markhe on map 14, unless a comment says N.js ≠ IT.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-09-23.json";

describe.skipIf(!existsSync(SAVE))("EXP Multi — Markhe on map 14 vs IdleonToolbox", () => {
  let tree: ArkhNode;
  let save: any;
  let markheIdx: number;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
    markheIdx = save.charNames.indexOf("Markhe");
    tree = computeArkhExpMulti(save, markheIdx, 14).tree;
  });

  const src = (id: string): number => {
    const gi = EXP_GROUPS.findIndex((x) => x.sources.includes(id));
    const si = EXP_GROUPS[gi].sources.indexOf(id);
    return Number(tree.children![gi].children![si].val);
  };
  const group = (key: string): number => Number(tree.children![EXP_GROUPS.findIndex((x) => x.key === key)].val);
  const close = (actual: number, expected: number) => {
    if (expected === 0) expect(actual).toBe(0);
    else expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);
  };

  it.each([
    ["workbench", () => src("workbench"), 1.2810767773188114],
    ["bundle + superbit group", () => group("g02"), 1.2],
    ["shiny medallions", () => src("medallion429"), 2.998997995991984],
    ["companion 37 (Panda, 1+9c)", () => src("comp37"), 10],
    ["companion 33", () => src("comp33"), 2],
    ["companion 160 (1+4c)", () => src("comp160"), 5],
    ["companion 32", () => src("comp32"), 2],
    ["companion 34", () => src("comp34"), 3],
    ["companion 128 (Baby Troll)", () => src("comp128"), 1.5],
    ["research grid", () => src("gridExp"), 1.8394750000000002],
    ["super bit 63", () => src("superbit63"), 1.1],
    ["zenith market 9", () => src("zenith9"), 1.76],
    ["companion 50 clamp", () => src("comp50"), 1.01],
    ["etc 84", () => src("etc84"), 2.4222944561555217],
    ["arcade 60", () => src("arcade60"), 2.0049751243781095],
    ["vial 7classexp", () => src("vialClassExp"), 1.5096],
    ["slayer abominator", () => src("talent434"), 3.698020324806719],
    ["arcane slot 1 (map 14)", () => src("arcane1"), 1],
    ["big fish 4", () => src("bigFish4"), 1.1789772727272727],
    ["coral kid ^ god rank", () => src("coralKid"), 64.8521248076352],
    ["card set 12", () => src("cardSet12"), 1],
    ["sushi 15", () => src("sushi15"), 1.25],
    ["equinox cloud 70", () => src("cloud70"), 1.05],
    ["fountain 16", () => src("fountain16"), 25.6],
    ["royal statue 3", () => src("royalStatue3"), 1],
    ["classy discoveries", () => src("classy"), 21.630739610601516],
    ["etc 78 (%)", () => src("etc78"), 1514.3679816528827],
  ])("%s", (_n, get, expected) => close(get(), expected));
});
```

Add one `it` per IT-absent term (`comp168`, `comp145`, `jelly30`, `jelly62`, `card100`) asserting the value you derive from N.js + the save (print the inputs once, write the number with a comment `// not in IT's breakdown — N.js <expr>, save <inputs>`).

- [ ] **Step 5: Run the tests to see them fail**

Run: `npx vitest run __tests__/lib/arkh/exp-multi.smoke.test.ts __tests__/lib/arkh/exp-multi.save.test.ts`
Expected: FAIL (`exp` system missing → `[exp] not implemented` items / unknown ids).

- [ ] **Step 6: Implement `systems/exp/exp.ts` — skeleton + G1–G9 cases**

Skeleton (the `pending` helper exists only until Task 4 removes it; Task 3 adds the G10 cases):

```ts
// ===== EXP SYSTEM =====
// One id per term of N.js x._customBlock_ExpMulti(0) (@4238487). Each case
// returns what its group consumes: a FACTOR in mult groups (G1, G3–G8), a
// % amount in pct groups (G2, G9, G10). defs/exp-multi.ts owns the shapes.
// Existing helpers are reused as-is; new ports live in this folder.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { optionsListData, currentMapData } from "../../../save/data";
import { superBitType } from "../../../game-helpers";
import { label } from "../../entity-names";
import { MapAFKtarget } from "../../data/game/customlists.js";
// …plus the helper imports each case below needs (see the table).

/** Class talents in the EXP formula (read from the active character).
 *  55/328/429/434 are account-wide (getbonus2), 632 is a star talent. */
export const EXP_CLASS_TALENTS = [35] as const;

const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });
const factor = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x", note });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
/** Terms ported in a later task of the EXP plan; neutral until then. */
const pending = (name: string, neutral: number): ArkhNode =>
  node(name, neutral, null, { fmt: neutral === 1 ? "x" : "+", note: "pending port" });

// @njs ExpMulti(0)
function resolveExp(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const tctx = { saveData: s, charIdx: ci, activeCharIdx: ci } as any;
  const ola = (i: number) => Number((optionsListData as any[])[i]) || 0;
  const savedMap = Number((currentMapData as any)?.[ci]) || 0;
  const map = ctx.mapIdx ?? savedMap;

  switch (id) {
    // cases from the tables below
    default:
      throw new Error(`exp: unknown source "${id}"`);
  }
}

export const exp = { resolve: resolveExp };
```

G1–G9 cases. `s` = saveData, `ci` = char index, `tctx` as above; "x" rows return `factor(...)`, "%" rows return `pct(...)`. Helper call forms are the ones `systems/coin/coin.ts` already uses (read it first). Verify every helper's actual signature before use.

| id | N.js | value | node name / children |
|---|---|---|---|
| `workbench` | `WorkbenchStuff("AdditionExtraEXPnDR",0,0)` | `workshop.resolve(undefined, tctx)` from `../common/wrappers` — return its node as-is (val = factor, 1.2811 on Markhe) | as returned |
| `bunQ` (%) | `1==BundlesReceived.bun_q → LUK3 += 20` | `Number((s.bundlesData as any)?.bun_q) === 1 ? 20 : 0` | `"EXP Bundle (bun_q)"`, child raw Owned |
| `superbit19` (%) | inside `Tasks[2][0][2] > 0` + lowest-level loop: `SuperBitType(19)==1 → LUK3 = 50` | `merit > 0 && isLowestLevel && superBitType(19, (s.gamingData as any)?.[12]) ? 50 : 0`, `merit = Number((s.tasksGlobalData as any)?.[2]?.[0]?.[2]) || 0` | `"Noobie Gains (Super Bit 19) · lowest-level character"`, children raw merit, raw lowest (1/0), raw bit |
| `medallion429` (x) | `GenINFO[17]==1 → LUK5 *= max(1, getbonus2(1,429,-1))` | `gate ? Math.max(1, Number(talent.resolve(429, tctx).val) \|\| 0) : 1`; `gate = medallionList(s).includes(String((MapAFKtarget as any)[map]))`. Put the reader in `systems/exp/medallions.ts` as `export function medallionList(s: any): string[]` returning `compassData[3]` (parse it if it's a JSON string; `[]` if missing) — Task 5 imports it. Spec D1: never read `AFKtarget_N` | `label("Talent", 429)`, children raw "Medallion owned (map's monster)", raw "Talent 429 (getbonus2)"; note `Map ${map} · ${monster}` |
| `comp37` | `(1+9·Companions(37))` | `1 + 9 * companions(37, s)` | `label("Companion", 37)` |
| `comp33` / `comp32` / `comp34` / `comp145` | `(1+Companions(n))` | `1 + companions(n, s)` | `label("Companion", n)` |
| `comp160` | `(1+4·Companions(160))` | `1 + 4 * companions(160, s)` | |
| `comp168` | `(1+.4·Companions(168))` | `1 + 0.4 * companions(168, s)` | |
| `jelly30` / `jelly62` | `(1+JellyOperation("RoG_BonusQTY",n,0)/100)` | `1 + jellyRoGBonus(n, s) / 100` (`stats/data/w7/jelly.ts`) | `"Jelly Operation n"` |
| `comp128` | `(1+(min(.5,Companions(128))+.25·CompLV2(128)))` | `1 + Math.min(0.5, companions(128, s)) + 0.25 * lv2`, `lv2` = N.js `CompLV2(128)` — read its definition in N.js and use the arkh equivalent (`s.companionLv2Ids?.has(128) ? 1 : 0` if CompLV2 returns 0/1) | `label("Companion", 128)` |
| `gridExp` | `(1+(Grid 130+131+132+152)/100)` | `1 + (gridBonusValue(130,s)+gridBonusValue(131,s)+gridBonusValue(132,s)+gridBonusValue(152,s)) / 100` | `"Research Grid (130·131·132·152)"`, 4 raw children |
| `sticker0` | `(1+FarmingStuffs("StickerBonus",0,0)/100)` | `pending("Sticker 0", 1)` — ported in Task 4 | |
| `superbit63` | `(1+.1·SuperBitType(63))` | `1 + 0.1 * superBitType(63, (s.gamingData as any)?.[12])` | `"Experienced Gamer (Super Bit 63)"` |
| `zenith9` | `(1+Thingies("ZenithMarketBonus",9,0)/100)` = `floor(ZenithMarket[9][4] · Spelunk[45][9])` (verify in N.js) | `1 + zen / 100` — `ZenithMarket` is already imported by `common/stats.ts`; `spelunkData[45][9]` is the level | `"Zenith Market 9"`, raw children |
| `comp50` | `max(1,min(1.01,1+Companions(50)/2500))` | `Math.max(1, Math.min(1.01, 1 + companions(50, s) / 2500))` | `label("Companion", 50)` |
| `etc84` | `(1+EtcBonuses("84")/100)` | `1 + Number(etcBonus.resolve(84, { saveData: s, charIdx: ci }).val) / 100`; keep the etc node as the only child | `"Class EXP multi gear (Etc 84)"` |
| `card100` | `(1+CardBonusREAL(100)/100)` | `1 + computeCardBonusByType(100, ci, s).val / 100` | `"Cards (Card Type 100)"` |
| `arcade60` | `(1+ArcadeBonus(60)/100)` | `1 + arcadeBonus(60, s).val / 100` | `label("Arcade", 60)` |
| `vialClassExp` | `(1+AlchVials["7classexp"]/100)` | `1 + computeVialByKey("7classexp", s).val / 100` | `"Class EXP vial (7classexp)"` |
| `talent434` | `pow(max(1,getbonus2(1,434,-1)), TotalTitanKills)` | `talent.resolve(434, tctx)`; its wrap already returns `pow(tv, titanKills)` and 1 when inactive — return `factor(r.name, Math.max(1, Number(r.val) \|\| 0), r.children)` | |
| `arcane1` | `(1+ArcaneType("ArcaneMapMulti_bon",1,0)/100)` | `1 + computeArcaneMapMultiBon(1, ctx as any) / 100` (`stats/systems/mc/tesseract.ts`; reads `ctx.mapBon[map][1]`; do NOT change `arcaneMap.resolve`) | `"Arcane map bonus (slot 1, EXP)"`, raw child kills `mapBon[map]?.[1]` |
| `bigFish4` | `(1+Spelunk("BigFishBonuses",4,0)/100)` | `1 + computeBigFishBonus(4, s) / 100` | `"Big Fish 4"` |
| `dancingCoral3` | `(1+Thingies("DancingCoralBonus",3,0)/100)` | `pending("Dancing Coral 3", 1)` — Task 4 | |
| `coralKid` | `pow(1+CoralKidUpgBonus(2)/100, max(0,Divinity[25]-10))` | `ck = 20*ola(429)/(25+ola(429))`, `rank = Math.max(0, (Number((s.divinityData as any)?.[25]) \|\| 0) - 10)`, value `Math.pow(1 + ck/100, rank)` | `"Coral Kid 2 ^ God Rank"`, raw ck, raw rank |
| `cardSet12` | `(1+CardSetBonuses(0,"12")/100)` | Port N.js `_customBlock_CardSetBonuses` semantics for key "12" (equipped set only vs any owned — read it; arkh `stats/systems/common/cards.ts` `cardSet` knows keys 5/6 via `CARD_SET_KEYS`; add key 12's bonus text there additively if the equipped-set model applies) | `"Card Set 12"` |
| `bubba6` | `(1+Bubbastuff("BubbaRoG_Bonuses",6,0)/100)` | `pending("Bubba RoG 6", 1)` — Task 4 | |
| `sushi15` | `(1+SushiStuff("RoG_BonusQTY",15,0)/100)` | `1 + Number(sushiRoG.resolve(15, ctx as any).val) / 100` | `"Sushi RoG 15"`, child = the sushi node |
| `cloud70` | `(1+5·Dreamstuff("CloudBonus",70)/100)` | value `1 + 5 * cloud / 100`; `cloud` = the unscaled CloudBonus(70) (read `cloudBonusSys` in `stats/systems/w3/equinox.ts` — DR passes `args:[5]` for the ×5; don't double it) | `"Equinox cloud 70 (×5)"` |
| `fountain16` | `(1+Holes2("Fountain_BonTOT",0,16)/100)` | `1 + fountainBonusTotal(0, 16, s) / 100` (check the helper's parameter order in `stats/data/w5/fountain.ts`) | `"Fountain 16"` |
| `royalStatue3` | `(1+RoyalG("StatueBon",3,0)/100)` | `1 + Number(royalStatue.resolve(3, ctx as any).val) / 100` | as label |
| `classy` | `max(1, pow(1.03,Spelunk[6].length)·SuperBitType(24)·(1+MeritocBonusz(27)/100)·(1+max(0,5·(OLA[464]-8))/100))` | `n` = count of numeric-keyed entries of `spelunkData[6]` (array length; skip a `"length"` key if it's an object); `Math.max(1, Math.pow(1.03, n) * superBitType(24, gaming12) * (1 + computeMeritocBonusz(27, s) / 100) * (1 + Math.max(0, 5 * (ola(464) - 8)) / 100))` | `"Classy Discoveries"`, raw children |
| `etc78` (%) | `EtcBonuses("78")` | `etcBonus.resolve(78, { saveData: s, charIdx: ci })` — return as-is | |

`isLowestLevel(ci, s)`: new tiny exported helper in `systems/exp/lowestLevel.ts`:

```ts
// N.js ExpMulti(0) merit block (@4239109): the active character's class level
// must be strictly below every other character's (a tie fails).
import { numCharacters } from "../../../save/data";

export function isLowestLevel(ci: number, s: any): boolean {
  const lv = (c: number) => Number((s.lv0AllData as any[])?.[c]?.[0]) || 0;
  for (let c = 0; c < numCharacters; c++) if (c !== ci && !(lv(ci) < lv(c))) return false;
  return true;
}
```

- [ ] **Step 7: Register the system** — in `registry.ts` add `import { exp } from "./systems/exp/exp";` and `exp: exp as unknown as SystemResolver,` after the `coin` entry.

- [ ] **Step 8: Run the tests** — both new files must pass; fix values by re-reading N.js, not by editing expectations (an expectation may change only with a `// N.js ≠ IT:` comment that cites the N.js offset).

Run: `npx vitest run __tests__/lib/arkh/exp-multi.smoke.test.ts __tests__/lib/arkh/exp-multi.save.test.ts __tests__/lib/arkh/family-guy-dr.test.ts __tests__/lib/arkh/coin-multi.save.test.ts`
Expected: PASS. Then `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 9: Commit**

```bash
git add lib/arkh/stats/defs/exp-multi.ts lib/arkh/stats/systems/exp/ lib/arkh/stats/registry.ts lib/arkh/computeExp.ts __tests__/lib/arkh/exp-multi.smoke.test.ts __tests__/lib/arkh/exp-multi.save.test.ts
# plus any shared helper you extended additively (e.g. cards.ts CARD_SET_KEYS)
git commit -m "feat(arkh): EXP Multi descriptor and its multiplicative groups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: EXP additive pool (G10)

**Files:**
- Modify: `web/lib/arkh/stats/systems/exp/exp.ts` (G10 cases)
- Create (if needed): `web/lib/arkh/stats/systems/exp/compass.ts` (CompassBonus 51)
- Modify additively (if needed): the `holes` data for B_UPG 47/83, `computeBoxReward` key lookup, and export a `votingMulti(ctx)` helper extracted from `systems/coin/coin.ts` case `vote34` (move the inline multi into an exported function and call it from `vote34` — identical math)
- Test: `web/__tests__/lib/arkh/exp-multi.save.test.ts` (append), `web/__tests__/lib/arkh/exp-multi.smoke.test.ts` (unchanged, must pass)

**Interfaces:**
- Consumes: Task 2's `resolveExp` skeleton, `pct`, `pending`, `isLowestLevel`.
- Produces: every G10 source except `food`, `saltLick3`, `msa4` (pending until Task 4).

- [ ] **Step 1: Append failing expectations** to the save test, inside the same `describe`:

```ts
  it("LUK curve (IT expGainLUK 1.1960144856908386) → 100·curve/1.8", () =>
    close(src("luk"), (100 * 1.1960144856908386) / 1.8));
  it("Lucky Charms is not on Markhe's class", () => expect(src("talent35")).toBe(0));
  it("lowest-level block is off for Markhe (highest level)", () => {
    expect(src("merit3")).toBe(0);
    expect(src("vault12")).toBe(0);
  });
  it("newbie bracket is off past level 50", () => expect(src("newbie")).toBe(0));
  it("prayer 9 enters as a negative (its curse)", () => expect(src("prayer9")).toBeLessThanOrEqual(0));
```

and, for every other G10 id, an `it.each` row asserting the value you compute from N.js for this save (print each input once and cite it in a comment). Where IT's breakdown clearly names the same term in the same unit, assert equality with IT (e.g. `etc4` = IT "% Xp From Monsters" Equipment + Gallery + Hat Rack = `2404.0653248235207`).

- [ ] **Step 2: Run to see failures** — `npx vitest run __tests__/lib/arkh/exp-multi.save.test.ts` → FAIL (unknown G10 ids).

- [ ] **Step 3: Implement the G10 cases.** All are % amounts (`pct(...)`). Call forms follow `systems/coin/coin.ts`:

| id | N.js | value |
|---|---|---|
| `luk` | `ExpGainLUK·(1+T35/100)/1.8` part 1 | `LUK = Number((s.statList as any)?.[ci]?.[3]) \|\| 0` (PVStatList LUK = TotalStats("LUK"), same field DR's `lukScaling` reads); `curve = LUK < 1e3 ? (Math.pow(LUK + 1, 0.37) - 1) / 30 : 0.8 * ((LUK - 1e3) / (LUK + 2500)) + 0.3963`; value `100 * curve / 1.8`. Export `expLukCurve(luk)` from `systems/exp/exp.ts` for reuse. Children: raw "Total LUK", raw "EXP LUK curve" |
| `talent35` | part 2 | `curve * t35 / 1.8`, `t35 = Number(talent.resolve(35, tctx).val) \|\| 0`; name `label("Talent", 35)` (must end with "(Talent 35)" — class gating matches it) |
| `etc4` | `EtcBonuses("4")` | `etcBonus.resolve(4, { saveData: s, charIdx: ci })` |
| `boxMonsterExp` | `BoxRewards.monsterExp` | `computeBoxReward(ci, KEY).val` — find KEY: the Post Office box/slot whose reward key is `monsterExp` (N.js BoxRewards assignment; IT: Box of Unwanted Stats, slot 2) |
| `food` | `TotalFoodBonuses("ClassEXP")` | `pending("Food (ClassEXP)", 0)` — Task 4 |
| `starSignMainXP` | `StarSigns.MainXP` | `computeStarSignBonus("MainXP", …)` (`stats/systems/common/starSign.ts`; key already in `SIGN_BONUSES`) |
| `vialMonsterExp` | `AlchVials.MonsterEXP` | `computeVialByKey("MonsterEXP", s).val` |
| `bubbleExp` | `AlchBubbles.expACTIVE` | `bubbleValByKey("expACTIVE", ci, s)` — verify the key string exists in `AlchemyDescription` (N.js); if the live key differs, use the live one |
| `card44` | `CardBonusREAL(44)` | `computeCardBonusByType(44, ci, s).val` |
| `merit3` | `3·Tasks[2][0][2]` (inside the lowest-level block) | `merit > 0 && isLowestLevel(ci, s) ? 3 * merit : 0` |
| `vault12` | `VaultUpgBonus(12)` (same block) | `merit > 0 && isLowestLevel(ci, s) ? vaultUpgBonus(12, s) : 0` |
| `cardSet0` | `Lv0<50 → CardSetBonuses(0,"0")` | same semantics you settled for `cardSet12` in Task 2, key "0", gated `level < 50` |
| `mealClexp` | `Lv0<120 → MealBonus("Clexp")` | `level < 120 ? computeMealBonus("Clexp", s).val : 0` |
| `weeklyBoss` | `hasOwnProperty(WeeklyBoss,"c") → min(150, WeeklyBoss.c)` | `Math.min(150, Number((s.weeklyBossData as any)?.c) \|\| 0)` when the key exists, else 0 |
| `newbie` | `Lv0<10 ? 150 : Lv0<30 ? 100 : Lv0<50 ? 50` | as written, `level = lv0AllData[ci][0]` |
| `divMinor4` | `Divinity("Bonus_Minor", activeIdx, 4)` | `divinityMinorSum(4, ci, s)` (`systems/coin/divinityMinor.ts`) |
| `cardSet5` | `CardSetBonuses(0,"5")` | `cardSet.resolve(5, ctx as any)` (same as the DR descriptor) |
| `statue10` | `ArbitraryCode("StatueBonusGiven10")` | `computeStatueBonusGiven(10, ci, s)` (no ÷100 here) |
| `talent632` | `GetTalentNumber(1,632)` | `talent.resolve(632, tctx)` — confirm it routes through the star-talent branch (value 19.726 on Markhe) |
| `shrine5` | `Shrine(5)` | `computeShrine(5, s)` (`stats/systems/w3/construction.ts`; shrines treated as global, spec D8) |
| `saltLick3` | `SaltLick(3)` | `pending("Salt Lick 3", 0)` — Task 4 |
| `prayer0` / `prayer2` | `prayersReal(n,0)` | `computePrayerReal(n, 0, ci, s)` |
| `prayer9` | `−prayersReal(9,1)` | `-computePrayerReal(9, 1, ci, s).val` (the curse column) |
| `flurbo2` | `FlurboShop(2)` | same 4 lines as coin's `flurbo4` with index 2 |
| `ach57` `ach357` `ach61` `ach124` `ach188` `ach286` | `AchieveStatus(n)` × 1/20/3/2/5/25 | `w * achieveStatus(n, s)` |
| `arcade12` | `ArcadeBonus(12)` | `arcadeBonus(12, s)` |
| `sigil8` | `Labb("SigilBonus","Blank",8,0)` | `sigilBonus(8, s)` (`stats/systems/w2/alchemy.ts`) |
| `shiny1` | `Breeding("ShinyBonusS","Nah",1,-1)` | `computeShinyBonusS(1, s)` |
| `msa4` | `GamingStatType("MSA_Bonus",4,0)` | `pending("MSA 4", 0)` — Task 4 |
| `talent55` | `getbonus2(1,55,-1)` | `talent.resolve(55, tctx)` (account-wide max mode; 245.20 on Markhe) |
| `cardSpring` | `2·CardLv("springEvent1")` | `2 * computeCardLv("springEvent1", s)` |
| `comp3` / `comp47` / `comp111` / `comp50add` / `comp128add` | `Companions(n)` | `companions(n, s)` |
| `shimmer179` | `OLA[179]·AllShimmerBonuses(0)` | `ola(179) * computeAllShimmerBonuses(s)` |
| `goldFood` | `GoldFoodBonuses("ClassEXPz")` | `goldFoodBonuses("ClassEXPz", ci, undefined, s).total` |
| `owl0` | `Summoning("OwlBonuses",0,0)` | `owl.resolve(0, ctx as any)` (`stats/systems/w1/owl.ts`) |
| `vote15` | `Summoning("VotingBonusz",15,0)` | `votingBonusz(15, votingMulti(ctx), s)` with the extracted `votingMulti` |
| `monument1_6` | `Holes("MonumentROGbonuses",1,6)` | `computeMonumentROGbonus(1, 6, s)` (check the parameter order) |
| `compass51` | `Windwalker("CompassBonus",51,0)` = `Compass[0][51]·CompassUpg[51][5]` (+ the `CompassUpg[51][9]==1` branch — read N.js) | port in `systems/exp/compass.ts` as `compassBonus(idx, s)`; `compassData[0]` levels, `stats/data/common/compass.ts` for the upgrade table |
| `hole47` / `hole83` | `Holes("B_UPG",47,0)` / `Holes("B_UPG",83,40)` | the `holes` system (DR uses ids 46/82) — confirm 47 and 83 exist in its data table; add them additively from N.js if not; note the third argument 40 for 83 |
| `win23` | `ExpMulti(999)` = `Summoning("WinBonus",23,0)` | `computeWinBonus(23, null, s)` |
| `grimoire24` | `Summoning("GrimoireUpgBonus",24,0)` | `grimoireUpgBonus(24, s)` (check its signature) |
| `vault3` | `VaultUpgBonus(3)` | `vaultUpgBonus(3, s)` |
| `vault35` | `VaultUpgBonus(35)·getLOG(OLA[345])` | like coin's `vault17` with 35/345 |
| `ironSet` | `GetSetBonus("IRON_SET","Bonus",0,0)` | `getSetBonus("IRON_SET")` |
| `exotic50` | `FarmingStuffs("ExoticBonusQTY",50,0)` | `computeExoticBonus(50, s)` — compare with N.js's ExoticBonusQTY loop for idx 50 first |
| `ola421` | `OLA[421]` | `ola(421)` |
| `stampClassxp` | `StampBonusOfTypeX("classxp")` | `computeStampBonusOfTypeX("classxp", s)` |
| `friend1` | `Thingies("FriendBonusStatz",1,0)` | `friend.resolve(1, { saveData: s })` |
| `button8` | `Minehead("Button_Bonuses",8,0)` | `computeButtonBonus(8, s)` |

- [ ] **Step 4: Run** — `npx vitest run __tests__/lib/arkh/exp-multi.save.test.ts __tests__/lib/arkh/exp-multi.smoke.test.ts __tests__/lib/arkh/coin-multi.save.test.ts __tests__/lib/arkh/family-guy-dr.test.ts` → PASS; `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 5: Commit**

```bash
git add lib/arkh/stats/systems/exp/ lib/arkh/stats/systems/coin/coin.ts __tests__/lib/arkh/exp-multi.save.test.ts
# plus any shared data file you extended additively
git commit -m "feat(arkh): EXP Multi additive pool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The six new ports — Sticker, Dancing Coral, Bubba RoG, Food, Salt Lick, MSA

**Files:**
- Create: one file per port under `web/lib/arkh/stats/systems/exp/` (`sticker.ts`, `dancingCoral.ts`, `bubba.ts`, `food.ts`, `saltLick.ts`, `msa.ts`)
- Modify: `web/lib/arkh/save/loader.ts` + `web/lib/arkh/state.ts` (additive: new save keys you need, e.g. `TowerInfo`, Bubba's key)
- Modify: `web/lib/arkh/stats/systems/exp/exp.ts` (replace the six `pending(...)` cases; delete the `pending` helper)
- Test: `web/__tests__/lib/arkh/exp-multi.save.test.ts` (append), `web/__tests__/lib/arkh/exp-multi.smoke.test.ts`

**Interfaces:**
- Consumes: Task 2/3 cases.
- Produces: a complete EXP tree (no `pending port` notes anywhere).

For each port: read the N.js function (search `_customBlock_<Name>=function` and the named branch), port it literally into its file with `@njs` offsets, wire the case, and assert it against IT where IT has it:

| id | N.js | IT (Markhe, map 14) |
|---|---|---|
| `sticker0` (x) | `FarmingStuffs("StickerBonus",0,0)` = `(1+(Grid_Bonus(68,2)+30·EventShopOwned(37))/100)·(1+20·SuperBitType(62)/100)·Research[9][0]·CustomLists.Research[25][0]` (confirm) | factor 7.6624 |
| `dancingCoral3` (x) | `Thingies("DancingCoralBonus",3,0)` = `DancingCoralBonus(3,999)·max(0, TowerInfo[21]−200)`, base `Spelunky[24][3]` (confirm) | factor 5.4 |
| `bubba6` (x) | `Bubbastuff("BubbaRoG_Bonuses",6,0)` (uses `MegafleshOwned`, `Companions(51)`, …; read the whole branch — `systems/coin/coin.ts` case `roo6` shows how OLA-based "megaflesh"-style counters are read) | factor 4.024 |
| `food` (%) | `TotalFoodBonuses("ClassEXP")` (the character's equipped normal food; not golden food) | 0 |
| `saltLick3` (%) | `SaltLick(3)` (SaltLicks customlist + the save's salt-lick levels) | 0.2 in IT's (inconsistent) unit — verify from N.js |
| `msa4` (%) | `GamingStatType("MSA_Bonus",4,0)` — reads `PixelHelperActor[8]` behavior `ActorEvents_481._GenINFO[114+]`. Find where that `_GenINFO` is filled on load and port it if it derives from the save (IT has `account.msaTotalizer.classExp`). If it can't be derived from the save: return 0 with a note "not derivable from the save" and document it in the test (spec D7) | 1.7808 in IT's unit |

- [ ] **Step 1: Append failing expectations** (one per port, IT numbers above where the unit is unambiguous; for `food`, `saltLick3`, `msa4` compute from N.js + save and cite inputs). Add the two whole-formula checks:

```ts
  it("additive pool matches IT's implied factor (total ÷ Π IT factors)", () =>
    close(group("g10"), 239978.33438403253));
  it("total matches IdleonToolbox", () => close(tree.val, 1.4504214791708842e19));
  it("no source is left unported", () => {
    const notes: string[] = [];
    const walk = (n: ArkhNode) => { if (n.note === "pending port") notes.push(n.name); n.children?.forEach(walk); };
    walk(tree);
    expect(notes).toEqual([]);
  });
```

If a documented N.js ≠ IT difference moves the group/total, replace the expected number with the N.js-correct one and add a `// N.js ≠ IT:` comment naming the term, both values and the N.js offset (as `coin-multi.save.test.ts` does).

- [ ] **Step 2: Run to see failures**, **Step 3: Implement the ports**, **Step 4: Run** `npx vitest run __tests__/lib/arkh` and `npx tsc --noEmit -p tsconfig.json` → PASS/clean.

- [ ] **Step 5: Commit**

```bash
git add lib/arkh/stats/systems/exp/ lib/arkh/save/loader.ts lib/arkh/state.ts __tests__/lib/arkh/exp-multi.save.test.ts
git commit -m "feat(arkh): port Sticker, Dancing Coral, Bubba RoG, Food, Salt Lick and MSA for EXP Multi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Game display format, best map, and scenario checks

**Files:**
- Create: `web/lib/expMulti/format.ts`
- Modify: `web/lib/arkh/computeExp.ts` (add `bestExpMapIdx`)
- Test: `web/__tests__/lib/expMulti/format.test.ts` (new), `web/__tests__/lib/arkh/exp-multi.save.test.ts` (append a second `describe`)

**Interfaces:**
- Produces: `formatExpMulti(v: number): string` (no trailing "x"); `bestExpMapIdx(rawEnvelope: any, charIdx: number): number`.

- [ ] **Step 1: Failing format test** `web/__tests__/lib/expMulti/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatExpMulti } from "@/lib/expMulti/format";

// N.js ActorEvents_29._event_PlayerInfo (@6665695): the "Class EXP:" line.
describe("formatExpMulti (the stats panel's Class EXP line)", () => {
  it.each([
    [1.4504214791708842e19, "14504214T"],
    [3.4e15, "3400T"],
    [3.405e14, "340.5T"],
    [3.4059e13, "34.05T"],
    [2.5e9, "2500M"],
    [2.503e8, "250.3M"],
    [2.5039e7, "25.03M"],
    [123456.9, "123456"],
    [5, "5.00"],
    [5.5, "5.50"],
    [12.3049, "12.3"],
    [12.346, "12.35"],
    // 100 × 12.345 is 1234.4999… in floats; the game's JS rounds it down too.
    [12.345, "12.34"],
  ])("%s → %s", (v, s) => expect(formatExpMulti(v)).toBe(s));

  it("prints a dash for a non-finite value", () => expect(formatExpMulti(NaN)).toBe("—"));
});
```

- [ ] **Step 2: Run** `npx vitest run __tests__/lib/expMulti/format.test.ts` → FAIL.

- [ ] **Step 3: Implement** `web/lib/expMulti/format.ts`:

```ts
// The game's own display of ExpMulti(0) on the stats panel ("Class EXP:",
// N.js ActorEvents_29._event_PlayerInfo @6665695). Truncates, never rounds,
// above 1e3; only M and T units (the M/T glyphs are inferred from fonts 251
// and 244 — see the spec's D2). Returns the text without the trailing "x".
export function formatExpMulti(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e15) return `${Math.floor(v / 1e12)}T`;
  if (v >= 1e14) return `${Math.floor(v / 1e11) / 10}T`;
  if (v >= 1e13) return `${Math.floor(v / 1e10) / 100}T`;
  if (v >= 1e9) return `${Math.floor(v / 1e6)}M`;
  if (v >= 1e8) return `${Math.floor(v / 1e5) / 10}M`;
  if (v >= 1e7) return `${Math.floor(v / 1e4) / 100}M`;
  if (v >= 1e3) return `${Math.floor(v)}`;
  if ((10 * v) % 10 === 0) return `${Math.round(v)}.00`;
  if ((100 * v) % 10 === 0) return `${Math.round(10 * v) / 10}0`;
  return `${Math.round(100 * v) / 100}`;
}
```

- [ ] **Step 4: Best map** — append to `computeExp.ts`:

```ts
import { loadSaveData } from "./save/loader";
import { statCtx } from "./computeStat";
import { MapAFKtarget } from "./stats/data/game/customlists.js";
import { computeArcaneMapMultiBon } from "./stats/systems/mc/tesseract";
import { talent } from "./stats/systems/common/talent";
import { saveData } from "./state";

/** Spec D5: the map that maximises the two map terms — arcane slot 1 ×
 *  Shiny Medallions (owned medallion of the map's default monster). Ties →
 *  the lowest index. The Observed Max collector measures each char here. */
export function bestExpMapIdx(rawEnvelope: any, charIdx: number): number {
  loadSaveData(rawEnvelope);
  const s: any = saveData;
  const ctx = statCtx(rawEnvelope, charIdx, 0);
  const t429 = Math.max(1, Number(talent.resolve(429, { saveData: s, charIdx, activeCharIdx: charIdx } as any).val) || 0);
  const medals = medallionList(s);
  let best = 0;
  let bestScore = -Infinity;
  const targets = MapAFKtarget as unknown as string[];
  for (let m = 0; m < targets.length; m++) {
    const arcane = computeArcaneMapMultiBon(1, { ...ctx, mapIdx: m } as any);
    const score = (1 + arcane / 100) * (medals.includes(String(targets[m])) ? t429 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
```

Import `medallionList` from `./stats/systems/exp/medallions` (created in Task 2) — don't duplicate the reader.

- [ ] **Step 5: Scenario checks** — append to `exp-multi.save.test.ts`:

```ts
describe.skipIf(!existsSync(SAVE))("EXP Multi — scenarios on the ARKHE save", () => {
  let save: any;
  beforeAll(() => {
    save = JSON.parse(readFileSync(SAVE, "utf8"));
  });
  const srcOf = (tree: ArkhNode, id: string): number => {
    const gi = EXP_GROUPS.findIndex((x) => x.sources.includes(id));
    return Number(tree.children![gi].children![EXP_GROUPS[gi].sources.indexOf(id)].val);
  };

  it("Darkhe (strictly lowest level) gets the merit block and Noobie Gains", () => {
    const t = computeArkhExpMulti(save, save.charNames.indexOf("Darkhe"), 14).tree;
    expect(srcOf(t, "merit3")).toBe(36); // merit W1#3 at level 12 × 3
    expect(srcOf(t, "superbit19")).toBe(50);
    expect(srcOf(t, "vault12")).toBeGreaterThan(0); // Baby on Board (236.4 per the semantics notes)
  });

  it("a town has no Shiny Medallions bonus", () => {
    const t = computeArkhExpMulti(save, save.charNames.indexOf("Markhe"), 0).tree;
    expect(srcOf(t, "medallion429")).toBe(1);
  });

  it("the best map scores at least as high as every other map", () => {
    const ci = save.charNames.indexOf("Markhe");
    const best = bestExpMapIdx(save, ci);
    const at = (m: number) => {
      const t = computeArkhExpMulti(save, ci, m).tree;
      return srcOf(t, "arcane1") * srcOf(t, "medallion429");
    };
    const bestScore = at(best);
    for (const m of [0, 1, 14, 24, 110, 162, 258, 261, 262, 301]) expect(bestScore).toBeGreaterThanOrEqual(at(m) - 1e-12);
  });

  it("the page total prints like the game", () => {
    const t = computeArkhExpMulti(save, save.charNames.indexOf("Markhe"), 14).tree;
    expect(formatExpMulti(t.val)).toBe("14504214T"); // IT total 1.4504214791708842e19; update with a comment if the N.js-correct total differs
  });
});
```

(add `import { bestExpMapIdx } from "@/lib/arkh/computeExp";` and `import { formatExpMulti } from "@/lib/expMulti/format";` at the top.)

- [ ] **Step 6: Run** `npx vitest run __tests__/lib/expMulti __tests__/lib/arkh/exp-multi.save.test.ts` → PASS; `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 7: Commit**

```bash
git add lib/expMulti/format.ts lib/arkh/computeExp.ts lib/arkh/stats/systems/exp/ __tests__/lib/expMulti/format.test.ts __tests__/lib/arkh/exp-multi.save.test.ts
git commit -m "feat(exp): game display format, best EXP map, scenario checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Kit library — config, storage, what-if Biggest Gains, map options

**Files:**
- Create: `web/lib/statTracker/config.ts`, `web/lib/statTracker/storage.ts`, `web/lib/statTracker/biggestGains.ts`, `web/lib/statTracker/mapOptions.ts`
- Test: `web/__tests__/lib/statTracker/storage.test.ts`, `web/__tests__/lib/statTracker/biggestGains.test.ts`, `web/__tests__/lib/statTracker/mapOptions.test.ts` (new)

**Interfaces:**
- Consumes: `StatGroup`, `groupFactorOf` (Task 1); `FlatTree` from `@/lib/dropRate/treeFlatten`; `listCharacters` from `@/lib/dropRate/extract`; `MAP_NAMES` from `@/lib/dropRate/mapNames`.
- Produces (exact names used by Tasks 7–10):
  - `config.ts`: `StatResult`, `GainDisplay`, `GainSource`, `GainsModel`, `TopModule`, `StatPageConfig`.
  - `storage.ts`: `StatSnapshot`, `SnapshotStore`, `createSnapshotStore(storageKey, exportLabel, legacyValueKey?)`.
  - `biggestGains.ts`: `MINOR_GAIN_THRESHOLD_PCT`, `GainRow`, `computeGains(model, yoursFlat, refFlat)`, `splitGains(rows, threshold?)`, `groupedGainsModel(root, groups)`.
  - `mapOptions.ts`: `StatMapOption`, `worldOf(mapIdx)`, `buildStatMapOptions(save)`.

- [ ] **Step 1: `config.ts`** (types only):

```ts
// The per-stat configuration the statTracker kit (components/statTracker/*)
// renders a whole page from: copy, storage keys, the engine entry point, the
// game's number format, the Biggest Gains model and the Observed Max loader.

import type { ArkhNode } from "@/lib/arkh/node";

export type StatResult = { tree: ArkhNode; total: number };

/** How a source value reads in the Biggest Gains table. */
export type GainDisplay = "pct" | "x" | "raw";

export type GainSource = { path: string; group: string; source: string; display: GainDisplay };

/** What-if engine: Biggest Gains swaps one source for the Observed Max and
 *  asks the stat for its new total. */
export type GainsModel = {
  sources(yoursFlat: Record<string, number>, refFlat: Record<string, number>): GainSource[];
  totalFromFlat(flat: Record<string, number>): number;
};

/** The generated Observed Max module (lib/<stat>/top*.ts), lazy-loaded. */
export type TopModule = { flatForClass(classKey: string | null): Record<string, number> };

export type StatPageConfig = {
  /** Stat name in copy: "Coin Multi", "EXP Multi". */
  statName: string;
  /** Short label for the gain column: "Coin" → "Coin gain". */
  gainLabel: string;
  emoji: string;
  /** Calculator heading after the emoji, e.g. "Coin Multi Calculator". */
  calculatorTitle: string;
  subtitle: string;
  /** Label next to the headline number, e.g. "Total Coin Multi". */
  totalLabel: string;
  /** Tooltip of the map selector. */
  mapTitle: string;
  /** Prefix of compute error messages, e.g. "Coin multi compute failed". */
  errPrefix: string;
  storage: {
    /** Last pasted save. */
    save: string;
    /** Player name for ProfileNameLoader. */
    name: string;
    /** Snapshot store. */
    snapshots: string;
    /** Snapshot section collapse flag. */
    collapse: string;
    /** Field an older release stored the snapshot value under (Coin: "computedCoinMulti"). */
    legacyValueKey?: string;
    /** Download name prefix, e.g. "coin-multi-snapshots". */
    exportPrefix: string;
    /** Name in the import error, e.g. "coin-multi-tracker". */
    exportLabel: string;
  };
  compute(save: unknown, charIdx: number, mapIdx: number): Promise<StatResult>;
  /** The game's own text for the headline number (without the trailing "x"). */
  formatTotal(x: number): string;
  gains: GainsModel;
  loadTop(): Promise<TopModule>;
  topMeta: { generatedAt: string; playersScanned: number };
  methodologyNote: string;
  compareTitle: string;
  gainsTabTitle: string;
  footer: string;
};
```

- [ ] **Step 2: Failing tests.** `web/__tests__/lib/statTracker/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createSnapshotStore, type StatSnapshot } from "@/lib/statTracker/storage";

const store = createSnapshotStore("test-stat-tracker.v1", "test-stat-tracker");
const legacy = createSnapshotStore("coin-multi-tracker.v1", "coin-multi-tracker", "computedCoinMulti");
const snap = (charName: string, capturedAt: number, value = 2): StatSnapshot => ({
  capturedAt, saveUpdatedAt: null, charIndex: 0, charName, level: 100, value, mapName: "Spore Meadows",
});

beforeEach(() => localStorage.clear());

describe("stat snapshot store", () => {
  it("keeps its own key, per character, oldest first", () => {
    store.addSnapshot(snap("A", 2));
    store.addSnapshot(snap("A", 1));
    store.addSnapshot(snap("B", 3));
    expect(store.listTrackedChars()).toEqual(["A", "B"]);
    expect(store.listSnapshots("A").map((s) => s.capturedAt)).toEqual([1, 2]);
    expect(localStorage.getItem("test-stat-tracker.v1")).toBeTruthy();
  });

  it("deletes one snapshot and clears a character", () => {
    store.addSnapshot(snap("A", 1));
    store.addSnapshot(snap("A", 2));
    store.deleteSnapshot("A", 1);
    expect(store.listSnapshots("A").map((s) => s.capturedAt)).toEqual([2]);
    store.clearChar("A");
    expect(store.listTrackedChars()).toEqual([]);
  });

  it("round-trips export → import, deduping by capturedAt", () => {
    store.addSnapshot(snap("A", 1));
    const text = store.exportAllAsJson();
    localStorage.clear();
    store.addSnapshot(snap("A", 1, 9));
    expect(store.importFromJson(text)).toMatchObject({ ok: true, charsImported: 1, snapshotsImported: 1 });
    expect(store.listSnapshots("A")).toHaveLength(1);
  });

  it("rejects a foreign file", () => {
    expect(store.importFromJson("{}")).toMatchObject({ ok: false, error: "Not a valid test-stat-tracker export" });
  });

  it("builds a snapshot from a save", () => {
    const save = { charNames: ["Alpha"], lastUpdated: 5, data: { PVStatList_0: [1, 1, 1, 1, 321] } };
    expect(store.buildSnapshot(save, 0, 7.5, "Map", { Root: 7.5 })).toMatchObject({
      charIndex: 0, charName: "Alpha", level: 321, saveUpdatedAt: 5, value: 7.5, mapName: "Map", flatTree: { Root: 7.5 },
    });
  });

  it("reads and keeps writing the legacy value field (Coin Multi's old snapshots)", () => {
    localStorage.setItem(
      "coin-multi-tracker.v1",
      JSON.stringify({ snapshotsByChar: { A: [{ capturedAt: 1, saveUpdatedAt: null, charIndex: 0, charName: "A", level: 1, computedCoinMulti: 42, mapName: "M" }] } })
    );
    expect(legacy.listSnapshots("A")[0].value).toBe(42);
    legacy.addSnapshot(snap("A", 2, 7));
    const stored = JSON.parse(localStorage.getItem("coin-multi-tracker.v1")!).snapshotsByChar.A[1];
    expect(stored).toMatchObject({ value: 7, computedCoinMulti: 7 });
  });
});
```

`web/__tests__/lib/statTracker/biggestGains.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeGains, splitGains, groupedGainsModel } from "@/lib/statTracker/biggestGains";
import type { StatGroup } from "@/lib/arkh/stats/defs/grouped";

const GROUPS: StatGroup[] = [
  { key: "p", name: "P", kind: "pct", sources: ["a", "b"] },
  { key: "r", name: "R", kind: "raw", sources: ["x"] },
  { key: "m4", name: "M4", kind: "min4", sources: ["c"] },
  { key: "mu", name: "MU", kind: "mult", max1: true, sources: ["k", "l"] },
];
const model = groupedGainsModel("Root", GROUPS);
const P = "Root / P", R = "Root / R", M4 = "Root / M4", MU = "Root / MU";

describe("what-if Biggest Gains over grouped stats", () => {
  it("pct: the new group factor over the old one", () => {
    const yours = { [P]: 4, [`${P} / A`]: 100, [`${P} / B`]: 200 };
    const { rows } = computeGains(model, yours, { [`${P} / A`]: 400 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "A", group: "P", display: "pct", you: 100, max: 400 });
    expect(rows[0].gainPct).toBeCloseTo(75, 9); // (1 + 6) / 4 − 1
  });

  it("raw has no /100; min4 caps at 4", () => {
    expect(computeGains(model, { [`${R} / X`]: 0.5 }, { [`${R} / X`]: 1.5 }).rows[0].gainPct).toBeCloseTo((2.5 / 1.5 - 1) * 100, 9);
    expect(computeGains(model, { [`${M4} / C`]: 2 }, { [`${M4} / C`]: 9 }).rows[0].gainPct).toBeCloseTo((5 / 3 - 1) * 100, 9);
  });

  it("mult: max / you, displayed as a multiplier", () => {
    const { rows } = computeGains(model, { [`${MU} / K`]: 2, [`${MU} / L`]: 3 }, { [`${MU} / K`]: 5 });
    expect(rows[0]).toMatchObject({ display: "x" });
    expect(rows[0].gainPct).toBeCloseTo(150, 9); // 15 / 6 − 1
  });

  it("a source only the reference has counts as you = 0", () => {
    const { rows } = computeGains(model, { [`${P} / A`]: 100 }, { [`${P} / New`]: 100 });
    expect(rows[0]).toMatchObject({ source: "New", you: 0 });
    expect(rows[0].gainPct).toBeCloseTo(50, 9); // 3 / 2 − 1
  });

  it("ignores sources at the max and nested paths; sorts descending", () => {
    const yours = { [`${P} / A`]: 50, [`${P} / A / Detail`]: 1, [`${P} / B`]: 50, [`${R} / X`]: 1 };
    const ref = { [`${P} / A`]: 50, [`${P} / B`]: 150, [`${R} / X`]: 1.5, [`${P} / A / Detail`]: 99 };
    const res = computeGains(model, yours, ref);
    expect(res.comparableSources).toBe(3);
    expect(res.rows.map((r) => r.source)).toEqual(["B", "X"]);
  });

  it("totalFromFlat multiplies every group", () => {
    expect(model.totalFromFlat({ [`${P} / A`]: 50, [`${R} / X`]: 1, [`${MU} / K`]: 3 })).toBeCloseTo(1.5 * 2 * 1 * 3, 12);
  });

  it("splits minor gains below 0.05%", () => {
    const rows = [
      { path: "a", group: "g", source: "a", display: "pct" as const, you: 0, max: 1, gainPct: 2 },
      { path: "b", group: "g", source: "b", display: "pct" as const, you: 0, max: 1, gainPct: 0.01 },
    ];
    const { major, minor } = splitGains(rows);
    expect(major.map((r) => r.path)).toEqual(["a"]);
    expect(minor.map((r) => r.path)).toEqual(["b"]);
  });
});
```

`web/__tests__/lib/statTracker/mapOptions.test.ts`: the content of `__tests__/lib/coinMulti/mapOptions.test.ts` with `buildCoinMapOptions` → `buildStatMapOptions` and the import from `@/lib/statTracker/mapOptions`.

- [ ] **Step 3: Run** `npx vitest run __tests__/lib/statTracker` → FAIL (modules missing).

- [ ] **Step 4: Implement.**

`storage.ts`:

```ts
// localStorage adapter for a stat page's snapshots — one key per stat,
// snapshots per character: key → { snapshotsByChar: { [charName]: StatSnapshot[] } }.

import { listCharacters } from "@/lib/dropRate/extract";
import type { FlatTree } from "@/lib/dropRate/treeFlatten";

const MAX_SNAPSHOTS_PER_CHAR = 500;

export type StatSnapshot = {
  capturedAt: number;
  saveUpdatedAt: number | null;
  charIndex: number;
  charName: string;
  level: number;
  /** The stat's total at capture time. */
  value: number;
  mapName: string;
  /** Path → value for every node of the tree (for Δ comparisons). */
  flatTree?: FlatTree;
};

type Store = { snapshotsByChar: Record<string, StatSnapshot[]> };

export type SnapshotStore = {
  buildSnapshot(save: any, charIndex: number, value: number, mapName: string, flatTree?: FlatTree): StatSnapshot;
  addSnapshot(snapshot: StatSnapshot): void;
  listSnapshots(charName: string): StatSnapshot[];
  listTrackedChars(): string[];
  clearChar(charName: string): void;
  deleteSnapshot(charName: string, capturedAt: number): void;
  exportAllAsJson(): string;
  importFromJson(jsonText: string): { ok: boolean; charsImported: number; snapshotsImported: number; error?: string };
};

/** legacyValueKey: the field an older release stored the value under (Coin
 *  Multi: "computedCoinMulti"). Read as a fallback and written next to
 *  `value`, so old snapshots, old exports and an older app all keep working. */
export function createSnapshotStore(storageKey: string, exportLabel: string, legacyValueKey?: string): SnapshotStore {
  const emptyStore = (): Store => ({ snapshotsByChar: {} });

  function readStore(): Store {
    if (typeof window === "undefined") return emptyStore();
    try {
      const raw = window.localStorage.getItem(storageKey);
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
      window.localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      // quota exceeded or storage disabled — silently drop
    }
  }

  const normalize = (s: StatSnapshot): StatSnapshot =>
    typeof s.value === "number" || !legacyValueKey ? s : { ...s, value: Number((s as any)[legacyValueKey]) };
  const withLegacy = (s: StatSnapshot): StatSnapshot =>
    legacyValueKey ? ({ ...s, [legacyValueKey]: s.value } as StatSnapshot) : s;

  return {
    buildSnapshot(save, charIndex, value, mapName, flatTree) {
      const ch = listCharacters(save).find((c) => c.charIndex === charIndex);
      if (!ch) throw new Error(`Character index ${charIndex} not present in save`);
      const updated = Number(save?.lastUpdated);
      return {
        capturedAt: Date.now(),
        saveUpdatedAt: Number.isFinite(updated) ? updated : null,
        charIndex: ch.charIndex,
        charName: ch.charName,
        level: ch.level,
        value,
        mapName,
        flatTree,
      };
    },
    addSnapshot(snapshot) {
      const store = readStore();
      const list = store.snapshotsByChar[snapshot.charName] ?? [];
      list.push(withLegacy(snapshot));
      if (list.length > MAX_SNAPSHOTS_PER_CHAR) list.splice(0, list.length - MAX_SNAPSHOTS_PER_CHAR);
      store.snapshotsByChar[snapshot.charName] = list;
      writeStore(store);
    },
    listSnapshots(charName) {
      return [...(readStore().snapshotsByChar[charName] ?? [])].map(normalize).sort((a, b) => a.capturedAt - b.capturedAt);
    },
    listTrackedChars() {
      return Object.keys(readStore().snapshotsByChar).sort();
    },
    clearChar(charName) {
      const store = readStore();
      delete store.snapshotsByChar[charName];
      writeStore(store);
    },
    deleteSnapshot(charName, capturedAt) {
      const store = readStore();
      const list = store.snapshotsByChar[charName];
      if (!list) return;
      store.snapshotsByChar[charName] = list.filter((s) => s.capturedAt !== capturedAt);
      writeStore(store);
    },
    exportAllAsJson() {
      return JSON.stringify(readStore(), null, 2);
    },
    importFromJson(jsonText) {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object" || !parsed.snapshotsByChar || typeof parsed.snapshotsByChar !== "object") {
          return { ok: false, charsImported: 0, snapshotsImported: 0, error: `Not a valid ${exportLabel} export` };
        }
        const incoming = parsed.snapshotsByChar as Record<string, StatSnapshot[]>;
        const store = readStore();
        let chars = 0;
        let snaps = 0;
        for (const [charName, list] of Object.entries(incoming)) {
          if (!Array.isArray(list)) continue;
          const existing = new Map<number, StatSnapshot>();
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
    },
  };
}
```

`biggestGains.ts`:

```ts
// Biggest Gains for any stat page, by what-if: swap one source for the
// Observed Max in the flat tree, ask the stat's GainsModel for the new total,
// gain = new / current − 1. Exact for every formula shape (products,
// max(1, ·), pow, caps, floors) as long as totalFromFlat mirrors the combine.

import { groupFactorOf, type StatGroup } from "@/lib/arkh/stats/defs/grouped";
import type { GainDisplay, GainSource, GainsModel } from "./config";

export const MINOR_GAIN_THRESHOLD_PCT = 0.05;

export type GainRow = GainSource & {
  you: number;
  max: number;
  /** % the stat's total rises if this source matched the Observed Max. */
  gainPct: number;
};

/** Paths exactly one segment below `parent`, across the given flat maps. */
export function directChildren(parent: string, ...flats: Record<string, number>[]): string[] {
  const prefix = `${parent} / `;
  const out = new Set<string>();
  for (const flat of flats) {
    for (const p of Object.keys(flat)) {
      if (p.startsWith(prefix) && !p.slice(prefix.length).includes(" / ")) out.add(p);
    }
  }
  return [...out];
}

export function computeGains(
  model: GainsModel,
  yoursFlat: Record<string, number>,
  refFlat: Record<string, number>
): { rows: GainRow[]; comparableSources: number } {
  const base = model.totalFromFlat(yoursFlat);
  const work: Record<string, number> = { ...yoursFlat };
  const rows: GainRow[] = [];
  let comparableSources = 0;
  for (const s of model.sources(yoursFlat, refFlat)) {
    const max = refFlat[s.path];
    if (typeof max !== "number" || !Number.isFinite(max)) continue;
    const had = Object.prototype.hasOwnProperty.call(work, s.path);
    const you = Number(work[s.path]) || 0;
    work[s.path] = max;
    const gainPct = (model.totalFromFlat(work) / base - 1) * 100;
    if (had) work[s.path] = yoursFlat[s.path];
    else delete work[s.path];
    if (!Number.isFinite(gainPct)) continue;
    comparableSources++;
    if (gainPct > 0) rows.push({ ...s, you, max, gainPct });
  }
  rows.sort((a, b) => b.gainPct - a.gainPct);
  return { rows, comparableSources };
}

export function splitGains(
  rows: GainRow[],
  threshold: number = MINOR_GAIN_THRESHOLD_PCT
): { major: GainRow[]; minor: GainRow[] } {
  const major: GainRow[] = [];
  const minor: GainRow[] = [];
  for (const r of rows) (r.gainPct >= threshold ? major : minor).push(r);
  return { major, minor };
}

const DISPLAY: Record<StatGroup["kind"], GainDisplay> = { pct: "pct", raw: "raw", min4: "raw", mult: "x" };

/** GainsModel for a groupedDescriptor stat (Coin Multi, EXP Multi). */
export function groupedGainsModel(root: string, groups: readonly StatGroup[]): GainsModel {
  const groupPath = (g: StatGroup) => `${root} / ${g.name}`;
  return {
    sources(yoursFlat, refFlat) {
      const out: GainSource[] = [];
      for (const g of groups) {
        const gp = groupPath(g);
        for (const path of directChildren(gp, yoursFlat, refFlat)) {
          out.push({ path, group: g.name, source: path.slice(gp.length + 3), display: DISPLAY[g.kind] });
        }
      }
      return out;
    },
    totalFromFlat(flat) {
      let total = 1;
      for (const g of groups) total *= groupFactorOf(g, directChildren(groupPath(g), flat).map((p) => Number(flat[p])));
      return total;
    },
  };
}
```

`mapOptions.ts`: move the body of `lib/coinMulti/mapOptions.ts` here, renaming `CoinMapOption` → `StatMapOption` and `buildCoinMapOptions` → `buildStatMapOptions`, and change the header comment to: `// Map list for the stat pages: every named map plus every character's current map, labelled "W<world> · <name>".` Leave `lib/coinMulti/mapOptions.ts` in place (Task 10 deletes it).

- [ ] **Step 5: Run** `npx vitest run __tests__/lib/statTracker` → PASS; `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 6: Commit**

```bash
git add lib/statTracker/ __tests__/lib/statTracker/
git commit -m "feat(statTracker): kit library — config, snapshot store, what-if gains, map options

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Kit components

**Files:**
- Create: `web/components/statTracker/StatCalculator.tsx`, `StatSnapshotSection.tsx`, `StatBiggestGains.tsx`, `StatPageClient.tsx`
- Create: `web/__tests__/components/statTracker/testConfig.ts`
- Test: `web/__tests__/components/statTracker/StatCalculator.test.tsx`, `StatBiggestGains.test.tsx`, `StatSnapshotSection.test.tsx` (new)

**Interfaces:**
- Consumes: Task 6 (`StatPageConfig`, `createSnapshotStore`, `computeGains`, `splitGains`, `GainRow`, `buildStatMapOptions`, `StatMapOption`).
- Produces: `StatCalculator` (props `config`, `onStateChange?`, `compareBaseline?`, `snapshotSlot?`, `extraTabs?`, `extraTabsFirst?`, `defaultView?`) and `StatCalculatorState` = `{ charIndex: number | null; charName: string; classKey: string | null; charSummary: CharSummary | null; total: number | null; mapIndex: number; mapLabel: string; save: any; tree: ArkhNode | null; computeError: string | null }`; `StatSnapshotSection` (props `config`, `state`, `onSelectBaseline?`, `selectedBaselineAt?`, `headerExtra?`); `StatBiggestGains` (props `config`, `yoursFlat`, `classKey`, `computeError?`, `loadReference?: (classKey: string | null) => Promise<Record<string, number>>`); `StatPageClient` (props `config`).

The four components are the Coin components generalized. Copy each Coin file to its new path and apply exactly these changes (everything else — markup, classes, effects, comments — stays identical):

**`StatCalculator.tsx`** (from `components/coinMulti/CoinCalculator.tsx`):
- Imports: drop `buildCoinMapOptions`, `CoinMapOption`, `formatCoinMulti`; add `import { buildStatMapOptions, type StatMapOption } from "@/lib/statTracker/mapOptions";` and `import type { StatPageConfig } from "@/lib/statTracker/config";`.
- Delete the `SAVE_KEY`, `NAME_KEY`, `ERR_PREFIX` constants; use `config.storage.save`, `config.storage.name`, `config.errPrefix`.
- `CoinCalculatorState` → `StatCalculatorState` with `totalCoin` → `total` and `coinTree` → `tree` (update the doc comment of `computeError` to "Compute error (`<errPrefix>: …`) or null.").
- Props gain `config: StatPageConfig`; state `coinTree`/`coinTotal` → `tree`/`total`; `mapOptions` typed `StatMapOption[]`; `buildCoinMapOptions(parsed)` → `buildStatMapOptions(parsed)`.
- Compute effect body: `const result = await config.compute(save, charIdx, mapIdx);` (replaces the dynamic import + `computeArkhCoinMulti` call); add `config` to its dependency list. Error: `` setError(`${config.errPrefix}: ` + …) ``.
- `stageSave` dependency list gains `config.storage.save`; the restore effect reads `config.storage.name` / `config.storage.save`.
- Heading: `<span className="text-3xl font-extrabold text-gold">{config.emoji} {config.calculatorTitle}</span>`; subtitle `{config.subtitle}`; `ProfileNameLoader storageKey={config.storage.name}`; map `title={config.mapTitle}`; total label `{config.totalLabel}`; value `total !== null ? config.formatTotal(total) + "x" : "—"` and title `total !== null ? total.toExponential(6) + "x" : undefined`.
- `onStateChange` payload uses `total`, `tree` and `computeError: error && error.startsWith(config.errPrefix) ? error : null`.

**`StatSnapshotSection.tsx`** (from `CoinSnapshotSection.tsx`):
- Props: `config: StatPageConfig`, `state: StatCalculatorState | null`, rest unchanged.
- `const store = useMemo(() => createSnapshotStore(config.storage.snapshots, config.storage.exportLabel, config.storage.legacyValueKey), [config]);` — every `addSnapshot`/`listSnapshots`/… call becomes `store.<fn>`; `buildCoinSnapshot` → `store.buildSnapshot`; `CoinSnapshot` → `StatSnapshot`.
- `COLLAPSE_KEY` → `config.storage.collapse`.
- `canSave` uses `state.total`; `onSave` flattens `state.tree`, builds with `state.total!`, notice `` `Snapshot saved for ${snap.charName} — ${config.statName} ${config.formatTotal(snap.value)}x on ${state.mapLabel}${…}` ``.
- Export filename `` `${config.storage.exportPrefix}-${new Date().toISOString().slice(0, 10)}.json` ``.
- `HistoryTable` takes `statName` (the column header text) and reads `s.value` instead of `s.computedCoinMulti` (keep the non-finite guard and its comment, reworded "An imported snapshot without a value …").

**`StatBiggestGains.tsx`** (from `CoinBiggestGains.tsx`):
- Props: `config`, `yoursFlat`, `classKey`, `computeError`, `loadReference?`; default loader `(ck) => config.loadTop().then((m) => m.flatForClass(ck))`.
- `computeCoinGains(yoursFlat, ref)` → `computeGains(config.gains, yoursFlat, ref)`; `splitCoinGains` → `splitGains`; `CoinGainRow` → `GainRow`.
- `fmtContribution(row, v)`: `row.display === "pct" ? <Num value={v} plus unit="%" /> : row.display === "x" ? <Num value={v} unit="x" /> : <Num value={v} />`.
- Texts: "Load a save above to see your biggest {config.statName} gains."; ref error banner `{config.errPrefix}: {refError}`; "No comparable top-player reference for this character yet — can&apos;t rank {config.statName} gains."; hero "… for **+x%** {config.statName}"; column header `{config.gainLabel} gain`; methodology `{config.methodologyNote}`.

**`StatPageClient.tsx`** (from `app/coin-multi/CoinMultiPageClient.tsx`):
- `export default function StatPageClient({ config }: { config: StatPageConfig })`.
- `topMod` state typed `TopModule | null`, loaded with `await config.loadTop()`; `topBaseline.flatTree = topMod.flatForClass(classKey)`, `capturedAt: Date.parse(config.topMeta.generatedAt)`, `charName: \`Observed Max (${config.topMeta.playersScanned} top players)\``.
- Components → `StatCalculator config={config}`, `StatSnapshotSection config={config}`, `StatBiggestGains config={config}`; `calcState.coinTree` → `calcState.tree`.
- Gains tab `title: config.gainsTabTitle`; compare button `title={config.compareTitle}`; footer text `{config.footer}`.

- [ ] **Step 1: Test config** `web/__tests__/components/statTracker/testConfig.ts`:

```ts
import type { StatPageConfig } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";

export const TEST_GROUPS = [{ key: "g1", name: "Pool", kind: "pct" as const, sources: ["a", "b"] }];

export const testConfig: StatPageConfig = {
  statName: "Test Multi",
  gainLabel: "Test",
  emoji: "🧪",
  calculatorTitle: "Test Multi Calculator",
  subtitle: "Test subtitle.",
  totalLabel: "Total Test Multi",
  mapTitle: "Test map title",
  errPrefix: "Test multi compute failed",
  storage: {
    save: "test-multi-tracker.last-upload.v1",
    name: "test-multi-tracker.playerName",
    snapshots: "test-multi-tracker.v1",
    collapse: "test-multi.snapshot-section.collapsed.v1",
    exportPrefix: "test-multi-snapshots",
    exportLabel: "test-multi-tracker",
  },
  compute: async () => {
    throw new Error("stub");
  },
  formatTotal: (x) => x.toFixed(2),
  gains: groupedGainsModel("Test Multi", TEST_GROUPS),
  loadTop: async () => ({ flatForClass: () => ({}) }),
  topMeta: { generatedAt: "2026-09-24T00:00:00.000Z", playersScanned: 3 },
  methodologyNote: "Test methodology.",
  compareTitle: "Test compare",
  gainsTabTitle: "Test gains",
  footer: "Test footer.",
};
```

- [ ] **Step 2: Failing tests.** `StatCalculator.test.tsx` = `__tests__/components/CoinCalculator.keepView.test.tsx` with: no `vi.mock("@/lib/arkh/computeCoin")` (the test config's `compute` throws "stub"), `import StatCalculator from "@/components/statTracker/StatCalculator"`, `import { testConfig } from "./testConfig"`, every `<CoinCalculator />` → `<StatCalculator config={testConfig} />`, the name-key expectation → `"test-multi-tracker.playerName"`, the error expectation → `/Test multi compute failed: stub/`. Keep all six cases.

`StatBiggestGains.test.tsx` = `__tests__/components/CoinBiggestGains.test.tsx` with `StatBiggestGains config={testConfig}`, `G = "Test Multi / Pool"`, `yours = { [\`${G} / Alpha Source\`]: 100, [\`${G} / Beta Source\`]: 200 }` (the group node isn't needed any more), same `ref`, expectations `/Load a save above/`, `"+75.000%"` (S = 100 + 200 = 300; Alpha → 400 gives (1 + 6)/4 − 1 = 75%), Beta absent (already at the max), and the banner `/Test multi compute failed: x/`.

`StatSnapshotSection.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatSnapshotSection from "@/components/statTracker/StatSnapshotSection";
import type { StatCalculatorState } from "@/components/statTracker/StatCalculator";
import { testConfig } from "./testConfig";

const state = (): StatCalculatorState => ({
  charIndex: 0,
  charName: "Alpha",
  classKey: null,
  charSummary: null,
  total: 12.5,
  mapIndex: 1,
  mapLabel: "W1 · Spore Meadows",
  save: { charNames: ["Alpha"], data: { PVStatList_0: [1, 1, 1, 1, 50] } },
  tree: { name: "Test Multi", val: 12.5, fmt: "x", children: [] },
  computeError: null,
});

beforeEach(() => localStorage.clear());

describe("StatSnapshotSection", () => {
  it("can't save without a computed state", () => {
    render(<StatSnapshotSection config={testConfig} state={null} />);
    expect(screen.getByText(/Save snapshot/)).toBeDisabled();
  });

  it("saves into the stat's own key and names the stat in the notice", () => {
    localStorage.setItem(testConfig.storage.collapse, "0");
    render(<StatSnapshotSection config={testConfig} state={state()} />);
    fireEvent.click(screen.getByText(/Save snapshot/));
    expect(screen.getByText(/Snapshot saved for Alpha — Test Multi 12.50x on W1 · Spore Meadows/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(testConfig.storage.snapshots)!).snapshotsByChar.Alpha).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run** `npx vitest run __tests__/components/statTracker` → FAIL (components missing). **Step 4: Create the four components** as specified. **Step 5: Run** the same → PASS; `npx vitest run __tests__/components` (Coin component tests still pass on the untouched Coin files) and `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 6: Commit**

```bash
git add components/statTracker/ __tests__/components/statTracker/
git commit -m "feat(statTracker): config-driven calculator, snapshots, Biggest Gains and page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Shared Observed Max collector, EXP collector, cron

**Files:**
- Create: `web/scripts/_shared/topStatCollector.ts`, `web/scripts/update-top-exp.ts`
- Modify: `web/scripts/_shared/classGating.ts` (add `deriveGatedTalentsFor`)
- Create (generated): `web/lib/expMulti/topExpMulti.ts`, `web/lib/expMulti/topExpMulti.meta.ts`
- Modify: `.github/workflows/refresh-top-max.yml`
- Test: `web/__tests__/scripts/topStatCollector.test.ts` (new)

**Interfaces:**
- Consumes: `neutralValue`, `StatGroup` (Task 1); `computeArkhExpPools`, `combineExpPools`, `bestExpMapIdx` (Tasks 2/5); `EXP_ROOT`, `EXP_GROUPS`; `EXP_CLASS_TALENTS`.
- Produces: `StatCollectorConfig`, `mergeBest`, `profileFlat`, `renderTopFiles`, `runTopCollector` from `scripts/_shared/topStatCollector.ts`; `deriveGatedTalentsFor(ids)`; generated `TOP_EXP_FLAT`, `TOP_EXP_PROFILE_OVERRIDES`, `TOP_EXP_CLASS_PROFILE`, `topExpFlatForClass(classKey)`, `TOP_EXP_GENERATED_AT`, `TOP_EXP_PLAYERS_SCANNED`, `TOP_EXP_HYPOTHETICAL_TOTAL`, `TOP_EXP_BEST`.

- [ ] **Step 1: Failing test** `web/__tests__/scripts/topStatCollector.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeBest, profileFlat, renderTopFiles, type StatCollectorConfig } from "@/scripts/_shared/topStatCollector";
import { deriveGatedTalentsFor, allClassKeys } from "@/scripts/_shared/classGating";
import { groupedDescriptor } from "@/lib/arkh/stats/defs/grouped";
import { combineStatPools } from "@/lib/arkh/computeStat";
import type { Pool } from "@/lib/arkh/stats/tree-builder";

const GROUPS = [
  { key: "m", name: "M", kind: "mult" as const, sources: ["t", "u"] },
  { key: "p", name: "P", kind: "pct" as const, sources: ["v"] },
];
const desc = groupedDescriptor({ id: "t", name: "Root", scope: "character", category: "test", system: "none", groups: GROUPS });
const cfg = {
  label: "Test Multi",
  root: "Root",
  groups: GROUPS,
  combine: (p: Record<string, Pool>) => combineStatPools(desc, p),
  constPrefix: "TOP_TEST",
  flatForClassFn: "topTestFlatForClass",
  scriptName: "scripts/update-top-test.ts",
} as unknown as StatCollectorConfig;
const pool = (...items: Array<[string, number]>): Pool => ({
  items: items.map(([name, val]) => ({ name, val, children: [{ name: "d", val }] })),
  sum: 0,
  product: 0,
});

describe("shared Observed Max collector", () => {
  it("keeps the best value per source position", () => {
    const a = mergeBest(null, { m: pool(["X (Talent 35)", 2], ["Y", 5]), p: pool(["Z", 10]) });
    const b = mergeBest(a, { m: pool(["X (Talent 35)", 3], ["Y", 1]), p: pool(["Z", 4]) });
    expect(b.m.items.map((i) => i.val)).toEqual([3, 5]);
    expect(b.p.items.map((i) => i.val)).toEqual([10]);
  });

  it("zeroes a gated talent with the group's neutral value and drops its subtree", () => {
    const best = { m: pool(["X (Talent 35)", 3], ["Y", 5]), p: pool(["Lucky (Talent 35)", 10], ["Z", 4]) };
    const flat = profileFlat(cfg, best, [35]);
    expect(flat["Root / M / X (Talent 35)"]).toBe(1); // mult → 1
    expect(flat["Root / P / Lucky (Talent 35)"]).toBe(0); // pct → 0
    expect(flat["Root / M / X (Talent 35) / d"]).toBeUndefined();
    expect(flat["Root"]).toBeCloseTo(5 * 1.04, 12);
  });

  it("renders the generated module with the stat's names", () => {
    const { data, meta } = renderTopFiles(cfg, { Root: 2, "Root / P": 2 }, { t35: { Root: 3 } }, { Maestro: "t35" }, { player: "p", char: "c", total: 9 }, 3, 20, "2026-09-24T00:00:00.000Z");
    expect(data).toContain("export const TOP_TEST_FLAT");
    expect(data).toContain("export const TOP_TEST_PROFILE_OVERRIDES");
    expect(data).toContain("export const TOP_TEST_CLASS_PROFILE");
    expect(data).toContain("export function topTestFlatForClass(classKey: string | null | undefined)");
    expect(meta).toContain('export const TOP_TEST_GENERATED_AT = "2026-09-24T00:00:00.000Z";');
    expect(meta).toContain("export const TOP_TEST_PLAYERS_SCANNED = 20;");
    expect(meta).toContain("export const TOP_TEST_HYPOTHETICAL_TOTAL = 3;");
  });

  it("gates only talents some — not all — classes have", () => {
    const all = allClassKeys().length;
    for (const g of deriveGatedTalentsFor([35, 632])) {
      expect(g.owners.size).toBeGreaterThan(0);
      expect(g.owners.size).toBeLessThan(all);
    }
    expect(deriveGatedTalentsFor([35]).map((g) => g.id)).toEqual([35]); // Lucky Charms: Maestro tab only
    expect(deriveGatedTalentsFor([632])).toEqual([]); // star talent, every class
  });
});
```

- [ ] **Step 2: Run** `npx vitest run __tests__/scripts/topStatCollector.test.ts` → FAIL.

- [ ] **Step 3: `classGating.ts`** — add `deriveGatedTalentsFor` and make the existing `deriveGatedTalents()` delegate to it (it keeps collecting the DR pool's talent ids, then returns `deriveGatedTalentsFor([...ids])` — same result, one loop):

```ts
/** deriveGatedTalents over an explicit talent list (Coin Multi, EXP Multi…). */
export function deriveGatedTalentsFor(ids: readonly number[]): GatedTalent[] {
  const classKeys = Object.keys(TALENT_TABS_BY_CLASS);
  const out: GatedTalent[] = [];
  for (const id of ids) {
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

- [ ] **Step 4: `topStatCollector.ts`** — the body of `scripts/update-top-coin.ts` generalized:

```ts
// Shared Observed Max collector for grouped stats (Coin Multi, EXP Multi…):
// every char of every candidate → the best value per source across
// everyone → ONE combine() pass (the tree and the total come from the same
// math a real save uses) → per-class gating of class talents → a generated
// lib/<stat>/top*.ts (+ .meta.ts). Never publishes a shrunken reference.

import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Pool } from "../../lib/arkh/stats/tree-builder";
import type { ArkhNode } from "../../lib/arkh/node";
import { neutralValue, type StatGroup } from "../../lib/arkh/stats/defs/grouped";
import { flattenTree } from "../../lib/dropRate/treeFlatten";
import { listCharacters } from "../../lib/dropRate/extract";
import { gatherCandidates, fetchProfileSave } from "./itProfiles";
import { allClassKeys, profileKey, type GatedTalent } from "./classGating";

export type StatCollectorConfig = {
  /** Stat name for logs and generated comments, e.g. "EXP Multi". */
  label: string;
  /** Leaderboard whose top 10 joins the candidates, e.g. "totalLevels". */
  focusBoard: string;
  root: string;
  groups: readonly StatGroup[];
  /** Pools for one character (the config picks the map). */
  computePools(save: any, charIdx: number): Record<string, Pool>;
  combine(pools: Record<string, Pool>): { tree: ArkhNode; total: number };
  gated: GatedTalent[];
  outputFile: string;
  metaFile: string;
  /** e.g. "TOP_EXP" → TOP_EXP_FLAT, TOP_EXP_GENERATED_AT, … */
  constPrefix: string;
  /** e.g. "topExpFlatForClass". */
  flatForClassFn: string;
  /** e.g. "scripts/update-top-exp.ts" (named in the generated comments). */
  scriptName: string;
};

type Best = { player: string; char: string; total: number };

export function mergeBest(acc: Record<string, Pool> | null, incoming: Record<string, Pool>): Record<string, Pool> {
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

/** Best pools with some class talents set to their group's neutral value
 *  (0 in sums, 1 in products; the subtree goes too) → one combine() → flat. */
export function profileFlat(
  cfg: Pick<StatCollectorConfig, "root" | "groups" | "combine">,
  best: Record<string, Pool>,
  zeroTalentIds: number[]
): Record<string, number> {
  const clone: Record<string, Pool> = {};
  for (const pn in best) {
    const kind = cfg.groups.find((g) => g.key === pn)?.kind ?? "pct";
    const items = best[pn].items.map((it) =>
      zeroTalentIds.some((id) => it.name.endsWith(`(Talent ${id})`))
        ? { ...it, val: neutralValue(kind), children: undefined }
        : { ...it }
    );
    clone[pn] = { items, sum: 0, product: 0 };
  }
  const combined = cfg.combine(clone);
  const flat = flattenTree(combined.tree);
  flat[cfg.root] = combined.total;
  return flat;
}

export function renderTopFiles(
  cfg: Pick<StatCollectorConfig, "label" | "constPrefix" | "flatForClassFn" | "scriptName"> & { outputFile?: string },
  baseFlat: Record<string, number>,
  overrides: Record<string, Record<string, number>>,
  classProfile: Record<string, string>,
  best: Best | null,
  hypotheticalTotal: number,
  scanned: number,
  now: string
): { data: string; meta: string } {
  const P = cfg.constPrefix;
  const dataName = cfg.outputFile ? basename(cfg.outputFile) : "the data file";
  const meta = [
    `// Top-player ${cfg.label} reference — metadata only (small, statically`,
    `// imported). The path table lives in ${dataName} and is lazy-loaded.`,
    `// Both auto-refreshed by ${cfg.scriptName}.`,
    "",
    `export const ${P}_GENERATED_AT = ${JSON.stringify(now)};`,
    `export const ${P}_PLAYERS_SCANNED = ${scanned};`,
    `// Best ${cfg.label} a single CLASS's best-of-each-source build reaches.`,
    `export const ${P}_HYPOTHETICAL_TOTAL = ${hypotheticalTotal};`,
    `// Highest ${cfg.label} of a single real player, for context.`,
    `export const ${P}_BEST = ${JSON.stringify(best ?? { player: "", char: "", total: 0 })};`,
    "",
  ].join("\n");

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

  const data = [
    `// Top-player ${cfg.label} reference — best-of-each-source pools run through`,
    `// ONE combine() pass (the same math a real save uses), gated PER CLASS for`,
    `// the formula's class talents. Use ${cfg.flatForClassFn}(classKey).`,
    "// Large file: lazy-load it, don't import statically.",
    `// Generated ${now} · ${scanned} players. Refresh: ${cfg.scriptName}.`,
    "",
    "type FlatMap = Readonly<Record<string, number>>;",
    "",
    `export const ${P}_FLAT: FlatMap = ${obj(baseFlat)};`,
    "",
    `export const ${P}_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {`,
    overrideEntries,
    "};",
    "",
    `export const ${P}_CLASS_PROFILE: Readonly<Record<string, string>> = ${JSON.stringify(classProfile, null, 2)};`,
    "",
    `/** The top ${cfg.label} reference for a class — base merged with its profile. */`,
    `export function ${cfg.flatForClassFn}(classKey: string | null | undefined): FlatMap {`,
    `  const profile = classKey ? ${P}_CLASS_PROFILE[classKey] : undefined;`,
    `  const override = profile ? ${P}_PROFILE_OVERRIDES[profile] : undefined;`,
    `  return override ? { ...${P}_FLAT, ...override } : ${P}_FLAT;`,
    "}",
    "",
  ].join("\n");
  return { data, meta };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runTopCollector(cfg: StatCollectorConfig, argv: string[] = process.argv.slice(2)): Promise<void> {
  const THROTTLE_MS = argv.includes("--slow") ? 1500 : 400;
  const i = argv.indexOf("--limit");
  const LIMIT = i >= 0 && argv[i + 1] ? Number(argv[i + 1]) || null : null;
  // Never publish a shrunken reference (the Tome cron lesson); --limit is a smoke test.
  const MIN_PLAYERS = LIMIT ? 1 : 20;

  console.log("→ Gathering candidates from leaderboards…");
  const candidates = await gatherCandidates({ limit: LIMIT ?? undefined, focusBoard: cfg.focusBoard });
  console.log(`  ✓ ${candidates.length} candidates`);

  let bestPools: Record<string, Pool> | null = null;
  let bestTotal: Best | null = null;
  let scanned = 0;
  let skipped = 0;

  for (let k = 0; k < candidates.length; k++) {
    const name = candidates[k];
    process.stdout.write(`  [${k + 1}/${candidates.length}] ${name.padEnd(20)}`);
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
      if (k < candidates.length - 1) await sleep(THROTTLE_MS);
      continue;
    }
    let playerBest = 0;
    let playerBestChar = "";
    for (const ch of chars) {
      try {
        const pools = cfg.computePools(save, ch.charIndex);
        const total = cfg.combine(pools).total;
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
    if (k < candidates.length - 1) await sleep(THROTTLE_MS);
  }

  if (!bestPools || scanned < MIN_PLAYERS) {
    console.error(`× only ${scanned} players scanned (< ${MIN_PLAYERS}); refusing to publish`);
    process.exit(1);
  }

  // Base = every class-specific talent neutralised; each profile adds back
  // the talents its classes own. The page merges {...base, ...override}.
  const baseFlat = profileFlat(cfg, bestPools, cfg.gated.map((x) => x.id));
  const classProfile: Record<string, string> = {};
  const overrides: Record<string, Record<string, number>> = {};
  let maxProfileTotal = baseFlat[cfg.root] || 0;
  for (const c of allClassKeys()) {
    const owned = cfg.gated.filter((x) => x.owners.has(c)).map((x) => x.id);
    const key = profileKey(owned);
    classProfile[c] = key;
    if (key === "base" || overrides[key]) continue;
    const pf = profileFlat(cfg, bestPools, cfg.gated.filter((x) => !owned.includes(x.id)).map((x) => x.id));
    const d: Record<string, number> = {};
    for (const p in pf) if (baseFlat[p] !== pf[p]) d[p] = pf[p];
    overrides[key] = d;
    maxProfileTotal = Math.max(maxProfileTotal, pf[cfg.root] || 0);
  }

  console.log(`\n✓ Scanned ${scanned} players (${skipped} skipped)`);
  console.log(`  · gated talents: ${cfg.gated.map((x) => x.id).join(", ") || "none"}`);
  console.log(`  · best per-class ceiling: ${maxProfileTotal.toExponential(3)}x`);
  console.log(`  · best real player: ${bestTotal?.total.toExponential(3)}x by ${bestTotal?.player} (${bestTotal?.char})`);

  const { data, meta } = renderTopFiles(cfg, baseFlat, overrides, classProfile, bestTotal, maxProfileTotal, scanned, new Date().toISOString());
  writeFileSync(cfg.metaFile, meta);
  console.log(`\n✓ Wrote ${cfg.metaFile}`);
  writeFileSync(cfg.outputFile, data);
  console.log(`✓ Wrote ${cfg.outputFile}`);
}
```

- [ ] **Step 5: `update-top-exp.ts`**

```ts
// Refresh the bundled top-player EXP Multi reference in
// lib/expMulti/topExpMulti.ts (+ .meta.ts). Each character is measured on its
// save's best EXP map (bestExpMapIdx: arcane slot 1 × Shiny Medallions — the
// spec's D5); Lucky Charms (talent 35) is gated per class.
//
// Run (from web/):  npx tsx scripts/update-top-exp.ts   [--limit N] [--slow]
import { join } from "node:path";

const g = globalThis as any;
if (!g.window) g.window = g;

import { runTopCollector } from "./_shared/topStatCollector";
import { deriveGatedTalentsFor } from "./_shared/classGating";
import { computeArkhExpPools, combineExpPools, bestExpMapIdx } from "../lib/arkh/computeExp";
import { EXP_ROOT, EXP_GROUPS } from "../lib/arkh/stats/defs/exp-multi";
import { EXP_CLASS_TALENTS } from "../lib/arkh/stats/systems/exp/exp";

runTopCollector({
  label: "EXP Multi",
  focusBoard: "totalLevels",
  root: EXP_ROOT,
  groups: EXP_GROUPS,
  computePools: (save, ci) => computeArkhExpPools(save, ci, bestExpMapIdx(save, ci)),
  combine: combineExpPools,
  gated: deriveGatedTalentsFor(EXP_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "expMulti", "topExpMulti.ts"),
  metaFile: join(__dirname, "..", "lib", "expMulti", "topExpMulti.meta.ts"),
  constPrefix: "TOP_EXP",
  flatForClassFn: "topExpFlatForClass",
  scriptName: "scripts/update-top-exp.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 6: Run the unit tests** — `npx vitest run __tests__/scripts` → PASS; `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 7: Generate the reference** (network, read-only public API; takes a few minutes):

Run: `npx tsx scripts/update-top-exp.ts --limit 3` (smoke) then `npx tsx scripts/update-top-exp.ts`
Expected: "✓ Scanned N players" with N ≥ 20 and both files written. If the IT API is unreachable, retry once with `--slow`; if it still fails, stop and report BLOCKED with the error (don't hand-write the file).

- [ ] **Step 8: Cron** — in `.github/workflows/refresh-top-max.yml`:
  - rename the workflow `name:` to `Refresh top DR, coin, EXP & talent max`;
  - add `#   • web/lib/expMulti/topExpMulti.ts       (+ .meta.ts)` to the header list (after the coin line) and change "All three collectors" to "All four collectors";
  - after the "Refresh top-player Coin Multi max" step add:

```yaml
      - name: Refresh top-player EXP Multi max
        working-directory: web
        continue-on-error: true
        timeout-minutes: 12
        run: npx tsx scripts/update-top-exp.ts
```

  - append `web/lib/expMulti/topExpMulti.ts web/lib/expMulti/topExpMulti.meta.ts` to `files=` and change the commit message to `chore: auto-refresh top DR + coin + EXP + talent max snapshots`.

- [ ] **Step 9: Commit**

```bash
git add scripts/_shared/topStatCollector.ts scripts/_shared/classGating.ts scripts/update-top-exp.ts lib/expMulti/topExpMulti.ts lib/expMulti/topExpMulti.meta.ts ../.github/workflows/refresh-top-max.yml __tests__/scripts/topStatCollector.test.ts
git commit -m "feat(exp): Observed Max collector (shared core) + cron step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The EXP page

**Files:**
- Create: `web/lib/expMulti/pageConfig.ts`, `web/app/exp-multi/page.tsx`, `web/app/exp-multi/ExpMultiPageClient.tsx`
- Modify: `web/components/TopNav.tsx`, `web/app/page.tsx`, `web/e2e/homepage.spec.ts`, `web/__tests__/components/TopNav.test.tsx`
- Test: `web/__tests__/components/statTracker/StatCalculator.test.tsx` (extend with the EXP config), `web/__tests__/lib/expMulti/pageConfig.test.ts` (new)

**Interfaces:**
- Consumes: kit (Tasks 6–7), `formatExpMulti` (Task 5), generated `topExpMulti*` (Task 8).
- Produces: `EXP_PAGE: StatPageConfig`.

- [ ] **Step 1: Failing test** `web/__tests__/lib/expMulti/pageConfig.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { EXP_GROUPS, EXP_ROOT } from "@/lib/arkh/stats/defs/exp-multi";

describe("EXP Multi page config", () => {
  it("uses its own storage keys", () => {
    expect(EXP_PAGE.storage).toMatchObject({
      save: "exp-multi-tracker.last-upload.v1",
      name: "exp-multi-tracker.playerName",
      snapshots: "exp-multi-tracker.v1",
      collapse: "exp-multi.snapshot-section.collapsed.v1",
    });
    expect(EXP_PAGE.storage.legacyValueKey).toBeUndefined();
  });

  it("formats like the game and models gains over the EXP groups", () => {
    expect(EXP_PAGE.formatTotal(1.4504214791708842e19)).toBe("14504214T");
    const G = `${EXP_ROOT} / ${EXP_GROUPS[1].name}`;
    expect(EXP_PAGE.gains.totalFromFlat({ [`${G} / EXP Bundle (bun_q)`]: 20 })).toBeCloseTo(1.2, 12);
  });

  it("loads the Observed Max for a class", async () => {
    const top = await EXP_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });
});
```

(If Task 2 named the bundle node differently, use that exact name.)

- [ ] **Step 2: Run** `npx vitest run __tests__/lib/expMulti/pageConfig.test.ts` → FAIL.

- [ ] **Step 3: `pageConfig.ts`**

```ts
// EXP Multi page: the statTracker kit's config for N.js ExpMulti(0).

import type { StatPageConfig } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { EXP_GROUPS, EXP_ROOT } from "@/lib/arkh/stats/defs/exp-multi";
import { formatExpMulti } from "./format";
import { TOP_EXP_GENERATED_AT, TOP_EXP_PLAYERS_SCANNED } from "./topExpMulti.meta";

export const EXP_PAGE: StatPageConfig = {
  statName: "EXP Multi",
  gainLabel: "EXP",
  emoji: "✨",
  calculatorTitle: "EXP Multi Calculator",
  subtitle:
    "Computes every character's Class EXP multiplier from your save. Select character & map. All processing local in your browser.",
  totalLabel: "Total Class EXP Multi",
  mapTitle: "The map sets the Arcane map bonus and whether Shiny Medallions applies (the medallion of the map's monster)",
  errPrefix: "EXP multi compute failed",
  storage: {
    save: "exp-multi-tracker.last-upload.v1",
    name: "exp-multi-tracker.playerName",
    snapshots: "exp-multi-tracker.v1",
    collapse: "exp-multi.snapshot-section.collapsed.v1",
    exportPrefix: "exp-multi-snapshots",
    exportLabel: "exp-multi-tracker",
  },
  compute: (save, charIdx, mapIdx) =>
    import("@/lib/arkh/computeExp").then((m) => m.computeArkhExpMulti(save, charIdx, mapIdx)),
  formatTotal: formatExpMulti,
  gains: groupedGainsModel(EXP_ROOT, EXP_GROUPS),
  loadTop: () =>
    import("./topExpMulti").then((m) => ({
      flatForClass: (classKey: string | null) => m.topExpFlatForClass(classKey) as Record<string, number>,
    })),
  topMeta: { generatedAt: TOP_EXP_GENERATED_AT, playersScanned: TOP_EXP_PLAYERS_SCANNED },
  methodologyNote:
    "EXP gain = how much your total Class EXP Multi would rise if this source matched the top players " +
    "(Observed Max), recomputed through the game's formula. Values are a ceiling, not a one-level step. " +
    "Each top player is measured on their best EXP map (Arcane map bonus × Shiny Medallions), so those " +
    "two rows reflect that map choice too.",
  compareTitle: "Compare every EXP source against the best value observed across the top players",
  gainsTabTitle: "Rank your EXP sources by how much Class EXP Multi matching the top players would give",
  footer: "EXP Multi is computed locally from your save — every term of the game's Class EXP formula, group by group.",
};
```

- [ ] **Step 4: Route** — `web/app/exp-multi/ExpMultiPageClient.tsx`:

```tsx
"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function ExpMultiPageClient() {
  return <StatPageClient config={EXP_PAGE} />;
}
```

`web/app/exp-multi/page.tsx`:

```tsx
import type { Metadata } from "next";
import ExpMultiPageClient from "./ExpMultiPageClient";

export const metadata: Metadata = {
  title: "EXP Multi Tracker",
  description:
    "Your Idleon Class EXP multiplier, source by source, computed from your save — per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function ExpMultiPage() {
  return <ExpMultiPageClient />;
}
```

- [ ] **Step 5: Navigation**
  - `components/TopNav.tsx`: add `{ href: "/exp-multi", label: "✨ EXP Multi" },` right after the Coin Multi item.
  - `app/page.tsx`: after the Coin Multi `ShortcutCard` add:

```tsx
        <ShortcutCard
          href="/exp-multi"
          icon="✨"
          title="EXP Multi Tracker"
          description="Every term of the game's Class EXP formula on your save, per character and map, with snapshots and a top-player comparison."
          cta="Open EXP Multi"
        />
```

  - `e2e/homepage.spec.ts`: add `{ title: "EXP Multi Tracker", desc: "Class EXP formula" },` after the Coin card.
  - `__tests__/components/TopNav.test.tsx`: add `expect(screen.getByText(/EXP Multi/i)).toBeInTheDocument();` to "renders all nav items".
  - `__tests__/components/statTracker/StatCalculator.test.tsx`: add one case rendering `<StatCalculator config={EXP_PAGE} />` (with `vi.mock("@/lib/arkh/computeExp", () => ({ computeArkhExpMulti: () => { throw new Error("stub"); } }))` at the top) asserting the loader's `storageKey` is `"exp-multi-tracker.playerName"` and the heading shows "EXP Multi Calculator".

- [ ] **Step 6: Run** `npx vitest run` (full) → PASS; `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 7: Commit**

```bash
git add lib/expMulti/pageConfig.ts app/exp-multi/ components/TopNav.tsx app/page.tsx e2e/homepage.spec.ts __tests__/components/TopNav.test.tsx __tests__/components/statTracker/StatCalculator.test.tsx __tests__/lib/expMulti/pageConfig.test.ts
git commit -m "feat(exp): EXP Multi Tracker page, nav item and home card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Coin Multi on the kit

**Files:**
- Create: `web/lib/coinMulti/pageConfig.ts`, `web/__tests__/lib/coinMulti/pageConfig.test.ts`
- Modify: `web/app/coin-multi/CoinMultiPageClient.tsx`, `web/scripts/update-top-coin.ts`, `web/__tests__/components/accountSaveOverPaste.test.tsx`, `web/__tests__/components/statTracker/StatCalculator.test.tsx`
- Delete: `web/components/coinMulti/` (3 files), `web/lib/coinMulti/storage.ts`, `web/lib/coinMulti/biggestGains.ts`, `web/lib/coinMulti/mapOptions.ts`, `web/scripts/_shared/coinClassGating.ts`, and their tests `web/__tests__/components/CoinCalculator.keepView.test.tsx`, `web/__tests__/components/CoinBiggestGains.test.tsx`, `web/__tests__/lib/coinMulti/{storage,biggestGains,mapOptions}.test.ts`, `web/__tests__/scripts/coin-class-gating.test.ts`
- Keep: `web/lib/coinMulti/format.ts`, `topCoinMulti.ts`, `topCoinMulti.meta.ts` and their tests

**Interfaces:**
- Consumes: the kit; `computeArkhCoinPools`, `combineCoinPools`; `deriveGatedTalentsFor`; `runTopCollector`.
- Produces: `COIN_PAGE: StatPageConfig`.

- [ ] **Step 1: Failing test** `web/__tests__/lib/coinMulti/pageConfig.test.ts` — pins every string the old components used, so the migration can't drift:

```ts
import { describe, it, expect } from "vitest";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";

describe("Coin Multi page config (migration keeps every key and string)", () => {
  it("keeps the old storage keys and the legacy snapshot field", () => {
    expect(COIN_PAGE.storage).toEqual({
      save: "coin-multi-tracker.last-upload.v1",
      name: "coin-multi-tracker.playerName",
      snapshots: "coin-multi-tracker.v1",
      collapse: "coin-multi.snapshot-section.collapsed.v1",
      legacyValueKey: "computedCoinMulti",
      exportPrefix: "coin-multi-snapshots",
      exportLabel: "coin-multi-tracker",
    });
  });

  it("keeps the copy", () => {
    expect(COIN_PAGE).toMatchObject({
      statName: "Coin Multi",
      gainLabel: "Coin",
      emoji: "🪙",
      calculatorTitle: "Coin Multi Calculator",
      totalLabel: "Total Coin Multi",
      errPrefix: "Coin multi compute failed",
      mapTitle: "The map sets the guild bonus world and Coins For Charon's multikill tier",
    });
    expect(COIN_PAGE.formatTotal(6.885e35)).toBe("6.88E35");
  });
});
```

- [ ] **Step 2: `pageConfig.ts`** — the strings copied verbatim from the old Coin components (`CoinCalculator` subtitle "Computes every character's monster coin multiplier from your save. Select character & map. All processing local in your browser."; `CoinBiggestGains` `METHODOLOGY_NOTE`; `CoinMultiPageClient` compare/gains titles and footer), `compute` via `import("@/lib/arkh/computeCoin")` → `computeArkhCoinMulti`, `formatTotal: formatCoinMulti`, `gains: groupedGainsModel(COIN_ROOT, COIN_GROUPS)`, `loadTop` via `import("./topCoinMulti")` → `topCoinFlatForClass`, `topMeta` from `topCoinMulti.meta`.

- [ ] **Step 3: Page** — `CoinMultiPageClient.tsx` becomes:

```tsx
"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";

export default function CoinMultiPageClient() {
  return <StatPageClient config={COIN_PAGE} />;
}
```

- [ ] **Step 4: Collector** — `update-top-coin.ts` becomes a config (keep its header comment, adjusted):

```ts
runTopCollector({
  label: "Coin Multi",
  focusBoard: "cashMulti",
  root: COIN_ROOT,
  groups: COIN_GROUPS,
  // The map feeds the guild world (⌊map/50⌋ + 1) and talent 643's multikill
  // tier. 301 (w7a1) is W7's first fighting map; 300 is a town (tier 1).
  computePools: (save, ci) => computeArkhCoinPools(save, ci, 301),
  combine: combineCoinPools,
  gated: deriveGatedTalentsFor(COIN_CLASS_TALENTS),
  outputFile: join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.ts"),
  metaFile: join(__dirname, "..", "lib", "coinMulti", "topCoinMulti.meta.ts"),
  constPrefix: "TOP_COIN",
  flatForClassFn: "topCoinFlatForClass",
  scriptName: "scripts/update-top-coin.ts",
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Tests** —
  - `StatCalculator.test.tsx`: add the Coin config the same way Task 9 added EXP (mock `@/lib/arkh/computeCoin`; name key `"coin-multi-tracker.playerName"`; heading "Coin Multi Calculator").
  - `accountSaveOverPaste.test.tsx`: `import CoinCalculator from "@/components/coinMulti/CoinCalculator"` → `import StatCalculator from "@/components/statTracker/StatCalculator"` + `import { COIN_PAGE } from "@/lib/coinMulti/pageConfig"`; `render(<CoinCalculator />)` → `render(<StatCalculator config={COIN_PAGE} />)`. Nothing else changes.
  - Delete the Coin-only tests listed above (their cases now live in `__tests__/lib/statTracker/*` and `__tests__/components/statTracker/*`), then delete the old Coin files.
  - `grep -rn "coinMulti/storage\|coinMulti/biggestGains\|coinMulti/mapOptions\|components/coinMulti\|coinClassGating" web --include=*.ts --include=*.tsx` → no hits.

- [ ] **Step 6: Run** `npx vitest run` (full) → PASS, including `coin-multi.save.test.ts` (6.88E35) and `family-guy-dr.test.ts`; `npx tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 7: Commit**

```bash
git add lib/coinMulti/pageConfig.ts app/coin-multi/CoinMultiPageClient.tsx scripts/update-top-coin.ts __tests__/components/accountSaveOverPaste.test.tsx __tests__/components/statTracker/StatCalculator.test.tsx __tests__/lib/coinMulti/pageConfig.test.ts
git rm -r components/coinMulti lib/coinMulti/storage.ts lib/coinMulti/biggestGains.ts lib/coinMulti/mapOptions.ts scripts/_shared/coinClassGating.ts __tests__/components/CoinCalculator.keepView.test.tsx __tests__/components/CoinBiggestGains.test.tsx __tests__/lib/coinMulti/storage.test.ts __tests__/lib/coinMulti/biggestGains.test.ts __tests__/lib/coinMulti/mapOptions.test.ts __tests__/scripts/coin-class-gating.test.ts
git commit -m "refactor(coin): Coin Multi runs on the statTracker kit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
