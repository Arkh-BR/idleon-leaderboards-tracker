/**
 * Tome Raw Values Extractor (v7.7)
 *
 * Now with Pts column populated via tomeData + calcPointsPercent, plus
 * extractors for 7 more previously-MISSING tasks (worship waves, opals,
 * layers, gambit time, summoning wins, breedability, shiny levels).
 *
 * Flows:
 *   - "Paste data from IT (live)" - Lava raw save format, fresh data
 *   - "Build from public API (stale)" - pre-parsed by IT
 */

var PROFILE_URL = "https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=";
var LB_URL = "https://profiles.idleontoolbox.workers.dev/api/leaderboards";

var TOME_TASKS = ["Account LV","Account Skills LV","Total Talent Max LV","Items Found","Total Bubble LV","Stamp Total LV","Cards Total LV","Statue Total LV","Total Achievements Completed","Unique Quests Completed","Total Tasks Completed","Vault Upgrade bonus LV","Most Money held in Storage","Most Spore Caps held in Inventory at once","Total Colosseum Score","Trophies Found","Nametags Found","Premium Hats Found","Best Spiketrap Surprise round","Tournaments Registrations","Lava Dev Streams watched","Total Minigame Highscore","Total AFK Hours claimed","DPS Record on Shimmer Island","Total Arcade Gold Ball Shop Upgrade LV","Most Balls earned from LBoFaF","Jackpots Hit in Arcade","Star Talent Points Owned","Average kills for a Crystal Spawn","Dungeon Rank","Highest Drop Rate Multi","Constellations Completed","Unique Obols Found","Total Vial LV","Total Sigil LV","Post Office PO Boxes Earned","Highest Killroy Score on a Warrior","Highest Killroy Score on an Archer","Highest Killroy Score on a Mage","Megafeathers Earned from Orion","Megafish Earned from Poppy","Megaflesh Earned from Bubba","Fastest Time to kill Chaotic Efaunt (in Seconds)","Largest Oak Log Printer Sample","Largest Copper Ore Printer Sample","Largest Spore Cap Printer Sample","Largest Goldfish Printer Sample","Largest Fly Printer Sample","Total Best Wave in Worship","Best Non Duplicate Goblin Gorefest Wave","Total Prayer Upgrade LV","Total Digits of all Deathnote Kills","Most Giants Killed in a Single Week","Total Refinery Rank","Total Atom Upgrade LV","Total Construct Buildings LV","Equinox Clouds Completed","Most Greenstacks in Storage","Total Cooking Meals LV","Total Kitchen Upgrade LV","Highest Power Mob","Fastest Time reaching Round 100 Arena (in Seconds)","Total Shiny Mob LV","Total Mob Breedability LV","Total Lab Chips Owned","Rift Levels Completed","Total Onyx Statues","Total Artifacts Found","Total Boat Upgrade LV","Gold Bar Sailing Treasure Owned","Highest Captain LV","Most Gaming Bits Owned","Total Gaming Plants Evolved","Best Gold Nugget","Highest Immortal Snail LV","Rat King Crowns Reclaimed","God Rank in Divinity","Fastest Time to Kill 200 Tremor Wurms (in Seconds)","Total Opals Found","Total LV of Cavern Villagers","Total Digits of all Cavern Resources","Total Resource Layers Destroyed","Best Dawg Den score","Best Bravery Monument Round","Best Justice Monument Round","Best Wisdom Monument Round","Total Gambit Time (in Seconds)","Best Pure Memory Round Reached","Total Crops Discovered","Total Golden Food Beanstacks","Highest Crop OG","Total Land Rank","Largest Magic Bean Trade","Farming Stickers Found","Ninja Floors Unlocked","Jade Emporium Upgrades Purchased","Total Ninja Knowledge Upgrades LV","Total Career Summoning Wins","Total Summoning Upgrades LV","Familiars Owned in Summoning","Total Summoning Boss Stone victories","Most DMG Dealt to Gravestone in a Weekly Battle","Most Tottoise in Storage","Best Deathbringer Max Damage in Wraith Mode","Best Windwalker Max Damage in Tempest Mode","Best Arcane Cultist Max Damage in Arcanist Mode","Spirited Valley Emperor Boss Kills","Total Coral Reef upgrades","Total Spelunk Shop Upgrades LV","Total Spelunk Discoveries made","Deepest Depth reached in a single Delve","Biggest Haul in a single Delve","Highest leveled Spelunker","Minehead Opponents Defeated","Total Research Grid Upgrades","Total Glimbo Trades","Unique Sushi Created","Button Presses"];

var NEI32 = [5,11,3,65,22,0,2,1,7,4,6,81,8,9,53,10,107,109,12,113,106,75,13,14,80,79,25,15,16,17,18,19,21,23,24,26,27,28,29,85,86,108,30,31,32,33,34,35,37,36,76,38,54,40,41,42,39,44,50,48,46,47,49,51,52,45,55,60,57,61,62,66,59,64,63,111,58,56,93,84,83,92,91,87,88,89,82,94,68,69,67,77,78,112,72,74,99,71,70,73,96,20,43,90,100,101,95,97,103,104,98,102,105,110,114,115,116,117];

// tomeData [x1, x2, x3] indexed by compute_index (0-117). From IT website-data.json.
var TOME_BONUSES = [[10000,0,1000],[2300,0,600],[1344,2,1000],[12000,0,600],[323,2,500],[7000,0,1500],[470,2,470],[266,2,850],[25,1,500],[9,1,200],[22,2,700],[18000,0,1200],[13,2,100],[2000000,0,350],[20,1,350],[2500,0,200],[30,3,350],[30,0,250],[40,0,350],[49,2,300],[300000,0,200],[107,2,250],[1000000,4,1750],[962,2,600],[120,2,500],[4,2,80],[20000,0,300],[3000,0,200],[3000,0,200],[3000,0,200],[10,3,200],[9,1,400],[9,1,400],[9,1,300],[9,1,300],[9,1,300],[120,0,200],[1000,0,300],[700,0,600],[31,2,750],[120,0,450],[150,0,400],[4000,0,900],[5,1,150],[150,0,600],[49,2,500],[5,1,150],[50,3,180],[8000,0,200],[750,0,250],[5400,0,750],[500,2,200],[100,0,150],[10,1,200],[25,0,250],[28,2,450],[30,3,150],[10000,0,200],[10,0,200],[100000,0,200],[185,2,1000],[14,1,200],[25,0,150],[50,2,300],[9,1,200],[1800,2,1300],[80,1,400],[6,1,200],[120,2,350],[30,2,400],[10000,0,200],[160,0,500],[12,2,250],[600,0,150],[50,2,700],[450,2,100],[673,2,200],[5000,0,200],[1000,0,200],[1000,0,150],[6800,2,1200],[1200,2,1200],[3600,0,400],[500,0,750],[200,0,350],[12,0,250],[12,0,250],[50,0,250],[200,0,250],[18,2,250],[10,1,400],[7,1,250],[150,0,350],[500,0,400],[13,2,50],[100,2,400],[28,0,300],[37,2,400],[100,0,300],[5000,0,500],[10,1,400],[10,1,400],[25,1,300],[2000,0,500],[90,2,300],[200,0,200],[20,2,250],[20,2,700],[12,0,250],[75,2,700],[40,2,600],[100,2,400],[150,0,300],[365,2,365],[109,2,750],[1500,0,400],[54,2,800],[300,0,500]];

