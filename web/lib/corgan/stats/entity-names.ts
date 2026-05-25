// ===== ENTITY NAMES — Minimal port =====
//
// Corgan's full entity-names.js (182 lines) resolves entity IDs to readable
// "System: Name" labels using ~25 game-data tables. Porting all those
// lookups to TypeScript is mechanical but verbose.
//
// For Stage 2 we expose only the public API (`label()` and `entityName()`)
// with a fallback that returns "System ID" form. Numeric values computed by
// the systems remain exact; only the *display label* falls back. A later
// stage can replace this with the full lookup-table implementation when we
// want pretty names like "Robbing Hood" instead of "Talent 279".

export function entityName(_system: string, _id: unknown): string {
  return "";
}

export function label(
  system: string,
  id: unknown,
  suffix?: string
): string {
  const idStr = Array.isArray(id) ? id.join(",") : String(id);
  return system + " " + idStr + (suffix || "");
}
