// What the game does to a save while loading it, before it computes anything on it: the steps an older save needs.
//
// The game never computes on a save as it is stored. Loading one, it:
//   1. starts the attributes at their init values (`ClearLocalData`), then the cloud loader (`_customEvent_LoadAllData`) replaces each
//      one from its save key, some only from a save version on (`<v> <= getLoad("CSver")`): a save below keeps the init value, even
//      when it has the key;
//   2. calls initialize1, which runs on to initialize2, 3 and 4 (each one's last statement): they fill an attribute that is still
//      empty with its starting lists (`if (0 == X.length)`), and pad some lists to the length the game data now has;
//   3. on pressing Play, runs WhenUPressPlayButton, which runs on to OnPlayStart2, 3 and 4: the one-time migrations, blocks gated by
//      `<N> > DoOnceREAL` that raise DoOnceREAL (to N.1...), so each runs once per account, in order; the next save stores the result
//      (CloudSAVE writes CSver 34.05 and DoOnceREAL every time, @6473294).
// `migrate` replays those steps on the parsed save, in the game's order, before the state is frozen, so an older save reads what the
// game reads. Only the steps (or the parts of a step) whose result Artifact Find or the Damage plan's ports read (Artifact Find's terms
// and the Tome score of its Lore Episode; the character stats) are ported, each with its gate and its offset in the live N.js; they were found by running the refused real saves (each next missing
// key led to the step that creates it) and by reading every other step those saves pass, which the list at the end of the file accounts
// for (each of those was also applied by hand to every real save that passes it: no total moved).
//
// Strictness:
//   - a step that needs a key the save lacks is not guessed: it throws MissingSaveKey, which the state then throws on every read;
//   - a fill or a pad of an attribute the save lacks leaves it to the reads (they refuse it): the game always has the attribute, a
//     save only lacks it when it is synthetic or when a loader step below did not give it;
//   - a save without CSver or DoOnceREAL runs no step of that kind. N.js would not read it as saved: its CSver gates keep every gated
//     attribute at its init (`33 <= getLoad("CSver")` is false for null and undefined), and what its DoOnceREAL gates do depends on what
//     the host's getLoad returns. But no real save lacks either key (CloudSAVE writes both): only the synthetic envelopes of the tests
//     omit them, and those are read as saved;
//   - a value the save cannot give is an assumption, named in `assumed` (the state keeps it, the trace shows it);
//   - a save old enough to run a block that is not examined here (DoOnceREAL below OLDEST_GATE) is refused.
import { asNumber } from "./attr";
import { CompassUpg, MapAFKtarget, MapDetails, Titans } from "./data";
import { SAVE_ATTRS } from "./data/saveAttrs.gen";
import { InvalidSaveValue, MissingSaveKey, OLDEST_GATE, UNPORTED_STEPS } from "./errors";

type Data = Record<string, unknown>;
type Corrupt = Readonly<Record<string, string>>;
/** The save being loaded: its parsed keys (changed in place), the corrupt ones, and the number of characters (PlayerDATABASE). */
type Load = { readonly d: Data; readonly corrupt: Corrupt; readonly players: number };
/**
 * What a step assumes when the save cannot give a value: `key` is the save key (or address) it is about, `value` the one used if a number.
 * `note` is what a page shows (one short sentence); `detail` the full reason, with the N.js offsets, kept on the trace.
 */
export type Assumption = { readonly key: string; readonly note: string; readonly detail?: string; readonly value?: number };

/** A load step: changes the save in place and says whether its gate let it run. `id` names it and its N.js offset. */
type Step = { readonly id: string; readonly assumes?: Assumption; readonly run: (l: Load) => boolean };

/** The save key the loader fills account attribute `name` from (SAVE_ATTRS). */
function keyOf(name: string): string {
  const e = SAVE_ATTRS[name];
  if (!e || e.perPlayer) throw new Error(`migrations: ${name} is not an account attribute of SAVE_ATTRS`);
  return e.key;
}

/** `PlayerDATABASE[character i].<name>`: the per-character save key, `Lv0_3`. */
function playerKey(name: string, i: number): string {
  const e = SAVE_ATTRS[name];
  if (!e || !e.perPlayer) throw new Error(`migrations: ${name} is not a per-character attribute of SAVE_ATTRS`);
  return `${e.key}_${i}`;
}

/** The list at save key `key`, then `[idx0][idx1]...`. Absent: MissingSaveKey; corrupt or not a list: InvalidSaveValue. */
function listAt(l: Load, key: string, idx: readonly number[]): unknown[] {
  if (Object.hasOwn(l.corrupt, key)) throw new InvalidSaveValue(key, "valid JSON", l.corrupt[key]);
  let v = l.d[key];
  for (let i = 0; i <= idx.length; i++) {
    const at = key + idx.slice(0, i).map((j) => `[${j}]`).join("");
    if (v === undefined || v === null) throw new MissingSaveKey(at);
    if (!Array.isArray(v)) throw new InvalidSaveValue(at, "a list", v);
    if (i < idx.length) v = v[idx[i]];
  }
  return v as unknown[];
}

/** `getGameAttribute(name)[idx0][idx1]...`, a list. */
const list = (l: Load, name: string, ...idx: number[]): unknown[] => listAt(l, keyOf(name), idx);

