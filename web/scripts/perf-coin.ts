// What the Coin Multi page's switch to lib/game costs: lib/arkh against lib/game on real saves. From web/:
//
//   npx tsx scripts/perf-coin.ts [saves=5]
//
// Per save (current CSver only), the median of: the first call on a freshly parsed envelope ("cold": lib/game builds the state once per
// envelope, lib/arkh reloads the save), a character switch and a map switch on that loaded save ("warm", what the picker does).
// The user's rule: no perceptible slowdown (warm at parity, cold once per save).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
// first: the oracle sets the `window` shim lib/arkh reads
import { KNOWN_ARKH_DIFFS, goldenSaves } from "@/__tests__/lib/game/support/arkhOracle";
import { computeArkhCoinMulti } from "@/lib/arkh/computeCoin";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { computeGameCoinMulti } from "@/lib/game/trackers/coinMulti";

type Engine = (save: unknown, ci: number, map: number) => unknown;
const ENGINES: Record<string, Engine> = { "lib/arkh": computeArkhCoinMulti, "lib/game": computeGameCoinMulti };
const FIGHT_MAPS = [301, 251, 150, 40]; // map 33 has no monster: the block refuses there (Ruling TT)

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const time = (f: () => unknown) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

const want = Number(process.argv[2] ?? 5);
// most real saves have a KNOWN lib/arkh difference (snapshots, pray6, gold food...): those pairs are left out of the equal-total check
const known = (p: string, ci: number, map: number) =>
  KNOWN_ARKH_DIFFS.some((d) => d.stat === "coin" && d.reason !== "gfoodVote26" && d.save === basename(p) && (d.ci ?? ci) === ci && (d.maps?.includes(map) ?? true));
const paths = goldenSaves()
  .filter((p) => JSON.parse(readFileSync(p, "utf8")).data?.CSver === CURRENT_CSVER)
  .filter((p) => !known(p, 0, 301)) // a save whose character 0 has no KNOWN difference: the equal-total check has pairs to compare
  .slice(0, want);
if (paths.length === 0) throw new Error("no current-CSver real saves on this machine");

// module setup (data tables, lazy chunks) is not the engine's cost
for (const e of Object.values(ENGINES)) e(JSON.parse(readFileSync(paths[0], "utf8")), 0, 301);

// both engines give the same total on every measured case that has no KNOWN difference (rel 1e-9): the timings compare equal work
let checked = 0;
for (const p of paths) {
  const save = JSON.parse(readFileSync(p, "utf8"));
  const chars = Object.keys(save.data).filter((k) => k.startsWith("CurrentMap_")).length || 1;
  for (let ci = 0; ci < chars; ci++) {
    for (const map of FIGHT_MAPS) {
      if (known(p, ci, map)) continue;
      const a = (computeArkhCoinMulti(structuredClone(save), ci, map) as { total: number }).total;
      const b = (computeGameCoinMulti(save, ci, map) as { total: number }).total;
      if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) throw new Error(`${p} #${ci} map ${map}: lib/arkh ${a}, lib/game ${b}`);
      checked++;
    }
  }
}
if (checked === 0) throw new Error("every measured pair has a KNOWN difference: nothing compared");
console.log(`equal totals on ${checked} pairs`);

const out: Record<string, { cold: number[]; char: number[]; map: number[] }> = {};
for (const [name, engine] of Object.entries(ENGINES)) {
  const r = (out[name] = { cold: [], char: [], map: [] });
  for (const p of paths) {
    const save = JSON.parse(readFileSync(p, "utf8"));
    r.cold.push(time(() => engine(save, 0, 301)));
    const chars = Object.keys(save.data).filter((k) => k.startsWith("CurrentMap_")).length || 1;
    for (let i = 0; i < 6; i++) r.char.push(time(() => engine(save, (i + 1) % chars, 251)));
    for (let i = 0; i < 6; i++) r.map.push(time(() => engine(save, 0, FIGHT_MAPS[i % FIGHT_MAPS.length] + (i >= 4 ? 1 : 0))));
  }
}
console.log(`${paths.length} saves; median ms`);
for (const [name, r] of Object.entries(out)) console.log(`${name}: cold ${median(r.cold).toFixed(0)}  character switch ${median(r.char).toFixed(0)}  map switch ${median(r.map).toFixed(0)}`);
