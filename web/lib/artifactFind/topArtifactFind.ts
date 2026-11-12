// Top-player Artifact Find reference — ONE account-wide family ("all"): the
// best-of-each-source pools of every char run through ONE combine() pass
// (the same math a real save uses), no class talents gated. Use topArtifactFlatForClass(classKey).
// Large file: lazy-load it, don't import statically.
// Generated 2026-11-12T01:17:52.487Z · 98 players. Refresh: scripts/update-top-artifact.ts.

type FlatMap = Readonly<Record<string, number>>;

export const TOP_ARTI_FAMILY_FLAT: Readonly<Record<string, FlatMap>> = {
  "all": {
    "Artifact Find": 3231023132075686000,
    "Artifact Find / ☠️ Davey Jones": 16.799999999999997,
    "Artifact Find / ☠️ Davey Jones / Davey Jones": 16.799999999999997,
    "Artifact Find / ☠️ Davey Jones / Davey Jones / Sailing(\"DaveyJonesBonus\", 0, 0)": 16.799999999999997,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26)": 7.998674705139815,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26) / Artifacto Discoveries (Super Bit 26)": 7.998674705139815,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26) / Artifacto Discoveries (Super Bit 26) / GamingStatType(\"SuperBitType\", 26, 0)": 1,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26) / Artifacto Discoveries (Super Bit 26) / Spelunk[6].length": 105,
    "Artifact Find / ➕ Additive Pool": 83.99082231955077,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 32)": 302.970297029703,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 32) / ArcadeBonus(32)": 302.970297029703,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 66)": 120.59701492537313,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 66) / ArcadeBonus(66)": 120.59701492537313,
    "Artifact Find / ➕ Additive Pool / Artifact Find Chance (Vault 63)": 955.2,
    "Artifact Find / ➕ Additive Pool / Artifact Find Chance (Vault 63) / Summoning(\"VaultUpgBonus\", 63, 0)": 955.2,
    "Artifact Find / ➕ Additive Pool / Artifact Pilfering (Bribe 34)": 20,
    "Artifact Find / ➕ Additive Pool / Artifact Pilfering (Bribe 34) / GetBribeBonus(\"34\")": 20,
    "Artifact Find / ➕ Additive Pool / Boat Captain (Artifact Find Chance)": 2135,
    "Artifact Find / ➕ Additive Pool / Boat Captain (Artifact Find Chance) / CaptBonusCalc(3, 1)": 2135,
    "Artifact Find / ➕ Additive Pool / Captains of type 6": 500,
    "Artifact Find / ➕ Additive Pool / Captains of type 6 / NONdummies.60": 20,
    "Artifact Find / ➕ Additive Pool / Chocotastic Muffin Sticker (Sticker 2)": 1135.3399200000001,
    "Artifact Find / ➕ Additive Pool / Chocotastic Muffin Sticker (Sticker 2) / FarmingStuffs(\"StickerBonus\", 2, 99)": 1135.3399200000001,
    "Artifact Find / ➕ Additive Pool / Fauxory Tusk (Artifact 3)": 2590,
    "Artifact Find / ➕ Additive Pool / Fauxory Tusk (Artifact 3) / Sailing(\"ArtifactBonus\", 3, 0)": 2590,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21)": 180,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Breeding(\"ShinyBonusS\", \"Nah\", 21, -1)": 180,
    "Artifact Find / ➕ Additive Pool / Sailing Artifact Chance (Fractal Island 3)": 20,
    "Artifact Find / ➕ Additive Pool / Sailing Artifact Chance (Fractal Island 3) / RandomEvent(\"FractalIslandBonus\", 3, 999)": 1,
    "Artifact Find / ➕ Additive Pool / Transcendent Artifacts (Research Grid 109)": 39.975,
    "Artifact Find / ➕ Additive Pool / Transcendent Artifacts (Research Grid 109) / ResearchStuff(\"Grid_Bonus\", 109, 0)": 39.975,
    "Artifact Find / ➕ Additive Pool / Tune of Artifaction (Cavern Upgrade 55)": 300,
    "Artifact Find / ➕ Additive Pool / Tune of Artifaction (Cavern Upgrade 55) / Holes(\"B_UPG\", 55, 0)": 300,
    "Artifact Find / ⭐ Artifosho Star Sign": 2.5,
    "Artifact Find / ⭐ Artifosho Star Sign / Artifosho (Star Sign 61)": 150,
    "Artifact Find / ⭐ Artifosho Star Sign / Artifosho (Star Sign 61) / DNSM.StarSigns(\"61\")": 150,
    "Artifact Find / 🌊 Nightmariner": 1017.0624969267836,
    "Artifact Find / 🌊 Nightmariner / Nightmariner (Menagerie)": 1017.0624969267836,
    "Artifact Find / 🌊 Nightmariner / Nightmariner (Menagerie) / MenagerieStuff(\"NightmarinerBon\", 0, 0)": 1017.0624969267836,
    "Artifact Find / 🌟 Glowing Veil (Pristine Charm 2)": 1.4,
    "Artifact Find / 🌟 Glowing Veil (Pristine Charm 2) / Glowing Veil (Pristine Charm 2)": 40,
    "Artifact Find / 🌟 Glowing Veil (Pristine Charm 2) / Glowing Veil (Pristine Charm 2) / Ninja(\"PristineBon\", 2, 0)": 40,
    "Artifact Find / 🌿 5 Leaf Clover (Exotic Market 45)": 1.2734136830911025,
    "Artifact Find / 🌿 5 Leaf Clover (Exotic Market 45) / 5 Leaf Clover (Exotic Market 45)": 27.341368309110244,
    "Artifact Find / 🌿 5 Leaf Clover (Exotic Market 45) / 5 Leaf Clover (Exotic Market 45) / FarmingStuffs(\"ExoticBonusQTY\", 45, 0)": 27.341368309110244,
    "Artifact Find / 🍣 Cucumber Uramaki (Sushi Tier 8)": 1.3,
    "Artifact Find / 🍣 Cucumber Uramaki (Sushi Tier 8) / Cucumber Uramaki (Sushi Tier 8) — artifact find chance (RoG Bonus 7)": 30,
    "Artifact Find / 🍣 Cucumber Uramaki (Sushi Tier 8) / Cucumber Uramaki (Sushi Tier 8) — artifact find chance (RoG Bonus 7) / SushiStuff(\"RoG_BonusQTY\", 7, 0)": 30,
    "Artifact Find / 🎨 Bright Cyan (Palette 5)": 30.61290322580646,
    "Artifact Find / 🎨 Bright Cyan (Palette 5) / Bright Cyan (Palette 5)": 2961.290322580646,
    "Artifact Find / 🎨 Bright Cyan (Palette 5) / Bright Cyan (Palette 5) / GamingStatType(\"PaletteBonus\", 5, 0)": 2961.290322580646,
    "Artifact Find / 🏆 Artifact Find (Winner Bonus 3)": 55.46350000000001,
    "Artifact Find / 🏆 Artifact Find (Winner Bonus 3) / Artifact Find (Winner Bonus 3)": 5446.350000000001,
    "Artifact Find / 🏆 Artifact Find (Winner Bonus 3) / Artifact Find (Winner Bonus 3) / Summoning(\"WinBonus\", 3, 0)": 5446.350000000001,
    "Artifact Find / 🏷️ Chocotastic Muffin Sticker (Sticker 2)": 1,
    "Artifact Find / 🏷️ Chocotastic Muffin Sticker (Sticker 2) / Chocotastic Muffin Sticker (Sticker 2)": 0,
    "Artifact Find / 🏷️ Chocotastic Muffin Sticker (Sticker 2) / Chocotastic Muffin Sticker (Sticker 2) / FarmingStuffs(\"StickerBonus\", 2, 100)": 0,
    "Artifact Find / 🐌 Noble Sluggo (Event Shop 48)": 1.5,
    "Artifact Find / 🐌 Noble Sluggo (Event Shop 48) / Noble Sluggo (Event Shop 48)": 1.5,
    "Artifact Find / 🐌 Noble Sluggo (Event Shop 48) / Noble Sluggo (Event Shop 48) / Stuff2(\"PurpleChestSlugsOwned\", 0, 0)": 1,
    "Artifact Find / 🐾 Glimbo (Companion 154)": 2,
    "Artifact Find / 🐾 Glimbo (Companion 154) / Glimbo (Companion 154)": 2,
    "Artifact Find / 🐾 Glimbo (Companion 154) / Glimbo (Companion 154) / CompLV2(154)": 0,
    "Artifact Find / 🐾 Glimbo (Companion 154) / Glimbo (Companion 154) / Companions(154)": 0.6,
    "Artifact Find / 🐾 Litterfish (Companion 43)": 1.25,
    "Artifact Find / 🐾 Litterfish (Companion 43) / Litterfish (Companion 43)": 0.25,
    "Artifact Find / 🐾 Litterfish (Companion 43) / Litterfish (Companion 43) / Companions(43)": 0.25,
    "Artifact Find / 🐾 Magni Pufferfin (Companion 56)": 20,
    "Artifact Find / 🐾 Magni Pufferfin (Companion 56) / Magni Pufferfin (Companion 56)": 20,
    "Artifact Find / 🐾 Magni Pufferfin (Companion 56) / Magni Pufferfin (Companion 56) / Companions(56)": 100,
    "Artifact Find / 💻 Artifact Attraction (Mainframe 14)": 1.5,
    "Artifact Find / 💻 Artifact Attraction (Mainframe 14) / Artifact Attraction (Mainframe 14)": 50,
    "Artifact Find / 💻 Artifact Attraction (Mainframe 14) / Artifact Attraction (Mainframe 14) / MainframeBonus(14)": 50,
    "Artifact Find / 💻 Artifact Attraction (Mainframe 14) / Artifact Attraction (Mainframe 14) / MainframeBonus(14) / GenINFO[92][14]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3)": 3.0983960332304594,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3)": 209.83960332304596,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0)": 209.83960332304596,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot": 55830,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][10]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][11]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][17]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][22]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][34]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][35]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][37]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][38]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][7]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / GenINFO[92][8]": 1,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / Tome.dropRateMap": 1967869.7231606226,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / Tome.totalPoints": 55830,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3) / Thingies(\"LoreEpiBon\", 3, 0) / DNSM.TomeQTYtot / TotalQuestsComplete": 322,
    "Artifact Find / 🔘 Artifact Odds (Minehead Button 3)": 2.6613437500000003,
    "Artifact Find / 🔘 Artifact Odds (Minehead Button 3) / Artifact Odds (Minehead Button 3)": 166.13437500000006,
    "Artifact Find / 🔘 Artifact Odds (Minehead Button 3) / Artifact Odds (Minehead Button 3) / Minehead(\"Button_Bonuses\", 3, 0)": 166.13437500000006,
    "Artifact Find / 🔬 The Maw (Research Grid 106)": 2.8449999999999998,
    "Artifact Find / 🔬 The Maw (Research Grid 106) / The Maw (Research Grid 106)": 184.5,
    "Artifact Find / 🔬 The Maw (Research Grid 106) / The Maw (Research Grid 106) / ResearchStuff(\"Grid_Bonus\", 106, 0)": 184.5,
    "Artifact Find / 🗳️ Weekly Vote": 4.116415909090909,
    "Artifact Find / 🗳️ Weekly Vote / Artifact Find (Weekly Vote 20)": 311.6415909090909,
    "Artifact Find / 🗳️ Weekly Vote / Artifact Find (Weekly Vote 20) / Summoning(\"VotingBonusz\", 20, 0)": 311.6415909090909,
    "Artifact Find / 🗿 Justice Monument": 225.66,
    "Artifact Find / 🗿 Justice Monument / Justice Monument: Artifact Find Chance": 22466,
    "Artifact Find / 🗿 Justice Monument / Justice Monument: Artifact Find Chance / Holes(\"MonumentROGbonuses\", 1, 2)": 22466,
    "Artifact Find / 🦈 Killroy Skull Shop (Artifact Find)": 1.907862407862408,
    "Artifact Find / 🦈 Killroy Skull Shop (Artifact Find) / Artifact Find Chance (Killroy Skull Shop 11)": 1.907862407862408,
    "Artifact Find / 🦈 Killroy Skull Shop (Artifact Find) / Artifact Find Chance (Killroy Skull Shop 11) / RandomEvent(\"KillroyBonuses\", 0, 0)": 1.907862407862408,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74)": 5.0976,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74) / Turtle Tisane (Vial 74)": 409.76,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74) / Turtle Tisane (Vial 74) / DNSM.AlchVials(\"6turtle\")": 409.76,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74) / Turtle Tisane (Vial 74) / DNSM.AlchVials(\"6turtle\") / CauldronStats(\"VialBonus\", 4, 74, 0)": 409.76,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74) / Turtle Tisane (Vial 74) / DNSM.AlchVials(\"6turtle\") / CauldronStats(\"VialBonus\", 4, 74, 0) / MainframeBonus(10)": 2,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74) / Turtle Tisane (Vial 74) / DNSM.AlchVials(\"6turtle\") / CauldronStats(\"VialBonus\", 4, 74, 0) / MainframeBonus(10) / GenINFO[92][10]": 1,
    "Artifact Find / 🪼 Sapphire Ring (Jelly Obstruction 20)": 1.2,
    "Artifact Find / 🪼 Sapphire Ring (Jelly Obstruction 20) / Sapphire Ring (Jelly Obstruction 20) — artifact find chance (Jelly Bonus 19)": 20,
    "Artifact Find / 🪼 Sapphire Ring (Jelly Obstruction 20) / Sapphire Ring (Jelly Obstruction 20) — artifact find chance (Jelly Bonus 19) / JellyOperation(\"RoG_BonusQTY\", 19, 0)": 20,
  },
};

// Keyed "family:profile" — the class talents a profile adds back.
export const TOP_ARTI_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {

};

// class key → [family, talent profile]
export const TOP_ARTI_CLASS_PROFILE: Readonly<Record<string, readonly [string, string]>> = {};

// Family used when no class is known (the highest-reaching one).
export const TOP_ARTI_DEFAULT_FAMILY = "all";

/** The top Artifact Find reference for a class — its family's base merged with its profile. */
export function topArtifactFlatForClass(classKey: string | null | undefined): FlatMap {
  const [family, profile] = (classKey && TOP_ARTI_CLASS_PROFILE[classKey]) || [TOP_ARTI_DEFAULT_FAMILY, "base"];
  const base = TOP_ARTI_FAMILY_FLAT[family] ?? TOP_ARTI_FAMILY_FLAT[TOP_ARTI_DEFAULT_FAMILY];
  const override = TOP_ARTI_PROFILE_OVERRIDES[`${family}:${profile}`];
  return override ? { ...base, ...override } : base;
}
