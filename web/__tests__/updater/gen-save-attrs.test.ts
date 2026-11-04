import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { extractSaveAttrs, renderSaveAttrs } from "@/scripts/updater/gen-save-attrs";
import { SAVE_ATTRS } from "@/lib/game/data/saveAttrs.gen";

// The shapes of the N.js cloud load (_customEvent_LoadAllData) and of the copy to the current
// player (_customBlock_LoadPlayerInfo), cut down to one example of each.
const SYNTH =
  `x={_customEvent_LoadAllData:function(){` +
  // account level, through a variable: all five loader kinds, and the plain one
  `q=a.engine;p=u.getLoadList("OptLacc");q.gameAttributes.h.OptionsListAccount=p;` +
  `q=a.engine;p=u.getLoadMap("StarSg");q.gameAttributes.h.StarSignsUnlocked=p;` +
  `q=a.engine;p=u.getLoadString("Nm");q.gameAttributes.h.Name=p;` +
  `q=a.engine;p=u.getLoadJsonList("Boats");q.gameAttributes.h.Boats=p;` +
  `this._DummyNumber=u.getLoad("CMmLENGTH");q=a.engine;p=u.getLoadSparseList("CMm",Math.round(this._DummyNumber));q.gameAttributes.h.ChestMap=p;` +
  `5<=u.getLoad("CSver")&&(q=a.engine,p=u.getLoad("GemsOwned"),q.gameAttributes.h.GemsOwned=p);` +
  // an element of an attribute, loaded from its own key
  `a.engine.getGameAttribute("PostOfficeInfo")[1]=u.getLoadList("PostOfficeInfo1");` +
  // per player: a field of the PlayerDATABASE entry, whole, and one element of one
  `for(;;){f=a.engine.getGameAttribute("PlayerDATABASE").h[""+e];t=u.getLoadList("Lv0_"+this._pID);f.h.Lv0=t;` +
  `var K=u.getLoadList("CardEquip_"+this._pID);f.h.CardEquip=K;` +
  `var P=u.getLoadJsonList("PldTraps_"+this._pID);f.h.PldTraps=P;` +
  `var M=u.getLoad("CurrentMap_"+this._pID);f.h.CurrentMap=M;` +
  `var Z=u.getLoadString("AFKtarget_"+this._pID);f.h.AFKtarget=Z;` +
  `a.engine.getGameAttribute("PlayerDATABASE").h[""+e].h.EquipmentMap[1]=u.getLoadSparseList("EMm1_"+this._pID,Math.round(this._DummyNumber));}` +
  // not mapped: a dynamic key, an indexed result, a scratch map
  `f=a.engine.getGameAttribute("CurrenciesOwned"),p=u.getLoadList("CY"+e),f.h[""+e]=p;` +
  `a.engine.getGameAttribute("PlayerDATABASE").h[""+e].h.OptionsList[11]=u.getLoadList("OptL2_"+this._pID)[0];` +
  `q=a.engine;p=u.getLoadMap("SL_"+this._pID);q.gameAttributes.h.DummyMap=p;` +
  `}};` +
  `k._customBlock_LoadPlayerInfo=function(d){var b=a.engine;d=a.engine.getGameAttribute("DummyMap").h.Lv0;b.gameAttributes.h.Lv0=d;` +
  `b=a.engine;d=c.asNumber(a.engine.getGameAttribute("DummyMap").h.CurrentMap);b.gameAttributes.h.CurrentMap=d;` +
  `b=a.engine;d=a.engine.getGameAttribute("DummyMap").h.PldTraps;b.gameAttributes.h.PlacedTraps=d;` +
  `b=a.engine;d=a.engine.getGameAttribute("DummyMap").h.EquipmentMap;b.gameAttributes.h.EquipmentMap=d;` +
  `a.engine.getGameAttribute("Cards")[2]=a.engine.getGameAttribute("DummyMap").h.CardEquip;return"txt"};`;

const plain = (src: string) =>
  Object.fromEntries(Object.entries(extractSaveAttrs(src).attrs).map(([k, v]) => [k, { key: v.key, perPlayer: v.perPlayer }]));

