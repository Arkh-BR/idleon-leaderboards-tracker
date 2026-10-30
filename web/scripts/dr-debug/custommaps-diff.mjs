// Compare lib/arkh/stats/data/game/custommaps.js with the live N.js CustomMaps builders
// (`.NAME=function(){var a=new l;a.h.K=<literal>;…;return a}`). The updater does NOT regenerate this
// file, so data changes there (sets, card / etc-bonus ids, pristine charms…) need a manual port.
// usage (from web/): node scripts/dr-debug/custommaps-diff.mjs
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const src = readFileSync("scripts/updater/.cache/N.new.js", "utf8");
const ours = await import(pathToFileURL(resolve("lib/arkh/stats/data/game/custommaps.js")).href);
const readLiteral = (s, start) => {
  let depth = 0, i = start, inStr = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) { depth--; if (depth < 0) break; }
    else if ((c === ";" || c === ",") && depth === 0) break;
  }
  return s.slice(start, i);
};
// Same evaluation the updater's extractor uses for data literals (`"a b".split(" ")` etc.).
const evalLit = (raw) => { try { return Function(`"use strict";return (${raw});`)(); } catch { return { __raw: raw.slice(0, 80) }; } };
for (const name of Object.keys(ours)) {
  const head = `.${name}=function(){var a=new l;`;
  const at = src.indexOf(head);
  if (at < 0) { console.log(`${name}: builder not found`); continue; }
  const body = src.slice(at + head.length, src.indexOf("return a}", at));
  const live = {};
  for (const m of body.matchAll(/a\.h(?:\.([A-Za-z0-9_]+)|\["([^"]+)"\])=/g)) live[m[1] ?? m[2]] = evalLit(readLiteral(body, m.index + m[0].length));
  const mine = ours[name] || {};
  const diffs = [...new Set([...Object.keys(live), ...Object.keys(mine)])].filter((k) => JSON.stringify(live[k]) !== JSON.stringify(mine[k]));
  if (diffs.length) console.log(`${name}: ${diffs.length} diff(s) → ${diffs.slice(0, 12).join(", ")}${diffs.length > 12 ? " …" : ""}`);
}
