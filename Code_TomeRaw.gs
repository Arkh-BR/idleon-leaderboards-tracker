/**
 * Tome Raw Values Extractor (v6.1)
 *
 * Ports IT's calcTomeQuantity logic. Outputs to "TOME RAW" tab.
 * v6.1 changes:
 *   - rawStarTalents now Math.ceil (round UP)
 *   - case 64 (Best Gold Nugget) reads raw.Gaming[8] (was: GamingSprout[2] array)
 *   - rawFarmingStickers reads OptLacc[140] (verified 87 vs ARKHE sheet)
 *
 * Coverage status per task (verified against ARKHE's sheet):
 *   GREEN  = computed from raw save (~115 of 118 tasks)
 *   BLUE   = fallback from leaderboards API
 *   RED    = still missing
 *
 * Menu: "Tome Raw" > "Build TOME RAW" or "About"
 */

var PROFILE_URL = 'https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=';
var LB_URL = 'https://profiles.idleontoolbox.workers.dev/api/leaderboards';

var TOME_TASKS = [
  'Account LV','Account Skills LV','Total Talent Max LV','Items Found',
  'Total Bubble LV','Stamp Total LV','Cards Total LV','Statue Total LV',
  'Total Achievements Completed','Unique Quests Completed','Total Tasks Completed',
  'Vault Upgrade bonus LV','Most Money held in Storage',
  'Most Spore Caps held in Inventory at once','Total Colosseum Score',
  'Trophies Found','Nametags Found','Premium Hats Found',
  'Best Spiketrap Surprise round','Tournaments Registrations',
  'Lava Dev Streams watched','Total Minigame Highscore','Total AFK Hours claimed',
  'DPS Record on Shimmer Island','Total Arcade Gold Ball Shop Upgrade LV',
  'Most Balls earned from LBoFaF','Jackpots Hit in Arcade','Star Talent Points Owned',
  'Average kills for a Crystal Spawn','Dungeon Rank','Highest Drop Rate Multi',
  'Constellations Completed','Unique Obols Found','Total Vial LV','Total Sigil LV',
  'Post Office PO Boxes Earned','Highest Killroy Score on a Warrior',
  'Highest Killroy Score on an Archer','Highest Killroy Score on a Mage',
  'Megafeathers Earned from Orion','Megafish Earned from Poppy',
  'Megaflesh Earned from Bubba','Fastest Time to kill Chaotic Efaunt (in Seconds)',
  'Largest Oak Log Printer Sample','Largest Copper Ore Printer Sample',
  'Largest Spore Cap Printer Sample','Largest Goldfish Printer Sample',
  'Largest Fly Printer Sample','Total Best Wave in Worship',
  'Best Non Duplicate Goblin Gorefest Wave','Total Prayer Upgrade LV',
  'Total Digits of all Deathnote Kills','Most Giants Killed in a Single Week',
  'Total Refinery Rank','Total Atom Upgrade LV','Total Construct Buildings LV',
  'Equinox Clouds Completed','Most Greenstacks in Storage','Total Cooking Meals LV',
  'Total Kitchen Upgrade LV','Highest Power Mob',
  'Fastest Time reaching Round 100 Arena (in Seconds)','Total Shiny Mob LV',
  'Total Mob Breedability LV','Total Lab Chips Owned','Rift Levels Completed',
  'Total Onyx Statues','Total Artifacts Found','Total Boat Upgrade LV',
  'Gold Bar Sailing Treasure Owned','Highest Captain LV','Most Gaming Bits Owned',
  'Total Gaming Plants Evolved','Best Gold Nugget','Highest Immortal Snail LV',
  'Rat King Crowns Reclaimed','God Rank in Divinity',
  'Fastest Time to Kill 200 Tremor Wurms (in Seconds)','Total Opals Found',
  'Total LV of Cavern Villagers','Total Digits of all Cavern Resources',
  'Total Resource Layers Destroyed','Best Dawg Den score',
  'Best Bravery Monument Round','Best Justice Monument Round',
  'Best Wisdom Monument Round','Total Gambit Time (in Seconds)',
  'Best Pure Memory Round Reached','Total Crops Discovered',
  'Total Golden Food Beanstacks','Highest Crop OG','Total Land Rank',
  'Largest Magic Bean Trade','Farming Stickers Found','Ninja Floors Unlocked',
  'Jade Emporium Upgrades Purchased','Total Ninja Knowledge Upgrades LV',
  'Total Career Summoning Wins','Total Summoning Upgrades LV',
  'Familiars Owned in Summoning','Total Summoning Boss Stone victories',
  'Most DMG Dealt to Gravestone in a Weekly Battle','Most Tottoise in Storage',
  'Best Deathbringer Max Damage in Wraith Mode',
  'Best Windwalker Max Damage in Tempest Mode',
  'Best Arcane Cultist Max Damage in Arcanist Mode',
  'Spirited Valley Emperor Boss Kills','Total Coral Reef upgrades',
  'Total Spelunk Shop Upgrades LV','Total Spelunk Discoveries made',
  'Deepest Depth reached in a single Delve','Biggest Haul in a single Delve',
  'Highest leveled Spelunker','Minehead Opponents Defeated',
  'Total Research Grid Upgrades','Total Glimbo Trades','Unique Sushi Created',
  'Button Presses'
];

