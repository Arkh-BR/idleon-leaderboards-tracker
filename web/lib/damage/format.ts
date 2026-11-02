import { formatIdleon } from "@/lib/format";

// The Player Info panel's Damage line (N.js: Math.ceil of Min and Max, shown
// in the game's K/M/B/T… notation). Returns the number only: the page prints
// "Min ~ Max" with it.
export function formatDamage(x: number): string {
  return formatIdleon(Math.ceil(x));
}
