// web/lib/coinMulti/topCoinMulti.ts — replaced by scripts/update-top-coin.ts (Task 10).
type FlatMap = Readonly<Record<string, number>>;
export const TOP_COIN_FLAT: FlatMap = {};
export const TOP_COIN_PROFILE_OVERRIDES: Readonly<Record<string, FlatMap>> = {};
export const TOP_COIN_CLASS_PROFILE: Readonly<Record<string, string>> = {};
export function topCoinFlatForClass(classKey: string | null | undefined): FlatMap {
  const profile = classKey ? TOP_COIN_CLASS_PROFILE[classKey] : undefined;
  const override = profile ? TOP_COIN_PROFILE_OVERRIDES[profile] : undefined;
  return override ? { ...TOP_COIN_FLAT, ...override } : TOP_COIN_FLAT;
}