// display_index -> compute_index  (from ninjaExtraInfo[32] in IT website-data)
var NEI32 = [5,11,3,65,22,0,2,1,7,4,6,81,8,9,53,10,107,109,12,113,106,75,13,14,80,79,25,15,16,17,18,19,21,23,24,26,27,28,29,85,86,108,30,31,32,33,34,35,37,36,76,38,54,40,41,42,39,44,50,48,46,47,49,51,52,45,55,60,57,61,62,66,59,64,63,111,58,56,93,84,83,92,91,87,88,89,82,94,68,69,67,77,78,112,72,74,99,71,70,73,96,20,43,90,100,101,95,97,103,104,98,102,105,110,114,115,116,117];

// Leaderboard fallback mapping per compute_index
var COMPUTE_LB_FALLBACK = {
  0: ['tasks','totalStamps'], 2: ['general','totalCards'],
  3: null, 4: null, 6: null, 10: null, 11: ['skills','totalSkillsLevels'],
  15: null, 17: null, 21: null, 22: ['tasks','totalBubbles'],
  23: ['general','totalVials'], 24: null, 37: ['general','totalWaves'],
  40: ['tasks','refinedSalts'], 42: null, 46: ['general','highestPowerPet'],
  48: null, 50: ['general','totalMeals'], 52: null, 57: ['general','totalBoats'],
  58: ['general','godRank'], 60: null, 62: null, 71: ['general','endlessSummoningWins'],
  76: null, 82: ['caverns','totalGambitTime'], 83: null, 84: null,
  87: ['caverns','bellRings'], 88: ['caverns','bellPings'],
  89: ['caverns','totalStringLevels'], 91: ['caverns','brokenJars'],
  92: ['caverns','totalLayersDestroyed'], 93: ['caverns','totalOpals'],
  96: null, 97: ['general','totalCoralKidUpgrades'],
  98: null, 99: null, 102: ['misc','biggestHaulSpelunking'],
  103: ['general','totalSpelunkingUpgrades'], 104: null,
  105: ['misc','highestSpelunkingPower'], 107: null, 108: ['misc','highestMegaFlesh'],
  109: null, 110: ['misc','mineheadOpponentsDefeated'], 111: null,
  112: null, 114: null, 115: ['misc','glimboTotalTrades'], 116: null
};

// ------------------------------------------------------------------
// HELPERS - raw save extractors
// ------------------------------------------------------------------
function arrSum(arr) { var s=0,i; for (i=0;i<(arr?arr.length:0);i++) s+= Number(arr[i])||0; return s; }
function arrMax(arr) { if (!arr || arr.length === 0) return 0; var m = -Infinity, i; for (i=0;i<arr.length;i++) { var v=Number(arr[i])||0; if (v>m) m=v; } return m === -Infinity ? 0 : m; }

function rawAccountLevel(data) {
  var total = 0, found = false, i;
  for (i = 0; i < 10; i++) {
    var lv = data['Lv0_' + i];
    if (lv && lv[0] !== undefined) { total += Number(lv[0]) || 0; found = true; }
  }
  return found ? total : null;
}
function rawAchievements(data) {
  var arr = data.AchieveReg; if (!arr) return null;
  var c = 0, i;
  for (i = 0; i < arr.length; i++) if (Number(arr[i]) === -1) c++;
  return c;
}
function rawUniqueQuests(data) {
  var seen = {}, count = 0, i;
  for (i = 0; i < 10; i++) {
    var qc = data['QuestComplete_' + i];
    if (qc && typeof qc === 'object') {
      var keys = Object.keys(qc), k;
      for (k = 0; k < keys.length; k++) {
        if (Number(qc[keys[k]]) === 1 && !seen[keys[k]]) {
          seen[keys[k]] = true; count++;
        }
      }
    }
  }
  return count;
}
function rawStatues(data) {
  var sl = data.StatueLevels_0; if (!sl) return null;
  var total = 0, i;
  for (i = 0; i < sl.length; i++) {
    if (Array.isArray(sl[i])) total += Number(sl[i][0]) || 0;
    else total += Number(sl[i]) || 0;
  }
  return total;
}
function rawOnyxStatues(data) {
  var sg = data.StuG; if (!sg) return null;
  var c = 0, i;
  for (i = 0; i < sg.length; i++) if ((Number(sg[i])||0) >= 2) c++;
  return c;
}
function rawColoScore(data) {
  var c = data.FamValColosseumHighscores; if (!c) return null;
  var total = 0, i;
  for (i = 0; i < c.length; i++) total += Number(c[i]) || 0;
  return total;
}
function rawCropsDiscovered(data) {
  var fc = data.FarmCrop;
  return (fc && typeof fc === 'object') ? Object.keys(fc).length : null;
}
function rawLandRank(data) { return data.FarmRank && data.FarmRank[0] ? arrSum(data.FarmRank[0]) : null; }
function rawArcade(data) { return arrSum(data.ArcadeUpg); }
function rawSummoningUpg(data) { return data.Summon && data.Summon[0] ? arrSum(data.Summon[0]) : null; }
function rawResearch(data) { return data.Research && data.Research[0] ? arrSum(data.Research[0]) : null; }
function rawStamps(data) {
  var sl = data.StampLv; if (!sl) return null;
  var total = 0, i;
  for (i = 0; i < sl.length; i++) {
    if (sl[i] && typeof sl[i] === 'object') {
      var keys = Object.keys(sl[i]), k;
      for (k = 0; k < keys.length; k++) total += Number(sl[i][keys[k]]) || 0;
    }
  }
  return total;
}

