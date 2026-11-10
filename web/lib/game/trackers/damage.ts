// The Damage tracker: the page's { tree, total } for N.js DamageDealed("Max") (the Damage line of Player Info, Min ~ Max), built from the ONE
// traced call, with DamageDealed("Mastery") beside it (Min = Max x Mastery, the page's headline reads it from the Mastery node).
//
// The number is TRACKERS.damage (DamageDealed "Max", njs/DamageDealed.ts). The tree is read out of the trace: each source finds the call(s)
// it stands for among DamageDealed's direct calls (by block and arguments, each call once, in call order), takes their values, and carries
// the calls' own N.js trace as children; a number DamageDealed reads from the save itself (no call) is a leaf. The layers, steps and names
// are display (lib/damage/layers.ts and the table below, the names lib/arkh's tree has: the page's Biggest Gains and the Observed Max data
// are keyed by them); a step's value is only what it shows, so the total never comes from the tree. On map 43 the Royal Guardian arena
// replaces Max before anything else is computed (@4106216): the tree is the arena and Mastery only.
//
// The trace below a source is trimmed (Ruling L, trackers/page.ts). The head guards DamageDealed passes before Max (the three masterclass
// forms, and on a dungeon map Dungon's assumption, Ruling Y) are no source: they hang under the root, so their runtime:/assumed: notes stay
// visible. The whole trace is a Ctx with `trace: true` away (gameDamage makes exactly that and trims what it hands the page).
//
// The type of the result is the page's own (lib/statTracker/config StatResult: type-only). lib/game imports no lib/arkh and reaches none:
// DNSM.TomeQTYtot, the Tome score (Ruling K), is lib/game's own sum of the Tome's points (njs/TomeQTY.ts, Summoning TomePTS).
//
// Performance, measured when the page switched (Task 10, Ruling X; 5 real saves, Node, median): a character switch on a loaded save is
// about 40 ms against lib/arkh's 220 ms, a map switch 39 ms against 254 ms, and the first call on a save (state build + Tome) 63 ms against
// 247 ms. With the Tome on lib/game (2026-11-10, counted per character and map): about 63 ms per character and map against lib/arkh's
// 249 ms (characterize, 5 newest saves, 55 pairs: 3455 ms against 13699 ms).
import type { StatResult } from "@/lib/statTracker/config";
import { DMG_LAYERS, DMG_MASTERY, DMG_RAT, DMG_ROOT, type DmgLayer } from "@/lib/damage/layers";
import { asNum, attr } from "../attr";
import { makeCtx, type Ctx, type TraceNode } from "../ctx";
import { TreeTotalMismatch } from "../errors";
import { listOrMapAt } from "../lists";
import { itemsOwned } from "../player";
import { baseDamageFoods, DamageDealed, minigameHiscore, pctCap, multCap, baseCap, primaryStat } from "../njs/DamageDealed";
import { haveBan } from "../njs/Thingies";
import type { GameState } from "../state";
import { TRACKERS } from "./index";
import { findCall, flagged, migratedNote, near, stateOf, takeFrom, traceTree, type Take } from "./page";

type Node = StatResult["tree"];

/**
 * What a source computes from: `t` takes a call, `all` every remaining call of a block and arguments (a loop's), `peek` reads a call
 * another source took, `leaf` shows a number that is no call of its own (a raw save read, unless `note` says otherwise), `c` reads the save.
 */
type Ops = { t: Take; all: (block: string, ...args: (string | number)[]) => number[]; peek: Take; leaf: (name: string, val: number, note?: string) => number; c: Ctx };
/**
 * One source of the tree. `of` is the term as lib/arkh's tree has it, which is the term as DamageDealed writes it: the summed term of an
 * add / pct step (before the step's `/100`), the factor itself for a mult step (1 + x/100 where the game writes it so), the exponent for
 * the Reliquarium (0 when not carried), the rat damage for the arena (0 off map 43).
 */
type Source = { name: string; fmt: "+" | "x" | "raw"; note?: string | ((c: Ctx) => string); of: (o: Ops) => number };

const gtn = (t: Take, d: number, b: number) => t("GetTalentNumber", d, b);
const bubble = (t: Take, key: string) => t("DNSM.AlchBubbles", key);
const vault = (t: Take, n: number) => t("Summoning", "VaultUpgBonus", n, 0);
const pct = (x: number) => 1 + x / 100;
/** DN.DamageDealtSTATtype @4107309: the first class's primary stat x (1 + talents 95, 455, 20 and the W6 / A6 / M6 bubbles / 100). */
const statType = (g: Take, c: Ctx) =>
  g("TotalStats", primaryStat(c)) * (1 + (gtn(g, 1, 95) + (gtn(g, 1, 455) + gtn(g, 1, 20)) + (bubble(g, "W6") + (bubble(g, "A6") + bubble(g, "M6")))) / 100);
const READ = "a plain read of the save, not an N.js call";
const STAT = "the Primary Stat source";

/** The 18 achievements of the arena step and their weights, as DamageDealed adds them (@4114294). */
const ACHIEVEMENTS: readonly [number, number][] = [
  [58, 2], [59, 3], [60, 5], [62, 5], [119, 2], [120, 3], [121, 5], [189, 4], [185, 2], [186, 3], [187, 5],
  [240, 1], [280, 1], [297, 3], [303, 2], [364, 2], [354, 4], [375, 3],
];

