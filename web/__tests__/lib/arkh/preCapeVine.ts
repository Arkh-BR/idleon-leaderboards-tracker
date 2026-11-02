/** In-game readings taken before the 2026-11-01 update (The Cape Vine) were
 *  taken while a worn cape still counted. Putting KLA_N[100][0] above 0 turns
 *  N.js CapevineBonusesSystemON off for every character, so a pre-update save
 *  is evaluated under the rules its reading was taken with. Test-only. */
export function capeVineOff<T extends { data: Record<string, unknown> }>(save: T): T {
  for (const k of Object.keys(save.data)) {
    if (!/^KLA_\d+$/.test(k)) continue;
    const raw = save.data[k];
    const kla = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(kla?.[100])) kla[100][0] = 1;
    save.data[k] = typeof raw === "string" ? JSON.stringify(kla) : kla;
  }
  return save;
}
