import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRegistry, gameNames } from "../../scripts/updater/registry/gen-registry";
import { FORMULA_REGISTRY } from "../../scripts/updater/registry/formula-registry.gen";
import { buildImpactReport } from "../../scripts/updater/impact";
import type { MapDiff } from "../../scripts/updater/diff";

const empty: MapDiff = { added: [], removed: [], changed: [] };

describe("gameNames: what a lib/game module ports (no @njs tags: the module is the link)", () => {
  it("block(\"<Fn>\") is _customBlock_<Fn> and each case of its dispatcher is the named block", () => {
    const text = `
      export const Foo = block("Foo", (ctx, d: string, b: number) => {
        switch (d) {
          case "Alpha":
            return 1;
          case "Beta": {
            switch (b) { case "Inner": return 2; } // a sub-case's own switch is not the dispatcher
            return 3;
          }
          case 7: // a numeric case is not a named block
            return 4;
          default:
            throw new Error(d);
        }
      });
      /** helper: its switch is no dispatcher either */
      function helper(x: string) { switch (x) { case "Elsewhere": return 0; } }
      export const Bar = block("Bar", (ctx) => 1);
      export const Cache = block("DNSM.StarSigns", (ctx, k: string) => { switch (k) { case "61": return 1; } return 0; });
    `;
    expect(gameNames("Foo.ts", text)).toEqual(["_customBlock_Foo", "Alpha", "Beta", "_customBlock_Bar"]);
  });
});

describe("buildRegistry over lib/game/njs", () => {
  const root = mkdtempSync(join(tmpdir(), "registry-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "lib/game/njs"), { recursive: true });
  mkdirSync(join(root, "lib/tome"), { recursive: true });
  mkdirSync(join(root, "data/njs-snapshot"), { recursive: true });
  writeFileSync(join(root, "lib/game/njs/Foo.ts"), 'export const Foo = block("Foo", (c, d: string) => { switch (d) { case "Alpha": return 1; case "Ternary": return 2; } return 0; });');
  writeFileSync(join(root, "lib/tome/old.ts"), "// @njs Alpha\nexport const x = 1;\n");

  it("maps both to the module, next to the @njs tags of the other roots", () => {
    expect(buildRegistry(root)).toEqual({
      _customBlock_Foo: ["lib/game/njs/Foo.ts"],
      Alpha: ["lib/game/njs/Foo.ts", "lib/tome/old.ts"],
      Ternary: ["lib/game/njs/Foo.ts"],
    });
  });

  it("an @njs tag in a lib/game module maps what it mirrors without a block of its own", () => {
    writeFileSync(join(root, "lib/game/njs/Tagged.ts"), "// @njs Gamma\nexport const y = 1;\n");
    expect(buildRegistry(root).Gamma).toEqual(["lib/game/njs/Tagged.ts"]);
    rmSync(join(root, "lib/game/njs/Tagged.ts"));
  });

  it("drops a sub-case the snapshot has no named block for (N.js writes it as a ternary: its scaffold carries the change), never the block", () => {
    writeFileSync(join(root, "data/njs-snapshot/formulas.json"), JSON.stringify({ Alpha: "x" }));
    expect(buildRegistry(root)).toEqual({ _customBlock_Foo: ["lib/game/njs/Foo.ts"], Alpha: ["lib/game/njs/Foo.ts", "lib/tome/old.ts"] });
  });
});

describe("the committed registry sees lib/game", () => {
  it("the HP table the multikill tier reads stays on the update net without lib/arkh", () => {
    expect(FORMULA_REGISTRY.MonsterRespawnTimeReset).toContain("lib/game/njs/RunCodeOfTypeXforThingY.ts");
  });

  it("maps the Sailing sub-cases and the block to lib/game/njs/Sailing.ts", () => {
    for (const name of ["_customBlock_Sailing", "BoatArtiMulti", "ArtifactBonus", "DaveyJonesBonus"]) {
      expect(FORMULA_REGISTRY[name], name).toContain("lib/game/njs/Sailing.ts");
    }
    expect(FORMULA_REGISTRY.B_UPG).toContain("lib/game/njs/Holes.ts");
  });

  it("a changed BoatArtiMulti in the impact report points at lib/game/njs/Sailing.ts", () => {
    const fDiff: MapDiff = { ...empty, changed: [{ key: "BoatArtiMulti", before: "a", after: "b" }] };
    const out = buildImpactReport(fDiff, empty, FORMULA_REGISTRY);
    expect(out).toContain("lib/game/njs/Sailing.ts");
    expect(out).not.toContain("NÃO catalogado");
  });
});
