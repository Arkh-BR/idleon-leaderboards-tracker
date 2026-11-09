// The maps a page offers when its formula reads the monster definition of the map's target (MapAFKtarget): a map whose target is not a monster has no value in
// the game, which throws there itself (Damage: TalentCalc(125) reads MonsterDefinitions[AFKtarget].Defence; Coin: OverkillStuffs and TalentCalc(125)). Today that
// drops JungleZ (3), 33 and Miningg1/2 (34, 35). Derived from the data, loaded lazily (the lists are ~1.5 MB; the compute chunk shares them).
export async function loadMonsterMapFilter(): Promise<(mapIdx: number) => boolean> {
  const { MapAFKtarget, MONSTERS } = await import("@/lib/game/data");
  return (mapIdx) => String((MapAFKtarget as unknown as readonly unknown[])[mapIdx]) in MONSTERS;
}
