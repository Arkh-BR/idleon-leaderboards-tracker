# Cooking Mastery Optimizer — A11y, Copy & Accent Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one coordinated PR that fixes four small UI/UX polish issues on the Cooking Mastery "💡 Biggest Gains" ROI table and its shared Tree-view chrome, all raised by the IDL-26 automated UI/UX sweep: table accessibility (IDL-74), Value/pt column jargon (IDL-75), the hero banner rounding tiny gains to "+0" (IDL-76), and the reused DeepView controls clashing with the Cooking page's emerald/gold accent (IDL-79).

**Architecture:** All four fixes land in `web/components/cookingMastery/MasteryOptimizer.tsx` (IDL-74/75/76) plus a small themable-accent addition to the shared `web/components/dropRate/DeepView.tsx` (IDL-79), wired from `MasteryOptimizer.tsx`. No new files, no new dependencies, no schema/API changes — pure presentational fixes.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Tailwind CSS 3.4, Vitest + `@testing-library/react` (`happy-dom` environment).

## Global Constraints

- Site language is English — every UI string you write or change must be English (code comments can be whatever).
- Do **not** merge to `main` or open the PR against `main`. Base branch is `idl-20-cooking-biggest-gains` (this is a **stacked** branch/PR, same pattern already used by PR #8 `idl-22-talents-front-door` → base `idl-21-talents-biggest-gains-shell`). PR #7 (`idl-20-cooking-biggest-gains` → `main`) is still open/unmerged; that's expected and not your concern.
- Every line number cited below was read directly off `idl-20-cooking-biggest-gains` HEAD (commit `a58bcea`) — this branch already contains the IDL-20 harmonization ("💡 Biggest Gains" rename, the emerald hero banner, `notate()`), which is why the exact lines match the four source issues.
- No full `npm run build` / `next lint` — both are pre-existingly broken on `main` (unrelated prerender + missing-ESLint issues), not something this task fixes. Verification is `vitest` + `tsc --noEmit` + a manual browser check, per the CTO's guard on this cluster.
- Use the existing Tailwind utility `sr-only` for visually-hidden text (built into Tailwind 3.4, no config change needed) — don't hand-roll a clip-rect class.
- Test runner: from the `web/` directory, `npm run test -- <path>` (Vitest, `happy-dom`). Test files live under `web/__tests__/components/`, alias `@/` resolves to `web/`.
- Scope is strictly these 4 issues on this one component (+ the DeepView accent prop it consumes). Do not touch IDL-73/IDL-77 (cancelled, out of scope) or anything under `web/components/dropRate/DeepView.tsx` beyond the accent prop.

---

### Task 1: Fix `notate()` rounding tiny Exp/h deltas to "0" (IDL-76)

**Files:**
- Modify: `web/components/cookingMastery/MasteryOptimizer.tsx:15-23` (the `notate` function)
- Test: Create `web/__tests__/components/MasteryOptimizer.test.tsx`

**Interfaces:**
- Produces: `notate(n: number): string` — must now be `export function notate(...)` (was private to the module) so the test file can import it directly: `import { notate } from "@/components/cookingMastery/MasteryOptimizer";`. Later tasks (2, 3) add more named exports from the same file; this task establishes the file's export pattern.

**Root cause:** The hero "Biggest win" banner (line 139) renders `+{notate(bestNext.marginalGain)} Exp/h`. For `0 < marginalGain < 1` (a real but tiny per-point gain, common late-game when one upgrade is nearly maxed), `notate()`'s branch `a < 10 && !Number.isInteger(n) ? n.toFixed(2) : ...` calls `n.toFixed(2)`, which rounds anything under 0.005 down to `"0.00"` — reading as "+0 Exp/h" right next to a genuinely non-zero `+X.XX%` on the line below (line 151, `marginalGainPct.toFixed(2)`), which looks contradictory.

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/components/MasteryOptimizer.test.tsx
import { describe, it, expect } from "vitest";
import { notate } from "@/components/cookingMastery/MasteryOptimizer";

describe("notate", () => {
  it("keeps a visible significant figure for tiny deltas instead of rounding to 0.00", () => {
    expect(notate(0.003)).not.toBe("0.00");
    expect(notate(0.003)).not.toBe("0");
    expect(notate(0.003)).toContain("3");
  });

  it("still renders whole numbers and large values exactly as before", () => {
    expect(notate(0)).toBe("0");
    expect(notate(3)).toBe("3");
    expect(notate(4.567)).toBe("4.57");
    expect(notate(12_345)).toBe("12.35K");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm run test -- __tests__/components/MasteryOptimizer.test.tsx`
Expected: FAIL — `notate` is not exported yet (import error), or once exported, `notate(0.003)` returns `"0.00"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/components/cookingMastery/MasteryOptimizer.tsx
/** Compact k/M/B/T number formatting for Exp/h and large counts. Keeps 1-2
 * significant figures for sub-1 deltas instead of rounding them away —
 * a tiny-but-real marginal gain must never read as "+0". */
export function notate(n: number): string {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(2) + "K";
  if (a > 0 && a < 1) return n.toPrecision(2);
  return a < 10 && !Number.isInteger(n) ? n.toFixed(2) : String(Math.round(n));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- __tests__/components/MasteryOptimizer.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add web/components/cookingMastery/MasteryOptimizer.tsx web/__tests__/components/MasteryOptimizer.test.tsx
git commit -m "fix(cooking): keep significant figures for tiny Exp/h deltas (IDL-76)"
```

---

### Task 2: Clarify the "Value/pt" column (IDL-75)

**Files:**
- Modify: `web/components/cookingMastery/MasteryOptimizer.tsx:186` (header) and `:251` (cell), inside `OptimizerTable` / `AllocRow`
- Test: Append to `web/__tests__/components/MasteryOptimizer.test.tsx`

**Interfaces:**
- Consumes: `RoiRow` from `web/lib/cookingMastery/optimize.ts` — already has a precomputed `valuePerPt: number` field (`base·coef`) that the current code ignores in favor of re-deriving the raw `${row.base}×${row.coef}` string.
- Produces: `export function AllocRow({ row, best }: { row: RoiRow; best: boolean })` and `export function OptimizerTable({ result }: { result: OptimizeResult })` — export both (currently private to the module) so Task 3's tests can render them directly with a hand-built `RoiRow[]`/`OptimizeResult` fixture instead of going through the full save-parsing pipeline (`loadSaveData` → `readMasteryInputs` → `optimize`), which needs a raw save envelope this test suite doesn't have a fixture for.

**Root cause:** Line 186 header `Value/pt` has no tooltip/explanation (the only explanation lives in a footnote at 204-211, easy to miss). Line 251 renders the raw factors `${row.base.toFixed(1)}×${row.coef}` (e.g. "12.0×3") instead of the product a reader actually wants.

- [ ] **Step 1: Write the failing test**

```tsx
// append to web/__tests__/components/MasteryOptimizer.test.tsx
import { render, screen } from "@testing-library/react";
import { OptimizerTable } from "@/components/cookingMastery/MasteryOptimizer";
import type { OptimizeResult, RoiRow } from "@/lib/cookingMastery/optimize";

function makeRow(overrides: Partial<RoiRow> & { id: number }): RoiRow {
  return {
    name: `Upgrade ${overrides.id}`,
    unlocked: true,
    rankReq: 0,
    base: 12,
    coef: 3,
    valuePerPt: 36,
    currentPts: 1,
    optimalPts: 2,
    marginalGain: 100,
    marginalGainPct: 1.5,
    ...overrides,
  };
}

function makeResult(rows: RoiRow[], bestUpgradeId: number | null): OptimizeResult {
  return {
    pools: { purpleTotal: 10, purpleSpent: 4, purpleAvailable: 6, yellowTotal: 0 },
    current: { purple: [], expRate: 1000, expRateCore: 1000 },
    optimal: { purple: [], expRate: 1200, expRateCore: 1200 },
    gainPct: 20,
    externalMulti: 1,
    calibrated: false,
    bestUpgradeId,
    roi: rows,
  };
}

describe("OptimizerTable — Value/pt column", () => {
  it("shows the computed product, not the raw base×coef string", () => {
    const rows = [makeRow({ id: 0, base: 12, coef: 3, valuePerPt: 36 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    expect(screen.getByText("36.0")).toBeInTheDocument();
    expect(screen.queryByText("12.0×3")).not.toBeInTheDocument();
  });

  it("gives the Value/pt header an explanatory tooltip", () => {
    const rows = [makeRow({ id: 0 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    const header = screen.getByText("Value/pt");
    expect(header.getAttribute("title")).toMatch(/base stat.*coefficient/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- __tests__/components/MasteryOptimizer.test.tsx`
Expected: FAIL — `OptimizerTable`/`AllocRow` aren't exported yet, and once exported, the cell still shows `"12.0×3"` and the header has no `title`.

- [ ] **Step 3: Write minimal implementation**

In `web/components/cookingMastery/MasteryOptimizer.tsx`, change the two function declarations to exported, update the header and the cell:

```tsx
export function OptimizerTable({ result }: { result: OptimizeResult }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th scope="col" className="text-left font-medium px-3 py-2">Upgrade</th>
              <th
                scope="col"
                className="text-right font-medium px-3 py-2"
                title="Base stat × mastery coefficient = % Exp/h added per point invested"
              >
                Value/pt
              </th>
              <th scope="col" className="text-right font-medium px-3 py-2">Current</th>
              <th scope="col" className="text-right font-medium px-3 py-2">Optimal</th>
              <th scope="col" className="text-right font-medium px-3 py-2">ROI /pt</th>
            </tr>
          </thead>
          {/* ...tbody unchanged... */}
```

(The `scope="col"` additions above are Task 3's fix — included here since both tasks touch the same five `<th>` cells; land them together in this step to avoid a churny two-step diff on the same lines.)

In `AllocRow`, replace just the Value/pt `<td>` (was line 250-252) — everything else in the function (the `delta`/`isExpSource` computation above it, the Upgrade/Current/Optimal/ROI cells below it) stays unchanged:

```tsx
      <td
        className="px-3 py-2 text-right tabular-nums text-zinc-400"
        title={isExpSource ? `${row.base.toFixed(1)} × ${row.coef}` : undefined}
      >
        {isExpSource ? row.valuePerPt.toFixed(1) : "—"}
      </td>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- __tests__/components/MasteryOptimizer.test.tsx`
Expected: PASS (4 tests total)

- [ ] **Step 5: Commit**

```bash
git add web/components/cookingMastery/MasteryOptimizer.tsx web/__tests__/components/MasteryOptimizer.test.tsx
git commit -m "fix(cooking): show computed Value/pt product + explain the column (IDL-75)"
```

---

### Task 3: Table accessibility — scope, caption, non-color cues (IDL-74)

**Files:**
- Modify: `web/components/cookingMastery/MasteryOptimizer.tsx` — `OptimizerTable` (`<table>`/`<thead>`, ~179-201) and `AllocRow` (~223-283)
- Test: Append to `web/__tests__/components/MasteryOptimizer.test.tsx`

**Interfaces:**
- Consumes: `OptimizerTable`/`AllocRow` exports from Task 2, `makeRow`/`makeResult` fixtures already defined in the test file.
- Produces: nothing new consumed by later tasks.

**Root cause / AC:**
1. `<th>` cells have no `scope="col"` (fixed already in Task 3's slice of Task 2's Step 3 above — verify, don't re-add).
2. No `<caption>` — a screen reader announces "table, 5 columns, N rows" with zero context.
3. Three cues are color-only: the emerald "next" chip (currently just says "next"), the 🔒 lock (currently "🔒 rank {req}", no word "Locked"), and the +/- delta (currently relies on the leading sign character alone with color for emphasis).

- [ ] **Step 1: Write the failing test**

```tsx
// append to web/__tests__/components/MasteryOptimizer.test.tsx
describe("OptimizerTable — accessibility", () => {
  it("gives every column header a scope", () => {
    const rows = [makeRow({ id: 0 })];
    const { container } = render(<OptimizerTable result={makeResult(rows, 0)} />);
    const headers = container.querySelectorAll("th");
    expect(headers).toHaveLength(5);
    headers.forEach((th) => expect(th.getAttribute("scope")).toBe("col"));
  });

  it("has a visually-hidden caption describing the table", () => {
    const rows = [makeRow({ id: 0 })];
    const { container } = render(<OptimizerTable result={makeResult(rows, 0)} />);
    const caption = container.querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption).toHaveClass("sr-only");
    expect(caption?.textContent).toMatch(/purple pts|roi|upgrade/i);
  });

  it("labels the best-upgrade chip with text, not color alone", () => {
    const rows = [makeRow({ id: 0 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    expect(screen.getByText("Next best")).toBeInTheDocument();
  });

  it("spells out 'Locked' instead of relying on the 🔒 emoji alone", () => {
    const rows = [makeRow({ id: 1, unlocked: false, rankReq: 42 })];
    render(<OptimizerTable result={makeResult(rows, null)} />);
    expect(screen.getByText(/Locked \(rank 42\)/)).toBeInTheDocument();
  });

  it("gives the +/- delta an explicit text alternative for color-blind users", () => {
    const rows = [makeRow({ id: 0, currentPts: 1, optimalPts: 3 })];
    render(<OptimizerTable result={makeResult(rows, 0)} />);
    expect(screen.getByLabelText(/increase of 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- __tests__/components/MasteryOptimizer.test.tsx`
Expected: FAIL on the caption / "Next best" / "Locked" / `aria-label` assertions (the `scope="col"` one should already pass if Task 2's Step 3 landed the `scope="col"` change — if you're doing these tasks out of order, this test fails too).

- [ ] **Step 3: Write minimal implementation**

Add a `<caption>` as the first child of `<table>` in `OptimizerTable`:

```tsx
        <table className="w-full text-sm">
          <caption className="sr-only">
            Cooking Mastery Purple PTS return-on-investment per upgrade — value
            per point, current vs. optimal allocation, and marginal ROI.
          </caption>
          <thead className="bg-zinc-900 text-zinc-400">
```

In `AllocRow`, rename the "next" chip to "Next best":

```tsx
        {best && (
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
            Next best
          </span>
        )}
```

Spell out "Locked" next to the lock emoji:

```tsx
        {!row.unlocked && (
          <span className="ml-2 text-[11px] text-zinc-500">
            🔒 Locked (rank {row.rankReq})
          </span>
        )}
```

Give the delta an explicit `aria-label` so a screen reader states direction and magnitude, not just the glyph:

```tsx
        {delta !== 0 && isExpSource && row.unlocked && (
          <span
            className={`ml-1 text-[11px] ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
            aria-label={delta > 0 ? `increase of ${delta}` : `decrease of ${Math.abs(delta)}`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- __tests__/components/MasteryOptimizer.test.tsx`
Expected: PASS (9 tests total)

- [ ] **Step 5: Commit**

```bash
git add web/components/cookingMastery/MasteryOptimizer.tsx web/__tests__/components/MasteryOptimizer.test.tsx
git commit -m "fix(cooking): add table caption, th scope and text alternatives for color cues (IDL-74)"
```

---

### Task 4: Themable accent for the reused DeepView tab strip/controls (IDL-79)

**Files:**
- Modify: `web/components/dropRate/DeepView.tsx:643-679` (props) and the 4 hardcoded-sky spots at `~799-808`, `~812-820`, `~825-833`, `~841-849` (tab buttons), `~866` (search input focus border), `~922` and `~936` (checkbox `accent-*`)
- Modify: `web/components/cookingMastery/MasteryOptimizer.tsx:159-173` (the `<DeepView .../>` call) — pass the new prop
- Test: Create `web/__tests__/components/DeepView.accent.test.tsx`

**Interfaces:**
- Produces: `export type DeepViewAccent = "sky" | "emerald"` and `export function deepViewAccentClasses(accent: DeepViewAccent): { tabActive: string; focusBorder: string; checkbox: string }` from `DeepView.tsx`, plus a new optional `accent?: DeepViewAccent` prop on the `DeepView` component (default `"sky"`, preserving today's look for every existing caller — Drop Rate, Talents — with zero behavior change).

**Root cause / scope decision:** The tab strip (~799-849) and controls bar (~858-940) hardcode `sky-500` Tailwind classes, clashing with Cooking's emerald "gain" accent + gold chrome. Tailwind's JIT compiler only picks up classes that appear as complete literal strings in source, so the fix **must** use a static lookup table, not a template-literal like `` `bg-${accent}-500/15` `` (that string would never make it into the compiled CSS). Scope is limited to the 4 cited spots (tab active state, checkbox accent, search focus border) — the deeper `TreeRow` hover colors (lines ~475, ~492, ~517) are shared row-rendering code used identically by every DeepView caller and are **not** part of this fix; leave them alone. Per this cluster's guidance, the reused Search/Hide-inactive/Show-notes controls and the "depth < 2 open" Reset tooltip are **kept as-is** — they're generically accurate for any tree (including Cooking's multi-branch upgrade tree) and removing them would be new scope, not a fix for this issue.

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/components/DeepView.accent.test.tsx
import { describe, it, expect } from "vitest";
import { deepViewAccentClasses } from "@/components/dropRate/DeepView";

describe("deepViewAccentClasses", () => {
  it("defaults every caller to the existing sky classes (no visual change for Drop Rate/Talents)", () => {
    const c = deepViewAccentClasses("sky");
    expect(c.tabActive).toContain("bg-sky-500/15");
    expect(c.tabActive).toContain("text-sky-300");
    expect(c.focusBorder).toBe("focus:border-sky-500/60");
    expect(c.checkbox).toBe("accent-sky-500");
  });

  it("provides an emerald variant for the Cooking page", () => {
    const c = deepViewAccentClasses("emerald");
    expect(c.tabActive).toContain("bg-emerald-500/15");
    expect(c.tabActive).toContain("text-emerald-300");
    expect(c.focusBorder).toBe("focus:border-emerald-500/60");
    expect(c.checkbox).toBe("accent-emerald-500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- __tests__/components/DeepView.accent.test.tsx`
Expected: FAIL — `deepViewAccentClasses` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Add near the top of `web/components/dropRate/DeepView.tsx` (alongside the other exported types, e.g. right before `export type DeepViewExtraTab`):

```tsx
/** Accent theme for the tab strip + controls bar. "sky" is the original
 * Drop Rate/Talents look (default, zero behavior change for existing
 * callers); "emerald" matches the Cooking page's gain accent. Tailwind's
 * JIT compiler only keeps classes that appear as full literal strings in
 * source, so this MUST be a static lookup — never template-interpolate
 * the color name into a class string. */
export type DeepViewAccent = "sky" | "emerald";

export function deepViewAccentClasses(accent: DeepViewAccent) {
  const table = {
    sky: {
      tabActive: "bg-sky-500/15 text-sky-300 border-sky-500/40 border-b-transparent",
      focusBorder: "focus:border-sky-500/60",
      checkbox: "accent-sky-500",
    },
    emerald: {
      tabActive: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 border-b-transparent",
      focusBorder: "focus:border-emerald-500/60",
      checkbox: "accent-emerald-500",
    },
  } as const;
  return table[accent];
}
```

Add the prop to the component signature (default `"sky"`):

```tsx
export default function DeepView({
  tree,
  baseline,
  showWorldView = true,
  extraTabs = [],
  bare = false,
  treeTabLabel = "🌳 Tree",
  onViewChange,
  defaultView = "tree",
  extraTabsFirst = false,
  accent = "sky",
}: {
  tree: ArkhNode | null;
  baseline?: Baseline;
  showWorldView?: boolean;
  extraTabs?: DeepViewExtraTab[];
  bare?: boolean;
  treeTabLabel?: string;
  onViewChange?: (view: ViewMode) => void;
  defaultView?: ViewMode;
  extraTabsFirst?: boolean;
  /** Tab strip + controls-bar color theme. Defaults to "sky" (today's
   *  Drop Rate/Talents look). Pass "emerald" from pages whose accent
   *  clashes with sky (e.g. Cooking). */
  accent?: DeepViewAccent;
}) {
  const ac = deepViewAccentClasses(accent);
  // ...rest of the function body unchanged down to the tab strip...
```

Replace the 4 tab-button active-class ternaries (each currently `` view === X ? "bg-sky-500/15 text-sky-300 border-sky-500/40 border-b-transparent" : "..." ``) with `` view === X ? ac.tabActive : "..." ``. There are 4 occurrences — the `extraTabsFirst` map, the built-in Tree button, the built-in World button, and the non-`extraTabsFirst` map. Example (Tree button):

```tsx
        <button
          type="button"
          onClick={() => setView("tree")}
          className={`px-3 py-1.5 text-sm font-medium rounded-t -mb-px border ${
            view === "tree" ? ac.tabActive : "text-zinc-400 hover:text-zinc-200 border-transparent"
          }`}
          title="Formula hierarchy — pool → source → sub-source"
        >
          {treeTabLabel}
        </button>
```

Replace the search input's focus border class:

```tsx
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Search source name or note…"
          className={`flex-1 min-w-[200px] px-2 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none ${ac.focusBorder}`}
        />
```

Replace both checkbox `className="accent-sky-500"` with `className={ac.checkbox}`.

Finally, in `web/components/cookingMastery/MasteryOptimizer.tsx`, pass the new prop on the existing `<DeepView .../>` call:

```tsx
      <DeepView
        tree={tree}
        showWorldView={false}
        defaultView="optimizer"
        extraTabsFirst
        treeTabLabel="🌳 Tree"
        accent="emerald"
        extraTabs={[
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- __tests__/components/DeepView.accent.test.tsx`
Expected: PASS (2 tests)

Then run the full targeted suite plus a type-check, since this task touches two files' public signatures:

Run: `npm run test -- __tests__/components/MasteryOptimizer.test.tsx __tests__/components/DeepView.accent.test.tsx`
Expected: PASS (11 tests total)

Run (from `web/`): `npx tsc --noEmit`
Expected: no new errors in `components/dropRate/DeepView.tsx` or `components/cookingMastery/MasteryOptimizer.tsx` (pre-existing unrelated errors elsewhere, if any, are not this task's concern — confirm by checking the file list in `tsc`'s output only mentions files this plan didn't touch, or none at all).

- [ ] **Step 5: Commit**

```bash
git add web/components/dropRate/DeepView.tsx web/components/cookingMastery/MasteryOptimizer.tsx web/__tests__/components/DeepView.accent.test.tsx
git commit -m "fix(cooking): themable DeepView accent so the Cooking tree tab isn't sky-blue (IDL-79)"
```

---

## Final verification (after Task 4)

- [ ] Run the whole targeted test file set once more: `npm run test -- __tests__/components/MasteryOptimizer.test.tsx __tests__/components/DeepView.accent.test.tsx` → all green.
- [ ] `npx tsc --noEmit` from `web/` → no new errors.
- [ ] Do **not** start a local dev server (`npm run dev`) — that's a standing project rule. The automated tests above already assert the actual rendered DOM (scope, caption, text content, class names), which is the real evidence for this visual/a11y fix. Once the PR is opened, the Vercel preview deploy is the place to eyeball the Cooking page's "💡 Biggest Gains" tab (Value/pt shows one product number, "Next best"/"Locked (rank N)" text, emerald tab/checkbox accent) and the Drop Rate Deep View (still sky, unchanged) — treat that as a nice-to-have confirmation, not a blocking gate.
- [ ] Hand off to the Code Reviewer per the standard pipeline with the branch name and a summary referencing IDL-74, IDL-75, IDL-76, IDL-79.
