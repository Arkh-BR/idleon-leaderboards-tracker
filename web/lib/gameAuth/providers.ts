// Sign-in providers for the game's Firebase, written from the protocol that
// IdleonToolbox / Idleon Efficiency use (no code copied):
//  - Google: OAuth device flow with the game's "TV / limited input" client.
//  - Steam: OpenID 2.0 returning to the game's own /steamsso/ page (the only
//    return_to the game's `asil` function verifies), then `asil` → custom token.

export const GOOGLE_DEVICE_URL = "https://www.google.com/device";
export const STEAM_RETURN_URL = "https://www.legendsofidleon.com/steamsso/";
const ASIL_URL = "https://us-central1-idlemmo.cloudfunctions.net/asil";

const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

// The game's device-flow OAuth client comes from the environment (Vercel +
// local .env.local) so no third-party credential lives in this public repo.
// It still reaches the browser — device-flow client secrets aren't
// confidential. Keep the literal `process.env.NEXT_PUBLIC_…`: Next inlines it.
function googleClient(): { id: string; secret: string } {
  const id = process.env.NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_ID;
  const secret = process.env.NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Sign-in isn't set up on this site yet.");
  return { id, secret };
}

export type DeviceCode = {
  deviceCode: string;
  userCode: string;
  /** Seconds between polls. */
  interval: number;
  /** Epoch ms after which the code is dead. */
  expiresAt: number;
};

export async function requestDeviceCode(): Promise<DeviceCode> {
  const { id } = googleClient();
  const r = await fetch("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: FORM,
    body: new URLSearchParams({ client_id: id, scope: "email profile" }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.device_code) throw new Error("Couldn't get a Google sign-in code — try again.");
  return {
    deviceCode: b.device_code,
    userCode: b.user_code,
    interval: Number(b.interval) || 5,
    expiresAt: Date.now() + (Number(b.expires_in) || 1800) * 1000,
  };
}

export type DevicePoll =
  | { status: "pending" | "slow_down" | "denied" | "expired" }
  | { status: "ok"; idToken: string };

export async function pollDeviceToken(deviceCode: string): Promise<DevicePoll> {
  const { id, secret } = googleClient();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: FORM,
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const b = await r.json().catch(() => ({}));
  if (b.id_token) return { status: "ok", idToken: b.id_token };
  if (b.error === "authorization_pending") return { status: "pending" };
  if (b.error === "slow_down") return { status: "slow_down" };
  if (b.error === "access_denied") return { status: "denied" };
  if (b.error === "expired_token") return { status: "expired" };
  throw new Error(`Google sign-in failed (${b.error ?? `HTTP ${r.status}`}).`);
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true }
    );
  });

/** Poll until the user approves on google.com/device (resolves the Google ID
 *  token) or the flow ends (rejects with a user-facing message). Abort the
 *  signal to stop polling. */
export async function waitForGoogleIdToken(code: DeviceCode, signal: AbortSignal): Promise<string> {
  let interval = code.interval;
  for (;;) {
    await sleep(interval * 1000, signal);
    if (Date.now() > code.expiresAt) throw new Error("The code expired — try again.");
    const r = await pollDeviceToken(code.deviceCode);
    if (r.status === "ok") return r.idToken;
    if (r.status === "denied") throw new Error("Google sign-in was cancelled.");
    if (r.status === "expired") throw new Error("The code expired — try again.");
    if (r.status === "slow_down") interval += 5;
  }
}

export function steamLoginUrl(): string {
  const select = "http://specs.openid.net/auth/2.0/identifier_select";
  return (
    "https://steamcommunity.com/openid/login?" +
    new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.claimed_id": select,
      "openid.identity": select,
      "openid.return_to": STEAM_RETURN_URL,
      "openid.realm": STEAM_RETURN_URL,
    })
  );
}

export type SteamAssertion = {
  /** SteamID64. */
  claimedId: string;
  nonce: string;
  assocHandle: string;
  sig: string;
  signed: string;
};

/** The address of the game's /steamsso/ page the user pasted back → the
 *  OpenID assertion `asil` needs. Throws a user-facing message otherwise. */
export function parseSteamReturnUrl(raw: string): SteamAssertion {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That isn't a web address — copy the whole address bar.");
  }
  if (!url.href.startsWith(STEAM_RETURN_URL)) {
    throw new Error(`The address should start with ${STEAM_RETURN_URL}`);
  }
  const p = url.searchParams;
  const claimedId = p.get("openid.claimed_id")?.match(/\/(\d+)$/)?.[1];
  const nonce = p.get("openid.response_nonce");
  const assocHandle = p.get("openid.assoc_handle");
  const sig = p.get("openid.sig");
  const signed = p.get("openid.signed");
  if (!claimedId || !nonce || !assocHandle || !sig || !signed) {
    throw new Error("That address is missing the Steam sign-in data — copy the whole address bar.");
  }
  return { claimedId, nonce, assocHandle, sig, signed };
}

/** Steam OpenID assertion → Firebase custom token, via the game's `asil`
 *  callable (it re-verifies the assertion with Steam). */
export async function exchangeSteamAssertion(a: SteamAssertion): Promise<string> {
  const r = await fetch(ASIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: a }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || typeof b.result !== "string" || !b.result) {
    throw new Error(`Steam sign-in failed: ${b.error?.message ?? `HTTP ${r.status}`}`);
  }
  return b.result;
}
