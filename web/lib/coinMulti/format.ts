// The game's own display of ArbitraryCode("MonsterCash") (N.js @11794100),
// kept literal so the in-game validation compares like for like.

import { getLOG } from "@/lib/arkh/formulas";

/** N.js NotateNumber(d, "Big"): the generic ladder (ceil), then E-notation. */
export function notateBig(d: number): string {
  if (d < 1e3) return `${Math.floor(d)}`;
  if (d < 1e4) return `${Math.ceil(d / 10) / 100}K`;
  if (d < 1e5) return `${Math.ceil(d / 100) / 10}K`;
  if (d < 1e6) return `${Math.ceil(d / 1e3)}K`;
  if (d < 1e7) return `${Math.ceil(d / 1e4) / 100}M`;
  if (d < 1e8) return `${Math.ceil(d / 1e5) / 10}M`;
  if (d < 1e9) return `${Math.ceil(d / 1e6)}M`;
  if (d < 1e10) return `${Math.ceil(d / 1e7) / 100}B`;
  if (d < 1e11) return `${Math.ceil(d / 1e8) / 10}B`;
  if (d < 1e12) return `${Math.ceil(d / 1e9)}B`;
  if (d < 1e13) return `${Math.ceil(d / 1e10) / 100}T`;
  if (d < 1e14) return `${Math.ceil(d / 1e11) / 10}T`;
  if (d < 1e15) return `${Math.ceil(d / 1e12)}T`;
  if (d < 1e16) return `${Math.ceil(d / 1e13) / 100}Q`;
  if (d < 1e17) return `${Math.ceil(d / 1e14) / 10}Q`;
  if (d < 1e18) return `${Math.ceil(d / 1e15)}Q`;
  if (d < 1e19) return `${Math.ceil(d / 1e16) / 100}QQ`;
  if (d < 1e20) return `${Math.ceil(d / 1e17) / 10}QQ`;
  if (d < 1e21) return `${Math.ceil(d / 1e18)}QQ`;
  const e = Math.floor(getLOG(d));
  return `${Math.floor((d / Math.pow(10, e)) * 100) / 100}E${e}`;
}

/** N.js NotateNumber(d, "MultiplierInfo") without its "#" placeholder. */
export function notateMultiplierInfo(d: number): string {
  if (d > 1e6) {
    const c = Math.round((d / 1e6) * 100);
    if (c % 100 === 0) return `${Math.round(d / 1e6)}.00M`;
    if (c % 10 === 0) return `${Math.round((d / 1e6) * 10) / 10}0M`;
    return `${c / 100}M`;
  }
  const c = Math.round(100 * d);
  if (c % 100 === 0) return `${Math.round(d)}.00`;
  if (c % 10 === 0) return `${Math.round(10 * d) / 10}0`;
  return `${c / 100}`;
}

/** What the game prints for the coin multi (without the trailing "x"). */
export function formatCoinMulti(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (x > 1e16) return notateBig(x);
  if (x > 1e10) return `${Math.floor(x / 1e8) / 10}B`;
  if (x > 1e7) return `${Math.floor(x / 1e5) / 10}M`;
  return notateMultiplierInfo(x);
}
