export type CategoryKey =
  | "global"
  | "general"
  | "tasks"
  | "skills"
  | "character"
  | "misc"
  | "caverns";

export type BoardSpec = { apiKey: string; label: string };

export type CategorySpec = {
  key: CategoryKey;
  label: string;
  boards: BoardSpec[];
};

export const CATEGORIES: CategorySpec[] = [
  {
    key: "global",
    label: "Global",
    boards: [{ apiKey: "globalRanking", label: "Global Ranking" }],
  },
  {
    key: "general",
    label: "General",
    boards: [
      { apiKey: "totalMoney", label: "Total Money" },
      { apiKey: "totalLevels", label: "Total Levels" },
      { apiKey: "totalStatues", label: "Total Statues" },
      { apiKey: "totalBuildings", label: "Total Buildings" },
      { apiKey: "totalGreenStacks", label: "Total Green Stacks" },
      { apiKey: "logSample", label: "Log Sample" },
      { apiKey: "copperSample", label: "Copper Sample" },
      { apiKey: "fliesSample", label: "Flies Sample" },
      { apiKey: "sporeSample", label: "Spore Sample" },
      { apiKey: "goldFishSample", label: "Gold Fish Sample" },
      { apiKey: "totalWaves", label: "Total Waves" },
      { apiKey: "totalMeals", label: "Total Meals" },
      { apiKey: "totalShrines", label: "Total Shrines" },
      { apiKey: "totalVials", label: "Total Vials" },
      { apiKey: "totalCards", label: "Total Cards" },
      { apiKey: "bits", label: "Bits" },
      { apiKey: "godRank", label: "God Rank" },
      { apiKey: "greenMushroomKills", label: "Green Mushroom Kills" },
      { apiKey: "highestCropOg", label: "Highest Crop Og" },
      { apiKey: "jadeCoins", label: "Jade Coins" },
      { apiKey: "whiteEssence", label: "White Essence" },
      { apiKey: "totalBoats", label: "Total Boats" },
      { apiKey: "logBook", label: "Log Book" },
      { apiKey: "totalShinyLevels", label: "Total Shiny Levels" },
      { apiKey: "totalBreedabilityLevels", label: "Total Breedability Levels" },
      { apiKey: "totalPlotRanks", label: "Total Plot Ranks" },
      { apiKey: "totalPrimeKills", label: "Total Prime Kills" },
      { apiKey: "highestPowerPet", label: "Highest Power Pet" },
      { apiKey: "slab", label: "Slab" },
      { apiKey: "totalTomePoints", label: "Total Tome Points" },
      { apiKey: "totalPaletteLevels", label: "Total Palette Levels" },
      { apiKey: "totalDivinityBlessingLevels", label: "Total Divinity Blessing Levels" },
      { apiKey: "totalSummoningUpgrades", label: "Total Summoning Upgrades" },
      { apiKey: "totalSpelunkingUpgrades", label: "Total Spelunking Upgrades" },
      { apiKey: "totalZenithMarketUpgrades", label: "Total Zenith Market Upgrades" },
      { apiKey: "totalCoralKidUpgrades", label: "Total Coral Kid Upgrades" },
      { apiKey: "totalSushiStationUpgrades", label: "Total Sushi Station Upgrades" },
      { apiKey: "totalSushiKnowledgeLevels", label: "Total Sushi Knowledge Levels" },
      { apiKey: "arenaWaves", label: "Arena Waves" },
      { apiKey: "dkOrbKills", label: "DK Orb Kills" },
      { apiKey: "sbPlunderousKills", label: "SB Plunderous Kills" },
      { apiKey: "esWormholeKills", label: "ES Wormhole Kills" },
      { apiKey: "vwPortals", label: "VW Portals" },
      { apiKey: "fractalHours", label: "Fractal Hours" },
      { apiKey: "dungeonCredits", label: "Dungeon Credits" },
      { apiKey: "dungeonFlurbos", label: "Dungeon Flurbos" },
      { apiKey: "endlessSummoningWins", label: "Endless Summoning Wins" },
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    boards: [
      { apiKey: "highestDamage", label: "Highest Damage" },
      { apiKey: "afkTime", label: "AFK Time" },
      { apiKey: "monstersKilled", label: "Monsters Killed" },
      { apiKey: "postOfficeOrders", label: "Post Office Orders" },
      { apiKey: "refinedSalts", label: "Refined Salts" },
      { apiKey: "totalMaterialPrinted", label: "Total Material Printed" },
      { apiKey: "trashedCogs", label: "Trashed Cogs" },
      { apiKey: "plantsPicked", label: "Plants Picked" },
      { apiKey: "totalBubbles", label: "Total Bubbles" },
      { apiKey: "totalStamps", label: "Total Stamps" },
      { apiKey: "highestNugget", label: "Highest Nugget" },
    ],
  },
  {
    key: "skills",
    label: "Skills",
    boards: [
      { apiKey: "totalSkillsLevels", label: "Total Skills Levels" },
      { apiKey: "mining", label: "Mining" },
      { apiKey: "smithing", label: "Smithing" },
      { apiKey: "choppin", label: "Choppin" },
      { apiKey: "fishing", label: "Fishing" },
      { apiKey: "alchemy", label: "Alchemy" },
      { apiKey: "catching", label: "Catching" },
      { apiKey: "trapping", label: "Trapping" },
      { apiKey: "construction", label: "Construction" },
      { apiKey: "worship", label: "Worship" },
      { apiKey: "cooking", label: "Cooking" },
      { apiKey: "breeding", label: "Breeding" },
      { apiKey: "laboratory", label: "Laboratory" },
      { apiKey: "sailing", label: "Sailing" },
      { apiKey: "divinity", label: "Divinity" },
      { apiKey: "gaming", label: "Gaming" },
      { apiKey: "farming", label: "Farming" },
      { apiKey: "sneaking", label: "Sneaking" },
      { apiKey: "summoning", label: "Summoning" },
      { apiKey: "spelunking", label: "Spelunking" },
      { apiKey: "research", label: "Research" },
    ],
  },
  {
    key: "character",
    label: "Character",
    boards: [
      { apiKey: "strength", label: "Strength" },
      { apiKey: "agility", label: "Agility" },
      { apiKey: "wisdom", label: "Wisdom" },
      { apiKey: "luck", label: "Luck" },
      { apiKey: "level", label: "Level" },
      { apiKey: "dropRate", label: "Drop Rate" },
      { apiKey: "cashMulti", label: "Cash Multi" },
      { apiKey: "totalGrimoireUpgrades", label: "Total Grimoire Upgrades" },
      { apiKey: "totalCompassUpgrades", label: "Total Compass Upgrades" },
      { apiKey: "totalArcanistUpgrades", label: "Total Arcanist Upgrades" },
      { apiKey: "defence", label: "Defence" },
      { apiKey: "accuracy", label: "Accuracy" },
      { apiKey: "hp", label: "HP" },
      { apiKey: "mp", label: "MP" },
    ],
  },
  {
    key: "misc",
    label: "Misc",
    boards: [
      { apiKey: "w1Colo", label: "W1 Colo" },
      { apiKey: "w2Colo", label: "W2 Colo" },
      { apiKey: "w3Colo", label: "W3 Colo" },
      { apiKey: "w4Colo", label: "W4 Colo" },
      { apiKey: "w5Colo", label: "W5 Colo" },
      { apiKey: "w6Colo", label: "W6 Colo" },
      { apiKey: "choppingMinigame", label: "Chopping Minigame" },
      { apiKey: "fishingMinigame", label: "Fishing Minigame" },
      { apiKey: "catchingMinigame", label: "Catching Minigame" },
      { apiKey: "miningMinigame", label: "Mining Minigame" },
      { apiKey: "penpalMinigame", label: "Penpal Minigame" },
      { apiKey: "hoopsMinigame", label: "Hoops Minigame" },
      { apiKey: "dartsMinigame", label: "Darts Minigame" },
      { apiKey: "redoxSaltRank", label: "Redox Salt Rank" },
      { apiKey: "explosiveSaltRank", label: "Explosive Salt Rank" },
      { apiKey: "spontaneitySaltRank", label: "Spontaneity Salt Rank" },
      { apiKey: "dioxideSaltRank", label: "Dioxide Salt Rank" },
      { apiKey: "purpleSaltRank", label: "Purple Salt Rank" },
      { apiKey: "nulloSaltRank", label: "Nullo Salt Rank" },
      { apiKey: "crosslinkSaltRank", label: "Crosslink Salt Rank" },
      { apiKey: "propagatedSaltRank", label: "Propagated Salt Rank" },
      { apiKey: "anionicSaltRank", label: "Anionic Salt Rank" },
      { apiKey: "totalDustCollected", label: "Total Dust Collected" },
      { apiKey: "totalBonesCollected", label: "Total Bones Collected" },
      { apiKey: "totalTachyonsCollected", label: "Total Tachyons Collected" },
      { apiKey: "highestCogExp", label: "Highest Cog Exp" },
      { apiKey: "highestConstructExp/hr", label: "Highest Construct Exp/hr" },
      { apiKey: "highestCallMeBob", label: "Highest Call Me Bob" },
      { apiKey: "highestCallMeAsh", label: "Highest Call Me Ash" },
      { apiKey: "highestHammerHammer", label: "Highest Hammer Hammer" },
      { apiKey: "highestBigP", label: "Highest Big P" },
      { apiKey: "highestShowdownLevel", label: "Highest Showdown Level" },
      { apiKey: "mostGiantsKilled", label: "Most Giants Killed" },
      { apiKey: "biggestHaulSpelunking", label: "Biggest Haul Spelunking" },
      { apiKey: "highestSpelunkingPower", label: "Highest Spelunking Power" },
      { apiKey: "mineheadOpponentsDefeated", label: "Minehead Opponents Defeated" },
      { apiKey: "totalGrandDiscoveries", label: "Total Grand Discoveries" },
      { apiKey: "glimboTotalTrades", label: "Glimbo Total Trades" },
      { apiKey: "totalGamingCrowns", label: "Total Gaming Crowns" },
      { apiKey: "highestMegafeather", label: "Highest Megafeather" },
      { apiKey: "highestMegaFish", label: "Highest Mega Fish" },
      { apiKey: "highestMegaFlesh", label: "Highest Mega Flesh" },
    ],
  },
  {
    key: "caverns",
    label: "Caverns",
    boards: [
      { apiKey: "totalMeasurementLevels", label: "Total Measurement Levels" },
      { apiKey: "totalOpals", label: "Total Opals" },
      { apiKey: "totalLayersDestroyed", label: "Total Layers Destroyed" },
      { apiKey: "totalBarExpansions", label: "Total Bar Expansions" },
      { apiKey: "bestDenScore", label: "Best Den Score" },
      { apiKey: "totalBraveryLevels", label: "Total Bravery Levels" },
      { apiKey: "totalJusticeLevels", label: "Total Justice Levels" },
      { apiKey: "highestJusticeRound", label: "Highest Justice Round" },
      { apiKey: "bellRings", label: "Bell Rings" },
      { apiKey: "bellPings", label: "Bell Pings" },
      { apiKey: "totalStringLevels", label: "Total String Levels" },
      { apiKey: "brokenJars", label: "Broken Jars" },
      { apiKey: "totalCollectibleLevels", label: "Total Collectible Levels" },
      { apiKey: "totalGambitTime", label: "Total Gambit Time" },
      { apiKey: "highestVillagerExp/hr", label: "Highest Villager Exp/hr" },
      { apiKey: "highestColonyLevel", label: "Highest Colony Level" },
      { apiKey: "highestSanctumLevel", label: "Highest Sanctum Level" },
    ],
  },
];

export type FlatBoard = {
  categoryKey: CategoryKey;
  categoryLabel: string;
  apiKey: string;
  label: string;
};

export function flatBoards(): FlatBoard[] {
  const out: FlatBoard[] = [];
  for (const cat of CATEGORIES) {
    for (const b of cat.boards) {
      out.push({
        categoryKey: cat.key,
        categoryLabel: cat.label,
        apiKey: b.apiKey,
        label: b.label,
      });
    }
  }
  return out;
}
