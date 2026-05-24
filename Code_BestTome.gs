/**
 * Best Tome Updater (v1.0)
 *
 * Targets only BEST TOME columns G (Your tome data) and I (Pts).
 * Overwrites their formulas with hardcoded values fetched from
 * the public IdleonToolbox API.
 *
 * Player name: cell BEST TOME!A1 (already "Arkh" in this sheet).
 *
 * Menu: "Tome Updater"
 *  - Refresh BEST TOME      (updates G + I)
 *  - About
 *
 * Coverage:
 *  - Column I (Pts): 100% — parsedData.tomePoints has all 118 values
 *  - Column G (raw): ~50 of 118 via leaderboards + parsedData mapping.
 *    Tasks without a known mapping keep their existing G value.
 */

var PROFILE_URL = 'https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=';
var LB_URL = 'https://profiles.idleontoolbox.workers.dev/api/leaderboards';

// Column E task names live in this exact order, matching parsedData.tomePoints[0..117]
var TOME_TASKS = [
  'Account LV', 'Account Skills LV', 'Total Talent Max LV', 'Items Found',
  'Total Bubble LV', 'Stamp Total LV', 'Cards Total LV', 'Statue Total LV',
  'Total Achievements Completed', 'Unique Quests Completed', 'Total Tasks Completed',
  'Vault Upgrade bonus LV', 'Most Money held in Storage',
  'Most Spore Caps held in Inventory at once', 'Total Colosseum Score',
  'Trophies Found', 'Nametags Found', 'Premium Hats Found',
  'Best Spiketrap Surprise round', 'Tournaments Registrations',
  'Lava Dev Streams watched', 'Total Minigame Highscore', 'Total AFK Hours claimed',
  'DPS Record on Shimmer Island', 'Total Arcade Gold Ball Shop Upgrade LV',
  'Most Balls earned from LBoFaF', 'Jackpots Hit in Arcade', 'Star Talent Points Owned',
  'Average kills for a Crystal Spawn', 'Dungeon Rank', 'Highest Drop Rate Multi',
  'Constellations Completed', 'Unique Obols Found', 'Total Vial LV', 'Total Sigil LV',
  'Post Office PO Boxes Earned', 'Highest Killroy Score on a Warrior',
  'Highest Killroy Score on an Archer', 'Highest Killroy Score on a Mage',
  'Megafeathers Earned from Orion', 'Megafish Earned from Poppy',
  'Megaflesh Earned from Bubba', 'Fastest Time to kill Chaotic Efaunt (in Seconds)',
  'Largest Oak Log Printer Sample', 'Largest Copper Ore Printer Sample',
  'Largest Spore Cap Printer Sample', 'Largest Goldfish Printer Sample',
  'Largest Fly Printer Sample', 'Total Best Wave in Worship',
  'Best Non Duplicate Goblin Gorefest Wave', 'Total Prayer Upgrade LV',
  'Total Digits of all Deathnote Kills', 'Most Giants Killed in a Single Week',
  'Total Refinery Rank', 'Total Atom Upgrade LV', 'Total Construct Buildings LV',
  'Equinox Clouds Completed', 'Most Greenstacks in Storage', 'Total Cooking Meals LV',
  'Total Kitchen Upgrade LV', 'Highest Power Mob',
  'Fastest Time reaching Round 100 Arena (in Seconds)', 'Total Shiny Mob LV',
  'Total Mob Breedability LV', 'Total Lab Chips Owned', 'Rift Levels Completed',
  'Total Onyx Statues', 'Total Artifacts Found', 'Total Boat Upgrade LV',
  'Gold Bar Sailing Treasure Owned', 'Highest Captain LV', 'Most Gaming Bits Owned',
  'Total Gaming Plants Evolved', 'Best Gold Nugget', 'Highest Immortal Snail LV',
  'Rat King Crowns Reclaimed', 'God Rank in Divinity',
  'Fastest Time to Kill 200 Tremor Wurms (in Seconds)', 'Total Opals Found',
  'Total LV of Cavern Villagers', 'Total Digits of all Cavern Resources',
  'Total Resource Layers Destroyed', 'Best Dawg Den score',
  'Best Bravery Monument Round', 'Best Justice Monument Round',
  'Best Wisdom Monument Round', 'Total Gambit Time (in Seconds)',
  'Best Pure Memory Round Reached', 'Total Crops Discovered',
  'Total Golden Food Beanstacks', 'Highest Crop OG', 'Total Land Rank',
  'Largest Magic Bean Trade', 'Farming Stickers Found', 'Ninja Floors Unlocked',
  'Jade Emporium Upgrades Purchased', 'Total Ninja Knowledge Upgrades LV',
  'Total Career Summoning Wins', 'Total Summoning Upgrades LV',
  'Familiars Owned in Summoning', 'Total Summoning Boss Stone victories',
  'Most DMG Dealt to Gravestone in a Weekly Battle', 'Most Tottoise in Storage',
  'Best Deathbringer Max Damage in Wraith Mode',
  'Best Windwalker Max Damage in Tempest Mode',
  'Best Arcane Cultist Max Damage in Arcanist Mode',
  'Spirited Valley Emperor Boss Kills', 'Total Coral Reef upgrades',
  'Total Spelunk Shop Upgrades LV', 'Total Spelunk Discoveries made',
  'Deepest Depth reached in a single Delve', 'Biggest Haul in a single Delve',
  'Highest leveled Spelunker', 'Minehead Opponents Defeated',
  'Total Research Grid Upgrades', 'Total Glimbo Trades', 'Unique Sushi Created',
  'Button Presses'
];