var COMPUTE_LB_FALLBACK = {0:["tasks","totalStamps"],2:["general","totalCards"],11:["skills","totalSkillsLevels"],22:["tasks","totalBubbles"],23:["general","totalVials"],37:["general","totalWaves"],40:["tasks","refinedSalts"],46:["general","highestPowerPet"],50:["general","totalMeals"],57:["general","totalBoats"],58:["general","godRank"],71:["general","endlessSummoningWins"],82:["caverns","totalGambitTime"],87:["caverns","bellRings"],88:["caverns","bellPings"],89:["caverns","totalStringLevels"],91:["caverns","brokenJars"],92:["caverns","totalLayersDestroyed"],93:["caverns","totalOpals"],97:["general","totalCoralKidUpgrades"],102:["misc","biggestHaulSpelunking"],103:["general","totalSpelunkingUpgrades"],105:["misc","highestSpelunkingPower"],108:["misc","highestMegaFlesh"],110:["misc","mineheadOpponentsDefeated"],115:["misc","glimboTotalTrades"]};

function arrSum(a){var s=0,i;for(i=0;i<(a?a.length:0);i++)s+=Number(a[i])||0;return s;}
function arrMax(a){if(!a||a.length===0)return 0;var m=-Infinity,i;for(i=0;i<a.length;i++){var v=Number(a[i])||0;if(v>m)m=v;}return m===-Infinity?0:m;}
function lavaLog(n){return Math.log(Math.max(n,1))/2.30259;}
function calcPointsPercent(b,q){if(!b)return 0;var x1=b[0],x2=b[1];if(x2===0){if(q<0)return 0;return Math.pow((1.7*q)/(q+x1),0.7);}else if(x2===1){return (2.4*lavaLog(q))/(2*lavaLog(q)+x1);}else if(x2===2){return Math.min(1,q/x1);}else if(x2===3){if(q>5*x1)return 0;return Math.pow((1.2*(6*x1-q))/(7*x1-q),5);}else if(x2===4){var mv=Math.min(x1,q);return Math.pow((2*mv)/(mv+x1),0.7);}return 0;}
function calcTomePts(computeIdx, quantity){var b=TOME_BONUSES[computeIdx];if(!b||quantity===null||quantity===undefined||isNaN(quantity))return null;var pct=calcPointsPercent(b,Number(quantity));if(!isFinite(pct)||pct<0)return 0;return Math.ceil(pct*b[2]);}

