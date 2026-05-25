# Tome Task Parity Report

> Side-by-side comparison of how **our extractor** vs **IdleonToolbox** (Morta1/IdleonToolbox @ `parsers/world-4/tome.ts`) reads the raw quantity for each of the 118 tome tasks. Both apply identical curve formulas to the quantity — divergences here are the only source of pts mismatches.

Generated: 2026-05-25T04:40:52.958Z  
Source: `scripts/generate-parity-report.ts`  
IT pinned: cloned at `web/scripts/it-source/` (gitignored)

## Summary

| Status | Count | Meaning |
| --- | ---: | --- |
| ✓ exact | 24 | Same field / function reference on both sides (heuristic). |
| ✅ verified-fix | 5 | Manually validated against a real save; recent bug-fix already aligned with IT. |
| ❌ different | 0 | Heuristic detected a divergence (different OptLacc index). |
| ⚠️ uncertain | 89 | Heuristic couldn't classify — needs human eyes. |
| 🔁 LB fallback available | 26 | Our extractor falls back to a leaderboard if local computation returns null. |
| **TOTAL** | **118** | |

> The classifier is conservative — "uncertain" doesn't mean broken, just "the regex isn't smart enough to tell." In practice most uncertain rows are exact ports. Focus eyeball-review on rows you suspect after a real-save diff.

## Compact table

