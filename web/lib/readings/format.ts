// What the game prints for each stat, so an in-game reading (the exact text on
// screen) can be compared with the engine's number as a string.
// Live game code: scripts/updater/.cache/N.new.js (sha1 0626efe9…, identical to
// legendsofidleon.com/ytGl5oc/N.js on 2026-11-03).

import { formatDamageLine } from "@/lib/damage/format";
import { notateBig } from "@/lib/coinMulti/format";
import { AFK_PAGE } from "@/lib/afkGains/pageConfig";
import { ARTIFACT_PAGE } from "@/lib/artifactFind/pageConfig";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import type { StatPageConfig } from "@/lib/statTracker/config";
import type { StatKey } from "./types";

// N.js _customBlock_CommaNotation (@5078179): Math.round, then "," every three
// digits from the right; above 1e9 it first drops to M / T / QQ units.
function commaNotation(d: number): string {
  let text = `${Math.round(d)}`;
  let unit = "";
  if (d > 1e9) {
    text = `${Math.round(d / 1e6)}`;
    unit = "M";
    if (d > 1e15) {
      text = `${Math.round(d / 1e12)}`;
      unit = "T";
      if (d > 1e21) {
        text = `${Math.round(d / 1e18)}`;
        unit = "QQ";
      }
    }
  }
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + unit;
}

// NotateNumber(…, "Big") as the Player Info panel shows it. N.js (@4402800, tail @4409729,
// default tail) builds a lowercase "e", but the in-game readings of 2026-11-03
// show "5.83E35" and "2.77E35" (Accuracy, uppercase E) — presumably the panel's
// font 33 draws it that way (not provable from N.js). Match the screen; the
// e-notation tail only appears from 1e21.
const playerInfoBig = (d: number) => notateBig(d).replace(/e(?=\d+$)/, "E");

// HP / MP lines (N.js @6710329 / @6710533): above 1E8 NotateNumber "Big",
// else Math.round — no separators. The same rule for both, so Max MP of a
// 5.0991e9 character reads "5.1B".
const hpMp = (d: number) => (1e8 < d ? playerInfoBig(d) : `${Math.round(d)}`);

// STR / AGI / WIS / LUK lines (N.js @6713949): CommaNotation below 1E9, else "Big".
const mainStat = (d: number) => (1e9 > d ? commaNotation(d) : playerInfoBig(d));

// The kit trackers print their headline as formatTotal + unit (default "x").
const kit = (page: StatPageConfig, value: number) => page.formatTotal(value) + (page.unit ?? "x");

/** The text the game shows for `stat`. Damage needs `min` (the line is "Min~Max");
 *  every other stat uses `value` alone. A non-finite value prints "—". */
export function formatGameValue(stat: StatKey, v: { value: number; min?: number }): string {
  const { value } = v;
  if (!Number.isFinite(value)) return "—";
  switch (stat) {
    case "dropRateV2":
      return kit(DR2_PAGE, value);
    case "coinMulti":
      return kit(COIN_PAGE, value);
    case "expMulti":
      return kit(EXP_PAGE, value);
    case "afkGains":
      return kit(AFK_PAGE, value);
    case "multikill":
      return kit(MULTIKILL_PAGE, value);
    case "artifactFind":
      return kit(ARTIFACT_PAGE, value);
    case "damage":
      // Damage ladder, N.js @6710738 (formatDamageLine mirrors it glyph by glyph).
      if (v.min === undefined) throw new Error("formatGameValue(damage): min is required");
      return Number.isFinite(v.min) ? formatDamageLine(v.min, value) : "—";
    case "maxHp":
    case "maxMp":
      return hpMp(value);
    case "accuracy":
      // Accuracy line: NotateNumber(PlayerAccTot(), "Big") @6715535.
      return playerInfoBig(value);
    case "str":
    case "agi":
    case "wis":
    case "luk":
      return mainStat(value);
    case "tomeScore": // Tome total: CommaNotation(GenInfo[84]) + "_PTS" @5711306
    case "tomeTask": // a task's points: CommaNotation(Summoning("TomePTS", i)) + "_PTS" @5715961
      return `${commaNotation(value)} PTS`; // "_" is drawn as a space
    default:
      throw new Error(`formatGameValue: no formatter for ${stat satisfies never}`);
  }
}

/** Trim and collapse inner whitespace (incl. nbsp) before comparing game text. */
export const normalizeGameText = (s: string): string => s.trim().replace(/\s+/g, " ");

// Unit glyphs of every ladder above: NotateNumber K…QQ, CommaNotation M/T/QQ,
// the Damage line's M/T plus Y (×1e24) and ₸ (×1e30).
const UNITS: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15, QQ: 1e18, Y: 1e24, "₸": 1e30 };

/** The number behind a game text, to the display's precision (the inverse of
 *  formatGameValue): Damage reads its Max, the part after "~"; NaN when the
 *  text is not a number these formatters print. */
export function parseGameValue(stat: StatKey, text: string): number {
  let s = normalizeGameText(text);
  // The Damage line's 💎 tiers without a glyph count in 1e18 units.
  const gem = s.startsWith("💎");
  if (stat === "damage") s = s.slice(s.indexOf("~") + 1);
  s = s.replace("💎", "").replace(/(x|%| PTS)$/, "").replace(/,/g, "");
  const m = /^(\d+(?:\.\d+)?)(?:[eE](\d+))?(QQ|Q|K|M|B|T|Y|₸)?$/.exec(s);
  if (!m) return NaN;
  const v = Number(`${m[1]}e${m[2] ?? 0}`) * (m[3] ? UNITS[m[3]] : gem ? 1e18 : 1);
  return stat === "afkGains" ? v / 100 : v; // AFK prints ⌊100·rate⌋%
}