function rawAccountLevel(d){var t=0,f=false,i;for(i=0;i<10;i++){var lv=d["Lv0_"+i];if(lv&&lv[0]!==undefined){t+=Number(lv[0])||0;f=true;}}return f?t:null;}
function rawAchievements(d){var a=d.AchieveReg;if(!a||!Array.isArray(a))return null;var c=0,i;for(i=0;i<a.length;i++)if(Number(a[i])===-1)c++;return c;}
function rawUniqueQuests(d){var s={},c=0,i;for(i=0;i<10;i++){var qc=d["QuestComplete_"+i];if(qc&&typeof qc==="object"){var k=Object.keys(qc),j;for(j=0;j<k.length;j++){if(Number(qc[k[j]])===1&&!s[k[j]]){s[k[j]]=true;c++;}}}}return c>0?c:null;}
function rawStatues(d){var sl=d.StatueLevels_0;if(!sl||!Array.isArray(sl))return null;var t=0,i;for(i=0;i<sl.length;i++){if(Array.isArray(sl[i]))t+=Number(sl[i][0])||0;else t+=Number(sl[i])||0;}return t;}
function rawOnyxStatues(d){var sg=d.StuG;if(!sg)return null;var c=0,i;for(i=0;i<sg.length;i++)if((Number(sg[i])||0)>=2)c++;return c;}
function rawColoScore(d){var c=d.FamValColosseumHighscores;if(!c||!Array.isArray(c))return null;return arrSum(c);}
function rawCropsDiscovered(d){var fc=d.FarmCrop;return(fc&&typeof fc==="object")?Object.keys(fc).length:null;}
function rawLandRank(d){return d.FarmRank&&d.FarmRank[0]?arrSum(d.FarmRank[0]):null;}
function rawArcade(d){return d.ArcadeUpg?arrSum(d.ArcadeUpg):null;}
function rawSummoningUpg(d){return d.Summon&&d.Summon[0]?arrSum(d.Summon[0]):null;}
function rawResearch(d){return d.Research&&d.Research[0]?arrSum(d.Research[0]):null;}
function rawStamps(d){var sl=d.StampLv;if(!sl||!Array.isArray(sl))return null;var t=0,i;for(i=0;i<sl.length;i++){if(sl[i]&&typeof sl[i]==="object"){var k=Object.keys(sl[i]),j;for(j=0;j<k.length;j++)t+=Number(sl[i][k[j]])||0;}}return t;}
function rawTotalTasks(d){var tz=d.TaskZZ1;if(!tz||!Array.isArray(tz))return null;var t=0,i,j;for(i=0;i<tz.length;i++){if(Array.isArray(tz[i]))for(j=0;j<Math.min(8,tz[i].length);j++)t+=Number(tz[i][j])||0;}return t;}
function rawMeals(d){var m=d.Meals;if(!m||!m[0])return null;return arrSum(m[0]);}
function rawConstellations(d){var sp=d.SSprog;if(!sp)return null;if(typeof sp==="string"){try{sp=JSON.parse(sp);}catch(e){return null;}}if(!Array.isArray(sp))return null;var s=0,i;for(i=0;i<sp.length;i++){if(Array.isArray(sp[i])&&sp[i].length>1)s+=Number(sp[i][1])||0;}return s;}
function rawLootyCount(d,p){var c1=d.Cards1;if(!Array.isArray(c1))return null;var c=0,i;for(i=0;i<c1.length;i++){if(String(c1[i]||"").indexOf(p)!==-1)c++;}return c;}
function rawHatsTotal(d){var sp=d.Spelunk;if(!Array.isArray(sp)||!sp[46])return null;return sp[46].length||0;}
function rawMegaflesh(d){var b=d.Bubba;if(Array.isArray(b)&&Array.isArray(b[1])&&b[1].length>8)return Number(b[1][8]);return null;}
function rawHoles(d){return Array.isArray(d.Holes)?d.Holes:[];}
function rawExtraCalc(d,i){var h=rawHoles(d);if(h[11]&&h[11][i]!==undefined)return Number(h[11][i]);return null;}
function rawHolesSum(d,i){var h=rawHoles(d);if(Array.isArray(h[i]))return arrSum(h[i]);return null;}
function rawSpelunk(d){return Array.isArray(d.Spelunk)?d.Spelunk:[];}
function rawSpelunkDiscoveries(d){var s=rawSpelunk(d);return Array.isArray(s[6])?s[6].length:null;}
function rawBestCave(d){var s=rawSpelunk(d);return Array.isArray(s[1])?arrMax(s[1]):null;}
function rawSpelunkUpgrades(d){var s=rawSpelunk(d);if(!Array.isArray(s[5]))return null;var sum=0,i;for(i=0;i<s[5].length;i++)sum+=Math.max(0,Number(s[5][i])||0);return sum;}
function rawRatKingCrowns(d){var r=d.Research;if(Array.isArray(r)&&Array.isArray(r[11]))return r[11].length;return null;}
function rawCaptainMaxLv(d){var c=d.Captains;if(!Array.isArray(c))return null;var m=0,i;for(i=0;i<c.length;i++){if(Array.isArray(c[i])&&c[i][0]!==-1&&c[i].length>=4){var v=Number(c[i][3])||0;if(v>m)m=v;}}return m;}
function rawFamiliars(d){var s=d.Summon;if(!Array.isArray(s)||!Array.isArray(s[4]))return null;var fo=0,mult=1,i;for(i=0;i<s[4].length;i++){fo+=mult*(Number(s[4][i])||0);mult*=(i+3);}return fo;}
function rawKitchenLevels(d){var ck=d.Cooking;if(!Array.isArray(ck))return null;var s=0,i;for(i=0;i<ck.length;i++){if(Array.isArray(ck[i])&&ck[i].length>8){s+=(Number(ck[i][6])||0)+(Number(ck[i][7])||0)+(Number(ck[i][8])||0);}}return s;}
function rawNinja(d){return Array.isArray(d.Ninja)?d.Ninja:[];}
function rawNinjaUpgrades(d){var n=rawNinja(d);if(Array.isArray(n[103]))return arrSum(n[103]);return null;}
function rawBeanstalk(d){var n=rawNinja(d);if(Array.isArray(n[104]))return arrSum(n[104]);return null;}
function rawJadeEmporium(d){var n=rawNinja(d);if(Array.isArray(n[102])&&typeof n[102][9]==="string")return n[102][9].length;return null;}
function rawTowerSum(d){var t=d.Tower;if(!Array.isArray(t))return null;var s=0,i;for(i=0;i<Math.min(27,t.length);i++){var v=Number(t[i]);if(!isNaN(v)&&v<1e6)s+=Math.max(0,v);}return s;}
function rawMinigameScore(d){var m=d.FamValMinigameHiscores;if(!Array.isArray(m))return null;var s=0,i;for(i=0;i<Math.min(5,m.length);i++)s+=Number(m[i])||0;return s;}
function rawSummoningStones(d){var s=d.Summon;if(!Array.isArray(s)||!Array.isArray(s[3]))return null;return arrSum(s[3]);}
function rawFarmingStickers(d){var v=(d.OptLacc||[])[140];if(v!==undefined&&v!==null)return Math.floor(Number(v));if(Array.isArray(d.FarmStick))return d.FarmStick.length;return null;}
function rawBoatsLevel(d){var b=d.Boats;if(!Array.isArray(b))return null;var s=0,i;for(i=0;i<b.length;i++){if(Array.isArray(b[i])&&b[i][3]>0&&b[i].length>5){s+=(Number(b[i][3])||0)+(Number(b[i][5])||0);}}return s;}
function rawArtifacts(d){var s=d.Sailing;if(!Array.isArray(s)||!Array.isArray(s[3]))return null;return arrSum(s[3]);}
function rawLabChips(d){var l=d.Lab;if(!Array.isArray(l)||!Array.isArray(l[15]))return null;var s=0,i;for(i=0;i<l[15].length;i++)s+=Math.max(0,Number(l[15][i])||0);return s;}
function rawStorageCritter(d){var co=d.ChestOrder,cq=d.ChestQuantity;if(!Array.isArray(co)||!Array.isArray(cq))return null;var i;for(i=0;i<co.length;i++){if(co[i]==="Critter11A")return Number(cq[i])||0;}return 0;}
function rawSigils(d){var cp=d.CauldronP2W;if(!Array.isArray(cp)||!Array.isArray(cp[4]))return null;var sd=cp[4],t=0,i;for(i=0;i<sd.length;i+=2){var un=sd[i+1]!==undefined?Number(sd[i+1]):0;t+=(un+1);}return t;}
function rawEquinoxClouds(d){var wb=d.WeeklyBoss;if(!wb||typeof wb!=="object")return null;var k=Object.keys(wb),c=0,i;for(i=0;i<k.length;i++){if(k[i].indexOf("d_")===0&&Number(wb[k[i]])===-1)c++;}return c;}
function rawSkillsLevels(d){var t=0,c,i;for(c=0;c<10;c++){var lv=d["Lv0_"+c];if(Array.isArray(lv)){for(i=1;i<=20&&i<lv.length;i++)t+=Number(lv[i])||0;}}return t>0?t:null;}
function rawPrayers(d){var p=d.PrayOwned;if(!Array.isArray(p))return null;var s=0,i;for(i=0;i<Math.min(19,p.length);i++)s+=Number(p[i])||0;return s;}
function rawTalentMaxLevel(d){var mx={};var c,srcs=["SL_","SM_"],si;for(c=0;c<10;c++){for(si=0;si<srcs.length;si++){var sl=d[srcs[si]+c];if(sl&&typeof sl==="object"){var k=Object.keys(sl),j;for(j=0;j<k.length;j++){var v=Number(sl[k[j]])||0;if(!mx[k[j]]||v>mx[k[j]])mx[k[j]]=v;}}}}var t=0,mk=Object.keys(mx),i;for(i=0;i<mk.length;i++)t+=mx[mk[i]];return t>0?t:null;}
function rawDeathNoteDigits(d){var all={};var c,i;for(c=0;c<10;c++){var k=d["KLA_"+c];if(!Array.isArray(k))continue;for(i=0;i<k.length;i++){var kl=0;var v=k[i];if(Array.isArray(v)&&v.length>0)kl=Math.abs(Number(v[0])||0);else if(typeof v==="number")kl=Math.abs(v);if(kl>0)all[i]=(all[i]||0)+kl;}}var dg=0,kk=Object.keys(all),j;for(j=0;j<kk.length;j++){var x=all[kk[j]];if(x>0)dg+=Math.ceil(Math.log(x)/Math.LN10);}return dg>0?dg:null;}

var DUNGEON_LEVELS=[0,4,10,18,28,40,70,110,160,230,320,470,670,940,1310,1760,2400,3250,4000,5000,6160,8000,10000,12500,15000,18400,21000,25500,30500,36500,45400,52000,61000,72500,85000,110000,125000,145000,170000,200000,250000,275000,325000,400000,490000,600000,725000,875000,1000000,1200000,1500000,3000000,5000000,10000000,20000000,30000000,40000000,50000000,60000000,80000000,100000000,999999999,999999999,999999999,999999999,999999999,1999999999,1999999999,1999999999,1999999999,1999999999];
function rawDungeonRank(d){var p=(d.OptLacc||[])[71];if(p===undefined||p===null)return null;var r=0,i;for(i=0;i<DUNGEON_LEVELS.length;i++){if(p>DUNGEON_LEVELS[i])r=i;}return r+1;}
function rawStarTalents(d){var v=(d.OptLacc||[])[61];return v!==undefined&&v!==null?Math.ceil(Number(v)):null;}
function rawBubbleTotalLv(d){if(!d.CauldronInfo)return null;var t=0,i,ks,k,c;for(i=0;i<4&&i<d.CauldronInfo.length;i++){c=d.CauldronInfo[i];if(c&&typeof c==="object"){ks=Object.keys(c);for(k=0;k<ks.length;k++)t+=Number(c[ks[k]])||0;}}return t>0?t:null;}
function rawVialTotalLv(d){if(!d.CauldronInfo||!d.CauldronInfo[4])return null;var v=d.CauldronInfo[4],t=0,ks,k;if(typeof v==="object"){ks=Object.keys(v);for(k=0;k<ks.length;k++)t+=Number(v[ks[k]])||0;}return t>0?t:null;}
function rawRefineryRank(d){if(!Array.isArray(d.Refinery)||!Array.isArray(d.Refinery[0]))return null;var n=Math.min(6,Number(d.Refinery[0][0])||0);var r=0,i,s;for(i=0;i<n;i++){s=d.Refinery[3+i];if(Array.isArray(s))r+=Number(s[1])||0;}return r>0?r:null;}
function rawGodRank(d){if(!Array.isArray(d.Divinity)||d.Divinity[25]===undefined)return null;var v=Number(d.Divinity[25])-10;return Math.max(0,v);}
function rawItemsFound(d){return Array.isArray(d.Cards1)?d.Cards1.length:null;}