| # | Task | computeIdx | Status | Our source label | IT push (head) |
| ---: | --- | ---: | :---: | --- | --- |
| 0 | Account LV | 5 | ⚠️ | `raw.Lv0_X` | `account?.accountLevel` |
| 1 | Account Skills LV | 11 | ⚠️ | `sum Lv0_X[1..20]` | `Object.entries(account?.totalSkillsLevels).reduce((sum: number, [sk...` |
| 2 | Total Talent Max LV | 3 | ⚠️ | `max SL/SM per talent` | `calcTalentMaxLevel(characters) // TODO: CHECK` |
| 3 | Items Found | 65 | ✓ | `parsedData.slab` | `account?.looty?.lootyRaw?.length` |
| 4 | Total Bubble LV | 22 | ⚠️ | `CauldronInfo[0..3] sum` | `calcBubbleLevels(account?.alchemy?.bubbles)` |
| 5 | Stamp Total LV | 0 | ⚠️ | `raw.StampLv` | `calcStampLevels(account?.stamps)` |
| 6 | Cards Total LV | 2 | ⚠️ | `sum(stars+1) per card` | `calcCardsLevels(account?.cards)` |
| 7 | Statue Total LV | 1 | ⚠️ | `raw.StatueLevels_0` | `calcStatueLevels(account?.statues)` |
| 8 | Total Achievements Completed | 7 | ⚠️ | `raw.AchieveReg` | `calcTotalAchievements(account?.achievements)` |
| 9 | Unique Quests Completed | 4 | ⚠️ | `raw.QuestComplete` | `calcTotalQuestCompleted(characters)` |
| 10 | Total Tasks Completed | 6 | ⚠️ | `raw.TaskZZ1 sum` | `calcTotalTasks(account?.tasks)` |
| 11 | Vault Upgrade bonus LV | 81 | ⚠️ | `min(1500,UpgVault[57]*2)` | `Math.min(1500, getUpgradeVaultBonus(account?.upgradeVault?.upgrades...` |
| 12 | Most Money held in Storage | 8 | ⚠️ | `OptLacc[198]` | `account.accountOptions?.[198]` |
| 13 | Most Spore Caps held in Inventory at once | 9 | ⚠️ | `OptLacc[208]` | `account.accountOptions?.[208]` |
| 14 | Total Colosseum Score | 53 | ⚠️ | `raw.FamValColosseumHighscores` | `calcColoTotalScore(account?.highscores?.coloHighscores)` |
| 15 | Trophies Found | 10 | ⚠️ | `raw.Cards1 Trophy` | `calcTrophiesFound(account?.looty)` |
| 16 | Nametags Found | 107 | ⚠️ | `raw.Cards1 EquipmentNametag` | `calcNametagsFound(account?.looty) // 107` |
| 17 | Premium Hats Found | 109 | ⚠️ | `raw.Spelunk[46].length` | `account?.hatRack?.totalHats // 109` |
| 18 | Best Spiketrap Surprise round | 12 | ⚠️ | `OptLacc[201]` | `account.accountOptions?.[201] // spike round` |
| 19 | Tournaments Registrations | 113 | ⚠️ | `OptLacc[498]` | `account.accountOptions?.[498] // 113 tournament registration` |
| 20 | Lava Dev Streams watched | 106 | ⚠️ | `OptLacc[443]` | `account?.accountOptions?.[443] // 106` |
| 21 | Total Minigame Highscore | 75 | ✅ | `FamValMinigameHiscores sum[:5]` | `calcMinigameTotalScore(account?.highscores?.minigameHighscores)` |
| 22 | Total AFK Hours claimed | 13 | ⚠️ | `raw.TaskZZ0[0][2]` | `account?.tasks?.[0]?.[0]?.[2]` |
| 23 | DPS Record on Shimmer Island | 14 | ⚠️ | `OptLacc[172]` | `account.accountOptions?.[172] // DPS in shimmer island` |
| 24 | Total Arcade Gold Ball Shop Upgrade LV | 80 | ⚠️ | `raw.ArcadeUpg sum` | `account.arcade?.totalUpgradeLevels` |
| 25 | Most Balls earned from LBoFaF | 79 | ⚠️ | `OptLacc[222]` | `account.accountOptions?.[222] // Most Balls earned from LBoFaF` |
| 26 | Jackpots Hit in Arcade | 25 | ⚠️ | `OptLacc[199]` | `account.accountOptions?.[199] // Jackpots Hit in Arcade` |
| 27 | Star Talent Points Owned | 15 | ⚠️ | `max(charLv-1+skillSum1-9-3)` | `calcTotalStarTalent(characters, account)` |
| 28 | Average kills for a Crystal Spawn | 16 | ✓ | `1/OptLacc[202]` | `1 / account.accountOptions?.[202] // crystal spawn` |
| 29 | Dungeon Rank | 17 | ⚠️ | `OptLacc[71] vs dungeonLevels` | `account?.dungeons?.rank` |
| 30 | Highest Drop Rate Multi | 18 | ⚠️ | `OptLacc[200]` | `account.accountOptions?.[200] // highest drop multi` |
| 31 | Constellations Completed | 19 | ⚠️ | `raw.SSprog sum done` | `account?.rawConstellationsDone` |
| 32 | Unique Obols Found | 21 | ⚠️ | `raw.Cards1 Obol` | `calcObolsFound(account?.looty)` |
| 33 | Total Vial LV | 23 | ⚠️ | `CauldronInfo[4] sum` | `calcVialsLevels(account?.alchemy?.vials)` |
| 34 | Total Sigil LV | 24 | ⚠️ | `CauldronP2W[4] sum` | `calcSigilsLevels(account?.alchemy?.p2w?.sigils)` |
| 35 | Post Office PO Boxes Earned | 26 | ⚠️ | `raw.CYDeliveryBox*` | `account?.currencies?.DeliveryBoxComplete + account?.currencies?.Del...` |
| 36 | Highest Killroy Score on a Warrior | 27 | ⚠️ | `OptLacc[204]` | `account.accountOptions?.[204] // killroy warrior` |
| 37 | Highest Killroy Score on an Archer | 28 | ⚠️ | `OptLacc[205]` | `account.accountOptions?.[205] // killroy archer` |
| 38 | Highest Killroy Score on a Mage | 29 | ⚠️ | `OptLacc[206]` | `account.accountOptions?.[206] // killroy mage` |
| 39 | Megafeathers Earned from Orion | 85 | ⚠️ | `OptLacc[262]` | `account.accountOptions?.[262]` |
| 40 | Megafish Earned from Poppy | 86 | ⚠️ | `OptLacc[279]` | `account.accountOptions?.[279]` |
| 41 | Megaflesh Earned from Bubba | 108 | ✓ | `raw.Bubba[1][8]` | `account?.bubba?.megafleshOwned // 108` |
| 42 | Fastest Time to kill Chaotic Efaunt (in Seconds) | 30 | ✓ | `1000 - OptLacc[207]` | `1e3 - account.accountOptions?.[207] // Fastest Time to kill Chaotic` |
| 43 | Largest Oak Log Printer Sample | 31 | ⚠️ | `OptLacc[211]` | `account.accountOptions?.[211] // Largest_Oak_Log_Printer_Sample` |
| 44 | Largest Copper Ore Printer Sample | 32 | ⚠️ | `OptLacc[212]` | `account.accountOptions?.[212] // Largest_Copper_Ore_Printer_Sample` |
| 45 | Largest Spore Cap Printer Sample | 33 | ⚠️ | `OptLacc[213]` | `account.accountOptions?.[213] // Largest_Spore_Cap_Printer_Sample` |
| 46 | Largest Goldfish Printer Sample | 34 | ⚠️ | `OptLacc[214]` | `account.accountOptions?.[214] // Largest_Goldfish_Printer_Sample` |
| 47 | Largest Fly Printer Sample | 35 | ⚠️ | `OptLacc[215]` | `account.accountOptions?.[215] // Largest_Fly_Printer_Sample` |
| 48 | Total Best Wave in Worship | 37 | ⚠️ | `sum TotemInfo[0]` | `account?.towers?.totalWaves` |
| 49 | Best Non Duplicate Goblin Gorefest Wave | 36 | ⚠️ | `OptLacc[209]` | `account.accountOptions?.[209] // Best_Non_Duplicate_Goblin_Gorefest...` |
| 50 | Total Prayer Upgrade LV | 76 | ⚠️ | `sum PrayOwned[:19]` | `calcTotalPrayersLevel(account?.prayers)` |
| 51 | Total Digits of all Deathnote Kills | 38 | ⚠️ | `deathNote99 + miniBoss digits` | `calcTotalKillsDigits(account?.deathNote)` |
| 52 | Most Giants Killed in a Single Week | 54 | ⚠️ | `OptLacc[217]` | `account.accountOptions?.[217] // Most Giants Killed in a Single Week` |
| 53 | Total Refinery Rank | 40 | ✓ | `Refinery salts[0..5].rank sum` | `account?.refinery?.totalLevels` |
| 54 | Total Atom Upgrade LV | 41 | ✓ | `raw.Atoms` | `calcTotalAtomLevels(account?.atoms?.atoms)` |
| 55 | Total Construct Buildings LV | 42 | ⚠️ | `Tower sum[0..26]` | `account?.towers?.totalLevels` |
| 56 | Equinox Clouds Completed | 39 | ⚠️ | `WeeklyBoss d_*==-1` | `account?.equinox?.completedClouds` |
| 57 | Most Greenstacks in Storage | 44 | ⚠️ | `OptLacc[224]` | `account.accountOptions?.[224] // Most Greenstacks in Storage` |
| 58 | Total Cooking Meals LV | 50 | ✓ | `raw.Meals[0] sum` | `calcTotalMeals(account?.cooking?.meals)` |
| 59 | Total Kitchen Upgrade LV | 48 | ✓ | `Cooking sum[6..8]` | `getTotalKitchenLevels(account?.cooking?.kitchens)` |
| 60 | Highest Power Mob | 46 | ✓ | `max powers PetsStored+Breeding[3]` | `calcHighestPower(account?.breeding)` |
| 61 | Fastest Time reaching Round 100 Arena (in Seconds) | 47 | ✓ | `1000 - OptLacc[220]` | `1e3 - account.accountOptions?.[220] // Fastest Time reaching Round ...` |
| 62 | Total Shiny Mob LV | 49 | ✅ | `sum getShinyLevel per pet` | `account?.breeding?.totalShinyLevels` |
| 63 | Total Mob Breedability LV | 51 | ✅ | `sum breedingLv per pet` | `account?.breeding?.totalBreedabilityLv` |
| 64 | Total Lab Chips Owned | 52 | ⚠️ | `Lab[15] sum max(0)` | `account?.lab?.totalRawChips` |
| 65 | Rift Levels Completed | 45 | ⚠️ | `raw.Rift[0]` | `account.rift?.currentRift` |
| 66 | Total Onyx Statues | 55 | ⚠️ | `raw.StuG` | `calcTotalOnyx(account)` |
| 67 | Total Artifacts Found | 60 | ✓ | `Sailing[3] sum` | `calcArtifactsAcquired(account?.sailing?.artifacts)` |
| 68 | Total Boat Upgrade LV | 57 | ✓ | `Boats b[3]+b[5]` | `calcTotalBoatLevels(account?.sailing?.boats)` |
| 69 | Gold Bar Sailing Treasure Owned | 61 | ✓ | `raw.Sailing[1][0] (lootPile)` | `account?.sailing?.lootPile?.[0]?.amount` |
| 70 | Highest Captain LV | 62 | ✓ | `max Captains[i][3]` | `Math.max(...(account?.sailing?.captains?.map(({ level }: any) => le...` |
| 71 | Most Gaming Bits Owned | 66 | ✓ | `raw.Gaming[0]` | `account?.gaming?.bits` |
| 72 | Total Gaming Plants Evolved | 59 | ⚠️ | `raw.GamingSprout[28][1]` | `account?.gaming?.totalPlantsPicked` |
| 73 | Best Gold Nugget | 64 | ✓ | `raw.Gaming[8]` | `account?.gaming?.bestNugget` |
| 74 | Highest Immortal Snail LV | 63 | ✓ | `max(GamingSprout[8],OptLacc[210])` | `Math.max(account?.gaming?.snailLevel, account.accountOptions?.[210])` |
| 75 | Rat King Crowns Reclaimed | 111 | ⚠️ | `Research[11].length` | `account?.gaming?.ratKingCrownsClaimed // 111 Rat king crowns claimed` |
| 76 | God Rank in Divinity | 58 | ✓ | `Divinity[0..10] sum` | `account?.divinity?.godRank` |
| 77 | Fastest Time to Kill 200 Tremor Wurms (in Seconds) | 56 | ✓ | `1000 - OptLacc[218]` | `1e3 - account.accountOptions?.[218] // Fastest Time to Kill 200 Tre...` |
| 78 | Total Opals Found | 93 | ⚠️ | `Holes[7] sum` | `account?.hole?.totalOpalsFound` |
| 79 | Total LV of Cavern Villagers | 84 | ⚠️ | `Holes[1] sum` | `account?.hole?.totalVillagersLevels // [84]` |
| 80 | Total Digits of all Cavern Resources | 83 | ⚠️ | `sum ceil(lavaLog(Holes[9]))` | `account?.hole?.totalResources // [83]` |
| 81 | Total Resource Layers Destroyed | 92 | ⚠️ | `Holes[11][1,3,5,7] sum` | `account?.hole?.totalLayerResources` |
| 82 | Best Dawg Den score | 91 | ⚠️ | `Holes[11][8]` | `account?.hole?.holesObject?.extraCalculations?.[8]` |
| 83 | Best Bravery Monument Round | 87 | ⚠️ | `Holes[11][73]` | `account?.hole?.holesObject?.extraCalculations?.[73]` |
| 84 | Best Justice Monument Round | 88 | ⚠️ | `Holes[11][74]` | `account?.hole?.holesObject?.extraCalculations?.[74]` |
| 85 | Best Wisdom Monument Round | 89 | ⚠️ | `Holes[11][75]` | `account?.hole?.holesObject?.extraCalculations?.[75]` |
| 86 | Total Gambit Time (in Seconds) | 82 | ⚠️ | `sum Holes[11][65..70]` | `account?.hole?.caverns?.gambit?.totalTime // [82]` |
| 87 | Best Pure Memory Round Reached | 94 | ✓ | `round(min(12,OptLacc[353])+1)` | `Math.round(Math.min(12, account.accountOptions?.[353]) + 1)` |
| 88 | Total Crops Discovered | 68 | ⚠️ | `keys(FarmCrop)` | `account?.farming?.cropsFound` |
| 89 | Total Golden Food Beanstacks | 69 | ⚠️ | `Ninja[104] sum` | `calcTotalBeanstalkLevel(account?.sneaking?.beanstalkData)` |
| 90 | Highest Crop OG | 67 | ✓ | `2^OptLacc[219]` | `Math.pow(2, account.accountOptions?.[219]) // Highest Crop OG` |
| 91 | Total Land Rank | 77 | ⚠️ | `raw.FarmRank[0] sum` | `account?.farming?.totalRanks // total land ranks` |
| 92 | Largest Magic Bean Trade | 78 | ⚠️ | `OptLacc[221]` | `parseFloat(account.accountOptions?.[221]) // Largest Magic Bean Trade` |
| 93 | Farming Stickers Found | 112 | ⚠️ | `OptLacc[140]` | `account?.farming?.totalStickers // 112 stickers claimed` |
| 94 | Ninja Floors Unlocked | 72 | ⚠️ | `OptLacc[232]*12` | `account?.sneaking?.unlockedFloors // [72]` |
| 95 | Jade Emporium Upgrades Purchased | 74 | ⚠️ | `Ninja[102][9].length` | `account?.sneaking?.totalJadeEmporiumUnlocked` |
| 96 | Total Ninja Knowledge Upgrades LV | 99 | ⚠️ | `Ninja[103] sum` | `account?.sneaking?.totalNinjaUpgradeLevels` |
| 97 | Total Career Summoning Wins | 71 | ✅ | `Summon[1].length+OptLacc[319]` | `account?.summoning?.totalWins // Best Endless Summoning Round - acc...` |
| 98 | Total Summoning Upgrades LV | 70 | ⚠️ | `raw.Summon[0] sum` | `account?.summoning?.totalUpgradesLevels` |
| 99 | Familiars Owned in Summoning | 73 | ⚠️ | `Summon[4] reduce` | `account?.summoning?.familiarsOwned` |
| 100 | Total Summoning Boss Stone victories | 96 | ⚠️ | `sum KRbest[SummzTrz*]` | `account?.summoning?.totalSummoningStonesKills // 96` |
| 101 | Most DMG Dealt to Gravestone in a Weekly Battle | 20 | ⚠️ | `OptLacc[203]` | `account.accountOptions?.[203] // Gravestone damage` |
| 102 | Most Tottoise in Storage | 43 | ✓ | `ChestOrder/Critter11A` | `calcTotalItemInStorage(account?.storage?.list, 'Critter11A')` |
| 103 | Best Deathbringer Max Damage in Wraith Mode | 90 | ⚠️ | `OptLacc[356]` | `account.accountOptions?.[356]` |
| 104 | Best Windwalker Max Damage in Tempest Mode | 100 | ⚠️ | `OptLacc[445]` | `account?.accountOptions?.[445] // 100` |
| 105 | Best Arcane Cultist Max Damage in Arcanist Mode | 101 | ⚠️ | `OptLacc[446]` | `account?.accountOptions?.[446]` |
| 106 | Spirited Valley Emperor Boss Kills | 95 | ✓ | `round(OptLacc[369])` | `Math.round(account?.accountOptions?.[369]) // 95` |
| 107 | Total Coral Reef upgrades | 97 | ⚠️ | `Spelunk[13] sum` | `account?.spelunking?.coralReefLevels?.reduce((sum: number, level: n...` |
| 108 | Total Spelunk Shop Upgrades LV | 103 | ⚠️ | `sum max(0,Spelunk[5])` | `account?.spelunking?.totalUpgradeLevels // 103` |
| 109 | Total Spelunk Discoveries made | 104 | ⚠️ | `Spelunk[6].length` | `account?.spelunking?.discoveriesCount // 104` |
| 110 | Deepest Depth reached in a single Delve | 98 | ⚠️ | `max Spelunk[1]` | `Math.max(...(account?.spelunking?.bestCaveLevels || [0])) // 98` |
| 111 | Biggest Haul in a single Delve | 102 | ⚠️ | `max Spelunk[2]` | `Math.max(...(account?.spelunking?.biggestHauls || [0])) // 102` |
| 112 | Highest leveled Spelunker | 105 | ⚠️ | `max Lv0_X[19]` | `account?.spelunking?.highestSpelunkingLevelCharacter // 105` |
| 113 | Minehead Opponents Defeated | 110 | ⚠️ | `Research[7][4]` | `account?.minehead?.opponentsBeat // 110` |
| 114 | Total Research Grid Upgrades | 114 | ✓ | `raw.Research[0] sum` | `account.research?.gridPTSpent // 113 research grid upg` |
| 115 | Total Glimbo Trades | 115 | ⚠️ | `Research[12] sum` | `account.minehead?.glimboTotalTrades // 115 glimbo trades` |
| 116 | Unique Sushi Created | 116 | ✅ | `Sushi[5] consecutive>=0` | `account?.sushiStation?.uniqueSushi // 116 unique sushi` |
| 117 | Button Presses | 117 | ⚠️ | `OptLacc[594]` | `account?.accountOptions?.[594] // 116 unique sushi` |

