// The maps the Damage page offers. The game has no Damage value on a map whose MapAFKtarget is not a monster (TalentCalc(125) reads
// MonsterDefinitions[AFKtarget].Defence and the game itself would throw), so they are not offered: JungleZ (3), 33 and Miningg1/2 (34, 35).
// Derived from the data, loaded lazily (the lists are ~1.5 MB; the compute chunk shares them).
export async function loadDamageMapFilter(): Promise<(mapIdx: number) => boolean> {
  const { MapAFKtarget, MONSTERS } = await import("@/lib/game/data");
  return (mapIdx) => String((MapAFKtarget as unknown as readonly unknown[])[mapIdx]) in MONSTERS;
}
