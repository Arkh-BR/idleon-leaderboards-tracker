import { asNumber } from "./attr";
import type { Ctx } from "./ctx";
import { MapAFKtarget, MapAFKtargetSide, MapName } from "./data";
import { hString } from "./hstring";
import { contains } from "./lists";
import { charKey, opt } from "./state";

/**
 * `getGameAttribute("AFKtarget")` of the player on map `ctx.map` (Ruling V). The save keeps the target (`AFKtarget_<player>`) of the map
 * the character was on (`CurrentMap_<player>`). The scene load @15291900 rewrites it for another map (not in the Tutorial, not while a
 * character swap is running, which a tracked character is not): it keeps the saved target when it is in MapAFKtargetSide[map], or is
 * "Cooking" in xSpaceaaTown, or one of the listed targets in ySnowD3 (Marble, Tree11, Bug11, FishEquinox) or wLavaAhole (Motherlode,
 * MotherlodeTREE, MotherlodeFISH, Bug14, caveB, caveC, caveD, Filler, or any "Monument"); else it is MapAFKtarget[map], and "plank" in
 * ForestBOSS (@15292180). The attack handler (@5308217) rewrites it alike while fighting.
 */
export function afkTarget(ctx: Ctx): string {
  const saved = hString(opt(ctx.state, charKey("AFKtarget", ctx.player)));
  if (asNumber(opt(ctx.state, charKey("CurrentMap", ctx.player))) === ctx.map) return saved;
  const scene = hString((MapName as unknown as readonly unknown[])[ctx.map]);
  const side = (MapAFKtargetSide as unknown as readonly unknown[][])[ctx.map];
  const keep =
    contains(side, saved) ||
    ("Cooking" == saved && "xSpaceaaTown" == scene) ||
    ("ySnowD3" == scene && ["Marble", "Tree11", "Bug11", "FishEquinox"].includes(saved)) ||
    ("wLavaAhole" == scene && (["Motherlode", "MotherlodeTREE", "MotherlodeFISH", "Bug14", "caveB", "caveC", "caveD", "Filler"].includes(saved) || -1 != saved.indexOf("Monument")));
  if (keep) return saved;
  return "ForestBOSS" == scene ? "plank" : hString((MapAFKtarget as unknown as readonly unknown[])[ctx.map]);
}
