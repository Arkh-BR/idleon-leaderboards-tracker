// The Player Info panel's Damage line (N.js PlayerInfoNumbers @6710738):
// Math.ceil of Min and Max at one unit chosen by Max, joined by "~". The
// panel's glyphs become what the screen shows: "[" → M, "!" → T, the leading
// "|" font switch → 💎, 棘 (×1e24) → Y (user's pick, unseen in game), 賃
// (×1e30) → ₸. Divisions run in N.js's order so the ceil lands the same.

type Tier = { below: number; f: (x: number) => number; glyph: string; gem?: true };

const TIERS: Tier[] = [
  { below: 9999999, f: (x) => Math.ceil(x), glyph: "" },
  { below: 999999999, f: (x) => Math.ceil(x / 1e3) / 1e3, glyph: "M" },
  { below: 99999999999, f: (x) => Math.ceil(x / 1e5) / 10, glyph: "M" },
  { below: 9999999999999, f: (x) => Math.ceil(x / 1e6), glyph: "M" },
  { below: 999999999999999, f: (x) => Math.ceil(x / 1e9) / 1e3, glyph: "T" },
  { below: 1e17, f: (x) => Math.ceil(x / 1e11) / 10, glyph: "T" },
  { below: 1e19, f: (x) => Math.ceil(x / 1e12), glyph: "T" },
  { below: 1e21, f: (x) => Math.ceil(x / 1e15) / 1e3, glyph: "", gem: true },
  { below: 1e23, f: (x) => Math.ceil(x / 1e17) / 10, glyph: "", gem: true },
  { below: 1e25, f: (x) => Math.ceil(x / 1e18), glyph: "", gem: true },
  { below: 1e27, f: (x) => Math.ceil(x / 1e18 / 1e3) / 1e3, glyph: "Y", gem: true },
  { below: 1e28, f: (x) => Math.ceil(x / 1e18 / 1e5) / 10, glyph: "Y", gem: true },
  { below: 1e30, f: (x) => Math.ceil(x / 1e18 / 1e6), glyph: "Y", gem: true },
  { below: 1e33, f: (x) => Math.ceil(x / 1e18 / 1e9) / 1e3, glyph: "₸", gem: true },
  { below: 1e34, f: (x) => Math.ceil(x / 1e18 / 1e11) / 10, glyph: "₸", gem: true },
  { below: Infinity, f: (x) => Math.ceil(x / 1e18 / 1e12), glyph: "₸", gem: true },
];

const tierOf = (max: number) => TIERS.find((t) => max < t.below)!;
const part = (t: Tier, x: number) => (Number.isFinite(x) ? `${t.f(x)}${t.glyph}` : "—");

/** The whole line, "💎16310₸~22776₸": the unit follows Max, as in the game. */
export function formatDamageLine(min: number, max: number): string {
  if (!Number.isFinite(max)) return "—";
  const t = tierOf(max);
  return `${t.gem ? "💎" : ""}${part(t, min)}~${part(t, max)}`;
}

/** One value (snapshots, history) at its own unit. */
export function formatDamage(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const t = tierOf(x);
  return `${t.gem ? "💎" : ""}${part(t, x)}`;
}