// v7.7 NEW extractors
function rawWorshipWaves(d){if(!Array.isArray(d.TotemInfo)||!Array.isArray(d.TotemInfo[0]))return null;return arrSum(d.TotemInfo[0]);}
function rawHoleOpals(d){if(!Array.isArray(d.Holes)||!Array.isArray(d.Holes[7]))return null;return arrSum(d.Holes[7]);}
function rawHoleLayers(d){if(!Array.isArray(d.Holes)||!Array.isArray(d.Holes[11]))return null;var ec=d.Holes[11];var s=0;[1,3,5,7].forEach(function(i){s+=Math.round(Math.max(0,Number(ec[i])||0));});return s;}
function rawGambitTime(d){if(!Array.isArray(d.Holes)||!Array.isArray(d.Holes[11]))return null;var sl=d.Holes[11].slice(65,71);var s=0,i;for(i=0;i<sl.length;i++)s+=Number(sl[i])||0;return Math.round(s);}
function rawCareerSummWins(d){if(!d.Summon||!Array.isArray(d.Summon[1]))return null;var wins=d.Summon[1].length;var endless=Number((d.OptLacc||[])[319])||0;return wins+endless;}
function rawBreedability(d){if(!d.Breeding||!Array.isArray(d.Breeding[7]))return null;return arrSum(d.Breeding[7]);}
function rawShinyLevels(d){if(!d.Breeding||!Array.isArray(d.Breeding[1]))return null;return arrSum(d.Breeding[1]);}
function rawCardsTotalLv(d){if(!d.Cards0||typeof d.Cards0!=="object")return null;var k=Object.keys(d.Cards0);return k.length>0?k.length:null;}

// v7.7 W7 + breeding extractors
function rawHighestPowerMob(d){var powers=[];if(Array.isArray(d.PetsStored))d.PetsStored.forEach(function(p){if(Array.isArray(p)&&p[2]!==undefined){var v=Number(p[2]);if(!isNaN(v)&&v>0)powers.push(v);}});if(Array.isArray(d.Breeding)&&Array.isArray(d.Breeding[3]))d.Breeding[3].forEach(function(v){var n=Number(v);if(!isNaN(n)&&n>0)powers.push(n);});return powers.length>0?Math.max.apply(null,powers):null;}
function rawCoralReefSum(d){if(!Array.isArray(d.Spelunk)||!Array.isArray(d.Spelunk[13]))return null;return arrSum(d.Spelunk[13]);}
function rawBiggestHaul(d){if(!Array.isArray(d.Spelunk)||!Array.isArray(d.Spelunk[2]))return null;var mx=0,i,v;for(i=0;i<d.Spelunk[2].length;i++){v=Number(d.Spelunk[2][i]);if(!isNaN(v)&&v>mx)mx=v;}return mx>0?mx:null;}
function rawSpelunkerLevel(d){var mx=0,i,lv,sk;for(i=0;i<10;i++){lv=d["Lv0_"+i];if(Array.isArray(lv)&&lv.length>19){sk=Number(lv[19])||0;if(sk>mx&&sk!==-1)mx=sk;}}return mx>0?mx:null;}
function rawMineheadOpponents(d){if(!Array.isArray(d.Research)||!Array.isArray(d.Research[7]))return null;var v=Number(d.Research[7][4]);return isNaN(v)?null:v;}
function rawGlimboTrades(d){if(!Array.isArray(d.Research)||!Array.isArray(d.Research[12]))return null;return arrSum(d.Research[12]);}

