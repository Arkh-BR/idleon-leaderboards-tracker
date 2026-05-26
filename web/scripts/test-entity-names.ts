// Quick sanity check that label() returns real names for the DR sources.
import { label } from "../lib/corgan/stats/entity-names";

const cases: [string, unknown][] = [
  ["Talent", 279],
  ["Talent", 24],
  ["Talent", 655],
  ["Talent", 328],
  ["Stamp", "A38"],
  ["Stamp", "C9"],
  ["Card", "mini5a"],
  ["Card", "caveC"],
  ["Prayer", 7],
  ["Achievement", 377],
  ["Achievement", 381],
  ["Achievement", 380],
  ["Achievement", 383],
  ["Shrine", 4],
  ["Shrine", 22],
  ["Star Sign", "drop"],
  ["Arcade", 27],
];

for (const [sys, id] of cases) {
  console.log(`${sys} ${id}:`, label(sys, id));
}
