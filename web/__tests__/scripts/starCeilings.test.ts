import { describe, expect, it } from "vitest";
import { starCeilingsOf } from "@/scripts/_shared/starCeilings";

const env = (data: Record<string, unknown>) => ({ charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1, data });

describe("starCeilingsOf", () => {
  it("takes the max SM cap per star talent over the chars, skips 625 and ids out of range", () => {
    const s = env({ SM_0: { 615: 50, 625: 9999, 700: 5 }, SM_1: { 615: 80, 616: 3 } });
    expect(starCeilingsOf(s, [0, 1])).toEqual({ 615: 80, 616: 3 });
  });
  it("a save the state refuses contributes nothing", () => {
    expect(starCeilingsOf(null, [0])).toEqual({});
  });
});
