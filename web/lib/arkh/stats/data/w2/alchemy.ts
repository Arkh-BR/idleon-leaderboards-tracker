// ===== W2 ALCHEMY DATA =====
// 1:1 port of corgan-source/js/stats/data/w2/alchemy.js.
import { AlchemyDescription } from "../game/customlists.js";

export type BubbleParams = {
  name: string;
  formula: string;
  x1: number;
  x2: number;
  cauldron: number;
  index: number;
};

export function bubbleParams(cauldron: number, idx: number): BubbleParams | null {
  const b = (AlchemyDescription as any)[cauldron]?.[idx];
  return b
    ? {
        cauldron,
        index: idx,
        x1: Number(b[1]),
        x2: Number(b[2]),
        formula: b[3],
        name: b[0],
      }
    : null;
}
