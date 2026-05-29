// ===== SAVE LOADER (Stage 1: minimal) =====
// Port of corgan-source/js/save/loader.js, trimmed to populate enough of
// `saveData` + `assignSaveData(...)` globals to support the drop-rate
// systems we'll port in Stages 2-4.
//
// Intentionally omits the `recomputeDerivedBonuses()` tail of the original,
// which depends on ResearchEXP/AFK descriptors, sim-math, sushi/minehead
// systems — all out of scope for drop-rate. We'll add it in a later stage.

import { saveData, assignState } from "../state";
import { assignSaveData } from "./data";
import { parseSaveKey } from "./helpers";
import { computeUniqueSushi } from "../stats/systems/w7/sushi";
import { LAB_BONUS_BASE, LAB_BONUS_DYNAMIC, JEWEL_DESC } from "../stats/data/w4/lab";
import { computeLabConnectivity } from "../stats/systems/w4/lab";
import { emporiumBonus } from "../game-helpers";

type RawEnvelope = {
  data?: Record<string, unknown>;
  charNames?: string[];
  companion?: { l?: unknown[] };
  serverVars?: Record<string, unknown>;
  tournament?: { global?: { T?: number } };
  // The "Copy for Support" envelope from IT can put fields at top level too;
  // we always prefer `.data` if present.
  [key: string]: unknown;
};