## Task-by-task detail (118 entries)

Legend:
- **task_idx** — 0-117 in display order (matches `TOME_TASKS`)
- **compute_idx** — `NEI32[task_idx]`; the index our switch and IT's `quantities[]` use
- **Bonus** — `[x1, x2, x3]` curve params (`x2` selects the formula, `x3` is max pts)
- ✓ heuristically equivalent · ✅ manually verified · ❌ heuristic mismatch · ⚠️ unclassified

### #0 — Account LV ⚠️

compute_idx `5` · bonus `[7000, 0, 1500]`

```ts
// Ours (web/lib/tome/compute.ts, case 5):
return R(out, "raw.Lv0_X", ex.rawAccountLevel(data));

// IT (parsers/world-4/tome.ts, push #5):
account?.accountLevel
```

### #1 — Account Skills LV ⚠️

compute_idx `11` · bonus `[18000, 0, 1200]` · LB fallback `skills/totalSkillsLevels`

```ts
// Ours (web/lib/tome/compute.ts, case 11):
{ const v = ex.rawSkillsLevels(data); return v !== null ? R(out, "sum Lv0_X[1..20]", v) : null; }

// IT (parsers/world-4/tome.ts, push #11):
Object.entries(account?.totalSkillsLevels).reduce((sum: number, [skill, { level }]: [string, any]) => skill !== 'character' ? sum + level : sum, 0)
```

### #2 — Total Talent Max LV ⚠️

compute_idx `3` · bonus `[12000, 0, 600]`

```ts
// Ours (web/lib/tome/compute.ts, case 3):
{ const v = ex.rawTalentMaxLevel(data); return v !== null ? R(out, "max SL/SM per talent", v) : null; }

// IT (parsers/world-4/tome.ts, push #3):
calcTalentMaxLevel(characters) // TODO: CHECK
```

### #3 — Items Found ✓

compute_idx `65` · bonus `[1800, 2, 1300]`

```ts
// Ours (web/lib/tome/compute.ts, case 65):
{ if (pd && pd.slab !== undefined) return R(out, "parsedData.slab", Number(pd.slab)); const v = ex.rawItemsFound(data); return v !== null ? R(out, "Cards1.length (lootyRaw)", v) : null; }

// IT (parsers/world-4/tome.ts, push #65):
account?.looty?.lootyRaw?.length
```

### #4 — Total Bubble LV ⚠️

compute_idx `22` · bonus `[1000000, 4, 1750]` · LB fallback `tasks/totalBubbles`

```ts
// Ours (web/lib/tome/compute.ts, case 22):
{ const v = ex.rawBubbleTotalLv(data); return v !== null ? R(out, "CauldronInfo[0..3] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #22):
calcBubbleLevels(account?.alchemy?.bubbles)
```

### #5 — Stamp Total LV ⚠️

compute_idx `0` · bonus `[10000, 0, 1000]` · LB fallback `tasks/totalStamps`

```ts
// Ours (web/lib/tome/compute.ts, case 0):
{ const v = ex.rawStamps(data); return v !== null ? R(out, "raw.StampLv", v) : null; }

// IT (parsers/world-4/tome.ts, push #0):
calcStampLevels(account?.stamps)
```

### #6 — Cards Total LV ⚠️

compute_idx `2` · bonus `[1344, 2, 1000]` · LB fallback `general/totalCards`

```ts
// Ours (web/lib/tome/compute.ts, case 2):
{ const v = ex.rawCardsTotalLvProper(data); return v !== null ? R(out, "sum(stars+1) per card", v) : null; }

// IT (parsers/world-4/tome.ts, push #2):
calcCardsLevels(account?.cards)
```

### #7 — Statue Total LV ⚠️

compute_idx `1` · bonus `[2300, 0, 600]`

```ts
// Ours (web/lib/tome/compute.ts, case 1):
return R(out, "raw.StatueLevels_0", ex.rawStatues(data));

// IT (parsers/world-4/tome.ts, push #1):
calcStatueLevels(account?.statues)
```

### #8 — Total Achievements Completed ⚠️

compute_idx `7` · bonus `[266, 2, 850]`

```ts
// Ours (web/lib/tome/compute.ts, case 7):
return R(out, "raw.AchieveReg", ex.rawAchievements(data));

// IT (parsers/world-4/tome.ts, push #7):
calcTotalAchievements(account?.achievements)
```

### #9 — Unique Quests Completed ⚠️

compute_idx `4` · bonus `[323, 2, 500]`

```ts
// Ours (web/lib/tome/compute.ts, case 4):
return R(out, "raw.QuestComplete", ex.rawUniqueQuests(data));

// IT (parsers/world-4/tome.ts, push #4):
calcTotalQuestCompleted(characters)
```

### #10 — Total Tasks Completed ⚠️

compute_idx `6` · bonus `[470, 2, 470]`

```ts
// Ours (web/lib/tome/compute.ts, case 6):
return R(out, "raw.TaskZZ1 sum", ex.rawTotalTasks(data));

// IT (parsers/world-4/tome.ts, push #6):
calcTotalTasks(account?.tasks)
```

### #11 — Vault Upgrade bonus LV ⚠️

compute_idx `81` · bonus `[1200, 2, 1200]`

