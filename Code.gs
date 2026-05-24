/**
 * IdleonToolbox Leaderboards -> Google Sheets (v3.2)
 * Pulls top 10 + your rank/score for all 153 leaderboards from
 * idleontoolbox.com - 100% automatic.
 *
 * Tabs:
 *   - Config       : welcome / instructions / player name
 *   - Leaderboards : raw data (one row per board)
 *   - Dashboard    : analytics (built on demand)
 *
 * Menu: "IT Leaderboards"
 *   - Refresh data
 *   - Build Dashboard
 *   - Fix formulas only
 *   - Reapply Idleon number format
 *   - Reset Config layout
 *   - Rebuild sheet from scratch
 *   - About
 *
 * Numbers display in Idleon notation (M / B / T / Q / QQ / QQQ / 1e+N).
 */

var API_BASE = 'https://profiles.idleontoolbox.workers.dev/api/leaderboards';

// Cells inside Config tab where the script reads/writes runtime values
var CFG_PLAYER_CELL  = 'C5';
var CFG_REFRESH_CELL = 'C6';

var REGISTRY = {
  global: { label: 'Global', boards: [
    ['globalRanking', 'Global Ranking']
  ]},
  general: { label: 'General', boards: [
    ['totalMoney', 'Total Money'],
    ['totalLevels', 'Total Levels'],
    ['totalStatues', 'Total Statues'],
    ['totalBuildings', 'Total Buildings'],
    ['totalGreenStacks', 'Total Green Stacks'],
    ['logSample', 'Log Sample'],
    ['copperSample', 'Copper Sample'],
    ['fliesSample', 'Flies Sample'],
    ['sporeSample', 'Spore Sample'],
    ['goldFishSample', 'Gold Fish Sample'],
    ['totalWaves', 'Total Waves'],
    ['totalMeals', 'Total Meals'],
    ['totalShrines', 'Total Shrines'],
    ['totalVials', 'Total Vials'],
    ['totalCards', 'Total Cards'],
    ['bits', 'Bits'],
    ['godRank', 'God Rank'],
    ['greenMushroomKills', 'Green Mushroom Kills'],
    ['highestCropOg', 'Highest Crop Og'],
    ['jadeCoins', 'Jade Coins'],
    ['whiteEssence', 'White Essence'],
    ['totalBoats', 'Total Boats'],
    ['logBook', 'Log Book'],
    ['totalShinyLevels', 'Total Shiny Levels'],
    ['totalBreedabilityLevels', 'Total Breedability Levels'],
    ['totalPlotRanks', 'Total Plot Ranks'],
    ['totalPrimeKills', 'Total Prime Kills'],
    ['highestPowerPet', 'Highest Power Pet'],
    ['slab', 'Slab'],
    ['totalTomePoints', 'Total Tome Points'],
    ['totalPaletteLevels', 'Total Palette Levels'],
    ['totalDivinityBlessingLevels', 'Total Divinity Blessing Levels'],
    ['totalSummoningUpgrades', 'Total Summoning Upgrades'],
    ['totalSpelunkingUpgrades', 'Total Spelunking Upgrades'],
    ['totalZenithMarketUpgrades', 'Total Zenith Market Upgrades'],
    ['totalCoralKidUpgrades', 'Total Coral Kid Upgrades'],
    ['totalSushiStationUpgrades', 'Total Sushi Station Upgrades'],
    ['totalSushiKnowledgeLevels', 'Total Sushi Knowledge Levels'],
    ['arenaWaves', 'Arena Waves'],
    ['dkOrbKills', 'DK Orb Kills'],
    ['sbPlunderousKills', 'SB Plunderous Kills'],
    ['esWormholeKills', 'ES Wormhole Kills'],
    ['vwPortals', 'VW Portals'],
    ['fractalHours', 'Fractal Hours'],
    ['dungeonCredits', 'Dungeon Credits'],
    ['dungeonFlurbos', 'Dungeon Flurbos'],
    ['endlessSummoningWins', 'Endless Summoning Wins']
  ]},
  tasks: { label: 'Tasks', boards: [
    ['highestDamage', 'Highest Damage'],
    ['afkTime', 'AFK Time'],
    ['monstersKilled', 'Monsters Killed'],
    ['postOfficeOrders', 'Post Office Orders'],
    ['refinedSalts', 'Refined Salts'],
    ['totalMaterialPrinted', 'Total Material Printed'],
    ['trashedCogs', 'Trashed Cogs'],
    ['plantsPicked', 'Plants Picked'],
    ['totalBubbles', 'Total Bubbles'],
    ['totalStamps', 'Total Stamps'],
    ['highestNugget', 'Highest Nugget']
  ]},
  skills: { label: 'Skills', boards: [
    ['totalSkillsLevels', 'Total Skills Levels'],
    ['mining', 'Mining'],
    ['smithing', 'Smithing'],
    ['choppin', 'Choppin'],
    ['fishing', 'Fishing'],
    ['alchemy', 'Alchemy'],
    ['catching', 'Catching'],
    ['trapping', 'Trapping'],
    ['construction', 'Construction'],
    ['worship', 'Worship'],
    ['cooking', 'Cooking'],
    ['breeding', 'Breeding'],
    ['laboratory', 'Laboratory'],
    ['sailing', 'Sailing'],
    ['divinity', 'Divinity'],
    ['gaming', 'Gaming'],
    ['farming', 'Farming'],
    ['sneaking', 'Sneaking'],
    ['summoning', 'Summoning'],
    ['spelunking', 'Spelunking'],
    ['research', 'Research']
  ]},
  character: { label: 'Character', boards: [
    ['strength', 'Strength'],
    ['agility', 'Agility'],
    ['wisdom', 'Wisdom'],
    ['luck', 'Luck'],
    ['level', 'Level'],
    ['dropRate', 'Drop Rate'],
    ['cashMulti', 'Cash Multi'],
    ['totalGrimoireUpgrades', 'Total Grimoire Upgrades'],
    ['totalCompassUpgrades', 'Total Compass Upgrades'],
    ['totalArcanistUpgrades', 'Total Arcanist Upgrades'],
    ['defence', 'Defence'],
    ['accuracy', 'Accuracy'],
    ['hp', 'HP'],
    ['mp', 'MP']
  ]},
  misc: { label: 'Misc', boards: [
    ['w1Colo', 'W1 Colo'], ['w2Colo', 'W2 Colo'], ['w3Colo', 'W3 Colo'],
    ['w4Colo', 'W4 Colo'], ['w5Colo', 'W5 Colo'], ['w6Colo', 'W6 Colo'],
    ['choppingMinigame', 'Chopping Minigame'],
    ['fishingMinigame', 'Fishing Minigame'],
    ['catchingMinigame', 'Catching Minigame'],
    ['miningMinigame', 'Mining Minigame'],
    ['penpalMinigame', 'Penpal Minigame'],
    ['hoopsMinigame', 'Hoops Minigame'],
    ['dartsMinigame', 'Darts Minigame'],
    ['redoxSaltRank', 'Redox Salt Rank'],
    ['explosiveSaltRank', 'Explosive Salt Rank'],
    ['spontaneitySaltRank', 'Spontaneity Salt Rank'],
    ['dioxideSaltRank', 'Dioxide Salt Rank'],
    ['purpleSaltRank', 'Purple Salt Rank'],
    ['nulloSaltRank', 'Nullo Salt Rank'],
    ['crosslinkSaltRank', 'Crosslink Salt Rank'],
    ['propagatedSaltRank', 'Propagated Salt Rank'],
    ['anionicSaltRank', 'Anionic Salt Rank'],
    ['totalDustCollected', 'Total Dust Collected'],
    ['totalBonesCollected', 'Total Bones Collected'],
    ['totalTachyonsCollected', 'Total Tachyons Collected'],
    ['highestCogExp', 'Highest Cog Exp'],
    ['highestConstructExp/hr', 'Highest Construct Exp/hr'],
    ['highestCallMeBob', 'Highest Call Me Bob'],
    ['highestCallMeAsh', 'Highest Call Me Ash'],
    ['highestHammerHammer', 'Highest Hammer Hammer'],
    ['highestBigP', 'Highest Big P'],
    ['highestShowdownLevel', 'Highest Showdown Level'],
    ['mostGiantsKilled', 'Most Giants Killed'],
    ['biggestHaulSpelunking', 'Biggest Haul Spelunking'],
    ['highestSpelunkingPower', 'Highest Spelunking Power'],
    ['mineheadOpponentsDefeated', 'Minehead Opponents Defeated'],
    ['totalGrandDiscoveries', 'Total Grand Discoveries'],
    ['glimboTotalTrades', 'Glimbo Total Trades'],
    ['totalGamingCrowns', 'Total Gaming Crowns'],
    ['highestMegafeather', 'Highest Megafeather'],
    ['highestMegaFish', 'Highest Mega Fish'],
    ['highestMegaFlesh', 'Highest Mega Flesh']
  ]},
  caverns: { label: 'Caverns', boards: [
    ['totalMeasurementLevels', 'Total Measurement Levels'],
    ['totalOpals', 'Total Opals'],
    ['totalLayersDestroyed', 'Total Layers Destroyed'],
    ['totalBarExpansions', 'Total Bar Expansions'],
    ['bestDenScore', 'Best Den Score'],
    ['totalBraveryLevels', 'Total Bravery Levels'],
    ['totalJusticeLevels', 'Total Justice Levels'],
    ['highestJusticeRound', 'Highest Justice Round'],
    ['bellRings', 'Bell Rings'],
    ['bellPings', 'Bell Pings'],
    ['totalStringLevels', 'Total String Levels'],
    ['brokenJars', 'Broken Jars'],
    ['totalCollectibleLevels', 'Total Collectible Levels'],
    ['totalGambitTime', 'Total Gambit Time'],
    ['highestVillagerExp/hr', 'Highest Villager Exp/hr'],
    ['highestColonyLevel', 'Highest Colony Level'],
    ['highestSanctumLevel', 'Highest Sanctum Level']
  ]}
};

