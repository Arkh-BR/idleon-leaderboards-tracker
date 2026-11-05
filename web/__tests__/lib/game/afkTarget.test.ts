// afkTarget (Ruling V) on a synthetic envelope: a save that does not say which map the character is on is refused, not read as map 0.
import { describe, expect, it } from "vitest";
import { afkTarget } from "@/lib/game/afkTarget";
import { makeCtx } from "@/lib/game/ctx";
import { MissingSaveKey } from "@/lib/game/errors";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";

const ctxOf = (data: Record<string, unknown>, map: number) =>
  makeCtx(buildGameState({ data, charNames: ["c0"], companion: null, guildData: {}, serverVars: null, tournament: {}, accountCreateTime: 1, lastUpdated: 1 } as unknown as GameEnvelope), { player: 0, map });

describe("afkTarget", () => {
  it("refuses a save without CurrentMap_<player> (it would have read as map 0)", () => {
    expect(() => afkTarget(ctxOf({ AFKtarget_0: "Z" }, 0))).toThrow(expect.objectContaining({ name: "MissingSaveKey", key: "CurrentMap_0" }));
    expect(() => afkTarget(ctxOf({ AFKtarget_0: "Z" }, 0))).toThrow(MissingSaveKey);
  });
  it("on the character's saved map it is the saved target", () => {
    expect(afkTarget(ctxOf({ AFKtarget_0: "Mush", CurrentMap_0: 251 }, 251))).toBe("Mush");
  });
});
