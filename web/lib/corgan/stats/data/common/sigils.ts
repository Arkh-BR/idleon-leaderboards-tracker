// ===== SIGIL & CHARM DATA =====
// 1:1 port of corgan-source/js/stats/data/common/sigils.js.
import { SigilDesc } from "../game/customlists.js";
import { NjEQ } from "../game/custommaps.js";

export function sigilTiers(idx: number): [number, number, number, number] | null {
  const s = (SigilDesc as any)[idx];
  return s
    ? [Number(s[3]), Number(s[4]), Number(s[8]), Number(s[10])]
    : null;
}

export function pristineCharmBonus(idx: number): number {
  const key = "NjTrP" + idx;
  return (NjEQ as any)[key] ? Number((NjEQ as any)[key][3]) || 0 : 0;
}