var HEADERS = [
  'Category', 'Leaderboard', 'My Rank', 'My Score',
  'Diff vs #1', '% of #1',
  '#1 Player', '#1 Score',
  '#2 Player', '#2 Score',
  '#3 Player', '#3 Score',
  '#4 Player', '#4 Score',
  '#5 Player', '#5 Score',
  '#6 Player', '#6 Score',
  '#7 Player', '#7 Score',
  '#8 Player', '#8 Score',
  '#9 Player', '#9 Score',
  '#10 Player', '#10 Score'
];

// ------------------------------------------------------------------
// IDLEON NUMBER FORMAT
// ------------------------------------------------------------------
function idleonFormat(v) {
  if (v === '' || v === null || v === undefined) return '@';
  var n = Number(v);
  if (isNaN(n)) return '@';
  var abs = Math.abs(n);
  if (abs < 1e6)  return '#,##0';
  if (abs < 1e9)  return '0.00,,"M"';
  if (abs < 1e12) return '0.00,,,"B"';
  if (abs < 1e15) return '0.00,,,,"T"';
  if (abs < 1e18) return '0.00,,,,,"Q"';
  if (abs < 1e21) return '0.00,,,,,,"QQ"';
  if (abs < 1e24) return '0.00,,,,,,,"QQQ"';
  return '0.00E+00';
}

function applyIdleonFormatRange(sheet, startRow, startCol, numRows, numCols) {
  if (numRows < 1 || numCols < 1) return;
  var range = sheet.getRange(startRow, startCol, numRows, numCols);
  var values = range.getValues();
  var currentFormats = range.getNumberFormats();
  var formats = values.map(function (row, i) {
    return row.map(function (v, j) {
      // Preserve percent formats - don't override with Idleon notation
      var cur = currentFormats[i][j];
      if (cur && cur.indexOf('%') !== -1) return cur;
      return idleonFormat(v);
    });
  });
  range.setNumberFormats(formats);
}

// ------------------------------------------------------------------
// MENU
// ------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IT Leaderboards')
    .addItem('Refresh data', 'refreshLeaderboards')
    .addItem('Build Dashboard', 'buildDashboard')
    .addItem('Refresh + Build Dashboard', 'refreshAndBuild')
    .addSeparator()
    .addItem('Fix formulas only', 'fixFormulasOnly')
    .addItem('Reapply Idleon number format', 'reapplyIdleonFormats')
    .addItem('Reset Config layout', 'resetConfigLayout')
    .addItem('Rebuild Leaderboards from scratch', 'rebuildLeaderboardSheet')
    .addSeparator()
    .addItem('About', 'showAbout')
    .addToUi();
}