function rawTotalTasks(data) {
  var tz = data.TaskZZ1; if (!tz) return null;
  var total = 0, i, j;
  for (i = 0; i < tz.length; i++) {
    if (Array.isArray(tz[i])) {
      for (j = 0; j < Math.min(8, tz[i].length); j++) total += Number(tz[i][j]) || 0;
    }
  }
  return total;
}
function rawMeals(data) {
  var m = data.Meals;
  if (!m || !m[0]) return null;
  var s = 0, i;
  for (i = 0; i < m[0].length; i++) s += Number(m[0][i]) || 0;
  return s;
}
function rawConstellations(data) {
  var sp = data.SSprog; if (!sp) return null;
  if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch (e) { return null; } }
  if (!Array.isArray(sp)) return null;
  var s = 0, i;
  for (i = 0; i < sp.length; i++) {
    if (Array.isArray(sp[i]) && sp[i].length > 1) s += Number(sp[i][1]) || 0;
  }
  return s;
}
function rawLootyCount(data, pattern) {
  var c1 = data.Cards1; if (!Array.isArray(c1)) return null;
  var c = 0, i;
  for (i = 0; i < c1.length; i++) {
    if (String(c1[i] || '').indexOf(pattern) !== -1) c++;
  }
  return c;
}
function rawHatsTotal(data) {
  var sp = data.Spelunk; if (!Array.isArray(sp) || !sp[46]) return null;
  return sp[46].length || 0;
}
function rawMegaflesh(data) {
  var b = data.Bubba;
  if (Array.isArray(b) && Array.isArray(b[1]) && b[1].length > 8) return Number(b[1][8]);
  return null;
}

