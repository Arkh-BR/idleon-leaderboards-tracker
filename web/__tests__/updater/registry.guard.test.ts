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
