// ===== SIGIL & CHARM DATA =====
// 1:1 port of corgan-source/js/stats/data/common/sigils.js.
import { SigilDesc } from "../game/customlists.js";
import { NjEQ } from "../game/custommaps.js";

export function sigilTiers(
  idx: number
): [number, number, number, number, number] | null {
  const s = (SigilDesc as any)[idx];
  // SigilDesc layout (per N.js linha 7744288): per-tier value at indices
  //   [3]  tier 0 — Lit
  //   [4]  tier 1 — Plus
  //   [8]  tier 2 — Glowing
  //   [10] tier 3 — Sparkling
  //   [12] tier 4 — Eclectic  (newest tier, used when level >= 3.5)
  return s
    ? [
        Number(s[3]),
        Number(s[4]),
        Number(s[8]),
        Number(s[10]),
        Number(s[12]),
      ]
    : null;
}

export function pristineCharmBonus(idx: number): number {
  const key = "NjTrP" + idx;
  return (NjEQ as any)[key] ? Number((NjEQ as any)[key][3]) || 0 : 0;
}
