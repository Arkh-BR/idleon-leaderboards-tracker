import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fb = vi.hoisted(() => ({ refreshSession: vi.fn(), firestoreUpdateTime: vi.fn() }));
vi.mock("@/lib/gameAuth/firebase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gameAuth/firebase")>()),
  ...fb,
}));
const ev = vi.hoisted(() => ({ fetchSaveEnvelope: vi.fn() }));
vi.mock("@/lib/gameAuth/envelope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gameAuth/envelope")>()),
  ...ev,
}));

import { AuthRejectedError, type FirebaseAuth } from "@/lib/gameAuth/firebase";
import { NoCharactersError } from "@/lib/gameAuth/envelope";
import {
  accountAutoLoads,
  autoUpdateMode,
  cachedEnvelope,
  checkForUpdate,
  hasSession,
  lastCheckAt,
  loadAccountSave,
  SessionExpiredError,
  setAutoUpdateMode,
  signOut,
  startSession,
} from "@/lib/gameAuth/session";

const KEY = "gameAuth.session.v1";
const AUTH = { uid: "u1", idToken: "id1", refreshToken: "r1", expiresAt: Date.now() + 3_600_000 };
const T0 = "2026-09-22T10:00:00Z";
const ENV = { charNames: ["Alpha"], lastUpdated: Date.parse(T0) };
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null");
const storeSession = () =>
  localStorage.setItem(KEY, JSON.stringify({ v: 1, provider: "google", uid: "u1", refreshToken: "r0" }));

beforeEach(() => {
  signOut();
  setAutoUpdateMode("on");
  fb.refreshSession.mockReset();
  fb.firestoreUpdateTime.mockReset();
  ev.fetchSaveEnvelope.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** A refreshSession the test finishes by hand. */
function pendingRefresh() {
  let finish!: (a: FirebaseAuth) => void;
  fb.refreshSession.mockImplementation(() => new Promise<FirebaseAuth>((r) => (finish = r)));
  return (a: FirebaseAuth) => finish(a);
}

describe("session persistence", () => {
  it("Keep me signed in stores only {v, provider, uid, refreshToken}", () => {
    startSession(AUTH, "google", true);
    expect(stored()).toEqual({ v: 1, provider: "google", uid: "u1", refreshToken: "r1" });
  });

  it("without it nothing is stored, but the session works this visit", () => {
    startSession(AUTH, "steam", false);
    expect(stored()).toBeNull();
    expect(hasSession()).toBe(true);
  });

  it("signOut forgets the session, the stored token and the cached save", async () => {
    startSession(AUTH, "google", true);
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    await loadAccountSave();
    signOut();
    expect(hasSession()).toBe(false);
    expect(stored()).toBeNull();
    expect(cachedEnvelope()).toBeNull();
  });
});

describe("loadAccountSave", () => {
  it("a stored session refreshes, re-stores the rotated token and loads once per visit", async () => {
    storeSession();
    fb.refreshSession.mockResolvedValue({ ...AUTH, refreshToken: "r2" });
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    expect(await loadAccountSave()).toBe(ENV);
    expect(fb.refreshSession).toHaveBeenCalledWith("r0");
    expect(ev.fetchSaveEnvelope).toHaveBeenCalledWith("u1", "id1");
    expect(stored().refreshToken).toBe("r2");
    await loadAccountSave();
    expect(ev.fetchSaveEnvelope).toHaveBeenCalledTimes(1);
    await loadAccountSave({ force: true });
    expect(ev.fetchSaveEnvelope).toHaveBeenCalledTimes(2);
  });

  it("a fresh ID token isn't refreshed", async () => {
    startSession(AUTH, "google", false);
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    await loadAccountSave();
    expect(fb.refreshSession).not.toHaveBeenCalled();
  });

  it("a rejected refresh signs out with 'Session expired'", async () => {
    storeSession();
    fb.refreshSession.mockRejectedValue(new AuthRejectedError("TOKEN_EXPIRED"));
    await expect(loadAccountSave()).rejects.toThrow("Session expired — sign in again");
    expect(hasSession()).toBe(false);
  });

  it("a network error keeps the session", async () => {
    storeSession();
    fb.refreshSession.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(loadAccountSave()).rejects.toThrow("Failed to fetch");
    expect(hasSession()).toBe(true);
  });

  it("an account without characters signs out", async () => {
    startSession(AUTH, "google", true);
    ev.fetchSaveEnvelope.mockRejectedValue(new NoCharactersError());
    await expect(loadAccountSave()).rejects.toBeInstanceOf(NoCharactersError);
    expect(hasSession()).toBe(false);
  });

  it("USER_DISABLED (a dead-session code) signs out", async () => {
    storeSession();
    fb.refreshSession.mockRejectedValue(new AuthRejectedError("USER_DISABLED"));
    await expect(loadAccountSave()).rejects.toThrow("Session expired — sign in again");
    expect(hasSession()).toBe(false);
  });

  it("HTTP_503 (a transient error) keeps the session", async () => {
    storeSession();
    fb.refreshSession.mockRejectedValue(new AuthRejectedError("HTTP_503"));
    await expect(loadAccountSave()).rejects.toThrow("HTTP_503");
    expect(hasSession()).toBe(true);
    expect(stored().refreshToken).toBe("r0");
  });

  it("a Google account with no Idleon save (the wrong account) signs out", async () => {
    const real = await vi.importActual<typeof import("@/lib/gameAuth/envelope")>(
      "@/lib/gameAuth/envelope"
    );
    ev.fetchSaveEnvelope.mockImplementation(real.fetchSaveEnvelope);
    // No _data document (404) and no characters.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("firestore.googleapis.com")
          ? new Response("{}", { status: 404 })
          : new Response("null")
      )
    );
    startSession(AUTH, "google", true);
    await expect(loadAccountSave()).rejects.toThrow("is this the account you play Idleon with?");
    expect(hasSession()).toBe(false);
    expect(stored()).toBeNull();
  });
});

