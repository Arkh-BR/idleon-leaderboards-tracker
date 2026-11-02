import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";
import { capeVineOff } from "./preCapeVine";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real save (gitignored golden cache); skips in CI where it's absent.
// ARKHE, 2026-10-30, captured through the site's sign-in at the same moment as
// two in-game readings of Markhe (#8) on Molten Edge (map 324). Pre-update
// readings (his worn EquipmentCape18 still counted): evaluated with the Cape
// Vine OFF. With it ON the engine reads 422,881 / 259,438.
const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-10-30.json";

describe.skipIf(!existsSync(SAVE))("DR matches the in-game reading (post Lumi/Halloween update)", () => {
  const load = () => capeVineOff(JSON.parse(readFileSync(SAVE, "utf8")));

  // The stats screen shows Math.floor(DR) once DR > 9999.
  it("Markhe on map 324 reads 448,955× in game", () => {
    expect(Math.floor(computeArkhDropRate(load(), 8, 324).total)).toBe(448955);
  });

  // Same save without the Golden Cake (food slot 0): 275,434× in game. The two
  // readings together pin the old gap to a constant +91.1 pp additive term —
  // Dank Ranks (talent 207) missing ARKHE's super-talent levels from preset 1.
  it("…and 275,434× with the Golden Cake removed", () => {
    const save = load();
    save.data.EquipOrder_8[2]["0"] = "Blank";
    expect(Math.floor(computeArkhDropRate(save, 8, 324).total)).toBe(275434);
  });
});