export function loadSaveData(raw: RawEnvelope): void {
  const save = (raw.data ?? raw) as Record<string, unknown>;
  const companionRaw = raw.companion as { l?: unknown[] } | undefined;

  // Research (Stage 1 doesn't compute against it, but state.research is read
  // by some sticker/cached helpers — keep it populated for forward compat.)
  let R: unknown = save.Research;
  if (typeof R === "string") {
    try {
      R = JSON.parse(R);
    } catch {
      R = null;
    }
  }
  if (Array.isArray(R)) {
    assignState({ research: R });
    if (Array.isArray(R[0])) assignState({ gridLevels: (R[0] as number[]).slice() });
    if (Array.isArray(R[1])) assignState({ shapeOverlay: (R[1] as number[]).slice() });
    if (Array.isArray(R[2])) assignState({ occFound: (R[2] as number[]).slice() });
    if (Array.isArray(R[4])) assignState({ insightLvs: (R[4] as number[]).slice() });
    if (Array.isArray(R[3])) assignState({ insightProgress: (R[3] as number[]).slice() });
    if (Array.isArray(R[7])) assignState({ stateR7: (R[7] as number[]).slice() });
    if (Array.isArray(R[8])) assignState({ mineheadUpgLevels: (R[8] as any[]).slice() });
  }

  // Account-wide arrays
  const olaRaw = (parseSaveKey(save, "OptLacc") as any[]) || [];
  assignState({ olaData: olaRaw });
  assignState({ towerData: (parseSaveKey(save, "Tower") as any[]) || [] });
  const spelunkRaw = (parseSaveKey(save, "Spelunk") as any[]) || [];
  assignState({ spelunkData: spelunkRaw });
  assignState({ arcadeUpgData: (parseSaveKey(save, "ArcadeUpg") as any[]) || [] });
  assignState({ cards0Data: parseSaveKey(save, "Cards0") || {} });
  assignState({ cards1Data: (parseSaveKey(save, "Cards1") as any[]) || [] });
  assignState({ sailingData: (parseSaveKey(save, "Sailing") as any[]) || [] });
  assignState({ lv0Data: (parseSaveKey(save, "Lv0_0") || parseSaveKey(save, "Lv0") || []) as any[] });
  assignState({ totemInfoData: (parseSaveKey(save, "TotemInfo") as any[]) || [] });
  assignState({ gamingData: (parseSaveKey(save, "Gaming") as any[]) || [] });
  assignState({ gamingSproutData: (parseSaveKey(save, "GamingSprout") as any[]) || [] });
  assignState({ ninjaData: (parseSaveKey(save, "Ninja") as any[]) || [] });
  assignState({ ribbonData: (parseSaveKey(save, "Ribbon") as any[]) || [] });
  assignState({ mealsData: (parseSaveKey(save, "Meals") as any[]) || [] });
  const farmCrop = (parseSaveKey(save, "FarmCrop") as any) || {};
  assignState({
    farmCropCount: typeof farmCrop === "object" ? Object.keys(farmCrop).length : 0,
  });
  assignState({ grimoireData: (parseSaveKey(save, "Grimoire") as any[]) || [] });
  assignState({ vaultData: (parseSaveKey(save, "UpgVault") as any[]) || [] });
  assignSaveData({ labData: (parseSaveKey(save, "Lab") as any[]) || [] });
  assignState({ farmUpgData: (parseSaveKey(save, "FarmUpg") as any[]) || [] });
  assignState({ holesData: (parseSaveKey(save, "Holes") as any[]) || [] });
  assignState({ riftData: (parseSaveKey(save, "Rift") as any[]) || [] });
  assignState({ breedingData: (parseSaveKey(save, "Breeding") as any[]) || [] });
  assignState({ summonData: (parseSaveKey(save, "Summon") as any[]) || [] });
  assignState({ arcaneData: (parseSaveKey(save, "Arcane") as any[]) || [] });
  assignState({ sushiData: (parseSaveKey(save, "Sushi") as any[]) || [] });
  assignState({ dungUpgData: (parseSaveKey(save, "DungUpg") as any[]) || [] });
  assignState({ cogOrderData: (parseSaveKey(save, "CogO") as any[]) || [] });
  assignState({ cogMapData: parseSaveKey(save, "CogM") || {} });
  assignState({ flagUnlockData: (parseSaveKey(save, "FlagU") as any[]) || [] });

  assignState({ weeklyBossData: parseSaveKey(save, "WeeklyBoss") || {} });
  assignState({ refineryData: (parseSaveKey(save, "Refinery") as any[]) || [] });
  assignState({ boatsData: (parseSaveKey(save, "Boats") as any[]) || [] });
  assignState({ cookingData: (parseSaveKey(save, "Cooking") as any[]) || [] });
  assignState({ petsData: (parseSaveKey(save, "Pets") as any[]) || [] });
  assignState({ petsStoredData: (parseSaveKey(save, "PetsStored") as any[]) || [] });
  assignState({ captainsData: (parseSaveKey(save, "Captains") as any[]) || [] });
  assignState({ bubbaData: (parseSaveKey(save, "Bubba") as any[]) || [] });
  assignState({ currenciesData: parseSaveKey(save, "CurrenciesOwned") || {} });
  assignState({ deliveryBoxComplete: Number(save.CYDeliveryBoxComplete) || 0 });
  assignState({ deliveryBoxStreak: Number(save.CYDeliveryBoxStreak) || 0 });
  assignState({ deliveryBoxMisc: Number(save.CYDeliveryBoxMisc) || 0 });
  assignState({ familyValuesData: parseSaveKey(save, "FamilyValuesMap") || {} });
  assignState({
    colosseumHighscores: (parseSaveKey(save, "FamValColosseumHighscores") as any[]) || [],
  });
  assignState({
    minigameHiscores: (parseSaveKey(save, "FamValMinigameHiscores") as any[]) || [],
  });
  assignState({ chestOrderData: (parseSaveKey(save, "ChestOrder") as any[]) || [] });
  assignState({ chestQuantityData: (parseSaveKey(save, "ChestQuantity") as any[]) || [] });
  assignState({ krBestData: parseSaveKey(save, "KRbest") || {} });

  // StarSg can arrive in three shapes depending on which "Copy" button the
  // user pressed and which IT version produced the dump:
  //   1. {"0":"{","1":"\"",...}  — char-by-char string envelope; reconstruct
  //      then JSON.parse.
  //   2. "{...json...}"          — raw stringified JSON; parse directly.
  //   3. {Activelius:1, ...}     — already parsed by IT into the
  //      sign-name → 1 map. Adopt as-is.
  // The previous code missed (3) and fell into branch (1), which joined the
  // numeric `1` values together into "111111..." → JSON.parse returns the
  // number 1.1111e79, then `starSignsUnlocked` is a Number and the `in`
  // operator throws when computeSeraphMulti probes it. Detect the parsed-
  // object case by looking at the first key — char-by-char keys are numeric
  // strings ("0", "1", ...), parsed-object keys are sign names.
  const starSgRaw = save.StarSg;
  if (starSgRaw && typeof starSgRaw === "object" && !Array.isArray(starSgRaw)) {
    const o = starSgRaw as Record<string, unknown>;
    const keys = Object.keys(o);
    const looksLikeCharByChar =
      keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
    if (looksLikeCharByChar) {
      const starSgStr = keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String(o[k]))
        .join("");
      try {
        const parsed = JSON.parse(starSgStr);
        // Guard against the same pitfall: only adopt when it parses to a
        // plain object, never a number / array.
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          assignState({ starSignsUnlocked: parsed });
        } else {
          assignState({ starSignsUnlocked: {} });
        }
      } catch {
        assignState({ starSignsUnlocked: {} });
      }
    } else {
      // Already the sign-name → flag map; use it directly.
      assignState({ starSignsUnlocked: o });
    }
  } else if (typeof starSgRaw === "string") {
    try {
      const parsed = JSON.parse(starSgRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        assignState({ starSignsUnlocked: parsed });
      } else {
        assignState({ starSignsUnlocked: {} });
      }
    } catch {
      assignState({ starSignsUnlocked: {} });
    }
  }
  assignState({ starSignProgData: (parseSaveKey(save, "SSprog") as any[]) || [] });
  assignState({ compassData: (parseSaveKey(save, "Compass") as any[]) || [] });
  assignState({ atomsData: (parseSaveKey(save, "Atoms") as any[]) || [] });
  assignState({ gemItemsData: (parseSaveKey(save, "GemItemsPurchased") as any[]) || [] });
  assignState({ achieveRegData: (parseSaveKey(save, "AchieveReg") as any[]) || [] });
  assignState({ bribeStatusData: (parseSaveKey(save, "BribeStatus") as any[]) || [] });
  assignState({ cauldronP2WData: (parseSaveKey(save, "CauldronP2W") as any[]) || [] });
  assignSaveData({ tasksW7Data: (parseSaveKey(save, "TaskZZ5") as any[]) || [] });
  const tasksGlobal: any[] = [];
  for (let tz = 0; tz <= 5; tz++) {
    tasksGlobal.push((parseSaveKey(save, "TaskZZ" + tz) as any[]) || []);
  }
  assignState({ tasksGlobalData: tasksGlobal });
  assignSaveData({ dreamData: (parseSaveKey(save, "Dream") as any[]) || [] });
  assignSaveData({ divinityData: (parseSaveKey(save, "Divinity") as any[]) || [] });
  const optionsRaw =
    (parseSaveKey(save, "OptionsListAccount") as any[]) || olaRaw;
  assignSaveData({ optionsListData: optionsRaw });
  assignState({ guildData: (parseSaveKey(save, "Guild") as any[]) || [] });
  assignState({ prayOwnedData: (parseSaveKey(save, "PrayOwned") as any[]) || [] });
  assignState({ shrineData: (parseSaveKey(save, "Shrine") as any[]) || [] });
  assignState({ saltLickData: (parseSaveKey(save, "SaltLick") as any[]) || [] });
  assignState({ bundlesData: parseSaveKey(save, "BundlesReceived") || {} });
  assignState({ farmRankData: parseSaveKey(save, "FarmRank") || {} });
  assignState({ forgeLvData: (parseSaveKey(save, "ForgeLV") as any[]) || [] });

  const nChars = raw.charNames ? raw.charNames.length : 10;
  assignSaveData({ numCharacters: nChars });
  assignState({ charNames: raw.charNames || [] });

  // Per-character data
  const lv0All: any[] = [];
  const exp0All: any[] = [];
  const charClass: number[] = [];
  const skillLv: any[] = [];
  const skillLvMax: any[] = [];
  const playerStuff: any[] = [];
  const statueLvAll: any[] = [];
  const statList: number[][] = [];
  const invOrder: any[] = [];
  const itemQty: any[] = [];
  for (let ci = 0; ci < nChars; ci++) {
    lv0All.push((parseSaveKey(save, "Lv0_" + ci) as any[]) || []);
    exp0All.push((parseSaveKey(save, "Exp0_" + ci) as any[]) || []);
    charClass.push(Number(parseSaveKey(save, "CharacterClass_" + ci)) || 0);
    skillLv.push((parseSaveKey(save, "SL_" + ci) as any) || {});
    skillLvMax.push((parseSaveKey(save, "SM_" + ci) as any) || {});
    playerStuff.push((parseSaveKey(save, "PlayerStuff_" + ci) as any[]) || []);
    statueLvAll.push((parseSaveKey(save, "StatueLevels_" + ci) as any[]) || []);
    // PVStatList_N = [STR, AGI, WIS, LUK, level] — corgan reads this for lukCurve
    statList.push((parseSaveKey(save, "PVStatList_" + ci) as any[]) || []);
    // Per-char carried inventory: InventoryOrder_N (item rawNames) +
    // ItemQTY_N (quantities) — used by invStorageOwned for talents
    // 101/131/295/311/461/476.
    invOrder.push((parseSaveKey(save, "InventoryOrder_" + ci) as any[]) || []);
    itemQty.push((parseSaveKey(save, "ItemQTY_" + ci) as any[]) || []);
  }
  assignState({ inventoryOrderData: invOrder, itemQtyData: itemQty });
  // Stash on the singleton so corgan's lukScaling can read raw LUK by char idx.
  assignState({ statList });
  const statueLevels = ((statueLvAll[0] || []) as any[]).map(
    (s) => Number(Array.isArray(s) ? s[0] : s) || 0
  );
  assignState({ statueData: statueLevels });
  assignState({ statueLvAllData: statueLvAll });
  const stuGRaw = parseSaveKey(save, "StuG");
  assignState({
    statueGData: Array.isArray(stuGRaw)
      ? (stuGRaw as any[])
      : typeof stuGRaw === "string"
        ? (JSON.parse(stuGRaw as string) as any[])
        : [],
  });
  assignState({ lv0AllData: lv0All });
  assignState({ cyTalentPointsData: (parseSaveKey(save, "CYTalentPoints") as any[]) || [] });
  assignSaveData({ charClassData: charClass });
  assignSaveData({ skillLvData: skillLv });
  assignSaveData({ skillLvMaxData: skillLvMax });
  assignSaveData({ playerStuffData: playerStuff });
  assignSaveData({
    cauldronInfoData: (parseSaveKey(save, "CauldronInfo") as any[]) || [],
  });
  assignSaveData({
    cauldronBubblesData: (parseSaveKey(save, "CauldronBubbles") as any[]) || [],
  });
  assignSaveData({ stampLvData: (parseSaveKey(save, "StampLv") as any) || {} });

  // Per-character star sign strings (plain strings, NOT JSON)
  const starSigns: string[] = [];
  for (let ci = 0; ci < nChars; ci++) {
    const key = "PVtStarSign_" + ci;
    const v = save[key];
    starSigns.push(typeof v === "string" ? v : String(v ?? ""));
  }
  assignSaveData({ starSignData: starSigns });

  const kla: any[] = [];
  for (let ci = 0; ci < nChars; ci++) {
    kla.push((parseSaveKey(save, "KLA_" + ci) as any[]) || []);
  }
  assignSaveData({ klaData: kla });

  // Per-character equipment (gear + tools)
  const equipOrders: any[] = [];
  const equipQtys: any[] = [];
  const emmAll: any[] = [];
  for (let ci = 0; ci < nChars; ci++) {
    equipOrders.push((parseSaveKey(save, "EquipOrder_" + ci) as any[]) || []);
    equipQtys.push((parseSaveKey(save, "EquipQTY_" + ci) as any[]) || []);
    emmAll.push([
      parseSaveKey(save, "EMm0_" + ci) || {},
      parseSaveKey(save, "EMm1_" + ci) || {},
    ]);
  }
  assignSaveData({ equipOrderData: equipOrders });
  assignSaveData({ equipQtyData: equipQtys });
  assignSaveData({ emmData: emmAll });

  // Per-character obols + family obols
  const obolNames: any[] = [];
  const obolMaps: any[] = [];
  for (let ci = 0; ci < nChars; ci++) {
    obolNames.push((parseSaveKey(save, "ObolEqO0_" + ci) as any[]) || []);
    obolMaps.push((parseSaveKey(save, "ObolEqMAP_" + ci) as any) || {});
  }
  assignSaveData({ obolNamesData: obolNames });
  assignSaveData({ obolMapsData: obolMaps });
  assignSaveData({
    obolFamilyNames: (parseSaveKey(save, "ObolEqO1") as any[]) || [],
  });
  assignSaveData({
    obolFamilyMaps: (parseSaveKey(save, "ObolEqMAPz1") as any) || {},
  });

  // Per-character prayers / post office / cards / map / buffs
  const prayersPerChar: any[] = [];
  const postOffice: any[] = [];
  const cardEquip: any[] = [];
  const csetEq: any[] = [];
  const currentMap: number[] = [];
  const buffsActive: any[] = [];
  for (let ci = 0; ci < nChars; ci++) {
    prayersPerChar.push((parseSaveKey(save, "Prayers_" + ci) as any[]) || []);
    postOffice.push((parseSaveKey(save, "POu_" + ci) as any[]) || []);
    cardEquip.push((parseSaveKey(save, "CardEquip_" + ci) as any[]) || []);
    csetEq.push((parseSaveKey(save, "CSetEq_" + ci) as any) || {});
    currentMap.push(Number(parseSaveKey(save, "CurrentMap_" + ci)) || 0);
    buffsActive.push((parseSaveKey(save, "BuffsActive_" + ci) as any[]) || []);
  }
  assignSaveData({ prayersPerCharData: prayersPerChar });
  assignSaveData({ postOfficeData: postOffice });
  assignSaveData({ cardEquipData: cardEquip });
  assignSaveData({ csetEqData: csetEq });
  assignSaveData({ currentMapData: currentMap });
  assignSaveData({ buffsActiveData: buffsActive });

  // MapBon — per-map kill counts. In a raw save it's a flat comma-separated
  // string "kills,?,?,kills,?,?,..." (3 values per map). parseSaveKey tries
  // JSON.parse first; for the CSV form we split + chunk manually. Final
  // shape: number[][] where mapBonData[i] = [kills, x, y] for map i.
  const mapBonParsed: unknown = parseSaveKey(save, "MapBon");
  let mapBonArr: number[][] = [];
  if (Array.isArray(mapBonParsed)) {
    mapBonArr = (mapBonParsed as any[]).map((e) =>
      Array.isArray(e) ? (e as any[]).map(Number) : [0]
    );
  } else if (typeof mapBonParsed === "string") {
    const flat = mapBonParsed.split(",").map((s) => Number(s) || 0);
    for (let i = 0; i + 2 < flat.length; i += 3) {
      mapBonArr.push([flat[i], flat[i + 1], flat[i + 2]]);
    }
  }
  assignSaveData({ mapBonData: mapBonArr });

  // Companion ownership from it.json envelope
  if (companionRaw && Array.isArray(companionRaw.l)) {
    const ids = new Set<number>();
    for (const entry of companionRaw.l) {
      const id = parseInt(String(entry).split(",")[0], 10);
      if (!isNaN(id)) ids.add(id);
    }
    assignState({ companionIds: ids });
  }

  // Per-character quest completion
  const questComplete: any[] = [];
  for (let ci = 0; ci < nChars; ci++) {
    questComplete.push((parseSaveKey(save, "QuestComplete_" + ci) as any) || {});
  }
  assignState({ questCompleteData: questComplete });

  // Server vars (Research EXP, mining, voting)
  const sv = raw.serverVars as Record<string, unknown> | undefined;
  if (sv?.A_ResXP != null)
    assignState({ serverVarResXP: Number(sv.A_ResXP) || 1.01 });
  if (sv?.A_MineHP != null)
    assignState({ serverVarMineHP: Number(sv.A_MineHP) || 1 });
  if (sv?.A_MineCost != null)
    assignState({ serverVarMineCost: Number(sv.A_MineCost) || 1 });
  const vc = sv?.voteCategories as any[] | undefined;
  if (Array.isArray(vc) && vc.length > 0)
    assignState({ activeVoteIdx: Number(vc[0]) || -1 });

  const timeAwayRaw = parseSaveKey(save, "TimeAway") as any;
  if (timeAwayRaw && typeof timeAwayRaw === "object") {
    if (timeAwayRaw.GlobalTime != null) {
      assignSaveData({
        saveGlobalTime: Number(timeAwayRaw.GlobalTime) || 0,
      });
    }
  }

  if (raw.tournament?.global?.T != null) {
    assignSaveData({
      tournamentDay: Number(raw.tournament.global.T) || 0,
    });
  }

  // Derived research/cache state (subset of Corgan — drop-rate doesn't read most)
  const researchLevels = lv0All
    .map((l: any[]) => l?.[20] || 0)
    .concat([0]) as number[];
  const rLv = Math.max(...researchLevels);
  assignState({ researchLevel: rLv });
  assignState({ cachedEventShopStr: String(olaRaw[311] || "") });
  assignState({ cachedSpelunkyUpg7: spelunkRaw?.[0]?.[7] || 0 });
  assignState({ cachedFailedRolls: Number(optionsRaw[514]) || 0 });
  assignState({ cachedComp0DivOk: (lv0All[0]?.[14] || 0) >= 2 });

  // Tome score — Corgan re-derives this from save data via computeTomeScore
  // (1467 lines). For now we shortcut to the value IT stamps on the envelope.
  // The "Copy for Support" payload puts it on `extraData.totalTomePoints`;
  // the public profiles endpoint (used by the top-player collectors) has no
  // extraData block but carries the same computed score on
  // `parsedData.totalTomePoints`. Read whichever is present so both the page
  // upload AND the collectors get it — otherwise the collected saves report
  // tome = 0 and every tome-driven bonus (DR tome 2/7, etc.) is missing.
  // Falls back to 0 for a bare raw save.json.
  const extraData = (raw as any).extraData;
  const parsedData = (raw as any).parsedData;
  const envelopeTome =
    extraData?.totalTomePoints ?? parsedData?.totalTomePoints;
  if (envelopeTome != null) {
    assignState({ totalTomePoints: Number(envelopeTome) || 0 });
  }

  // Cached unique sushi count (sushiRoG / prisma chain reads it)
  assignState({ cachedUniqueSushi: computeUniqueSushi(saveData.sushiData) });

  // Lab Mainframe connectivity. Uses simplified port (assumes full lab
  // connectivity for end-game chars) — unblocks Stamp Doubler's Certified
  // Stamp Book ×2, Cook Multi's Mainframe contribution, and other downstream
  // mainframeBonus() reads.
  const labCon = computeLabConnectivity(saveData);
  assignState({
    labMainBonusFull: labCon.labMainBonusFull as any,
    labBonusConnected: labCon.labBonusConnected as any,
    labJewelConnected: labCon.labJewelConnected as any,
  });

  assignSaveData({ loadedSaveFormat: raw.data ? "it.json" : "save.json" });
}
