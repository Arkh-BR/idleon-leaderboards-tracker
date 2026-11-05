// A synthetic Damage Ctx (a support module: vitest only collects *.test.ts): no real save, so CI runs what uses it. Every block DamageDealed
// calls is answered from the Ctx cache (`stubbed`), so each value is set by hand, and only the save reads DamageDealed makes itself are in
// the save (BASE). Used by njs/damageEdges.test.ts (DamageDealed's own arithmetic) and trackers/damage.test.ts (the page's tree).
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

export type Data = Record<string, unknown>;
export const env = (data: Data): GameEnvelope =>
  ({ data, charNames: ["c0"], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 }) as unknown as GameEnvelope;

/** What DamageDealed reads from the save itself: class 1 (its first class is 1, whose primary stat is LUK), no food, nothing else. */
export const BASE: Data = {
  CharacterClass_0: 1,
  FoodSlO_0: 0,
  EquipOrder_0: [[], [], []],
  EquipQTY_0: [[], [], []],
  Lv0_0: [],
  OptLacc: [],
  Dream: [],
  Divinity: [],
  WeeklyBoss: {},
  QuestComplete_0: {},
  InventoryOrder_0: [],
  ItemQTY_0: [],
  FamValMinigameHiscores: [0],
  Menagerie: [[], [], [], [], [], [0, 0, 0]],
};

// The calls that compute instead of being answered: DamageDealed itself, the dungeon test (Dungon reads the map) and the runtime leaves
export const LIVE = /^(DamageDealed|Dungon)\[|^GetBuffBonuses\[(108|124),2\]$|^Summoning\["GrimoireWraith"|^Windwalker\["CompassTempest"|^ArcaneType\["TesseractArcanist"/;
// The two blocks whose neutral value is 1 (DN.DamageDealtLIST[2] starts at the Workbench's, [1] is times the golden food's multiplier)
const ONE: Record<string, number> = { 'WorkbenchStuff["AdditionExtraDMG",0,0]': 1, 'GoldFoodBonuses["Damage"]': 1 };

/** The cache key without its `player|map|` head: `<Fn><args as JSON>`. */
const call = (key: string) => key.slice(key.indexOf("|", key.indexOf("|") + 1) + 1);
/** A block cache that answers every call DamageDealed makes: `set` (by call) first, then 1 for ONE, else 0; LIVE calls compute. */
class Stubbed extends Map<string, number> {
  constructor(
    private readonly answers: Record<string, number>,
    private readonly live: RegExp
  ) {
    super();
  }
  override get(key: string): number | undefined {
    if (super.has(key)) return super.get(key);
    const c = call(key);
    if (this.live.test(c)) return undefined;
    return this.answers[c] ?? ONE[c] ?? 0;
  }
}
export const stubbed = (set: Record<string, number>, o: { map?: number; data?: Data; trace?: boolean; live?: RegExp } = {}): Ctx => ({
  ...makeCtx(buildGameState(env({ ...BASE, ...o.data })), { player: 0, map: o.map ?? 251, trace: o.trace }),
  cache: new Stubbed(set, o.live ?? LIVE),
});
