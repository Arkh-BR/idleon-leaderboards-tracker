// Task 2 (Multikill plan): every source of WorkbenchStuff("MultiKillTOTAL") (N.js @7810403), by MK_POOLS id. Each term is the N.js sub-expression of
// its source, in the amount its half adds: the 9 terms of MultiKill_base (@7808345), the 18 of MultiKill_perTier (@7805748), the tier (OverkillStuffs
// "2"), the two map rules and the activation flag (OverkillStuffs "3", a status row). The table covers every source of the page's descriptor.
import { describe, it, expect } from "vitest";
import { MK_POOLS } from "@/lib/multikill/layers";
import { asNum, attr } from "@/lib/game/attr";
import { type Ctx } from "@/lib/game/ctx";
import { DNSM_AlchBubbles, DNSM_AlchVials, DNSM_BoxRewards, DNSM_StarSigns } from "@/lib/game/njs/DNSM";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { ArbitraryCode } from "@/lib/game/njs/ArbitraryCode";
import { ArcadeBonus } from "@/lib/game/njs/ArcadeBonus";
import { Breeding } from "@/lib/game/njs/Breeding";
import { CardBonusREAL } from "@/lib/game/njs/CardBonusREAL";
import { CardSetBonuses } from "@/lib/game/njs/CardSetBonuses";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { EtcBonuses } from "@/lib/game/njs/EtcBonuses";
import { GetBuffBonuses } from "@/lib/game/njs/GetBuffBonuses";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { GetTalentNumber } from "@/lib/game/njs/GetTalentNumber";
import { Holes } from "@/lib/game/njs/Holes";
import { prayersReal } from "@/lib/game/njs/prayersReal";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { Sailing } from "@/lib/game/njs/Sailing";
import { SaltLick } from "@/lib/game/njs/SaltLick";
import { StampBonusOfTypeX } from "@/lib/game/njs/StampBonusOfTypeX";
import { WorkbenchStuff } from "@/lib/game/njs/WorkbenchStuff";

/** The lib/game term of each source, as MultiKillTOTAL uses it. */
const TERMS: Record<string, (c: Ctx) => number> = {
  // MultiKill_base @7808345
  sign47: (c) => DNSM_StarSigns(c, "MultiKill"),
  saltLick8: (c) => SaltLick(c, 8),
  stampC19: (c) => StampBonusOfTypeX(c, "Overkill"),
  deathNoteBuilding: (c) => 2 * asNum(c, "TowerInfo", 2),
  etc29: (c) => EtcBonuses(c, "29"),
  ach148: (c) => Math.min(5, AchieveStatus(c, 148)),
  ach122: (c) => 6 * AchieveStatus(c, 122),
  ach123: (c) => 2 * AchieveStatus(c, 123),
  talent654: (c) => ArbitraryCode(c, "StatueOnyxOwned") * GetTalentNumber(c, 1, 654),
  // MultiKill_perTier @7805748
  deathNoteWorld: (c) => WorkbenchStuff(c, "OverkillQTY", Math.floor(c.map / 50), 0),
  deathNoteMini: (c) => WorkbenchStuff(c, "OverkillQTY", 7, 0),
  vialOverkill: (c) => DNSM_AlchVials(c, "Overkill"),
  buff46: (c) => GetBuffBonuses(c, 46, 2),
  talent58: (c) => getbonus2(c, 1, 58, -1) * Math.floor(asNum(c, "OptionsListAccount", 158) / 5),
  arcade8: (c) => ArcadeBonus(c, 8),
  artifact26: (c) => Sailing(c, "ArtifactBonus", 26, 0),
  buff469: (c) => GetBuffBonuses(c, 469, 2),
  chipMkill: (c) => chipBonuses(c, "mkill"),
  etc71: (c) => EtcBonuses(c, "71"),
  meas9: (c) => Holes(c, "MeasurementBonusTOTAL", 9, 0),
  card80: (c) => CardBonusREAL(c, 80),
  sign78: (c) => DNSM_StarSigns(c, "78"),
  prayer16: (c) => prayersReal(c, 16, 0),
  shiny4: (c) => Breeding(c, "ShinyBonusS", "Nah", 4, -1),
  box13b: (c) => DNSM_BoxRewards(c, "13b"),
  bubbleMKtier: (c) => DNSM_AlchBubbles(c, "MKtierACTIVE"),
  cardSet11: (c) => CardSetBonuses(c, 0, "11"),
  tier: (c) => RunCodeOfTypeXforThingY(c, "OverkillStuffs", "2"),
  // the map rules, inline in both halves: `300<=CurrentMap` (@7806815, @7808872), `216==CurrentMap&&17==Holes[0][me]` (@7808002, @7810065)
  softCap: (c) => (300 <= c.map ? 1 : 0),
  cove: (c) => (216 == c.map && 17 == (attr(c, "Holes", 0, c.player) as number) ? 1 : 0),
  active: (c) => RunCodeOfTypeXforThingY(c, "OverkillStuffs", "3"),
};

describe("the Multikill term table covers every source of the page's descriptor", () => {
  it("has one term per MK_POOLS source, no more", () => {
    expect(Object.keys(TERMS).sort()).toEqual(Object.values(MK_POOLS).flat().sort());
  });
});
