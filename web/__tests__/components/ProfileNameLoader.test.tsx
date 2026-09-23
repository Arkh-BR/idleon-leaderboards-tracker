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
}));
vi.mock("@/lib/gameAuth/session", () => s);

import ProfileNameLoader from "@/components/ProfileNameLoader";

const ENV = { charNames: ["Alpha"], lastUpdated: Date.parse("2026-09-22T10:00:00Z") };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "test-key");
  Object.values(s).forEach((f) => f.mockReset());
  s.hasSession.mockReturnValue(false);
  s.cachedEnvelope.mockReturnValue(null);
  s.autoUpdateMode.mockReturnValue("on");
  s.checkForUpdate.mockResolvedValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string) => new Response(JSON.stringify({ data: {}, charNames: ["Named"] })))
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

  it("auto-update: every 5 min a newer save arrives as a refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    s.hasSession.mockReturnValue(true);
    s.loadAccountSave.mockResolvedValue(ENV);
    const NEWER = { ...ENV, lastUpdated: ENV.lastUpdated + 60_000 };
    s.checkForUpdate.mockResolvedValue(NEWER);
    const onSave = vi.fn();
    render(<ProfileNameLoader storageKey="k" onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(ENV, { refresh: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(s.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith(NEWER, { refresh: true });
  });
});
