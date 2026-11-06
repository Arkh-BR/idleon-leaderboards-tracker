// What the AFK page's switch to lib/game costs: lib/arkh against lib/game on real saves. From web/:
//
//   npx tsx scripts/perf-afk.ts [saves=5]
//
// Per save (current CSver only), the median of: the first call on a freshly parsed envelope ("cold": lib/game builds the state once per
// envelope, lib/arkh reloads the save), a character switch and a map switch on that loaded save ("warm", what the picker does).
// The user's rule: no perceptible slowdown (warm at parity, cold once per save).
import { readFileSync } from "node:fs";
// first: the oracle sets the `window` shim lib/arkh reads
import { goldenSaves } from "@/__tests__/lib/game/support/arkhOracle";
import { computeArkhAfkGains } from "@/lib/arkh/computeAfk";
import { CURRENT_CSVER } from "@/lib/game/errors";
import { computeGameAfkGains } from "@/lib/game/trackers/afkGains";

type Engine = (save: unknown, ci: number, map: number) => unknown;
const ENGINES: Record<string, Engine> = { "lib/arkh": computeArkhAfkGains, "lib/game": computeGameAfkGains };
const FIGHT_MAPS = [251, 14, 120, 306];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const time = (f: () => unknown) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

const want = Number(process.argv[2] ?? 5);
const paths = goldenSaves().filter((p) => JSON.parse(readFileSync(p, "utf8")).data?.CSver === CURRENT_CSVER).slice(0, want);
if (paths.length === 0) throw new Error("no current-CSver real saves on this machine");

// module setup (data tables, lazy chunks) is not the engine's cost
for (const e of Object.values(ENGINES)) e(JSON.parse(readFileSync(paths[0], "utf8")), 0, 251);

const out: Record<string, { cold: number[]; char: number[]; map: number[] }> = {};
for (const [name, engine] of Object.entries(ENGINES)) {
  const r = (out[name] = { cold: [], char: [], map: [] });
  for (const p of paths) {
    const save = JSON.parse(readFileSync(p, "utf8"));
    r.cold.push(time(() => engine(save, 0, 251)));
    const chars = Object.keys(save.data).filter((k) => k.startsWith("CurrentMap_")).length || 1;
    for (let i = 0; i < 6; i++) r.char.push(time(() => engine(save, (i + 1) % chars, 251)));
    for (let i = 0; i < 6; i++) r.map.push(time(() => engine(save, 0, FIGHT_MAPS[i % FIGHT_MAPS.length] + (i >= 4 ? 1 : 0))));
  }
}
console.log(`${paths.length} saves; median ms`);
for (const [name, r] of Object.entries(out)) console.log(`${name}: cold ${median(r.cold).toFixed(0)}  character switch ${median(r.char).toFixed(0)}  map switch ${median(r.map).toFixed(0)}`);
