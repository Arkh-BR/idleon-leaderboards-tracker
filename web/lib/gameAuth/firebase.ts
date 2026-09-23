// Read-only REST client for the game's own Firebase project (`idlemmo`), the
// backend the game, IdleonToolbox and Idleon Efficiency all sign into. Written
// from the protocol (IdleonToolbox is GPL-3.0; nothing copied). Auth calls
// return tokens; data calls are GET-only by construction.

const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";
const SECURE_TOKEN = "https://securetoken.googleapis.com/v1/token";
const FIRESTORE =
  "https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents";
const RTDB = "https://idlemmo.firebaseio.com";

// The game's Firebase web API key comes from the environment (Vercel + local
// .env.local) so no third-party credential lives in this public repo. It still
// ships to the browser — Firebase web keys identify the project, they aren't
// secrets. Keep the literal `process.env.NEXT_PUBLIC_…`: it's what Next inlines.
function apiKey(): string {
  const key = process.env.NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY;
  if (!key) throw new Error("Sign-in isn't set up on this site yet.");
  return key;
}

export type FirebaseAuth = {
  uid: string;
  idToken: string;
  refreshToken: string;
  /** Epoch ms when `idToken` expires. */
  expiresAt: number;
};

/** A Firebase auth endpoint said no (as opposed to a network failure).
 *  `code` is Google's code, e.g. TOKEN_EXPIRED or INVALID_REFRESH_TOKEN. */
export class AuthRejectedError extends Error {
  constructor(readonly code: string) {
    super(`Sign-in was rejected (${code})`);
    this.name = "AuthRejectedError";
  }
}

/** Claims of a JWT (base64url JSON). Only reads them — Google verifies the
 *  token, we never do. */
export function jwtPayload(token: string): Record<string, unknown> {
  const b64 = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

function toAuth(idToken: string, refreshToken: string, expiresInSec: unknown): FirebaseAuth {
  const uid = String(jwtPayload(idToken).sub ?? "");
  if (!uid) throw new AuthRejectedError("NO_UID");
  return { uid, idToken, refreshToken, expiresAt: Date.now() + Number(expiresInSec) * 1000 };
}

async function authPost(url: string, headers: HeadersInit, body: BodyInit): Promise<any> {
  const r = await fetch(url, { method: "POST", headers, body });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    // "INVALID_IDP_RESPONSE : details" → "INVALID_IDP_RESPONSE"
    throw new AuthRejectedError(String(json?.error?.message ?? `HTTP_${r.status}`).split(" ")[0]);
  }
  return json;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Google ID token (from the device flow) → Firebase session. */
export async function signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseAuth> {
  const b = await authPost(
    `${IDENTITY}:signInWithIdp?key=${apiKey()}`,
    JSON_HEADERS,
    JSON.stringify({
      postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
      requestUri: "http://localhost",
      returnSecureToken: true,
    })
  );
  return toAuth(b.idToken, b.refreshToken, b.expiresIn);
}

/** Custom token (from the game's Steam function) → Firebase session. */
export async function signInWithCustomToken(token: string): Promise<FirebaseAuth> {
  const b = await authPost(
    `${IDENTITY}:signInWithCustomToken?key=${apiKey()}`,
    JSON_HEADERS,
    JSON.stringify({ token, returnSecureToken: true })
  );
  return toAuth(b.idToken, b.refreshToken, b.expiresIn);
}

/** Refresh token → fresh ID token (plus the possibly rotated refresh token). */
export async function refreshSession(refreshToken: string): Promise<FirebaseAuth> {
  const b = await authPost(
    `${SECURE_TOKEN}?key=${apiKey()}`,
    { "Content-Type": "application/x-www-form-urlencoded" },
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
  );
  return toAuth(b.id_token, b.refresh_token, b.expires_in);
}

type FsValue = Record<string, any>;

function decodeValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) {
    const n = Number(v.doubleValue);
    return Number.isFinite(n) ? n : null; // NaN/Infinity → null, like a pasted JSON
  }
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFirestoreFields(v.mapValue.fields ?? {});
  if ("timestampValue" in v) return v.timestampValue;
  return null; // nullValue, plus types the save never uses (bytes, reference, geo)
}

/** Firestore REST typed fields → the plain object the SDK's `.data()` gives. */
export function decodeFirestoreFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

export type FirestoreDoc = {
  fields: Record<string, unknown>;
  createTime: string;
  updateTime: string;
};

const bearer = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

/** GET a Firestore document; null when it doesn't exist. */
export async function firestoreGet(path: string, idToken: string): Promise<FirestoreDoc | null> {
  const r = await fetch(`${FIRESTORE}/${path}`, bearer(idToken));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Couldn't read your save (HTTP ${r.status})`);
  const doc = await r.json();
  return {
    fields: decodeFirestoreFields(doc.fields ?? {}),
    createTime: doc.createTime,
    updateTime: doc.updateTime,
  };
}

/** Just the document's updateTime (~200 B instead of the whole save): a field
 *  mask naming a field that doesn't exist returns the metadata only. */
export async function firestoreUpdateTime(path: string, idToken: string): Promise<string | null> {
  const r = await fetch(`${FIRESTORE}/${path}?mask.fieldPaths=zzNoSuchField`, bearer(idToken));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Couldn't check your save (HTTP ${r.status})`);
  return (await r.json()).updateTime ?? null;
}

/** GET a Realtime Database path (JSON null when absent). */
export async function rtdbGet(path: string, idToken: string): Promise<unknown> {
  const r = await fetch(`${RTDB}/${path}.json?auth=${encodeURIComponent(idToken)}`);
  if (!r.ok) throw new Error(`Couldn't read your save (HTTP ${r.status})`);
  return r.json();
}