// Cards perTier table (rawName -> perTier) from IT website-data.json
var CARDS_PER_TIER = {"mushG":5,"mushR":10,"frogG":6,"beanG":7,"slimeG":8,"snakeG":9,"carrotO":10,"goblinG":10,"plank":10,"frogBIG":10,"poopSmall":10,"ratB":10,"branch":10,"acorn":10,"Crystal0":3,"mushW":10,"jarSand":10,"mimicA":10,"crabcake":10,"coconut":10,"sandcastle":10,"pincermin":10,"potato":10,"steak":10,"moonman":10,"sandgiant":10,"snailZ":10,"shovelR":10,"Crystal1":3,"Bandit_Bob":1,"Copper":10,"Iron":10,"Gold":10,"ForgeA":10,"OakTree":10,"BirchTree":10,"JungleTree":10,"ForestTree":10,"Fish1":10,"Fish2":10,"Fish3":10,"Bug1":10,"Bug2":10,"Plat":10,"Dementia":10,"Void":10,"Lustre":10,"ForgeB":10,"PalmTree":10,"ToiletTree":10,"StumpTree":10,"SaharanFoal":10,"Tree7":10,"AlienTree":10,"Tree8":10,"Fish4":10,"Fish5":8,"Fish6":10,"Fish7":10,"Fish8":10,"Bug3":10,"Bug4":10,"Bug5":10,"Bug6":10,"Bug7":10,"SoulCard1":3,"SoulCard2":3,"SoulCard3":3,"SoulCard4":4,"CritterCard1":4,"CritterCard2":4,"CritterCard3":4,"CritterCard4":4,"CritterCard5":4,"sheep":11,"flake":12,"stache":13,"bloque":14,"mamoth":15,"snowball":15,"penguin":15,"thermostat":15,"glass":17,"snakeB":17,"speaker":17,"eye":17,"ram":20,"skele":15,"skele2":15,"Crystal2":10,"Starfire":12,"Dreadlo":15,"Godshard":400,"Prehistrium":5000,"Tree9":12,"Tree10":15,"Tree12":15,"Tree13":15,"Tree14":1000,"Fish9":15,"Fish10":18,"Fish11":24,"Fish12":30,"Bug8":10,"Bug9":12,"Bug10":15,"Bug12":15,"Bug13":15,"Bug14":1000,"CritterCard6":5,"CritterCard7":6,"CritterCard8":7,"CritterCard9":9,"CritterCard10":12,"CritterCard11":50,"SoulCard5":5,"SoulCard6":7,"SoulCard7":7,"SoulCard8":250,"SpelunkingCard0":100,"SpelunkingCard1":300,"SpelunkingCard2":3000,"SpelunkingCard3":40000,"SpelunkingCard4":150000,"SpelunkingCard5":2500000,"mushP":15,"w4a2":17,"w4a3":18,"demonP":19,"w4b2":20,"w4b1":21,"w4b3":22,"w4b4":23,"w4b5":24,"w4c1":26,"w4c2":27,"w4c3":28,"w4c4":30,"Crystal3":10,"w5a1":25,"w5a2":28,"w5a3":32,"w5a4":35,"w5a5":45,"w5b1":48,"w5b2":52,"w5b3":60,"w5b4":65,"w5b5":70,"w5b6":75,"w5c1":80,"w5c2":100,"caveB":5000,"caveC":10000,"Crystal4":15,"w6a1":50,"w6a2":60,"w6a3":75,"w6a4":85,"w6a5":100,"w6b1":150,"w6b2":170,"w6b3":200,"w6b4":250,"w6c1":400,"w6c2":500,"w6d1":900,"w6d2":1300,"w6d3":2500,"Crystal5":5000,"w7a1":5000,"w7a2":7000,"w7a3":8500,"w7a4":11000,"w7a5":15000,"w7a6":25000,"w7a7":35000,"w7a8":65000,"w7a9":100000,"w7a10":150000,"w7a11":250000,"w7a12":400000,"w7b1":100000,"w7b2":300000,"w7b3":500000,"w7b4":900000,"w7b5":1500000,"w7b6":3500000,"w7b7":6000000,"w7b8":10000000,"w7b9":20000000,"w7b10":30000000,"w7b11":20000000,"w7b12":100000000,"Crystal6":2500000,"frogP":1.5,"frogD":2,"frogY":2,"frogR":2,"frogW":3,"frogGG":5,"frogGR":1.5,"frogGR2":1.5,"frogGR3":1.5,"frogGR4":1,"target":2,"rocky":2,"steakR":2,"totem":2,"cactus":2,"potatoB":5,"snakeZ":1.5,"snakeZ2":1.5,"snakeZ3":1.5,"iceknight":8,"iceBossZ":2,"iceBossZ2":1.5,"iceBossZ3":1.5,"slimeB":2,"babayaga":1.5,"poopBig":1.5,"poopD":1,"wolfA":1.5,"wolfB":1.5,"wolfC":10,"babaHour":1.5,"babaMummy":1.5,"Boss2A":1.5,"Boss2B":1.5,"Boss2C":11,"mini3a":5,"Boss3A":1.5,"Boss3B":1.5,"Boss3C":12,"mini4a":5,"Boss4A":2,"Boss4B":2,"Boss4C":4,"mini5a":4,"Boss5A":3,"Boss5B":4,"Boss5C":5,"mini6a":5,"Boss6A":6,"Boss6B":9,"Boss6C":13,"ghost":2,"xmasEvent":1.5,"xmasEvent2":1.5,"slimeR":2,"loveEvent":1.5,"loveEvent2":1.5,"loveEvent3":1.5,"sheepB":3,"snakeY":3,"EasterEvent1":1.5,"EasterEvent2":1.5,"shovelY":4,"crabcakeB":4,"SummerEvent1":8,"SummerEvent2":8,"xmasEvent3":1,"springEvent1":1,"springEvent2":1,"fallEvent1":3,"anni4Event1":4,"cropfallEvent1":6,"xmasEvent4":1,"luckEvent1":5,"luckEvent2":5,"anni5Event1":6};

function calcStars(tierReq, amount, name, maxStars, isInFiveStarList) {
  var lvl = 0;
  for (var i = 0; i < maxStars; i++) {
    if (name === "Boss3B") {
      if (amount > 1.5 * Math.pow(i+1 + Math.floor(i/3), 2)) lvl = i+2;
    } else {
      if (amount > tierReq * Math.pow(i+1 + (Math.floor(i/3) + (16*Math.floor(i/4) + 100*Math.floor(i/5))), 2)) lvl = i+2;
    }
  }
  if (isInFiveStarList && lvl < 6) return 5;
  return lvl > 0 ? lvl - 1 : lvl;
}

function rawCardsTotalLvProper(d) {
  if (!d.Cards0 || typeof d.Cards0 !== "object") return null;
  var rift = (d.Rift && d.Rift[0]) || 0;
  var maxStars = Math.round(4 + (rift >= 45 ? 1 : 0));
  var fiveStarRaw = String((d.OptLacc || [])[155] || "");
  var fiveStarList = fiveStarRaw ? fiveStarRaw.split(",") : [];
  var total = 0;
  var keys = Object.keys(d.Cards0);
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var amount = Number(d.Cards0[name]) || 0;
    if (amount <= 0) continue;
    var perTier = CARDS_PER_TIER[name];
    if (perTier === undefined) continue;
    var isFive = fiveStarList.indexOf(name) !== -1;
    var stars = calcStars(perTier, amount, name, maxStars, isFive);
    total += (stars + 1);
  }
  return total > 0 ? total : null;
}

function getShinyLevelFromProgress(p) {
  if (!p || p === 0) return 0;
  var sl = 0;
  for (var i = 0; i < 19; i++) {
    if (p > Math.floor((1 + Math.pow(i+1, 1.6)) * Math.pow(1.7, i+1))) sl = i+2;
  }
  return sl === 0 ? 1 : sl;
}

function rawShinyLevelsProper(d) {
  if (!d.Breeding) return null;
  var total = 0, w, p, arr, sl;
  for (w = 0; w < 4; w++) {
    arr = d.Breeding[22 + w];
    if (!Array.isArray(arr)) continue;
    for (p = 0; p < arr.length; p++) {
      sl = getShinyLevelFromProgress(Number(arr[p]) || 0);
      total += (sl === 0 ? 1 : sl);
    }
  }
  return total > 0 ? total : null;
}

function preparseLavaStrings(o){if(!o||typeof o!=="object")return o;var ks=Object.keys(o),i,k,v,c;for(i=0;i<ks.length;i++){k=ks[i];v=o[k];if(typeof v==="string"&&v.length>0){c=v.charAt(0);if(c==="["||c==="{"){try{o[k]=JSON.parse(v);}catch(e){}}}}return o;}

function onOpen(){SpreadsheetApp.getUi().createMenu("Tome Raw").addItem("Paste data from IT (live)","pasteJsonAndBuildTomeRaw").addItem("Build from public API (stale)","buildTomeRaw").addSeparator().addItem("About","showAbout").addToUi();}
function showAbout(){SpreadsheetApp.getUi().alert("Tome Raw Extractor v7.7","118/118 covered for paste flow (with Pts).",SpreadsheetApp.getUi().ButtonSet.OK);}

function pasteJsonAndBuildTomeRaw(){
  var html=HtmlService.createHtmlOutput(
    "<style>body{font-family:Arial;margin:0;padding:14px;background:#fafafa}h3{margin:0 0 6px 0;font-size:15px}p{margin:4px 0;font-size:12px;color:#555}textarea{width:100%;height:300px;box-sizing:border-box;font-family:monospace;font-size:10px;padding:6px;border:1px solid #ccc;border-radius:3px}.btn{background:#1a73e8;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:13px;margin-top:8px}.btn:hover{background:#1558b8}.btn:disabled{background:#9aa0a6;cursor:wait}.status{margin-top:8px;font-size:12px;color:#1a73e8;white-space:pre-wrap}</style>"+
    "<h3>Paste raw JSON from IdleonToolbox</h3>"+
    "<p>1. Open <b>idleontoolbox.com</b> logged in &rarr; user menu (top-right) &rarr; <b>Copy raw data</b></p>"+
    "<p>2. Paste below (Ctrl+V) and click <b>Build</b></p>"+
    "<textarea id=\"json\" placeholder=\"paste the full JSON here\"></textarea>"+
    "<button class=\"btn\" id=\"go\" onclick=\"go()\">Build TOME RAW</button>"+
    "<span class=\"status\" id=\"st\"></span>"+
    "<script>function go(){var t=document.getElementById('json').value;var b=document.getElementById('go');var s=document.getElementById('st');if(!t||t.length<100){s.textContent='JSON too short ('+t.length+' chars).';return}s.textContent='Sending '+t.length+' chars...';b.disabled=true;b.textContent='Working...';google.script.run.withSuccessHandler(function(r){s.textContent=r;b.textContent='Done!';setTimeout(function(){google.script.host.close()},4000)}).withFailureHandler(function(e){s.textContent='Error: '+e.message;b.disabled=false;b.textContent='Build TOME RAW'}).processPastedJson(t)}</script>"
  ).setWidth(620).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html,"Build TOME RAW from pasted IT data");
}

