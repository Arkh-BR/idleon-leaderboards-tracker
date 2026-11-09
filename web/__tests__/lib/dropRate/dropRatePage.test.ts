// The V1 Drop Rate page computes on lib/game: its dynamic import path reaches no runtime lib/arkh (Ruling KK), and an old save
// gets pageError's friendly message.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MissingSaveKey } from "@/lib/game/errors";
import { pageError } from "@/lib/statTracker/pageErrors";

const ROOT = resolve(__dirname, "../../../");
const SRC = "components/dropRate/DrCalculator.tsx";
const resolveFile = (from: string, spec: string): string | null => {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};
/** Static and dynamic import specifiers that survive compilation (`import type` is erased). */
const runtimeSpecs = (src: string): string[] => [
  ...[...src.matchAll(/^\s*(?:import|export)\s+(?!type\s)[^;]*?\s+from\s+"([^"]+)"/gms)].map((m) => m[1]),
  ...[...src.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]),
];

describe("the V1 Drop Rate page", () => {
  it("reaches no runtime lib/arkh from DrCalculator, dynamic import included", () => {
    const todo = [join(ROOT, SRC)];
    const seen = new Set<string>();
    const bad: string[] = [];
    while (todo.length) {
      const f = todo.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      for (const spec of runtimeSpecs(readFileSync(f, "utf8"))) {
        const to = resolveFile(f, spec);
        if (!to) continue;
        const rel = relative(ROOT, to).split("\\").join("/");
        if (rel.startsWith("lib/arkh/")) bad.push(`${relative(ROOT, f)} -> ${rel}`);
        else if ((rel.startsWith("lib/") && !rel.startsWith("lib/game/data") && !rel.startsWith("lib/tome/")) || rel.startsWith("components/dropRate/")) todo.push(to);
      }
    }
    expect([...seen].some((f) => f.split("\\").join("/").endsWith("lib/game/trackers/dropRateV1.ts"))).toBe(true); // the dynamic import was followed
    expect(bad).toEqual([]);
  });

  it("tells no player the number reads low, and drops a refused save's tree", () => {
    const src = readFileSync(join(ROOT, SRC), "utf8");
    expect(src).not.toMatch(/May read|lower than in-game/);
    expect(src).toMatch(/catch \(e\) \{\s*if \(!cancelled\) \{\s*setDrTree\(null\);\s*setDrTotal\(null\);/);
  });

  it("shows an old save's error as the friendly message", () => {
    expect(readFileSync(join(ROOT, SRC), "utf8")).toContain('pageError(save, e, "Drop Rate")');
    const e = pageError({ data: { CSver: 1 } }, new MissingSaveKey("Lv0_0"), "Drop Rate") as Error;
    expect(e.message).toMatch(/older game version/);
  });
});
