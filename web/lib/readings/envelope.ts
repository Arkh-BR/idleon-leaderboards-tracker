// A reading bundle carries the save envelope and nothing else. The session
// (refresh token, uid) lives only in localStorage, but a save loaded by name or
// pasted can carry any top-level key, so both the download and the importer go
// through this allowlist instead of hunting for secrets by name.
import type { SaveEnvelope } from "../gameAuth/envelope";

// Record<keyof SaveEnvelope, true>: tsc fails when the envelope gains or loses a key.
const ALLOWED: Record<keyof SaveEnvelope, true> = {
  data: true, charNames: true, companion: true, guildData: true, serverVars: true,
  tournament: true, accountCreateTime: true, lastUpdated: true, extraData: true,
};
const KEYS = new Set<string>(Object.keys(ALLOWED));

/** The save without any top-level key outside the envelope. */
export function stripEnvelope(save: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(save).filter(([k]) => KEYS.has(k)));
}

/** Throws when `save` is not an object or has a top-level key outside the envelope. */
export function assertEnvelope(save: unknown, who = "envelope"): void {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new Error(`${who}: not an object`);
  const extra = Object.keys(save).filter((k) => !KEYS.has(k));
  if (extra.length) throw new Error(`${who}: keys outside the save envelope: ${extra.join(", ")}`);
}
