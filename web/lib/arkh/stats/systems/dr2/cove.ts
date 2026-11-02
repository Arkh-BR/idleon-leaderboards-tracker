// ===== CRYSTAL GLUNKO COVE (Drop Rate V2) =====
// In the Drop Rate formula (N.js "Drop_Rarity" @4188223) the Cove line
//   216==CurrentMap && 17==Holes[0][<this player>] → TotStatMAP = Holes2("Cglunko_DR")
// replaces the whole total (the pre-Cove total is kept as NormzDR_GlunkC).
// Every term below is the _customBlock_Holes2 branch of the same name
// (Cglunko_DR @11051520, Cglunko_Bdig @11052281, Cglunko_Pdig @11052903,
// Cglunko_upgBon @11053998); getLOG is the engine's (ln/2.30259, @4458794).

import { optionsListData } from "../../../save/data";
import { getLOG } from "../../../formulas";
import { RandoListo2 } from "../../data/game/customlists.js";
import type { SaveData } from "../../../state";

const ola = (i: number) => Number((optionsListData as any[])?.[i]) || 0;

/** N.js Holes2("Cglunko_upgBon", i) = OLA[630+i] · RandoListo2[13][i]: the
 *  upgrade's level times its per-level value. */
// @njs _customBlock_Holes2
export function cglunkoUpgBon(i: number, _s: SaveData): number {
  return ola(630 + i) * (Number((RandoListo2 as any)[13]?.[i]) || 0);
}

/** Σ ⌈getLOG(OLA[from..from+5])⌉: the digit count of six shape counters. */
const digitSum6 = (from: number) => {
  let t = 0;
  for (let k = 0; k < 6; k++) t += Math.ceil(getLOG(ola(from + k)));
  return t;
};

/** N.js Holes2("Cglunko_DR") (@11051520), the DR on map 216 in cavern 17:
 *  (1 + (u1 + u17 + u21)/100) · (1 + u3/100) · (1 + u12/100)
 *  · (1 + u10·Bdig/100) · (1 + u22·Pdig/100)
 *  · (1 + u4·⌈getLOG OLA[668]⌉/100) · (1 + u18·⌈getLOG OLA[200]⌉/100)
 *  with Bdig = Σ⌈getLOG OLA[654..659]⌉ (blue shapes) and
 *  Pdig = Σ⌈getLOG OLA[660..665]⌉ (purple shapes). OLA[200] is read from the
 *  save as is. It is NOT the Drop Rate the game last saved: N.js (@5737687)
 *  writes it only when TotalStats("Drop_Rarity") > OLA[200] && 216 != CurrentMap,
 *  i.e. it holds the best non-Cove Drop Rate ever recorded. */
// @njs _customBlock_Holes2
export function cglunkoDR(s: SaveData): number {
  const u = (i: number) => cglunkoUpgBon(i, s);
  return (
    (1 + (u(1) + (u(17) + u(21))) / 100) *
    (1 + u(3) / 100) *
    (1 + u(12) / 100) *
    (1 + (u(10) * digitSum6(654)) / 100) *
    (1 + (u(22) * digitSum6(660)) / 100) *
    (1 + (u(4) * Math.ceil(getLOG(ola(668)))) / 100) *
    (1 + (u(18) * Math.ceil(getLOG(ola(200)))) / 100)
  );
}

/** The Cove line's condition: map 216 and the character in cavern 17. */
export function coveActive(s: SaveData, ci: number, mapIdx: number): boolean {
  return mapIdx === 216 && Number((s.holesData as any)?.[0]?.[ci]) === 17;
}
