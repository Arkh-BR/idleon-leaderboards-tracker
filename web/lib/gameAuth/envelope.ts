// The game account's save, assembled into the envelope IdleonToolbox's
// "Copy for Support" produces — so every tool page consumes it unchanged.
import { firestoreGet, rtdbGet } from "./firebase";

export type SaveEnvelope = {
  data: Record<string, unknown>;
  charNames: string[];
  companion: unknown;
  guildData: { id: string | null; stats: unknown; members: unknown[]; points: unknown };
  serverVars: Record<string, unknown> | null;
  tournament: { user: unknown; match: unknown; global: unknown; leaderboard: unknown[] };
  /** Epoch ms in whole seconds, like IdleonToolbox. */
  accountCreateTime: number;
  /** Epoch ms the game last wrote the save. */
  lastUpdated: number;
  /** Our own Tome score, stamped where the DR loader already looks for IT's. */
  extraData: { totalTomePoints: number };
};

/** The account has nothing to load — the session signs out on it. */
export class NoCharactersError extends Error {
  constructor(message = "No characters found for this account") {
    super(message);
    this.name = "NoCharactersError";
  }
}

/** Side data is best-effort: a missing guild/tournament must not block the save. */
const optional = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

function parseJson(v: unknown): unknown {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export async function fetchSaveEnvelope(uid: string, idToken: string): Promise<SaveEnvelope> {
  const [save, charNames, companion, guildId, tUser, tMatch, tGlobal, vars] = await Promise.all([
    firestoreGet(`_data/${uid}`, idToken),
    rtdbGet(`_uid/${uid}`, idToken),
    optional(rtdbGet(`_comp/${uid}`, idToken)),
    optional(rtdbGet(`_usgu/${uid}/g`, idToken)),
    optional(rtdbGet(`_tournament/${uid}`, idToken)),
    optional(firestoreGet(`_T_RES_UID/${uid}`, idToken)),
    optional(firestoreGet("_TOURNAMENT/_TOURNAMENT", idToken)),
    optional(firestoreGet("_vars/_vars", idToken)),
  ]);
  if (!save) {
    throw new NoCharactersError(
      "No save found for this account — is this the account you play Idleon with?"
    );
  }
  if (!Array.isArray(charNames) || charNames.length === 0) throw new NoCharactersError();

  const gid = typeof guildId === "string" && guildId ? guildId : null;
  const guild = (gid ? await optional(rtdbGet(`_guild/${gid}`, idToken)) : null) as {
    m?: Record<string, unknown>;
    p?: unknown;
  } | null;

  const envelope = {
    data: save.fields,
    charNames: charNames as string[],
    companion: companion ?? null,
    guildData: {
      id: gid,
      stats: parseJson(save.fields.Guild),
      members: Object.values(guild?.m ?? {}),
      points: guild?.p ?? null,
    },
    serverVars: vars?.fields ?? null,
    tournament: {
      user: tUser ?? null,
      match: tMatch?.fields ?? null,
      global: tGlobal?.fields ?? null,
      leaderboard: [],
    },
    accountCreateTime: Math.floor(Date.parse(save.createTime) / 1000) * 1000,
    lastUpdated: Date.parse(save.updateTime),
  };
  return { ...envelope, extraData: { totalTomePoints: await tomePoints(envelope) } };
}

// computeTome copies side fields (companion, guildData, …) INTO the inner
// save, so it gets a shallow copy — the envelope's `data` stays the pristine
// save. The DR loader reads `extraData.totalTomePoints`; without it every
// Tome-driven DR bonus would be missing (IdleonToolbox normally stamps it).
// Imported on demand: this module rides along with the sign-in loader on
// every tool page, and a static import would bundle the Tome engine into all.
async function tomePoints(env: Omit<SaveEnvelope, "extraData">): Promise<number> {
  try {
    const { computeTome } = await import("@/lib/tome/compute");
    return computeTome({ ...env, data: { ...env.data } } as Parameters<typeof computeTome>[0])
      .totalPts;
  } catch {
    return 0; // same fallback the DR loader uses for a save without tome points
  }
}
