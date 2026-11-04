// What the game does to a save while loading it, before it computes anything on it: the steps an older save needs.
//
// The game never computes on a save as it is stored. Loading one, it:
//   1. starts the attributes at their init values (`ClearLocalData`), then the cloud loader (`_customEvent_LoadAllData`) replaces each
//      one from its save key, some only from a save version on (`<v> <= getLoad("CSver")`): a save below keeps the init value, even
//      when it has the key;
//   2. calls initialize1, which runs on to initialize2, 3 and 4 (each one's last statement): they fill an attribute that is still
//      empty with its starting lists (`if (0 == X.length)`);
//   3. on pressing Play, runs WhenUPressPlayButton, which runs on to OnPlayStart2, 3 and 4: the one-time migrations, blocks gated by
//      `<N> > DoOnceREAL` that raise DoOnceREAL (to N.1...), so each runs once per account, in order; the next save stores the result
//      (CloudSAVE writes CSver 34.05 and DoOnceREAL every time, @6473294).
// `migrate` replays those steps on the parsed save, in the game's order, before the state is frozen, so an older save reads what the
// game reads. Only the steps whose result Artifact Find reads (its terms and the Tome score of its Lore Episode) are ported, each with
// its gate and its offset in the live N.js; they were found by running the refused real saves (each next missing key led to the step
// that creates it) and by reading every other block those saves pass, which the list at the end of the file accounts for.
//
// Strictness:
//   - a step that needs a key the save lacks is not guessed: it throws MissingSaveKey, which the state then throws on every read;
//   - a save without CSver or DoOnceREAL runs no step of that kind: what the loader gets for a key the save lacks is the host's
//     answer (`u.getLoad`, outside N.js), and no real save lacks them; the attributes are then read as saved, strictly;
//   - a save old enough to run a block that is not examined here (DoOnceREAL below 367) is refused (OLDEST_GATE).
import { SAVE_ATTRS } from "./data/saveAttrs.gen";
import { InvalidSaveValue, MissingSaveKey } from "./errors";

type Data = Record<string, unknown>;
type Corrupt = Readonly<Record<string, string>>;

/** A load step: changes the parsed save in place and says whether its gate let it run. `id` names it and its N.js offset. */
type Step = { readonly id: string; readonly run: (d: Data, corrupt: Corrupt) => boolean };

/** The save key the loader fills account attribute `name` from (SAVE_ATTRS). */
function keyOf(name: string): string {
  const e = SAVE_ATTRS[name];
  if (!e || e.perPlayer) throw new Error(`migrations: ${name} is not an account attribute of SAVE_ATTRS`);
  return e.key;
}

/** `getGameAttribute(name)[idx0][idx1]...` on the save being migrated, a list. Absent: MissingSaveKey; corrupt or not a list: InvalidSaveValue. */
function list(d: Data, corrupt: Corrupt, name: string, ...idx: number[]): unknown[] {
  const key = keyOf(name);
  if (Object.hasOwn(corrupt, key)) throw new InvalidSaveValue(key, "valid JSON", corrupt[key]);
  let v = d[key];
  for (let i = 0; i <= idx.length; i++) {
    const at = key + idx.slice(0, i).map((j) => `[${j}]`).join("");
    if (v === undefined || v === null) throw new MissingSaveKey(at);
    if (!Array.isArray(v)) throw new InvalidSaveValue(at, "a list", v);
    if (i < idx.length) v = v[idx[i]];
  }
  return v as unknown[];
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
  run: (d) => {
    if (d.CSver === undefined || d.CSver === null || minCSver <= Number(d.CSver)) return false;
    d[keyOf(name)] = [];
    return true;
  },
});

/** initialize1..4's `if (0 == <name>.length) { … }` (`at`): an empty list gets its starting lists. A save without the key is left to the reads. */
const initFill = (fn: string, name: string, at: number, fill: () => unknown[]): Step => ({
  id: `${name} filled (${fn} @${at})`,
  run: (d, corrupt) => {
    const v = d[keyOf(name)];
    if (Object.hasOwn(corrupt, keyOf(name)) || !Array.isArray(v) || 0 != v.length) return false;
    v.push(...fill());
    return true;
  },
});

/** DoOnceREAL as the loader leaves it: the save's, except -1, when the init 0 (@6572169) stays (`-1 != getLoad("DoOnceREAL")` @19926761). */
function doOnce(d: Data): number | undefined {
  const v = d.DoOnceREAL;
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number") throw new InvalidSaveValue("DoOnceREAL", "a number", v);
  return v === -1 ? 0 : v;
}

/** An OnPlayStart block `if (<gate> > DoOnceREAL) { DoOnceREAL = <set>; … }` at `at`. */
const once = (fn: string, gate: number, set: number, at: number, body: (d: Data, corrupt: Corrupt) => void): Step => ({
  id: `${fn} DoOnceREAL < ${gate} @${at}`,
  run: (d, corrupt) => {
    const v = doOnce(d);
    if (v === undefined || !(gate > v)) return false;
    d.DoOnceREAL = set;
    body(d, corrupt);
    return true;
  },
});

