// What a ported module covers, declared by the module itself (`export const PORTED`) and read by the inventory marker
// (scripts/njs-closure.ts --mark) and by the guard test (__tests__/lib/game/ported.test.ts). The inventory's `[x]` means
// "declared here", never "the module did not throw on a probe".
//
// - "generic": the module's one generic path covers every argument (ArcadeBonus, Companions, AchieveStatus...).
// - a number list: a numeric dispatcher (`MainframeBonus(d)`) ported for those `d` only.
// - a record by sub-case name (the first literal string of the call; for GetSetBonus the second): `true` covers the sub-case for any
//   index, a list covers only those indexes (the first literal argument after the name: `Holes("B_UPG", 55)`). A sub-case with
//   another rule for one value of `e` is declared twice, the second under `"<name>@e2"` (ResearchStuff Grid_Bonus, e = 2). An `"<name>@e<n>": []` entry
//   declares the opposite: the sub-case throws for e = n and is not ported there (Divinity Bonus_MAJOR, e = 6 and 8).
// - `"()"`: the call with a computed first argument (`RiftStuff("RiftSkillBonus," + f, …)`, a row with no literal argument), listing
//   example names it answers (the guard test calls each).
// Anything not declared throws NotPorted (Ruling E); the guard test checks that in both directions.
export type Ported = "generic" | readonly number[] | { readonly [sub: string]: true | readonly (number | string)[] };

/** `[from, to)`. */
export const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