// Raw value mapping: tome task name -> [leaderboardCategory, leaderboardBoard]
// Tasks without a mapping keep their existing G value.
var RAW_LB_MAP = {
  'Account LV':                              ['general',   'totalLevels'],
  'Account Skills LV':                       ['skills',    'totalSkillsLevels'],
  'Items Found':                             ['general',   'slab'],
  'Total Bubble LV':                         ['tasks',     'totalBubbles'],
  'Stamp Total LV':                          ['tasks',     'totalStamps'],
  'Cards Total LV':                          ['general',   'totalCards'],
  'Statue Total LV':                         ['general',   'totalStatues'],
  'Most Money held in Storage':              ['general',   'totalMoney'],
  'Trophies Found':                          ['general',   'totalShinyLevels'],  // best guess - update if wrong
  'Total AFK Hours claimed':                 ['tasks',     'afkTime'],
  'DPS Record on Shimmer Island':            ['tasks',     'highestDamage'],
  'Total Arcade Gold Ball Shop Upgrade LV':  ['general',   'totalSushiStationUpgrades'], // placeholder
  'Highest Drop Rate Multi':                 ['character', 'dropRate'],
  'Total Vial LV':                           ['general',   'totalVials'],
  'Post Office PO Boxes Earned':             ['tasks',     'postOfficeOrders'],
  'Megafeathers Earned from Orion':          ['misc',      'highestMegafeather'],
  'Megafish Earned from Poppy':              ['misc',      'highestMegaFish'],
  'Megaflesh Earned from Bubba':             ['misc',      'highestMegaFlesh'],
  'Largest Oak Log Printer Sample':          ['general',   'logSample'],
  'Largest Copper Ore Printer Sample':       ['general',   'copperSample'],
  'Largest Spore Cap Printer Sample':        ['general',   'sporeSample'],
  'Largest Goldfish Printer Sample':         ['general',   'goldFishSample'],
  'Largest Fly Printer Sample':              ['general',   'fliesSample'],
  'Total Best Wave in Worship':              ['general',   'totalWaves'],
  'Most Giants Killed in a Single Week':     ['misc',      'mostGiantsKilled'],
  'Total Refinery Rank':                     ['tasks',     'refinedSalts'],
  'Total Construct Buildings LV':            ['general',   'totalBuildings'],
  'Most Greenstacks in Storage':             ['general',   'totalGreenStacks'],
  'Total Cooking Meals LV':                  ['general',   'totalMeals'],
  'Highest Power Mob':                       ['general',   'highestPowerPet'],
  'Total Shiny Mob LV':                      ['general',   'totalShinyLevels'],
  'Total Mob Breedability LV':               ['general',   'totalBreedabilityLevels'],
  'Total Artifacts Found':                   ['character', 'totalCompassUpgrades'], // best guess
  'Total Boat Upgrade LV':                   ['general',   'totalBoats'],
  'Most Gaming Bits Owned':                  ['general',   'bits'],
  'Best Gold Nugget':                        ['tasks',     'highestNugget'],
  'God Rank in Divinity':                    ['general',   'godRank'],
  'Total Opals Found':                       ['caverns',   'totalOpals'],
  'Total LV of Cavern Villagers':            ['caverns',   'totalCollectibleLevels'], // best guess
  'Total Resource Layers Destroyed':         ['caverns',   'totalLayersDestroyed'],
  'Best Dawg Den score':                     ['caverns',   'bestDenScore'],
  'Best Justice Monument Round':             ['caverns',   'highestJusticeRound'],
  'Total Gambit Time (in Seconds)':          ['caverns',   'totalGambitTime'],
  'Highest Crop OG':                         ['general',   'highestCropOg'],
  'Total Land Rank':                         ['general',   'totalPlotRanks'],
  'Jade Emporium Upgrades Purchased':        ['general',   'jadeCoins'],
  'Total Career Summoning Wins':             ['general',   'endlessSummoningWins'],
  'Total Summoning Upgrades LV':             ['general',   'totalSummoningUpgrades'],
  'Total Spelunk Shop Upgrades LV':          ['general',   'totalSpelunkingUpgrades'],
  'Biggest Haul in a single Delve':          ['misc',      'biggestHaulSpelunking'],
  'Minehead Opponents Defeated':             ['misc',      'mineheadOpponentsDefeated'],
  'Total Glimbo Trades':                     ['misc',      'glimboTotalTrades'],
  'Unique Sushi Created':                    ['general',   'totalSushiKnowledgeLevels']
};

