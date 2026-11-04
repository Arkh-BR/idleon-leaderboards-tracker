// The save, read by the attribute names N.js uses: `attr(ctx, "OptionsListAccount", 227)` is
// `getGameAttribute("OptionsListAccount")[227]`, whatever key the cloud save keeps it under ("OptLacc").
//
// SAVE_ATTRS (data/saveAttrs.gen.ts, generated from the game's own cloud-load code) says which key
// feeds each attribute. Three shapes of entry:
//   - `{ key, perPlayer: false }`: the attribute is the save key (`OptionsListAccount` = `OptLacc`).
//   - `perPlayer: true`: one key per character, read as `<key>_<ctx.player>` (`Lv0` = `Lv0_3`).
//   - `Attr[i]`: the loader fills element i of the attribute from its own key (`Tasks[2]` = `TaskZZ2`),
//     so the first index of `attr(ctx, "Tasks", 2, ...)` picks the key.
// The game changes a few attributes after loading them, and `attr` returns what the loader read:
//   - `CauldronInfo[8]` is rebuilt from `CauldUpgXPs` and `CauldUpgLVs`;
//   - `GemsOwned` becomes `GemsOwned + max(ServerGems - ServerGemsReceived, 0)` and `ServerGemsReceived`
//     becomes `max(ServerGemsReceived, ServerGems)`, right after the load (`ServerGems` is the key `ServerGems`);
//   - `OptionsList[11]` and `[13]` come from `OptL2_<player>`.
// The generated file lists these writes ("Written again after the load") and the keys it did not map; a
// port that needs the changed value rebuilds it from those keys.
import type { Ctx } from "./ctx";
import { SAVE_ATTRS } from "./data/saveAttrs.gen";
import { UnknownAttribute } from "./errors";
import { charKey, opt } from "./state";
import { traceNode } from "./trace";

export { SAVE_ATTRS };

type Idx = string | number;

/**
 * Attributes N.js reads that its cloud loader never loads (Ruling A): not in SAVE_ATTRS, ported as
 * functions, ctx fields or game data instead. `attr` names the reason when asked for one.
 */
export const RUNTIME_ATTRS: readonly { name: string; reason: string }[] = [
  { name: "CurrentMap", reason: "live map: read ctx.map (the game writes it on every map change; CurrentMap_<n> only seeds it)" },
  { name: "CustomLists", reason: "game data, not save: lib/game/data (customlists.js)" },
  { name: "CustomMaps", reason: "game data, not save: the map definitions (lib/game/data has no accessor yet)" },
  { name: "DNSM", reason: "session runtime: the game's cache of computed values, ported as DNSM_* functions" },
  { name: "DummyNumbersStatManager", reason: "session runtime: the game's scratch map, never loaded from the save" },
  { name: "GetPlayersUsernames", reason: "character names: GameState.charNames (the envelope), not a save key" },
  { name: "ItemDefinitionsGET", reason: "game data, not save: lib/game/data (items.js)" },
  { name: "NONdummies", reason: "map-load runtime: built when the map loads, ported as NONdummies60" },
  { name: "Number2Letter", reason: "game constant: a letter table no loader writes" },
  { name: "PixelHelperActor", reason: "session runtime: the actors of the running scene" },
  { name: "PlayerDATABASE", reason: "assembled by the loader from the per-character attributes: read those with withPlayer(ctx, ci)" },
  { name: "UserInfo", reason: "session runtime: filled by the server login, not from a save key" },
];

const runtimeReason = new Map(RUNTIME_ATTRS.map((r) => [r.name, r.reason]));

/** `Name[i][j]`: where an attribute read is, for traces and errors. */
const address = (name: string, idx: readonly Idx[]): string => name + idx.map((i) => `[${i}]`).join("");

/** The SAVE_ATTRS entry for `name` (or its element `idx[0]`), and the indices left to walk inside it. */
function resolve(name: string, idx: readonly Idx[]) {
  if (Object.hasOwn(SAVE_ATTRS, name)) return { entry: SAVE_ATTRS[name], rest: idx };
  const element = idx.length ? `${name}[${idx[0]}]` : undefined;
  if (element !== undefined && Object.hasOwn(SAVE_ATTRS, element)) return { entry: SAVE_ATTRS[element], rest: idx.slice(1) };
  throw new UnknownAttribute(...unknownWhy(name, element));
}

/** What `UnknownAttribute` says: the runtime reason, else the elements it does have, else nothing. */
function unknownWhy(name: string, element: string | undefined): [string, string?] {
  const reason = runtimeReason.get(name);
  if (reason) return [name, reason];
  const n = Object.keys(SAVE_ATTRS).flatMap((k) => (k.startsWith(`${name}[`) ? [Number(k.slice(name.length + 1, -1))] : [])).sort((a, b) => a - b);
  if (!n.length) return [element ?? name];
  const range = n.every((v, i) => v === n[0] + i) ? `${name}[${n[0]}..${n[n.length - 1]}]` : n.map((v) => `${name}[${v}]`).join(", ");
  return [element ?? name, `${name} is loaded per element: ${range}`];
}

/**
 * `getGameAttribute(name)[idx0][idx1]...`. A per-player attribute reads the character `ctx.player`.
 * Throws `UnknownAttribute` for a name the loader does not load, `MissingSaveKey` (naming the save
 * key) when the save lacks the key, `InvalidSaveValue` when something on the path cannot be
 * indexed; an index the save does not have gives `undefined` (the caller decides: `asNum` is 0).
 * The save is read after the game's load steps (lib/game/migrations): an attribute an older save lacks that the game itself fills
 * in on load (Menagerie below CSver 34...) is there.
 */
export function attr(ctx: Ctx, name: string, ...idx: Idx[]): unknown {
  const { entry, rest } = resolve(name, idx);
  const key = entry.perPlayer ? charKey(entry.key, ctx.player) : entry.key;
  const whole = ctx.state.get(key);
  return rest.length ? opt(ctx.state, key, ...rest) : whole;
}

/**
 * N.js `c.asNumber` @1688426: null is 0, a number stays itself, a boolean is 1 or 0, a string goes
 * through `parseFloat`. Anything else is `parseFloat(Std.string(v))`; a list or a map prints as
 * `[…]` or `{…}`, which is NaN.
 */
export function asNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") return parseFloat(v);
  return NaN;
}

/**
 * `c.asNumber(getGameAttribute(name)[idx...])`. An index the save lacks is 0, as in the game, and
 * shows in the trace as an `(absent)` leaf. A missing save key is not an absent index: it throws.
 */
export function asNum(ctx: Ctx, name: string, ...idx: Idx[]): number {
  const v = attr(ctx, name, ...idx);
  if (v === undefined && ctx.trace) {
    ctx.trace.children.push(traceNode(ctx.trace, ctx.player, "(absent)", [address(name, idx)], 0, "absent: asNumber(null) = 0"));
  }
  return asNumber(v);
}
