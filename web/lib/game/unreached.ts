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
// The dungeon branch: DamageDealed (@4106070), PlayerHPmax (@4147196), PlayerMPmax (@4150123) and PlayerSpeedBonus (@4141907, read by
// PlayerAccTot) call DungeonStat only when Dungon() != -1, and Dungon() answers -1 on every map (Ruling Y: a dungeon map is counted as
// outside a dungeon, under an assumed: leaf), so no dungeon branch runs
const DUNGEON = (via: string) => `reached only inside a dungeon, ${via}: Dungon() answers -1 on every map (Ruling Y: a dungeon map is counted as outside a dungeon, an assumed: leaf), so no dungeon branch runs`;
// The forms' own stats: called only while Windwalker("CompassTempest") (DamageDealed @4106509, PlayerHPmax @4147363, PlayerAccTot @4151577,
// PlayerSpeedBonus @4142926) or ArcaneType("TesseractArcanist") (DamageDealed @4106688, PlayerAccTot @4151683) is 1, which are runtime 0s
const FORM = (form: string, via: string) => `called only ${via} while ${form} is 1, a masterclass form, which is a runtime 0 (the Damage page does not count the masterclass forms)`;
const TEMPEST = 'Windwalker("CompassTempest")';
const TESSERACT = 'ArcaneType("TesseractArcanist")';

// The AFK page's root (docs/superpowers/plans/2026-11-05-afk-gains-inventory.md): the Fighting rate only (the page's product decision)
const AFK = 'AFKgainrates("Fighting")';
// TalentCalc(d) @4464686 guards everything with `if (-7044.5 != d) { ... return 1 }`: past it, @4520409, is the item sell price table (ItemzzSellPricesz) the
// game builds for the shop. The walk of TalentCalc(650) (its 650 == d branch @4520200 is the last of the function) runs into it; a talent id never does.
const SELL_TABLE = "called only in the table of item sell prices that follows TalentCalc's `-7044.5 != d` block (@4520409, run for d == -7044.5); the AFK rate's call is TalentCalc(650), whose branch ends at @4520200 (the walk reads on to the end of the function)";

// The Drop Rate page's root (docs/superpowers/plans/2026-11-07-drop-rate-inventory.md): the Drop Rate of a character, outside a dungeon (Ruling Y)
const DR = 'TotalStats("Drop_Rarity")';

// The Multikill page's root (docs/superpowers/plans/2026-11-09-multikill-inventory.md): MultiKillTOTAL's OverkillStuffs("2") walk reaches DamageDealed("Max")
// and PlayerAccTot(), so it meets the Damage closure's rows, from the same call sites (Divinity("BlesssBonus") with 7 and 8, the masterclass forms, the dungeon branch)
const MK = 'WorkbenchStuff("MultiKillTOTAL")';
// the Damage entries Multikill does not reach: Holes("StudyBolaiaBonuses") is only B_UPG's b == 14 branch, and Multikill asks for none of 14
const NOT_IN_MK = new Set(['Holes("StudyBolaiaBonuses",0,0)']);

// The Coin page's root (docs/superpowers/plans/2026-11-08-coin-multi-inventory.md): the B_UPG slice is the whole sub-case, so the walk reaches the calls of branches
// the Coin path does not take: it asks B_UPG for 78 (GambitPTSmulti @11037796), and the Damage closure under TalentCalc(643) for 57 and 84
const COIN = 'ArbitraryCode("MonsterCash")';

const BASE: readonly Unreached[] = [
  { row: 'Holes("StudyBolaiaBonuses",0,0)', roots: [COIN], why: "called only in B_UPG's b == 14 branch (@10996635); the Coin path asks B_UPG for 78, and the Damage closure under TalentCalc(643) for 57 and 84" },
  { row: 'RunCodeOfTypeXforThingY("SellPrice")', roots: [AFK], why: SELL_TABLE },
  { row: 'ActionBlock("InitItemDefinitions","no",0,0)', roots: [AFK], why: SELL_TABLE },
  { row: "Language()", roots: [AFK], why: SELL_TABLE },
  { row: 'Summoning("Grimoire_DMG",0,0)', roots: [DAMAGE], why: WRAITH("by DamageDealed (@4106332)") },
  { row: 'Summoning("Grimoire_HP",0,0)', roots: [DAMAGE, HP], why: WRAITH("by PlayerHPmax (@4147227)") },
  { row: 'Summoning("Grimoire_ACC",0,0)', roots: [DAMAGE, ACC], why: WRAITH("by PlayerAccTot (@4151440)") },
  { row: 'Summoning("GrimoireUpgTotal",0,0)', roots: [DAMAGE, HP, ACC], why: "within the Damage closure called only by Grimoire_DMG, Grimoire_HP and Grimoire_ACC, the Wraith form's stats, which are not reached (the form is a runtime 0); GrimoireUpgUNLOCKED @10884718 and Grimoire_DEF @10888754 also call it, outside the closure" },
  // Holes("B_UPG") @10996050: only its b == 14 branch calls StudyBolaiaBonuses; the B_UPG slice is the whole sub-case, so the walk reaches it from any B_UPG
  { row: 'Holes("StudyBolaiaBonuses",0,0)', roots: [DAMAGE], why: "called only in B_UPG's b == 14 branch (@10996050); Damage reaches B_UPG with 57 and 84, and 49, 50, 79 and 98 under SkillStats(\"AllEfficiencies\") (Divinity(\"BlesssBonus\")'s b == 2 branch, which Damage does not take)" },
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
  // the Drop Rate's dungeon branch: TotalStats("Drop_Rarity") calls DungeonStat("DropRarity") (@4194199) only after `-1!=Dungon()` (@4194067), and
  // DungeonStat("DropRarity") (@7841168) is the only caller of DungeonCalc("TraitBonus",6) (@7841560)
  { row: 'DungeonStat("DropRarity")', roots: [DR], why: DUNGEON('by TotalStats("Drop_Rarity") (@4194199, after `-1!=Dungon()` @4194067)') },
  { row: 'DungeonCalc("TraitBonus",6)', roots: [DR], why: DUNGEON('by DungeonStat("DropRarity") (@7841560), its only call site') },
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

// An entry is per root (inventory.test.ts): each Damage entry is repeated for Multikill's root, its reason as true there as for Damage
export const UNREACHED: readonly Unreached[] = [
  ...BASE,
  ...BASE.filter((u) => u.roots.includes(DAMAGE) && !NOT_IN_MK.has(u.row)).map((u) => ({ ...u, roots: [MK], why: `${u.why}; Multikill reaches the same call sites through OverkillStuffs("2") -> DamageDealed("Max")` })),
];