function rawHoles(data) { return Array.isArray(data.Holes) ? data.Holes : []; }
function rawExtraCalc(data, idx) {
  var h = rawHoles(data);
  if (h[11] && h[11][idx] !== undefined) return Number(h[11][idx]);
  return null;
}
function rawHolesSum(data, idx) {
  var h = rawHoles(data);
  if (Array.isArray(h[idx])) return arrSum(h[idx]);
  return null;
}
function rawSpelunk(data) { return Array.isArray(data.Spelunk) ? data.Spelunk : []; }
function rawSpelunkDiscoveries(data) {
  var s = rawSpelunk(data);
  return Array.isArray(s[6]) ? s[6].length : null;
}
function rawBestCave(data) {
  var s = rawSpelunk(data);
  return Array.isArray(s[1]) ? arrMax(s[1]) : null;
}
function rawSpelunkUpgrades(data) {
  var s = rawSpelunk(data);
  if (!Array.isArray(s[5])) return null;
  var sum = 0, i;
  for (i = 0; i < s[5].length; i++) sum += Math.max(0, Number(s[5][i]) || 0);
  return sum;
}
function rawRatKingCrowns(data) {
  var r = data.Research;
  if (Array.isArray(r) && Array.isArray(r[11])) return r[11].length;
  return null;
}
function rawCaptainMaxLv(data) {
  var c = data.Captains;
  if (!Array.isArray(c)) return null;
  var max = 0, i;
  for (i = 0; i < c.length; i++) {
    if (Array.isArray(c[i]) && c[i][0] !== -1 && c[i].length >= 4) {
      var v = Number(c[i][3]) || 0;
      if (v > max) max = v;
    }
  }
  return max;
}
function rawFamiliars(data) {
  var s = data.Summon;
  if (!Array.isArray(s) || !Array.isArray(s[4])) return null;
  var fo = 0, mult = 1, i;
  for (i = 0; i < s[4].length; i++) {
    fo += mult * (Number(s[4][i]) || 0);
    mult *= (i + 3);
  }
  return fo;
}
function rawSummoningWins(data) {
  var s = data.Summon;
  if (!Array.isArray(s) || !Array.isArray(s[1])) return null;
  var w = 0, i;
  for (i = 0; i < s[1].length; i++) {
    if (Array.isArray(s[1][i])) {
      var j;
      for (j = 0; j < s[1][i].length; j++) {
        var v = s[1][i][j];
        if (Array.isArray(v)) {
          var k;
          for (k = 0; k < v.length; k++) w += (Number(v[k]) === 1 ? 1 : 0);
        }
      }
    }
  }
  return w;
}
function rawKitchenLevels(data) {
  var ck = data.Cooking;
  if (!Array.isArray(ck)) return null;
  var s = 0, i;
  for (i = 0; i < ck.length; i++) {
    if (Array.isArray(ck[i]) && ck[i].length > 8) {
      s += (Number(ck[i][6]) || 0) + (Number(ck[i][7]) || 0) + (Number(ck[i][8]) || 0);
    }
  }
  return s;
}
function rawNinja(data) { return Array.isArray(data.Ninja) ? data.Ninja : []; }
function rawNinjaUpgrades(data) {
  var n = rawNinja(data);
  if (Array.isArray(n[103])) return arrSum(n[103]);
  return null;
}
function rawBeanstalk(data) {
  var n = rawNinja(data);
  if (Array.isArray(n[104])) return arrSum(n[104]);
  return null;
}
function rawJadeEmporium(data) {
  var n = rawNinja(data);
  if (Array.isArray(n[102]) && typeof n[102][9] === 'string') return n[102][9].length;
  return null;
}
function rawTowerSum(data) {
  var t = data.Tower;
  if (!Array.isArray(t)) return null;
  var s = 0, i;
  for (i = 0; i < Math.min(27, t.length); i++) {
    var v = Number(t[i]);
    if (!isNaN(v) && v < 1e6) s += Math.max(0, v);
  }
  return s;
}
function rawMinigameScore(data) {
  var m = data.FamValMinigameHiscores;
  if (!Array.isArray(m)) return null;
  var s = 0, i;
  for (i = 0; i < Math.min(5, m.length); i++) s += Number(m[i]) || 0;
  return s;
}
function rawSummoningStones(data) {
  var s = data.Summon;
  if (!Array.isArray(s) || !Array.isArray(s[3])) return null;
  return arrSum(s[3]);
}
function rawFarmingStickers(data) {
  // Verified via raw save scan: OptLacc[140] = 87 matches ARKHE sheet.
  var v = (data.OptLacc || [])[140];
  if (v !== undefined && v !== null) return Math.floor(Number(v));
  if (Array.isArray(data.FarmStick)) return data.FarmStick.length;
  return null;
}

function rawBoatsLevel(data) {
  var b = data.Boats;
  if (!Array.isArray(b)) return null;
  var s = 0, i;
  for (i = 0; i < b.length; i++) {
    if (Array.isArray(b[i]) && b[i][3] > 0 && b[i].length > 5) {
      s += (Number(b[i][3]) || 0) + (Number(b[i][5]) || 0);
    }
  }
  return s;
}
function rawArtifacts(data) {
  var s = data.Sailing;
  if (!Array.isArray(s) || !Array.isArray(s[3])) return null;
  return arrSum(s[3]);
}
function rawLabChips(data) {
  var l = data.Lab;
  if (!Array.isArray(l) || !Array.isArray(l[15])) return null;
  var s = 0, i;
  for (i = 0; i < l[15].length; i++) s += Math.max(0, Number(l[15][i]) || 0);
  return s;
}
function rawStorageCritter(data) {
  var co = data.ChestOrder, cq = data.ChestQuantity;
  if (!Array.isArray(co) || !Array.isArray(cq)) return null;
  var i;
  for (i = 0; i < co.length; i++) {
    if (co[i] === 'Critter11A') return Number(cq[i]) || 0;
  }
  return 0;
}
function rawSigils(data) {
  var cp = data.CauldronP2W;
  if (!Array.isArray(cp) || !Array.isArray(cp[4])) return null;
  var sd = cp[4], total = 0, i;
  for (i = 0; i < sd.length; i += 2) {
    var unlocked = sd[i + 1] !== undefined ? Number(sd[i + 1]) : 0;
    total += (unlocked + 1);
  }
  return total;
}
function rawEquinoxClouds(data) {
  var wb = data.WeeklyBoss;
  if (!wb || typeof wb !== 'object') return null;
  var keys = Object.keys(wb), c = 0, i;
  for (i = 0; i < keys.length; i++) {
    if (keys[i].indexOf('d_') === 0 && Number(wb[keys[i]]) === -1) c++;
  }
  return c;
}
function rawSkillsLevels(data) {
  var total = 0, c, i;
  for (c = 0; c < 10; c++) {
    var lv = data['Lv0_' + c];
    if (Array.isArray(lv)) {
      for (i = 1; i <= 20 && i < lv.length; i++) total += Number(lv[i]) || 0;
    }
  }
  return total > 0 ? total : null;
}

