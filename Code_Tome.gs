/**
 * Idleon Tome Tracker (v1.0)
 *
 * Two tabs powered by IdleonToolbox public APIs:
 *  - Best Tome    : your points vs the highest observed per task (99.9% percentile)
 *  - Compare Tome : your points vs a friend's, side-by-side
 *
 * Config!B5 -> Player 1 name (you)
 * Config!B6 -> Player 2 name (for compare)
 *
 * APIs used:
 *  - https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=NAME
 *  - https://profiles.idleontoolbox.workers.dev/api/tome-percentiles
 *
 * Menu: "IT Tome"
 *  - Refresh everything   (fetches APIs + rebuilds both tabs)
 *  - Build Best Tome
 *  - Build Compare Tome
 *  - Reset Config layout
 *  - About
 */

var PROFILE_URL = 'https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=';
var PERCENTILES_URL = 'https://profiles.idleontoolbox.workers.dev/api/tome-percentiles';

var CFG_P1_CELL = 'B5';
var CFG_P2_CELL = 'B6';
var CFG_REFRESH_CELL = 'B7';

// 118 tome tasks in the EXACT order they appear in parsedData.tomePoints
var TOME_TASKS = [
  'Account LV',
  'Account Skills LV',
  'Total Talent Max LV',
  'Items Found',
  'Total Bubble LV',
  'Stamp Total LV',
  'Cards Total LV',
  'Statue Total LV',
  'Total Achievements Completed',
  'Unique Quests Completed',
  'Total Tasks Completed',
  'Vault Upgrade bonus LV',
  'Most Money held in Storage',
  'Most Spore Caps held in Inventory at once',
  'Total Colosseum Score',
  'Trophies Found',
  'Nametags Found',
  'Premium Hats Found',
  'Best Spiketrap Surprise round',
  'Tournaments Registrations',
  'Lava Dev Streams watched',
  'Total Minigame Highscore',
  'Total AFK Hours claimed',
  'DPS Record on Shimmer Island',
  'Total Arcade Gold Ball Shop Upgrade LV',
  'Most Balls earned from LBoFaF',
  'Jackpots Hit in Arcade',
  'Star Talent Points Owned',
  'Average kills for a Crystal Spawn',
  'Dungeon Rank',
  'Highest Drop Rate Multi',
  'Constellations Completed',
  'Unique Obols Found',
  'Total Vial LV',
  'Total Sigil LV',
  'Post Office PO Boxes Earned',
  'Highest Killroy Score on a Warrior',
  'Highest Killroy Score on an Archer',
  'Highest Killroy Score on a Mage',
  'Megafeathers Earned from Orion',
  'Megafish Earned from Poppy',
  'Megaflesh Earned from Bubba',
  'Fastest Time to kill Chaotic Efaunt (in Seconds)',
  'Largest Oak Log Printer Sample',
  'Largest Copper Ore Printer Sample',
  'Largest Spore Cap Printer Sample',
  'Largest Goldfish Printer Sample',
  'Largest Fly Printer Sample',
  'Total Best Wave in Worship',
  'Best Non Duplicate Goblin Gorefest Wave',
  'Total Prayer Upgrade LV',
  'Total Digits of all Deathnote Kills',
  'Most Giants Killed in a Single Week',
  'Total Refinery Rank',
  'Total Atom Upgrade LV',
  'Total Construct Buildings LV',
  'Equinox Clouds Completed',
  'Most Greenstacks in Storage',
  'Total Cooking Meals LV',
  'Total Kitchen Upgrade LV',
  'Highest Power Mob',
  'Fastest Time reaching Round 100 Arena (in Seconds)',
  'Total Shiny Mob LV',
  'Total Mob Breedability LV',
  'Total Lab Chips Owned',
  'Rift Levels Completed',
  'Total Onyx Statues',
  'Total Artifacts Found',
  'Total Boat Upgrade LV',
  'Gold Bar Sailing Treasure Owned',
  'Highest Captain LV',
  'Most Gaming Bits Owned',
  'Total Gaming Plants Evolved',
  'Best Gold Nugget',
  'Highest Immortal Snail LV',
  'Rat King Crowns Reclaimed',
  'God Rank in Divinity',
  'Fastest Time to Kill 200 Tremor Wurms (in Seconds)',
  'Total Opals Found',
  'Total LV of Cavern Villagers',
  'Total Digits of all Cavern Resources',
  'Total Resource Layers Destroyed',
  'Best Dawg Den score',
  'Best Bravery Monument Round',
  'Best Justice Monument Round',
  'Best Wisdom Monument Round',
  'Total Gambit Time (in Seconds)',
  'Best Pure Memory Round Reached',
  'Total Crops Discovered',
  'Total Golden Food Beanstacks',
  'Highest Crop OG',
  'Total Land Rank',
  'Largest Magic Bean Trade',
  'Farming Stickers Found',
  'Ninja Floors Unlocked',
  'Jade Emporium Upgrades Purchased',
  'Total Ninja Knowledge Upgrades LV',
  'Total Career Summoning Wins',
  'Total Summoning Upgrades LV',
  'Familiars Owned in Summoning',
  'Total Summoning Boss Stone victories',
  'Most DMG Dealt to Gravestone in a Weekly Battle',
  'Most Tottoise in Storage',
  'Best Deathbringer Max Damage in Wraith Mode',
  'Best Windwalker Max Damage in Tempest Mode',
  'Best Arcane Cultist Max Damage in Arcanist Mode',
  'Spirited Valley Emperor Boss Kills',
  'Total Coral Reef upgrades',
  'Total Spelunk Shop Upgrades LV',
  'Total Spelunk Discoveries made',
  'Deepest Depth reached in a single Delve',
  'Biggest Haul in a single Delve',
  'Highest leveled Spelunker',
  'Minehead Opponents Defeated',
  'Total Research Grid Upgrades',
  'Total Glimbo Trades',
  'Unique Sushi Created',
  'Button Presses'
];

