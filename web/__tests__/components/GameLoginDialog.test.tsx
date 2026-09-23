import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { steamLoginUrl, type DeviceCode } from "@/lib/gameAuth/providers";
import type { FirebaseAuth } from "@/lib/gameAuth/firebase";

// Keep the real parseSteamReturnUrl / steamLoginUrl / GOOGLE_DEVICE_URL (the
// Steam URL-parsing logic under test is real code); mock only the
// network-calling entry points.
const providersMock = vi.hoisted(() => ({
  requestDeviceCode: vi.fn(),
  waitForGoogleIdToken: vi.fn(),
  exchangeSteamAssertion: vi.fn(),
}));
vi.mock("@/lib/gameAuth/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gameAuth/providers")>();
  return {
    ...actual,
    requestDeviceCode: providersMock.requestDeviceCode,
    waitForGoogleIdToken: providersMock.waitForGoogleIdToken,
    exchangeSteamAssertion: providersMock.exchangeSteamAssertion,
  };
});

const firebaseMock = vi.hoisted(() => ({
  signInWithGoogleIdToken: vi.fn(),
  signInWithCustomToken: vi.fn(),
}));
vi.mock("@/lib/gameAuth/firebase", () => firebaseMock);

const sessionMock = vi.hoisted(() => ({
  startSession: vi.fn(),
}));
vi.mock("@/lib/gameAuth/session", () => sessionMock);

import GameLoginDialog from "@/components/GameLoginDialog";