function showAbout() {
  SpreadsheetApp.getUi().alert(
    'IT Leaderboards v3.2',
    'Pulls all 153 leaderboards from IdleonToolbox - 100% automatic.\n\n' +
    'Player name lives in Config!' + CFG_PLAYER_CELL + '.\n' +
    'Numbers display in Idleon notation (M / B / T / Q / QQ / QQQ / 1e+N).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ------------------------------------------------------------------
// CONFIG SHEET (welcome / instructions)
// ------------------------------------------------------------------
function getPlayerName() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = ss.getSheetByName('Config');
  if (!cfg) {
    setupConfigSheet('ARKHE');
    cfg = ss.getSheetByName('Config');
  }
  // Try new layout cell first, then old (B1) for backwards compat
  var name = String(cfg.getRange(CFG_PLAYER_CELL).getValue() || '').trim();
  if (!name) name = String(cfg.getRange('B1').getValue() || '').trim();
  if (!name) {
    cfg.getRange(CFG_PLAYER_CELL).setValue('ARKHE');
    name = 'ARKHE';
  }
  return name;
}

function setLastRefresh() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = ss.getSheetByName('Config');
  if (!cfg) return;
  // Read player name from new cell (C5), fallback to old (B1)
  var playerName = String(cfg.getRange(CFG_PLAYER_CELL).getValue() || '').trim();
  if (!playerName) playerName = String(cfg.getRange('B1').getValue() || '').trim();
  // Format timestamp in the spreadsheet's timezone
  var tz = ss.getSpreadsheetTimeZone();
  var dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  // Combined string: "ARKHE  -  2026-05-23 22:30:45"
  var combined = (playerName ? playerName + '  -  ' : '') + dateStr;
  // Write to new cell if Config has the new layout, else to old B2
  var hasNew = playerName === String(cfg.getRange(CFG_PLAYER_CELL).getValue() || '').trim() && playerName !== '';
  cfg.getRange(hasNew ? CFG_REFRESH_CELL : 'B2').setValue(combined);
}

function resetConfigLayout() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    'Reset Config tab?',
    'This rebuilds the Config tab with the latest layout. Your current player name will be preserved. Continue?',
    ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  // Try to capture current player name from either layout
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = ss.getSheetByName('Config');
  var name = 'ARKHE';
  if (cfg) {
    var n1 = String(cfg.getRange(CFG_PLAYER_CELL).getValue() || '').trim();
    var n2 = String(cfg.getRange('B1').getValue() || '').trim();
    name = n1 || n2 || 'ARKHE';
  }
  setupConfigSheet(name);
  SpreadsheetApp.getActive().toast('Config rebuilt', 'IT Leaderboards', 3);
}

