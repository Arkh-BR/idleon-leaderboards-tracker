// The game's own display of ExpMulti(0) on the stats panel ("Class EXP:",
// N.js ActorEvents_29._event_PlayerInfo @6665695). Truncates, never rounds,
// above 1e3; only M and T units (the M/T glyphs are inferred from fonts 251
// and 244 — see the spec's D2). Returns the text without the trailing "x".
export function formatExpMulti(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e15) return `${Math.floor(v / 1e12)}T`;
  if (v >= 1e14) return `${Math.floor(v / 1e11) / 10}T`;
  if (v >= 1e13) return `${Math.floor(v / 1e10) / 100}T`;
  if (v >= 1e9) return `${Math.floor(v / 1e6)}M`;
  if (v >= 1e8) return `${Math.floor(v / 1e5) / 10}M`;
  if (v >= 1e7) return `${Math.floor(v / 1e4) / 100}M`;
  if (v >= 1e3) return `${Math.floor(v)}`;
  if ((10 * v) % 10 === 0) return `${Math.round(v)}.00`;
  if ((100 * v) % 10 === 0) return `${Math.round(10 * v) / 10}0`;
  return `${Math.round(100 * v) / 100}`;
}