// Offsets: DamageDealed @4105019 (Max @4107133; L0 @4107948 + @4108789, the foods @4110296; L1 @4111563 + @4112687; L2 @4114294 + @4118934,
// weekly boss @4119435, Cactolyte @4119765, after the caps @4122686 + @4123586, bundle @4124196, fam 80 @4124419, Reliquarium @4124657, map 306
// @4124958; Mastery @4106867; the arena @4106216)
const SOURCES: Record<string, Source> = {
  // ── Base Damage ──
  wpSquared: {
    name: "Weapon Power²", fmt: "+", note: "((WP × (1 + Σ%/100) + Talent 5) / 3)²",
    of: ({ t }) => Math.pow((t("TotalStats", "Weapon_Power") * (1 + (gtn(t, 1, 97) + (gtn(t, 1, 277) + (gtn(t, 1, 457) + t("Holes", "CosmoBonusQTY", 2, 4)))) / 100) + gtn(t, 1, 5)) / 3, 2),
  },
  statType: { name: "Primary Stat", fmt: "+", note: "DamageDealtSTATtype: stat × (1 + Σ/100); other classes' bubbles count 0", of: ({ t, c }) => statType(t, c) },
  goldFoodBase: { name: "Golden Food (Base Damage)", fmt: "+", of: ({ t }) => t("GoldFoodBonuses", "BaseDamage") },
  statWpFloor: {
    name: "Weapon Power + Stat (max 150)", fmt: "+", note: "min(150, 2 × WP + stat)",
    of: ({ t, peek, leaf, c }) => Math.min(150, 2 * t("TotalStats", "Weapon_Power") + leaf("Primary Stat", statType(peek, c), STAT)),
  },
  arcade0: { name: "Base Damage Arcade Bonus (Arcade 0)", fmt: "+", of: ({ t }) => t("ArcadeBonus", 0) },
  owl1: { name: "Owl 1", fmt: "+", of: ({ t }) => t("Summoning", "OwlBonuses", 1, 0) },
  vault0: { name: "Vault 0", fmt: "+", of: ({ t }) => vault(t, 0) },
  vault20: { name: "Vault 20", fmt: "+", of: ({ t }) => vault(t, 20) * t("Summoning", "VaultKillzTotal", 5, 0) },
  stampBaseDmg: { name: "Base Damage Stamps", fmt: "+", note: 'StampBonusOfTypeX("BaseDmg")', of: ({ t }) => t("StampBonusOfTypeX", "BaseDmg") },
  etc16: { name: "Base Damage (Equipment)", fmt: "+", note: "EtcBonuses(16)", of: ({ t }) => t("EtcBonuses", "16") },
  statue0: { name: "Power Statue (Statue 0)", fmt: "+", of: ({ t }) => t("ArbitraryCode", "StatueBonusGiven0") },
  boxBaseDmg: { name: "Base Damage (Post Office)", fmt: "+", note: "BoxRewards.basedmg", of: ({ t }) => t("DNSM.BoxRewards", "basedmg") },
  bubbleHP: { name: "Big Meaty Claws (Bubble bdmgHP)", fmt: "+", note: "× log10(max(HP − 250, 1))", of: ({ t }) => bubble(t, "bdmgHP") * t("getLOG", Math.max(t("PlayerHPmax") - 250, 1)) },
  bubbleSPD: { name: "Quick Slap (Bubble bdmgSPD)", fmt: "+", note: "× log2(max(speed − 0.1, 0)) / 0.25", of: ({ t }) => bubble(t, "bdmgSPD") * (t("Log2", Math.max(t("PlayerSpeedBonus") - 0.1, 0)) / 0.25) },
  bubbleMP: { name: "Name I Guess (Bubble bdmgMP)", fmt: "+", note: "× log10(max(MP − 150, 1))", of: ({ t }) => bubble(t, "bdmgMP") * t("getLOG", Math.max(t("PlayerMPmax") - 150, 1)) },
  card4: { name: "Base Damage Cards (Card Type 4)", fmt: "+", of: ({ t }) => t("CardBonusREAL", 4) },
  sigil4: { name: "Sigil 4", fmt: "+", of: ({ t }) => t("Labb", "SigilBonus", "Blank", 4, 0) },
  cardFallEvent2: { name: "Card fallEvent2 level", fmt: "+", note: 'CardLv("fallEvent2")', of: ({ t }) => t("RunCodeOfTypeXforThingY", "CardLv", "fallEvent2") },
  // the foods' FoodBonuses calls (one per food that has the effect) and their sum, as DamageDealed adds it after the cap
  foodBaseDmg: { name: "Base Damage Food", fmt: "+", note: "Σ Amount × food effect bonus", of: ({ all, c }) => (all("FoodBonuses", "BaseDmgBoostsEffectBonus"), baseDamageFoods(c)) },
  // ── Damage % ──
  statPow: { name: "Primary Stat^0.7", fmt: "+", note: "DamageDealtSTATtype^0.7", of: ({ peek, leaf, c }) => Math.pow(leaf("Primary Stat", statType(peek, c), STAT), 0.7) },
  vault27: { name: "Vault 27", fmt: "+", of: ({ t }) => vault(t, 27) * t("Summoning", "VaultKillzTotal", 6, 0) },
  vault15: { name: "Vault 15", fmt: "+", of: ({ t, leaf, c }) => vault(t, 15) * leaf("OptionsListAccount[338]", asNum(c, "OptionsListAccount", 338)) },
  vault10: { name: "Vault 10", fmt: "+", note: "× 0.4", of: ({ t }) => 0.4 * vault(t, 10) },
  bribe30: { name: "Bribe 30", fmt: "+", of: ({ t }) => t("GetBribeBonus", "30") },
  bribe20: { name: "Bribe 20", fmt: "+", of: ({ t }) => t("GetBribeBonus", "20") },
  stampPctDmg: { name: "Damage % Stamps", fmt: "+", note: 'StampBonusOfTypeX("PctDmg")', of: ({ t }) => t("StampBonusOfTypeX", "PctDmg") },
  lankRank14: { name: "Land Rank 14", fmt: "+", note: "LankRankUpgBonus(14)", of: ({ t }) => t("FarmingStuffs", "LankRankUpgBonus", 14, 0) },
  statue22: { name: "Statue 22", fmt: "+", of: ({ t }) => t("ArbitraryCode", "StatueBonusGiven22") },
  talent113: { name: "Blind Adrenaline (Talent 113)", fmt: "+", of: ({ t }) => gtn(t, 1, 113) },
  talent86: { name: "Meat Shank (Talent 86)", fmt: "+", note: "× log10(HP)", of: ({ t }) => t("getLOG", t("PlayerHPmax")) * gtn(t, 1, 86) },
  talent446: { name: "Overclocked Energy (Talent 446)", fmt: "+", note: "× log10(MP)", of: ({ t }) => t("getLOG", t("PlayerMPmax")) * gtn(t, 1, 446) },
  owl2: { name: "Owl 2", fmt: "+", of: ({ t }) => t("Summoning", "OwlBonuses", 2, 0) },
  roo4: { name: "Roo Bonus 4", fmt: "+", note: "RooBonuses(4), coefficient 2", of: ({ t }) => t("Summoning", "RooBonuses", 4, 0) },
  bubbaRoG4: { name: "Bubba RoG Bonus 4", fmt: "+", of: ({ t }) => t("Bubbastuff", "BubbaRoG_Bonuses", 4, 0) },
  vault80: { name: "Vault 80", fmt: "+", of: ({ t }) => vault(t, 80) },
  spelunkShop64: { name: "Spelunk Shop 64", fmt: "+", of: ({ t }) => t("Spelunk", "ShopUpgBonus", 64, 0) },
  talent284: {
    name: "Veins Of The Infernal (Talent 284)", fmt: "+", note: "× min(100, smithing LV) / 10",
    of: ({ t, leaf, c }) => gtn(t, 1, 284) * (Math.min(100, leaf("Lv0[2]", asNum(c, "Lv0", 2))) / 10),
  },
  win0: { name: "Damage (Winner Bonus 0)", fmt: "+", of: ({ t }) => t("Summoning", "WinBonus", 0, 0) },
  talent463: {
    name: "Choppin It Up Ez (Talent 463)", fmt: "+", note: "× ⌊score / 25⌋",
    of: ({ t, leaf, c }) => gtn(t, 2, 463) * Math.floor(leaf("FamilyValuesMap.MinigameHiscores[0]", minigameHiscore(c, 0)) / 25),
  },
  bubbleW12: { name: "Dmg Of The Sun (Bubble W12)", fmt: "+", of: ({ t }) => bubble(t, "W12") },
  bubbleA12: { name: "Dmg Of The Moon (Bubble A12)", fmt: "+", of: ({ t }) => bubble(t, "A12") },
  bubbleM12: { name: "Dmg Of The Soul (Bubble M12)", fmt: "+", of: ({ t }) => bubble(t, "M12") },
  tc31: { name: "Skillage Damage (Talent 31)", fmt: "+", note: "TalentCalc: talent × its counter", of: ({ t }) => t("TalentCalc", 31) },
  tc110: { name: "Apocalypse Zow (Talent 110)", fmt: "+", note: "TalentCalc: talent × its counter", of: ({ t }) => t("TalentCalc", 110) },
  tc125: { name: "Precision Power (Talent 125)", fmt: "+", note: "TalentCalc: talent × its counter", of: ({ t }) => gtn(t, 1, 125) * t("TalentCalc", 125) },
  tc485: { name: "Virile Vials (Talent 485)", fmt: "+", note: "TalentCalc: talent × its counter", of: ({ t }) => t("TalentCalc", 485) },
  tc305: { name: "Looty Mc Shooty (Talent 305)", fmt: "+", note: "TalentCalc: talent × its counter", of: ({ t }) => t("TalentCalc", 305) / 50 },
  tc470: { name: "Paperwork, Great... (Talent 470)", fmt: "+", note: "TalentCalc: talent × its counter", of: ({ t }) => t("TalentCalc", 470) / 10 },
  bUpg57: { name: "The Hole B_UPG 57", fmt: "+", note: "20 × ⌊log10(Holes[9][1])⌋ once bought", of: ({ t }) => t("Holes", "B_UPG", 57, 0) },
  talent290: {
    name: "Speedna (Talent 290)", fmt: "+", note: "× ⌊min(speed − 1, 10) / 0.15⌋",
    of: ({ t }) => gtn(t, 1, 290) * Math.floor(Math.min(t("PlayerSpeedBonus") - 1, 10) / 0.15),
  },
  tc656: { name: "Dreamer Damage (Talent 656)", fmt: "+", note: "TalentCalc: talent × its counter", of: ({ t }) => t("TalentCalc", 656) },
  talent649: { name: "Filthy Damage (Talent 649)", fmt: "+", note: "× log10(OLA[161])", of: ({ t, c }) => t("getLOG", asNum(c, "OptionsListAccount", 161)) * gtn(t, 1, 649) },
  talent638: { name: "Dungeonic Damage (Talent 638)", fmt: "+", note: "× log10(OLA[71])", of: ({ t, c }) => t("getLOG", asNum(c, "OptionsListAccount", 71)) * gtn(t, 1, 638) },
  talent658: { name: "Quest Kapow! (Talent 658)", fmt: "+", note: "min(quests, talent)", of: ({ t }) => Math.min(t("ArbitraryCode", "TotalQuestsComplete"), gtn(t, 1, 658)) },
  // GetPlayersUsernames.indexOf(UserInfo[0]): the current character
  divMinor7: { name: "Divinity Minor Link 7", fmt: "+", note: 'Divinity("Bonus_Minor", this character, 7)', of: ({ t, c }) => t("Divinity", "Bonus_Minor", c.player, 7) },
  goldFoodDmg: { name: "Golden Food (Damage)", fmt: "x", note: "1 + x/100", of: ({ t }) => t("GoldFoodBonuses", "Damage") },
  // ── Damage Multipliers ──
  workbench: { name: "Workbench (Extra Damage)", fmt: "x", note: 'WorkbenchStuff("AdditionExtraDMG")', of: ({ t }) => t("WorkbenchStuff", "AdditionExtraDMG", 0, 0) },
  vial7dmg: { name: "Damage Vial (7dmg)", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("DNSM.AlchVials", "7dmg")) },
  eclipse: {
    name: "Eclipse Skulls (Death Note)", fmt: "x", note: "+5% per eclipse skull (over 1e9 kills of a World 1–6 Death Note monster, Rift 20)",
    of: ({ t }) => pct(t("RiftStuff", "eclipseSkulls", 0)),
  },
  palette34: { name: "Palette 34", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("GamingStatType", "PaletteBonus", 34, 0)) },
  dream6: { name: "Equinox Upgrade 4", fmt: "x", note: "1 + Dream[6]/10 (Dream[2 + i] is upgrade i)", of: ({ leaf, c }) => 1 + leaf("Dream[6]", asNum(c, "Dream", 6)) / 10 },
  pristine0: { name: "Pristine Charm 0", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("Ninja", "PristineBon", 0, 0)) },
  summUpg79: { name: "Summoning Upgrade 79", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("Summoning", "SummUpgBonus", 79, 0)) },
  cglunko19: { name: "Crystal Glunko Upgrade 19", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("Holes2", "Cglunko_upgBon", 19, 0)) },
  buff108: { name: "Buff 108 (active buff only)", fmt: "+", note: "active buff only", of: ({ t }) => t("GetBuffBonuses", 108, 2) },
  friend0: { name: "Friend Bonus (Damage)", fmt: "+", of: ({ t }) => t("Thingies", "FriendBonusStatz", 0, 0) },
  starSignPctDmg: { name: "Star Signs (Damage %)", fmt: "+", of: ({ t }) => t("DNSM.StarSigns", "PctDmg") },
  divinity507: {
    name: "Gods Chosen Children (Talent 507)", fmt: "+", note: "× max(0, Divinity[25] − 10)",
    of: ({ t, leaf, c }) => Math.max(0, leaf("Divinity[25]", asNum(c, "Divinity", 25)) - 10) * t("getbonus2", 1, 507, -1),
  },
  level50: {
    name: "Power Orb (Talent 50)", fmt: "+", note: "× ⌊max(0, LV − 200) / 50⌋",
    of: ({ t, leaf, c }) => Math.floor(Math.max(0, leaf("Lv0[0]", asNum(c, "Lv0", 0)) - 200) / 50) * t("getbonus2", 1, 50, -1),
  },
  grimoire35: { name: "Grimoire Upgrade 35", fmt: "+", of: ({ t }) => t("Summoning", "GrimoireUpgBonus", 35, 0) },
  lustreSet: { name: "Lustre Set", fmt: "+", of: ({ t }) => t("GetSetBonus", "LUSTRE_SET", "Bonus", 0, 0) },
  shrine0: { name: "Woodular Shrine (Shrine 0)", fmt: "+", of: ({ t }) => t("Shrine", 0) },
  monument06: { name: "Monument Bonus (0, 6)", fmt: "+", of: ({ t }) => t("Holes", "MonumentROGbonuses", 0, 6) },
  box12c: { name: "Post Office 12c", fmt: "+", note: 'BoxRewards["12c"]', of: ({ t }) => t("DNSM.BoxRewards", "12c") },
  box21c: { name: "Post Office 21c", fmt: "+", note: 'BoxRewards["21c"]', of: ({ t }) => t("DNSM.BoxRewards", "21c") },
  box23c: { name: "Post Office 23c", fmt: "+", note: 'BoxRewards["23c"]', of: ({ t }) => t("DNSM.BoxRewards", "23c") },
  fam20: { name: "Family Bonus 20", fmt: "+", of: ({ t }) => t("DNSM.FamBonusQTYs", "20") },
  artifact25: { name: "Artifact 25", fmt: "+", of: ({ t }) => t("Sailing", "ArtifactBonus", 25, 0) },
  atom9: { name: "Atom 9", fmt: "+", of: ({ t }) => t("AtomCollider", "AtomBonuses", 9, 0) },
  shiny5: { name: "Shiny Pets (Breeding 5)", fmt: "+", of: ({ t }) => t("Breeding", "ShinyBonusS", "Nah", 5, -1) },
  msa0: { name: "MSA Bonus 0", fmt: "+", note: "⌊waves / 10⌋ once Super Bit 7 is owned", of: ({ t }) => t("GamingStatType", "MSA_Bonus", 0, 0) },
  shimmer178: { name: "Shimmer Bonuses", fmt: "+", of: ({ t, leaf, c }) => leaf("OptionsListAccount[178]", asNum(c, "OptionsListAccount", 178)) * t("Dreamstuff", "AllShimmerBonuses", 0) },
  cropSC0: { name: "Crop Scientist 0", fmt: "+", note: "20 × crops found × depot multi", of: ({ t }) => t("FarmingStuffs", "CropSCbonus", 0, 0) },
  vault41: { name: "Vault 41", fmt: "+", note: "× log10(OLA[346])", of: ({ t, c }) => vault(t, 41) * t("getLOG", asNum(c, "OptionsListAccount", 346)) },
  riftEtc0: { name: "Rift Skill Bonus 0", fmt: "+", note: "7 + 5 per skill past mastery rank 2 (Rift 15)", of: ({ t }) => t("RiftStuff", "RiftSkillETC", 0) },
  pctDmg1: { name: "Brittley Spears (Bubble pctDmg1)", fmt: "+", of: ({ t }) => bubble(t, "pctDmg1") },
  pctDmg2: { name: "Bow Jack (Bubble pctDmg2)", fmt: "+", of: ({ t }) => bubble(t, "pctDmg2") },
  pctDmg3: { name: "Matty Stafford (Bubble pctDmg3)", fmt: "+", of: ({ t }) => bubble(t, "pctDmg3") },
  artifact2: { name: "Artifact 2", fmt: "+", of: ({ t }) => t("Sailing", "ArtifactBonus", 2, 0) },
  artifact8: { name: "Artifact 8", fmt: "+", of: ({ t }) => t("Sailing", "ArtifactBonus", 8, 0) },
  bubbleW5: { name: "Power Trione (Bubble W5)", fmt: "+", note: "× ⌊max(STR, LUK) / 250⌋", of: ({ t }) => bubble(t, "W5") * Math.floor(Math.max(t("TotalStats", "STR"), t("TotalStats", "LUK")) / 250) },
  bubbleA5: { name: "Power Tritwo (Bubble A5)", fmt: "+", note: "× ⌊AGI / 250⌋", of: ({ t }) => bubble(t, "A5") * Math.floor(t("TotalStats", "AGI") / 250) },
  bubbleM5: { name: "Power Trithree (Bubble M5)", fmt: "+", note: "× ⌊WIS / 250⌋", of: ({ t }) => bubble(t, "M5") * Math.floor(t("TotalStats", "WIS") / 250) },
  constMastery1: { name: "Construction Mastery 1", fmt: "+", note: "Rift ≥ 40: 2 × ⌊(Σ tower levels − 750) / 10⌋", of: ({ t }) => t("WorkbenchStuff", "ConstMasteryBonus", 1, 0) },
  tome0: { name: "Tome Bonus 0", fmt: "+", of: ({ t }) => t("Summoning", "TomeBonus", 0, 0) },
  compass48: { name: "Compass Bonus 48", fmt: "+", of: ({ t }) => t("Windwalker", "CompassBonus", 48, 0) },
  exotic41: { name: "Exotic Crop 41", fmt: "+", of: ({ t }) => t("FarmingStuffs", "ExoticBonusQTY", 41, 0) },
  ola419: { name: "OLA[419]", fmt: "+", of: ({ leaf, c }) => leaf("OptionsListAccount[419]", asNum(c, "OptionsListAccount", 419)) },
  talent6: { name: "Gilded Sword (Talent 6)", fmt: "+", of: ({ t }) => gtn(t, 1, 6) },
  saltLick9: { name: "Salt Lick 9", fmt: "+", of: ({ t }) => t("SaltLick", 9) },
  etc45: { name: "Damage % (Equipment)", fmt: "+", note: "EtcBonuses(45)", of: ({ t }) => t("EtcBonuses", "45") },
  prayer15: { name: "Beefy For Real (Prayer 15)", fmt: "+", of: ({ t }) => t("prayersReal", 15, 0) },
  mainframe0: { name: "Lab Mainframe 0", fmt: "+", of: ({ t }) => t("MainframeBonus", 0) },
  mainframe11: { name: "Lab Mainframe 11", fmt: "+", of: ({ t }) => t("MainframeBonus", 11) },
  mainframe110: { name: "Lab Mainframe 110", fmt: "+", of: ({ t }) => t("MainframeBonus", 110) },
  artifact27: { name: "Artifact 27", fmt: "+", of: ({ t }) => t("Sailing", "ArtifactBonus", 27, 0) },
  artifact29: { name: "Artifact 29", fmt: "+", of: ({ t }) => t("Sailing", "ArtifactBonus", 29, 0) },
  bUpg84: { name: "The Hole B_UPG 84", fmt: "+", note: "100 × Holes[11][55] once bought", of: ({ t }) => t("Holes", "B_UPG", 84, 100) },
  arcade46: { name: "Total Damage Arcade Bonus (Arcade 46)", fmt: "+", of: ({ t }) => t("ArcadeBonus", 46) },
  ola435: { name: "OLA[435]", fmt: "+", of: ({ leaf, c }) => leaf("OptionsListAccount[435]", asNum(c, "OptionsListAccount", 435)) },
  comp10: { name: "Frog (Companion 10)", fmt: "+", of: ({ t }) => t("Companions", 10) },
  comp156: { name: "Valenslime (Companion 156)", fmt: "+", of: ({ t }) => t("Companions", 156) },
  card42: { name: "Damage Cards (Card Type 42)", fmt: "+", of: ({ t }) => t("CardBonusREAL", 42) },
  cardSet5: { name: "Card Set 5 (Damage · Drop · EXP)", fmt: "+", of: ({ t }) => t("CardSetBonuses", 0, "5") },
  petArena2: { name: "Pet Arena 2", fmt: "+", note: "20 once more than 2 arena waves are reached", of: ({ t }) => 20 * t("Breeding", "PetArenaBonus", "0", 2, 0) },
  petArena15: { name: "Pet Arena 15", fmt: "+", note: "40 once more than 15 arena waves are reached", of: ({ t }) => 40 * t("Breeding", "PetArenaBonus", "0", 15, 0) },
  chipDmg: { name: "Lab Chips (Damage)", fmt: "+", note: 'chipBonuses("dmg")', of: ({ t }) => t("chipBonuses", "dmg") },
  mealTotDmg: { name: "Meals (Total Damage)", fmt: "+", of: ({ t }) => t("MealBonus", "TotDmg") },
  achievements: { name: "Achievements", fmt: "+", of: ({ t }) => ACHIEVEMENTS.reduce((a, [n, w]) => a + w * t("AchieveStatus", n), 0) },
  bless7: { name: "Flutterbis Blessing (God 7)", fmt: "+", note: 'Divinity("BlesssBonus", 7)', of: ({ t }) => t("Divinity", "BlesssBonus", 7, 0) },
  bless8: { name: "Kattlekruk Blessing (God 8)", fmt: "+", note: 'Divinity("BlesssBonus", 8)', of: ({ t }) => t("Divinity", "BlesssBonus", 8, 0) },
  penalty: {
    name: "Damage Penalties", fmt: "x", note: "max((1 − T24/100) × (1 − buff/100) × max(0.01, 1 − curses/100), 0.05)",
    of: ({ t }) => Math.max((1 - gtn(t, 1, 24) / 100) * (1 - t("GetBuffBonuses", 124, 2) / 100) * Math.max(0.01, 1 - (t("prayersReal", 6, 1) + t("prayersReal", 13, 1)) / 100), 0.05),
  },
  minehead0: { name: "Minehead Bonus 0", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("Minehead", "BonusQTY", 0, 0)) },
  wepPowDmg: { name: "Weapon Power Damage (Minehead 4)", fmt: "x", note: "Minehead bonus 4 × the weapon's Weapon Power", of: ({ t }) => pct(t("Minehead", "WepPowDmgPCT", 0, 0)) },
  jelly37: { name: "Jelly RoG 37", fmt: "x", of: ({ t }) => pct(t("JellyOperation", "RoG_BonusQTY", 37, 0)) },
  royalStatue0: { name: "Royal Statue 0", fmt: "x", of: ({ t }) => pct(t("RoyalG", "StatueBon", 0, 0)) },
  coralKid11: {
    name: "Coral Kid 11", fmt: "x", note: "(1 + x/100)^max(0, Divinity[25] − 35)",
    of: ({ t, leaf, c }) => Math.pow(pct(t("Thingies", "CoralKidUpgBonus", 11, 0)), Math.max(0, leaf("Divinity[25]", asNum(c, "Divinity", 25)) - 35)),
  },
  weeklyBoss: {
    name: "Weekly Boss", fmt: "x", note: "1 + min(150, g)/100",
    of: ({ leaf, c }) => (Object.hasOwn(listOrMapAt(c, "WeeklyBoss"), "g") ? 1 + Math.min(150, leaf("WeeklyBoss.g", asNum(c, "WeeklyBoss", "g"))) / 100 : 1),
  },
  cactolyte: {
    name: "Cactolyte quest (Elderly Peanut)", fmt: "x", note: "× 0.5 while class 2 carries the Elderly Peanut on Cactolyte3",
    of: ({ c }) => (0 == (attr(c, "QuestComplete", "Cactolyte3") as number) && 2 == (attr(c, "CharacterClass") as number) && 1 <= itemsOwned(c, "Quest47") ? 0.5 : 1),
  },
  etc72: { name: "Damage (Equipment 72)", fmt: "x", note: "EtcBonuses(72)", of: ({ t }) => pct(t("EtcBonuses", "72")) },
  etc75: { name: "Damage (Equipment 75)", fmt: "x", note: "EtcBonuses(75)", of: ({ t }) => pct(t("EtcBonuses", "75")) },
  etc104: { name: "Damage (Equipment 104)", fmt: "x", note: "EtcBonuses(104)", of: ({ t }) => pct(t("EtcBonuses", "104")) },
  voting1: { name: "Voting Bonus 1", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("Summoning", "VotingBonusz", 1, 0)) },
  fountain16: { name: "Fountain 16", fmt: "x", note: "1 + Fountain_BonTOT(1,16)/100", of: ({ t }) => pct(t("Holes2", "Fountain_BonTOT", 1, 16)) },
  sushi49: { name: "Sushi RoG 49", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("SushiStuff", "RoG_BonusQTY", 49, 0)) },
  superBit64: { name: "Super Bit 64", fmt: "x", note: "1 + 0.1 × bit", of: ({ t }) => 1 + 0.1 * t("GamingStatType", "SuperBitType", 64, 0) },
  ola232: {
    name: "OLA[232]", fmt: "x", note: "1 + 10 × ⌊(96 + OLA[232]) / 100⌋ / 100",
    of: ({ leaf, c }) => 1 + (10 * Math.floor((96 + leaf("OptionsListAccount[232]", asNum(c, "OptionsListAccount", 232))) / 100)) / 100,
  },
  card96: { name: "Damage Cards (Card Type 96)", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("CardBonusREAL", 96)) },
  sticker: {
    name: "Sticker Damage (Grid 47)", fmt: "x", note: "1 + Grid 47 × stickers found / 100, once Grid 47 is unlocked",
    of: ({ t }) => Math.max(1, t("FarmingStuffs", "StickerDMGmulti", 0, 0)),
  },
  tome6: { name: "Tome Bonus 6 & Achievements", fmt: "x", note: "1 + Σ/100", of: ({ t }) => 1 + (t("Summoning", "TomeBonus", 6, 0) + (t("AchieveStatus", 371) + t("AchieveStatus", 384))) / 100 },
  killroy: {
    name: "Killroy Damage", fmt: "x", note: "1 + min(200, ⌊(Σ best Killroy kills)^0.4⌋)/100",
    of: ({ t }) => 1 + Math.max(0, Math.min(2, t("RiftStuff", "KillroyDMG", 0) / 100)),
  },
  companions: {
    name: "Companions", fmt: "x", note: "max(1, Π(1 + c))",
    of: ({ t }) => Math.max(1, (1 + t("Companions", 12)) * (1 + t("Companions", 33)) * (1 + 2 * t("Companions", 160)) * (1 + 0.5 * t("Companions", 168)) * (1 + t("Companions", 170))),
  },
  crystal6: { name: "Crystal6 Card", fmt: "x", note: "1 + min(1.5 × LV, 15)/100", of: ({ t }) => 1 + Math.min(1.5 * t("RunCodeOfTypeXforThingY", "CardLv", "Crystal6"), 15) / 100 },
  meritoc5: { name: "Meritocracy 5", fmt: "x", of: ({ t }) => pct(t("Summoning2", "MeritocBonusz", 5, 0)) },
  greenSigils: {
    name: "Eclectic Sigils (Research Grid 127)", fmt: "x", note: "1 + min(100, sigils × grid 127)/100",
    of: ({ t }) => 1 + Math.min(100, t("Labb", "TotalGreenSigils", "0", 0, 0) * t("ResearchStuff", "Grid_Bonus", 127, 0)) / 100,
  },
  // an absent BundlesReceived is the loader's empty map (Ruling H)
  bundleA: { name: "Damage Bundle (bon_a)", fmt: "x", of: ({ leaf, c }) => (1 == leaf("BundlesReceived.bon_a", haveBan(c, "bon_a")) ? 1.5 : 1) },
  fam80: { name: "Family Bonus 80", fmt: "x", note: "1 + x/100", of: ({ t }) => pct(t("DNSM.FamBonusQTYs", "80")) },
  reliquarium: {
    name: "Reliquarium", fmt: "raw", note: "exponent 4/(5 + OLA[473]) while carrying the Unstable Reliquarium",
    of: ({ t, leaf, c }) => (1 == t("Thingies", "ReliquariumInPosession", 0, 0) ? 4 / (5 + leaf("OptionsListAccount[473]", asNum(c, "OptionsListAccount", 473))) : 0),
  },
  map306: {
    name: "Clamworks (map 306)", fmt: "x", note: "1 / 100^Menagerie[5][2] on map 306",
    of: ({ leaf, c }) => (306 == c.map ? 1 / Math.pow(100, leaf("Menagerie[5][2]", asNum(c, "Menagerie", 5, 2))) : 1),
  },
  // ── the arena: 0 off map 43 (the replace step's "does not apply"), lib/arkh's leaf there too ──
  ratDmg: {
    name: "Rat Damage (Royal Guardian arena)", fmt: "raw", note: (c) => (43 == c.map ? "(10 + Armory 35) × (1 + Armory 36/100)" : "map 43 only"),
    of: ({ t, c }) => (43 == c.map ? t("RoyalG", "RatDMG", 0, 0) : 0),
  },
  // ── Mastery ──
  talent113b: { name: "Blind Adrenaline (Talent 113) · Mastery", fmt: "+", note: "subtracted", of: ({ t }) => -gtn(t, 2, 113) },
  bubbleMastery: { name: "Lil Big Damage (Bubble Mastery)", fmt: "+", of: ({ t }) => bubble(t, "Mastery") },
  card21: { name: "Mastery Cards (Card Type 21)", fmt: "+", of: ({ t }) => t("CardBonusREAL", 21) },
  talent123: { name: "Mastery Up (Talent 123)", fmt: "+", note: "GetTalentNumber(1,123)", of: ({ t }) => gtn(t, 1, 123) },
  etc21: { name: "Mastery (Equipment)", fmt: "+", note: "EtcBonuses(21)", of: ({ t }) => t("EtcBonuses", "21") },
};