function processPastedJson(jsonText){
  var data;try{data=JSON.parse(jsonText);}catch(e){throw new Error("Invalid JSON: "+e.message);}
  if(!data||typeof data!=="object")throw new Error("Not an object");
  var diag="input "+Object.keys(data).length+" fields";
  if(Object.keys(data).length<50){
    if(data.data&&typeof data.data==="object"&&Object.keys(data.data).length>100){data=data.data;diag+=" [unwrap .data]";}
    else if(data.profileData&&typeof data.profileData==="object"){data=data.profileData;diag+=" [unwrap .profileData]";}
  }
  data=preparseLavaStrings(data);
  diag+=", AchieveReg="+(Array.isArray(data.AchieveReg)?"arr["+data.AchieveReg.length+"]":typeof data.AchieveReg);
  return _buildSheet(data,{},"Player",diag);
}

function _buildSheet(data,pd,playerName,diagPrefix){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var bt=ss.getSheetByName("BEST TOME");
  if(bt){var pn=String(bt.getRange("A1").getValue()||"").trim();if(pn)playerName=pn;}
  var lbAll={global:{},general:{},tasks:{},skills:{},character:{},misc:{},caverns:{}};
  var sh=ss.getSheetByName("TOME RAW");
  if(!sh)sh=ss.insertSheet("TOME RAW");
  else{var lr=Math.max(sh.getLastRow(),1);sh.getRange(1,1,lr,6).clearContent().clearFormat();}
  sh.getRange(1,1,1,6).setValues([["#","Tome Task","Raw Value","Pts","Source","Compute Idx"]])
    .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#fff").setHorizontalAlignment("center");
  sh.setFrozenRows(1);
  var rows=[],cov=0,miss=0,totalPts=0;
  for(var i=0;i<TOME_TASKS.length;i++){
    var ci=NEI32[i];
    var srcOut={label:""};
    var raw=null;
    try{raw=computeRawValue(ci,data,pd,lbAll,playerName,srcOut);}catch(e){srcOut.label="ERR:"+(e.message||e);}
    var sl=srcOut.label||"MISSING";
    var pts=null;
    if(raw===null||raw===undefined||(typeof raw==="number"&&isNaN(raw))){miss++;sl="MISSING";}
    else{cov++;pts=calcTomePts(ci,raw);if(typeof pts==="number")totalPts+=pts;}
    rows.push([i+1,TOME_TASKS[i],raw,pts,sl,ci]);
  }
  sh.getRange(2,1,rows.length,6).setValues(rows);
  sh.setColumnWidth(1,50);sh.setColumnWidth(2,320);sh.setColumnWidth(3,180);sh.setColumnWidth(4,90);sh.setColumnWidth(5,240);sh.setColumnWidth(6,90);
  sh.getRange(2,3,rows.length,1).setNumberFormat("#,##0.##");
  sh.getRange(2,4,rows.length,1).setNumberFormat("#,##0");
  sh.getRange(2,1,rows.length,1).setHorizontalAlignment("center");
  sh.getRange(2,6,rows.length,1).setHorizontalAlignment("center");
  for(var r=0;r<rows.length;r++){
    var lbl=rows[r][4];
    var bg="#dcfce7",fc="#16a34a";
    if(lbl==="MISSING"){bg="#fee2e2";fc="#dc2626";}
    else if(lbl.indexOf("LB:")===0){bg="#dbeafe";fc="#1e40af";}
    else if(lbl.indexOf("ERR")===0){bg="#fef3c7";fc="#92400e";}
    sh.getRange(2+r,5).setBackground(bg).setFontColor(fc);
  }
  return "Done. "+cov+"/"+rows.length+" covered, totalPts="+totalPts+". "+diagPrefix;
}

function fetchProfile(n){var r=UrlFetchApp.fetch(PROFILE_URL+encodeURIComponent(n),{muteHttpExceptions:true});if(r.getResponseCode()!==200)throw new Error("HTTP "+r.getResponseCode());return JSON.parse(r.getContentText());}
function fetchLB(c,n){var u=LB_URL+"?leaderboard="+c+"&leaderboardUser="+encodeURIComponent(n);var r=UrlFetchApp.fetch(u,{muteHttpExceptions:true});if(r.getResponseCode()!==200)return{};return JSON.parse(r.getContentText());}
function extractLBValue(e,n){if(!e)return null;if(Array.isArray(e)){for(var i=0;i<e.length;i++){if(String(e[i].mainChar||"").toLowerCase()===String(n).toLowerCase()){e=e[i];break;}}if(Array.isArray(e))return null;}if(typeof e!=="object")return null;var k=Object.keys(e);for(var j=0;j<k.length;j++)if(k[j]!=="mainChar"&&k[j]!=="rank")return e[k[j]];return null;}

