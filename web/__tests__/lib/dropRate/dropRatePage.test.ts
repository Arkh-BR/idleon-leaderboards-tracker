// The V1 Drop Rate page computes on lib/game: a refused save drops its tree, and an old save gets pageError's friendly message.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MissingSaveKey } from "@/lib/game/errors";
import { pageError } from "@/lib/statTracker/pageErrors";

const ROOT = resolve(__dirname, "../../../");
const SRC = "components/dropRate/DrCalculator.tsx";

describe("the V1 Drop Rate page", () => {
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
