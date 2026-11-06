// njs-closure: everything the game's formula reaches. From web/:
//
//   npx tsx scripts/njs-closure.ts <Fn> [args…]
//
// e.g. `Sailing BoatArtiMulti 0` is Sailing("BoatArtiMulti", 0). Walks the exact sub-case slices of the
// live N.js (lib/diagnose/njsCalls njsClosure) and prints a markdown checklist, grouped by function:
// one row per (function, literal args), the attributes read and the DNSM keys read. The inventory
// of the Artifact Find port is this output (docs/superpowers/plans/2026-11-04-artifact-find-inventory.md).
// Warnings (depth cap) go to stderr, so `>` redirects only the checklist.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { njsClosure, njsFunction } from "@/lib/diagnose/njsCalls";
import { readdirSync } from "node:fs";
import type { Ported } from "@/lib/game/ported";
import { UNREACHED, type Unreached } from "@/lib/game/unreached";
import { loadNjs } from "@/scripts/njs-calls";

const USAGE = "usage: npx tsx scripts/njs-closure.ts [--mark] <Fn> [args…] [+ <Fn> [args…]]   (e.g. Sailing BoatArtiMulti 0)";
const NJS = "scripts/updater/.cache/N.new.js";

type Closure = ReturnType<typeof njsClosure>;
/** A merged closure: every row says which roots reach it. */
type Row = Closure["calls"][number] & { roots?: string[] };
type Merged = Omit<Closure, "calls"> & { calls: Row[] };

const fmt = (fn: string, args: unknown[]) => `${fn}(${args.map((a) => JSON.stringify(a)).join(",")})`;

/**
 * Is this row covered by the module's declared coverage (`PORTED`, lib/game/ported.ts)? No declaration is no coverage. A row with no
 * literal index (`ResearchStuff("Grid_Bonus")`) is covered only by a `true` entry.
 */
export function isPorted(c: { args: (string | number)[] }, p: Ported | undefined): boolean {
  if (p === undefined) return false;
  if (p === "generic") return true;
  const [a0, a1] = c.args;
  if (Array.isArray(p)) return typeof a0 === "number" && p.includes(a0);
  const rec = p as Record<string, true | readonly (number | string)[]>;
  if (!c.args.length) return Object.hasOwn(rec, "()"); // a computed first argument: the module declares the names it answers under "()"
  const at = [a0, a1].findIndex((a) => typeof a === "string" && Object.hasOwn(rec, a)); // GetSetBonus(set, "Bonus"): the name is second
  if (at < 0) return false;
  const name = c.args[at] as string;
  const e = c.args[at + 2];
  // an unknown `e` may be one that has its own rule; an `@e<n>: []` entry only says "e = n is not ported" and leaves the other e alone
  if (e === undefined && Object.entries(rec).some(([k, v]) => k.startsWith(`${name}@e`) && (v === true || v.length > 0))) return false;
  const entry = e !== undefined && Object.hasOwn(rec, `${name}@e${e}`) ? rec[`${name}@e${e}`] : rec[name];
  if (entry === true) return true;
  const idx = c.args[at + 1];
  return idx !== undefined && entry.includes(idx);
}

/** `lib/game/njs/<Fn>.ts` -> its `PORTED`, for the modules that declare one. */
export async function loadPorted(): Promise<Record<string, Ported>> {
  const out: Record<string, Ported> = {};
  for (const f of readdirSync("lib/game/njs")) {
    const n = f.replace(/\.ts$/, "");
    const m = await import(`@/lib/game/njs/${n}`);
    if (m.PORTED) out[n] = m.PORTED;
  }
  return out;
}

/**
 * The checklist: `header`, a counts line, one `## Fn` group per function, then the attrs and dnsm sections. With `ported` (--mark), a row
 * is `[x]` when its module declares it, else `[~]` when `unreached` (lib/game/unreached.ts) declares it unreachable from every root that
 * reaches it, else `[ ]`.
 */