```ts
// Ours (web/lib/tome/compute.ts, case 81):
{ if (Array.isArray(data.UpgVault) && (data.UpgVault as unknown[])[57] !== undefined) { return R(out, "min(1500,UpgVault[57]*2)", Math.min(1500, Number((data.UpgVault as unknown[])[57]) * 2)); } return null; }

// IT (parsers/world-4/tome.ts, push #81):
Math.min(1500, getUpgradeVaultBonus(account?.upgradeVault?.upgrades, 57)) // [81]
```

### #12 — Most Money held in Storage ⚠️

compute_idx `8` · bonus `[25, 1, 500]`

```ts
// Ours (web/lib/tome/compute.ts, case 8):
return O(opt, 198, out);

// IT (parsers/world-4/tome.ts, push #8):
account.accountOptions?.[198]
```

### #13 — Most Spore Caps held in Inventory at once ⚠️

compute_idx `9` · bonus `[9, 1, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 9):
return O(opt, 208, out);

// IT (parsers/world-4/tome.ts, push #9):
account.accountOptions?.[208]
```

### #14 — Total Colosseum Score ⚠️

compute_idx `53` · bonus `[10, 1, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 53):
return R(out, "raw.FamValColosseumHighscores", ex.rawColoScore(data));

// IT (parsers/world-4/tome.ts, push #53):
calcColoTotalScore(account?.highscores?.coloHighscores)
```

### #15 — Trophies Found ⚠️

compute_idx `10` · bonus `[22, 2, 700]`

```ts
// Ours (web/lib/tome/compute.ts, case 10):
{ const v = ex.rawLootyCount(data, "Trophy"); return v !== null ? R(out, "raw.Cards1 Trophy", v) : null; }

// IT (parsers/world-4/tome.ts, push #10):
calcTrophiesFound(account?.looty)
```

### #16 — Nametags Found ⚠️

compute_idx `107` · bonus `[20, 2, 700]`

```ts
// Ours (web/lib/tome/compute.ts, case 107):
{ const v = ex.rawLootyCount(data, "EquipmentNametag"); return v !== null ? R(out, "raw.Cards1 EquipmentNametag", v) : null; }

// IT (parsers/world-4/tome.ts, push #107):
calcNametagsFound(account?.looty) // 107
```

### #17 — Premium Hats Found ⚠️

compute_idx `109` · bonus `[75, 2, 700]`

```ts
// Ours (web/lib/tome/compute.ts, case 109):
{ const v = ex.rawHatsTotal(data); return v !== null ? R(out, "raw.Spelunk[46].length", v) : null; }

// IT (parsers/world-4/tome.ts, push #109):
account?.hatRack?.totalHats // 109
```

### #18 — Best Spiketrap Surprise round ⚠️

compute_idx `12` · bonus `[13, 2, 100]`

```ts
// Ours (web/lib/tome/compute.ts, case 12):
return O(opt, 201, out);

// IT (parsers/world-4/tome.ts, push #12):
account.accountOptions?.[201] // spike round
```

### #19 — Tournaments Registrations ⚠️

compute_idx `113` · bonus `[365, 2, 365]`

```ts
// Ours (web/lib/tome/compute.ts, case 113):
return O(opt, 498, out);

// IT (parsers/world-4/tome.ts, push #113):
account.accountOptions?.[498] // 113 tournament registration
```

### #20 — Lava Dev Streams watched ⚠️

compute_idx `106` · bonus `[20, 2, 250]`

```ts
// Ours (web/lib/tome/compute.ts, case 106):
return O(opt, 443, out);

// IT (parsers/world-4/tome.ts, push #106):
account?.accountOptions?.[443] // 106
```

### #21 — Total Minigame Highscore ✅

compute_idx `75` · bonus `[450, 2, 100]`

_rawMinigameScore — sums FamValMinigameHiscores[0..3] + OptLacc[99] pen-pals (commit 6772228)_

```ts
// Ours (web/lib/tome/compute.ts, case 75):
{ const v = ex.rawMinigameScore(data); return v !== null ? R(out, "FamValMinigameHiscores sum[:5]", v) : null; }

// IT (parsers/world-4/tome.ts, push #75):
calcMinigameTotalScore(account?.highscores?.minigameHighscores)
```

### #22 — Total AFK Hours claimed ⚠️

compute_idx `13` · bonus `[2000000, 0, 350]`

```ts
// Ours (web/lib/tome/compute.ts, case 13):
{ const t = data.TaskZZ0; if (Array.isArray(t) && Array.isArray(t[0]) && t[0][2] !== undefined) { return R(out, "raw.TaskZZ0[0][2]", Number(t[0][2])); } return null; }

// IT (parsers/world-4/tome.ts, push #13):
account?.tasks?.[0]?.[0]?.[2]
```

### #23 — DPS Record on Shimmer Island ⚠️

compute_idx `14` · bonus `[20, 1, 350]`

```ts
// Ours (web/lib/tome/compute.ts, case 14):
return O(opt, 172, out);

// IT (parsers/world-4/tome.ts, push #14):
account.accountOptions?.[172] // DPS in shimmer island
```

### #24 — Total Arcade Gold Ball Shop Upgrade LV ⚠️

compute_idx `80` · bonus `[6800, 2, 1200]`

```ts
// Ours (web/lib/tome/compute.ts, case 80):
return R(out, "raw.ArcadeUpg sum", ex.rawArcade(data));

// IT (parsers/world-4/tome.ts, push #80):
account.arcade?.totalUpgradeLevels
```

### #25 — Most Balls earned from LBoFaF ⚠️

compute_idx `79` · bonus `[1000, 0, 150]`

```ts
// Ours (web/lib/tome/compute.ts, case 79):
return O(opt, 222, out);

// IT (parsers/world-4/tome.ts, push #79):
account.accountOptions?.[222] // Most Balls earned from LBoFaF
```

### #26 — Jackpots Hit in Arcade ⚠️

compute_idx `25` · bonus `[4, 2, 80]`

```ts
// Ours (web/lib/tome/compute.ts, case 25):
return O(opt, 199, out);

// IT (parsers/world-4/tome.ts, push #25):
account.accountOptions?.[199] // Jackpots Hit in Arcade
```

### #27 — Star Talent Points Owned ⚠️

compute_idx `15` · bonus `[2500, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 15):
{ const v = ex.rawStarTalentsProper(data); return v !== null ? R(out, "max(charLv-1+skillSum1-9-3)", v) : null; }

// IT (parsers/world-4/tome.ts, push #15):
calcTotalStarTalent(characters, account)
```

### #28 — Average kills for a Crystal Spawn ✓

compute_idx `16` · bonus `[30, 3, 350]`

```ts
// Ours (web/lib/tome/compute.ts, case 16):
{ const s = O(opt, 202, out); return s ? R(out, "1/OptLacc[202]", 1 / s) : null; }

// IT (parsers/world-4/tome.ts, push #16):
1 / account.accountOptions?.[202] // crystal spawn
```

### #29 — Dungeon Rank ⚠️

compute_idx `17` · bonus `[30, 0, 250]`

```ts
// Ours (web/lib/tome/compute.ts, case 17):
{ const v = ex.rawDungeonRank(data); return v !== null ? R(out, "OptLacc[71] vs dungeonLevels", v) : null; }

// IT (parsers/world-4/tome.ts, push #17):
account?.dungeons?.rank
```

### #30 — Highest Drop Rate Multi ⚠️

compute_idx `18` · bonus `[40, 0, 350]`

```ts
// Ours (web/lib/tome/compute.ts, case 18):
return O(opt, 200, out);

// IT (parsers/world-4/tome.ts, push #18):
account.accountOptions?.[200] // highest drop multi
```

### #31 — Constellations Completed ⚠️

compute_idx `19` · bonus `[49, 2, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 19):
{ const v = ex.rawConstellations(data); return v !== null ? R(out, "raw.SSprog sum done", v) : null; }

// IT (parsers/world-4/tome.ts, push #19):
account?.rawConstellationsDone
```

### #32 — Unique Obols Found ⚠️

compute_idx `21` · bonus `[107, 2, 250]`

```ts
// Ours (web/lib/tome/compute.ts, case 21):
{ const v = ex.rawLootyCount(data, "Obol"); return v !== null ? R(out, "raw.Cards1 Obol", v) : null; }

// IT (parsers/world-4/tome.ts, push #21):
calcObolsFound(account?.looty)
```

### #33 — Total Vial LV ⚠️

compute_idx `23` · bonus `[962, 2, 600]` · LB fallback `general/totalVials`

```ts
// Ours (web/lib/tome/compute.ts, case 23):
{ const v = ex.rawVialTotalLv(data); return v !== null ? R(out, "CauldronInfo[4] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #23):
calcVialsLevels(account?.alchemy?.vials)
```

### #34 — Total Sigil LV ⚠️

compute_idx `24` · bonus `[120, 2, 500]`