/** A step's shown value, display format and shape note (lib/arkh's, which the page's tooltip prints). */
function stepOf(kind: string, vals: readonly number[]): { val: number; fmt: Node["fmt"]; note: string } {
  if (kind === "add") return { val: vals.reduce((a, v) => a + v, 0), fmt: "+", note: "+ Σ" };
  if (kind === "pct") return { val: 1 + vals.reduce((a, v) => a + v, 0) / 100, fmt: "x", note: "× (1 + Σ/100)" };
  if (kind === "mult") return { val: vals.reduce((a, v) => a * v, 1), fmt: "x", note: "× Π" };
  throw new Error(`Damage: step kind "${kind}", which the page does not use`);
}

const CAPS: Record<string, (v: number) => number> = { capBase: baseCap, capPct: pctCap, capMult: multCap };
const short = (v: number): string => (Math.abs(v) >= 1e6 ? v.toExponential(3) : String(+v.toFixed(3)));

/** A layer's node and value: its steps in game order on the running value (a step of sources, the soft cap, the Reliquarium exponent). The
 *  Observed Max collector (scripts/update-top-damage.ts) rebuilds its layers with it, from the best source of each. */
export function layerOf(layer: DmgLayer, source: (id: string) => Node): { node: Node; val: number } {
  let val = layer.start;
  const steps = layer.steps.map((s): Node => {
    if (s.kind === "cap") {
      const capIn = val;
      val = CAPS[s.key](val);
      return { name: s.name, val: capIn ? val / capIn : 1, fmt: "x", note: `${short(capIn)} → ${short(val)}` };
    }
    const items = s.sources.map(source);
    if (s.kind === "pow") {
      const e = items.find((i) => i.val > 0)?.val ?? 0; // 0: not carried
      if (e > 0) val = Math.pow(val, e);
      return { name: s.name, val: e, fmt: "raw", note: `${layer.node} ^ exponent (0 = inactive)`, children: items };
    }
    const step = stepOf(s.kind, items.map((i) => i.val));
    val = s.kind === "add" ? val + step.val : val * step.val;
    return { name: s.name, val: step.val, fmt: step.fmt, note: step.note, children: items };
  });
  return { node: { name: layer.node, val, fmt: layer.key === "base" ? "raw" : "x", children: steps }, val };
}

