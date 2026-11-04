// Tables the ported functions read that the updater does not emit (data/index.ts leaves custommaps.js and
// hardcoded.js out): they are only these named exports, not whole files.
//
// - `NjEQ`, `EquipmentSets`: `CustomMaps.NjEQ` (the Ninja charms, `a.h.NjTrP<n> = "…".split(" ")` @14923497) and
//   `CustomMaps.EquipmentSets` (`a.h.GODSHARD_SET = [...]` @14978563). N.js builds them in code; the committed
//   copy comes from an older extractor, so __tests__/lib/game/data.test.ts compares every entry with the live N.js.
// - `Number2Letter`: the game's letter table, `getGameAttribute("Number2Letter")`. Provenance (Ruling I): N.js only reads it
//   (344 reads, no writer) and the string is not a literal anywhere in the bundle: it is a game-attribute default from outside
//   N.js. The value comes from the legacy hardcoded table (`N2L`, hardcoded.js). It cannot be compared with N.js; it is verified
//   indirectly, by the EventShopOwned and SuperBitType terms (and everything downstream of them) matching lib/arkh and the game
//   on the real saves (__tests__/lib/game/njs/events.test.ts). Index i is the letter Event Shop item i and Super Bit i are saved
//   under (OptionsListAccount[311], Gaming[12]).
export { NjEQ, EquipmentSets } from "@/lib/arkh/stats/data/game/custommaps.js";
export { N2L as Number2Letter } from "@/lib/arkh/stats/data/game/hardcoded.js";