```ts
// Ours (web/lib/tome/compute.ts, case 24):
{ const v = ex.rawSigils(data); return v !== null ? R(out, "CauldronP2W[4] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #24):
calcSigilsLevels(account?.alchemy?.p2w?.sigils)
```

### #35 — Post Office PO Boxes Earned ⚠️

compute_idx `26` · bonus `[20000, 0, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 26):
{ const po = Number(data.CYDeliveryBoxComplete || 0) + Number(data.CYDeliveryBoxStreak || 0) + Number(data.CYDeliveryBoxMisc || 0); return po > 0 ? R(out, "raw.CYDeliveryBox*", po) : null; }

// IT (parsers/world-4/tome.ts, push #26):
account?.currencies?.DeliveryBoxComplete + account?.currencies?.DeliveryBoxStreak + account?.currencies?.DeliveryBoxMisc
```

### #36 — Highest Killroy Score on a Warrior ⚠️

compute_idx `27` · bonus `[3000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 27):
return O(opt, 204, out);

// IT (parsers/world-4/tome.ts, push #27):
account.accountOptions?.[204] // killroy warrior
```

### #37 — Highest Killroy Score on an Archer ⚠️

compute_idx `28` · bonus `[3000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 28):
return O(opt, 205, out);

// IT (parsers/world-4/tome.ts, push #28):
account.accountOptions?.[205] // killroy archer
```

### #38 — Highest Killroy Score on a Mage ⚠️

compute_idx `29` · bonus `[3000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 29):
return O(opt, 206, out);

// IT (parsers/world-4/tome.ts, push #29):
account.accountOptions?.[206] // killroy mage
```

### #39 — Megafeathers Earned from Orion ⚠️

compute_idx `85` · bonus `[12, 0, 250]`

```ts
// Ours (web/lib/tome/compute.ts, case 85):
return O(opt, 262, out);

// IT (parsers/world-4/tome.ts, push #85):
account.accountOptions?.[262]
```

### #40 — Megafish Earned from Poppy ⚠️

compute_idx `86` · bonus `[12, 0, 250]`

```ts
// Ours (web/lib/tome/compute.ts, case 86):
return O(opt, 279, out);

// IT (parsers/world-4/tome.ts, push #86):
account.accountOptions?.[279]
```

### #41 — Megaflesh Earned from Bubba ✓

compute_idx `108` · bonus `[12, 0, 250]` · LB fallback `misc/highestMegaFlesh`

```ts
// Ours (web/lib/tome/compute.ts, case 108):
{ const v = ex.rawMegaflesh(data); return v !== null ? R(out, "raw.Bubba[1][8]", v) : null; }

// IT (parsers/world-4/tome.ts, push #108):
account?.bubba?.megafleshOwned // 108
```

### #42 — Fastest Time to kill Chaotic Efaunt (in Seconds) ✓

compute_idx `30` · bonus `[10, 3, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 30):
{ const ef = O(opt, 207, out); return ef !== null ? R(out, "1000 - OptLacc[207]", 1000 - ef) : null; }

// IT (parsers/world-4/tome.ts, push #30):
1e3 - account.accountOptions?.[207] // Fastest Time to kill Chaotic
```

### #43 — Largest Oak Log Printer Sample ⚠️

compute_idx `31` · bonus `[9, 1, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 31):
return O(opt, 211, out);

// IT (parsers/world-4/tome.ts, push #31):
account.accountOptions?.[211] // Largest_Oak_Log_Printer_Sample
```

### #44 — Largest Copper Ore Printer Sample ⚠️

compute_idx `32` · bonus `[9, 1, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 32):
return O(opt, 212, out);

// IT (parsers/world-4/tome.ts, push #32):
account.accountOptions?.[212] // Largest_Copper_Ore_Printer_Sample
```

### #45 — Largest Spore Cap Printer Sample ⚠️

compute_idx `33` · bonus `[9, 1, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 33):
return O(opt, 213, out);

// IT (parsers/world-4/tome.ts, push #33):
account.accountOptions?.[213] // Largest_Spore_Cap_Printer_Sample
```

### #46 — Largest Goldfish Printer Sample ⚠️

compute_idx `34` · bonus `[9, 1, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 34):
return O(opt, 214, out);

// IT (parsers/world-4/tome.ts, push #34):
account.accountOptions?.[214] // Largest_Goldfish_Printer_Sample
```

### #47 — Largest Fly Printer Sample ⚠️

compute_idx `35` · bonus `[9, 1, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 35):
return O(opt, 215, out);

// IT (parsers/world-4/tome.ts, push #35):
account.accountOptions?.[215] // Largest_Fly_Printer_Sample
```

### #48 — Total Best Wave in Worship ⚠️

compute_idx `37` · bonus `[1000, 0, 300]` · LB fallback `general/totalWaves`

```ts
// Ours (web/lib/tome/compute.ts, case 37):
{ const v = ex.rawWorshipWaves(data); return v !== null ? R(out, "sum TotemInfo[0]", v) : null; }

// IT (parsers/world-4/tome.ts, push #37):
account?.towers?.totalWaves
```

### #49 — Best Non Duplicate Goblin Gorefest Wave ⚠️

compute_idx `36` · bonus `[120, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 36):
return O(opt, 209, out);

// IT (parsers/world-4/tome.ts, push #36):
account.accountOptions?.[209] // Best_Non_Duplicate_Goblin_Gorefest_Wave_
```

### #50 — Total Prayer Upgrade LV ⚠️

compute_idx `76` · bonus `[673, 2, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 76):
{ const v = ex.rawPrayers(data); return v !== null ? R(out, "sum PrayOwned[:19]", v) : null; }

// IT (parsers/world-4/tome.ts, push #76):
calcTotalPrayersLevel(account?.prayers)
```

### #51 — Total Digits of all Deathnote Kills ⚠️

compute_idx `38` · bonus `[700, 0, 600]`

```ts
// Ours (web/lib/tome/compute.ts, case 38):
{ const v = ex.rawDeathNoteDigitsProper(data); return v !== null ? R(out, "deathNote99 + miniBoss digits", v) : null; }

// IT (parsers/world-4/tome.ts, push #38):
calcTotalKillsDigits(account?.deathNote)
```

### #52 — Most Giants Killed in a Single Week ⚠️

compute_idx `54` · bonus `[25, 0, 250]`

```ts
// Ours (web/lib/tome/compute.ts, case 54):
return O(opt, 217, out);

// IT (parsers/world-4/tome.ts, push #54):
account.accountOptions?.[217] // Most Giants Killed in a Single Week
```

### #53 — Total Refinery Rank ✓

compute_idx `40` · bonus `[120, 0, 450]` · LB fallback `tasks/refinedSalts`

```ts
// Ours (web/lib/tome/compute.ts, case 40):
{ const v = ex.rawRefineryRank(data); return v !== null ? R(out, "Refinery salts[0..5].rank sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #40):
account?.refinery?.totalLevels
```

### #54 — Total Atom Upgrade LV ✓

compute_idx `41` · bonus `[150, 0, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 41):
return R(out, "raw.Atoms", arrSum(data.Atoms));

// IT (parsers/world-4/tome.ts, push #41):
calcTotalAtomLevels(account?.atoms?.atoms)
```

### #55 — Total Construct Buildings LV ⚠️

compute_idx `42` · bonus `[4000, 0, 900]`

```ts
// Ours (web/lib/tome/compute.ts, case 42):
{ const v = ex.rawTowerSum(data); return v !== null && v > 0 ? R(out, "Tower sum[0..26]", v) : null; }

// IT (parsers/world-4/tome.ts, push #42):
account?.towers?.totalLevels
```

### #56 — Equinox Clouds Completed ⚠️

compute_idx `39` · bonus `[31, 2, 750]`

```ts
// Ours (web/lib/tome/compute.ts, case 39):
{ const v = ex.rawEquinoxClouds(data); return v !== null ? R(out, "WeeklyBoss d_*==-1", v) : null; }

// IT (parsers/world-4/tome.ts, push #39):
account?.equinox?.completedClouds
```

### #57 — Most Greenstacks in Storage ⚠️

compute_idx `44` · bonus `[150, 0, 600]`

```ts
// Ours (web/lib/tome/compute.ts, case 44):
return O(opt, 224, out);

// IT (parsers/world-4/tome.ts, push #44):
account.accountOptions?.[224] // Most Greenstacks in Storage
```

### #58 — Total Cooking Meals LV ✓

compute_idx `50` · bonus `[5400, 0, 750]` · LB fallback `general/totalMeals`

```ts
// Ours (web/lib/tome/compute.ts, case 50):
{ const v = ex.rawMeals(data); return v !== null ? R(out, "raw.Meals[0] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #50):
calcTotalMeals(account?.cooking?.meals)
```

