import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { loadSaveData } from "@/lib/arkh/save/loader";
import { saveData } from "@/lib/arkh/state";
import { computePlayerHPmax } from "@/lib/arkh/stats/systems/common/derived-stats";
import { computeAccuracy } from "@/lib/arkh/stats/systems/common/derived-damage";
import { notateBig } from "@/lib/coinMulti/format";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

// Real saves (gitignored golden cache); skips in CI where they're absent.
// ARKHE, 2026-11-03 00:27–00:54Z, each save captured at the moment of an
// in-game Player Info reading of the online character, on map 150. The panel
// shows NotateNumber(PlayerHPmax(), "Big") and NotateNumber(PlayerAccTot(),
// "Big") (N.js @6715563): ceil to the unit for HP, floor to 2 decimals in
// e-notation for accuracy.
const DIR = "scripts/updater/golden/.cache/";
type Reading = { file: string; who: string; ci: number; hp: string; acc?: string };
const READINGS: Reading[] = [
  { file: "arkhe-live-2026-11-03-markhe-weapon.json", who: "Markhe (#8, weapon)", ci: 8, hp: "344T" },
  { file: "arkhe-live-2026-11-03-arkhe.json", who: "ARKHE (#0)", ci: 0, hp: "396T" },
  { file: "arkhe-live-2026-11-03-markhe-noweapon.json", who: "Markhe (#8, no weapon)", ci: 8, hp: "338T", acc: "5.83e35" },
  { file: "arkhe-live-2026-11-03-farkhe.json", who: "farkhe (#3, Arcane Cultist)", ci: 3, hp: "771B", acc: "2.77e35" },
];

const load = ({ file, ci }: Reading) => {
  loadSaveData(JSON.parse(readFileSync(DIR + file, "utf8")));
  return { saveData, charIdx: ci, activeCharIdx: ci };
};

describe.skipIf(!READINGS.every((r) => existsSync(DIR + r.file)))("Max HP and Accuracy match the in-game Player Info", () => {
  it.each(READINGS)("$who: Max HP reads $hp", (r) => {
    expect(notateBig(computePlayerHPmax(r.ci, load(r)).val)).toBe(r.hp);
  });

  it.each(READINGS.filter((r) => r.acc))("$who: Accuracy reads $acc", (r) => {
    expect(notateBig(computeAccuracy(r.ci, load(r)))).toBe(r.acc);
  });
});
