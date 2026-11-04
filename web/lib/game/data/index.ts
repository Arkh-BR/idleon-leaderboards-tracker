// The lib/game data entry point: the lists the updater generates from the live N.js. custommaps.js and
// hardcoded.js are left out on purpose: an older extract.cjs made them, not the updater.
// The files still live under lib/arkh; a later plan moves them here.
export * from "@/lib/arkh/stats/data/game/items.js";
export * from "@/lib/arkh/stats/data/game/customlists.js";
export * from "@/lib/arkh/stats/data/game/monsters.js";
