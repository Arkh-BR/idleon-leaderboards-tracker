import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { MissingSaveKey, NotPorted, TreeTotalMismatch, UNPORTED_STEPS } from "@/lib/game/errors";
import type { StatResult } from "@/lib/statTracker/config";
import { pageError, withPageErrors } from "@/lib/statTracker/pageErrors";

const AF = "Artifact Find";

// The kit prints "<errPrefix>: <message>" when compute throws, so the engine's refusals are turned into sentences here.
describe("what the page shows when the engine refuses a save", () => {
  const OLD = { data: { CSver: 23.05 } };
  const CURRENT = { data: { CSver: 34.05 } };

  it("tells an old save (below CSver 34.05) to be reloaded, naming the missing key", () => {
    const e = pageError(OLD, new MissingSaveKey("Spelunk[49]"), AF);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toBe("This save is from an older game version (missing Spelunk[49]). Sign in or paste a fresh save.");
    // a save older than the game's load steps lib/game replays: said in words, no internal name
    expect((pageError(OLD, new MissingSaveKey(UNPORTED_STEPS), AF) as Error).message).toBe(
      "This save is from an older game version that this tracker can't update yet. Sign in or paste a fresh save."
    );
  });

  it("does not call a current save old: a missing key there passes through as the engine said it", () => {
    const miss = new MissingSaveKey("Menagerie"); // a 34.05 save has it: its absence is a gap, not age
    expect(pageError(CURRENT, miss, AF)).toBe(miss);
    expect(pageError({ data: {} }, miss, AF)).toBe(miss); // no CSver: nothing says it is old
    expect(pageError(null, miss, AF)).toBe(miss);
  });

  it("tells a bare save or an envelope missing a side key what to paste instead (old or not)", () => {
    for (const save of [OLD, CURRENT, {}]) {
      expect((pageError(save, new MissingSaveKey("envelope.tournament"), AF) as Error).message).toBe(
        "This doesn't look like a full save envelope (missing tournament). Use \"Copy for Support\" or sign in."
      );
    }
  });

  it("says the tree is incomplete when it no longer adds up to the total", () => {
    expect((pageError(CURRENT, new TreeTotalMismatch(2, 3), AF) as Error).message).toBe(
      "Artifact Find is incomplete for this save (internal check failed). Please report it."
    );
    expect((pageError(CURRENT, new TreeTotalMismatch(2, 3), "Damage") as Error).message).toBe(
      "Damage is incomplete for this save (internal check failed). Please report it."
    );
  });

  it("lets every other error through untouched", () => {
    for (const e of [new NotPorted("Sailing", "x"), new TypeError("y"), "z"]) expect(pageError(OLD, e, AF)).toBe(e);
  });

  it("withPageErrors returns the result as is and maps what compute throws", async () => {
    const ok: StatResult = { total: 1, tree: { name: "t", val: 1, fmt: "x" } };
    expect(await withPageErrors(AF, async () => ok)(CURRENT, 0, 0)).toBe(ok);
    await expect(
      withPageErrors(AF, async () => {
        throw new MissingSaveKey("Spelunk[49]");
      })(OLD, 0, 0)
    ).rejects.toThrow(/older game version \(missing Spelunk\[49\]\)/);
    const other = new NotPorted("Sailing", "x");
    await expect(
      withPageErrors(AF, () => {
        throw other; // a synchronous throw too
      })(OLD, 0, 0)
    ).rejects.toBe(other);
  });
});

// The engine stays behind each page's dynamic import(): what a pageConfig on lib/game pulls in statically (its static chunk) holds nothing of
// lib/game but errors.ts, a file with no imports. (A type-only import is erased and does not count.)
describe("the static imports of the pages on lib/game", () => {
  const local = (spec: string, from: string): string | null => {
    const base = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? `${from.replace(/[^/]*$/, "")}${spec}` : null;
    if (base === null) return null;
    const path = base.split("/").reduce<string[]>((a, p) => (p === ".." ? a.slice(0, -1) : p === "." ? a : [...a, p]), []).join("/");
    return [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`].find(existsSync) ?? null;
  };
  it.each(["lib/artifactFind/pageConfig.ts", "lib/damage/pageConfig.ts", "lib/afkGains/pageConfig.ts", "lib/expMulti/pageConfig.ts"])("%s reaches nothing of lib/game except errors.ts", (page) => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const m of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s+(?!type[ {])[^;]*?from\s*["']([^"']+)["']/gm)) {
        const next = local(m[1], file);
        if (next) walk(next);
      }
    };
    walk(page);
    expect(seen.size).toBeGreaterThan(3); // the walk followed the page's imports
    expect([...seen].filter((f) => f.startsWith("lib/game/"))).toEqual(["lib/game/errors.ts"]);
  });
});
