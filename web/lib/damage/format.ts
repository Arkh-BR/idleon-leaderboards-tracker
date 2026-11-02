import { formatIdleon } from "@/lib/format";

// The Player Info panel's Damage line prints Math.ceil of Min and Max (N.js
// PlayerInfoNumbers, with its own K/M/kanji notation); the site shows the
// ceiled number in its shared notation (formatIdleon). Number only: the page
// prints "Min ~ Max" with it.
export function formatDamage(x: number): string {
  return formatIdleon(Math.ceil(x));
}