/**
 * The page's result for character `charIdx` on map `mapIdx` of a built state: runs DamageDealed("Max") once, then ("Mastery"), with the
 * trace on, and reads the tree out of them. A save the game would not have the keys for (Ruling E) throws what the engine throws
 * (MissingSaveKey...): there is no number to show.
 */
export const gameDamage = (state: GameState, charIdx: number, mapIdx: number): StatResult => damageTree(makeCtx(state, { player: charIdx, map: mapIdx, trace: true }));

/** `gameDamage` on a Ctx of the caller's (traced, nothing computed on it yet): the character and map are the Ctx's. */
export function damageTree(ctx: Ctx): StatResult {
  if (!ctx.trace) throw new Error("Damage: the tree is read from the trace, and this Ctx has none");
  const state = ctx.state;
  const total = TRACKERS.damage!(ctx);
  const mastery = DamageDealed(ctx, "Mastery");
  const call = (d: string) => {
    const n = ctx.trace!.children.find((c) => c.block === "DamageDealed" && c.args[0] === d);
    if (!n) throw new Error(`Damage: the registered tracker made no DamageDealed("${d}") call`);
    return n;
  };
  const maxCall = call("Max");
  const masteryCall = call("Mastery");
  const plain: Ctx = { ...ctx, trace: null }; // the adapter's own save reads leave nothing in the trace
  const used = new Set<TraceNode>();

  const source = (id: string, from: TraceNode): Node => {
    const def = SOURCES[id];
    if (!def) throw new Error(`Damage: no source "${id}" in the adapter`);
    const kept: Node[] = [];
    const find = (block: string, args: (string | number)[], free: boolean) => findCall(from, block, args, free ? used : undefined);
    const t = takeFrom(from, used, kept, "Damage: DamageDealed", id);
    const all = (block: string, ...args: (string | number)[]) => {
      const vals: number[] = [];
      for (let n = find(block, args, true); n; n = find(block, args, true)) {
        used.add(n);
        kept.push(traceTree(n));
        vals.push(n.value);
      }
      return vals;
    };
    const peek: Take = (block, ...args) => {
      const n = find(block, args, false);
      if (!n) throw new Error(`Damage: DamageDealed made no ${block}(${args.map((a) => JSON.stringify(a)).join(", ")}) call for "${id}"`);
      return n.value;
    };
    const leaf = (name: string, val: number, note = READ) => (kept.push({ name, val, fmt: "raw", note }), val);
    const val = def.of({ t, all, peek, leaf, c: plain });
    const note = typeof def.note === "function" ? def.note(plain) : def.note;
    return { name: def.name, val, fmt: def.fmt, ...(note ? { note } : {}), ...(kept.length ? { children: kept } : {}) };
  };

  // the arena (@4106216) replaced Max before anything else was computed: no layer and no Mastery source to show
  const arena = maxCall.children.some((n) => n.block === "RoyalG" && n.args[0] === "RatDMG");
  const layers = arena ? [] : DMG_LAYERS.map((l) => layerOf(l, (id) => source(id, maxCall)));
  const rat = DMG_RAT.sources.map((id) => source(id, maxCall));
  const ratVal = rat.find((r) => r.val > 0)?.val;
  const masteryItems = arena ? [] : DMG_MASTERY.sources.map((id) => source(id, masteryCall));
  // the head guards and the reads that are no source (the three forms, a dungeon map's assumption, a load step's assumption): kept where
  // they lead to a runtime: / assumed: note
  const extras = [...maxCall.children, ...masteryCall.children].filter((n) => !used.has(n) && flagged(n)).map(traceTree);

  // One path for the number (spec section 4): the sources redo some of DamageDealed's arithmetic (see `of`), and Biggest Gains rebuilds the
  // total from these values. If the layers no longer give the call's total (an N.js constant changed in one place only), there is no honest
  // tree to show: throw, so the tracker reads "incomplete" (spec section 5) instead of a number the headline does not match.
  const rebuilt = ratVal ?? layers.reduce((p, l) => p * l.val, 1);
  if (!near(rebuilt, total)) throw new TreeTotalMismatch(total, rebuilt);
  const rebuiltMastery = arena ? 0.2 : Math.min(0.8, 0.35 + masteryItems.reduce((a, i) => a + i.val, 0) / 100);
  if (!near(rebuiltMastery, mastery)) throw new TreeTotalMismatch(mastery, rebuiltMastery);

  const migrated = migratedNote(state);
  return {
    tree: {
      name: DMG_ROOT,
      val: total,
      fmt: "raw",
      note: `Min ~ Max · Min = Max × Mastery${migrated ? ` · ${migrated}` : ""}`,
      children: [
        ...layers.map((l) => l.node),
        { name: DMG_RAT.name, val: ratVal ?? 0, fmt: "raw", note: "replaces the total", children: rat },
        { name: DMG_MASTERY.name, val: mastery, fmt: "raw", note: arena ? "fixed 0.2 on map 43" : "min(0.8, 0.35 + Σ/100)", ...(masteryItems.length ? { children: masteryItems } : {}) },
        ...extras,
      ],
    },
    total,
  };
}

/** `computeArkhDamage`'s counterpart: the envelope of a save, a character index and the map it stands on. */
export function computeGameDamage(save: unknown, charIdx: number, mapIdx: number): StatResult {
  return gameDamage(stateOf(save), charIdx, mapIdx);
}