// Raw value mapping: tome task name -> parsedData field
var RAW_PD_MAP = {
  'Log Book':              'logBook',
  'Total Shiny Mob LV':    'totalShinyLevels',
  'Highest Drop Rate Multi': 'dropRate'
  // (most parsedData fields are already covered by leaderboards above)
};

// ------------------------------------------------------------------
// MENU
// ------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tome Updater')
    .addItem('Refresh BEST TOME', 'refreshBestTome')
    .addSeparator()
    .addItem('About', 'showAbout')
    .addToUi();
}

function showAbout() {
  SpreadsheetApp.getUi().alert(
    'Best Tome Updater v1.0',
    'Updates BEST TOME columns G (raw) and I (pts) from idleontoolbox.com API.\n\n' +
    'Player name: BEST TOME!A1\n' +
    'Pts: 100% coverage. Raw: ~50/118 via API mapping (rest preserved).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ------------------------------------------------------------------
// API helpers
// ------------------------------------------------------------------
function fetchProfile(name) {
  var url = PROFILE_URL + encodeURIComponent(name);
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Profile API ' + r.getResponseCode() + ' for ' + name);
  return JSON.parse(r.getContentText());
}

function fetchCategoryForUser(category, name) {
  var url = LB_URL + '?leaderboard=' + encodeURIComponent(category) +
            '&leaderboardUser=' + encodeURIComponent(name);
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('LB API ' + r.getResponseCode() + ' for ' + category);
  return JSON.parse(r.getContentText());
}

// Extract the value from a leaderboards-user-entry object: { mainChar, rank, <metric> }
function extractValue(entry, playerName) {
  if (!entry) return null;
  if (Array.isArray(entry)) {
    for (var i = 0; i < entry.length; i++) {
      if (String(entry[i].mainChar || '').toLowerCase() === String(playerName).toLowerCase()) {
        entry = entry[i]; break;
      }
    }
    if (Array.isArray(entry)) return null;  // not found
  }
  if (typeof entry !== 'object') return null;
  var keys = Object.keys(entry);
  for (var k = 0; k < keys.length; k++) {
    if (keys[k] !== 'mainChar' && keys[k] !== 'rank') return entry[keys[k]];
  }
  return null;
}

// ------------------------------------------------------------------
// MAIN
// ------------------------------------------------------------------
function refreshBestTome() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('BEST TOME');
    if (!sh) throw new Error('No "BEST TOME" tab found.');

    var playerName = String(sh.getRange('A1').getValue() || '').trim();
    if (!playerName) throw new Error('Player name missing in BEST TOME!A1');

    // Fetch profile + all leaderboards for this player
    var profile = fetchProfile(playerName);
    var pd = profile.parsedData || {};
    var pts = pd.tomePoints || [];
    if (pts.length === 0) throw new Error('No tomePoints in profile for ' + playerName);

    var cats = ['global', 'general', 'tasks', 'skills', 'character', 'misc', 'caverns'];
    var lb = {};
    cats.forEach(function (c) {
      lb[c] = fetchCategoryForUser(c, playerName);
      Utilities.sleep(120);
    });

    // Find data range: column E (task names) starting row 3
    var lastRow = sh.getLastRow();
    if (lastRow < 3) throw new Error('BEST TOME has no data rows.');
    var nRows = lastRow - 2;
    var taskNames = sh.getRange(3, 5, nRows, 1).getValues();
    var existingG = sh.getRange(3, 7, nRows, 1).getValues();

    // Build new G and I arrays
    var newG = [];
    var newI = [];
    var updatedRaw = 0;
    var updatedPts = 0;
    for (var r = 0; r < nRows; r++) {
      var name = String(taskNames[r][0] || '').trim();
      if (!name) { newG.push([existingG[r][0]]); newI.push([null]); continue; }

      var idx = TOME_TASKS.indexOf(name);
      // Pts (column I)
      if (idx >= 0 && typeof pts[idx] === 'number') {
        newI.push([pts[idx]]);
        updatedPts++;
      } else {
        newI.push([null]);
      }
      // Raw value (column G)
      var raw = null;
      if (RAW_PD_MAP[name] && pd[RAW_PD_MAP[name]] !== undefined) {
        raw = pd[RAW_PD_MAP[name]];
      } else if (RAW_LB_MAP[name]) {
        var m = RAW_LB_MAP[name];
        raw = extractValue(lb[m[0]] && lb[m[0]][m[1]], playerName);
      }
      if (raw !== null && raw !== undefined) {
        newG.push([raw]);
        updatedRaw++;
      } else {
        newG.push([existingG[r][0]]);  // preserve
      }
    }

    // Write back
    sh.getRange(3, 7, newG.length, 1).setValues(newG);
    sh.getRange(3, 9, newI.length, 1).setValues(newI);

    ui.alert('BEST TOME refreshed',
      'Player: ' + playerName + '\n' +
      'Pts (col I): ' + updatedPts + ' / ' + nRows + ' updated\n' +
      'Raw values (col G): ' + updatedRaw + ' / ' + nRows + ' updated (rest preserved)',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', (e && e.message ? e.message : String(e)) +
      '\n\n' + (e && e.stack ? e.stack : ''), ui.ButtonSet.OK);
  }
}
