// In-game bisection (README.md §3): remove one big source (a food slot, default the golden food in
// slot 0) and predict what the game must show under each hypothesis; with --second, intersect both
// readings into the exact size of the missing term.
// usage: npx tsx --tsconfig tsconfig.json scripts/dr-debug/bisect.ts <envelope> <charIdx> <map> <gameReading> [foodSlot] [--second <gameReading2>]
import { readFileSync } from "node:fs";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";

const args = process.argv.slice(2);
const secondAt = args.indexOf("--second");
const second = secondAt >= 0 ? Number(args[secondAt + 1]) : null;
const [envPath, ciS, mapS, readS, slotS = "0"] = secondAt >= 0 ? args.slice(0, secondAt) : args;
const ci = Number(ciS), map = Number(mapS), read = Number(readS), slot = slotS;
const raw = readFileSync(envPath, "utf8");

// The game's stats screen shows floor(DR) above 9999 → the true value lies in [read, read+1).
const run = (env: any) => {
  const r = computeArkhDropRate(env, ci, map);
  const pick = (n: string) => r.tree.children.find((c: any) => c.name === n);
  const gf = pick("Additive Pool").children.find((c: any) => /Golden Food/.test(c.name))?.val ?? 0;
  return { total: r.total, S: pick("Total Sum").val, gf };
};
const now = run(JSON.parse(raw));
const cut = JSON.parse(raw);
const key = `EquipOrder_${ci}`;
const order = typeof cut.data[key] === "string" ? JSON.parse(cut.data[key]) : cut.data[key];
const removed = order[2][slot];
order[2][slot] = "Blank";
cut.data[key] = typeof cut.data[key] === "string" ? JSON.stringify(order) : order;
const off = run(cut);
// DR is affine in the Total Sum S with the same slope in both states (the post-processing chain
// does not depend on the food), so a constant additive gap shifts both readings by a·ΔS.
const a = (now.total - off.total) / (now.S - off.S);
const gap = (lo: number, hi: number, base: number) => [(lo - base) / a, (hi - base) / a];
const [s1lo, s1hi] = gap(read, read + 1, now.total);
const mid = (s1lo + s1hi) / 2;
console.log(`ours now ${now.total.toFixed(2)} vs game [${read}, ${read + 1}) → ×${((read + 0.5) / now.total).toFixed(7)} or +${(100 * mid).toFixed(2)} pp additive`);
console.log(`removed ${removed} from food slot ${slot}; ours without it ${off.total.toFixed(2)}`);
console.log(`  multiplicative miss → game shows ≈ ${Math.floor(off.total * ((read + 0.5) / now.total))}`);
console.log(`  constant additive miss → ≈ ${Math.floor(off.total + a * mid)}`);
console.log(`  miss ∝ Golden Food → ≈ ${Math.floor(off.total + a * mid * (off.gf / now.gf))}`);
console.log(`  no miss (different state) → ${Math.floor(off.total)}`);
if (second != null) {
  const [s2lo, s2hi] = gap(second, second + 1, off.total);
  const lo = Math.max(s1lo, s2lo), hi = Math.min(s1hi, s2hi);
  console.log(lo < hi
    ? `BOTH readings ⇒ constant additive term missing: +${(100 * lo).toFixed(2)} … +${(100 * hi).toFixed(2)} pp`
    : `readings are NOT a constant additive gap (ranges ${(100 * s1lo).toFixed(2)}–${(100 * s1hi).toFixed(2)} vs ${(100 * s2lo).toFixed(2)}–${(100 * s2hi).toFixed(2)} pp) — check the multiplicative / proportional rows`);
}
