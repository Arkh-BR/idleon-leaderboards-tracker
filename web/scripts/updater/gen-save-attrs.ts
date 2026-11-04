// gen-save-attrs: which save key does the game load each attribute from? From web/:
//
//   npx tsx scripts/updater/gen-save-attrs.ts
//
// Reads the cloud-load code of the live N.js (scripts/updater/.cache/N.new.js) and writes
// lib/game/data/saveAttrs.gen.ts. Two functions hold it:
//
//  - `_customEvent_LoadAllData` reads every save key with `u.getLoad<Kind>(<key>)`; <Kind> is
//    List, Map, String, JsonList or SparseList, or none (a number). The key is a literal
//    ("OptLacc") or `"<Key>_"+this._pID` (one key per character). The value goes to
//      account:    `p=u.getLoadList("OptLacc"); q.gameAttributes.h.OptionsListAccount=p`
//      element:    `getGameAttribute("PostOfficeInfo")[0]=u.getLoadList("PostOfficeInfo0")`
//      character:  `f.h.CardEquip=p`, a field of that character's PlayerDATABASE entry.
//  - `_customBlock_LoadPlayerInfo` copies the current character's fields into the attributes the
//    formulas read (`gameAttributes.h.PlacedTraps = DummyMap.h.PldTraps`, `getGameAttribute("Cards")[2]
//    = DummyMap.h.CardEquip`). A character field is named by where that copy puts it.
//
// An attribute whose elements come from their own keys has one entry per element, named
// `Attr[i]` (`Tasks[0]` = key TaskZZ0): the shape the loader gives it, and the smallest one that
// says which key feeds `attr(ctx, "Tasks", 0, 5)`. What cannot be said that way (a dynamic key,
// a computed index, a scratch map, a field no copy reaches) is not mapped, and the generated file
// lists it. Offsets are into the raw N.js, as the other N.js citations are.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readBody } from "./extract-formulas";

export type SaveAttr = { key: string; perPlayer: boolean };
export type Unmapped = { at: number; key: string; perPlayer: boolean; why: string };
export type Extracted = {
  /** Attribute (or `Attr[i]`) -> save key, with the N.js offset of the loader call. */
  attrs: Record<string, SaveAttr & { at: number }>;
  unmapped: Unmapped[];
  /** Attributes (or elements) the loader function writes again after loading them: the game then changes what `attr` returns. */
  rewritten: { name: string; at: number }[];
  /** Offsets of the two functions read (where their names start). */
  load: number;
  player: number;
};

/**
 * Loaded, but not an attribute the formulas read from the save. The game writes it more than 160
 * times at runtime (every map change), and the engine takes the map as an input instead (`ctx.map`);
 * the save's `CurrentMap_<n>` only seeds the first value.
 */
const LIVE: Record<string, string> = { CurrentMap: "live at runtime: read ctx.map" };

const LOAD_HEAD = "_customEvent_LoadAllData:function(){";
const PLAYER_HEAD = "_customBlock_LoadPlayerInfo=function(";
const IDENT = String.raw`[A-Za-z_$][\w$]*`;
const LOADER = new RegExp(String.raw`${IDENT}\.getLoad(List|Map|String|JsonList|SparseList)?\(`, "g");

/** Index of the paren that closes the one at `open` (string-aware). */
function closeParen(s: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let k = open; k < s.length; k++) {
    const c = s[k];
    if (quote) {
      if (c === "\\") k++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return k;
  }
  return -1;
}

/** The first argument of the call whose `(` is at `open`: up to the first comma outside brackets and strings. */
function firstArg(s: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let k = open + 1; k < s.length; k++) {
    const c = s[k];
    if (quote) {
      if (c === "\\") k++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (--depth < 0) return s.slice(open + 1, k);
    } else if (c === "," && depth === 0) return s.slice(open + 1, k);
  }
  return s.slice(open + 1);
}