export function renderInventory(r: Merged & { roots?: string[] }, header: string, ported?: Record<string, Ported>, unreached: readonly Unreached[] = UNREACHED): string {
  const groups = new Map<string, Row[]>();
  for (const c of r.calls) groups.set(c.fn, [...(groups.get(c.fn) ?? []), c]);
  const flagged = (flag: string) => r.calls.filter((c) => c.flag === flag).length;
  const done = (c: Row) => !!ported && isPorted(c, ported[c.fn]);
  const why = (c: Row) => (ported && !done(c) ? unreached.find((u) => u.row === fmt(c.fn, c.args) && (c.roots ?? r.roots ?? []).every((x) => u.roots.includes(x)))?.why : undefined);
  const nDone = r.calls.filter(done).length;
  const nUnreached = r.calls.filter((c) => why(c) !== undefined).length;
  const counts =
    `**${groups.size} functions, ${r.calls.length} sub-cases (rows), ${flagged("whole body")} whole body, ${flagged("not found")} not found, ` +
    `${r.attrs.length} attrs, ${r.dnsm.length} dnsm.**` +
    (ported ? ` **${nDone} ported \`[x]\`, ${nUnreached} not reached \`[~]\`, ${r.calls.length - nDone - nUnreached} open.**` : "") +
    (r.capped ? ` **Depth cap hit: ${r.capped} call${r.capped === 1 ? " was" : "s were"} not walked.**` : "");
  const out = [header, "", counts];
  if (r.roots && r.roots.length > 1) out.push("", `Roots: ${r.roots.map((x, i) => `R${i + 1} = \`${x}\``).join(", ")}.`);
  for (const [fn, rows] of groups) {
    out.push("", `## ${fn}`, "");
    for (const c of rows) {
      const w = why(c);
      const mark = done(c) ? "x" : w !== undefined ? "~" : " ";
      out.push(`- [${mark}] ${fmt(c.fn, c.args)} — depth ${c.depth} — ${c.chars} chars${c.flag ? ` — ${c.flag}` : ""}${c.via ? ` — via ${c.via}` : ""}${c.roots ? ` — roots: ${c.roots.map((x) => `R${(r.roots ?? []).indexOf(x) + 1}`).join(" ")}` : ""}${w !== undefined ? ` — not reached: ${w}` : ""}`);
    }
  }
  const names = (all: string[], loose: string[]) => all.map((a) => `- [ ] \`${a}\`${loose.includes(a) ? " — whole body only" : ""}`);
  out.push("", "## attrs", "", ...names(r.attrs, r.loose.attrs));
  out.push("", "## dnsm", "", ...names(r.dnsm, r.loose.dnsm));
  return out.join("\n") + "\n";
}

/** `0`, `-1`, `2.5` are numbers (N.js literals); everything else is a string. */
const parseArg = (s: string) => (/^-?\d*\.?\d+$/.test(s) ? Number(s) : s);

/** The closure of the root call `argv` names (`Fn args…`). Throws a usage or "no such function" message. */
export function runClosure(norm: string, argv: string[]) {
  const [fn, ...rest] = argv;
  if (!fn) throw new Error(USAGE);
  if (!njsFunction(norm, fn)) throw new Error(`no _customBlock_${fn} in the live N.js`);
  const args = rest.map(parseArg);
  return { fn, args, ...njsClosure(norm, fn, args) };
}

/**
 * Several roots in one inventory: `Fn args… + Fn2 args…`. The closures are merged, each row (fn, args)
 * once at its shallowest depth, with the roots that reach it. One root gives `runClosure` as is.
 */
export function runClosures(norm: string, argv: string[]): Merged & { roots: string[]; fn: string; args: (string | number)[] } {
  const roots: string[][] = [[]];
  for (const a of argv) a === "+" ? roots.push([]) : roots.at(-1)!.push(a);
  const runs = roots.map((r) => runClosure(norm, r));
  if (runs.length === 1) return { roots: [fmt(runs[0].fn, runs[0].args)], ...runs[0] };
  const rows = new Map<string, Row>();
  for (const run of runs) {
    const label = fmt(run.fn, run.args);
    for (const c of run.calls) {
      const k = c.fn + JSON.stringify(c.args);
      const prev = rows.get(k);
      if (!prev) rows.set(k, { ...c, roots: [label] });
      else {
        prev.roots!.push(label);
        // the row is the same N.js text; keep the shallowest depth, and a flag if any walk had one
        prev.depth = Math.min(prev.depth, c.depth);
        prev.flag ??= c.flag;
      }
    }
  }
  const union = (pick: (r: Closure) => string[]) => [...new Set(runs.flatMap((r) => pick(r)))].sort();
  const attrs = union((r) => r.attrs);
  const dnsm = union((r) => r.dnsm);
  // loose = loose in every run that reads it (an exact read in any run makes it exact)
  const looseIn = (all: string[], read: (r: Closure) => string[], loose: (r: Closure) => string[]) =>
    all.filter((n) => runs.filter((r) => read(r).includes(n)).every((r) => loose(r).includes(n)));
  return {
    roots: runs.map((r) => fmt(r.fn, r.args)),
    fn: runs[0].fn,
    args: runs[0].args,
    calls: [...rows.values()],
    attrs,
    dnsm,
    loose: { attrs: looseIn(attrs, (r) => r.attrs, (r) => r.loose.attrs), dnsm: looseIn(dnsm, (r) => r.dnsm, (r) => r.loose.dnsm) },
    // a call one root left at the depth cap is walked, at a shallower depth, when another root reaches it
    unwalked: [],
    capped: new Set(runs.flatMap((r) => r.unwalked).filter((k) => !rows.has(k))).size,
  };
}

