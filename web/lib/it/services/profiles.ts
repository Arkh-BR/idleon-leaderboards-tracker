// Stub for `../services/profiles` — only `expandLeaderboardInfo` is dynamic-
// imported by `copyForSupport()` in utility/helpers.js. That function is the
// "Copy for Support" button handler, never called from our drop-rate code
// path. An empty return keeps the bundler happy without pulling in IT's
// leaderboard service tree.
export const expandLeaderboardInfo = (
  _account: unknown,
  _characters: unknown
): Record<string, unknown> => ({});