/** A list the game always has, or undefined when the save lacks it (a fill or a pad then leaves it to the reads). */
function present(l: Load, name: string): unknown[] | undefined {
  const key = keyOf(name);
  return l.d[key] === undefined || l.d[key] === null ? undefined : listAt(l, key, []);
}

/** `n` copies of `v`: the lists the game builds with `DummyList2 = []` and `n` pushes. */
const filled = (n: number, v: number): number[] => Array<number>(n).fill(v);

/**
 * The loader's `<minCSver> <= getLoad("CSver") && (<name> = getLoadJsonList(<key>))` (`gateAt`): below the gate the attribute keeps its
 * init `[]` (`ClearLocalData`, `initAt`), whatever the save holds under the key. The comparison is JavaScript's, as in the game (a
 * string CSver is read as its number).
 */
const loaderInit = (name: string, minCSver: number, gateAt: number, initAt: number): Step => ({
  id: `${name} = [] (loader: CSver < ${minCSver} @${gateAt}, init @${initAt})`,
  run: ({ d }) => {
    if (d.CSver === undefined || d.CSver === null || minCSver <= Number(d.CSver)) return false;
    d[keyOf(name)] = [];
    return true;
  },
});

/**
 * The same gate for an attribute ClearLocalData does NOT reset: below the gate it keeps the value it held before the load, which for
 * the first account of a session is its default in the game's data file (game.mbs: the engine copies GameModel's attributes at start,
 * @1617028, read @2018985). N.js does not hold that default. It is assumed empty: the initialize fill (or pad) that follows is the
 * only code that gives a new account the attribute's lists, which it does only to an empty one.
 */
const assumedEmpty = (name: string, minCSver: number, gateAt: number, then: string): Step => ({
  id: `${name} = [] assumed (loader: CSver < ${minCSver} @${gateAt}; no ClearLocalData reset)`,
  assumes: {
    key: keyOf(name),
    note: `${name} counted as empty on a save this old (the game's own default is not in its code)`,
    detail: `${name}: the loader reads it only from CSver ${minCSver} (@${gateAt}) and ClearLocalData does not reset it, so it is the attribute's default from game.mbs (outside N.js), assumed empty: ${then} fills it`,
  },
  run: ({ d }) => {
    if (d.CSver === undefined || d.CSver === null || minCSver <= Number(d.CSver)) return false;
    d[keyOf(name)] = [];
    return true;
  },
});

/** initialize1..4's `if (0 == <name>.length) { … }` (`at`): an empty list gets its starting lists (`fill` may write more, like the game). */
const initFill = (fn: string, name: string, at: number, fill: (l: Load) => unknown[]): Step => ({
  id: `${name} filled (${fn} @${at})`,
  run: (l) => {
    if (Object.hasOwn(l.corrupt, keyOf(name))) return false;
    const v = present(l, name);
    if (!v || 0 != v.length) return false;
    v.push(...fill(l));
    return true;
  },
});

/** An ungated statement of initialize1..4 (`at`) on an attribute the game always has; `run` says whether it changed anything. */
const pad = (fn: string, what: string, at: number, run: (l: Load) => boolean): Step => ({ id: `${what} (${fn} @${at})`, run });

/** DoOnceREAL as the loader leaves it: the save's, except -1, when the init 0 (@6572169) stays (`-1 != getLoad("DoOnceREAL")` @19926761). */
function doOnce(d: Data): number | undefined {
  const v = d.DoOnceREAL;
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number") throw new InvalidSaveValue("DoOnceREAL", "a number", v);
  return v === -1 ? 0 : v;
}

/** An OnPlayStart block `if (<gate> > DoOnceREAL) { DoOnceREAL = <set>; … }` at `at`; `part` names what is ported when not all of it. */
const once = (fn: string, gate: number, set: number, at: number, body: (l: Load) => void, part?: string, assumes?: Assumption): Step => ({
  id: `${fn} DoOnceREAL < ${gate} @${at}${part ? ` (${part} only)` : ""}`,
  ...(assumes ? { assumes } : {}),
  run: (l) => {
    const v = doOnce(l.d);
    if (v === undefined || !(gate > v)) return false;
    l.d.DoOnceREAL = set;
    body(l);
    return true;
  },
});

/** Every character's list `name` (PlayerDATABASE[k].<name> for each k), strict. */
const eachPlayer = (l: Load, name: string, f: (v: unknown[]) => void) => {
  for (let i = 0; i < l.players; i++) f(listAt(l, playerKey(name, i), []));
};

/**
 * Block 378's reset of the account's highest Drop Rate: the Tome reads it (TomeQTY[18] = OptionsListAccount[200] @5746828) only after
 * raising it to the live Drop Rate (`TotalStats("Drop_Rarity") > OLA[200] && 216 != CurrentMap && (OLA[200] = …)` @5739715, in
 * `_customEvent_TomeQTY` @5739147), which this engine does not compute.
 */
export const DROP_RATE_RECORD: Assumption = Object.freeze({
  key: "OptLacc[200]",
  value: 1,
  note: "Tome counts the Drop Rate record at 1, where the game scores the live Drop Rate",
  detail: "TomeQTY raises OptionsListAccount[200] to the live TotalStats(Drop_Rarity) first (@5739715), not ported: the load step DoOnceREAL < 378 reset it to 1, and that value is used",
});

