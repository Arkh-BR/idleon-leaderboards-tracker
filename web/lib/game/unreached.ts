// Inventory rows proven unreachable for the roots that reach them (Ruling F), declared in code as the modules declare PORTED (Ruling R):
// `scripts/njs-closure.ts --mark` renders each as `[~] … — not reached: <why>` and counts them, so a regeneration keeps them. `row` is
// the inventory's spelling of the call (`Fn(args)`), `roots` the inventory roots (as its header spells them) it is unreached from: the
// mark applies only when every root that reaches the row is one of them. __tests__/lib/game/inventory.test.ts keeps the committed
// inventory equal to the generator's output.

export type Unreached = { readonly row: string; readonly roots: readonly string[]; readonly why: string };

const DAMAGE = 'DamageDealed("Max")';
const ACC = "PlayerAccTot()";
const HP = "PlayerHPmax()";
// The Wraith form's own stats: DamageDealed (@4106332), PlayerHPmax (@4147227) and PlayerAccTot (@4151440) call them only when
// Summoning("GrimoireWraith") is 1, and the masterclass forms are not counted (the Damage page's product decision: a runtime 0)
const WRAITH = (fn: string) => `called only ${fn} when Summoning("GrimoireWraith") is 1, the Wraith form, which is a runtime 0 (the Damage page does not count the masterclass forms)`;
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
  { row: 'Summoning("Grimoire_DMG",0,0)', roots: [DAMAGE], why: WRAITH("by DamageDealed (@4106332)") },
  { row: 'Summoning("Grimoire_HP",0,0)', roots: [DAMAGE, HP], why: WRAITH("by PlayerHPmax (@4147227)") },
  { row: 'Summoning("Grimoire_ACC",0,0)', roots: [DAMAGE, ACC], why: WRAITH("by PlayerAccTot (@4151440)") },
  { row: 'Summoning("GrimoireUpgTotal",0,0)', roots: [DAMAGE, HP, ACC], why: "called only by Grimoire_DMG, Grimoire_HP and Grimoire_ACC, the Wraith form's stats, which are not reached (the form is a runtime 0)" },
  // Holes("B_UPG") @10996050: 49 calls 50, 79 and 98 (e = 1), and only 14 calls StudyBolaiaBonuses; the B_UPG slice is the whole sub-case,
  // so the walk reaches them from any B_UPG, but the only B_UPG that calls 49 is SkillStats("AllEfficiencies") (above)
  ...[50, 79, 98].map((b) => ({ row: `Holes("B_UPG",${b},1)`, roots: [DAMAGE], why: `called only in B_UPG's b == 49 branch (@10996050), and B_UPG(49) only from SkillStats("AllEfficiencies"), which is not reached` })),
  { row: 'Holes("StudyBolaiaBonuses",0,0)', roots: [DAMAGE], why: "called only in B_UPG's b == 14 branch (@10996050); Damage reaches B_UPG with 57 and 84 (and 50, 79, 98, themselves not reached)" },
  { row: 'ResearchStuff("Grid_Bonus")', roots: [DAMAGE, ACC], why: GRID_E2("the default square, Grid_Bonus(b, 0) times its counter") },
  { row: 'ResearchStuff("TotalObsLVs",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 94") },
  { row: 'ResearchStuff("TotalOccurrencesFound",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 112") },
  { row: 'ResearchStuff("OccurrencesToBeFound",0,0)', roots: [DAMAGE, ACC], why: "called only by TotalObsLVs and TotalOccurrencesFound, which Grid_Bonus calls only when 2 == e (@11177849)" },
  { row: 'Minehead("GlimboTotalTrades",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 168") },
];
