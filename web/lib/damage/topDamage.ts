// Top-player Damage reference — per CLASS FAMILY (beginner / warrior /
// archer / mage): the best-of-each-source pools (stat-scaled sources from
// that family's chars, the rest from every char) run through ONE combine()
// pass (the same math a real save uses), gated PER CLASS for the formula's
// class talents. Use topDamageFlatForClass(classKey).
// Large file: lazy-load it, don't import statically.
// Generated  · 0 players. Refresh: scripts/update-top-damage.ts.

type FlatMap = Readonly<Record<string, number>>;

export const TOP_DAMAGE_FAMILY_FLAT: Readonly<Record<string, FlatMap>> = {
  "warrior": {
  },
};

// Keyed "family:profile" — the class talents a profile adds back.
export const TOP_DAMAGE_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {

};

// class key → [family, talent profile]
export const TOP_DAMAGE_CLASS_PROFILE: Readonly<Record<string, readonly [string, string]>> = {};

// Family used when no class is known (the highest-reaching one).
export const TOP_DAMAGE_DEFAULT_FAMILY = "warrior";

/** The top Damage reference for a class — its family's base merged with its profile. */
export function topDamageFlatForClass(classKey: string | null | undefined): FlatMap {
  const [family, profile] = (classKey && TOP_DAMAGE_CLASS_PROFILE[classKey]) || [TOP_DAMAGE_DEFAULT_FAMILY, "base"];
  const base = TOP_DAMAGE_FAMILY_FLAT[family] ?? TOP_DAMAGE_FAMILY_FLAT[TOP_DAMAGE_DEFAULT_FAMILY];
  const override = TOP_DAMAGE_PROFILE_OVERRIDES[`${family}:${profile}`];
  return override ? { ...base, ...override } : base;
}
