// The signed-in game account, shared by every tool page. A module singleton on
// purpose: TopNav uses next/link, so switching tools keeps this module alive
// and the pages share one save download (and one refresh) per visit.
import {
  AuthRejectedError,
  firestoreUpdateTime,
  refreshSession,
  type FirebaseAuth,
} from "./firebase";
import { fetchSaveEnvelope, NoCharactersError, type SaveEnvelope } from "./envelope";

export type Provider = "google" | "steam";
export type AutoUpdateMode = "on" | "paused" | "off";

const SESSION_KEY = "gameAuth.session.v1";
const AUTO_KEY = "gameAuth.autoUpdate.v1";
/** Refresh the ID token when less than this is left on it. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** Refresh answers that mean the stored session is dead for good; anything
 *  else (5xx, 429, …) is transient and keeps the session like a network error. */
const DEAD_SESSION_CODES = new Set(["TOKEN_EXPIRED", "INVALID_REFRESH_TOKEN", "USER_DISABLED", "USER_NOT_FOUND"]);

type Session = FirebaseAuth & { provider: Provider; keep: boolean };
type Stored = { v: 1; provider: Provider; uid: string; refreshToken: string };

let session: Session | null = null;
let envelope: SaveEnvelope | null = null;
let paused = false;
/** Epoch ms of the last save download or update check: the auto-update clock,
 *  shared so switching pages doesn't restart the 5-min countdown. */
let lastCheck = 0;

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired — sign in again");
    this.name = "SessionExpiredError";
  }
}

function readStored(): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return s?.v === 1 && typeof s.uid === "string" && typeof s.refreshToken === "string" ? s : null;
  } catch {
    return null;
  }
}

// Only with "Keep me signed in" — never the ID token, never the save.
function persist(s: Session) {
  if (!s.keep) return;
  const stored: Stored = { v: 1, provider: s.provider, uid: s.uid, refreshToken: s.refreshToken };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  } catch {
    // Storage blocked: the session just lasts this visit — and its missing
    // stored copy mustn't read as "signed out in another tab".
    s.keep = false;
  }
}

export function startSession(auth: FirebaseAuth, provider: Provider, keep: boolean) {
  signOut();
  session = { ...auth, provider, keep };
  persist(session);
}

export function signOut() {
  session = null;
  envelope = null;
  paused = false;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function hasSession(): boolean {
  return session !== null || readStored() !== null;
}

export function cachedEnvelope(): SaveEnvelope | null {
  return envelope;
}

/** Whether ProfileNameLoader puts the account save on screen at mount — pages
 *  skip restoring an old pasted save when it will. */
export function accountAutoLoads(): boolean {
  if (!process.env.NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY) return false;
  return envelope !== null || (hasSession() && autoUpdateMode() !== "off");
}

/** When the account save was last downloaded or checked (epoch ms). */
export function lastCheckAt(): number {
  return lastCheck;
}

/** A kept session whose stored token is gone was signed out in another tab. */
const signedOutElsewhere = (s: Session) => s.keep && !readStored();

/** The refresh in flight per session, shared by concurrent callers (e.g. the
 *  next page's loader after a page switch): a second refresh would find the
 *  session already replaced by the first one's and take it for a sign-out. */
const refreshing = new WeakMap<Session, Promise<Session>>();

/** The session with an ID token good for 5+ more minutes; concurrent callers
 *  share one refresh. Signed out meanwhile — here, or in another tab (its
 *  stored token is gone) — or a refresh rejected for good ends it:
 *  SessionExpiredError, and a signed-out session never comes back. Network
 *  errors and transient rejections (5xx, 429…) propagate with the session
 *  kept. */
async function liveSession(): Promise<Session> {
  if (!session) {
    const stored = readStored();
    if (!stored) throw new SessionExpiredError();
    const { provider, uid, refreshToken } = stored;
    session = { provider, uid, refreshToken, idToken: "", expiresAt: 0, keep: true };
  }
  const s0 = session;
  if (signedOutElsewhere(s0)) {
    signOut();
    throw new SessionExpiredError();
  }
  if (s0.expiresAt - Date.now() >= REFRESH_MARGIN_MS) return s0;
  let shared = refreshing.get(s0);
  if (!shared) {
    shared = refresh(s0).finally(() => refreshing.delete(s0));
    refreshing.set(s0, shared);
  }
  return shared;
}

async function refresh(s0: Session): Promise<Session> {
  let fresh: FirebaseAuth;
  try {
    fresh = await refreshSession(s0.refreshToken);
  } catch (e) {
    if (e instanceof AuthRejectedError && DEAD_SESSION_CODES.has(e.code)) {
      if (session === s0) signOut();
      throw new SessionExpiredError();
    }
    throw e;
  }
  // Signed out or switched account during the refresh (here or elsewhere):
  // don't merge or store the fresh token.
  if (session !== s0 || signedOutElsewhere(s0)) {
    if (session === s0) signOut();
    throw new SessionExpiredError();
  }
  session = { ...s0, ...fresh };
  persist(session);
  return session;
}

/** The account save, cached for the visit unless `force`. */
export async function loadAccountSave({ force = false } = {}): Promise<SaveEnvelope> {
  if (envelope && !force) return envelope;
  lastCheck = Date.now();
  const s = await liveSession();
  let fresh: SaveEnvelope;
  try {
    fresh = await fetchSaveEnvelope(s.uid, s.idToken);
  } catch (e) {
    // No save / no characters: a dead end for this account (e.g. the wrong
    // Google account) — unless another one signed in meanwhile.
    if (e instanceof NoCharactersError && session?.uid === s.uid) signOut();
    throw e;
  }
  // Signed out (or switched account) while downloading: drop the result.
  if (session?.uid !== s.uid) throw new SessionExpiredError();
  envelope = fresh;
  return fresh;
}

/** Cheap poll: a newer save if the game wrote one since ours, else null. */
export async function checkForUpdate(): Promise<SaveEnvelope | null> {
  const known = envelope; // a Sign out during the awaits clears `envelope`
  if (!known) return loadAccountSave();
  lastCheck = Date.now();
  const s = await liveSession();
  const t = await firestoreUpdateTime(`_data/${s.uid}`, s.idToken);
  if (!t || Date.parse(t) === known.lastUpdated) return null;
  return loadAccountSave({ force: true });
}

/** "off" (Stop) is remembered on this device; "paused" lasts this visit. */
export function autoUpdateMode(): AutoUpdateMode {
  try {
    if (localStorage.getItem(AUTO_KEY) === "off") return "off";
  } catch {}
  return paused ? "paused" : "on";
}

export function setAutoUpdateMode(mode: AutoUpdateMode) {
  paused = mode === "paused";
  try {
    if (mode === "off") localStorage.setItem(AUTO_KEY, "off");
    else localStorage.removeItem(AUTO_KEY);
  } catch {}
}
