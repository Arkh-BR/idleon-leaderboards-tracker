// The game's own display of TotalStats("Drop_Rarity") in the character panel
// (N.js PlayerInfo, `_dummynumber3`, live sha 4a6cb9a0c645 @6713518), kept
// literal: above 9999 the integer part (no suffix ladder), else the
// two-decimal ladder keyed on the UNROUNDED 10·d % 10 and 100·d % 10 — which
// is why notateMultiplierInfo (keyed on the rounded value) can't stand in.
// Returns the text without the trailing "#" placeholder.
// @njs PlayerInfo Drop_Rate
export function formatDropRateV2(d: number): string {
  if (!Number.isFinite(d)) return "—";
  if (9999 < d) return `${Math.floor(d)}`;
  if (0 == (10 * d) % 10) return `${Math.round(d)}.00`;
  if (0 == (100 * d) % 10) return `${Math.round(10 * d) / 10}0`;
  return `${Math.round(100 * d) / 100}`;
}