describe("extractSaveAttrs on a synthetic N.js", () => {
  const r = extractSaveAttrs(SYNTH);

  it("maps a literal key to the attribute the loaded value is stored in, for every loader kind", () => {
    const a = plain(SYNTH);
    expect(a.OptionsListAccount).toEqual({ key: "OptLacc", perPlayer: false }); // getLoadList
    expect(a.StarSignsUnlocked).toEqual({ key: "StarSg", perPlayer: false }); // getLoadMap
    expect(a.Name).toEqual({ key: "Nm", perPlayer: false }); // getLoadString
    expect(a.Boats).toEqual({ key: "Boats", perPlayer: false }); // getLoadJsonList
    expect(a.ChestMap).toEqual({ key: "CMm", perPlayer: false }); // getLoadSparseList
    expect(a.GemsOwned).toEqual({ key: "GemsOwned", perPlayer: false }); // getLoad
  });

  it("names an element loaded from its own key `Attr[i]`", () => {
    expect(plain(SYNTH)["PostOfficeInfo[1]"]).toEqual({ key: "PostOfficeInfo1", perPlayer: false });
  });

  it("maps a `Key_<player>` key to the attribute LoadPlayerInfo copies the field to, perPlayer", () => {
    const a = plain(SYNTH);
    expect(a.Lv0).toEqual({ key: "Lv0", perPlayer: true });
    expect(a["Cards[2]"]).toEqual({ key: "CardEquip", perPlayer: true }); // the copy lands in an element
    expect(a.PlacedTraps).toEqual({ key: "PldTraps", perPlayer: true }); // the copy renames it
    expect(a["EquipmentMap[1]"]).toEqual({ key: "EMm1", perPlayer: true }); // an element of the field
  });

  it("records the N.js offset of the loader call for each entry", () => {
    expect(SYNTH.startsWith('u.getLoadList("OptLacc")', r.attrs.OptionsListAccount.at)).toBe(true);
    expect(SYNTH.startsWith('u.getLoadList("Lv0_"+this._pID)', r.attrs.Lv0.at)).toBe(true);
  });

  it("leaves out what is not an attribute the engine can read, and says why", () => {
    const a = plain(SYNTH);
    expect(a).not.toHaveProperty("AFKtarget"); // a PlayerDATABASE field LoadPlayerInfo never copies
    expect(a).not.toHaveProperty("DummyMap"); // a scratch map
    expect(a).not.toHaveProperty("CurrentMap"); // live at runtime: ctx.map
    expect(a).not.toHaveProperty("OptionsList[11]"); // an indexed result
    const why = Object.fromEntries(r.unmapped.map((u) => [u.key, u.why]));
    expect(why["CY"]).toMatch(/dynamic/);
    expect(why["OptL2"]).toMatch(/indexed/);
    expect(why["AFKtarget"]).toMatch(/LoadPlayerInfo/);
    expect(why["SL"]).toMatch(/scratch/);
    expect(why["CurrentMap"]).toMatch(/ctx\.map/);
  });

  it("does not list a read that is not an assignment (conditions on CSver, CMmLENGTH)", () => {
    expect(r.unmapped.map((u) => u.key)).not.toContain("CSver");
  });

  it("throws when the loader is not there", () => {
    expect(() => extractSaveAttrs("nothing")).toThrow(/LoadAllData/);
  });

  it("renders a header with the regenerate command, and an entry per attribute with its offset", () => {
    const text = renderSaveAttrs(r, "deadbeef0000");
    expect(text).toMatch(/^\/\/ Auto-generated by web\/scripts\/updater\/gen-save-attrs\.ts -- do not edit/);
    expect(text).toContain("cd web && npx tsx scripts/updater/gen-save-attrs.ts");
    expect(text).toContain("deadbeef0000");
    expect(text).toContain(`"OptionsListAccount": { key: "OptLacc", perPlayer: false }, // @${r.attrs.OptionsListAccount.at}`);
  });
});

const NJS = "scripts/updater/.cache/N.new.js";
describe.skipIf(!existsSync(NJS))("extractSaveAttrs on the live N.js", () => {
  const src = readFileSync(NJS, "utf8");
  const r = extractSaveAttrs(src);
  const a = Object.fromEntries(Object.entries(r.attrs).map(([k, v]) => [k, { key: v.key, perPlayer: v.perPlayer }]));

  it("finds the account and per-player attributes, with the elements named Attr[i]", () => {
    expect(a.OptionsListAccount).toEqual({ key: "OptLacc", perPlayer: false });
    expect(a.StampLevel).toEqual({ key: "StampLv", perPlayer: false });
    expect(a.Guild).toBeUndefined();
    expect(a.GuildTasks).toEqual({ key: "Guild", perPlayer: false });
    expect(a.Lv0).toEqual({ key: "Lv0", perPlayer: true });
    expect(a.EquipmentOrder).toEqual({ key: "EquipOrder", perPlayer: true });
    expect(a["Tasks[2]"]).toEqual({ key: "TaskZZ2", perPlayer: false });
    expect(a["Cards[0]"]).toEqual({ key: "Cards0", perPlayer: false });
    expect(a["Cards[2]"]).toEqual({ key: "CardEquip", perPlayer: true });
    expect(a["EquipmentMap[0]"]).toEqual({ key: "EMm0", perPlayer: true });
    expect(a["PostOfficeInfo[2]"]).toEqual({ key: "PostOfficeInfo2", perPlayer: false });
  });

  it("never maps a scratch attribute or the live map", () => {
    expect(Object.keys(a).filter((k) => /^Dummy/.test(k))).toEqual([]);
    expect(a).not.toHaveProperty("CurrentMap");
  });

  it("is what is committed in lib/game/data/saveAttrs.gen.ts (regenerate it when N.js changes)", () => {
    expect(SAVE_ATTRS).toEqual(a);
  });
});
