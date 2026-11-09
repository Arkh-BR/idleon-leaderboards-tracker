// The lib/game data entry point: the lists the updater generates from the live N.js. custommaps.js and
// hardcoded.js are left out on purpose: an older extract.cjs made them, not the updater.
// The generated files live in ./generated.
export * from "@/lib/game/data/generated/items.js";
export * from "@/lib/game/data/generated/customlists.js";
export * from "@/lib/game/data/generated/monsters.js";
// The few CustomMaps tables and the game's letter table the ported functions read. The updater does not emit
// these (see maps.ts for where each comes from and how it is checked against the live N.js).
export * from "./maps";