// ------------------------------------------------------------------
// MENU
// ------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IT Tome')
    .addItem('Refresh everything', 'refreshEverything')
    .addItem('Build Best Tome', 'buildBestTome')
    .addItem('Build Compare Tome', 'buildCompareTome')
    .addSeparator()
    .addItem('Reset Config layout', 'setupConfigSheet')
    .addItem('About', 'showAbout')
    .addToUi();
}

function showAbout() {
  SpreadsheetApp.getUi().alert(
    'IT Tome Tracker v1.0',
    'Best Tome: your points vs highest observed (99.9% percentile) per task.\n' +
    'Compare Tome: your points vs a friend, side-by-side.\n\n' +
    'Player names live in Config!B5 (you) and Config!B6 (compare).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------
function fetchProfile(name) {
  if (!name) throw new Error('Player name is empty.');
  var url = PROFILE_URL + encodeURIComponent(name);
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) {
    throw new Error('Profile API error for ' + name + ': HTTP ' + r.getResponseCode());
  }
  var data = JSON.parse(r.getContentText());
  if (!data || !data.parsedData) {
    throw new Error('Bad profile response for ' + name + ' (no parsedData). Is the profile public?');
  }
  return data.parsedData;
}

function fetchTomePercentiles() {
  var r = UrlFetchApp.fetch(PERCENTILES_URL, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) {
    throw new Error('Percentiles API error: HTTP ' + r.getResponseCode());
  }
  var data = JSON.parse(r.getContentText());
  if (!data || !data.allPlayers) {
    throw new Error('Bad percentiles response.');
  }
  return data;
}

// ------------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------------
function ensureConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = ss.getSheetByName('Config');
  if (!cfg) {
    cfg = ss.insertSheet('Config', 0);
    setupConfigSheet();
    cfg = ss.getSheetByName('Config');
  }
  return cfg;
}

function setupConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName('Config');
  var p1 = '', p2 = '';
  if (old) {
    p1 = String(old.getRange(CFG_P1_CELL).getValue() || '').trim();
    p2 = String(old.getRange(CFG_P2_CELL).getValue() || '').trim();
    ss.deleteSheet(old);
  }
  var cfg = ss.insertSheet('Config', 0);
  cfg.setHiddenGridlines(true);
  cfg.setColumnWidth(1, 200);
  cfg.setColumnWidth(2, 300);
  cfg.setColumnWidth(3, 400);

  var r = 1;
  cfg.setRowHeight(r, 50);
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('IDLEON TOME TRACKER')
    .setBackground('#1a1a2e').setFontColor('#ffd700')
    .setFontSize(22).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  r += 1;
  cfg.setRowHeight(r, 26);
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('Best Tome vs top players + Compare Tome side-by-side')
    .setBackground('#1a1a2e').setFontColor('#cccccc').setFontStyle('italic')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  r += 2;

  // Section header
  cfg.setRowHeight(r, 32);
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('  PLAYERS')
    .setBackground('#2d3748').setFontColor('#fff').setFontSize(13).setFontWeight('bold')
    .setVerticalAlignment('middle');
  r += 1;

  cfg.getRange(r, 1).setValue('Player 1 (you)').setFontWeight('bold').setVerticalAlignment('middle');
  cfg.getRange(r, 2).setValue(p1 || 'ARKHE')
    .setBackground('#fff9c4').setFontSize(14).setFontWeight('bold').setFontColor('#1a1a2e')
    .setBorder(true, true, true, true, false, false, '#d4a017', SpreadsheetApp.BorderStyle.SOLID_THICK);
  cfg.setRowHeight(r, 32);
  r += 1;

  cfg.getRange(r, 1).setValue('Player 2 (compare)').setFontWeight('bold').setVerticalAlignment('middle');
  cfg.getRange(r, 2).setValue(p2 || 'Seavik')
    .setBackground('#fff9c4').setFontSize(14).setFontWeight('bold').setFontColor('#1a1a2e')
    .setBorder(true, true, true, true, false, false, '#d4a017', SpreadsheetApp.BorderStyle.SOLID_THICK);
  cfg.setRowHeight(r, 32);
  r += 1;

  cfg.getRange(r, 1).setValue('Last refresh').setFontWeight('bold').setVerticalAlignment('middle');
  cfg.getRange(r, 2).setValue('(updated by script after Refresh)').setFontColor('#777').setFontStyle('italic');
  cfg.setRowHeight(r, 24);
  r += 2;

  // How to use
  cfg.setRowHeight(r, 32);
  cfg.getRange(r, 1, 1, 3).merge()
    .setValue('  HOW TO USE')
    .setBackground('#2d3748').setFontColor('#fff').setFontSize(13).setFontWeight('bold')
    .setVerticalAlignment('middle');
  r += 1;
  var steps = [
    ['1', 'Approve the script', 'On first run, Google asks for permission. Allow it (script only reads idleontoolbox.com public API).'],
    ['2', 'Click "Refresh everything"', 'Menu: IT Tome > Refresh everything. Pulls both player profiles + percentiles, rebuilds both tabs.'],
    ['3', 'Browse the tabs', '"Best Tome": you vs top players. "Compare Tome": you vs Player 2.']
  ];
  steps.forEach(function (s) {
    cfg.getRange(r, 1).setValue(s[0]).setFontSize(16).setFontWeight('bold')
      .setFontColor('#3b82f6').setHorizontalAlignment('center').setVerticalAlignment('middle');
    cfg.getRange(r, 2).setValue(s[1]).setFontWeight('bold').setVerticalAlignment('middle');
    cfg.getRange(r, 3).setValue(s[2]).setWrap(true).setVerticalAlignment('middle');
    cfg.setRowHeight(r, 44);
    r += 1;
  });
}

// ------------------------------------------------------------------
// HELPERS
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
      var cur = currentFormats[i][j];
      if (cur && cur.indexOf('%') !== -1) return cur;
      return idleonFormat(v);
    });
  });
  range.setNumberFormats(formats);
}

function getPlayerNames() {
  var cfg = ensureConfig();
  var p1 = String(cfg.getRange(CFG_P1_CELL).getValue() || '').trim();
  var p2 = String(cfg.getRange(CFG_P2_CELL).getValue() || '').trim();
  if (!p1) throw new Error('Player 1 name is empty (Config!' + CFG_P1_CELL + ').');
  return { p1: p1, p2: p2 };
}

