// A synthetic EXP Ctx (a support module: vitest only collects *.test.ts): no real save, so CI runs what uses it. Every block ExpMulti(0) calls
// answers 0 from the Ctx cache unless a test seeds it (ZeroCache), so only the block's own arithmetic, its map rules and the page's adapter
// (trackers/expMulti.ts) are under test. Used by njs/expMultiEdges.test.ts and trackers/expMulti.test.ts.
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

export type Data = Record<string, unknown>;
export type Seeds = Record<string, number>;

/** A Ctx cache that answers 0 for any block not seeded, and leaves `ExpMulti` and the `real` blocks (key prefixes) to their code. */
class ZeroCache extends Map<string, number> {
  constructor(private real: readonly string[]) {
    super();
  }
  override get(key: string): number | undefined {
    if (super.has(key)) return super.get(key);
    const name = key.slice(key.indexOf("|", key.indexOf("|") + 1) + 1);
    if (name.startsWith("ExpMulti[") || this.real.some((r) => name.startsWith(r))) return undefined;
    return 0;
  }
}

export const BASE: Data = {
  Lv0_0: [100, 0], Lv0_1: [100, 0], WeeklyBoss: {}, Compass: [[], [], [], []], OptLacc: Array<number>(700).fill(0), Divinity: Array<number>(40).fill(0),
  Spelunk: [[], [], [], [], [], [], []], TaskZZ2: [[0, 0, 0]], CSetEq_0: {}, BundlesReceived: {}, Meals: [Array<number>(80).fill(0)], Ribbon: Array<number>(130).fill(0),
};

/** A character 0 (and, with `chars` 2, a second one) on `map`, `seeds` over all-0 blocks, the blocks in `real` left to their code. */
export function synth(data: Data, o: { map?: number; chars?: number; seeds?: Seeds; real?: string[]; player?: number; trace?: boolean; serverVars?: unknown } = {}): Ctx {
  const map = o.map ?? 251;
  const chars = o.chars ?? 1;
  const c = makeCtx(
    buildGameState({
      data: { ...BASE, CurrentMap_0: -1, AFKtarget_0: "Mush", ...data },
      charNames: Array.from({ length: chars }, (_, i) => `c${i}`), companion: null, guildData: {}, serverVars: o.serverVars ?? null, tournament: {}, accountCreateTime: 1, lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: o.player ?? 0, map, trace: o.trace }
  );
  const cache = new ZeroCache(o.real ?? []);
  for (const [k, v] of Object.entries(o.seeds ?? {})) cache.set(`${c.player}|${map}|${k}`, v);
  return { ...c, cache };
}

/** Workbench 1 over all-0 blocks: the total is 1 + (the flat % points)/100 times the groups. */
export const WB: Seeds = { 'WorkbenchStuff["AdditionExtraEXPnDR",0,0]': 1 };
