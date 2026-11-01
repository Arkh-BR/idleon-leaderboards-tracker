// Top-player Artifact Find reference — per CLASS FAMILY (beginner / warrior /
// archer / mage), the best-of-each-source pools of that family's chars run
// through ONE combine() pass (the same math a real save uses), gated PER
// CLASS for the formula's class talents. Use topArtifactFlatForClass(classKey).
// Large file: lazy-load it, don't import statically.
// Generated 2026-11-01T12:57:29.222Z · 83 players. Refresh: scripts/update-top-artifact.ts.

type FlatMap = Readonly<Record<string, number>>;

export const TOP_ARTI_FAMILY_FLAT: Readonly<Record<string, FlatMap>> = {
  "all": {
    "Artifact Find": 2566756042454381600,
    "Artifact Find / ☠️ Davey Jones": 16.799999999999997,
    "Artifact Find / ☠️ Davey Jones / Davey Jones": 16.799999999999997,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26)": 7.998674705139815,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26) / Artifacto Discoveries (Super Bit 26)": 7.998674705139815,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26) / Artifacto Discoveries (Super Bit 26) / Spelunk[6].length": 105,
    "Artifact Find / ⛏️ Artifacto Discoveries (Super Bit 26) / Artifacto Discoveries (Super Bit 26) / Super Bit 26": 1,
    "Artifact Find / ➕ Additive Pool": 75.67475871955077,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 32)": 302.970297029703,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 32) / Companion 27 Multi": 2,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 32) / Maxed Multi (Super 101 ×2 / Omega 102 ×6)": 6,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 32) / Raw (lv=102)": 25.247524752475247,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 66)": 120.59701492537313,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 66) / Companion 27 Multi": 2,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 66) / Maxed Multi (Super 101 ×2 / Omega 102 ×6)": 2,
    "Artifact Find / ➕ Additive Pool / Artifact Find Arcade Bonus (Arcade 66) / Raw (lv=101)": 30.149253731343283,
    "Artifact Find / ➕ Additive Pool / Artifact Find Chance (Vault 63)": 955.2,
    "Artifact Find / ➕ Additive Pool / Artifact Pilfering (Bribe 34)": 20,
    "Artifact Find / ➕ Additive Pool / Artifact Pilfering (Bribe 34) / Bribe 34 Active": 1,
    "Artifact Find / ➕ Additive Pool / Artifact Pilfering (Bribe 34) / Bribe Value": 20,
    "Artifact Find / ➕ Additive Pool / Boat Captain (Artifact Find Chance)": 1952,
    "Artifact Find / ➕ Additive Pool / Boat Captain (Artifact Find Chance) / Captain index": 1,
    "Artifact Find / ➕ Additive Pool / Captains of type 6 (not counted)": 0,
    "Artifact Find / ➕ Additive Pool / Captains of type 6 (not counted) / Type-6 captains": 20,
    "Artifact Find / ➕ Additive Pool / Chocotastic Muffin Sticker (Sticker 2)": 1083.7335600000001,
    "Artifact Find / ➕ Additive Pool / Fauxory Tusk (Artifact 3)": 2499,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21)": 174,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Mamooth": 58,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Mamooth / Bonus/Lv": 2,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Mamooth / Shiny EXP": 610636828.561933,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Mamooth / Shiny Lv": 29,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Soda Can": 58,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Soda Can / Bonus/Lv": 2,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Soda Can / Shiny EXP": 610633328.3277346,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Soda Can / Shiny Lv": 29,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Tyson": 58,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Tyson / Bonus/Lv": 2,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Tyson / Shiny EXP": 780981185.413988,
    "Artifact Find / ➕ Additive Pool / Higher Artifact Find Chance Shiny Pet (Breeding 21) / Tyson / Shiny Lv": 29,
    "Artifact Find / ➕ Additive Pool / Sailing Artifact Chance (Fractal Island 3)": 20,
    "Artifact Find / ➕ Additive Pool / Sailing Artifact Chance (Fractal Island 3) / Unlocked": 1,
    "Artifact Find / ➕ Additive Pool / Transcendent Artifacts (Research Grid 109)": 39.975,
    "Artifact Find / ➕ Additive Pool / Tune of Artifaction (Cavern Upgrade 55)": 300,
    "Artifact Find / ⭐ Artifosho Star Sign": 2.5,
    "Artifact Find / ⭐ Artifosho Star Sign / Artifosho (Star Sign 61)": 150,
    "Artifact Find / ⭐ Artifosho Star Sign / Artifosho (Star Sign 61) / Artifosho (Star Sign 61)": 15,
    "Artifact Find / ⭐ Artifosho Star Sign / Artifosho (Star Sign 61) / Seraph Multi": 10,
    "Artifact Find / 🌊 Nightmariner": 951.9215645152834,
    "Artifact Find / 🌊 Nightmariner / Nightmariner (Menagerie)": 951.9215645152834,
    "Artifact Find / 🌟 Glowing Veil (Pristine Charm 2)": 1.4,
    "Artifact Find / 🌟 Glowing Veil (Pristine Charm 2) / Glowing Veil (Pristine Charm 2)": 40,
    "Artifact Find / 🌟 Glowing Veil (Pristine Charm 2) / Glowing Veil (Pristine Charm 2) / Charm Bonus": 40,
    "Artifact Find / 🌟 Glowing Veil (Pristine Charm 2) / Glowing Veil (Pristine Charm 2) / Unlocked": 1,
    "Artifact Find / 🌿 5 Leaf Clover (Exotic Market 45)": 1.2734136830911025,
    "Artifact Find / 🌿 5 Leaf Clover (Exotic Market 45) / 5 Leaf Clover (Exotic Market 45)": 27.341368309110244,
    "Artifact Find / 🍣 Cucumber Uramaki (Sushi Tier 8)": 1.3,
    "Artifact Find / 🍣 Cucumber Uramaki (Sushi Tier 8) / Cucumber Uramaki (Sushi Tier 8) — artifact find chance (RoG Bonus 7)": 30,
    "Artifact Find / 🍣 Cucumber Uramaki (Sushi Tier 8) / Cucumber Uramaki (Sushi Tier 8) — artifact find chance (RoG Bonus 7) / RoG Value": 30,
    "Artifact Find / 🍣 Cucumber Uramaki (Sushi Tier 8) / Cucumber Uramaki (Sushi Tier 8) — artifact find chance (RoG Bonus 7) / Unique Sushi": 59,
    "Artifact Find / 🎨 Bright Cyan (Palette 5)": 30.123595505617978,
    "Artifact Find / 🎨 Bright Cyan (Palette 5) / Bright Cyan (Palette 5)": 2912.3595505617977,
    "Artifact Find / 🏆 Artifact Find (Winner Bonus 3)": 55.4635,
    "Artifact Find / 🏆 Artifact Find (Winner Bonus 3) / Artifact Find (Winner Bonus 3)": 5446.35,
    "Artifact Find / 🏷️ Chocotastic Muffin Sticker (Sticker 2)": 1,
    "Artifact Find / 🏷️ Chocotastic Muffin Sticker (Sticker 2) / Chocotastic Muffin Sticker (Sticker 2)": 0,
    "Artifact Find / 🐌 Noble Sluggo (Event Shop 48)": 1.5,
    "Artifact Find / 🐌 Noble Sluggo (Event Shop 48) / Noble Sluggo (Event Shop 48)": 1.5,
    "Artifact Find / 🐌 Noble Sluggo (Event Shop 48) / Noble Sluggo (Event Shop 48) / Owned": 1,
    "Artifact Find / 🐾 Glimbo (Companion 154)": 2,
    "Artifact Find / 🐾 Glimbo (Companion 154) / Glimbo (Companion 154)": 2,
    "Artifact Find / 🐾 Glimbo (Companion 154) / Glimbo (Companion 154) / Companion 154": 0.6,
    "Artifact Find / 🐾 Glimbo (Companion 154) / Glimbo (Companion 154) / Stage 2": 0,
    "Artifact Find / 🐾 Litterfish (Companion 43)": 1.25,
    "Artifact Find / 🐾 Litterfish (Companion 43) / Litterfish (Companion 43)": 0.25,
    "Artifact Find / 🐾 Magni Pufferfin (Companion 56)": 20,
    "Artifact Find / 🐾 Magni Pufferfin (Companion 56) / Magni Pufferfin (Companion 56)": 20,
    "Artifact Find / 💻 Artifact Attraction (Mainframe 14)": 1.5,
    "Artifact Find / 💻 Artifact Attraction (Mainframe 14) / Artifact Attraction (Mainframe 14)": 50,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3)": 3.095745578447201,
    "Artifact Find / 📜 Artifact Find (Lore Episode 3) / Artifact Find (Lore Episode 3)": 209.57455784472012,
    "Artifact Find / 🔘 Artifact Odds (Minehead Button 3)": 2.49889,
    "Artifact Find / 🔘 Artifact Odds (Minehead Button 3) / Artifact Odds (Minehead Button 3)": 149.88899999999998,
    "Artifact Find / 🔬 The Maw (Research Grid 106)": 2.8449999999999998,
    "Artifact Find / 🔬 The Maw (Research Grid 106) / The Maw (Research Grid 106)": 184.5,
    "Artifact Find / 🗳️ Weekly Vote": 4.2172363636363634,
    "Artifact Find / 🗳️ Weekly Vote / Artifact Find (Weekly Vote 20)": 321.7236363636364,
    "Artifact Find / 🗳️ Weekly Vote / Artifact Find (Weekly Vote 20) / Voting multi": 10.378181818181819,
    "Artifact Find / 🗿 Justice Monument": 225.615,
    "Artifact Find / 🗿 Justice Monument / Justice Monument: Artifact Find Chance": 22461.5,
    "Artifact Find / 🦈 Killroy Skull Shop (Artifact Find)": 1.900727994705493,
    "Artifact Find / 🦈 Killroy Skull Shop (Artifact Find) / Artifact Find Chance (Killroy Skull Shop 11)": 1.900727994705493,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74)": 5.0976,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74) / Turtle Tisane (Vial 74)": 409.76,
    "Artifact Find / 🧪 Turtle Tisane (Vial 74) / Turtle Tisane (Vial 74) / TURTLE_TISANE": 409.76,
    "Artifact Find / 🪼 Sapphire Ring (Jelly Obstruction 20)": 1.2,
    "Artifact Find / 🪼 Sapphire Ring (Jelly Obstruction 20) / Sapphire Ring (Jelly Obstruction 20) — artifact find chance (Jelly Bonus 19)": 20,
    "Artifact Find / 🪼 Sapphire Ring (Jelly Obstruction 20) / Sapphire Ring (Jelly Obstruction 20) — artifact find chance (Jelly Bonus 19) / Bonus Value": 20,
    "Artifact Find / 🪼 Sapphire Ring (Jelly Obstruction 20) / Sapphire Ring (Jelly Obstruction 20) — artifact find chance (Jelly Bonus 19) / Successful Operations": 40,
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
