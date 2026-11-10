// What the Observed Max collectors share on lib/game: a page's tree read into the runner's pools (poolsOf), the grouped pages' combine with the
// page's own math (groupedCombine), and the map each character is measured on (bestMap, with the pages' rules in MAP_PICKS).
import { attr } from "../../lib/game/attr";
import { makeCtx, seedBlock, type Ctx } from "../../lib/game/ctx";
import { MapAFKtarget, MONSTERS } from "../../lib/game/data";
import { contains } from "../../lib/game/lists";
import { ArcaneType } from "../../lib/game/njs/ArcaneType";
import { getbonus2 } from "../../lib/game/njs/getbonus2";
import type { GameState } from "../../lib/game/state";
import { stateOf } from "../../lib/game/trackers/page";
import { flattenTree, nodePath } from "../../lib/dropRate/treeFlatten";
import type { GainsModel, StatResult } from "../../lib/statTracker/config";
import { groupVal, type StatGroup } from "../../lib/statTracker/groups";
import type { Pool } from "./topStatCollector";

type Node = StatResult["tree"];

/** Pools from a page tree: pool key -> the flattened path of its parent (flattenTree's scheme); the items are that parent's children, in order. A missing parent throws (the runner counts the character as refused). */
export function poolsOf(tree: Node, parents: Record<string, string>): Record<string, Pool> {
  const at = new Map<string, Node>();
  const walk = (n: Node, parent: string, siblings: Node[], i: number) => {
    const path = nodePath(parent, n, siblings, i);
    at.set(path, n);
    n.children?.forEach((c, j) => walk(c, path, n.children!, j));
  };
  walk(tree, "", [tree], 0);
  const out: Record<string, Pool> = {};
  for (const [key, path] of Object.entries(parents)) {
    const n = at.get(path);
    if (!n) throw new Error(`poolsOf: no node at "${path}"`);
    out[key] = { items: [...(n.children ?? [])] };
  }
  return out;
}

/** The combine of a grouped page (pools keyed by group key): each group's node holds its items at groupVal, the root the page model's total. */
export function groupedCombine(root: string, groups: readonly StatGroup[], model: Pick<GainsModel, "totalFromFlat">): (pools: Record<string, Pool>) => StatResult {
  return (pools) => {
    const children = groups.map((g) => {
      const items = pools[g.key]?.items ?? [];
      return { name: g.name, val: groupVal(g, items.map((i) => i.val)), children: items };
    });
    const tree: Node = { name: root, val: 0, children };
    tree.val = model.totalFromFlat(flattenTree(tree));
    return { tree, total: tree.val };
  };
}

type MapPick = { score: (c: Ctx) => number; accept: (map: number) => boolean };

/** The accepted map with the highest score for character `ci` (ties: the lowest index). No accepted map throws. */
export function bestMap(save: unknown, ci: number, score: MapPick["score"], accept: MapPick["accept"]): number {
  const state = stateOf(save);
  let best = -1;
  let top = -Infinity;
  for (let m = 0; m < MapAFKtarget.length; m++) {
    if (!accept(m)) continue;
    const s = score(makeCtx(state, { player: ci, map: m }));
    if (s > top) [best, top] = [m, s];
  }
  // ponytail: lib/arkh's DR/AFK pickers fell back to the character's own map when every score was 0 (no kills anywhere); here that is the lowest accepted map.
  if (best < 0) throw new Error(`bestMap: no map passes the filter for character ${ci}`);
  return best;
}

const targets = MapAFKtarget as unknown as readonly string[];
/** The map's default AFK target is a monster to fight (MonsterDefinitions AFKtype). */
const isFight = (m: number) => (MONSTERS as unknown as Record<string, { AFKtype?: string } | undefined>)[targets[m]]?.AFKtype === "FIGHTING";
/**
 * A call that reads no map, computed once per save and character (on map 0) and seeded on `c`'s cache, so scoring ~300 maps doesn't redo it on
 * each: getbonus2(d, b, -1) loops every character's talent levels (~30 ms a call). Only for calls whose subtree never reads ctx.map.
 */
const once = new WeakMap<GameState, Map<string, number>>();
function mapFree(c: Ctx, name: string, args: (string | number)[], call: (c0: Ctx) => number): void {
  let known = once.get(c.state);
  if (!known) once.set(c.state, (known = new Map()));
  const key = `${c.player}|${name}${JSON.stringify(args)}`;
  let v = known.get(key);
  if (v === undefined) known.set(key, (v = call(makeCtx(c.state, { player: c.player, map: 0 }))));
  seedBlock(c, name, args, v);
}
/** The Arcane map bonus' cap: 100 x (getbonus2(1, 589, -1) - 1) + min(10, ArcaneUpgBonus 58), no map read. */
const seedCap = (c: Ctx) => mapFree(c, "ArcaneType", ["ArcaneMapMulti_bonMAX", 0, 0], (c0) => ArcaneType(c0, "ArcaneMapMulti_bonMAX", 0, 0));
/** ArcaneType("ArcaneMapMulti_bon", slot) on the Ctx's map: N.js reads slot 0 in TotStatMAP (Drop_Rarity), 1 in ExpGainLUK5, 2 in AFKgainzzALLmulti. */
const arcane = (slot: number) => (c: Ctx) => (seedCap(c), ArcaneType(c, "ArcaneMapMulti_bon", slot, 0));
/** max(1, getbonus2(1, 429, -1)), the Shiny Medallion talent, account-wide. */
const shiny = (c: Ctx) => (mapFree(c, "getbonus2", [1, 429, -1], (c0) => getbonus2(c0, 1, 429, -1)), Math.max(1, getbonus2(c, 1, 429, -1)));

/** Each page's map rule for bestMap: the map terms its stat reads, on the maps the page measures. */
export const MAP_PICKS: Record<"dr2" | "afk" | "exp", MapPick> = {
  // Drop Rate: the Cove (216) replaces the total, so it is left out
  dr2: { score: arcane(0), accept: (m) => m !== 216 && isFight(m) },
  // AFK: also Clamworks (306), which takes the rate x0.2
  afk: { score: arcane(2), accept: (m) => m !== 216 && m !== 306 && isFight(m) },
  // EXP: slot 1 times the Shiny Medallion gate (GenINFO[17]: Compass[3] holds the map's MapAFKtarget, then x max(1, getbonus2(1, 429, -1)))
  exp: {
    score: (c) => (1 + arcane(1)(c) / 100) * (contains(attr(c, "Compass", 3), targets[c.map]) ? shiny(c) : 1),
    accept: () => true,
  },
};