function setupConfigSheet(playerName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName('Config');
  if (old) ss.deleteSheet(old);
  var cfg = ss.insertSheet('Config', 0);

  cfg.setHiddenGridlines(true);
  cfg.setColumnWidth(1, 60);
  cfg.setColumnWidth(2, 220);
  cfg.setColumnWidth(3, 560);

  var r = 1;

  // ----- Banner -----
  cfg.setRowHeight(r, 60);
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('IDLEON LEADERBOARDS TRACKER')
    .setBackground('#1a1a2e').setFontColor('#ffd700')
    .setFontSize(24).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  r += 1;
  cfg.setRowHeight(r, 30);
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('Track your position across all 153 leaderboards on idleontoolbox.com')
    .setBackground('#1a1a2e').setFontColor('#cccccc')
    .setFontStyle('italic').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  r += 1;
  // Spacer
  cfg.setRowHeight(r, 14);
  r += 1;

  // ----- Section: Your account -----
  configSectionHeader(cfg, r, 'YOUR ACCOUNT', '#16a34a');
  r += 1;
  // Player name row (cells B5 / C5 by design; CFG_PLAYER_CELL = 'C5')
  cfg.getRange(r, 2).setValue('Player name').setFontWeight('bold').setHorizontalAlignment('right')
    .setVerticalAlignment('middle').setFontSize(12);
  cfg.getRange(r, 3).setValue(playerName || 'ARKHE')
    .setBackground('#fff9c4')
    .setBorder(true, true, true, true, false, false, '#d4a017', SpreadsheetApp.BorderStyle.SOLID_THICK)
    .setFontSize(16).setFontWeight('bold').setFontColor('#1a1a2e')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  cfg.setRowHeight(r, 36);
  r += 1;
  // Last refresh row
  cfg.getRange(r, 2).setValue('Last refresh').setFontWeight('bold').setHorizontalAlignment('right')
    .setVerticalAlignment('middle');
  cfg.getRange(r, 3).setValue('(updated by the script after Refresh data)')
    .setFontColor('#777').setFontStyle('italic').setVerticalAlignment('middle');
  cfg.setRowHeight(r, 24);
  r += 1;
  // Hint
  cfg.getRange(r, 3).setValue('Change the player name above (any IT account with a public profile) and click "Refresh data" to reload.')
    .setFontColor('#777').setFontSize(10).setFontStyle('italic');
  cfg.setRowHeight(r, 20);
  r += 2;

  // ----- Section: Quick start -----
  configSectionHeader(cfg, r, 'QUICK START', '#3b82f6');
  r += 1;
  var qs = [
    ['1', 'Approve the script',
      'On first use, Google asks for permission. Click "Review permissions" -> pick your account -> "Advanced" -> "Go to (project name) (unsafe)" -> "Allow". The "unsafe" wording is generic; this script only talks to the public IdleonToolbox API and only writes to THIS spreadsheet (see the "Why Google asks" section below).'],
    ['2', 'Find the menu',
      'A new menu called "IT Leaderboards" appears at the top of the spreadsheet, right after "Help". If you do not see it, reload the page (F5).'],
    ['3', 'Click Refresh data',
      'Pulls fresh numbers from the IT API for the player name above. Takes ~5-10 seconds. The Leaderboards tab fills with 153 rows.'],
    ['4', 'Click Build Dashboard',
      'Generates the Dashboard tab with tier summary, heatmap, worst positions, quick wins and best positions.'],
    ['5', 'Bookmark this tab',
      'Come back any time, change the player name to look up a friend, or rerun Refresh data when IT updates (about once a day).']
  ];
  qs.forEach(function (step) {
    cfg.getRange(r, 1).setValue(step[0]).setFontSize(20).setFontWeight('bold')
      .setFontColor('#3b82f6').setHorizontalAlignment('center').setVerticalAlignment('middle');
    cfg.getRange(r, 2).setValue(step[1]).setFontWeight('bold').setVerticalAlignment('middle')
      .setFontSize(12);
    cfg.getRange(r, 3).setValue(step[2]).setVerticalAlignment('middle').setWrap(true)
      .setFontSize(10);
    cfg.setRowHeight(r, 60);
    r += 1;
  });
  r += 1;

  // ----- Section: Menu reference -----
  configSectionHeader(cfg, r, 'MENU REFERENCE', '#9333ea');
  r += 1;
  var menu = [
    ['*', 'Refresh data',
      'Fetches fresh data from idleontoolbox.com for the player name in C5. Use once a day - IT only updates daily anyway. Takes ~5-10 seconds.'],
    ['*', 'Build Dashboard',
      'Rebuilds the Dashboard tab from current Leaderboards data. Run after every Refresh to keep analytics in sync.'],
    ['-', 'Fix formulas only',
      'If "Diff vs #1" or "% of #1" cells show #ERROR, this clears and reapplies just those formulas without re-fetching data.'],
    ['-', 'Reapply Idleon number format',
      'If number display looks wrong (no M/B/T suffix), this reapplies the per-cell magnitude-aware format.'],
    ['-', 'Reset Config layout',
      'Rebuilds THIS tab with the latest layout. Player name is preserved. Use after upgrading the script.'],
    ['-', 'Rebuild Leaderboards from scratch',
      'Nuclear option: deletes the Leaderboards tab and rebuilds the structure. Use only if the sheet is broken.'],
    ['-', 'About',
      'Shows version info.']
  ];
  menu.forEach(function (item) {
    cfg.getRange(r, 1).setValue(item[0]).setFontSize(14).setFontWeight('bold')
      .setFontColor('#9333ea').setHorizontalAlignment('center').setVerticalAlignment('middle');
    cfg.getRange(r, 2).setValue(item[1]).setFontWeight('bold').setVerticalAlignment('middle')
      .setFontSize(12);
    cfg.getRange(r, 3).setValue(item[2]).setVerticalAlignment('middle').setWrap(true)
      .setFontSize(10);
    cfg.setRowHeight(r, 44);
    r += 1;
  });
  r += 1;

  // ----- Section: Why permission -----
  configSectionHeader(cfg, r, 'WHY GOOGLE ASKS FOR PERMISSION', '#f59e0b');
  r += 1;
  cfg.getRange(r, 2, 1, 2).merge()
    .setValue('Google flags any Apps Script that makes HTTP requests or modifies your sheet. The "unsafe" warning means the developer (the person who copied this sheet to you) is not a Google-verified publisher - it does NOT mean the code is malicious. The full source code is visible at Extensions -> Apps Script.')
    .setWrap(true).setVerticalAlignment('top').setFontSize(10);
  cfg.setRowHeight(r, 60);
  r += 1;
  cfg.getRange(r, 2).setValue('What it DOES:').setFontWeight('bold').setFontColor('#16a34a')
    .setVerticalAlignment('top').setFontSize(11);
  cfg.getRange(r, 3).setValue(
    'Sends GET requests to profiles.idleontoolbox.workers.dev (public API, no auth).\n' +
    'Writes data into THIS spreadsheet (and only this spreadsheet).\n' +
    'Reads the player name from cell ' + CFG_PLAYER_CELL + '.')
    .setWrap(true).setVerticalAlignment('top').setFontSize(10);
  cfg.setRowHeight(r, 64);
  r += 1;
  cfg.getRange(r, 2).setValue('What it does NOT do:').setFontWeight('bold').setFontColor('#dc2626')
    .setVerticalAlignment('top').setFontSize(11);
  cfg.getRange(r, 3).setValue(
    'Read or modify other Google Drive files.\n' +
    'Send emails or interact with other Google services.\n' +
    'Phone home to anyone except idleontoolbox.com.\n' +
    'Store or transmit your data outside this spreadsheet.')
    .setWrap(true).setVerticalAlignment('top').setFontSize(10);
  cfg.setRowHeight(r, 80);
  r += 2;

  // ----- Section: Tabs -----
  configSectionHeader(cfg, r, 'TABS IN THIS SPREADSHEET', '#0891b2');
  r += 1;
  var tabs = [
    ['Config', 'You are here. Settings, instructions, menu reference. Player name lives in cell ' + CFG_PLAYER_CELL + '.'],
    ['Leaderboards',
      'Raw data for all 153 leaderboards.  Categories: Global (1), General (47), Tasks (11), Skills (21), Character (14), Misc (42), Caverns (17). Your rank cell is highlighted gold/silver/bronze for #1/#2/#3 and green for top 10.'],
    ['Dashboard',
      'Analytics built from Leaderboards. 5 sections: tier summary, heatmap by category, top 40 worst positions, quick wins (rank 11-50), best 30 positions.']
  ];
  tabs.forEach(function (item) {
    cfg.getRange(r, 1).setValue('>').setFontSize(16).setFontWeight('bold')
      .setFontColor('#0891b2').setHorizontalAlignment('center').setVerticalAlignment('top');
    cfg.getRange(r, 2).setValue(item[0]).setFontWeight('bold').setVerticalAlignment('top')
      .setFontSize(12);
    cfg.getRange(r, 3).setValue(item[1]).setVerticalAlignment('top').setWrap(true).setFontSize(10);
    cfg.setRowHeight(r, 56);
    r += 1;
  });
  r += 1;

  // ----- Section: Notes -----
  configSectionHeader(cfg, r, 'GOOD TO KNOW', '#64748b');
  r += 1;
  var notes = [
    'The IT API updates ~once a day. Refreshing more often does not change numbers.',
    'For your data to load, your IT profile must be Public (or Anonymous). Set this in IT > Account > Profile Access.',
    'If a name is anonymous (e.g. "Anon#979edc"), use that exact name in cell ' + CFG_PLAYER_CELL + '.',
    'Numbers are displayed in Idleon notation. M = 1e6, B = 1e9, T = 1e12, Q = 1e15, QQ = 1e18, QQQ = 1e21, then scientific.',
    'The full source code is at Extensions -> Apps Script. Read it, modify it, fork it - it is your copy.'
  ];
  notes.forEach(function (n) {
    cfg.getRange(r, 1).setValue('o').setFontColor('#64748b').setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('top');
    cfg.getRange(r, 2, 1, 2).merge().setValue(n).setWrap(true).setFontSize(10)
      .setVerticalAlignment('top');
    cfg.setRowHeight(r, 32);
    r += 1;
  });
  r += 1;

  // ----- Footer -----
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('Data source: idleontoolbox.com   |   Source code: github.com/Morta1/IdleonToolbox   |   API: profiles.idleontoolbox.workers.dev')
    .setBackground('#1a1a2e').setFontColor('#cccccc')
    .setFontSize(10).setFontStyle('italic')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  cfg.setRowHeight(r, 28);
  r += 1;
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('Script version 3.2  |  Built with Google Apps Script  |  No installation needed - just make a copy')
    .setBackground('#1a1a2e').setFontColor('#888')
    .setFontSize(9)
    .setHorizontalAlignment('center');
  cfg.setRowHeight(r, 22);

  // Hide column D+ visually by setting cursor focus
  cfg.setActiveSelection(cfg.getRange(CFG_PLAYER_CELL));
}

