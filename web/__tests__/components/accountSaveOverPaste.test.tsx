import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// The real ProfileNameLoader + session; only the network edges are mocked.
const fb = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock("@/lib/gameAuth/firebase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gameAuth/firebase")>()),
  ...fb,
}));
const ev = vi.hoisted(() => ({ fetchSaveEnvelope: vi.fn() }));
vi.mock("@/lib/gameAuth/envelope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gameAuth/envelope")>()),
  ...ev,
}));
// The engines aren't under test.
vi.mock("@/lib/arkh/computeDR", () => ({
  computeArkhDropRate: () => {
    throw new Error("stub");
  },
}));
vi.mock("@/lib/arkh/computeCoin", () => ({ computeArkhCoinMulti: () => { throw new Error("stub"); } }));
vi.mock("@/lib/talentsLevel/compute", () => ({
  getActivePresetIdx: () => 0,
  computeTalentEffective: () => {
    throw new Error("stub");
  },
}));
vi.mock("@/lib/talentsLevel/toMax", () => ({ computeTalentsToMax: () => [] }));
vi.mock("@/lib/talentsLevel/unbooked", () => ({ computeUnbooked: () => [] }));

import { loadAccountSave, setAutoUpdateMode, signOut, startSession } from "@/lib/gameAuth/session";
import DrCalculator from "@/components/dropRate/DrCalculator";
import TalentsLevelPageClient from "@/app/talents-level/TalentsLevelPageClient";
import StatCalculator from "@/components/statTracker/StatCalculator";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";

const AUTH = { uid: "u1", idToken: "id1", refreshToken: "r1", expiresAt: Date.now() + 3_600_000 };
const ACCOUNT = {
  charNames: ["AccountChar"],
  lastUpdated: Date.parse("2026-09-22T10:00:00Z"),
  data: { PVStatList_0: [1, 1, 1, 1, 500], CurrentMap_0: 2 },
};
const OLD_PASTE = JSON.stringify({
  charNames: ["OldPasteChar"],
  data: { PVStatList_0: [1, 1, 1, 1, 100], CurrentMap_0: 3 },
});
const ACCOUNT_CHAR = "AccountChar (Lv 500)";

/** The character the page's character dropdown shows. */
function shownChar() {
  const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
  return select.options[select.selectedIndex]?.textContent ?? "";
}

async function loadAccountThisVisit() {
  startSession(AUTH, "google", false);
  await loadAccountSave();
}

beforeEach(() => {
  signOut();
  setAutoUpdateMode("on");
  vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "test-key");
  ev.fetchSaveEnvelope.mockReset().mockResolvedValue(ACCOUNT);
  fb.refreshSession.mockReset().mockResolvedValue(AUTH);
});

afterEach(() => vi.unstubAllEnvs());

describe("an old pasted save never overrides the account save", () => {
  it("Drop Rate — account save already loaded this visit", async () => {
    localStorage.setItem("drop-rate-tracker.last-upload.v1", OLD_PASTE);
    await loadAccountThisVisit();
    render(<DrCalculator />);
    await waitFor(() => expect(shownChar()).toBe(ACCOUNT_CHAR));
  });

  it("Drop Rate — kept session loading on open: the paste isn't shown meanwhile", async () => {
    localStorage.setItem("drop-rate-tracker.last-upload.v1", OLD_PASTE);
    localStorage.setItem(
      "gameAuth.session.v1",
      JSON.stringify({ v: 1, provider: "google", uid: "u1", refreshToken: "r0" })
    );
    render(<DrCalculator />);
    expect(shownChar()).not.toMatch(/OldPasteChar/);
    await waitFor(() => expect(shownChar()).toBe(ACCOUNT_CHAR));
  });

  it("Talents — account save already loaded this visit", async () => {
    localStorage.setItem("talents-level.last-upload.v1", OLD_PASTE);
    await loadAccountThisVisit();
    render(<TalentsLevelPageClient />);
    await waitFor(() => expect(shownChar()).toBe(ACCOUNT_CHAR));
  });

  it("signed out, the old paste is still restored", async () => {
    localStorage.setItem("drop-rate-tracker.last-upload.v1", OLD_PASTE);
    render(<DrCalculator />);
    await waitFor(() => expect(shownChar()).toBe("OldPasteChar (Lv 100)"));
  });

  it("Coin Multi — account save already loaded this visit", async () => {
    localStorage.setItem("coin-multi-tracker.last-upload.v1", OLD_PASTE);
    await loadAccountThisVisit();
    render(<StatCalculator config={COIN_PAGE} />);
    await waitFor(() => expect(shownChar()).toBe(ACCOUNT_CHAR));
  });
});