function computeRawValue(idx,data,pd,lbAll,playerName,srcOut){
  var opt=data.OptLacc||[];
  function O(i){srcOut.label="OptLacc["+i+"]";return opt[i]!==undefined?Number(opt[i]):null;}
  function R(lab,val){srcOut.label=lab;return val;}
  function fallback(){var m=COMPUTE_LB_FALLBACK[idx];if(!m)return null;var e=lbAll[m[0]]&&lbAll[m[0]][m[1]];var v=extractLBValue(e,playerName);if(v!==null)srcOut.label="LB:"+m[0]+"."+m[1];return v;}
  switch(idx){
    case 0: return R("raw.StampLv",rawStamps(data))||fallback();
    case 1: return R("raw.StatueLevels_0",rawStatues(data));
    case 2: var c2=rawCardsTotalLvProper(data);return c2!==null?R("sum(stars+1) per card",c2):fallback();
    case 3: var tl=rawTalentMaxLevel(data);return tl!==null?R("max SL/SM per talent",tl):fallback();
    case 4: return R("raw.QuestComplete",rawUniqueQuests(data));
    case 5: return R("raw.Lv0_X",rawAccountLevel(data));
    case 6: return R("raw.TaskZZ1 sum",rawTotalTasks(data));
    case 7: return R("raw.AchieveReg",rawAchievements(data));
    case 8: return O(198); case 9: return O(208);
    case 10: return R("raw.Cards1 Trophy",rawLootyCount(data,"Trophy"))||fallback();
    case 11: var sk=rawSkillsLevels(data);return sk!==null?R("sum Lv0_X[1..20]",sk):fallback();
    case 12: return O(201);
    case 13: var t=data.TaskZZ0;return t&&t[0]&&t[0][2]!==undefined?R("raw.TaskZZ0[0][2]",Number(t[0][2])):null;
    case 14: return O(172);
    case 15: var st=rawStarTalents(data);return st!==null?R("OptLacc[61] ceil",st):fallback();
    case 16: var s16=O(202);return s16?R("1/OptLacc[202]",1/s16):null;
    case 17: var dr=rawDungeonRank(data);return dr!==null?R("OptLacc[71] vs dungeonLevels",dr):fallback();
    case 18: return O(200);
    case 19: var c19=rawConstellations(data);if(c19!==null)return R("raw.SSprog sum done",c19);return fallback();
    case 20: return O(203);
    case 21: return R("raw.Cards1 Obol",rawLootyCount(data,"Obol"))||fallback();
    case 22: var bl=rawBubbleTotalLv(data);return bl!==null?R("CauldronInfo[0..3] sum",bl):fallback();
    case 23: var vl=rawVialTotalLv(data);return vl!==null?R("CauldronInfo[4] sum",vl):fallback();
    case 24: var sg=rawSigils(data);return sg!==null?R("CauldronP2W[4] sum",sg):fallback();
    case 25: return O(199);
    case 26: var po=(Number(data.CYDeliveryBoxComplete)||0)+(Number(data.CYDeliveryBoxStreak)||0)+(Number(data.CYDeliveryBoxMisc)||0);return po>0?R("raw.CYDeliveryBox*",po):null;
    case 27: return O(204); case 28: return O(205); case 29: return O(206);
    case 30: var ef=O(207);return ef!==null?R("1000 - OptLacc[207]",1000-ef):null;
    case 31: return O(211); case 32: return O(212); case 33: return O(213);
    case 34: return O(214); case 35: return O(215);
    case 36: return O(209);
    case 37: var ww=rawWorshipWaves(data);return ww!==null?R("sum TotemInfo[0]",ww):fallback();
    case 38: var dn=rawDeathNoteDigits(data);return dn!==null?R("KLA_X log10 sum",dn):fallback();
    case 39: var eq=rawEquinoxClouds(data);return eq!==null?R("WeeklyBoss d_*==-1",eq):fallback();
    case 40: var rr=rawRefineryRank(data);return rr!==null?R("Refinery salts[0..5].rank sum",rr):fallback();
    case 41: return R("raw.Atoms",arrSum(data.Atoms));
    case 42: var tw=rawTowerSum(data);return tw!==null&&tw>0?R("Tower sum[0..26]",tw):fallback();
    case 43: var cs=rawStorageCritter(data);return cs!==null?R("ChestOrder/Critter11A",cs):fallback();
    case 44: return O(224);
    case 45: return data.Rift&&data.Rift[0]!==undefined?R("raw.Rift[0]",Number(data.Rift[0])):null;
    case 46: var hp=rawHighestPowerMob(data);return hp!==null?R("max powers PetsStored+Breeding[3]",hp):fallback();
    case 47: var rd=O(220);return rd!==null?R("1000 - OptLacc[220]",1000-rd):null;
    case 48: var kl=rawKitchenLevels(data);return kl!==null?R("Cooking sum[6..8]",kl):fallback();
    case 49: var sh49=rawShinyLevelsProper(data);return sh49!==null?R("sum getShinyLevel per pet",sh49):(pd&&pd.totalShinyLevels!==undefined?R("parsedData.totalShinyLevels",pd.totalShinyLevels):fallback());
    case 50: var m50=rawMeals(data);return m50!==null?R("raw.Meals[0] sum",m50):fallback();
    case 51: var br=rawBreedability(data);return br!==null?R("Breeding[7] sum",br):(pd&&pd.totalBreedabilityLevels!==undefined?R("parsedData.totalBreedabilityLevels",pd.totalBreedabilityLevels):fallback());
    case 52: var lc=rawLabChips(data);return lc!==null?R("Lab[15] sum max(0)",lc):fallback();
    case 53: return R("raw.FamValColosseumHighscores",rawColoScore(data));
    case 54: return O(217);
    case 55: return R("raw.StuG",rawOnyxStatues(data));
    case 56: var tw56=O(218);return tw56!==null?R("1000 - OptLacc[218]",1000-tw56):null;
    case 57: var bo=rawBoatsLevel(data);return bo!==null?R("Boats b[3]+b[5]",bo):fallback();
    case 58: var gr=rawGodRank(data);return gr!==null?R("Divinity[0..10] sum",gr):fallback();
    case 59: var gs28=data.GamingSprout&&data.GamingSprout[28];return gs28&&gs28[1]!==undefined?R("raw.GamingSprout[28][1]",Number(gs28[1])):null;
    case 60: var ar=rawArtifacts(data);return ar!==null?R("Sailing[3] sum",ar):fallback();
    case 61: var sl61=data.Sailing&&data.Sailing[1];return sl61?R("raw.Sailing[1][0] (lootPile)",Number(sl61[0])):null;
    case 62: var cl=rawCaptainMaxLv(data);return cl!==null?R("max Captains[i][3]",cl):fallback();
    case 63: var snl=(data.GamingSprout&&Number(data.GamingSprout[8]||0))||0;var op210=O(210)||0;return R("max(GamingSprout[8],OptLacc[210])",Math.max(snl,op210));
    case 64: return data.Gaming&&data.Gaming[8]!==undefined?R("raw.Gaming[8]",Number(data.Gaming[8])):null;
    case 65: if(pd&&pd.slab!==undefined)return R("parsedData.slab",pd.slab);var it65=rawItemsFound(data);return it65!==null?R("Cards1.length (lootyRaw)",it65):null;
    case 66: return data.Gaming&&data.Gaming[0]!==undefined?R("raw.Gaming[0]",Number(data.Gaming[0])):fallback();
    case 67: var co67=O(219);return co67!==null?R("2^OptLacc[219]",Math.pow(2,co67)):null;
    case 68: return R("keys(FarmCrop)",rawCropsDiscovered(data));
    case 69: var bs=rawBeanstalk(data);return bs!==null?R("Ninja[104] sum",bs):null;
    case 70: return R("raw.Summon[0] sum",rawSummoningUpg(data));
    case 71: var sw=rawCareerSummWins(data);return sw!==null?R("Summon[1].length+OptLacc[319]",sw):fallback();
    case 72: var op72=O(232);if(op72&&op72>0)return R("OptLacc[232]*12",op72*12);return null;
    case 73: var fm=rawFamiliars(data);return fm!==null?R("Summon[4] reduce",fm):null;
    case 74: var je=rawJadeEmporium(data);return je!==null?R("Ninja[102][9].length",je):null;
    case 75: var ms=rawMinigameScore(data);return ms!==null?R("FamValMinigameHiscores sum[:5]",ms):null;
    case 76: var pr=rawPrayers(data);return pr!==null?R("sum PrayOwned[:19]",pr):fallback();
    case 77: return R("raw.FarmRank[0] sum",rawLandRank(data));
    case 78: return O(221); case 79: return O(222);
    case 80: return R("raw.ArcadeUpg sum",rawArcade(data));
    case 81: return data.UpgVault&&data.UpgVault[57]!==undefined?R("min(1500,UpgVault[57]*2)",Math.min(1500,Number(data.UpgVault[57])*2)):null;
    case 82: var gt=rawGambitTime(data);return gt!==null?R("sum Holes[11][65..70]",gt):fallback();
    case 83: var h9=data.Holes&&data.Holes[9];if(Array.isArray(h9)){var s83=0,i83;for(i83=0;i83<h9.length;i83++)s83+=Math.ceil(lavaLog(Number(h9[i83])||0));return R("sum ceil(lavaLog(Holes[9]))",s83);}return null;
    case 84: var hv=rawHolesSum(data,1);return hv!==null?R("Holes[1] sum",hv):null;
    case 85: return O(262); case 86: return O(279);
    case 87: var b87=rawExtraCalc(data,73);return b87!==null?R("Holes[11][73]",b87):fallback();
    case 88: var j88=rawExtraCalc(data,74);return j88!==null?R("Holes[11][74]",j88):fallback();
    case 89: var w89=rawExtraCalc(data,75);return w89!==null?R("Holes[11][75]",w89):fallback();
    case 90: return O(356);
    case 91: var dd=rawExtraCalc(data,8);return dd!==null?R("Holes[11][8]",dd):fallback();
    case 92: var hl=rawHoleLayers(data);return hl!==null?R("Holes[11][1,3,5,7] sum",hl):fallback();
    case 93: var ho=rawHoleOpals(data);return ho!==null?R("Holes[7] sum",ho):fallback();
    case 94: var sdv=O(353);return sdv!==null?R("round(min(12,OptLacc[353])+1)",Math.round(Math.min(12,sdv)+1)):null;
    case 95: var em=O(369);return em!==null?R("round(OptLacc[369])",Math.round(em)):null;
    case 96: var ss96=rawSummoningStones(data);return ss96!==null?R("Summon[3] sum",ss96):null;
    case 97: var cr=rawCoralReefSum(data);return cr!==null?R("Spelunk[13] sum",cr):fallback();
    case 98: var bc=rawBestCave(data);return bc!==null?R("max Spelunk[1]",bc):null;
    case 99: var nu=rawNinjaUpgrades(data);return nu!==null?R("Ninja[103] sum",nu):null;
    case 100: return O(445); case 101: return O(446);
    case 102: var bh=rawBiggestHaul(data);return bh!==null?R("max Spelunk[2]",bh):fallback();
    case 103: var su=rawSpelunkUpgrades(data);return su!==null?R("sum max(0,Spelunk[5])",su):fallback();
    case 104: var sd104=rawSpelunkDiscoveries(data);return sd104!==null?R("Spelunk[6].length",sd104):null;
    case 105: var spl=rawSpelunkerLevel(data);return spl!==null?R("max Lv0_X[19]",spl):fallback();
    case 106: return O(443);
    case 107: return R("raw.Cards1 EquipmentNametag",rawLootyCount(data,"EquipmentNametag"))||fallback();
    case 108: var m108=rawMegaflesh(data);return m108!==null?R("raw.Bubba[1][8]",m108):fallback();
    case 109: var h109=rawHatsTotal(data);return h109!==null?R("raw.Spelunk[46].length",h109):null;
    case 110: var mo=rawMineheadOpponents(data);return mo!==null?R("Research[7][4]",mo):fallback();
    case 111: var rk=rawRatKingCrowns(data);return rk!==null?R("Research[11].length",rk):null;
    case 112: var fs=rawFarmingStickers(data);return fs!==null?R("OptLacc[140]",fs):null;
    case 113: return O(498);
    case 114: return R("raw.Research[0] sum",rawResearch(data));
    case 115: var gt115=rawGlimboTrades(data);return gt115!==null?R("Research[12] sum",gt115):fallback();
    case 116: var sushi=data.Sushi&&data.Sushi[0];if(sushi){var c116=0,i116;for(i116=0;i116<sushi.length;i116++)if(Number(sushi[i116])>0)c116++;return R("raw.Sushi[0] count>0",c116);}return null;
    case 117: return O(594);
    default: return null;
  }
}

