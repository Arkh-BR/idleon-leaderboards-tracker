# Updater Redesign — Phase 1: Formula Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `formulas` extraction layer to the updater so it detects changes to N.js *gameplay logic* (not just data), and cross-references each change against a code-derived registry so the report points at the exact ported file(s) to review.

**Architecture:** A new `extract-formulas.ts` captures the N.js custom-blocks (`if("<Name>"==d)return <expr>` / `{<block>}`) into `formulas.json`, diffed with the existing generic `diff.ts`. A registry built by scanning `// @njs <name>` annotations in `web/lib` (regex scan, not AST — kept simple for v1) maps each formula/mirrored-constant to the file(s) that port it. A CI guard test keeps the registry in sync with the annotations. The impact report splits every change into "mapped → review file X" vs "⚠️ uncatalogued → investigate" (the safety net).

**Tech Stack:** TypeScript, Node (tsx), vitest (`__tests__/**/*.test.ts`, run from `web/`). Reuses `normalizeBundle` from `scripts/updater/extract.ts` and `diffMaps` from `scripts/updater/diff.ts`.

**All commands run from `web/`.**

---

## File Structure

- Create: `web/scripts/updater/extract-formulas.ts` — captures custom-block formulas from a normalized bundle.
- Create: `web/scripts/updater/registry/gen-registry.ts` — scans `web/lib` for `@njs` annotations → `{name: files[]}`.
- Create: `web/scripts/updater/registry/formula-registry.gen.ts` — generated registry (committed).
- Create: `web/scripts/updater/impact.ts` — cross-references diffs against the registry.
- Modify: `web/scripts/updater/extract.ts` — `extractAll` also returns `formulas`.
- Modify: `web/scripts/updater/run.ts` — snapshot/diff `formulas`, emit impact section.
- Modify: `web/lib/arkh/stats/systems/common/friend.ts` — add `// @njs FriendBonusQTY`.
- Modify: `web/lib/arkh/stats/systems/w7/gallery.ts` — add `// @njs HatrackBonusMulti`.
- Modify: `web/lib/arkh/stats/systems/common/cookingMastery.ts` — add `// @njs RandoListo2[8]`.
- Test: `web/__tests__/updater/extract-formulas.test.ts`
- Test: `web/__tests__/updater/impact.test.ts`
- Test: `web/__tests__/updater/registry.guard.test.ts`

---

### Task 1: Formula extractor

**Files:**
- Create: `web/scripts/updater/extract-formulas.ts`
- Test: `web/__tests__/updater/extract-formulas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/updater/extract-formulas.test.ts
import { describe, it, expect } from "vitest";
import { extractFormulas } from "../../scripts/updater/extract-formulas";

describe("extractFormulas", () => {
  it("captures return-style gameplay custom-blocks by name", () => {
    const src =
      `z._cb=function(d,b){if("FriendBonusQTY"==d)return 0==b?100*Math.min(1.5,.25):25;` +
      `if("HatrackBonusMulti"==d)return 1+(a+b)/100;}`;
    const f = extractFormulas(src);
    expect(f["FriendBonusQTY"]).toBe("0==b?100*Math.min(1.5,.25):25");
    expect(f["HatrackBonusMulti"]).toBe("1+(a+b)/100");
  });

  it("captures block-style custom-blocks", () => {
    const src = `z._cb=function(d,b){if("FooStatz"==d){a.x=1;return 2}}`;
    const f = extractFormulas(src);
    expect(f["FooStatz"]).toBe("{a.x=1;return 2}");
  });

  it("does not break on `;` or `}` inside strings", () => {
    const src = `z._cb=function(d){if("Quip"==d)return "a;b}c";}`;
    const f = extractFormulas(src);
    expect(f["Quip"]).toBe(`"a;b}c"`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/updater/extract-formulas.test.ts`
Expected: FAIL — cannot resolve `../../scripts/updater/extract-formulas`.

- [ ] **Step 3: Write the implementation**