function rawPrayers(data) {
  var p = data.PrayOwned;
  if (!Array.isArray(p)) return null;
  var s = 0, i;
  for (i = 0; i < Math.min(19, p.length); i++) s += Number(p[i]) || 0;
  return s;
}
function rawTalentMaxLevel(data) {
  var maxes = {};
  var c, srcs = ['SL_', 'SM_'], si;
  for (c = 0; c < 10; c++) {
    for (si = 0; si < srcs.length; si++) {
      var sl = data[srcs[si] + c];
      if (sl && typeof sl === 'object') {
        var keys = Object.keys(sl), k;
        for (k = 0; k < keys.length; k++) {
          var v = Number(sl[keys[k]]) || 0;
          if (!maxes[keys[k]] || v > maxes[keys[k]]) maxes[keys[k]] = v;
        }
      }
    }
  }
  var total = 0, mk = Object.keys(maxes), j;
  for (j = 0; j < mk.length; j++) total += maxes[mk[j]];
  return total > 0 ? total : null;
}
function rawDeathNoteDigits(data) {
  var all = {};
  var c, i;
  for (c = 0; c < 10; c++) {
    var k = data['KLA_' + c];
    if (!Array.isArray(k)) continue;
    for (i = 0; i < k.length; i++) {
      var kills = 0;
      var v = k[i];
      if (Array.isArray(v) && v.length > 0) {
        kills = Math.abs(Number(v[0]) || 0);
      } else if (typeof v === 'number') {
        kills = Math.abs(v);
      }
      if (kills > 0) all[i] = (all[i] || 0) + kills;
    }
  }
  var digits = 0, kk = Object.keys(all), j;
  for (j = 0; j < kk.length; j++) {
    var x = all[kk[j]];
    if (x > 0) digits += Math.ceil(Math.log(x) / Math.LN10);
  }
  return digits > 0 ? digits : null;
}

// Hardcoded from IT website-data randomList[29]
var DUNGEON_LEVELS = [0,4,10,18,28,40,70,110,160,230,320,470,670,940,1310,1760,2400,3250,4000,5000,6160,8000,10000,12500,15000,18400,21000,25500,30500,36500,45400,52000,61000,72500,85000,110000,125000,145000,170000,200000,250000,275000,325000,400000,490000,600000,725000,875000,1000000,1200000,1500000,3000000,5000000,10000000,20000000,30000000,40000000,50000000,60000000,80000000,100000000,999999999,999999999,999999999,999999999,999999999,1999999999,1999999999,1999999999,1999999999,1999999999];
function rawDungeonRank(data) {
  var prog = (data.OptLacc || [])[71];
  if (prog === undefined || prog === null) return null;
  var rank = 0, i;
  for (i = 0; i < DUNGEON_LEVELS.length; i++) {
    if (prog > DUNGEON_LEVELS[i]) rank = i;
  }
  return rank + 1;
}
function rawStarTalents(data) {
  // From OptLacc[61] - game's earned-stars counter. ROUND UP (matches IT behavior).
  var v = (data.OptLacc || [])[61];
  return v !== undefined && v !== null ? Math.ceil(Number(v)) : null;
}

