// The game's own display of MultiKillTOTAL on the AFK Info panel:
// "MULTIKILL;_" + Math.floor(MK) + "%" (N.js @3835457) — no thousands
// separator. Returns the number without the "%" (the kit's unit adds it).
export function formatMultikill(v: number): string {
  return Number.isFinite(v) ? String(Math.floor(v)) : "—";
}