```ts
// web/scripts/updater/extract-formulas.ts
// ===== Idleon updater — formula extractor =====
// Captures the game's named gameplay custom-blocks from the N.js bundle:
//   if("<Name>"==d)return <expr>;     and     if("<Name>"==d){<block>}
// `d` is the gameplay dispatcher arg. Returns { name -> expr/block text } so
// two versions can be diffed at the LOGIC level (curve reworks, new terms),
// which a data-only diff can't see. Input must be the normalized bundle
// (extractAll passes the normalizeBundle() output; tests pass clean fixtures).

const BLOCK_RE = /if\("([A-Za-z][A-Za-z0-9_]*)"==d\)/g;

/** Reads a `return <expr>;` or a balanced `{<block>}` starting at `start`.
 *  String/paren/brace aware so `;` or `}` inside strings or nested calls
 *  don't terminate it early. Returns the text and the index just past it. */
function readBody(src: string, start: number): { text: string; end: number } | null {
  if (src.startsWith("{", start)) {
    let depth = 0, i = start, inStr: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
    }
    return { text: src.slice(start, i), end: i };
  }
  if (src.startsWith("return", start)) {
    let i = start + 6, depth = 0, inStr: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
      else if (c === ";" && depth === 0) break;
    }
    return { text: src.slice(start + 6, i).trim(), end: i };
  }
  return null;
}

export function extractFormulas(norm: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(norm))) {
    const body = readBody(norm, BLOCK_RE.lastIndex);
    if (body) {
      out[m[1]] = body.text; // last write wins on duplicate names
      BLOCK_RE.lastIndex = body.end;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/updater/extract-formulas.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/scripts/updater/extract-formulas.ts web/__tests__/updater/extract-formulas.test.ts
git commit -m "feat(updater): formula extraction layer (N.js custom-blocks)"
```

---

### Task 2: Wire `formulas` into the snapshot

**Files:**
- Modify: `web/scripts/updater/extract.ts` (the `extractAll` function near line 334)
- Modify: `web/scripts/updater/run.ts`
- Test: `web/__tests__/updater/extract-formulas.test.ts` (add one case)

- [ ] **Step 1: Add a failing test for `extractAll.formulas`**

Append to `web/__tests__/updater/extract-formulas.test.ts`:

```ts
import { extractAll } from "../../scripts/updater/extract";

describe("extractAll", () => {
  it("includes a formulas map", () => {
    const src = `z._cb=function(d){if("MonsterCash"==d)return 5;}`;
    const out = extractAll(src);
    expect(out.formulas["MonsterCash"]).toBe("5");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/updater/extract-formulas.test.ts`
Expected: FAIL — `out.formulas` is undefined.

- [ ] **Step 3: Add `formulas` to `extractAll` and the `ExtractResult` type**

In `web/scripts/updater/extract.ts`, change the `ExtractResult` type (near line 24) to:

```ts
export type ExtractResult = Pick<Snapshot, "items" | "lists" | "strings"> & {
  formulas: Record<string, string>;
};
```

Add the import at the top (after the existing imports, ~line 16):

```ts
import { extractFormulas } from "./extract-formulas";
```

Replace `extractAll` (near line 334) with:

```ts
export function extractAll(src: string): ExtractResult {
  const norm = normalizeBundle(src);
  return {
    items: extractItems(norm),
    lists: extractLists(norm),
    strings: extractStrings(norm),
    formulas: extractFormulas(norm),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/updater/extract-formulas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Snapshot + diff `formulas` in run.ts**

In `web/scripts/updater/run.ts`:

Add to the `P` paths object (near line 91):

```ts
  formulas: resolve(SNAP_DIR, "formulas.json"),
```

In `main()`, after the existing `prev` block that reads items/lists/strings (near line 265), add `formulas` to it:

```ts
  const prev: Pick<Snapshot, "items" | "lists" | "strings"> & { formulas: Record<string, string> } = {
    items: readJson(P.items, {}),
    lists: readJson(P.lists, {}),
    strings: readJson(P.strings, []),
    formulas: readJson(P.formulas, {}),
  };
```

After the existing `stringsDiff` line (near line 272), add:

```ts
  const formulasDiff = diffMaps(prev.formulas, cur.formulas);
```

In the non-`--dry` persist block (near line 293) add:

```ts
    writeJson(P.formulas, cur.formulas);
```

In the console summary (near line 303), add:

```ts
  console.log(`  Fórmulas ➕${formulasDiff.added.length} ➖${formulasDiff.removed.length} ✏️${formulasDiff.changed.length}`);