// The starting lists of the init fills (lists of one value by length; 0 is an empty list). The test reads each fill back from N.js.
const ROYALG_ROWS: readonly number[] = Object.freeze([8, 80, 99, 20, 160, 160, ...filled(16, 0), 50, 15]);
const ROYALMAPS_1: readonly number[] = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0, 211111111, 0]);
const MENAGERIE_ROWS: readonly number[] = Object.freeze([20, 50, 50, 50, 14, 9, 17, 17]);
const BUBBA_ROWS: readonly number[] = Object.freeze([20, 28, 28, 6, 8, 5]);
/** Spelunk's 55 starting lists, as [length, value] (lists 9 and 0-length ones spelled out below). */
const SPELUNK_ROWS: readonly (readonly [number, number])[] = Object.freeze([
  [15, 0], [15, 0], [15, 0], [12, 100], [30, 0], [90, -1], [0, 0], [5, -1], [60, 0], [-1, 0], [13, -1], [10, 0], [6, 0], [6, 0], [63, 0],
  [12, 0], [70, -1], [70, 0], [50, 0], [20, 0], ...Array.from({ length: 24 }, () => [20, -1] as const), [15, 0], [15, 0], [0, 0], [15, 0],
  [0, 0], [37, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
]);

/** The steps, in the order the game runs them. */
export const MIGRATIONS: readonly Step[] = Object.freeze([
  // ── 1. the loader ──
  loaderInit("Compass", 24, 19943880, 6585741),
  loaderInit("Arcane", 25, 19943977, 6585786),
  assumedEmpty("MapBon", 26, 19944068, "initialize3's pad to MapAFKtarget.length (@6297857)"),
  loaderInit("Spelunk", 27, 19944229, 6585830),
  loaderInit("Bubba", 28, 19944326, 6585875),
  loaderInit("Research", 29, 19944419, 6585918),
  assumedEmpty("Sushi", 30, 19944518, "initialize3 (@6326856)"),
  // GreenStacks (CSver 31): ClearLocalData resets it to [] (@6585981), so a save below the gate has none; MainframeBonus(11) reads its length
  loaderInit("GreenStacks", 31, 19944611, 6585981),
  loaderInit("CookMaster", 32, 19944713, 6586030),
  loaderInit("RoyalG", 33, 19944816, 6586076),
  loaderInit("RoyalMaps", 33, 19944816, 6586120),
  loaderInit("Menagerie", 34, 19944986, 6586152),
  // ── 2. initialize1..4 ──
  // initialize1 turns every null of OptionsListAccount into 0 (HourZero has three; the Tome reads them)
  pad("initialize1", "OptionsListAccount nulls set to 0", 6192268, (l) => {
    const ola = present(l, "OptionsListAccount");
    if (!ola) return false;
    let changed = false;
    for (let b = 0; b < ola.length; b++) if (null == ola[b]) (ola[b] = 0), (changed = true);
    return changed;
  }),
  // initialize2 pads DungUpg to 7 lists (@6236847): a 5th of 4 zeros, a 6th of 8 (the Flurbo shop, FlurboShop reads it) and a 7th of
  // 10, each only when the list is shorter. An empty DungUpg gets initialize2's fill of 7 lists first (@6233677, not ported: no real save
  // lacks it), which these pads then leave alone: here an empty one is left to the reads
  pad("initialize2", "DungUpg padded to 7 lists", 6236847, (l) => {
    const dung = present(l, "DungUpg");
    if (!dung || 0 == dung.length) return false;
    let changed = false;
    for (const [n, zeros] of [[5, 4], [6, 8], [7, 10]] as const) if (n > dung.length) dung.push(filled(zeros, 0)), (changed = true);
    return changed;
  }),
  initFill("initialize3", "Compass", 6297143, () => [[], [], [], [], []]),
  pad("initialize3", "Compass[0] and [1] padded to CompassUpg and Titans", 6297424, (l) => {
    const compass = present(l, "Compass");
    if (!compass) return false;
    let changed = false;
    for (; list(l, "Compass", 0).length < CompassUpg.length; changed = true) list(l, "Compass", 0).push(0);
    for (; list(l, "Compass", 1).length < Titans.length; changed = true) list(l, "Compass", 1).push(0);
    return changed;
  }),
  initFill("initialize3", "Arcane", 6297748, () => filled(100, 0)),
  // a list per map: [0, 0, 0] for a map with a monster, [0] for "Nothing" and "Z"; then an empty slot gets [0, 0, 0] and a monster map's
  // 1-long list two more zeros
  pad("initialize3", "MapBon padded to MapAFKtarget", 6297857, (l) => {
    const mapBon = present(l, "MapBon");
    if (!mapBon) return false;
    let changed = false;
    const monster = (i: number) => "Nothing" != MapAFKtarget[i] && "Z" != MapAFKtarget[i];
    if (mapBon.length < MapAFKtarget.length) {
      for (let f = 0, from = mapBon.length, g = Math.round(MapAFKtarget.length - mapBon.length); f < g; f++, changed = true) {
        const entry: number[] = [];
        if (monster(Math.round(from + f))) entry.push(0, 0);
        entry.push(0);
        mapBon.push(entry);
      }
    }
    for (let f = 0; f < mapBon.length; f++) {
      const e: unknown = mapBon[f];
      if (e == null) (mapBon[f] = [0, 0, 0]), (changed = true);
      else if (Array.isArray(e) && 1 == e.length && monster(f)) e.push(0, 0), (changed = true);
    }
    return changed;
  }),
  initFill("initialize3", "Spelunk", 6299892, (l) => {
    eachPlayer(l, "Lv0", (lv) => (lv[19] = 0)); // with Exp0[19] = 0 and ExpReq0[19] = 25, which nothing here reads
    list(l, "OptionsListAccount")[478] = 0;
    return SPELUNK_ROWS.map(([n, v], i) => (i === 9 ? [...filled(17, 0), 1, 1, 1, ...filled(17, 0)] : filled(n, v)));
  }),
  initFill("initialize3", "Bubba", 6317345, () => BUBBA_ROWS.map((n) => filled(n, 0))),
  // Research[5] and [6] get random map positions (c.randomInt(650, 900)...), which the save cannot give: nothing Artifact Find or the
  // Tome reads them, so they stay empty here
  initFill("initialize3", "Research", 6320178, (l) => {
    eachPlayer(l, "Lv0", (lv) => (lv[20] = 1)); // with Exp0[20] = 0 and ExpReq0[20] = 10
    return [
      filled(240, 0), filled(240, -1), filled(80, 0), filled(80, 0), filled(80, 0), [], [], [0, 75, 3, ...filled(17, 0)], filled(50, 0),
      filled(12, 0), filled(36, 0), [], filled(40, 0), filled(150, 0), filled(180, -1), filled(10, 0), filled(10, 0), filled(100, 0), [],
    ];
  }),
  initFill("initialize3", "Sushi", 6326856, () => {
    const sushi = [filled(120, -1), filled(120, -1), filled(50, 0), filled(15, -1), filled(20, 0), filled(100, -1), filled(100, 0), filled(100, 0)];
    for (const i of [50, 65, 51, 66, 52, 67, 53, 68, 54, 69]) sushi[1][i] = 0;
    return sushi;
  }),
  initFill("initialize3", "CookMaster", 6330480, () => [filled(100, 0), filled(30, 0), filled(6, 0), filled(10, 0)]),
  initFill("initialize4", "RoyalG", 6332042, () => ROYALG_ROWS.map((n) => filled(n, 0))),
  initFill("initialize4", "RoyalMaps", 6335691, () => {
    const maps: unknown[] = Array.from({ length: 400 }, () => []);
    maps[1] = [...ROYALMAPS_1];
    return maps;
  }),
  // MenagerieStuff's own `0 == Menagerie.length` guard never sees the empty list in the game: this fill runs first
  initFill("initialize4", "Menagerie", 6336662, () => MENAGERIE_ROWS.map((n) => filled(n, 0))),
  // ── 3. WhenUPressPlayButton -> OnPlayStart2 -> 3 -> 4 ──
  {
    id: `refuse DoOnceREAL < ${OLDEST_GATE}`,
    run: ({ d }) => {
      const v = doOnce(d);
      if (v !== undefined && OLDEST_GATE > v) throw new MissingSaveKey(UNPORTED_STEPS);
      return false;
    },
  },
  once("OnPlayStart3", 251, 251.3, 6420350, (l) => {
    const h = (i: number) => list(l, "Holes", i);
    if ([0, 1, 2, 3, 4].every((i) => 30 < asNumber(h(24)[i]))) {
      for (let p = 0; p < 40; p++) h(24)[p] = Math.min(9, asNumber(h(24)[p]));
      for (let i = 0; i < 6; i++) h(14)[i] = Math.min(88888, asNumber(h(14)[i]));
      for (let i = 20; i < 30; i++) h(9)[i] = 0;
      for (let i = 0; i < 6; i++) h(17)[i] = 0;
      for (let i = 10; i < 16; i++) h(22)[i] = 0;
    }
    if (28 == list(l, "Holes").length) list(l, "Holes").push(filled(30, -1));
    if (71 <= h(11).length) for (let i = 65; i <= 70; i++) h(11)[i] = 0;
    h(11)[64] = 0;
  }),
  once("OnPlayStart3", 262, 262.5, 6423322, (l) => {
    const h = (i: number) => list(l, "Holes", i);
    if ([0, 1, 2].every((i) => 15 < asNumber(h(26)[i]))) {
      h(26).fill(2);
      h(27).fill(420);
      for (let i = 0; i < 6; i++) h(17)[i] = 0;
      for (let p = 0; p < h(22).length; p++) h(22)[p] = Math.min(150, asNumber(h(22)[p]));
      h(11)[38] = 1;
      h(11)[39] = 1;
      h(16)[5] = Math.min(50, asNumber(h(16)[5]));
      h(7)[9] = 0;
      h(3)[4] = 0;
      for (let i = 20; i < 30; i++) h(9)[i] = 1;
    }
    const totem = (i: number) => list(l, "TotemInfo", i);
    for (let p = 0; p < totem(0).length; p++) if (239 < asNumber(totem(0)[p])) (totem(0)[p] = 160), (totem(1)[p] = 10), (totem(2)[p] = 0);
    const ola = list(l, "OptionsListAccount");
    if (160 < asNumber(ola[209])) ola[209] = 120;
  }, "Holes, TotemInfo and OptionsListAccount[209] part"),
  once("OnPlayStart4", 268, 268.5, 6427584, (l) => {
    const ola = list(l, "OptionsListAccount");
    if (!(2e3 <= serverGemsReceived(l) + 1500 * asNumber(bundle(l, "bun_c")) || 1 != ola[380])) {
      ola[380] = 0;
      ola[379] = "null";
    }
  }),
  once("OnPlayStart4", 282, 282.3, 6429467, (l) => {
    list(l, "Summon", 0).push(...filled(11, 0));
  }),
  once("OnPlayStart4", 289, 289.3, 6430075, (l) => {
    while (100 > list(l, "FarmUpg").length) list(l, "FarmUpg").push(0);
    for (let b = 0; b < 24; b++) list(l, "GamingSprout", b)[2] = -1;
  }, "FarmUpg and GamingSprout part"),
  once("OnPlayStart4", 291, 291.3, 6431549, (l) => {
    for (const i of [0, 1, 2]) while (100 > list(l, "Meals", i).length) list(l, "Meals", i).push(0);
  }),
  once("OnPlayStart4", 294, 294.3, 6431943, (l) => {
    eachPlayer(l, "KillsLeft2Advance", (kla) => {
      for (let b = 0; b < 15; b++) kla[300 + b] = structuredClone((MapDetails as unknown as unknown[][])[300 + b][0]);
    });
    eachPlayer(l, "Lv0", (lv) => (lv[19] = 0));
  }, "KillsLeft2Advance and Lv0[19] part"),
  once("OnPlayStart4", 301, 301.3, 6433193, (l) => {
    const spelunk = list(l, "Spelunk");
    if (45 > spelunk.length) spelunk.push(filled(15, 0));
    if (46 > spelunk.length) spelunk.push(filled(15, 0));
  }),
  once("OnPlayStart4", 310, 310.3, 6437435, (l) => {
    for (let d = 0; d < 30; d++) if (50 > list(l, "Sailing", 3).length) list(l, "Sailing", 3).push(0);
    if (46 == list(l, "Spelunk").length) list(l, "Spelunk").push([]);
    if (!list(l, "Spelunk", 46).includes("EquipmentHats38")) list(l, "Spelunk", 46).push("EquipmentHats38");
  }, "Sailing[3] and Spelunk part"),
  once("OnPlayStart4", 313, 313.3, 6438064, (l) => {
    if (!(1 != list(l, "GemItemsPurchased")[90] || list(l, "Spelunk", 46).includes("EquipmentHats81"))) list(l, "Spelunk", 46).push("EquipmentHats81");
  }, "Spelunk[46] part"),
  once("OnPlayStart4", 327, 327.1, 6439234, (l) => {
    if (2 == list(l, "StatueG")[0] && 3 == list(l, "OptionsListAccount")[69]) list(l, "StatueG")[0] = 3;
  }, "StatueG[0] part"),
  once("OnPlayStart4", 331, 332.1, 6440539, (l) => {
    const ola = list(l, "OptionsListAccount");
    ola[498] = Math.min(9, asNumber(ola[498]));
    const artifacts = list(l, "Sailing", 3);
    for (let b = 0; b < artifacts.length; b++) if (6 <= asNumber(artifacts[b])) artifacts[b] = 5;
  }),
  // a null Sailing[3] element is not a 0: ArtifactBonus tests the raw element (null takes the base), a 0 gives 0
  once("OnPlayStart4", 337, 337.1, 6441027, (l) => {
    const artifacts = list(l, "Sailing", 3);
    for (let b = 0; b < artifacts.length; b++) if (artifacts[b] == null) artifacts[b] = 0;
  }, "Sailing[3] null -> 0 part"),
  once("OnPlayStart4", 351, 351.1, 6442863, (l) => {
    list(l, "Sushi", 4)[0] = 40;
    list(l, "OptionsListAccount")[449] = 0;
    while (60 > list(l, "Sailing", 3).length) list(l, "Sailing", 3).push(0);
  }),
  once("OnPlayStart4", 366, 366.1, 6443478, (l) => {
    const mapBon = list(l, "MapBon");
    mapBon[0] = [];
    list(l, "MapBon", 0).push(0, 0, 0);
    const m1 = list(l, "MapBon", 1);
    mapBon[1] = [m1[0], m1[1], m1[2]];
    const holes = list(l, "Holes");
    const fives = () => [filled(20, 0), filled(20, 0), filled(20, 0), filled(20, 0), filled(20, 0)];
    if (29 == holes.length) holes.push(Array.from({ length: 30 }, () => []));
    if (30 == holes.length) holes.push(filled(30, -1));
    if (31 == holes.length) holes.push(fives());
    if (32 == holes.length) holes.push(fives());
    if (33 == holes.length) holes.push(filled(3, 0));
    if (34 == holes.length) holes.push(filled(30, 0));
  }, "MapBon and Holes part"),
  once("OnPlayStart4", 371, 371.1, 6458509, (l) => {
    while (701 > list(l, "OptionsListAccount").length) list(l, "OptionsListAccount").push(0);
  }),
  once("OnPlayStart4", 378, 378.1, 6459191, (l) => {
    list(l, "OptionsListAccount")[200] = 1;
    list(l, "OptionsListAccount")[606] = "";
  }, undefined, DROP_RATE_RECORD),
  once("OnPlayStart4", 380, 380.1, 6459396, (l) => {
    const spelunk = list(l, "Spelunk");
    if (48 > spelunk.length) spelunk.push(filled(15, 0));
    if (49 > spelunk.length) spelunk.push([]);
  }, "Spelunk part"),
  once("OnPlayStart4", 382, 382.1, 6461273, (l) => {
    if (23 == list(l, "RoyalG").length) list(l, "RoyalG").push(filled(15, 0));
  }),
  once("OnPlayStart4", 395, 395.1, 6465133, (l) => {
    while (40 > list(l, "Ninja", 103).length) list(l, "Ninja", 103).push(0);
    list(l, "OptionsListAccount")[519] = -1;
    const spelunk = list(l, "Spelunk");
    if (50 > spelunk.length) spelunk.push(filled(37, 0));
    if (51 > spelunk.length) spelunk.push([]);
    if (52 > spelunk.length) spelunk.push([]);
    if (53 > spelunk.length) spelunk.push([]);
    if (54 > spelunk.length) spelunk.push([]);
    list(l, "Menagerie", 0)[6] = 1;
  }),
  // the Cape Vine's list, Spelunk[54] (the Gallery reads it, TotalStats through it)
  once("OnPlayStart4", 399, 399.1, 6468343, (l) => {
    const spelunk = present(l, "Spelunk");
    if (spelunk && 54 == spelunk.length) spelunk.push([]);
  }),
]);

/**
 * `ServerGemsReceived` as the loader leaves it: `max(ServerGemsReceived, _DummyGEMS)` with `_DummyGEMS = max(getLoad("ServerGems"), 0)`
 * (@19945432, the end of the loader). Absent: refused.
 */
function serverGemsReceived(l: Load): number {
  const received = keyOf("ServerGemsReceived");
  for (const k of [received, "ServerGems"]) if (l.d[k] === undefined || l.d[k] === null) throw new MissingSaveKey(k);
  return Math.max(asNumber(l.d[received]), Math.max(asNumber(l.d.ServerGems), 0));
}

/** `BundlesReceived.h[<b>]`: an absent BundlesReceived is the loader's empty map (Ruling H), an absent bundle null. */
function bundle(l: Load, b: string): unknown {
  const m = l.d[keyOf("BundlesReceived")];
  if (m === undefined || m === null) return undefined;
  if (typeof m !== "object" || Array.isArray(m)) throw new InvalidSaveValue(keyOf("BundlesReceived"), "a map", m);
  return (m as Record<string, unknown>)[b];
}

/**
 * Runs every step on the parsed save (changed in place), in order: the ids of the steps that ran, what they assumed, and the refusal of
 * the first step that could not run (the steps after it do not run; buildGameState throws it).
 */
export function migrate(
  d: Data,
  corrupt: Corrupt,
  players: number
): { steps: string[]; assumed: Assumption[]; refusal?: MissingSaveKey | InvalidSaveValue } {
  const l: Load = { d, corrupt, players };
  const steps: string[] = [];
  const assumed: Assumption[] = [];
  for (const s of MIGRATIONS) {
    try {
      if (!s.run(l)) continue;
    } catch (e) {
      if (e instanceof MissingSaveKey || e instanceof InvalidSaveValue) return { steps, assumed, refusal: e };
      throw e;
    }
    steps.push(s.id);
    if (s.assumes) assumed.push(s.assumes);
  }
  return { steps, assumed };
}

// Not ported: Artifact Find (its terms and lib/tome's rows) and the Damage plan's ports read nothing they write, or they never run on a
// real save. Each one that runs on a real save was applied by hand to every real save it runs on, the state rebuilt, every character's
// Artifact Find total compared: none moved. Re-audited for the keys the character stats read (Damage Task 3): OptionsListAccount,
// Spelunk, CookMaster (round 1: their steps are above; the OptionsListAccount writes below are of indexes no stat reads), then
// PrayersActive, PrayersUnlocked, SaltLick, BuffsActive, FoodSlotsOwned, UpgVault, DungUpg (its pads are above), Menagerie[0] and
// OptionsListAccount[271], [279], [438] (round 2): nothing below writes them. Re-audited for the keys the talents and buffs read (Damage
// Task 4: Cards[1], RoyalG[0], StampLevelMAX, CauldronInfo[4], WeeklyBoss, Refinery[3..8][1], KillsLeft2Advance, AFKtarget, Lv0,
// CharacterClass, BuffsActive; a write scan of the live N.js): no load step writes them on a real save (DoOnceREAL >= 248.3). The writes found:
// the Cards[1] fills of initialize2 (@6210607, an empty list) and OnPlayStart3 (@6398533, DoOnceREAL < 168.5; @6416156, < 235), the
// Refinery[3..5][1] cap of 27 (@6385099, DoOnceREAL < 129.5), and the StampCheckFR81 of OnPlayStart3 (@6402394, the tail of the DoOnceREAL < 168 block, see the Damage Task 6 audit below; it
// never runs on a real save). Runtime writes (the attack, the brew UI, the AFK and buff handlers) are not load steps.
// Re-audited for the keys the equipment, cards, sets, food and meals read (Damage Task 5: Cards[0], [2], [3], EquipmentOrder,
// EquipmentQuantity, Meals[0], Ribbon, Ninja[104], CookMaster, FoodSlotsOwned; a write scan of the live N.js, @6184758-6475000): no step
// changes what they read on a real save (DoOnceREAL >= 248.3). The writes found: Cards[2] = 12 x "B" only inside initialize2's empty-Cards
// fill (@6211354); initialize2 @6212308 splices Cards[3] out and pushes an empty map on every load (the character's CSetEq goes back in when
// the character is picked, which the per-player state models, cardSet5 matches lib/arkh on every pair); Meals[0] capped at 90 (@6412306,
// DoOnceREAL < 213) and padded to 100 (@6431500, < 291: only indexes past the 74 meals), Ribbon[0..27] capped (@6462400, < 385.1;
// MealBonus reads Ribbon[28 + g]), Ninja[103]/[105] writes (Ninja[104] is not written). EquipmentOrder, EquipmentQuantity and
// FoodSlotsOwned have no load-step write. No step ported.
// Re-audited for the keys the alchemy, stamp, statue, prayer, shrine, lab, atom and Bubba terms read (Damage Task 6: CauldronInfo,
// CauldronBubbles, CauldronP2W, StampLevel, StatueLevels, Shrine, Lab, Atoms, Bubba, GreenStacks, TowerInfo, SaltLick, PrayersUnlocked,
// PrayersActive; a write scan of the live N.js, @6184758-6475000 and the loader). One step ported: GreenStacks (loader CSver 31, reset by
// ClearLocalData @6585981; MainframeBonus(11) reads its length, so it is read now). The rest, none on a real save (DoOnceREAL >= 248.3):
// CauldronP2W[2][1] cap and CauldronP2W[4][2(b+2)] / [1+2(b+2)] reset (DoOnceREAL < 82 and < 87), StampLevel[2] and StampLevelMAX[2] reset
// (< 6), SaltLick capped at its level cap (< 18.2), PrayersUnlocked set to PrayerMaxLv (< 74), the Atoms pads (< 134) and zeroing (< 135) and
// the cap of 13 on atoms past 4 (@6403800, < 173), Lab[14] padded to 25 (< 203); the pads of CauldronInfo, CauldronBubbles, TowerInfo,
// PrayersActive, Lab and Bubba are initialize fills of empty lists (Bubba's is above). StatueLevels and Shrine have no load-step write (the
// per-character StatueLevels pad to StatueInfo is in the initialize1 list below). StampCheckFR81 (OnPlayStart3 @6402394: a stamp over level 5 whose material cost is past 4e12 gets
// StampLevel = StampLevelMAX = 12 x StampDetails[4]) is the tail of OnPlayStart3's `if (168 > DoOnceREAL) { DoOnceREAL = 168.5; ... }`
// block, which opens @6398034 and closes @6402819 just before `if (173 > DoOnceREAL)` (brace nesting checked): DoOnceREAL < 168, never on a
// real save, which is why the stamps over that cost stay at their levels (10036 of 12611 stamps over level 5 on the real saves). Not ported.
// Re-audited for the keys the account systems read (Damage Task 7; a write scan of the live N.js, @6184758-6475000, with each write's
// DoOnceREAL block found by brace nesting, and the loader), per system:
//   - Research (Grid_Bonus 127/47/173 read Research[0][b], [1][b]): the initialize3 fill of an empty list (@6320648) and the later blocks
//     327 (Research[7][8]), 339 (a 14th list), 366 and 398 (Research[13]), 386 (five lists after the 14th), 389 (Research[7][10]); none
//     writes Research[0] or [1]. No step ported.
//   - Summoning (Grimoire, UpgVault, Summon[0], KRbest, Holes[28], KillsLeft2Advance, Tasks[3], CauldronInfo[0..3]): initialize fills of empty
//     lists (Grimoire, UpgVault, Summon, Tasks, Holes) and Tasks[3][b] padded with 0 to TaskUnlocks (initialize1, read as entries == 1: no
//     change); Summon[0] gets zeros at DoOnceREAL < 214, < 226 and < 282 (the last one ported above; zeros read as the absent 0 anyway),
//     UpgVault padded with 0 to 100 (< 242), Holes[28] padded with -1 to 60 (< 390: SummUpgBonus asks whether it contains b >= 0, no
//     change), KillsLeft2Advance[17] (< 11.2) and [300..314] (294, ported above). KRbest and CauldronInfo[0..3] have no load-step write.
//     No step ported.
//   - Holes (B_UPG 57 / 84 read Holes[9][1], [11][55], [13][b]; MonumentROGbonuses and Fountain_BonTOT Holes[15], [31], [32]; Cglunko
//     OptionsListAccount[649]): the initialize3 fill of an empty Holes, the blocks 251, 262 and 366 (ported above), 247 (< 247.3, no real
//     save), 254, 367, 375 (Holes[11] null -> 0: read through asNumber alike) and 390 (Holes[28]); no step writes OptionsListAccount[649].
//     No step ported.
//   - Farming, Workbench, Rift, Gaming, Thingies, Sailing, Breeding, Minehead, Spelunk and Divinity (FarmCrop, FarmUpg, Research[7][4] and
//     [9], TowerInfo, Rift[0], KRbest, Gaming[12], TotemInfo[0], OptionsListAccount[89, 152, 178, 329, 473, 476, 621], InventoryOrder,
//     ItemQuantity, ChestOrder/ChestQuantity, Cards[1], Sailing[1][0] and [3], Divinity[25, 28 + b, 39], EquipmentOrder[0][1], Spelunk[1, 2,
//     4, 5, 6, 44, 47]): the initialize fills of empty lists (TowerInfo, Rift, Divinity...), then blocks no real save runs (DoOnceREAL >=
//     248.3): TowerInfo zeroed (< 14.5), OptionsListAccount[89] capped (< 80.5), Rift[0..4] reset and Sailing[3] 3 -> 2 (< 150.5), Gaming[12]
//     and Rift[2] reset (< 152.5), the Divinity resets (< 127, < 129), Divinity[39] = 0 and Sailing[1] capped (< 173), Divinity[24] (< 243);
//     the blocks ported above (262: TotemInfo, 331: Sailing[3] past 5, 301, 310, 380, 395, 399: the Spelunk lists); 337 (Sailing[3] null -> 0,
//     ported above), 327 and 389 (Research[7][8],
//     [7][10]: not read). KRbest, FarmCrop, ChestOrder/ChestQuantity, InventoryOrder and EquipmentOrder have no load-step write. No step ported.
//   - the loader: Tess (CSver 26; not reset by ClearLocalData, so it would need an assumption; initialize3 fills it with [[], []]);
//   - initialize1: GemItemsPurchased padded to 300; OptionsListAccount padded to 17..70 and its 51..59 splice (no real save is that
//     short), its pads to 201..601 (only in the Tutorial scene); the starter star signs
//     of an empty StarSignsUnlocked and the task progress of a new account (no real save has either); CauldronJobs1 per character;
//     PostOfficeInfo[3]; the CauldronInfo pads (to AlchemyCoords and AlchemyDescription); every character's StatueLevels to StatueInfo;
//     Tasks[3] to TaskUnlocks; the chat, NonCloudsave and displayData lists (session state);
//   - initialize2: Cards, NONdummies (session runtime, Ruling A), StarSignProg to StarQuests, PldTraps, MaxCarryCap, PrinterXtra to 264,
//     CurrenciesOwned.NPC, StatueG to 60, the DungUpg fill of an empty list, AchieveReg to 420, ArcadeUpg to ArcadeShopInfo, one more Cooking slot, Pets to
//     150, Territory to 26, and the resets of a save below DoOnceREAL 71.2 (no real save);
//   - initialize3: the Breeding pads to PetStats, Ribbon to 28 + MealINFO, the resets below DoOnceREAL 122 and 195 (no real save), the
//     fills of Grimoire, Ribbon, UpgVault, Breeding, Lab... (no real save lacks them); inside the Research fill, Research[5] and [6]
//     get random map positions (c.randomInt), left empty above;
//   - OnPlayStart3: 254 (Holes[11][13], OptionsListAccount[354]); the rest of 262 (AnvilCraftStatus[0][36], every character's
//     inventory and LockedSlots padded to 112); 263 (OptionsListAccount[103], [26], cleanMarkedFiles, a host call);
//   - OnPlayStart4: 264, 267, 271, 273, 297, 299, 302, 333, 340, 384 (DoOnceREAL only); 265 (GemItemsPurchased[75], Compass[3] kept to
//     RANDOlist[112]); 266 and 295 (OptionsListAccount[370]); 272 and the OptionsListAccount pad of 327 (to 501 and 601: 371 pads to 701
//     after them); 279 (Refinery[3..8][4], OptionsListAccount[403/406/407]); 280 (Sailing[1] to 33); 281 (AnvilCraftStatus[3]); the rest
//     of 289 (OptionsListAccount[47], Ninja[103] to 30, which 395 pads to 40 after it, AnvilCraftStatus[6], GemItemsPurchased[126],
//     ShopStock); the rest of 294 (Exp0 / ExpReq0[19], OptionsListAccount[464]); 306 (OptionsListAccount[266, 330..393, 489]); the rest
//     of 310 (Gaming[13]) and 313 (OptionsListAccount[26], cleanMarkedFiles); 314, 315 (OptionsListAccount[484]); 316 (achievement
//     area checks, host calls on Electron); the rest of 327 (OptionsListAccount[493/496], Gaming[6] and [11], GamingSprout[33],
//     CogOrder, CogMap and FlagUnlock to 252, Research[7][8]); the rest of 337 (OptionsListAccount[523/590], the Cooking
//     caps); 339 (a 14th Research list, OptionsListAccount[520]); 352 (OptionsListAccount[325], GemsOwned); the rest of 366
//     (Research[13][0..1], OptionsListAccount[449/519], Holes[11][82]); 367 (Holes[29] null -> 0, Holes[26/27][15/16]); 369 (CogOrder
//     "Player_" slots to "Blank"), 370 (CookMaster ranks), 374 (OptionsListAccount[602] + 2), 375 (Holes[11] null -> 0: lib/tome reads
//     Number(null) = 0 alike), 385 (Ribbon), 386 (five Research lists after the 14th: nothing reads past Research[12]), 389
//     (Sushi[4][8] = 0, Research[7][10] = 3), 390 (Holes[28] to 60), 398 (OptionsListAccount and GemItemsPurchased resets,
//     Research[13], cleanMarkedFiles); the rest of 380 (each Royal Guardian
//     outpost map without a list gets [0] through RoyalG("HasOutpost"), which the Tome's outpost count, lists of 3 fields or more,
//     does not count; every LockedSlots padded to 112).