// Helper: paints a section header bar across cols A-C
function configSectionHeader(cfg, row, title, accentColor) {
  cfg.setRowHeight(row, 34);
  cfg.getRange(row, 1, 1, 3).merge()
    .setValue('   ' + title)
    .setBackground('#2d3748').setFontColor('#ffffff')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBorder(false, true, false, false, false, false, accentColor, SpreadsheetApp.BorderStyle.SOLID_THICK);
  // Left accent bar (col A)
  cfg.getRange(row, 1).setBackground(accentColor);
}

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------
function fetchCategoryTop(category) {
  var url = API_BASE + '?leaderboard=' + encodeURIComponent(category);
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) {
    throw new Error('API error (top) for ' + category + ': HTTP ' + r.getResponseCode());
  }
  var data = JSON.parse(r.getContentText());
  if (!data[category] || !data[category].public) {
    throw new Error('Bad response for ' + category);
  }
  return data[category].public;
}

function fetchUserStatsForCategory(category, userName) {
  var url = API_BASE + '?leaderboard=' + encodeURIComponent(category) +
            '&leaderboardUser=' + encodeURIComponent(userName);
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) {
    throw new Error('API error (user) for ' + category + ': HTTP ' + r.getResponseCode());
  }
  return JSON.parse(r.getContentText());
}

// ------------------------------------------------------------------
// LEADERBOARDS SHEET
// ------------------------------------------------------------------
function ensureLeaderboardsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Leaderboards');
  if (!sh) sh = ss.insertSheet('Leaderboards');
  if (sh.getRange(1, 1).getValue() !== 'Category') {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    sh.setFrozenColumns(2);
  }
  return sh;
}

function rowsRegistry() {
  var rows = [];
  Object.keys(REGISTRY).forEach(function (catKey) {
    var cat = REGISTRY[catKey];
    cat.boards.forEach(function (pair) {
      rows.push({ catKey: catKey, catLabel: cat.label, apiKey: pair[0], friendly: pair[1] });
    });
  });
  return rows;
}

function rebuildLeaderboardSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Leaderboards');
  if (sh) ss.deleteSheet(sh);
  var sh2 = ensureLeaderboardsSheet();
  var regRows = rowsRegistry();
  var data = regRows.map(function (r) {
    var row = new Array(HEADERS.length);
    for (var i = 0; i < HEADERS.length; i++) row[i] = '';
    row[0] = r.catLabel;
    row[1] = r.friendly;
    return row;
  });
  sh2.getRange(2, 1, data.length, HEADERS.length).setValues(data);
  applyFormulas(sh2, regRows.length);
  applyLeaderboardsFormatting(sh2, regRows.length);
  SpreadsheetApp.getUi().alert('Sheet rebuilt. Now click Refresh data.');
}

function applyFormulas(sh, nRows) {
  var diff = [];
  var pct = [];
  for (var i = 0; i < nRows; i++) {
    var r = i + 2;
    diff.push(['=IFERROR(D' + r + '-H' + r + ', "")']);
    pct.push(['=IFERROR(D' + r + '/H' + r + ', "")']);
  }
  sh.getRange(2, 5, nRows, 1).setFormulas(diff);
  sh.getRange(2, 6, nRows, 1).setFormulas(pct);
  sh.getRange(2, 6, nRows, 1).setNumberFormat('0.00%');
}