beforeEach(() => {
  Object.values(providersMock).forEach((f) => f.mockReset());
  Object.values(firebaseMock).forEach((f) => f.mockReset());
  Object.values(sessionMock).forEach((f) => f.mockReset());
  // Clicking "Copy code & open Google" / "Sign in through Steam" would
  // otherwise hit happy-dom's unimplemented window.open.
  vi.stubGlobal("open", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GameLoginDialog", () => {
  it("Google tab: shows the device code, then signs in and starts a kept-in session", async () => {
    const CODE: DeviceCode = { deviceCode: "devcode-1", userCode: "WXYZ-9999", interval: 5, expiresAt: Date.now() + 1_800_000 };
    const AUTH: FirebaseAuth = { uid: "u1", idToken: "id-1", refreshToken: "r-1", expiresAt: Date.now() + 3_600_000 };
    providersMock.requestDeviceCode.mockResolvedValue(CODE);
    providersMock.waitForGoogleIdToken.mockResolvedValue("google-id-token-xyz");
    firebaseMock.signInWithGoogleIdToken.mockResolvedValue(AUTH);

    const onSignedIn = vi.fn();
    render(<GameLoginDialog tab="google" onClose={vi.fn()} onSignedIn={onSignedIn} />);

    expect(await screen.findByText("WXYZ-9999")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked(); // "Keep me signed in" defaults on
    expect(screen.getByText(/It can act on your game account, so only use this on your own device/))
      .toBeInTheDocument();
    // a11y: the dialog is named by its title; the tabs point at their panel.
    expect(screen.getByRole("dialog", { name: "Sign in with your Idleon account" })).toBeInTheDocument();
    const panelId = screen.getByRole("tabpanel").id;
    expect(panelId).not.toBe("");
    expect(screen.getByRole("tab", { name: "Google" })).toHaveAttribute("aria-controls", panelId);
    expect(screen.getByRole("tab", { name: "Steam" })).toHaveAttribute("aria-controls", panelId);

    await waitFor(() =>
      expect(firebaseMock.signInWithGoogleIdToken).toHaveBeenCalledWith("google-id-token-xyz")
    );
    await waitFor(() =>
      expect(sessionMock.startSession).toHaveBeenCalledWith(AUTH, "google", true)
    );
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('unchecking "Keep me signed in" before approval starts a session that is not kept', async () => {
    const CODE: DeviceCode = { deviceCode: "devcode-2", userCode: "AAAA-1111", interval: 5, expiresAt: Date.now() + 1_800_000 };
    const AUTH: FirebaseAuth = { uid: "u2", idToken: "id-2", refreshToken: "r-2", expiresAt: Date.now() + 3_600_000 };
    providersMock.requestDeviceCode.mockResolvedValue(CODE);
    let resolveToken!: (v: string) => void;
    providersMock.waitForGoogleIdToken.mockImplementation(
      () => new Promise<string>((resolve) => { resolveToken = resolve; })
    );
    firebaseMock.signInWithGoogleIdToken.mockResolvedValue(AUTH);

    const onSignedIn = vi.fn();
    render(<GameLoginDialog tab="google" onClose={vi.fn()} onSignedIn={onSignedIn} />);

    await screen.findByText("AAAA-1111");
    fireEvent.click(screen.getByRole("checkbox")); // uncheck before approval arrives
    expect(screen.getByRole("checkbox")).not.toBeChecked();

    await act(async () => {
      resolveToken("tok-2");
    });

    await waitFor(() =>
      expect(sessionMock.startSession).toHaveBeenCalledWith(AUTH, "google", false)
    );
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it("a rejected Google wait shows the error, and Try again requests a new code", async () => {
    const CODE: DeviceCode = { deviceCode: "devcode-3", userCode: "BBBB-2222", interval: 5, expiresAt: Date.now() + 1_800_000 };
    providersMock.requestDeviceCode.mockResolvedValue(CODE);
    providersMock.waitForGoogleIdToken
      .mockRejectedValueOnce(new Error("Google sign-in was cancelled."))
      .mockImplementation(() => new Promise<string>(() => {})); // retry: left pending, nothing further asserted

    render(<GameLoginDialog tab="google" onClose={vi.fn()} onSignedIn={vi.fn()} />);

    expect(await screen.findByText(/Google sign-in was cancelled\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));

    await waitFor(() => expect(providersMock.requestDeviceCode).toHaveBeenCalledTimes(2));
  });

  it("Steam tab: an invalid address is rejected inline; a valid one signs in", async () => {
    const AUTH: FirebaseAuth = { uid: "u3", idToken: "id-3", refreshToken: "r-3", expiresAt: Date.now() + 3_600_000 };
    providersMock.exchangeSteamAssertion.mockResolvedValue("custom-token-abc");
    firebaseMock.signInWithCustomToken.mockResolvedValue(AUTH);

    const onSignedIn = vi.fn();
    render(<GameLoginDialog tab="steam" onClose={vi.fn()} onSignedIn={onSignedIn} />);

    // The Steam window can't reach back into this page.
    fireEvent.click(screen.getByRole("button", { name: "Sign in through Steam" }));
    expect(window.open).toHaveBeenCalledWith(steamLoginUrl(), "_blank", "popup,noopener");

    const input = screen.getByPlaceholderText(/steamsso/i);
    const submit = screen.getByRole("button", { name: /Log in/ });

    fireEvent.change(input, { target: { value: "https://example.com/x" } });
    fireEvent.click(submit);
    expect(await screen.findByText(/should start with/)).toBeInTheDocument();
    expect(providersMock.exchangeSteamAssertion).not.toHaveBeenCalled();

    const VALID_URL =
      "https://www.legendsofidleon.com/steamsso/?openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F76561198000000001&openid.response_nonce=n&openid.assoc_handle=a&openid.sig=s&openid.signed=x";
    fireEvent.change(input, { target: { value: VALID_URL } });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(providersMock.exchangeSteamAssertion).toHaveBeenCalledWith({
        claimedId: "76561198000000001",
        nonce: "n",
        assocHandle: "a",
        sig: "s",
        signed: "x",
      })
    );
    expect(firebaseMock.signInWithCustomToken).toHaveBeenCalledWith("custom-token-abc");
    await waitFor(() =>
      expect(sessionMock.startSession).toHaveBeenCalledWith(AUTH, "steam", true)
    );
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it("closing the dialog while Google is waiting aborts the pending wait", async () => {
    const CODE: DeviceCode = { deviceCode: "devcode-5", userCode: "CCCC-3333", interval: 5, expiresAt: Date.now() + 1_800_000 };
    providersMock.requestDeviceCode.mockResolvedValue(CODE);
    let capturedSignal: AbortSignal | null = null;
    providersMock.waitForGoogleIdToken.mockImplementation((_c: DeviceCode, signal: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<string>(() => {}); // never resolves
    });

    const { rerender } = render(
      <GameLoginDialog tab="google" onClose={vi.fn()} onSignedIn={vi.fn()} />
    );

    await waitFor(() => expect(capturedSignal).not.toBeNull());
    expect(capturedSignal!.aborted).toBe(false);

    rerender(<GameLoginDialog tab={null} onClose={vi.fn()} onSignedIn={vi.fn()} />);

    await waitFor(() => expect(capturedSignal!.aborted).toBe(true));
  });

  it("closing after Google approval, before the game's sign-in answers, doesn't sign in", async () => {
    const CODE: DeviceCode = { deviceCode: "devcode-6", userCode: "DDDD-4444", interval: 5, expiresAt: Date.now() + 1_800_000 };
    const AUTH: FirebaseAuth = { uid: "u6", idToken: "id-6", refreshToken: "r-6", expiresAt: Date.now() + 3_600_000 };
    providersMock.requestDeviceCode.mockResolvedValue(CODE);
    providersMock.waitForGoogleIdToken.mockResolvedValue("google-id-token-6");
    let finish!: (a: FirebaseAuth) => void;
    firebaseMock.signInWithGoogleIdToken.mockImplementation(
      () => new Promise<FirebaseAuth>((resolve) => { finish = resolve; })
    );

    const onSignedIn = vi.fn();
    const { rerender } = render(
      <GameLoginDialog tab="google" onClose={vi.fn()} onSignedIn={onSignedIn} />
    );
    await waitFor(() => expect(firebaseMock.signInWithGoogleIdToken).toHaveBeenCalled());

    rerender(<GameLoginDialog tab={null} onClose={vi.fn()} onSignedIn={onSignedIn} />);
    await act(async () => {
      finish(AUTH);
    });

    expect(sessionMock.startSession).not.toHaveBeenCalled();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
