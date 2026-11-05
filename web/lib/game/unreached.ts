// Inventory rows proven unreachable for the roots that reach them (Ruling F), declared in code as the modules declare PORTED (Ruling R):
// `scripts/njs-closure.ts --mark` renders each as `[~] … — not reached: <why>` and counts them, so a regeneration keeps them. `row` is
// the inventory's spelling of the call (`Fn(args)`), `roots` the inventory roots (as its header spells them) it is unreached from: the
// mark applies only when every root that reaches the row is one of them. __tests__/lib/game/inventory.test.ts keeps the committed
// inventory equal to the generator's output.

export type Unreached = { readonly row: string; readonly roots: readonly string[]; readonly why: string };

const DAMAGE = 'DamageDealed("Max")';
const ACC = "PlayerAccTot()";
const IN_ALL_EFFICIENCIES = (at: number) => `its only call site is in SkillStats("AllEfficiencies") (@${at}), which is not reached`;
// ResearchStuff("Grid_Bonus") @11177849 calls these only in its `2==e` branch (squares 94, 112, 168 and the default); every Grid_Bonus these
// roots reach is called with e = 0 (127 @4124114, 47 in StickerDMGmulti, 173 in Grid_Bonus_Allmulti)
const GRID_E2 = (sq: string) => `its only call site is ResearchStuff("Grid_Bonus")'s 2 == e branch (${sq}, @11177849); every Grid_Bonus reached is called with e = 0`;

export const UNREACHED: readonly Unreached[] = [
  // Divinity("BlesssBonus") @10758317 reads SkillStats("AllEfficiencies") only in its `2==b` branch; DamageDealed calls it with 7 and 8
  { row: 'SkillStats("AllEfficiencies")', roots: [DAMAGE], why: 'Damage calls Divinity("BlesssBonus") with 7 and 8, and only its b == 2 branch (@10758317) calls it' },
  { row: 'Summoning("TomeBonus",1,0)', roots: [DAMAGE], why: IN_ALL_EFFICIENCIES(4197489) },
  { row: 'Holes("B_UPG",49,15)', roots: [DAMAGE], why: IN_ALL_EFFICIENCIES(4197780) },
  { row: 'RiftStuff("RiftSkillETC",2)', roots: [DAMAGE], why: IN_ALL_EFFICIENCIES(4197736) },
  { row: "GetBuffBonuses(40,2)", roots: [DAMAGE], why: IN_ALL_EFFICIENCIES(4198250) },
  { row: 'Thingies("FriendBonusStatz",2,0)', roots: [DAMAGE], why: IN_ALL_EFFICIENCIES(4197685) },
  { row: 'ResearchStuff("Grid_Bonus")', roots: [DAMAGE, ACC], why: GRID_E2("the default square, Grid_Bonus(b, 0) times its counter") },
  { row: 'ResearchStuff("TotalObsLVs",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 94") },
  { row: 'ResearchStuff("TotalOccurrencesFound",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 112") },
  { row: 'ResearchStuff("OccurrencesToBeFound",0,0)', roots: [DAMAGE, ACC], why: "called only by TotalObsLVs and TotalOccurrencesFound, which Grid_Bonus calls only when 2 == e (@11177849)" },
  { row: 'Minehead("GlimboTotalTrades",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 168") },
];
