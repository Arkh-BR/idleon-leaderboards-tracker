// Inventory rows proven unreachable for the roots that reach them (Ruling F), declared in code as the modules declare PORTED (Ruling R):
// `scripts/njs-closure.ts --mark` renders each as `[~] … — not reached: <why>` and counts them, so a regeneration keeps them. `row` is
// the inventory's spelling of the call (`Fn(args)`), `roots` the inventory roots (as its header spells them) it is unreached from: the
// mark applies only when every root that reaches the row is one of them. __tests__/lib/game/inventory.test.ts keeps the committed
// inventory equal to the generator's output.

export type Unreached = { readonly row: string; readonly roots: readonly string[]; readonly why: string };

const DAMAGE = 'DamageDealed("Max")';
const ACC = "PlayerAccTot()";
const HP = "PlayerHPmax()";
const MP = "PlayerMPmax()";
// The Wraith form's own stats: DamageDealed (@4106332), PlayerHPmax (@4147227) and PlayerAccTot (@4151440) call them only when
// Summoning("GrimoireWraith") is 1, and the masterclass forms are not counted (the Damage page's product decision: a runtime 0)
const WRAITH = (fn: string) => `called only ${fn} when Summoning("GrimoireWraith") is 1, the Wraith form, which is a runtime 0 (the Damage page does not count the masterclass forms)`;
const IN_ALL_EFFICIENCIES = (at: number) => `its only call site is in SkillStats("AllEfficiencies") (@${at}), which is not reached`;
// ResearchStuff("Grid_Bonus") @11177849 calls these only in its `2==e` branch (squares 94, 112, 168 and the default); every Grid_Bonus these
// roots reach is called with e = 0 (127 @4124114, 47 in StickerDMGmulti, 173 in Grid_Bonus_Allmulti)
// The dungeon branch: DamageDealed (@4106070), PlayerHPmax (@4147196), PlayerMPmax (@4150123) and PlayerSpeedBonus (@4141907, read by
// PlayerAccTot) call DungeonStat only when Dungon() != -1, and Dungon() answers -1 on every map (Ruling Y: a dungeon map is counted as
// outside a dungeon, under an assumed: leaf), so no dungeon branch runs
const DUNGEON = (via: string) => `reached only inside a dungeon, ${via}: Dungon() answers -1 on every map (Ruling Y: a dungeon map is counted as outside a dungeon, an assumed: leaf), so no dungeon branch runs`;
// The forms' own stats: called only while Windwalker("CompassTempest") (DamageDealed @4106509, PlayerHPmax @4147363, PlayerAccTot @4151577,
// PlayerSpeedBonus @4142926) or ArcaneType("TesseractArcanist") (DamageDealed @4106688, PlayerAccTot @4151683) is 1, which are runtime 0s
const FORM = (form: string, via: string) => `called only ${via} while ${form} is 1, a masterclass form, which is a runtime 0 (the Damage page does not count the masterclass forms)`;
const TEMPEST = 'Windwalker("CompassTempest")';
const TESSERACT = 'ArcaneType("TesseractArcanist")';
const GRID_E2 = (sq: string) => `within the Damage closure its only call site is ResearchStuff("Grid_Bonus")'s 2 == e branch (${sq}, @11177849); every Grid_Bonus reached is called with e = 0`;

// The AFK page's root (docs/superpowers/plans/2026-11-05-afk-gains-inventory.md): the Fighting rate only (the page's product decision)
const AFK = 'AFKgainrates("Fighting")';
// AFKgainrates opens (@4444275) with `if ("Fighting" != d) { ... }`, the ALL terms of the skill rates (TalentEnh(79), CardBonusREAL(46), GuildBonuses(7),
// CardSetBonuses(0, "7"), the sigil and chip "safk", EtcBonuses("24"), ...): the Fighting rate does not run it
const SKIP_FIGHTING = (at: number) => `its only call site (@${at}) is in the first block of AFKgainrates, \`if ("Fighting" != d)\` @4444275, which the Fighting rate skips`;
// TalentCalc(d) @4464686 guards everything with `if (-7044.5 != d) { ... return 1 }`: past it, @4520409, is the item sell price table (ItemzzSellPricesz) the
// game builds for the shop. The walk of TalentCalc(650) (its 650 == d branch @4520200 is the last of the function) runs into it; a talent id never does.
const SELL_TABLE = "called only in the table of item sell prices that follows TalentCalc's `-7044.5 != d` block (@4520409, run for d == -7044.5); the AFK rate's call is TalentCalc(650), whose branch ends at @4520200 (the walk reads on to the end of the function)";
// ResearchStuff("Grid_Bonus") @11177849: within the AFK closure its only call is Grid_Bonus(173, 0) (the Research square the Divinity bonuses read): the slice
// of that sub-case holds the other squares' branches, and the calls below are in its `2 == e` branch only
const AFK_GRID_E2 = (sq: string) => `within the AFK closure its only call site is ResearchStuff("Grid_Bonus")'s 2 == e branch (${sq}, @11177849); the only Grid_Bonus AFK reaches is Grid_Bonus(173, 0) (Divinity Bonus_Minor and Bonus_MAJOR), called with e = 0`;