/** A function's body (braces included), the offset of its `{` (`from`) and of its name (`at`). */
function bodyAt(src: string, head: string, what: string): { text: string; from: number; at: number } {
  const at = src.lastIndexOf(head);
  if (at < 0) throw new Error(`${what} (${head}) not found in the N.js`);
  const from = src.indexOf("{", at + head.length - (head.endsWith("{") ? 1 : 0));
  const body = readBody(src, from);
  if (!body) throw new Error(`${what}: unbalanced body`);
  return { text: body.text, from, at };
}

type Dest = { kind: "attr" | "field"; name: string; element?: number; storeAt?: number };

/** Where the current character's field ends up (LoadPlayerInfo): field -> attribute, or one element of it. */
function playerCopies(text: string): Map<string, { name: string; element?: number }> {
  const copies = new Map<string, { name: string; element?: number }>();
  const dummy = String.raw`getGameAttribute\("DummyMap"\)\.h\.(\w+)`;
  // d=<DummyMap>.h.F;  b.gameAttributes.h.G=d   (F may be wrapped in c.asNumber(...))
  for (const m of text.matchAll(new RegExp(String.raw`${dummy}\)?;\s*${IDENT}\.gameAttributes\.h\.(\w+)=\s*${IDENT}`, "g"))) copies.set(m[1], { name: m[2] });
  // getGameAttribute("G")[N]=<DummyMap>.h.F
  for (const m of text.matchAll(new RegExp(String.raw`getGameAttribute\("(\w+)"\)\[(\d+)\]=\s*${IDENT}\.engine\.${dummy}`, "g"))) {
    copies.set(m[3], { name: m[1], element: Number(m[2]) });
  }
  return copies;
}

/** Reads the key argument: a literal, `"<Key>_"+this.x` (per character), or something this does not map. */
function parseKey(arg: string): { key: string; perPlayer: boolean } | { dynamic: string } {
  const lit = /^"([\w]+)"$/.exec(arg);
  if (lit) return { key: lit[1], perPlayer: false };
  const per = /^"([\w]+)_"\+this\.[\w$]+$/.exec(arg);
  if (per) return { key: per[1], perPlayer: true };
  return { dynamic: /"([\w]*)"/.exec(arg)?.[1] ?? arg };
}

/** The attribute (or character field) a loader call at `callEnd` stores into, or why it is not clear. */
function destination(text: string, callStart: number, callEnd: number): Dest | { why: string } | null {
  const before = text.slice(Math.max(0, callStart - 200), callStart);
  const assign = /(?<![=!<>])=\s*$/.exec(before);
  if (!assign) return null; // not an assignment: a condition or an argument
  if (text[callEnd + 1] === "[") return { why: "indexed result" };
  const lhs = before.slice(0, assign.index);
  if (/\bthis\.[\w$]+$/.test(lhs)) return null; // a scratch number (this._DummyNumber=u.getLoad("CMmLENGTH"))

  const elemAttr = /getGameAttribute\("(\w+)"\)\[(\d+)\]$/.exec(lhs);
  if (elemAttr) return { kind: "attr", name: elemAttr[1], element: Number(elemAttr[2]) };
  const elemField = /getGameAttribute\("PlayerDATABASE"\)\.h\[""\+\s*\w+\]\.h\.(\w+)\[(\d+)\]$/.exec(lhs);
  if (elemField) return { kind: "field", name: elemField[1], element: Number(elemField[2]) };

  const v = new RegExp(String.raw`(?<![\w$.])(${IDENT})$`).exec(lhs)?.[1];
  if (!v) return { why: "no variable to follow" };
  // `<v>` is stored a few calls later; stop where `<v>` is assigned again (the loader reuses `p`, `t`)
  const rest = text.slice(callEnd + 1, callEnd + 1 + 400);
  const name = v.replace(/\$/g, "\\$"); // an identifier may hold `$`
  const again = new RegExp(String.raw`(?<![\w$.])${name}=(?!=)`).exec(rest);
  const scope = again ? rest.slice(0, again.index) : rest;
  const store = new RegExp(String.raw`(?:(gameAttributes)\.)?h\.(\w+)=\s*${name}(?![\w$])`).exec(scope);
  if (!store) return { why: "no attribute stores it" };
  return { kind: store[1] ? "attr" : "field", name: store[2], storeAt: callEnd + 1 + store.index };
}

