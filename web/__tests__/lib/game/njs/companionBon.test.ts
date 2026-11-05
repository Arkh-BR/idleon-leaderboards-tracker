// DNSM.CompanionBon on the Pet Park map (CurrentMap 41, N.js @10651111): the map-load code first drops from the Pet-Bonus Token list
// the ids already owned and "11 150 151 152 164 165 166". A synthetic envelope, so CI runs it (no real save).
import { describe, expect, it } from "vitest";
import { makeCtx } from "@/lib/game/ctx";
import { CompanionDB } from "@/lib/game/data";
import { Companions } from "@/lib/game/njs/Companions";
import { DNSM_CompanionBon } from "@/lib/game/njs/DNSM";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

const ctxOf = (map: number, owned: string[], tokens: string) => {
  const opt: unknown[] = [];
  opt[606] = tokens;
  const env = { data: { OptLacc: opt }, charNames: ["c0"], companion: { l: owned }, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 } as unknown as GameEnvelope;
  return makeCtx(buildGameState(env), { player: 0, map });
};
const db = (id: number, i: number) => Number(CompanionDB[id][i]);

describe("DNSM.CompanionBon on map 41 (Pet Park)", () => {
  // 43 owned at stage 1 (CompanionDB[43][11]); tokens 43 (owned), 150 (in the fixed list) and 56 (neither)
  const owned = ["43,1,0,5,1"];
  it("drops the owned ids and the fixed list from the tokens; the rest still counts", () => {
    const m = DNSM_CompanionBon(ctxOf(41, owned, "43,150,56"));
    expect(m.get("43")).toBe(db(43, 11)); // the owned stage-1 value stays: the token for 43 was dropped
    expect(m.has("150")).toBe(false);
    expect(m.get("56")).toBe(db(56, 2));
  });
  it("is the same list on any other map, where the tokens all count (43 is overridden to [2], 150 is given)", () => {
    const m = DNSM_CompanionBon(ctxOf(0, owned, "43,150,56"));
    expect(m.get("43")).toBe(db(43, 2));
    expect(m.get("150")).toBe(db(150, 2));
    expect(m.get("56")).toBe(db(56, 2));
  });
  it("nothing left of the list rebuilds to \"\", which splits back to id 0's key \"\" (as the game)", () => {
    const m = DNSM_CompanionBon(ctxOf(41, owned, "43,11"));
    expect(m.get("")).toBe(db(0, 2));
    expect(m.has("43") && m.get("43") === db(43, 2)).toBe(false);
  });
  it("Companions() reads it", () => {
    expect(Companions(ctxOf(41, owned, "43"), 43)).toBe(db(43, 11));
    expect(Companions(ctxOf(0, owned, "43"), 43)).toBe(db(43, 2));
  });
});
