// The rows under each source of the Drop Rate V1 tree (lib/dropRate/v1Sources.ts), read from lib/game's blocks: one file per family, each adding its entries here.
import type { Ctx } from "@/lib/game/ctx";
import type { ArkhNode } from "../node";
import { COLLECTION_EXPLAINERS } from "./collections";
import { EQUIPMENT_EXPLAINERS } from "./equipment";
import { SIMPLE_EXPLAINERS } from "./simple";
import { TALENT_EXPLAINERS } from "./talent";
import { WORLD67_EXPLAINERS } from "./world67";

/** The rows under a source: `value` is the source's own number, as the row shows it. */
export type Explainer = (ctx: Ctx, value: number) => ArkhNode[];

/** By V1 source id. A source with no entry is a leaf. */
export const EXPLAINERS: Record<string, Explainer> = { ...TALENT_EXPLAINERS, ...EQUIPMENT_EXPLAINERS, ...WORLD67_EXPLAINERS, ...COLLECTION_EXPLAINERS, ...SIMPLE_EXPLAINERS };