/**
 * The writes to a loaded attribute that are not its load: a second `gameAttributes.h.X=` (GemsOwned
 * becomes `GemsOwned + ServerGems - ServerGemsReceived`), or an element or sub-element written into it
 * (`CauldronInfo[8]=[]`). `stores` are the offsets of the loads' own stores. One entry per name, first write.
 */
function rewrites(load: { text: string; from: number }, attrs: Extracted["attrs"], stores: Set<number>): Extracted["rewritten"] {
  const mapped = new Set(Object.keys(attrs).map((k) => k.split("[")[0]));
  const out: Extracted["rewritten"] = [];
  const note = (name: string, i: number) => {
    if (!out.some((w) => w.name === name)) out.push({ name, at: load.from + i });
  };
  for (const m of load.text.matchAll(/gameAttributes\.h\.(\w+)=(?!=)/g)) {
    if (mapped.has(m[1]) && !stores.has(m.index)) note(m[1], m.index);
  }
  const loads = new RegExp(String.raw`^\s*${IDENT}\.getLoad`); // `…[2]=u.getLoadList("TaskZZ2")`: the element's own load
  for (const m of load.text.matchAll(/getGameAttribute\("(\w+)"\)((?:\[[^\]]*\])+)=(?!=)/g)) {
    if (!mapped.has(m[1])) continue;
    const first = /^\[(\d+)\]/.exec(m[2])?.[1];
    const isLoad =
      first !== undefined &&
      m[2] === `[${first}]` &&
      Object.hasOwn(attrs, `${m[1]}[${first}]`) &&
      loads.test(load.text.slice(m.index + m[0].length));
    if (!isLoad) note(first === undefined ? m[1] : `${m[1]}[${first}]`, m.index);
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Every loader call of the live N.js mapped to the attribute it feeds. `src` is the raw N.js. */
export function extractSaveAttrs(src: string): Extracted {
  const flat = src.replace(/\n/g, " "); // a line break is a space; offsets stay the raw file's
  const load = bodyAt(flat, LOAD_HEAD, "the cloud load");
  const player = bodyAt(flat, PLAYER_HEAD, "LoadPlayerInfo");
  const copies = playerCopies(player.text);

  const attrs: Extracted["attrs"] = {};
  const clash = new Set<string>();
  const stores = new Set<number>(); // where the loader stores what it read (`gameAttributes.h.X=p`)
  const unmapped: Unmapped[] = [];
  const add = (name: string, e: SaveAttr, at: number) => {
    const old = Object.hasOwn(attrs, name) ? attrs[name] : undefined;
    if (old && (old.key !== e.key || old.perPlayer !== e.perPlayer)) clash.add(name);
    else attrs[name] ??= { ...e, at };
  };

  LOADER.lastIndex = 0;
  for (let m; (m = LOADER.exec(load.text)); ) {
    const open = m.index + m[0].length - 1;
    const close = closeParen(load.text, open);
    const at = load.from + m.index;
    const k = parseKey(firstArg(load.text, open).trim());
    const dest = destination(load.text, m.index, close);
    if (dest === null) continue; // not an assignment
    const note = (key: string, perPlayer: boolean, why: string) => unmapped.push({ at, key, perPlayer, why });
    if ("dynamic" in k) {
      note(k.dynamic, false, "dynamic key (a loop variable)");
      continue;
    }
    if ("why" in dest) {
      note(k.key, k.perPlayer, dest.why);
      continue;
    }
    if (dest.storeAt !== undefined) stores.add(dest.storeAt);
    if (/^Dummy/.test(dest.name)) {
      note(k.key, k.perPlayer, `scratch (${dest.name}) folded into other attributes`);
      continue;
    }
    if (dest.kind === "attr" && k.perPlayer) {
      note(k.key, true, `stored in ${dest.name}, not in a PlayerDATABASE field`);
      continue;
    }
    if (dest.kind === "field" && !k.perPlayer) {
      note(k.key, false, `a field (${dest.name}) fed by an account key`);
      continue;
    }

    let name = dest.name;
    let element = dest.element;
    if (dest.kind === "field") {
      const copy = copies.get(dest.name);
      if (!copy) {
        note(k.key, true, `${dest.name}: a PlayerDATABASE field LoadPlayerInfo never copies to an attribute`);
        continue;
      }
      if (copy.element !== undefined && element !== undefined) {
        note(k.key, true, `${dest.name}: element of a field copied to an element`);
        continue;
      }
      name = copy.name;
      element ??= copy.element;
    }
    const full = element === undefined ? name : `${name}[${element}]`;
    if (Object.hasOwn(LIVE, name)) {
      note(k.key, k.perPlayer, `${LIVE[name]}`);
      continue;
    }
    add(full, k, at);
  }
  for (const name of clash) {
    unmapped.push({ at: attrs[name].at, key: attrs[name].key, perPlayer: attrs[name].perPlayer, why: `${name}: two keys feed it` });
    delete attrs[name];
  }
  return { attrs, unmapped, rewritten: rewrites(load, attrs, stores), load: load.at, player: player.at };
}

/** The text of lib/game/data/saveAttrs.gen.ts. `sha` is the N.js version it was read from. */
export function renderSaveAttrs(r: Extracted, sha: string): string {
  const sorted = Object.entries(r.attrs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const lines = sorted.map(([n, e]) => `  ${JSON.stringify(n)}: { key: ${JSON.stringify(e.key)}, perPlayer: ${e.perPlayer} }, // @${e.at}`);
  const skipped = [...r.unmapped]
    .sort((a, b) => a.at - b.at)
    .map((u) => `//   @${u.at} ${u.key}${u.perPlayer ? "_<player>" : ""}: ${u.why}`);
  return [
    "// Auto-generated by web/scripts/updater/gen-save-attrs.ts -- do not edit",
    `// Source: live N.js (sha256 ${sha}) — the cloud load: _customEvent_LoadAllData @${r.load}, copied to the current character by _customBlock_LoadPlayerInfo @${r.player}`,
    "// Regenerate: cd web && npx tsx scripts/updater/gen-save-attrs.ts",
    "//",
    "// Attribute (the name getGameAttribute takes) -> the save key the game loads it from.",
    "//   perPlayer: the key is `<key>_<character index>` (lib/game/state charKey).",
    "//   `Attr[i]`: an element loaded from its own key; attr(ctx, \"Attr\", i, ...) reads it.",
    "// Offsets (@) are those of the loader call in the raw N.js.",
    "//",
    "// Written again after the load (attr returns what the loader read, which the game then changes):",
    ...r.rewritten.map((w) => `//   @${w.at} ${w.name}`),
    "//",
    "// Loader calls that are not here (dynamic key, computed index, scratch map, live value):",
    ...skipped,
    "",
    "export const SAVE_ATTRS: Readonly<Record<string, { key: string; perPlayer: boolean }>> = {",
    ...lines,
    "};",
    "",
  ].join("\n");
}

const NJS = "scripts/updater/.cache/N.new.js"; // relative to web/, the cwd of `npx tsx`
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../lib/game/data/saveAttrs.gen.ts");

/** Writes lib/game/data/saveAttrs.gen.ts from the raw N.js text (the updater's `--write-game-data` calls this with the one it just read). */
export function writeSaveAttrs(src: string): void {
  const sha = createHash("sha256").update(src).digest("hex").slice(0, 12);
  const r = extractSaveAttrs(src);
  writeFileSync(OUT, renderSaveAttrs(r, sha), "utf8");
  console.log(`${Object.keys(r.attrs).length} attributes written, ${r.unmapped.length} loader calls not mapped -> lib/game/data/saveAttrs.gen.ts`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writeSaveAttrs(readFileSync(NJS, "utf8"));
