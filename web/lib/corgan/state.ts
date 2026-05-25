// ===== MUTABLE STATE MODULE =====
// 1:1 port of corgan-source/js/state.js (singleton + assignState).
// Same side-effecty design: all modules import `saveData` and read its
// properties. assignState() does partial updates; restoreState() does full.
//
// SSR safety note: we keep the singleton pattern because the calculator
// only fires after a user upload (client-side), never during SSR.

const GRID_SIZE = 240;

// Keys whose arrays are mutated by simulation and must be deep-cloned
// for snapshots. (Not used by drop-rate path — included for 1:1 parity.)
const _SIM_CLONE_KEYS = [
  "gridLevels",
  "shapeOverlay",
  "occFound",
  "insightLvs",
  "insightProgress",
  "shapePositions",
  "stateR7",
] as const;

// The save-derived state. Type is intentionally loose (`any`) for fields
// we don't strictly type yet — Corgan's code reads heterogeneous shapes
// (arrays, dicts, primitives) per key.
export type SaveData = {
  research: any;
  gridLevels: number[];
  shapeOverlay: number[];
  occFound: number[];
  insightLvs: number[];
  insightProgress: number[];
  magData: any[];
  shapePositions: any[];
  stateR7: number[];
  mineheadUpgLevels: any[];
  researchLevel: number;
  magMaxPerSlot: number;
  externalResearchPct: number;
  comp52TrueMulti: number;
  allBonusMulti: number;
  magnifiersOwned: number;
  olaData: any[];
  towerData: any[];
  spelunkData: any[];
  arcadeUpgData: any[];
  cards0Data: any;
  cards1Data: any[];
  sailingData: any[];
  lv0Data: any[];
  totemInfoData: any[];
  gamingData: any[];
  gamingSproutData: any[];
  ninjaData: any[];
  charNames: string[];
  ribbonData: any[];
  mealsData: any[];
  farmCropCount: number;
  grimoireData: any[];
  vaultData: any[];
  farmUpgData: any[];
  totalTomePoints: number;
  holesData: any[];
  riftData: any[];
  breedingData: any[];
  summonData: any[];
  atomsData: any[];
  arcaneData: any[];
  compassData: any[];
  gemItemsData: any[];
  achieveRegData: any[];
  bribeStatusData: any[];
  cauldronP2WData: any[];
  tasksGlobalData: any[];
  lv0AllData: any[];
  labBonusConnected: any[];
  labJewelConnected: any[];
  labMainBonusFull: any[];
  companionIds: Set<number>;
  extBonusOverrides: Record<string, unknown>;
  serverVarResXP: number;
  serverVarMineHP: number;
  serverVarMineCost: number;
  activeVoteIdx: number;
  starSignsUnlocked: Record<string, unknown>;
  cachedEventShopStr: string;
  cachedResearchExp: number;
  cachedSpelunkyUpg7: number;
  cachedFailedRolls: number;
  cachedComp0DivOk: boolean;
  cachedStickerFixed: number;
  cachedBoonyCount: number;
  cachedEvShop37: number;
  cachedExtPctExSticker: number;
  cachedButtonBonus0: number;
  cachedBtnBaseNoGrid: number;
  cachedKillroy5: number;
  cachedDream14: number;
  guildData: any[];
  cyTalentPointsData: any[];
  prayOwnedData: any[];
  shrineData: any[];
  bundlesData: any;
  farmRankData: any;
  forgeLvData: any[];
  sushiData: any[];
  statueData: any[];
  statueGData: any[];
  starSignProgData: any[];
  dungUpgData: any[];
  questCompleteData: any[];
  totalQuestsComplete: number;
  cachedUniqueSushi: number;
  cachedSailingArt37: number;
  weeklyBossData: any;
  refineryData: any[];
  boatsData: any[];
  cookingData: any[];
  petsData: any[];
  petsStoredData: any[];
  captainsData: any[];
  bubbaData: any[];
  currenciesData: any;
  deliveryBoxComplete: number;
  deliveryBoxStreak: number;
  deliveryBoxMisc: number;
  familyValuesData: any;
  colosseumHighscores: any[];
  minigameHiscores: any[];
  chestOrderData: any[];
  chestQuantityData: any[];
  krBestData: any;
  divinityAllData: any[];
  labChipData: any[];
  saltLickData: any[];
  cogOrderData: any[];
  cogMapData: any;
  flagUnlockData: any[];
  shapeTiers: { above: any[]; below: any[] };
  _covLUTCache: unknown;
  _covLUTCacheN: number;
  // Allow loader to add ad-hoc keys without explicit typing.
  [key: string]: any;
};