### #59 — Total Kitchen Upgrade LV ✓

compute_idx `48` · bonus `[8000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 48):
{ const v = ex.rawKitchenLevels(data); return v !== null ? R(out, "Cooking sum[6..8]", v) : null; }

// IT (parsers/world-4/tome.ts, push #48):
getTotalKitchenLevels(account?.cooking?.kitchens)
```

### #60 — Highest Power Mob ✓

compute_idx `46` · bonus `[5, 1, 150]` · LB fallback `general/highestPowerPet`

```ts
// Ours (web/lib/tome/compute.ts, case 46):
{ const v = ex.rawHighestPowerMob(data); return v !== null ? R(out, "max powers PetsStored+Breeding[3]", v) : null; }

// IT (parsers/world-4/tome.ts, push #46):
calcHighestPower(account?.breeding)
```

### #61 — Fastest Time reaching Round 100 Arena (in Seconds) ✓

compute_idx `47` · bonus `[50, 3, 180]`

```ts
// Ours (web/lib/tome/compute.ts, case 47):
{ const rd = O(opt, 220, out); return rd !== null ? R(out, "1000 - OptLacc[220]", 1000 - rd) : null; }

// IT (parsers/world-4/tome.ts, push #47):
1e3 - account.accountOptions?.[220] // Fastest Time reaching Round 100 Arena (in Seconds)
```

### #62 — Total Shiny Mob LV ✅

compute_idx `49` · bonus `[750, 0, 250]`

_rawShinyLevelsProper — ports IT's getShinyLevelFromProgress per pet (commit 6772228)_

```ts
// Ours (web/lib/tome/compute.ts, case 49):
{ const v = ex.rawShinyLevelsProper(data); if (v !== null) return R(out, "sum getShinyLevel per pet", v); if (pd && pd.totalShinyLevels !== undefined) { return R(out, "parsedData.totalShinyLevels", Number(pd.totalShinyLevels)); } return null; }

// IT (parsers/world-4/tome.ts, push #49):
account?.breeding?.totalShinyLevels
```

### #63 — Total Mob Breedability LV ✅

compute_idx `51` · bonus `[500, 2, 200]`

_rawBreedability — ports IT's per-pet log/pow formula across the 4 petStats worlds (commit 6772228)_

```ts
// Ours (web/lib/tome/compute.ts, case 51):
{ const v = ex.rawBreedability(data); if (v !== null) return R(out, "sum breedingLv per pet", v); if (pd && pd.totalBreedabilityLevels !== undefined) { return R(out, "parsedData.totalBreedabilityLevels", Number(pd.totalBreedabilityLevels)); } return null; }

// IT (parsers/world-4/tome.ts, push #51):
account?.breeding?.totalBreedabilityLv
```

### #64 — Total Lab Chips Owned ⚠️

compute_idx `52` · bonus `[100, 0, 150]`

```ts
// Ours (web/lib/tome/compute.ts, case 52):
{ const v = ex.rawLabChips(data); return v !== null ? R(out, "Lab[15] sum max(0)", v) : null; }

// IT (parsers/world-4/tome.ts, push #52):
account?.lab?.totalRawChips
```

### #65 — Rift Levels Completed ⚠️

compute_idx `45` · bonus `[49, 2, 500]`

```ts
// Ours (web/lib/tome/compute.ts, case 45):
{ if (Array.isArray(data.Rift) && (data.Rift as unknown[])[0] !== undefined) { return R(out, "raw.Rift[0]", Number((data.Rift as unknown[])[0])); } return null; }

// IT (parsers/world-4/tome.ts, push #45):
account.rift?.currentRift
```

### #66 — Total Onyx Statues ⚠️

compute_idx `55` · bonus `[28, 2, 450]`

```ts
// Ours (web/lib/tome/compute.ts, case 55):
return R(out, "raw.StuG", ex.rawOnyxStatues(data));

// IT (parsers/world-4/tome.ts, push #55):
calcTotalOnyx(account)
```

### #67 — Total Artifacts Found ✓

compute_idx `60` · bonus `[185, 2, 1000]`

```ts
// Ours (web/lib/tome/compute.ts, case 60):
{ const v = ex.rawArtifacts(data); return v !== null ? R(out, "Sailing[3] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #60):
calcArtifactsAcquired(account?.sailing?.artifacts)
```

### #68 — Total Boat Upgrade LV ✓

compute_idx `57` · bonus `[10000, 0, 200]` · LB fallback `general/totalBoats`

```ts
// Ours (web/lib/tome/compute.ts, case 57):
{ const v = ex.rawBoatsLevel(data); return v !== null ? R(out, "Boats b[3]+b[5]", v) : null; }

// IT (parsers/world-4/tome.ts, push #57):
calcTotalBoatLevels(account?.sailing?.boats)
```

### #69 — Gold Bar Sailing Treasure Owned ✓

compute_idx `61` · bonus `[14, 1, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 61):
{ if (Array.isArray(data.Sailing) && Array.isArray((data.Sailing as unknown[])[1])) { const sl = (data.Sailing as unknown[])[1] as unknown[]; return R(out, "raw.Sailing[1][0] (lootPile)", Number(sl[0])); } return null; }

// IT (parsers/world-4/tome.ts, push #61):
account?.sailing?.lootPile?.[0]?.amount
```

### #70 — Highest Captain LV ✓

compute_idx `62` · bonus `[25, 0, 150]`

```ts
// Ours (web/lib/tome/compute.ts, case 62):
{ const v = ex.rawCaptainMaxLv(data); return v !== null ? R(out, "max Captains[i][3]", v) : null; }

// IT (parsers/world-4/tome.ts, push #62):
Math.max(...(account?.sailing?.captains?.map(({ level }: any) => level) || []))
```

### #71 — Most Gaming Bits Owned ✓

compute_idx `66` · bonus `[80, 1, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 66):
{ if (Array.isArray(data.Gaming) && (data.Gaming as unknown[])[0] !== undefined) { return R(out, "raw.Gaming[0]", Number((data.Gaming as unknown[])[0])); } return null; }

// IT (parsers/world-4/tome.ts, push #66):
account?.gaming?.bits
```

### #72 — Total Gaming Plants Evolved ⚠️

compute_idx `59` · bonus `[100000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 59):
{ const gs = data.GamingSprout; if (Array.isArray(gs) && Array.isArray(gs[28]) && (gs[28] as unknown[])[1] !== undefined) { return R(out, "raw.GamingSprout[28][1]", Number((gs[28] as unknown[])[1])); } return null; }

// IT (parsers/world-4/tome.ts, push #59):
account?.gaming?.totalPlantsPicked
```

### #73 — Best Gold Nugget ✓

compute_idx `64` · bonus `[9, 1, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 64):
{ if (Array.isArray(data.Gaming) && (data.Gaming as unknown[])[8] !== undefined) { return R(out, "raw.Gaming[8]", Number((data.Gaming as unknown[])[8])); } return null; }

// IT (parsers/world-4/tome.ts, push #64):
account?.gaming?.bestNugget
```

### #74 — Highest Immortal Snail LV ✓

compute_idx `63` · bonus `[50, 2, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 63):
{ // Mirror .gs: `(data.GamingSprout && Number(data.GamingSprout[8]||0)) || 0` // — the trailing `|| 0` catches NaN from non-numeric values. const gs8 = Array.isArray(data.GamingSprout) && (data.GamingSprout as unknown[])[8] !== undefined ? Number((data.GamingSprout as unknown[])[8]) : 0; const snl = Number.isFinite(gs8) ? gs8 : 0; const op210 = O(opt, 210, out) || 0; return R(out, "max(GamingSprout[8],OptLacc[210])", Math.max(snl, op210)); }

// IT (parsers/world-4/tome.ts, push #63):
Math.max(account?.gaming?.snailLevel, account.accountOptions?.[210])
```

### #75 — Rat King Crowns Reclaimed ⚠️

compute_idx `111` · bonus `[100, 2, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 111):
{ const v = ex.rawRatKingCrowns(data); return v !== null ? R(out, "Research[11].length", v) : null; }

// IT (parsers/world-4/tome.ts, push #111):
account?.gaming?.ratKingCrownsClaimed // 111 Rat king crowns claimed
```

### #76 — God Rank in Divinity ✓

compute_idx `58` · bonus `[10, 0, 200]` · LB fallback `general/godRank`

```ts
// Ours (web/lib/tome/compute.ts, case 58):
{ const v = ex.rawGodRank(data); return v !== null ? R(out, "Divinity[0..10] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #58):
account?.divinity?.godRank
```

### #77 — Fastest Time to Kill 200 Tremor Wurms (in Seconds) ✓

compute_idx `56` · bonus `[30, 3, 150]`