function buildTomeRaw(){
  var ui=SpreadsheetApp.getUi();
  try{
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var bt=ss.getSheetByName("BEST TOME");
    var playerName=bt?String(bt.getRange("A1").getValue()||"").trim():"";
    if(!playerName)playerName="ARKHE";
    var profile=fetchProfile(playerName);
    var data=profile.data||{};
    var pd=profile.parsedData||{};
    var cats=["global","general","tasks","skills","character","misc","caverns"];
    var lbAll={};
    cats.forEach(function(c){lbAll[c]=fetchLB(c,playerName);Utilities.sleep(120);});
    var result=_buildSheetWithLB(data,pd,lbAll,playerName);
    ui.alert("TOME RAW built (public API)",result,ui.ButtonSet.OK);
  }catch(e){ui.alert("Error",(e&&e.message?e.message:String(e))+"\n\n"+(e&&e.stack?e.stack:""),ui.ButtonSet.OK);}
}
function _buildSheetWithLB(data,pd,lbAll,playerName){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName("TOME RAW");
  if(!sh)sh=ss.insertSheet("TOME RAW");
  else{var lr=Math.max(sh.getLastRow(),1);sh.getRange(1,1,lr,6).clearContent().clearFormat();}
  sh.getRange(1,1,1,6).setValues([["#","Tome Task","Raw Value","Pts","Source","Compute Idx"]])
    .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#fff").setHorizontalAlignment("center");
  sh.setFrozenRows(1);
  var rows=[],cov=0,miss=0,totalPts=0;
  for(var i=0;i<TOME_TASKS.length;i++){
    var ci=NEI32[i];
    var srcOut={label:""};
    var raw=null;
    try{raw=computeRawValue(ci,data,pd,lbAll,playerName,srcOut);}catch(e){srcOut.label="ERR:"+(e.message||e);}
    var sl=srcOut.label||"MISSING";
    var pts=null;
    if(raw===null||raw===undefined||(typeof raw==="number"&&isNaN(raw))){miss++;sl="MISSING";}
    else{cov++;pts=calcTomePts(ci,raw);if(typeof pts==="number")totalPts+=pts;}
    rows.push([i+1,TOME_TASKS[i],raw,pts,sl,ci]);
  }
  sh.getRange(2,1,rows.length,6).setValues(rows);
  sh.setColumnWidth(1,50);sh.setColumnWidth(2,320);sh.setColumnWidth(3,180);sh.setColumnWidth(4,90);sh.setColumnWidth(5,240);sh.setColumnWidth(6,90);
  sh.getRange(2,3,rows.length,1).setNumberFormat("#,##0.##");
  sh.getRange(2,4,rows.length,1).setNumberFormat("#,##0");
  sh.getRange(2,1,rows.length,1).setHorizontalAlignment("center");
  sh.getRange(2,6,rows.length,1).setHorizontalAlignment("center");
  for(var r=0;r<rows.length;r++){
    var lbl=rows[r][4];
    var bg="#dcfce7",fc="#16a34a";
    if(lbl==="MISSING"){bg="#fee2e2";fc="#dc2626";}
    else if(lbl.indexOf("LB:")===0){bg="#dbeafe";fc="#1e40af";}
    else if(lbl.indexOf("ERR")===0){bg="#fef3c7";fc="#92400e";}
    sh.getRange(2+r,5).setBackground(bg).setFontColor(fc);
  }
  return "Player: "+playerName+" - "+cov+"/"+rows.length+" covered, totalPts="+totalPts;
}
