import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

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
const SessionExpiredError = vi.hoisted(() => class SessionExpiredError extends Error {});
vi.mock("@/lib/gameAuth/session", () => ({ ...s, SessionExpiredError }));

// The panels compute the whole tome; capture what the page hands them instead.
type PanelProps = { loaded?: unknown; onPasted?: (j: string | null) => void };
const panels = vi.hoisted(() => ({ best: vi.fn(), raw: vi.fn() }));
vi.mock("@/components/tome/BestTomePanel", () => ({
  default: (props: PanelProps) => {
    panels.best(props);
    return null;
  },
}));
vi.mock("@/components/tome/TomeRawPanel", () => ({
  default: (props: PanelProps) => {
    panels.raw(props);
    return null;
  },
}));

import TomePageClient from "@/app/tome/TomePageClient";

const ENV = { charNames: ["Alpha"], lastUpdated: Date.parse("2026-09-22T10:00:00Z"), data: { Lv0_0: 5 } };
const lastProps = (panel: typeof panels.best): PanelProps => panel.mock.lastCall![0];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "test-key");
  Object.values(s).forEach((f) => f.mockReset());
  s.hasSession.mockReturnValue(true);
  s.cachedEnvelope.mockReturnValue(ENV); // signed in, save already loaded this visit
  s.autoUpdateMode.mockReturnValue("on");
  s.lastCheckAt.mockReturnValue(Date.now());
  panels.best.mockReset();
  panels.raw.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe("TomePageClient — one loader above the tabs", () => {
  it("delivers the account save to the default Best Tome tab, and to the Raw tab", () => {
    render(<TomePageClient />);
    expect(lastProps(panels.best).loaded).toEqual(ENV);
    expect(JSON.parse(localStorage.getItem("idleon-leaderboards.tome.rawJson")!)).toEqual(ENV);
    fireEvent.click(screen.getByRole("tab", { name: /Paste your data here/ }));
    expect(lastProps(panels.raw).loaded).toEqual(ENV);
  });

  it("a save pasted in the Raw tab is what the Best Tome tab shows next", () => {
    render(<TomePageClient />);
    fireEvent.click(screen.getByRole("tab", { name: /Paste your data here/ }));
    act(() => lastProps(panels.raw).onPasted!("PASTED JSON"));
    fireEvent.click(screen.getByRole("tab", { name: /Best Tome/ }));
    expect(lastProps(panels.best).loaded).toBe("PASTED JSON");
  });

  it("a paste or Clear in the Raw tab clears a stale load error above the tabs", async () => {
    s.cachedEnvelope.mockReturnValue(null);
    s.loadAccountSave.mockRejectedValue(new Error("Couldn't read your save (HTTP 503)"));
    render(<TomePageClient />);
    expect(await screen.findByText("Error:")).toBeInTheDocument(); // the page's banner
    fireEvent.click(screen.getByRole("tab", { name: /Paste your data here/ }));
    act(() => lastProps(panels.raw).onPasted!("PASTED JSON"));
    expect(screen.queryByText("Error:")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Sync now/ })); // fails again
    expect(await screen.findByText("Error:")).toBeInTheDocument();
    act(() => lastProps(panels.raw).onPasted!(null)); // Clear
    expect(screen.queryByText("Error:")).toBeNull();
  });
});