export const UNREACHED: readonly Unreached[] = [
  { row: "TalentEnh(79)", roots: [AFK], why: SKIP_FIGHTING(4444575) },
  { row: 'RunCodeOfTypeXforThingY("SellPrice")', roots: [AFK], why: SELL_TABLE },
  { row: 'ActionBlock("InitItemDefinitions","no",0,0)', roots: [AFK], why: SELL_TABLE },
  { row: "Language()", roots: [AFK], why: SELL_TABLE },
  { row: 'ResearchStuff("Grid_Bonus")', roots: [AFK], why: AFK_GRID_E2("the default square, Grid_Bonus(b, 0) times its counter") },
  { row: 'ResearchStuff("TotalObsLVs",0,0)', roots: [AFK], why: AFK_GRID_E2("square 94") },
  { row: 'ResearchStuff("TotalOccurrencesFound",0,0)', roots: [AFK], why: AFK_GRID_E2("square 112") },
  { row: 'ResearchStuff("OccurrencesToBeFound",0,0)', roots: [AFK], why: "within the AFK closure called only by TotalObsLVs and TotalOccurrencesFound, which Grid_Bonus calls only when 2 == e (@11177849)" },
  { row: 'Minehead("GlimboTotalTrades",0,0)', roots: [AFK], why: AFK_GRID_E2("square 168") },
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
  { row: 'Summoning("GrimoireUpgTotal",0,0)', roots: [DAMAGE, HP, ACC], why: "within the Damage closure called only by Grimoire_DMG, Grimoire_HP and Grimoire_ACC, the Wraith form's stats, which are not reached (the form is a runtime 0); GrimoireUpgUNLOCKED @10884718 and Grimoire_DEF @10888754 also call it, outside the closure" },
  // Holes("B_UPG") @10996050: 49 calls 50, 79 and 98 (e = 1), and only 14 calls StudyBolaiaBonuses; the B_UPG slice is the whole sub-case,
  // so the walk reaches them from any B_UPG, but the only B_UPG that calls 49 is SkillStats("AllEfficiencies") (above)
  ...[50, 79, 98].map((b) => ({ row: `Holes("B_UPG",${b},1)`, roots: [DAMAGE], why: `called only in B_UPG's b == 49 branch (@10996050), and B_UPG(49) only from SkillStats("AllEfficiencies"), which is not reached` })),
  { row: 'Holes("StudyBolaiaBonuses",0,0)', roots: [DAMAGE], why: "called only in B_UPG's b == 14 branch (@10996050); Damage reaches B_UPG with 57 and 84 (and 50, 79, 98, themselves not reached)" },
  { row: 'ResearchStuff("Grid_Bonus")', roots: [DAMAGE, ACC], why: GRID_E2("the default square, Grid_Bonus(b, 0) times its counter") },
  { row: 'ResearchStuff("TotalObsLVs",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 94") },
  { row: 'ResearchStuff("TotalOccurrencesFound",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 112") },
  { row: 'ResearchStuff("OccurrencesToBeFound",0,0)', roots: [DAMAGE, ACC], why: "within the Damage closure called only by TotalObsLVs and TotalOccurrencesFound, which Grid_Bonus calls only when 2 == e (@11177849); ResearchEXPrateTOT @11169912 also calls it, outside the closure" },
  { row: 'Minehead("GlimboTotalTrades",0,0)', roots: [DAMAGE, ACC], why: GRID_E2("square 168") + "; MenagerieStuff MissionProg @5190039 also calls it, outside the closure" },
  // Task 8: the dungeon branch (DungeonStat @7831416 and the DungeonCalc traits it reads, @7841913)
  { row: 'DungeonStat("DMG")', roots: [DAMAGE], why: DUNGEON("by DamageDealed (@4106182)") },
  { row: 'DungeonStat("HP")', roots: [DAMAGE, HP], why: DUNGEON("by PlayerHPmax (@4147196) and DungeonStat(\"DMG\")") },
  { row: 'DungeonStat("Weapon_Power")', roots: [DAMAGE], why: DUNGEON("by DungeonStat(\"DMG\") (@7837921)") },
  { row: 'DungeonStat("MP")', roots: [DAMAGE, MP], why: DUNGEON("by PlayerMPmax (@4150123) and DungeonStat(\"DMG\")") },
  { row: 'DungeonStat("SPEED")', roots: [DAMAGE, ACC], why: DUNGEON("by PlayerSpeedBonus (@4141907)") },
  ...([[7, [DAMAGE]], [9, [DAMAGE]], [1, [DAMAGE]], [0, [DAMAGE, HP]], [24, [DAMAGE, HP]], [8, [DAMAGE, MP]], [2, [DAMAGE, MP]], [26, [DAMAGE, MP]]] as const).map(([n, roots]) => ({
    row: `DungeonCalc("TraitBonus",${n})`,
    roots,
    why: DUNGEON("by DungeonStat (@7831416), the dungeon run's stats"),
  })),
  { row: 'TotalStats("Dung_Power")', roots: [DAMAGE], why: DUNGEON("by DungeonStat(\"Weapon_Power\") (@7835355)") },
  // Task 8: the Compass Tempest and Tesseract Arcanist forms' stats
  { row: 'Windwalker("Compass_DMG",0,0)', roots: [DAMAGE], why: FORM(TEMPEST, "by DamageDealed (@4106667)") },
  { row: 'Windwalker("Compass_HP",0,0)', roots: [DAMAGE, HP, ACC], why: FORM(TEMPEST, "by PlayerHPmax (@4147418) and Compass_DMG / Compass_ACC (@11068128, @11069410)") },
  { row: 'Windwalker("Compass_ACC",0,0)', roots: [DAMAGE, ACC], why: FORM(TEMPEST, "by PlayerAccTot (@4151632)") },
  { row: 'Windwalker("Compass_MoveSpeed",0,0)', roots: [DAMAGE, ACC], why: FORM(TEMPEST, "by PlayerSpeedBonus (@4143036)") },
  { row: 'Windwalker("CompassUpgTotal",0,0)', roots: [DAMAGE, ACC], why: FORM(TEMPEST, "within the Damage closure by Compass_ACC (@11068592)") + "; Compass_DEF, TempestMultishotPCT, EffectAmount and ProgressStarsign also call it, outside the closure" },
  { row: 'ArcaneType("Arcane_DMG",0,0)', roots: [DAMAGE], why: FORM(TESSERACT, "by DamageDealed (@4106847)") },
  { row: 'ArcaneType("Arcane_ACC",0,0)', roots: [DAMAGE, ACC], why: FORM(TESSERACT, "by PlayerAccTot (@4151741)") },
  { row: 'ArcaneType("ArcaneUpgTotal",0,0)', roots: [DAMAGE, ACC], why: FORM(TESSERACT, "within the Damage closure by Arcane_DMG and Arcane_ACC (@11089334, @11090277)") + "; ArcaneUpgUNLOCKED, Arcane_DEF and Arcane_AttackSpdPCT also call it, outside the closure" },
  ...[0, 6, 15, 36, 50, 12, 4, 24, 31, 42, 53].map((b) => ({ row: `ArcaneType("ArcaneUpgBonus",${b},0)`, roots: [DAMAGE], why: FORM(TESSERACT, "by Arcane_DMG (@11088565)") })),
  ...[1, 9, 19, 38, 52, 22, 44, 55, 27].map((b) => ({ row: `ArcaneType("ArcaneUpgBonus",${b},0)`, roots: [DAMAGE, ACC], why: FORM(TESSERACT, "within the Damage closure by Arcane_ACC (@11089938)") })),
];