function applyLeaderboardsFormatting(sh, nRows) {
  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 70);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 130);
  sh.setColumnWidth(6, 80);
  for (var c = 7; c <= HEADERS.length; c++) {
    sh.setColumnWidth(c, 110);
  }
  applyIdleonFormatRange(sh, 2, 4, nRows, 1);  // D My Score
  applyIdleonFormatRange(sh, 2, 5, nRows, 1);  // E Diff
  var scoreCols = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26];
  for (var k = 0; k < scoreCols.length; k++) {
    applyIdleonFormatRange(sh, 2, scoreCols[k], nRows, 1);
  }
  var rankRange = sh.getRange(2, 3, nRows, 1);
  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(1).setBackground('#FFD700').setRanges([rankRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(2).setBackground('#C0C0C0').setRanges([rankRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(3).setBackground('#CD7F32').setRanges([rankRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(4, 10).setBackground('#90EE90').setRanges([rankRange]).build());
  sh.setConditionalFormatRules(rules);
}

function fixFormulasOnly() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Leaderboards');
    if (!sh) {
      ui.alert('Fix formulas only', 'No Leaderboards sheet found. Run "Refresh data" first.', ui.ButtonSet.OK);
      return;
    }
    var nRows = sh.getLastRow() - 1;
    if (nRows < 1) {
      ui.alert('Fix formulas only', 'Leaderboards sheet is empty. Run "Refresh data" first.', ui.ButtonSet.OK);
      return;
    }
    Logger.log('fixFormulasOnly: starting, nRows=' + nRows);
    sh.getRange(2, 5, nRows, 2).clearContent();
    Logger.log('fixFormulasOnly: cleared E:F');
    applyFormulas(sh, nRows);
    Logger.log('fixFormulasOnly: formulas applied');
    applyLeaderboardsFormatting(sh, nRows);
    Logger.log('fixFormulasOnly: formatting applied');
    ui.alert('Fix formulas only', 'Done! Reapplied formulas in columns E and F for ' + nRows + ' rows.', ui.ButtonSet.OK);
  } catch (e) {
    Logger.log('fixFormulasOnly ERROR: ' + e);
    ui.alert('Fix formulas only - ERROR',
      'Something went wrong:\n\n' + (e && e.message ? e.message : String(e)) +
      '\n\nStack:\n' + (e && e.stack ? e.stack : '(no stack)'),
      ui.ButtonSet.OK);
  }
}

function reapplyIdleonFormats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Leaderboards');
  if (sh && sh.getLastRow() > 1) {
    applyLeaderboardsFormatting(sh, sh.getLastRow() - 1);
  }
  var dash = ss.getSheetByName('Dashboard');
  if (dash && dash.getLastRow() > 1) {
    applyIdleonFormatRange(dash, 1, 2, dash.getLastRow(), 7);
  }
  SpreadsheetApp.getActive().toast('Number formats reapplied.', 'IT Leaderboards', 3);
}

function refreshLeaderboards() {
  var playerName = getPlayerName();
  var playerLc = playerName.toLowerCase();
  var sh = ensureLeaderboardsSheet();
  var regRows = rowsRegistry();

  var topCache = {};
  var userCache = {};
  Object.keys(REGISTRY).forEach(function (catKey) {
    topCache[catKey] = fetchCategoryTop(catKey);
    Utilities.sleep(150);
    userCache[catKey] = fetchUserStatsForCategory(catKey, playerName);
    Utilities.sleep(150);
  });

  var out = regRows.map(function (r) {
    var board = topCache[r.catKey][r.apiKey] || [];
    var userInfo = (userCache[r.catKey] || {})[r.apiKey];
    var row = new Array(HEADERS.length);
    for (var i = 0; i < HEADERS.length; i++) row[i] = '';
    row[0] = r.catLabel;
    row[1] = r.friendly;
    var userEntry = null;
    if (Array.isArray(userInfo)) {
      for (var j = 0; j < userInfo.length; j++) {
        if (String(userInfo[j].mainChar || '').toLowerCase() === playerLc) {
          userEntry = userInfo[j];
          break;
        }
      }
    } else if (userInfo && typeof userInfo === 'object') {
      userEntry = userInfo;
    }
    if (userEntry) {
      row[2] = (userEntry.rank !== undefined && userEntry.rank !== null) ? userEntry.rank : '';
      var vk = null;
      var keys = Object.keys(userEntry);
      for (var m = 0; m < keys.length; m++) {
        if (keys[m] !== 'mainChar' && keys[m] !== 'rank') { vk = keys[m]; break; }
      }
      row[3] = vk ? userEntry[vk] : '';
    }
    for (var p = 0; p < 10; p++) {
      var entry = board[p];
      if (!entry) break;
      var vk2 = null;
      var ekeys = Object.keys(entry);
      for (var n = 0; n < ekeys.length; n++) {
        if (ekeys[n] !== 'mainChar' && ekeys[n] !== 'rank') { vk2 = ekeys[n]; break; }
      }
      row[6 + p * 2] = entry.mainChar || '';
      row[7 + p * 2] = vk2 ? entry[vk2] : '';
    }
    return row;
  });

  sh.getRange(2, 5, out.length, 2).clearContent();
  sh.getRange(2, 1, out.length, 2).setValues(out.map(function (r) { return [r[0], r[1]]; }));
  sh.getRange(2, 3, out.length, 2).setValues(out.map(function (r) { return [r[2], r[3]]; }));
  sh.getRange(2, 7, out.length, 20).setValues(out.map(function (r) { return r.slice(6, 26); }));

  applyFormulas(sh, out.length);
  applyLeaderboardsFormatting(sh, out.length);
  setLastRefresh();
  SpreadsheetApp.getActive().toast(
    'Refreshed ' + out.length + ' leaderboards for ' + playerName,
    'IT Leaderboards',
    5
  );
}

// ------------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------------
function buildDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lb = ss.getSheetByName('Leaderboards');
  if (!lb || lb.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('No Leaderboards data. Run "Refresh data" first.');
    return;
  }

  var lastRow = lb.getLastRow();
  var raw = lb.getRange(2, 1, lastRow - 1, 27).getValues();
  var rows = raw.map(function (r) {
    return {
      category: String(r[0] || ''),
      leaderboard: String(r[1] || ''),
      myRank: (typeof r[2] === 'number' && r[2] > 0) ? r[2] : null,
      myScore: (typeof r[3] === 'number') ? r[3] : null,
      topScore: (typeof r[7] === 'number') ? r[7] : null,
      score10: (typeof r[25] === 'number') ? r[25] : null
    };
  });

  var dash = ss.getSheetByName('Dashboard');
  if (dash) ss.deleteSheet(dash);
  // Insert after Config (index 1) so Config stays first
  dash = ss.insertSheet('Dashboard', 1);

  var row = 1;

  dash.getRange(row, 1).setValue('Idleon Leaderboards Dashboard')
    .setFontSize(18).setFontWeight('bold').setFontColor('#1a1a2e');
  row += 1;
  dash.getRange(row, 1).setValue('Generated from the Leaderboards tab. Run "Refresh data" first to pull fresh numbers.')
    .setFontColor('#666').setFontStyle('italic');
  row += 2;

  // Tier summary
  dash.getRange(row, 1).setValue('1. Tier summary')
    .setFontWeight('bold').setFontSize(14).setBackground('#1a1a2e').setFontColor('#fff');
  dash.getRange(row, 1, 1, 8).merge().setHorizontalAlignment('left').setBackground('#1a1a2e');
  row += 1;
  var tiers = [
    { label: 'Top 10', min: 1, max: 10, color: '#FFD700' },
    { label: 'Top 11-50', min: 11, max: 50, color: '#9be8a4' },
    { label: 'Top 51-100', min: 51, max: 100, color: '#fff599' },
    { label: 'Top 101-200', min: 101, max: 200, color: '#ffc285' },
    { label: 'Rank 200+', min: 201, max: 999999, color: '#ff8888' },
    { label: 'Unranked', min: null, max: null, color: '#cccccc' }
  ];
  var tierCounts = tiers.map(function (t) {
    if (t.min === null) return rows.filter(function (r) { return !r.myRank; }).length;
    return rows.filter(function (r) { return r.myRank !== null && r.myRank >= t.min && r.myRank <= t.max; }).length;
  });
  var labels = tiers.map(function (t) { return t.label; });
  dash.getRange(row, 1, 1, 6).setValues([labels])
    .setFontWeight('bold').setHorizontalAlignment('center').setBorder(true, true, true, true, true, true);
  tiers.forEach(function (t, i) { dash.getRange(row, i + 1).setBackground(t.color); });
  row += 1;
  dash.getRange(row, 1, 1, 6).setValues([tierCounts])
    .setHorizontalAlignment('center').setFontSize(14).setFontWeight('bold')
    .setBorder(true, true, true, true, true, true);
  row += 1;
  var pcts = tierCounts.map(function (c) { return rows.length > 0 ? (c / rows.length) : 0; });
  dash.getRange(row, 1, 1, 6).setValues([pcts])
    .setHorizontalAlignment('center').setNumberFormat('0.0%')
    .setBorder(true, true, true, true, true, true).setFontColor('#666');
  row += 2;

  // Heatmap
  dash.getRange(row, 1).setValue('2. Heatmap by category')
    .setFontWeight('bold').setFontSize(14).setBackground('#1a1a2e').setFontColor('#fff');
  dash.getRange(row, 1, 1, 8).merge().setHorizontalAlignment('left').setBackground('#1a1a2e');
  row += 1;
  var heatHeader = ['Category', 'Total', 'Top 10', '11-50', '51-100', '101-200', '200+', 'Unranked'];
  dash.getRange(row, 1, 1, heatHeader.length).setValues([heatHeader])
    .setFontWeight('bold').setBackground('#444466').setFontColor('#fff').setHorizontalAlignment('center');
  row += 1;
  var cats = ['Global', 'General', 'Tasks', 'Skills', 'Character', 'Misc', 'Caverns'];
  cats.forEach(function (cat) {
    var catRows = rows.filter(function (r) { return r.category === cat; });
    var counts = [
      catRows.filter(function (r) { return r.myRank >= 1 && r.myRank <= 10; }).length,
      catRows.filter(function (r) { return r.myRank >= 11 && r.myRank <= 50; }).length,
      catRows.filter(function (r) { return r.myRank >= 51 && r.myRank <= 100; }).length,
      catRows.filter(function (r) { return r.myRank >= 101 && r.myRank <= 200; }).length,
      catRows.filter(function (r) { return r.myRank > 200; }).length,
      catRows.filter(function (r) { return !r.myRank; }).length
    ];
    dash.getRange(row, 1).setValue(cat).setFontWeight('bold');
    dash.getRange(row, 2).setValue(catRows.length).setHorizontalAlignment('center');
    for (var i = 0; i < counts.length; i++) {
      var v = counts[i];
      var cell = dash.getRange(row, 3 + i).setValue(v).setHorizontalAlignment('center');
      var bg;
      if (i === 0)      bg = v === 0 ? '#f5f5f5' : v >= 8  ? '#FFD700' : v >= 4 ? '#fde68a' : '#fef3c7';
      else if (i === 1) bg = v === 0 ? '#f5f5f5' : v >= 10 ? '#16a34a' : v >= 5 ? '#86efac' : '#dcfce7';
      else if (i === 2) bg = v === 0 ? '#f5f5f5' : v >= 8  ? '#fef08a' : v >= 4 ? '#fef9c3' : '#fffbeb';
      else if (i === 3) bg = v === 0 ? '#f5f5f5' : v >= 8  ? '#fb923c' : v >= 4 ? '#fdba74' : '#fed7aa';
      else if (i === 4) bg = v === 0 ? '#f5f5f5' : v >= 8  ? '#dc2626' : v >= 4 ? '#f87171' : '#fecaca';
      else              bg = '#f5f5f5';
      cell.setBackground(bg);
      if ((i === 0 && v >= 8) || (i === 4 && v >= 8)) cell.setFontColor('#fff').setFontWeight('bold');
    }
    row += 1;
  });
  var totalRow = [
    'TOTAL', rows.length,
    rows.filter(function (r) { return r.myRank >= 1 && r.myRank <= 10; }).length,
    rows.filter(function (r) { return r.myRank >= 11 && r.myRank <= 50; }).length,
    rows.filter(function (r) { return r.myRank >= 51 && r.myRank <= 100; }).length,
    rows.filter(function (r) { return r.myRank >= 101 && r.myRank <= 200; }).length,
    rows.filter(function (r) { return r.myRank > 200; }).length,
    rows.filter(function (r) { return !r.myRank; }).length
  ];
  dash.getRange(row, 1, 1, 8).setValues([totalRow])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff').setHorizontalAlignment('center');
  row += 3;

  // Worst positions
  dash.getRange(row, 1).setValue('3. Top 40 worst positions (focus on improving)')
    .setFontWeight('bold').setFontSize(14).setBackground('#1a1a2e').setFontColor('#fff');
  dash.getRange(row, 1, 1, 8).merge().setHorizontalAlignment('left').setBackground('#1a1a2e');
  row += 1;
  var worstHeader = ['Category', 'Leaderboard', 'My Rank', 'My Score', '#1 Score', '% of #1', 'Gap pts vs #1', 'Gap pts vs #10'];
  dash.getRange(row, 1, 1, worstHeader.length).setValues([worstHeader])
    .setFontWeight('bold').setBackground('#444466').setFontColor('#fff').setHorizontalAlignment('center');
  row += 1;
  var worst = rows.filter(function (r) { return r.myRank; })
    .sort(function (a, b) { return b.myRank - a.myRank; })
    .slice(0, 40);
  var worstStartRow = row;
  worst.forEach(function (r) {
    var pct = (r.topScore && r.myScore) ? r.myScore / r.topScore : '';
    var gap1 = (r.topScore !== null && r.myScore !== null) ? Math.abs(r.topScore - r.myScore) : '';
    var gap10 = (r.score10 !== null && r.myScore !== null) ? Math.abs(r.score10 - r.myScore) : '';
    dash.getRange(row, 1, 1, 8).setValues([[r.category, r.leaderboard, r.myRank, r.myScore, r.topScore, pct, gap1, gap10]]);
    row += 1;
  });
  if (worst.length > 0) {
    dash.getRange(worstStartRow, 6, worst.length, 1).setNumberFormat('0.00%');
    applyIdleonFormatRange(dash, worstStartRow, 4, worst.length, 1);
    applyIdleonFormatRange(dash, worstStartRow, 5, worst.length, 1);
    applyIdleonFormatRange(dash, worstStartRow, 7, worst.length, 1);
    applyIdleonFormatRange(dash, worstStartRow, 8, worst.length, 1);
    dash.getRange(worstStartRow, 3, worst.length, 1).setHorizontalAlignment('center');
    for (var w = 0; w < worst.length; w++) {
      var rk = worst[w].myRank;
      var bg = rk > 500 ? '#dc2626' : rk > 200 ? '#f87171' : rk > 100 ? '#fb923c' : '#fde047';
      var fc = rk > 200 ? '#fff' : '#000';
      dash.getRange(worstStartRow + w, 3).setBackground(bg).setFontColor(fc).setFontWeight('bold');
    }
  }
  row += 2;

  // Quick wins
  dash.getRange(row, 1).setValue('4. Quick wins: closest to Top 10 (rank 11-50)')
    .setFontWeight('bold').setFontSize(14).setBackground('#1a1a2e').setFontColor('#fff');
  dash.getRange(row, 1, 1, 8).merge().setHorizontalAlignment('left').setBackground('#1a1a2e');
  row += 1;
  var qwHeader = ['Category', 'Leaderboard', 'My Rank', 'My Score', '#10 Score', 'Gap pts to top 10', '% of #10'];
  dash.getRange(row, 1, 1, qwHeader.length).setValues([qwHeader])
    .setFontWeight('bold').setBackground('#444466').setFontColor('#fff').setHorizontalAlignment('center');
  row += 1;
  var quickWins = rows.filter(function (r) {
    return r.myRank > 10 && r.myRank <= 50 && r.myScore !== null && r.score10 !== null;
  }).sort(function (a, b) { return a.myRank - b.myRank; });
  var qwStartRow = row;
  quickWins.forEach(function (r) {
    var gap = Math.abs(r.score10 - r.myScore);
    var pct = r.score10 ? r.myScore / r.score10 : '';
    dash.getRange(row, 1, 1, 7).setValues([[r.category, r.leaderboard, r.myRank, r.myScore, r.score10, gap, pct]]);
    row += 1;
  });
  if (quickWins.length > 0) {
    dash.getRange(qwStartRow, 7, quickWins.length, 1).setNumberFormat('0.00%');
    applyIdleonFormatRange(dash, qwStartRow, 4, quickWins.length, 1);
    applyIdleonFormatRange(dash, qwStartRow, 5, quickWins.length, 1);
    applyIdleonFormatRange(dash, qwStartRow, 6, quickWins.length, 1);
    dash.getRange(qwStartRow, 3, quickWins.length, 1).setHorizontalAlignment('center').setBackground('#9be8a4');
  }
  row += 2;

  // Best positions
  dash.getRange(row, 1).setValue('5. Your best positions (to celebrate)')
    .setFontWeight('bold').setFontSize(14).setBackground('#1a1a2e').setFontColor('#fff');
  dash.getRange(row, 1, 1, 8).merge().setHorizontalAlignment('left').setBackground('#1a1a2e');
  row += 1;
  var bestHeader = ['Category', 'Leaderboard', 'My Rank', 'My Score', '#1 Score', '% of #1'];
  dash.getRange(row, 1, 1, bestHeader.length).setValues([bestHeader])
    .setFontWeight('bold').setBackground('#444466').setFontColor('#fff').setHorizontalAlignment('center');
  row += 1;
  var best = rows.filter(function (r) { return r.myRank; })
    .sort(function (a, b) { return a.myRank - b.myRank; })
    .slice(0, 30);
  var bestStartRow = row;
  best.forEach(function (r) {
    var pct = (r.topScore && r.myScore) ? r.myScore / r.topScore : '';
    dash.getRange(row, 1, 1, 6).setValues([[r.category, r.leaderboard, r.myRank, r.myScore, r.topScore, pct]]);
    row += 1;
  });
  if (best.length > 0) {
    dash.getRange(bestStartRow, 6, best.length, 1).setNumberFormat('0.00%');
    applyIdleonFormatRange(dash, bestStartRow, 4, best.length, 1);
    applyIdleonFormatRange(dash, bestStartRow, 5, best.length, 1);
    dash.getRange(bestStartRow, 3, best.length, 1).setHorizontalAlignment('center');
    for (var b = 0; b < best.length; b++) {
      var bRk = best[b].myRank;
      var bg2 = bRk === 1 ? '#FFD700' : bRk === 2 ? '#C0C0C0' : bRk === 3 ? '#CD7F32'
        : bRk <= 10 ? '#90EE90' : '#dcfce7';
      dash.getRange(bestStartRow + b, 3).setBackground(bg2).setFontWeight('bold');
    }
  }

  dash.setColumnWidth(1, 110);
  dash.setColumnWidth(2, 220);
  dash.setColumnWidth(3, 90);
  dash.setColumnWidth(4, 140);
  dash.setColumnWidth(5, 140);
  dash.setColumnWidth(6, 110);
  dash.setColumnWidth(7, 140);
  dash.setColumnWidth(8, 140);
  dash.setHiddenGridlines(true);

  SpreadsheetApp.getActive().toast('Dashboard built', 'IT Leaderboards', 3);
}

// ------------------------------------------------------------------
// COMBO: refresh data + build dashboard in one click.
// Assign this to a Drawing button (Insert > Drawing > Assign script: refreshAndBuild)
// to get a single-click "update everything" button.
// ------------------------------------------------------------------
function refreshAndBuild() {
  refreshLeaderboards();
  buildDashboard();
  SpreadsheetApp.getActive().toast('Refreshed + Dashboard rebuilt', 'IT Leaderboards', 4);
}
