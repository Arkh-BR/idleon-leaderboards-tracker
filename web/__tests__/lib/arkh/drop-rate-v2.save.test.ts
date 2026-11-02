import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhDropRateV2 } from "@/lib/arkh/computeDropRateV2";
import { formatDropRateV2 } from "@/lib/dropRateV2/format";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-10-30, captured through the site's sign-in at the same moment as
// two in-game readings of Markhe (#8) on Molten Edge (map 324) — the same
// readings V1's dr-live-2026-10-30.save.test.ts pins.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-10-30.json";

describe.skipIf(!existsSync(SAVE))("Drop Rate V2 matches the in-game reading", () => {
  const load = () => JSON.parse(readFileSync(SAVE, "utf8"));

  // The character panel shows Math.floor(DR) once DR > 9999.
  it("Markhe on map 324 reads 448,955× in game", () => {
    expect(formatDropRateV2(computeArkhDropRateV2(load(), 8, 324).total)).toBe("448955");
  });

  // Same save without the Golden Cake (food slot 0): 275,434× in game.
  it("…and 275,434× with the Golden Cake removed", () => {
    const save = load();
    save.data.EquipOrder_8[2]["0"] = "Blank";
    expect(formatDropRateV2(computeArkhDropRateV2(save, 8, 324).total)).toBe("275434");
  });
});