```ts
// Ours (web/lib/tome/compute.ts, case 56):
{ const v = O(opt, 218, out); return v !== null ? R(out, "1000 - OptLacc[218]", 1000 - v) : null; }

// IT (parsers/world-4/tome.ts, push #56):
1e3 - account.accountOptions?.[218] // Fastest Time to Kill 200 Tremor Wurms (in Seconds)
```

### #78 — Total Opals Found ⚠️

compute_idx `93` · bonus `[500, 0, 400]` · LB fallback `caverns/totalOpals`

```ts
// Ours (web/lib/tome/compute.ts, case 93):
{ const v = ex.rawHoleOpals(data); return v !== null ? R(out, "Holes[7] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #93):
account?.hole?.totalOpalsFound
```

### #79 — Total LV of Cavern Villagers ⚠️

compute_idx `84` · bonus `[200, 0, 350]`

```ts
// Ours (web/lib/tome/compute.ts, case 84):
{ const v = ex.rawHolesSum(data, 1); return v !== null ? R(out, "Holes[1] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #84):
account?.hole?.totalVillagersLevels // [84]
```

### #80 — Total Digits of all Cavern Resources ⚠️

compute_idx `83` · bonus `[500, 0, 750]`

```ts
// Ours (web/lib/tome/compute.ts, case 83):
{ if (Array.isArray(data.Holes) && Array.isArray((data.Holes as unknown[])[9])) { const h9 = (data.Holes as unknown[])[9] as unknown[]; let s = 0; for (let i = 0; i < h9.length; i++) s += Math.ceil(lavaLog(Number(h9[i]) || 0)); return R(out, "sum ceil(lavaLog(Holes[9]))", s); } return null; }

// IT (parsers/world-4/tome.ts, push #83):
account?.hole?.totalResources // [83]
```

### #81 — Total Resource Layers Destroyed ⚠️

compute_idx `92` · bonus `[150, 0, 350]` · LB fallback `caverns/totalLayersDestroyed`

```ts
// Ours (web/lib/tome/compute.ts, case 92):
{ const v = ex.rawHoleLayers(data); return v !== null ? R(out, "Holes[11][1,3,5,7] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #92):
account?.hole?.totalLayerResources
```

### #82 — Best Dawg Den score ⚠️

compute_idx `91` · bonus `[7, 1, 250]` · LB fallback `caverns/brokenJars`

```ts
// Ours (web/lib/tome/compute.ts, case 91):
{ const v = ex.rawExtraCalc(data, 8); return v !== null ? R(out, "Holes[11][8]", v) : null; }

// IT (parsers/world-4/tome.ts, push #91):
account?.hole?.holesObject?.extraCalculations?.[8]
```

### #83 — Best Bravery Monument Round ⚠️

compute_idx `87` · bonus `[50, 0, 250]` · LB fallback `caverns/bellRings`

```ts
// Ours (web/lib/tome/compute.ts, case 87):
{ const v = ex.rawExtraCalc(data, 73); return v !== null ? R(out, "Holes[11][73]", v) : null; }

// IT (parsers/world-4/tome.ts, push #87):
account?.hole?.holesObject?.extraCalculations?.[73]
```

### #84 — Best Justice Monument Round ⚠️

compute_idx `88` · bonus `[200, 0, 250]` · LB fallback `caverns/bellPings`

```ts
// Ours (web/lib/tome/compute.ts, case 88):
{ const v = ex.rawExtraCalc(data, 74); return v !== null ? R(out, "Holes[11][74]", v) : null; }

// IT (parsers/world-4/tome.ts, push #88):
account?.hole?.holesObject?.extraCalculations?.[74]
```

### #85 — Best Wisdom Monument Round ⚠️

compute_idx `89` · bonus `[18, 2, 250]` · LB fallback `caverns/totalStringLevels`

```ts
// Ours (web/lib/tome/compute.ts, case 89):
{ const v = ex.rawExtraCalc(data, 75); return v !== null ? R(out, "Holes[11][75]", v) : null; }

// IT (parsers/world-4/tome.ts, push #89):
account?.hole?.holesObject?.extraCalculations?.[75]
```

### #86 — Total Gambit Time (in Seconds) ⚠️

compute_idx `82` · bonus `[3600, 0, 400]` · LB fallback `caverns/totalGambitTime`

```ts
// Ours (web/lib/tome/compute.ts, case 82):
{ const v = ex.rawGambitTime(data); return v !== null ? R(out, "sum Holes[11][65..70]", v) : null; }

// IT (parsers/world-4/tome.ts, push #82):
account?.hole?.caverns?.gambit?.totalTime // [82]
```

### #87 — Best Pure Memory Round Reached ✓

compute_idx `94` · bonus `[13, 2, 50]`

```ts
// Ours (web/lib/tome/compute.ts, case 94):
{ const v = O(opt, 353, out); return v !== null ? R(out, "round(min(12,OptLacc[353])+1)", Math.round(Math.min(12, v) + 1)) : null; }

// IT (parsers/world-4/tome.ts, push #94):
Math.round(Math.min(12, account.accountOptions?.[353]) + 1)
```

### #88 — Total Crops Discovered ⚠️

compute_idx `68` · bonus `[120, 2, 350]`

```ts
// Ours (web/lib/tome/compute.ts, case 68):
return R(out, "keys(FarmCrop)", ex.rawCropsDiscovered(data));

// IT (parsers/world-4/tome.ts, push #68):
account?.farming?.cropsFound
```

### #89 — Total Golden Food Beanstacks ⚠️

compute_idx `69` · bonus `[30, 2, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 69):
{ const v = ex.rawBeanstalk(data); return v !== null ? R(out, "Ninja[104] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #69):
calcTotalBeanstalkLevel(account?.sneaking?.beanstalkData)
```

### #90 — Highest Crop OG ✓

compute_idx `67` · bonus `[6, 1, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 67):
{ const co = O(opt, 219, out); return co !== null ? R(out, "2^OptLacc[219]", Math.pow(2, co)) : null; }

// IT (parsers/world-4/tome.ts, push #67):
Math.pow(2, account.accountOptions?.[219]) // Highest Crop OG
```

### #91 — Total Land Rank ⚠️

compute_idx `77` · bonus `[5000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 77):
return R(out, "raw.FarmRank[0] sum", ex.rawLandRank(data));

// IT (parsers/world-4/tome.ts, push #77):
account?.farming?.totalRanks // total land ranks
```

### #92 — Largest Magic Bean Trade ⚠️

compute_idx `78` · bonus `[1000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 78):
return O(opt, 221, out);

// IT (parsers/world-4/tome.ts, push #78):
parseFloat(account.accountOptions?.[221]) // Largest Magic Bean Trade
```

### #93 — Farming Stickers Found ⚠️

compute_idx `112` · bonus `[150, 0, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 112):
{ const v = ex.rawFarmingStickers(data); return v !== null ? R(out, "OptLacc[140]", v) : null; }

// IT (parsers/world-4/tome.ts, push #112):
account?.farming?.totalStickers // 112 stickers claimed
```

### #94 — Ninja Floors Unlocked ⚠️

compute_idx `72` · bonus `[12, 2, 250]`

```ts
// Ours (web/lib/tome/compute.ts, case 72):
{ const op72 = O(opt, 232, out); if (op72 && op72 > 0) return R(out, "OptLacc[232]*12", op72 * 12); return null; }

// IT (parsers/world-4/tome.ts, push #72):
account?.sneaking?.unlockedFloors // [72]
```

### #95 — Jade Emporium Upgrades Purchased ⚠️

compute_idx `74` · bonus `[50, 2, 700]`

```ts
// Ours (web/lib/tome/compute.ts, case 74):
{ const v = ex.rawJadeEmporium(data); return v !== null ? R(out, "Ninja[102][9].length", v) : null; }

// IT (parsers/world-4/tome.ts, push #74):
account?.sneaking?.totalJadeEmporiumUnlocked
```

### #96 — Total Ninja Knowledge Upgrades LV ⚠️

compute_idx `99` · bonus `[5000, 0, 500]`

```ts
// Ours (web/lib/tome/compute.ts, case 99):
{ const v = ex.rawNinjaUpgrades(data); return v !== null ? R(out, "Ninja[103] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #99):
account?.sneaking?.totalNinjaUpgradeLevels
```

### #97 — Total Career Summoning Wins ✅

compute_idx `71` · bonus `[160, 0, 500]` · LB fallback `general/endlessSummoningWins`

_rawSummoningWins — Summon[1].length + OptLacc[319] matches IT's flat-won-battles + highestEndlessLevel (task #22)_

```ts
// Ours (web/lib/tome/compute.ts, case 71):
{ const v = ex.rawCareerSummWins(data); return v !== null ? R(out, "Summon[1].length+OptLacc[319]", v) : null; }

// IT (parsers/world-4/tome.ts, push #71):
account?.summoning?.totalWins // Best Endless Summoning Round - account.accountOptions?.[232] > 0 ? 12 * account.accountOptions?.[232] : 0
```