```

- [ ] **Step 6: Verify the updater runs and writes formulas.json**

Run: `npx tsx scripts/updater/run.ts --no-fetch --dry`
Expected: console shows a `Fórmulas …` line with non-zero counts; no crash. (Uses the repo-root `N.js`; `--dry` writes nothing.)

- [ ] **Step 7: Commit**

```bash
git add web/scripts/updater/extract.ts web/scripts/updater/run.ts web/__tests__/updater/extract-formulas.test.ts
git commit -m "feat(updater): snapshot and diff the formulas layer"
```

---

### Task 3: Formula registry (generated from `@njs` annotations)

**Files:**
- Create: `web/scripts/updater/registry/gen-registry.ts`
- Create: `web/scripts/updater/registry/formula-registry.gen.ts` (generated, then committed)
- Modify: `web/lib/arkh/stats/systems/common/friend.ts`
- Modify: `web/lib/arkh/stats/systems/w7/gallery.ts`
- Modify: `web/lib/arkh/stats/systems/common/cookingMastery.ts`

- [ ] **Step 1: Seed three `@njs` annotations**

In `web/lib/arkh/stats/systems/common/friend.ts`, immediately above `export const friend = {` add:

```ts
// @njs FriendBonusQTY
```

In `web/lib/arkh/stats/systems/w7/gallery.ts`, immediately above `export function hatrackBonusMulti(` add:

```ts
// @njs HatrackBonusMulti
```

In `web/lib/arkh/stats/systems/common/cookingMastery.ts`, immediately above `export const MASTERY_COEF` add:

```ts
// @njs RandoListo2[8]
```

- [ ] **Step 2: Write the generator**

```ts
// web/scripts/updater/registry/gen-registry.ts
// Builds the formula registry by scanning `// @njs <name>` annotations across
// the ported engines. The registry maps each N.js formula/mirrored-constant
// name to the file(s) that port it. Regex scan (not AST) — simple and enough
// for "which file(s) to review". Run via gen() to (re)write the .gen.ts.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = join(__dirname, "../../..");
const ROOTS = ["lib/arkh", "lib/tome", "lib/cookingMastery", "lib/talentsLevel", "lib/dropRate"];
const ANNOT = /\/\/\s*@njs\s+([A-Za-z][A-Za-z0-9_]*(?:\[[0-9]+\])?)/g;

function walk(dir: string, acc: string[]): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (e.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

export function buildRegistry(webRoot: string = WEB_ROOT): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const root of ROOTS) {
    for (const file of walk(join(webRoot, root), [])) {
      const txt = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      ANNOT.lastIndex = 0;
      while ((m = ANNOT.exec(txt))) {
        const rel = relative(webRoot, file).replace(/\\/g, "/");
        (map[m[1]] ??= []).push(rel);
      }
    }
  }
  for (const k of Object.keys(map)) map[k] = [...new Set(map[k])].sort();
  return map;
}

export function renderRegistry(map: Record<string, string[]>): string {
  const sorted: Record<string, string[]> = {};
  for (const k of Object.keys(map).sort()) sorted[k] = map[k];
  return (
    "// AUTO-GENERATED by registry/gen-registry.ts — DO NOT EDIT.\n" +
    "// Maps each N.js formula / mirrored-constant (@njs annotations) to the ported file(s).\n" +
    "export const FORMULA_REGISTRY: Record<string, string[]> = " +
    JSON.stringify(sorted, null, 2) +
    ";\n"
  );
}

function gen(): void {
  const out = join(__dirname, "formula-registry.gen.ts");
  writeFileSync(out, renderRegistry(buildRegistry()), "utf8");
  console.log(`[registry] wrote ${out} (${Object.keys(buildRegistry()).length} entries)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) gen();
```

Add this import at the top of the file (with the other node imports):

```ts
import { pathToFileURL } from "node:url";
```

- [ ] **Step 3: Generate the registry**

Run: `npx tsx scripts/updater/registry/gen-registry.ts`
Expected: writes `formula-registry.gen.ts`; console reports `3 entries`.

- [ ] **Step 4: Verify the generated content**

Run: `npx tsx -e "import('./scripts/updater/registry/formula-registry.gen.ts').then(m=>console.log(JSON.stringify(m.FORMULA_REGISTRY)))"`
Expected: JSON containing keys `FriendBonusQTY`, `HatrackBonusMulti`, `RandoListo2[8]`, each pointing at the right file path(s).

- [ ] **Step 5: Commit**

```bash
git add web/scripts/updater/registry/ web/lib/arkh/stats/systems/common/friend.ts web/lib/arkh/stats/systems/w7/gallery.ts web/lib/arkh/stats/systems/common/cookingMastery.ts
git commit -m "feat(updater): formula registry generated from @njs annotations"
```

---

### Task 4: CI guard — registry stays in sync

**Files:**
- Test: `web/__tests__/updater/registry.guard.test.ts`

- [ ] **Step 1: Write the guard test**

```ts
// web/__tests__/updater/registry.guard.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRegistry, WEB_ROOT } from "../../scripts/updater/registry/gen-registry";
import { FORMULA_REGISTRY } from "../../scripts/updater/registry/formula-registry.gen";

describe("formula registry guard", () => {
  it("is in sync with @njs annotations (regenerate if this fails)", () => {
    expect(buildRegistry()).toEqual(FORMULA_REGISTRY);
  });

  it("every registry name exists in the N.js snapshot", () => {
    const formulas = JSON.parse(
      readFileSync(resolve(WEB_ROOT, "data/njs-snapshot/formulas.json"), "utf8"),
    ) as Record<string, string>;
    const lists = JSON.parse(
      readFileSync(resolve(WEB_ROOT, "data/njs-snapshot/lists.json"), "utf8"),
    ) as Record<string, unknown>;
    for (const name of Object.keys(FORMULA_REGISTRY)) {
      const base = name.replace(/\[[0-9]+\]$/, ""); // RandoListo2[8] -> RandoListo2
      expect(name in formulas || base in lists, `${name} missing from snapshot`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Ensure the snapshot has a formulas.json to check against**

Run: `npx tsx scripts/updater/run.ts --no-fetch`
Expected: writes `data/njs-snapshot/formulas.json` (advances the baseline from the repo-root `N.js`). This makes the second guard assertion meaningful.

- [ ] **Step 3: Run the guard**

Run: `npx vitest run __tests__/updater/registry.guard.test.ts`
Expected: PASS (2 tests). If "in sync" fails, run `npx tsx scripts/updater/registry/gen-registry.ts` and commit.

- [ ] **Step 4: Commit**

```bash
git add web/__tests__/updater/registry.guard.test.ts web/data/njs-snapshot/formulas.json
git commit -m "test(updater): CI guard keeps registry in sync with @njs"
```

---

### Task 5: Impact report — cross-reference diffs with the registry

**Files:**
- Create: `web/scripts/updater/impact.ts`
- Test: `web/__tests__/updater/impact.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/updater/impact.test.ts
import { describe, it, expect } from "vitest";
import { buildImpactReport } from "../../scripts/updater/impact";
import type { MapDiff } from "../../scripts/updater/diff";

const empty: MapDiff = { added: [], removed: [], changed: [] };

describe("buildImpactReport", () => {
  const registry = {
    FriendBonusQTY: ["lib/arkh/stats/systems/common/friend.ts"],
    "RandoListo2[8]": ["lib/arkh/stats/systems/common/cookingMastery.ts"],
  };

  it("points a mapped formula change at its ported file", () => {
    const fDiff: MapDiff = { ...empty, changed: [{ key: "FriendBonusQTY", before: "x", after: "y" }] };
    const out = buildImpactReport(fDiff, empty, registry);
    expect(out).toContain("FriendBonusQTY");
    expect(out).toContain("friend.ts");
    expect(out).toContain("revise");
  });

  it("flags an uncatalogued formula change as needing investigation", () => {
    const fDiff: MapDiff = { ...empty, changed: [{ key: "SomeNewThing", before: "1", after: "2" }] };
    const out = buildImpactReport(fDiff, empty, registry);
    expect(out).toContain("SomeNewThing");
    expect(out).toContain("NÃO catalogado");
  });

  it("maps a changed list to a mirrored constant", () => {
    const lDiff: MapDiff = { ...empty, changed: [{ key: "RandoListo2", before: [1], after: [2] }] };
    const out = buildImpactReport(empty, lDiff, registry);
    expect(out).toContain("cookingMastery.ts");
    expect(out).toContain("espelhada");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/updater/impact.test.ts`
Expected: FAIL — cannot resolve `../../scripts/updater/impact`.

- [ ] **Step 3: Write the implementation**

```ts
// web/scripts/updater/impact.ts
// Cross-references the formula/list diffs against the FORMULA_REGISTRY so each
// change becomes an actionable line: mapped -> "revise <file>", or uncatalogued
// -> the safety-net "investigate" flag. Mirrored constants (registry keys like
// "RandoListo2[8]") connect a changed LIST to the ported file that hardcodes it.
import type { MapDiff } from "./diff";

export function buildImpactReport(
  formulasDiff: MapDiff,
  listsDiff: MapDiff,
  registry: Record<string, string[]>,
): string {
  const lines: string[] = ["## Impacto nas fórmulas portadas", ""];

  const formulaChanges: [string, string][] = [
    ...formulasDiff.added.map((k): [string, string] => ["adicionada", k]),
    ...formulasDiff.removed.map((k): [string, string] => ["removida", k]),
    ...formulasDiff.changed.map((c): [string, string] => ["alterada", c.key]),
  ];
  for (const [kind, name] of formulaChanges) {
    const files = registry[name];
    if (files) lines.push(`- 🔧 \`${name}\` ${kind} → revise: ${files.join(", ")}`);
    else lines.push(`- ⚠️ \`${name}\` ${kind} — NÃO catalogado: investigar (port faltando ou fonte nova)`);
  }

  // Mirrored constants: a registry key "List[idx]" ties a changed list to a file.
  for (const c of listsDiff.changed) {
    for (const [name, files] of Object.entries(registry)) {
      const base = name.replace(/\[[0-9]+\]$/, "");
      if (base === c.key && base !== name) {
        lines.push(`- 🪞 \`${c.key}\` mudou → constante espelhada (${name}) em: ${files.join(", ")}`);
      }
    }
  }

  if (formulaChanges.length === 0 && lines.length === 2) {
    lines.push("_Nenhuma fórmula portada tocada por este update._");
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run __tests__/updater/impact.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/scripts/updater/impact.ts web/__tests__/updater/impact.test.ts
git commit -m "feat(updater): impact report cross-references diffs with registry"
```

---

### Task 6: Emit the impact section in the updater report

**Files:**
- Modify: `web/scripts/updater/run.ts`

- [ ] **Step 1: Import the registry and the impact builder in run.ts**

Near the other `./` imports at the top of `web/scripts/updater/run.ts`:

```ts
import { buildImpactReport } from "./impact";
import { FORMULA_REGISTRY } from "./registry/formula-registry.gen";
```

- [ ] **Step 2: Add the impact section to the report string**

In `main()`, in the array passed to `[...].join("\n")` that builds the `report` (near line 278), add `impactSection` right after the `section("Listas / constantes", …)` entry:

```ts
    buildImpactReport(formulasDiff, listsDiff, FORMULA_REGISTRY),
```

(`formulasDiff` is already defined from Task 2; `listsDiff` already exists.)

- [ ] **Step 3: Verify the report includes the impact section**

Run: `npx tsx scripts/updater/run.ts --no-fetch --dry`
Expected: no crash. (With the repo-root `N.js` equal to the baseline, the impact section prints "_Nenhuma fórmula portada tocada…_"; against a real update it lists the touched formulas.)

- [ ] **Step 4: Run the whole updater test suite**

Run: `npx vitest run __tests__/updater/`
Expected: PASS (all updater tests).

- [ ] **Step 5: Full type-check**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing `__tests__/components/*` `apiKey/label` errors — none in `scripts/updater/**` or the touched `lib/**` files.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/updater/run.ts
git commit -m "feat(updater): emit ported-formula impact section in the report"
```

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- `formulas` extraction layer → Task 1–2. ✓
- Registry generated from `@njs` (no hand-maintained doc) → Task 3. ✓
- CI guard keeps registry in sync + names exist in snapshot → Task 4. ✓
- Safety net (uncatalogued change flagged) → Task 5 (`⚠️ NÃO catalogado`). ✓
- Mirrored constants (`RandoListo2[8]` → cookingMastery) → Task 3 seed + Task 5. ✓
- Impact report wired into the updater → Task 6. ✓
- Out of Phase 1 (later plans): re-sync diff vs it-source, golden harness, cron/agent/PR/push. Noted in spec §A/§B/§5/§8.

**Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output.

**Type consistency:** `extractFormulas(norm: string)` used identically in Task 1/2; `ExtractResult.formulas` added in Task 2 and consumed in `run.ts`; `buildRegistry`/`WEB_ROOT`/`FORMULA_REGISTRY` names consistent across Task 3/4/6; `buildImpactReport(formulasDiff, listsDiff, registry)` signature identical in Task 5/6; `MapDiff` imported from `./diff` (existing export).

**Known follow-ups for later phases:**
- Expand `@njs` coverage across the ~49 arkh systems (guard's DR-pool coverage check, spec §2); intentionally incremental.
- **Extractor scope:** Phase 1 captures only `if("<Name>"==d)…` blocks. Capturing `_customBlock_X=function` bodies (~226) and non-`d` dispatchers (`==a/b/c`, ~26) is deferred — needed when ported logic changes INSIDE one of those functions without changing the outer `==d` block. The motivating misses (FriendBonusQTY, HatrackBonusMulti) are `==d` blocks, so they're covered; this closes the residual gap.
