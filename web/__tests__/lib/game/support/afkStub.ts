// A synthetic AFK Ctx (a support module: vitest only collects *.test.ts): no real save, so CI runs what uses it. Every block
// AFKgainrates("Fighting") calls is answered from the Ctx cache (`seeds` over all-0 calls), so only the block's own arithmetic, its map rules
// and the page's adapter (trackers/afkGains.ts) are under test. Used by njs/afkGainsEdges.test.ts and trackers/afkGains.test.ts.
import { makeCtx, type Ctx } from "@/lib/game/ctx";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

export type Data = Record<string, unknown>;
export type Seeds = Record<string, number>;

/** Every call AFKgainrates("Fighting") makes, as the Ctx cache keys it (`name + JSON.stringify(args)`), all 0. */
export const CALLS = [
  'ArcadeBonus[6]', 'Windwalker["CompassBonus",57,0]', 'GetSetBonus["VOID_SET","Bonus",0,0]', "FlurboShop[7]", 'Divinity["Bonus_MAJOR",0,0]',
  'Divinity["Bonus_Minor",-1,5]', "Companions[6]", "Companions[25]", "Shrine[8]", "TalentCalc[650]", 'Summoning["WinBonus",11,0]',
  'GoldFoodBonuses["AllAFK"]', 'RunCodeOfTypeXforThingY["CardLv","w6d3"]', 'RunCodeOfTypeXforThingY["CardLv","w6d1"]', 'Summoning["RooBonuses",5,0]',
  'Summoning["VotingBonusz",6,0]', 'Summoning["EventShopOwned",5,0]', 'Summoning["VaultUpgBonus",23,0]', 'ArcaneType["ArcaneMapMulti_bon",2,0]',
  'EtcBonuses["92"]', 'EtcBonuses["20"]', 'EtcBonuses["59"]', 'DNSM.FamBonusQTYs["8"]', 'DNSM.BoxRewards["fightAFK"]', "GetTalentNumber[1,88]",
  "GetTalentNumber[1,268]", "GetTalentNumber[1,448]", "GetTalentNumber[1,621]", "GetTalentNumber[1,79]", 'GetBribeBonus["3"]', 'CardSetBonuses[0,"10"]',
  "CardBonusREAL[43]", 'DNSM.StarSigns["FightAFK"]', "GuildBonuses[4]", "prayersReal[4,0]", "prayersReal[12,1]", 'chipBonuses["fafk"]',
  'Holes2["Cglunko_AFKgains",0,0]',
];

/** A character 0 on map `map` (`CurrentMap_0`: `at`, default -1: never the map under test, so its saved AFK target is not kept), with `seeds` over all-0 calls. */
export function synth(data: Data, o: { map?: number; at?: number; seeds?: Seeds; trace?: boolean } = {}): Ctx {
  const map = o.map ?? 251;
  const c = makeCtx(
    buildGameState({
      data: { CurrentMap_0: o.at ?? -1, AFKtarget_0: "Mush", TaskZZ2: [[], [0, 0, 0]], ...data },
      charNames: ["c0"], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1,
    } as unknown as GameEnvelope),
    { player: 0, map, trace: o.trace }
  );
  for (const k of CALLS) c.cache.set(`0|${map}|${k}`, 0);
  for (const [k, v] of Object.entries(o.seeds ?? {})) {
    if (!CALLS.includes(k)) throw new Error(`${k} is not a call AFKgainrates makes`);
    c.cache.set(`0|${map}|${k}`, v);
  }
  return c;
}