### #98 — Total Summoning Upgrades LV ⚠️

compute_idx `70` · bonus `[10000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 70):
return R(out, "raw.Summon[0] sum", ex.rawSummoningUpg(data));

// IT (parsers/world-4/tome.ts, push #70):
account?.summoning?.totalUpgradesLevels
```

### #99 — Familiars Owned in Summoning ⚠️

compute_idx `73` · bonus `[600, 0, 150]`

```ts
// Ours (web/lib/tome/compute.ts, case 73):
{ const v = ex.rawFamiliars(data); return v !== null ? R(out, "Summon[4] reduce", v) : null; }

// IT (parsers/world-4/tome.ts, push #73):
account?.summoning?.familiarsOwned
```

### #100 — Total Summoning Boss Stone victories ⚠️

compute_idx `96` · bonus `[28, 0, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 96):
{ const v = ex.rawSummonStones(data); return v !== null ? R(out, "sum KRbest[SummzTrz*]", v) : null; }

// IT (parsers/world-4/tome.ts, push #96):
account?.summoning?.totalSummoningStonesKills // 96
```

### #101 — Most DMG Dealt to Gravestone in a Weekly Battle ⚠️

compute_idx `20` · bonus `[300000, 0, 200]`

```ts
// Ours (web/lib/tome/compute.ts, case 20):
return O(opt, 203, out);

// IT (parsers/world-4/tome.ts, push #20):
account.accountOptions?.[203] // Gravestone damage
```

### #102 — Most Tottoise in Storage ✓

compute_idx `43` · bonus `[5, 1, 150]`

```ts
// Ours (web/lib/tome/compute.ts, case 43):
{ const v = ex.rawStorageCritter(data); return v !== null ? R(out, "ChestOrder/Critter11A", v) : null; }

// IT (parsers/world-4/tome.ts, push #43):
calcTotalItemInStorage(account?.storage?.list, 'Critter11A')
```

### #103 — Best Deathbringer Max Damage in Wraith Mode ⚠️

compute_idx `90` · bonus `[10, 1, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 90):
return O(opt, 356, out);

// IT (parsers/world-4/tome.ts, push #90):
account.accountOptions?.[356]
```

### #104 — Best Windwalker Max Damage in Tempest Mode ⚠️

compute_idx `100` · bonus `[10, 1, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 100):
return O(opt, 445, out);

// IT (parsers/world-4/tome.ts, push #100):
account?.accountOptions?.[445] // 100
```

### #105 — Best Arcane Cultist Max Damage in Arcanist Mode ⚠️

compute_idx `101` · bonus `[10, 1, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 101):
return O(opt, 446, out);

// IT (parsers/world-4/tome.ts, push #101):
account?.accountOptions?.[446]
```

### #106 — Spirited Valley Emperor Boss Kills ✓

compute_idx `95` · bonus `[100, 2, 400]`

```ts
// Ours (web/lib/tome/compute.ts, case 95):
{ const v = O(opt, 369, out); return v !== null ? R(out, "round(OptLacc[369])", Math.round(v)) : null; }

// IT (parsers/world-4/tome.ts, push #95):
Math.round(account?.accountOptions?.[369]) // 95
```

### #107 — Total Coral Reef upgrades ⚠️

compute_idx `97` · bonus `[37, 2, 400]` · LB fallback `general/totalCoralKidUpgrades`

```ts
// Ours (web/lib/tome/compute.ts, case 97):
{ const v = ex.rawCoralReefSum(data); return v !== null ? R(out, "Spelunk[13] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #97):
account?.spelunking?.coralReefLevels?.reduce((sum: number, level: number) => sum + level, 0)
```

### #108 — Total Spelunk Shop Upgrades LV ⚠️

compute_idx `103` · bonus `[2000, 0, 500]` · LB fallback `general/totalSpelunkingUpgrades`

```ts
// Ours (web/lib/tome/compute.ts, case 103):
{ const v = ex.rawSpelunkUpgrades(data); return v !== null ? R(out, "sum max(0,Spelunk[5])", v) : null; }

// IT (parsers/world-4/tome.ts, push #103):
account?.spelunking?.totalUpgradeLevels // 103
```

### #109 — Total Spelunk Discoveries made ⚠️

compute_idx `104` · bonus `[90, 2, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 104):
{ const v = ex.rawSpelunkDiscoveries(data); return v !== null ? R(out, "Spelunk[6].length", v) : null; }

// IT (parsers/world-4/tome.ts, push #104):
account?.spelunking?.discoveriesCount // 104
```

### #110 — Deepest Depth reached in a single Delve ⚠️

compute_idx `98` · bonus `[100, 0, 300]`

```ts
// Ours (web/lib/tome/compute.ts, case 98):
{ const v = ex.rawBestCave(data); return v !== null ? R(out, "max Spelunk[1]", v) : null; }

// IT (parsers/world-4/tome.ts, push #98):
Math.max(...(account?.spelunking?.bestCaveLevels || [0])) // 98
```

### #111 — Biggest Haul in a single Delve ⚠️

compute_idx `102` · bonus `[25, 1, 300]` · LB fallback `misc/biggestHaulSpelunking`

```ts
// Ours (web/lib/tome/compute.ts, case 102):
{ const v = ex.rawBiggestHaul(data); return v !== null ? R(out, "max Spelunk[2]", v) : null; }

// IT (parsers/world-4/tome.ts, push #102):
Math.max(...(account?.spelunking?.biggestHauls || [0])) // 102
```

### #112 — Highest leveled Spelunker ⚠️

compute_idx `105` · bonus `[200, 0, 200]` · LB fallback `misc/highestSpelunkingPower`

```ts
// Ours (web/lib/tome/compute.ts, case 105):
{ const v = ex.rawSpelunkerLevel(data); return v !== null ? R(out, "max Lv0_X[19]", v) : null; }

// IT (parsers/world-4/tome.ts, push #105):
account?.spelunking?.highestSpelunkingLevelCharacter // 105
```

### #113 — Minehead Opponents Defeated ⚠️

compute_idx `110` · bonus `[40, 2, 600]` · LB fallback `misc/mineheadOpponentsDefeated`

```ts
// Ours (web/lib/tome/compute.ts, case 110):
{ const v = ex.rawMineheadOpponents(data); return v !== null ? R(out, "Research[7][4]", v) : null; }

// IT (parsers/world-4/tome.ts, push #110):
account?.minehead?.opponentsBeat // 110
```

### #114 — Total Research Grid Upgrades ✓

compute_idx `114` · bonus `[109, 2, 750]`

```ts
// Ours (web/lib/tome/compute.ts, case 114):
return R(out, "raw.Research[0] sum", ex.rawResearch(data));

// IT (parsers/world-4/tome.ts, push #114):
account.research?.gridPTSpent // 113 research grid upg
```

### #115 — Total Glimbo Trades ⚠️

compute_idx `115` · bonus `[1500, 0, 400]` · LB fallback `misc/glimboTotalTrades`

```ts
// Ours (web/lib/tome/compute.ts, case 115):
{ const v = ex.rawGlimboTrades(data); return v !== null ? R(out, "Research[12] sum", v) : null; }

// IT (parsers/world-4/tome.ts, push #115):
account.minehead?.glimboTotalTrades // 115 glimbo trades
```

### #116 — Unique Sushi Created ✅

compute_idx `116` · bonus `[54, 2, 800]`

_Unique Sushi Created — uses Sushi[5] consecutive prefix per IT sushiStation parser (commit 6772228)_

```ts
// Ours (web/lib/tome/compute.ts, case 116):
{ // IT's logic (parsers/world-7/sushiStation.ts): the uniqueSushi count // is the length of the CONSECUTIVE prefix of Sushi[5] where each entry // is >= 0. The first -1 (or undefined) ends the chain. MAX_TIER = 58. if (Array.isArray(data.Sushi) && Array.isArray((data.Sushi as unknown[])[5])) { const tracking = (data.Sushi as unknown[])[5] as unknown[]; let uniqueSushi = 0; for (let i = 0; i <= 58; i++) { const v = tracking[i] ?? -1; if (Number(v) >= 0) { uniqueSushi = i + 1; } else { break; } } return R(out, "Sushi[5] consecutive>=0", uniqueSushi); } return null; }

// IT (parsers/world-4/tome.ts, push #116):
account?.sushiStation?.uniqueSushi // 116 unique sushi
```

### #117 — Button Presses ⚠️

compute_idx `117` · bonus `[300, 0, 500]`

```ts
// Ours (web/lib/tome/compute.ts, case 117):
return O(opt, 594, out);

// IT (parsers/world-4/tome.ts, push #117):
account?.accountOptions?.[594] // 116 unique sushi
```