function setLastRefresh() {
  var cfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (!cfg) return;
  var p1 = String(cfg.getRange(CFG_P1_CELL).getValue() || '').trim();
  var p2 = String(cfg.getRange(CFG_P2_CELL).getValue() || '').trim();
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  cfg.getRange(CFG_REFRESH_CELL).setValue(p1 + ' vs ' + (p2 || '(none)') + '  -  ' + dateStr);
}

// ------------------------------------------------------------------
// REFRESH EVERYTHING
// ------------------------------------------------------------------
function refreshEverything() {
  var ui = SpreadsheetApp.getUi();
  try {
    buildBestTome();
    buildCompareTome();
    SpreadsheetApp.getActive().toast('All tabs refreshed', 'IT Tome', 4);
  } catch (e) {
    ui.alert('Refresh error', e.message + '\n\n' + (e.stack || ''), ui.ButtonSet.OK);
  }
}

// ------------------------------------------------------------------
// BEST TOME
// ------------------------------------------------------------------
function buildBestTome() {
  var ui = SpreadsheetApp.getUi();
  try {
    var names = getPlayerNames();
    var p1Data = fetchProfile(names.p1);
    var perc = fetchTomePercentiles();
    var myPoints = p1Data.tomePoints || [];
    if (myPoints.length === 0) {
      ui.alert('Best Tome', 'Player ' + names.p1 + ' has no tomePoints data.', ui.ButtonSet.OK);
      return;
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var old = ss.getSheetByName('Best Tome');
    if (old) ss.deleteSheet(old);
    var sh = ss.insertSheet('Best Tome', 1);
    sh.setHiddenGridlines(true);

    // Header
    var headers = ['#', 'Tome Task', 'My Pts', 'Top Pts (99.9%)', 'Diff to Top', '% of Top'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);

    var data = [];
    for (var i = 0; i < TOME_TASKS.length; i++) {
      var myPts = myPoints[i] || 0;
      var arr = perc.allPlayers[String(i)] || [];
      var topPts = arr.length > 0 ? arr[arr.length - 1] : 0;
      var diff = myPts - topPts;
      var pct = topPts > 0 ? myPts / topPts : '';
      data.push([i + 1, TOME_TASKS[i], myPts, topPts, diff, pct]);
    }
    sh.getRange(2, 1, data.length, headers.length).setValues(data);

    // Formatting
    sh.setColumnWidth(1, 50);
    sh.setColumnWidth(2, 320);
    sh.setColumnWidth(3, 120);
    sh.setColumnWidth(4, 150);
    sh.setColumnWidth(5, 130);
    sh.setColumnWidth(6, 100);

    // Idleon format for numeric columns
    applyIdleonFormatRange(sh, 2, 3, data.length, 1);  // My Pts
    applyIdleonFormatRange(sh, 2, 4, data.length, 1);  // Top Pts
    applyIdleonFormatRange(sh, 2, 5, data.length, 1);  // Diff
    sh.getRange(2, 6, data.length, 1).setNumberFormat('0.00%');

    sh.getRange(2, 1, data.length, 1).setHorizontalAlignment('center');

    // Conditional formatting on % of Top: red < 50%, yellow 50-90%, green >= 90%
    var pctRange = sh.getRange(2, 6, data.length, 1);
    var rules = [];
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(1).setBackground('#16a34a').setFontColor('#fff')
      .setRanges([pctRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(0.9, 0.9999).setBackground('#86efac')
      .setRanges([pctRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(0.5, 0.8999).setBackground('#fde047')
      .setRanges([pctRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0.5).setBackground('#fca5a5')
      .setRanges([pctRange]).build());
    sh.setConditionalFormatRules(rules);

    // Summary at top — total pts + global tome rank position
    var total = myPoints.reduce(function (a, b) { return a + (b || 0); }, 0);
    var topTotal = 0;
    for (var k = 0; k < TOME_TASKS.length; k++) {
      var pa = perc.allPlayers[String(k)] || [];
      if (pa.length > 0) topTotal += pa[pa.length - 1];
    }

    ss.toast('Best Tome built. My total: ' + total + ' / Max approx: ' + Math.round(topTotal), 'IT Tome', 5);
    setLastRefresh();
  } catch (e) {
    ui.alert('Best Tome error', e.message + '\n\n' + (e.stack || ''), ui.ButtonSet.OK);
  }
}

// ------------------------------------------------------------------
// COMPARE TOME
// ------------------------------------------------------------------
function buildCompareTome() {
  var ui = SpreadsheetApp.getUi();
  try {
    var names = getPlayerNames();
    if (!names.p2) {
      ui.alert('Compare Tome', 'Player 2 name is empty (Config!' + CFG_P2_CELL + ').', ui.ButtonSet.OK);
      return;
    }
    var p1Data = fetchProfile(names.p1);
    var p2Data = fetchProfile(names.p2);
    var p1 = p1Data.tomePoints || [];
    var p2 = p2Data.tomePoints || [];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var old = ss.getSheetByName('Compare Tome');
    if (old) ss.deleteSheet(old);
    var sh = ss.insertSheet('Compare Tome', 2);
    sh.setHiddenGridlines(true);

    var headers = ['#', 'Tome Task', names.p1 + ' Pts', names.p2 + ' Pts', 'Diff (P1 - P2)', 'Winner'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);

    var data = [];
    for (var i = 0; i < TOME_TASKS.length; i++) {
      var a = p1[i] || 0;
      var b = p2[i] || 0;
      var diff = a - b;
      var winner = diff > 0 ? names.p1 : diff < 0 ? names.p2 : 'tie';
      data.push([i + 1, TOME_TASKS[i], a, b, diff, winner]);
    }
    sh.getRange(2, 1, data.length, headers.length).setValues(data);

    sh.setColumnWidth(1, 50);
    sh.setColumnWidth(2, 320);
    sh.setColumnWidth(3, 130);
    sh.setColumnWidth(4, 130);
    sh.setColumnWidth(5, 140);
    sh.setColumnWidth(6, 140);

    applyIdleonFormatRange(sh, 2, 3, data.length, 1);
    applyIdleonFormatRange(sh, 2, 4, data.length, 1);
    applyIdleonFormatRange(sh, 2, 5, data.length, 1);

    sh.getRange(2, 1, data.length, 1).setHorizontalAlignment('center');
    sh.getRange(2, 6, data.length, 1).setHorizontalAlignment('center');

    // Color the Diff column: green if P1 ahead, red if P2 ahead
    var diffRange = sh.getRange(2, 5, data.length, 1);
    var winnerRange = sh.getRange(2, 6, data.length, 1);
    var rules = [];
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0).setBackground('#dcfce7').setFontColor('#16a34a')
      .setRanges([diffRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0).setBackground('#fee2e2').setFontColor('#dc2626')
      .setRanges([diffRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(names.p1).setBackground('#bbf7d0').setFontWeight('bold')
      .setRanges([winnerRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(names.p2).setBackground('#fecaca').setFontWeight('bold')
      .setRanges([winnerRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('tie').setBackground('#e5e7eb').setFontColor('#555')
      .setRanges([winnerRange]).build());
    sh.setConditionalFormatRules(rules);

    // Totals row
    var lastRow = data.length + 2;
    var totalP1 = p1.reduce(function (a, b) { return a + (b || 0); }, 0);
    var totalP2 = p2.reduce(function (a, b) { return a + (b || 0); }, 0);
    sh.getRange(lastRow, 2, 1, 4).setValues([['TOTAL', totalP1, totalP2, totalP1 - totalP2]])
      .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff');
    applyIdleonFormatRange(sh, lastRow, 3, 1, 3);

    var wins1 = data.filter(function (r) { return r[5] === names.p1; }).length;
    var wins2 = data.filter(function (r) { return r[5] === names.p2; }).length;
    var ties = data.filter(function (r) { return r[5] === 'tie'; }).length;
    sh.getRange(lastRow + 1, 2, 1, 4).setValues([['WINS', wins1, wins2, ties + ' ties']])
      .setFontWeight('bold').setBackground('#444466').setFontColor('#fff');

    ss.toast('Compare Tome built: ' + names.p1 + ' ' + wins1 + ' - ' + wins2 + ' ' + names.p2, 'IT Tome', 5);
    setLastRefresh();
  } catch (e) {
    ui.alert('Compare Tome error', e.message + '\n\n' + (e.stack || ''), ui.ButtonSet.OK);
  }
}
