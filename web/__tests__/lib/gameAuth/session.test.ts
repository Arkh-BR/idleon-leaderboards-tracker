import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { AuthRejectedError } from "@/lib/gameAuth/firebase";
import { NoCharactersError } from "@/lib/gameAuth/envelope";
import {
  autoUpdateMode,
  cachedEnvelope,
  checkForUpdate,
  hasSession,
  loadAccountSave,
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
