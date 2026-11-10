// The /drop-rate page's map picker: every map with an Arcane map bonus, plus each character's own map (CurrentMap_N), with the bonus as a `dr *= factor`.
// The factor is the game's, ArcaneType("ArcaneMapMulti_bon", 0) (N.js @11087291, the slot TotStatMAP reads for Drop_Rarity): min(the cap, ArcaneMapMulti of
// MapBon[map][0]).

import { attr } from "@/lib/game/attr";
import { makeCtx, seedBlock } from "@/lib/game/ctx";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { stateOf } from "@/lib/game/trackers/page";
import { MAP_NAMES } from "./mapNames";

export type MapOption = {
  index: number;
  name: string;
  kills: number;
  factor: number;
  label: string;
};

const TOWN: MapOption = { index: 0, name: "Town (no AC)", kills: 0, factor: 1, label: "Town (no AC)" };

/** The map list for the page's <select>, by index, "Town (no AC)" first so the user can clear the bonus. */
export function buildMapOptions(save: unknown): MapOption[] {
  const data = (save as { data?: Record<string, unknown> })?.data ?? {};
  let mapBon: readonly unknown[] = [];
  let factorOf = (_m: number) => 1;
  try {
    const state = stateOf(save);
    // the cap reads no map and no character (getbonus2(1, 589, -1) is the best over all of them): computed once, seeded on each map's Ctx
    const c0 = makeCtx(state, { player: 0, map: 0 });
    const cap = ArcaneType(c0, "ArcaneMapMulti_bonMAX", 0, 0);
    const mb = attr(c0, "MapBon");
    mapBon = Array.isArray(mb) ? mb : [];
    factorOf = (m) => {
      const ctx = makeCtx(state, { player: 0, map: m });
      seedBlock(ctx, "ArcaneType", ["ArcaneMapMulti_bonMAX", 0, 0], cap);
      return 1 + ArcaneType(ctx, "ArcaneMapMulti_bon", 0, 0) / 100;
    };
  } catch {
    // ponytail: a save lib/game refuses gets Town + the characters' maps at 1x; the DR compute shows why it refuses
  }
  const killsOf = (m: number) => (Array.isArray(mapBon[m]) ? Number((mapBon[m] as unknown[])[0]) || 0 : 0);
  const option = (index: number): MapOption => {
    const kills = killsOf(index);
    const factor = kills >= 1 ? factorOf(index) : 1;
    const name = (MAP_NAMES[index] || `Map ${index}`).replace(/_/g, " ");
    return { index, name, kills, factor, label: factor > 1 ? `${name} (${factor.toFixed(2)}x)` : `${name} (no AC)` };
  };

  const opts: MapOption[] = [TOWN];
  const added = new Set<number>([0]);
  for (let i = 1; i < mapBon.length; i++) {
    if (killsOf(i) < 1) continue;
    const o = option(i);
    if (o.factor <= 1) continue;
    opts.push(o);
    added.add(i);
  }
  // every character's own map, even without a bonus, so picking a character jumps to its map instead of falling back to Town
  for (const k in data) {
    if (!k.startsWith("CurrentMap_")) continue;
    const idx = Number(data[k]);
    if (!Number.isFinite(idx) || added.has(idx)) continue;
    opts.push(option(idx));
    added.add(idx);
  }
  return opts.sort((a, b) => (a.index === 0 ? -1 : b.index === 0 ? 1 : a.index - b.index));
}
