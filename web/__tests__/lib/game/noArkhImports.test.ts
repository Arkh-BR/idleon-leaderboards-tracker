// Ruling KK: lib/game must not depend on lib/arkh at runtime (the MIT relicense goal). Walks the static import graph from every
// lib/game/trackers/*.ts through every web/lib file they reach, and fails on any non-type import of lib/arkh. Type-only imports are fine.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../");
const norm = (p: string) => relative(ROOT, p).replace(/\\/g, "/");
const resolveFile = (from: string, spec: string): string | null => {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};
/** The runtime import specifiers of a source file: `import type ...` and imports whose every specifier is `type X` are erased and skipped. */
const runtimeImports = (src: string): string[] => {
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?([^;]*?)\s+from\s+"([^"]+)"/gms)) {
    if (m[1]) continue;
    const named = /^\{([^}]*)\}$/.exec(m[2].trim());
    if (named && named[1].split(",").map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith("type "))) continue;
    out.push(m[3]);
  }
  for (const m of src.matchAll(/^\s*import\s+"([^"]+)"/gm)) out.push(m[1]);
  return out;
};
// every web/lib file the walk reaches is followed (lib/tome too: DNSM.TomeQTYtot no longer runs it, the Tome score is lib/game's own)
const followed = (rel: string) => rel.startsWith("lib/");

const walk = (roots: string[]) => {
  const todo = [...roots];
  const seen = new Set<string>();
  const bad: string[] = [];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const spec of runtimeImports(readFileSync(f, "utf8"))) {
      const to = resolveFile(f, spec);
      if (!to) continue;
      const rel = norm(to);
      if (rel.startsWith("lib/arkh/")) bad.push(`${norm(f)} -> ${rel}`);
      else if (followed(rel)) todo.push(to);
    }
  }
  return { seen, bad };
};
const tsIn = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => join(dir, f));

describe("lib/game imports no lib/arkh at runtime (Ruling KK)", () => {
  it("through the trackers' static import graph", () => {
    const { seen, bad } = walk(tsIn(join(ROOT, "lib/game/trackers")));
    expect(seen.size).toBeGreaterThan(20); // the walk really walked
    expect(bad).toEqual([]);
  });
  it("through lib/talentsLevel (the Talents page)", () => {
    const { seen, bad } = walk(tsIn(join(ROOT, "lib/talentsLevel")));
    expect(seen.size).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });
  it("through lib/tome (the Tome page)", () => {
    const { seen, bad } = walk(tsIn(join(ROOT, "lib/tome")));
    expect(seen.size).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });
});

describe("the Observed Max collectors import no lib/arkh at runtime", () => {
  it("scripts/_shared/*.ts and scripts/update-top-*.ts", () => {
    const dir = join(ROOT, "scripts");
    const files = [...tsIn(join(dir, "_shared")), ...tsIn(dir).filter((f) => /update-top-[^\\/]*\.ts$/.test(f))];
    expect(files.length).toBeGreaterThan(8);
    const { bad } = walk(files);
    expect(bad).toEqual([]);
  });
});

describe("the diagnostic tools import no lib/arkh at runtime", () => {
  it("characterize, lib/diagnose, scripts/dr-debug and the updater's golden harness", () => {
    const dir = join(ROOT, "scripts");
    const files = [join(dir, "characterize.ts"), ...tsIn(join(ROOT, "lib/diagnose")), ...tsIn(join(dir, "dr-debug")), ...tsIn(join(dir, "updater/golden"))];
    expect(files.length).toBeGreaterThan(12);
    const { bad } = walk(files);
    expect(bad).toEqual([]);
  });
});
