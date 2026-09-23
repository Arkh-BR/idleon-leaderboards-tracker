import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

const s = vi.hoisted(() => ({
  hasSession: vi.fn(),
  cachedEnvelope: vi.fn(),
  loadAccountSave: vi.fn(),
  checkForUpdate: vi.fn(),
  autoUpdateMode: vi.fn(),
  setAutoUpdateMode: vi.fn(),
  signOut: vi.fn(),
  startSession: vi.fn(),
  accountAutoLoads: vi.fn(),
  lastCheckAt: vi.fn(),
}));
const SessionExpiredError = vi.hoisted(
  () =>
    class SessionExpiredError extends Error {
      constructor() {
        super("Session expired — sign in again");
      }
    }
);
vi.mock("@/lib/gameAuth/session", () => ({ ...s, SessionExpiredError }));

import ProfileNameLoader from "@/components/ProfileNameLoader";

const ENV = { charNames: ["Alpha"], lastUpdated: Date.parse("2026-09-22T10:00:00Z"), data: {} };
const NAMED = { data: {}, charNames: ["Named"] };
const FIVE_MIN = 5 * 60 * 1000;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "test-key");
  Object.values(s).forEach((f) => f.mockReset());
  s.hasSession.mockReturnValue(false);
  s.cachedEnvelope.mockReturnValue(null);
  s.autoUpdateMode.mockReturnValue("on");
  s.checkForUpdate.mockResolvedValue(null);
  s.lastCheckAt.mockReturnValue(Date.now()); // the shared clock: just checked
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string) => new Response(JSON.stringify(NAMED)))
  );
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("ProfileNameLoader — game account", () => {
  it("site without the game key: no sign-in offered, the name auto-load still works", async () => {
    vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "");
    localStorage.setItem("k", "SomePlayer");
    s.hasSession.mockReturnValue(true); // even a stored session is ignored
    const onSave = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ data: {}, charNames: ["Named"] }));
    expect(screen.queryByText(/Sign in to load your save automatically/)).toBeNull();
    expect(s.loadAccountSave).not.toHaveBeenCalled();
  });

  it("signed out: offers sign-in and keeps the remembered-name auto-load", async () => {
    localStorage.setItem("k", "SomePlayer");
    const onSave = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={onSave} />);
    expect(screen.getByText(/Sign in to load your save automatically/)).toBeInTheDocument();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ data: {}, charNames: ["Named"] }));
    expect(fetch).toHaveBeenCalledWith("/api/profile?player=SomePlayer");
    expect(s.loadAccountSave).not.toHaveBeenCalled();
  });

  it("signed in: loads the account save instead of the remembered name", async () => {
    localStorage.setItem("k", "SomePlayer");
    s.hasSession.mockReturnValue(true);
    s.loadAccountSave.mockResolvedValue(ENV);
    const onSave = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(ENV, { refresh: false }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText(/auto-updating/)).toBeInTheDocument();
  });

  it("reuses the save already loaded this visit", async () => {
    s.hasSession.mockReturnValue(true);
    s.cachedEnvelope.mockReturnValue(ENV);
    const onSave = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(ENV, { refresh: false }));
    expect(s.loadAccountSave).not.toHaveBeenCalled();
    // A copy: a page writing into `data` can't touch the shared cached save.
    const [given] = onSave.mock.calls[0];
    expect(given).not.toBe(ENV);
    expect(given.data).not.toBe(ENV.data);
  });

  it("a save without a valid update time still renders, minus 'save updated'", async () => {
    s.hasSession.mockReturnValue(true);
    s.cachedEnvelope.mockReturnValue({ ...ENV, lastUpdated: NaN });
    render(<ProfileNameLoader storageKey="k" onSave={vi.fn()} />);
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText(/save updated/)).toBeNull();
  });

  it("Stop is honored on open: no account auto-load, the name auto-load runs", async () => {
    localStorage.setItem("k", "SomePlayer");
    s.hasSession.mockReturnValue(true);
    s.autoUpdateMode.mockReturnValue("off");
    render(<ProfileNameLoader storageKey="k" onSave={vi.fn()} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/profile?player=SomePlayer"));
    expect(s.loadAccountSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Start auto-update/ })).toBeInTheDocument();
  });

  it("Pause / Resume / Stop drive the session mode", async () => {
    s.hasSession.mockReturnValue(true);
    s.loadAccountSave.mockResolvedValue(ENV);
    render(<ProfileNameLoader storageKey="k" onSave={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Pause/ }));
    expect(s.setAutoUpdateMode).toHaveBeenLastCalledWith("paused");
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    expect(s.setAutoUpdateMode).toHaveBeenLastCalledWith("on");
    await waitFor(() => expect(s.checkForUpdate).toHaveBeenCalled()); // Resume checks at once
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }));
    expect(s.setAutoUpdateMode).toHaveBeenLastCalledWith("off");
    expect(screen.getByRole("button", { name: /Start auto-update/ })).toBeInTheDocument();
  });

  it("Sign out during a load: the cancelled load shows no 'Session expired'", async () => {
    s.hasSession.mockReturnValue(true);
    let reject!: (e: unknown) => void;
    s.loadAccountSave.mockReturnValue(new Promise((_, r) => (reject = r)));
    const onError = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={vi.fn()} onError={onError} />);
    s.hasSession.mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(s.signOut).toHaveBeenCalled();
    await act(async () => reject(new SessionExpiredError()));
    expect(screen.queryByText(/Session expired/)).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(screen.getByText(/Sign in to load your save automatically/)).toBeInTheDocument();
  });

  it("auto-update: 5 min after the last check a newer save arrives as a refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    s.hasSession.mockReturnValue(true);
    s.loadAccountSave.mockResolvedValue(ENV);
    const NEWER = { ...ENV, lastUpdated: ENV.lastUpdated + 60_000 };
    s.checkForUpdate.mockResolvedValue(NEWER);
    const onSave = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(ENV, { refresh: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MIN);
    });
    expect(s.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith(NEWER, { refresh: true });
  });

  it("auto-update never replaces a save loaded by name", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    s.hasSession.mockReturnValue(true);
    s.loadAccountSave.mockResolvedValue(ENV);
    s.checkForUpdate.mockResolvedValue({ ...ENV, lastUpdated: ENV.lastUpdated + 60_000 });
    const onSave = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(ENV, { refresh: false }));
    fireEvent.change(screen.getByPlaceholderText("Enter player name"), {
      target: { value: "TopPlayer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(NAMED));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MIN);
    });
    expect(s.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith(NAMED);
  });

  it("the 5-min clock is shared: a remount doesn't check again or restart the countdown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    s.hasSession.mockReturnValue(true);
    s.cachedEnvelope.mockReturnValue(ENV);
    s.lastCheckAt.mockReturnValue(Date.now()); // a check just happened
    const page1 = render(<ProfileNameLoader storageKey="k" onSave={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MIN - 60_000);
    });
    page1.unmount(); // the user switches tool pages
    render(<ProfileNameLoader storageKey="k" onSave={vi.fn()} />);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(s.checkForUpdate).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    // 5 min after the last check — not 5 min after the remount.
    expect(s.checkForUpdate).toHaveBeenCalledTimes(1);
  });
});