describe("a signed-out session stays signed out", () => {
  it("Sign out while a refresh is pending: nothing is resurrected or re-stored", async () => {
    storeSession();
    const finish = pendingRefresh();
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    const load = loadAccountSave();
    expect(fb.refreshSession).toHaveBeenCalledWith("r0");
    signOut();
    finish({ ...AUTH, refreshToken: "r2" });
    await expect(load).rejects.toBeInstanceOf(SessionExpiredError);
    expect(hasSession()).toBe(false);
    expect(stored()).toBeNull();
    expect(cachedEnvelope()).toBeNull();
    expect(ev.fetchSaveEnvelope).not.toHaveBeenCalled();
  });

  it("signed out in another tab: the next load here signs out too", async () => {
    startSession(AUTH, "google", true);
    localStorage.removeItem(KEY); // the other tab's Sign out
    await expect(loadAccountSave()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(hasSession()).toBe(false);
    expect(ev.fetchSaveEnvelope).not.toHaveBeenCalled();
  });

  it("signed out in another tab during a refresh: the fresh token isn't stored back", async () => {
    storeSession();
    const finish = pendingRefresh();
    const load = loadAccountSave();
    localStorage.removeItem(KEY);
    finish({ ...AUTH, refreshToken: "r2" });
    await expect(load).rejects.toBeInstanceOf(SessionExpiredError);
    expect(stored()).toBeNull();
    expect(hasSession()).toBe(false);
  });

  it("storage refusing writes: a kept session still works this visit", async () => {
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      startSession({ ...AUTH, expiresAt: 0 }, "google", true);
      fb.refreshSession.mockResolvedValue(AUTH);
      ev.fetchSaveEnvelope.mockResolvedValue(ENV);
      expect(await loadAccountSave()).toBe(ENV);
      expect(hasSession()).toBe(true);
    } finally {
      setItem.mockRestore();
    }
  });
});

describe("checkForUpdate", () => {
  it("same updateTime → null without downloading; newer → the new save", async () => {
    startSession(AUTH, "google", false);
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    await loadAccountSave();

    fb.firestoreUpdateTime.mockResolvedValue(T0);
    expect(await checkForUpdate()).toBeNull();
    expect(fb.firestoreUpdateTime).toHaveBeenCalledWith("_data/u1", "id1");
    expect(ev.fetchSaveEnvelope).toHaveBeenCalledTimes(1);

    const NEWER = { charNames: ["Alpha"], lastUpdated: Date.parse("2026-09-22T10:05:00Z") };
    fb.firestoreUpdateTime.mockResolvedValue("2026-09-22T10:05:00Z");
    ev.fetchSaveEnvelope.mockResolvedValue(NEWER);
    expect(await checkForUpdate()).toBe(NEWER);
  });

  it("downloads and checks set the shared auto-update clock; a cached read doesn't", async () => {
    vi.useFakeTimers({ now: Date.now() });
    startSession(AUTH, "google", false);
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    await loadAccountSave();
    const downloadedAt = Date.now();
    expect(lastCheckAt()).toBe(downloadedAt);

    vi.advanceTimersByTime(60_000);
    await loadAccountSave(); // cached
    expect(lastCheckAt()).toBe(downloadedAt);
    fb.firestoreUpdateTime.mockResolvedValue(T0);
    await checkForUpdate();
    expect(lastCheckAt()).toBe(downloadedAt + 60_000);
  });

  it("Sign out during a check: no update and no crash", async () => {
    startSession(AUTH, "google", false);
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    await loadAccountSave();
    fb.firestoreUpdateTime.mockImplementation(async () => {
      signOut();
      return T0;
    });
    expect(await checkForUpdate()).toBeNull();
  });
});

describe("accountAutoLoads", () => {
  it("follows the loader's mount precedence (cached save → kept session unless Stop)", async () => {
    storeSession();
    vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "");
    expect(accountAutoLoads()).toBe(false); // no game key on this site
    signOut();
    vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "test-key");
    expect(accountAutoLoads()).toBe(false); // signed out
    storeSession();
    expect(accountAutoLoads()).toBe(true);
    setAutoUpdateMode("off");
    expect(accountAutoLoads()).toBe(false);
    startSession(AUTH, "google", false);
    ev.fetchSaveEnvelope.mockResolvedValue(ENV);
    await loadAccountSave();
    expect(accountAutoLoads()).toBe(true); // already loaded this visit: shown in any mode
  });
});

describe("auto-update mode", () => {
  it("Stop is remembered on the device; Pause is not", () => {
    expect(autoUpdateMode()).toBe("on");
    setAutoUpdateMode("paused");
    expect(autoUpdateMode()).toBe("paused");
    expect(localStorage.getItem("gameAuth.autoUpdate.v1")).toBeNull();
    setAutoUpdateMode("off");
    expect(autoUpdateMode()).toBe("off");
    expect(localStorage.getItem("gameAuth.autoUpdate.v1")).toBe("off");
    setAutoUpdateMode("on");
    expect(autoUpdateMode()).toBe("on");
    expect(localStorage.getItem("gameAuth.autoUpdate.v1")).toBeNull();
  });
});
