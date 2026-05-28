// Bundle entry-point for the standalone DR Max research tool. Exposes
// everything the HTML needs to parse a save, list characters/maps, and
// compute the full DR tree client-side — bundled by esbuild into a single
// IIFE that attaches to globalThis.DRMax.

import { parseSave, listCharacters } from "./extract";
import { computeCorganDropRate } from "@/lib/corgan/computeDR";
import { flattenTree, type FlatTree } from "./treeFlatten";
import { buildMapOptions } from "./arcaneBonus";

(globalThis as unknown as { DRMax: unknown }).DRMax = {
  parseSave,
  listCharacters,
  computeCorganDropRate,
  flattenTree,
  buildMapOptions,
};

export type { FlatTree };