/** The whole inventory file for the command line `argv` (`[--mark] Fn args… [+ Fn2 args…]`): what main writes to stdout. */
export async function inventoryText(argv: string[]): Promise<string> {
  const mark = argv[0] === "--mark";
  if (mark) argv = argv.slice(1);
  const { roots, fn, args, ...r } = runClosures(loadNjs(), argv);
  const command = `cd web && npx tsx scripts/njs-closure.ts ${mark ? "--mark " : ""}${argv.join(" ")}`;
  const sha = createHash("sha256").update(readFileSync(NJS)).digest("hex").slice(0, 12);
  const header = [
    `# Port inventory: ${roots.join(" + ")}`,
    "",
    `Generated by \`${command}\` (redirect stdout to this file) from the live N.js (\`web/${NJS}\`, sha256 ${sha}…).`,
    "Regenerate it when N.js, a module's `PORTED` or `lib/game/unreached.ts` changes. With `--mark`, `[x]` is what the module declares in its `PORTED` (lib/game/ported.ts; a guard test keeps the declarations honest) and `[~]` (Ruling F) a row `lib/game/unreached.ts` declares unreachable, with its reason: do not mark rows by hand (a guard test compares this file with the generator's output). Rows ported to `runtime()`/assumed stay `[ ]` until their module declares them.",
    "- `[x]` on a whole-body row of a generic function (`ArcadeBonus(46)`, `Companions(154)`) means the module's generic path covers every index. A whole-body row does not list its callees: a porting task opens it with `npx tsx scripts/njs-calls.ts <Fn> [<sub>] [<n>]` to see what it calls.",
    "",
    "- A row is one N.js call with its literal args up to the first non-literal one (`Sailing(\"DaveyJonesBonus\",b,0)` is `Sailing(\"DaveyJonesBonus\")`). The chars are the length of its N.js slice (`njsSlice`). With a number after the name and no `<n>==` branch for it, the slice is the whole sub-case (`Sailing(\"ArtifactBonus\",3,0)` is 8323 chars): the calls of other numbers' branches in it are in this list too.",
    "- With several roots (`Fn args + Fn2 args`) the rows are merged, each once, and say which roots reach it (`roots:`).",
    "- A first argument that is a number (`Companions(154)`, `TalentCalc(643)`) is a numeric dispatcher: the row is its `<n>==<param>` branch (`njsNumericBranch`) and the calls in it are walked. A function that computes generically and branches only on a few indexes (`ArcadeBonus`, `Companions`, `AchieveStatus`, `MainframeBonus` for most n) has no branch for most numbers: its row stays whole body, and for those the whole body IS the formula.",
    "- **whole body**: the slice is the whole function. Either the first argument is a number with no `<n>==<param>` branch (`ArcadeBonus(46)`, `Companions(154)`), or the function has no sub-case of that name: the string is a data key (`GetBribeBonus(\"34\")`, `EtcBonuses(\"30\")`, `StampBonusOfTypeX(\"BuildProd\")`), the function dispatches on its second argument (`GetSetBonus(\"GODSHARD_SET\",\"Bonus\")`), or the sub-case is in a form `njsNamedBlocks` does not read (the `&&` tail of a chain). The walk stops there: the calls inside it are NOT in this list. Read it with `npx tsx scripts/njs-calls.ts <Fn> [<sub>] [<n>]`.",
    "- **via Fn2**: the function hands the sub-case on to `Fn2` (`Summoning` ends in `Summoning2(d,b,e)`); the slice is in `Fn2`.",
    "- **not found**: the function is not in N.js.",
    "- attrs and dnsm are the reads in every slice listed. One marked \"whole body only\" is read only inside a whole-body function (all its branches, not just the one this formula takes). `DNSM` is runtime-only (it is never loaded from the save): port it as `DNSM_*` functions, not as a save attribute. The dnsm list also holds the scratch keys a formula writes and reads back in the same slice (`CaptnBonuz`, `AtomBonCalc1`); the inputs are the caches the game fills elsewhere (`StarSigns`, `AlchVials`, `FamBonusQTYs`…).",
    "- Depth stops at 6.",
  ].join("\n");
  return renderInventory({ ...r, roots }, header, mark ? await loadPorted() : undefined);
}

async function main(argv: string[]) {
  process.stdout.write(await inventoryText(argv));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