// ------------------------------------------------------------------
// MENU + API
// ------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Tome Raw')
    .addItem('Build TOME RAW', 'buildTomeRaw')
    .addSeparator()
    .addItem('About', 'showAbout').addToUi();
}
function showAbout() {
  SpreadsheetApp.getUi().alert('Tome Raw Extractor v6.1',
    'Ports IT calcTomeQuantity to Apps Script.\nOutputs to "TOME RAW" tab.\nPlayer: BEST TOME!A1',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function fetchProfile(name) {
  var r = UrlFetchApp.fetch(PROFILE_URL + encodeURIComponent(name), {muteHttpExceptions:true});
  if (r.getResponseCode() !== 200) throw new Error('Profile HTTP ' + r.getResponseCode());
  return JSON.parse(r.getContentText());
}
function fetchLB(cat, name) {
  var url = LB_URL + '?leaderboard=' + cat + '&leaderboardUser=' + encodeURIComponent(name);
  var r = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
  if (r.getResponseCode() !== 200) return {};
  return JSON.parse(r.getContentText());
}
function extractLBValue(entry, name) {
  if (!entry) return null;
  if (Array.isArray(entry)) {
    for (var i = 0; i < entry.length; i++) {
      if (String(entry[i].mainChar||'').toLowerCase() === String(name).toLowerCase()) { entry = entry[i]; break; }
    }
    if (Array.isArray(entry)) return null;
  }
  if (typeof entry !== 'object') return null;
  var keys = Object.keys(entry);
  for (var k = 0; k < keys.length; k++) if (keys[k]!=='mainChar' && keys[k]!=='rank') return entry[keys[k]];
  return null;
}

// ------------------------------------------------------------------
// MASTER EXTRACTOR  by compute index (0-117)
// ------------------------------------------------------------------
function computeRawValue(idx, data, pd, lbAll, playerName, srcOut) {
  var opt = data.OptLacc || [];
  function O(i) { srcOut.label = 'OptLacc['+i+']'; return opt[i] !== undefined ? Number(opt[i]) : null; }
  function R(label, val) { srcOut.label = label; return val; }
  function fallback() {
    var m = COMPUTE_LB_FALLBACK[idx];
    if (!m) return null;
    var entry = lbAll[m[0]] && lbAll[m[0]][m[1]];
    var v = extractLBValue(entry, playerName);
    if (v !== null) srcOut.label = 'LB:' + m[0] + '.' + m[1];
    return v;
  }

  switch (idx) {
    case 0: return R('raw.StampLv', rawStamps(data)) || fallback();
    case 1: return R('raw.StatueLevels_0', rawStatues(data));
    case 2: return fallback();
    case 3: var tl = rawTalentMaxLevel(data); return tl !== null ? R('max SL/SM per talent', tl) : fallback();
    case 4: return R('raw.QuestComplete', rawUniqueQuests(data));
    case 5: return R('raw.Lv0_X', rawAccountLevel(data));
    case 6: return R('raw.TaskZZ1 sum', rawTotalTasks(data));
    case 7: return R('raw.AchieveReg', rawAchievements(data));
    case 8: return O(198);
    case 9: return O(208);
    case 10: return R('raw.Cards1 Trophy', rawLootyCount(data, 'Trophy')) || fallback();
    case 11: var sk = rawSkillsLevels(data); return sk !== null ? R('sum Lv0_X[1..20]', sk) : fallback();
    case 12: return O(201);
    case 13: var t = data.TaskZZ0; return t && t[0] && t[0][2] !== undefined ? R('raw.TaskZZ0[0][2]', Number(t[0][2])) : null;
    case 14: return O(172);
    case 15: var st = rawStarTalents(data); return st !== null ? R('OptLacc[61] ceil', st) : fallback();
    case 16: var s16 = O(202); return s16 ? R('1/OptLacc[202]', 1/s16) : null;
    case 17: var dr = rawDungeonRank(data); return dr !== null ? R('OptLacc[71] vs dungeonLevels', dr) : fallback();
    case 18: return O(200);
    case 19: var c19 = rawConstellations(data); if (c19 !== null) return R('raw.SSprog sum done', c19); return fallback();
    case 20: return O(203);
    case 21: return R('raw.Cards1 Obol', rawLootyCount(data, 'Obol')) || fallback();
    case 22: return fallback();
    case 23: return fallback();
    case 24: var sg = rawSigils(data); return sg !== null ? R('CauldronP2W[4] sum', sg) : fallback();
    case 25: return O(199);
    case 26: var po = (Number(data.CYDeliveryBoxComplete)||0) + (Number(data.CYDeliveryBoxStreak)||0) + (Number(data.CYDeliveryBoxMisc)||0);
             return po > 0 ? R('raw.CYDeliveryBox*', po) : null;
    case 27: return O(204); case 28: return O(205); case 29: return O(206);
    case 30: var ef = O(207); return ef !== null ? R('1000 - OptLacc[207]', 1000 - ef) : null;
    case 31: return O(211); case 32: return O(212); case 33: return O(213);
    case 34: return O(214); case 35: return O(215);
    case 36: return O(209);
    case 37: return fallback();
    case 38: var dn = rawDeathNoteDigits(data); return dn !== null ? R('KLA_X log10 sum', dn) : fallback();
    case 39: var eq39 = rawEquinoxClouds(data); return eq39 !== null ? R('WeeklyBoss d_*==-1', eq39) : fallback();
    case 40: return fallback();
    case 41: return R('raw.Atoms', arrSum(data.Atoms));
    case 42: var tw42 = rawTowerSum(data); return tw42 !== null && tw42 > 0 ? R('Tower sum[0..26]', tw42) : fallback();
    case 43: var cs = rawStorageCritter(data); return cs !== null ? R('ChestOrder/Critter11A', cs) : fallback();
    case 44: return O(224);
    case 45: return data.Rift && data.Rift[0] !== undefined ? R('raw.Rift[0]', Number(data.Rift[0])) : null;
    case 46: return fallback();
    case 47: var rd = O(220); return rd !== null ? R('1000 - OptLacc[220]', 1000 - rd) : null;
    case 48: var kl = rawKitchenLevels(data); return kl !== null ? R('Cooking sum[6..8]', kl) : fallback();
    case 49: return pd && pd.totalShinyLevels !== undefined ? R('parsedData.totalShinyLevels', pd.totalShinyLevels) : fallback();
    case 50: var m50 = rawMeals(data); return m50 !== null ? R('raw.Meals[0] sum', m50) : fallback();
    case 51: return pd && pd.totalBreedabilityLevels !== undefined ? R('parsedData.totalBreedabilityLevels', pd.totalBreedabilityLevels) : fallback();
    case 52: var lc = rawLabChips(data); return lc !== null ? R('Lab[15] sum max(0)', lc) : fallback();
    case 53: return R('raw.FamValColosseumHighscores', rawColoScore(data));
    case 54: return O(217);
    case 55: return R('raw.StuG', rawOnyxStatues(data));
    case 56: var tw56 = O(218); return tw56 !== null ? R('1000 - OptLacc[218]', 1000 - tw56) : null;
    case 57: var bo = rawBoatsLevel(data); return bo !== null ? R('Boats b[3]+b[5]', bo) : fallback();
    case 58: return fallback();
    case 59: return fallback();
    case 60: var ar = rawArtifacts(data); return ar !== null ? R('Sailing[3] sum', ar) : fallback();
    case 61: var sl61 = data.Sailing && data.Sailing[2]; return sl61 ? R('raw.Sailing[2][0]', Number(sl61[0])) : null;
    case 62: var cl = rawCaptainMaxLv(data); return cl !== null ? R('max Captains[i][3]', cl) : fallback();
    case 63: var snl = (data.GamingSprout && Number(data.GamingSprout[8]||0)) || 0;
             var op210 = O(210) || 0;
             return R('max(GamingSprout[8], OptLacc[210])', Math.max(snl, op210));
    case 64: return data.Gaming && data.Gaming[8] !== undefined ? R('raw.Gaming[8]', Number(data.Gaming[8])) : null;
    case 65: return pd && pd.slab !== undefined ? R('parsedData.slab', pd.slab) : null;
    case 66: return data.Gaming && data.Gaming[0] !== undefined ? R('raw.Gaming[0]', Number(data.Gaming[0])) : fallback();
    case 67: var co67 = O(219); return co67 !== null ? R('2^OptLacc[219]', Math.pow(2, co67)) : null;
    case 68: return R('keys(FarmCrop)', rawCropsDiscovered(data));
    case 69: var bs = rawBeanstalk(data); return bs !== null ? R('Ninja[104] sum', bs) : null;
    case 70: return R('raw.Summon[0] sum', rawSummoningUpg(data));
    case 71: return fallback();
    case 72: var op72 = O(232); if (op72 && op72 > 0) return R('OptLacc[232]*12', op72*12);
             return null;
    case 73: var fm = rawFamiliars(data); return fm !== null ? R('Summon[4] reduce', fm) : null;
    case 74: var je = rawJadeEmporium(data); return je !== null ? R('Ninja[102][9].length', je) : null;
    case 75: var ms = rawMinigameScore(data); return ms !== null ? R('FamValMinigameHiscores sum[:5]', ms) : null;
    case 76: var pr = rawPrayers(data); return pr !== null ? R('sum PrayOwned[:19]', pr) : fallback();
    case 77: return R('raw.FarmRank[0] sum', rawLandRank(data));
    case 78: return O(221); case 79: return O(222);
    case 80: return R('raw.ArcadeUpg sum', rawArcade(data));
    case 81: return data.UpgVault && data.UpgVault[57] !== undefined ? R('raw.UpgVault[57]', Math.min(1500, Number(data.UpgVault[57]))) : null;
    case 82: return fallback();
    case 83: var hr = rawHolesSum(data, 9); return hr !== null ? R('Holes[9] sum', hr) : null;
    case 84: var hv = rawHolesSum(data, 1); return hv !== null ? R('Holes[1] sum', hv) : null;
    case 85: return O(262); case 86: return O(279);
    case 87: var b87 = rawExtraCalc(data, 73); return b87 !== null ? R('Holes[11][73]', b87) : fallback();
    case 88: var j88 = rawExtraCalc(data, 74); return j88 !== null ? R('Holes[11][74]', j88) : fallback();
    case 89: var w89 = rawExtraCalc(data, 75); return w89 !== null ? R('Holes[11][75]', w89) : fallback();
    case 90: return O(356);
    case 91: var dd = rawExtraCalc(data, 8); return dd !== null ? R('Holes[11][8]', dd) : fallback();
    case 92: return fallback(); case 93: return fallback();
    case 94: var sdv = O(353); return sdv !== null ? R('round(min(12,OptLacc[353])+1)', Math.round(Math.min(12, sdv) + 1)) : null;
    case 95: var em = O(369); return em !== null ? R('round(OptLacc[369])', Math.round(em)) : null;
    case 96: var ss96 = rawSummoningStones(data); return ss96 !== null ? R('Summon[3] sum', ss96) : null;
    case 97: return fallback();
    case 98: var bc = rawBestCave(data); return bc !== null ? R('max Spelunk[1]', bc) : null;
    case 99: var nu = rawNinjaUpgrades(data); return nu !== null ? R('Ninja[103] sum', nu) : null;
    case 100: return O(445); case 101: return O(446);
    case 102: return fallback();
    case 103: var su = rawSpelunkUpgrades(data); return su !== null ? R('sum max(0, Spelunk[5])', su) : fallback();
    case 104: var sd104 = rawSpelunkDiscoveries(data); return sd104 !== null ? R('Spelunk[6].length', sd104) : null;
    case 105: return fallback();
    case 106: return O(443);
    case 107: return R('raw.Cards1 EquipmentNametag', rawLootyCount(data, 'EquipmentNametag')) || fallback();
    case 108: var m108 = rawMegaflesh(data); return m108 !== null ? R('raw.Bubba[1][8]', m108) : fallback();
    case 109: var h109 = rawHatsTotal(data); return h109 !== null ? R('raw.Spelunk[46].length', h109) : null;
    case 110: return fallback();
    case 111: var rk = rawRatKingCrowns(data); return rk !== null ? R('Research[11].length', rk) : null;
    case 112: var fs = rawFarmingStickers(data); return fs !== null ? R('OptLacc[140]', fs) : null;
    case 113: return O(498);
    case 114: return R('raw.Research[0] sum', rawResearch(data));
    case 115: return fallback();
    case 116: var sushi = data.Sushi && data.Sushi[0]; if (sushi) {
              var c116 = 0, i116; for (i116 = 0; i116 < sushi.length; i116++) if (Number(sushi[i116]) > 0) c116++;
              return R('raw.Sushi[0] count>0', c116);
             } return null;
    case 117: return O(594);
    default: return null;
  }
}

// ------------------------------------------------------------------
// MAIN
// ------------------------------------------------------------------
function buildTomeRaw() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var bt = ss.getSheetByName('BEST TOME');
    var playerName = bt ? String(bt.getRange('A1').getValue() || '').trim() : '';
    if (!playerName) playerName = 'ARKHE';

    var profile = fetchProfile(playerName);
    var data = profile.data || {};
    var pd = profile.parsedData || {};
    var pts = pd.tomePoints || [];

    var cats = ['global','general','tasks','skills','character','misc','caverns'];
    var lbAll = {};
    cats.forEach(function(c) { lbAll[c] = fetchLB(c, playerName); Utilities.sleep(120); });

    var old = ss.getSheetByName('TOME RAW');
    if (old) ss.deleteSheet(old);
    var sh = ss.insertSheet('TOME RAW');

    sh.getRange(1, 1, 1, 6).setValues([['#','Tome Task','Raw Value','Pts','Source','Compute Idx']])
      .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);

    var rows = [], coveredRaw = 0, missingRaw = 0;
    for (var i = 0; i < TOME_TASKS.length; i++) {
      var ci = NEI32[i];
      var srcOut = { label: '' };
      var raw = null;
      try { raw = computeRawValue(ci, data, pd, lbAll, playerName, srcOut); }
      catch (e) { srcOut.label = 'ERR:' + (e.message || e); }
      var srcLabel = srcOut.label || 'MISSING';
      if (raw === null || raw === undefined || (typeof raw === 'number' && isNaN(raw))) {
        missingRaw++; srcLabel = 'MISSING';
      } else coveredRaw++;
      var ptsVal = (typeof pts[i] === 'number') ? pts[i] : null;
      rows.push([i+1, TOME_TASKS[i], raw, ptsVal, srcLabel, ci]);
    }
    sh.getRange(2, 1, rows.length, 6).setValues(rows);

    sh.setColumnWidth(1, 50); sh.setColumnWidth(2, 320);
    sh.setColumnWidth(3, 180); sh.setColumnWidth(4, 90);
    sh.setColumnWidth(5, 240); sh.setColumnWidth(6, 90);
    sh.getRange(2, 3, rows.length, 1).setNumberFormat('#,##0.##');
    sh.getRange(2, 4, rows.length, 1).setNumberFormat('#,##0');
    sh.getRange(2, 1, rows.length, 1).setHorizontalAlignment('center');
    sh.getRange(2, 6, rows.length, 1).setHorizontalAlignment('center');

    for (var r = 0; r < rows.length; r++) {
      var lbl = rows[r][4];
      var bg = '#dcfce7', fc = '#16a34a';
      if (lbl === 'MISSING') { bg = '#fee2e2'; fc = '#dc2626'; }
      else if (lbl.indexOf('LB:') === 0) { bg = '#dbeafe'; fc = '#1e40af'; }
      else if (lbl.indexOf('ERR') === 0) { bg = '#fef3c7'; fc = '#92400e'; }
      sh.getRange(2 + r, 5).setBackground(bg).setFontColor(fc);
    }

    ui.alert('TOME RAW built',
      'Player: ' + playerName + '\n' +
      'Raw values: ' + coveredRaw + ' / ' + rows.length + ' covered (' + missingRaw + ' missing)\n\n' +
      'Source legend:\n' +
      '  green = computed from raw save\n' +
      '  blue  = leaderboards API fallback\n' +
      '  red   = MISSING\n' +
      '  yellow= ERROR',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', (e && e.message ? e.message : String(e)) + '\n\n' + (e && e.stack ? e.stack : ''), ui.ButtonSet.OK);
  }
}