export const saveData: SaveData = {
  research: null,
  gridLevels: new Array(GRID_SIZE).fill(0),
  shapeOverlay: new Array(GRID_SIZE).fill(-1),
  occFound: new Array(80).fill(0),
  insightLvs: new Array(80).fill(0),
  insightProgress: new Array(80).fill(0),
  magData: [],
  shapePositions: [],
  stateR7: new Array(20).fill(0),
  mineheadUpgLevels: [],
  researchLevel: 0,
  magMaxPerSlot: 1,
  externalResearchPct: 0,
  comp52TrueMulti: 1,
  allBonusMulti: 1,
  magnifiersOwned: 0,
  olaData: [],
  towerData: [],
  spelunkData: [],
  arcadeUpgData: [],
  cards0Data: {},
  cards1Data: [],
  sailingData: [],
  lv0Data: [],
  totemInfoData: [],
  gamingData: [],
  gamingSproutData: [],
  ninjaData: [],
  charNames: [],
  ribbonData: [],
  mealsData: [],
  farmCropCount: 0,
  grimoireData: [],
  vaultData: [],
  farmUpgData: [],
  totalTomePoints: 0,
  holesData: [],
  riftData: [],
  breedingData: [],
  summonData: [],
  atomsData: [],
  arcaneData: [],
  compassData: [],
  gemItemsData: [],
  achieveRegData: [],
  bribeStatusData: [],
  cauldronP2WData: [],
  tasksGlobalData: [],
  lv0AllData: [],
  labBonusConnected: [],
  labJewelConnected: [],
  labMainBonusFull: [],
  companionIds: new Set<number>(),
  extBonusOverrides: {},
  serverVarResXP: 1.01,
  serverVarMineHP: 1,
  serverVarMineCost: 1,
  activeVoteIdx: -1,
  starSignsUnlocked: {},
  cachedEventShopStr: "",
  cachedResearchExp: 0,
  cachedSpelunkyUpg7: 0,
  cachedFailedRolls: 0,
  cachedComp0DivOk: false,
  cachedStickerFixed: 0,
  cachedBoonyCount: 0,
  cachedEvShop37: 0,
  cachedExtPctExSticker: 0,
  cachedButtonBonus0: 0,
  cachedBtnBaseNoGrid: 0,
  cachedKillroy5: 0,
  cachedDream14: 0,
  guildData: [],
  cyTalentPointsData: [],
  prayOwnedData: [],
  shrineData: [],
  bundlesData: {},
  farmRankData: {},
  forgeLvData: [],
  sushiData: [],
  statueData: [],
  statueGData: [],
  starSignProgData: [],
  dungUpgData: [],
  questCompleteData: [],
  totalQuestsComplete: 0,
  cachedUniqueSushi: 0,
  cachedSailingArt37: 0,
  weeklyBossData: {},
  refineryData: [],
  boatsData: [],
  cookingData: [],
  petsData: [],
  petsStoredData: [],
  captainsData: [],
  bubbaData: [],
  currenciesData: {},
  deliveryBoxComplete: 0,
  deliveryBoxStreak: 0,
  deliveryBoxMisc: 0,
  familyValuesData: {},
  colosseumHighscores: [],
  minigameHiscores: [],
  chestOrderData: [],
  chestQuantityData: [],
  krBestData: {},
  divinityAllData: [],
  labChipData: [],
  saltLickData: [],
  cogOrderData: [],
  cogMapData: {},
  flagUnlockData: [],
  shapeTiers: { above: [], below: [] },
  _covLUTCache: null,
  _covLUTCacheN: -1,
};

/** Short alias matching Corgan's `import { S }` pattern. */
export { saveData as S };

/** Partial update — only touches keys present in `u`. */
export function assignState(u: Partial<SaveData> & Record<string, unknown>): void {
  for (const k in u) {
    if (k === "companionIds") {
      const v = (u as any).companionIds;
      saveData.companionIds = v instanceof Set ? v : new Set<number>(v || []);
    } else if (k === "shapeTiers") {
      const v = (u as any).shapeTiers;
      saveData.shapeTiers.above = (v && v.above) || [];
      saveData.shapeTiers.below = (v && v.below) || [];
    } else {
      (saveData as any)[k] = (u as any)[k];
    }
  }
}

/** Reset to initial state (used between uploads). */
export function resetState(): void {
  saveData.research = null;
  saveData.gridLevels = new Array(GRID_SIZE).fill(0);
  saveData.shapeOverlay = new Array(GRID_SIZE).fill(-1);
  saveData.occFound = new Array(80).fill(0);
  saveData.insightLvs = new Array(80).fill(0);
  saveData.insightProgress = new Array(80).fill(0);
  saveData.magData = [];
  saveData.shapePositions = [];
  saveData.stateR7 = new Array(20).fill(0);
  saveData.companionIds = new Set<number>();
  saveData.charNames = [];
  // Other keys are overwritten by assignState() during loadSaveData(); their
  // pre-set defaults already cover the unpopulated case.
}
