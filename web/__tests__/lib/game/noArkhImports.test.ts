// lib/arkh is deleted (the MIT relicense): the directory stays gone and no committed file of the app, the scripts or the tests imports it,
// type-only imports and dynamic import() included, by the @/ alias or by a relative path.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../");
const DIRS = ["lib", "app", "components", "scripts", "__tests__"];
// the committed files only: the user's own untracked scripts under scripts/ may still import it (accepted when lib/arkh went)
const tracked = (): string[] =>
  execFileSync("git", ["ls-files", "-z", "--", ...DIRS], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f))
    .map((f) => join(ROOT, f))
    .filter((f) => existsSync(f));
// an import, export…from, import() or require() whose specifier names lib/arkh, or a relative path into a directory named arkh under lib
const ARKH = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["'](?:[^"']*\blib\/arkh\b|\.{1,2}\/(?:\.\.\/)*arkh\/)[^"']*["']/m;

describe("lib/arkh is gone", () => {
  it("the directory does not exist", () => {
    expect(existsSync(join(ROOT, "lib/arkh"))).toBe(false);
  });

  it("nothing in lib, app, components, scripts or __tests__ imports it", () => {
    const all = tracked();
    expect(all.length).toBeGreaterThan(500); // the walk really walked
    const bad = all.filter((f) => f !== __filename && ARKH.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