/**
 * The oldest block examined: every block from here on is ported or accounted for at the end of the file. A save below it would also
 * run older blocks (351, 352, 366, 367 and before), which nothing here replays, so its state would be half migrated: it is refused.
 * Two real saves are: 5OhTree (DoOnceREAL 340.1) and HourZero (248.3). Neither could compute anyway: below CSver 30 the loader leaves
 * Sushi at its value before the load, which ClearLocalData does not reset, so it is the attribute's default from the game's data file
 * (game.mbs, read by restoreGameAttributes @1665863), not in N.js.
 */
export const OLDEST_GATE = 367;

/** The refusal of a save below OLDEST_GATE. */
export const UNPORTED_STEPS = `the game's load steps for DoOnceREAL < ${OLDEST_GATE}`;

// The starting lists of the init fills: lists of one value, by length (0: an empty list). The test reads each fill back from N.js.
const ROYALG_ROWS: readonly number[] = Object.freeze([8, 80, 99, 20, 160, 160, ...filled(16, 0), 50, 15]);
const ROYALMAPS_1: readonly number[] = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0, 211111111, 0]);
const MENAGERIE_ROWS: readonly number[] = Object.freeze([20, 50, 50, 50, 14, 9, 17, 17]);

/** The steps, in the order the game runs them. */
export const MIGRATIONS: readonly Step[] = Object.freeze([
  // ── 1. the loader ──
  loaderInit("RoyalG", 33, 19944816, 6586076),
  loaderInit("RoyalMaps", 33, 19944816, 6586120),
  loaderInit("Menagerie", 34, 19944986, 6586152),
  // ── 2. initialize1..4 ──
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
    run: (d) => {
      const v = doOnce(d);
      if (v !== undefined && OLDEST_GATE > v) throw new MissingSaveKey(UNPORTED_STEPS);
      return false;
    },
  },
  once("OnPlayStart4", 371, 371.1, 6458509, (d, c) => {
    while (701 > list(d, c, "OptionsListAccount").length) list(d, c, "OptionsListAccount").push(0);
  }),
  // OptionsListAccount[200] is the account's highest Drop Rate (the Tome's row 31). The game raises it again from the live Drop Rate as
  // soon as a character plays (`TotalStats("Drop_Rarity") > OLA[200]` @5739878); that is runtime, so the save after its load keeps 1.
  once("OnPlayStart4", 378, 378.1, 6459191, (d, c) => {
    list(d, c, "OptionsListAccount")[200] = 1;
    list(d, c, "OptionsListAccount")[606] = "";
  }),
  // The Spelunk part of the block (see the end of the file for the rest)
  once("OnPlayStart4", 380, 380.1, 6459396, (d, c) => {
    const spelunk = list(d, c, "Spelunk");
    if (48 > spelunk.length) spelunk.push(filled(15, 0));
    if (49 > spelunk.length) spelunk.push([]);
  }),
  once("OnPlayStart4", 382, 382.1, 6461273, (d, c) => {
    if (23 == list(d, c, "RoyalG").length) list(d, c, "RoyalG").push(filled(15, 0));
  }),
  once("OnPlayStart4", 395, 395.1, 6465133, (d, c) => {
    while (40 > list(d, c, "Ninja", 103).length) list(d, c, "Ninja", 103).push(0);
    list(d, c, "OptionsListAccount")[519] = -1;
    const spelunk = list(d, c, "Spelunk");
    if (50 > spelunk.length) spelunk.push(filled(37, 0));
    if (51 > spelunk.length) spelunk.push([]);
    if (52 > spelunk.length) spelunk.push([]);
    if (53 > spelunk.length) spelunk.push([]);
    if (54 > spelunk.length) spelunk.push([]);
    list(d, c, "Menagerie", 0)[6] = 1;
  }),
]);

/**
 * Runs every step on the parsed save `d` (changed in place), in order: the ids of the steps that ran, and the refusal of the first step
 * that could not run (the steps after it do not run; GameState then refuses every read).
 */
export function migrate(d: Data, corrupt: Corrupt): { steps: string[]; refusal?: MissingSaveKey | InvalidSaveValue } {
  const steps: string[] = [];
  for (const s of MIGRATIONS) {
    try {
      if (s.run(d, corrupt)) steps.push(s.id);
    } catch (e) {
      if (e instanceof MissingSaveKey || e instanceof InvalidSaveValue) return { steps, refusal: e };
      throw e;
    }
  }
  return { steps };
}

// Not ported, because Artifact Find (its terms and lib/tome's rows) reads none of what they write. Each was also applied by hand to
// every real save that passes it: no total moved.
//   - the loader's other CSver gates: an older save of the real ones lacks only GreenStacks (31) and CookMaster (32), never read;
//   - OnPlayStart4 369 (CogOrder "Player_" slots to "Blank"), 370 (CookMaster ranks), 374 (OptionsListAccount[602] + 2), 375
//     (Holes[11] null -> 0: lib/tome reads Number(null) = 0 alike), 384 (DoOnceREAL only), 385 (Ribbon), 386 (five Research lists
//     after the 14th: nothing reads past Research[12]), 389 (Sushi[4][8] = 0, Research[7][10] = 3), 390 (Holes[28] to 60), 398
//     (OptionsListAccount and GemItemsPurchased resets, Research[13], cleanMarkedFiles), 399 (a 55th Spelunk list: nothing reads past
//     Spelunk[50]);
//   - the rest of 380: each Royal Guardian outpost map without a list gets [0] (RoyalMaps, via RoyalG("HasOutpost")), which the Tome's
//     outpost count (lists of 3 fields or more) does not count, and every LockedSlots is padded to 112.
