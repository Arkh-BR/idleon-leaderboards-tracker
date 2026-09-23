import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  STEAM_RETURN_URL,
  exchangeSteamAssertion,
  parseSteamReturnUrl,
  pollDeviceToken,
  requestDeviceCode,
  steamLoginUrl,
  waitForGoogleIdToken,
} from "@/lib/gameAuth/providers";

function mockFetchSeq(...answers: Array<{ status?: number; body: unknown }>) {
  const f = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = answers.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_ID", "test-client-id");
  vi.stubEnv("NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET", "test-secret");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Google device flow", () => {
  it("without the site's Google client, sign-in says it isn't set up (no request made)", async () => {
    vi.stubEnv("NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET", "");
    const f = mockFetchSeq({ body: {} });
    await expect(requestDeviceCode()).rejects.toThrow("Sign-in isn't set up on this site yet.");
    await expect(pollDeviceToken("D")).rejects.toThrow("Sign-in isn't set up on this site yet.");
    expect(f).not.toHaveBeenCalled();
  });

  it("requestDeviceCode asks for email+profile and maps the answer", async () => {
    const f = mockFetchSeq({ body: { device_code: "D", user_code: "ABC-DEF", interval: 5, expires_in: 1800 } });
    const c = await requestDeviceCode();
    expect(c).toMatchObject({ deviceCode: "D", userCode: "ABC-DEF", interval: 5 });
    expect(c.expiresAt).toBeGreaterThan(Date.now() + 1_700_000);
    expect(f.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/device/code");
    const body = new URLSearchParams(String(f.mock.calls[0][1]?.body));
    expect(body.get("scope")).toBe("email profile");
    expect(body.get("client_id")).toBe("test-client-id");
  });

  it("requestDeviceCode failure is readable", async () => {
    mockFetchSeq({ status: 400, body: { error: "invalid_client" } });
    await expect(requestDeviceCode()).rejects.toThrow("Couldn't get a Google sign-in code");
  });

  it("pollDeviceToken maps Google's answers", async () => {
    mockFetchSeq(
      { status: 428, body: { error: "authorization_pending" } },
      { status: 428, body: { error: "slow_down" } },
      { status: 403, body: { error: "access_denied" } },
      { status: 400, body: { error: "expired_token" } },
      { body: { id_token: "G" } }
    );
    expect(await pollDeviceToken("D")).toEqual({ status: "pending" });
    expect(await pollDeviceToken("D")).toEqual({ status: "slow_down" });
    expect(await pollDeviceToken("D")).toEqual({ status: "denied" });
    expect(await pollDeviceToken("D")).toEqual({ status: "expired" });
    expect(await pollDeviceToken("D")).toEqual({ status: "ok", idToken: "G" });
  });

  it("pollDeviceToken sends the device-code grant", async () => {
    const f = mockFetchSeq({ body: { id_token: "G" } });
    await pollDeviceToken("D");
    const body = new URLSearchParams(String(f.mock.calls[0][1]?.body));
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
    expect(body.get("device_code")).toBe("D");
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-secret");
  });

  it("waitForGoogleIdToken waits the interval and backs off on slow_down", async () => {
    vi.useFakeTimers();
    const f = mockFetchSeq(
      { status: 428, body: { error: "authorization_pending" } },
      { status: 428, body: { error: "slow_down" } },
      { body: { id_token: "G" } }
    );
    const code = { deviceCode: "D", userCode: "U", interval: 5, expiresAt: Date.now() + 600_000 };
    const p = waitForGoogleIdToken(code, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(5_000); // poll 1: pending
    await vi.advanceTimersByTimeAsync(5_000); // poll 2: slow_down → every 10 s
    await vi.advanceTimersByTimeAsync(9_000);
    expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000); // poll 3: approved
    await expect(p).resolves.toBe("G");
  });

  it("waitForGoogleIdToken rejects on cancel, and stops when aborted", async () => {
    vi.useFakeTimers();
    const code = { deviceCode: "D", userCode: "U", interval: 5, expiresAt: Date.now() + 600_000 };

    mockFetchSeq({ status: 403, body: { error: "access_denied" } });
    const denied = expect(waitForGoogleIdToken(code, new AbortController().signal)).rejects.toThrow(
      "Google sign-in was cancelled."
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await denied;

    const f = mockFetchSeq();
    const ac = new AbortController();
    const stopped = waitForGoogleIdToken(code, ac.signal);
    ac.abort();
    await expect(stopped).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f).not.toHaveBeenCalled();
  });

  it("does not accumulate abort listeners across poll iterations", async () => {
    vi.useFakeTimers();
    const f = mockFetchSeq(
      { status: 428, body: { error: "authorization_pending" } },
      { status: 428, body: { error: "authorization_pending" } },
      { status: 428, body: { error: "authorization_pending" } },
      { body: { id_token: "G" } }
    );
    const ac = new AbortController();
    const code = { deviceCode: "D", userCode: "U", interval: 5, expiresAt: Date.now() + 600_000 };
    const addSpy = vi.spyOn(ac.signal, "addEventListener");
    const removeSpy = vi.spyOn(ac.signal, "removeEventListener");

    const p = waitForGoogleIdToken(code, ac.signal);
    // Poll 1: pending
    await vi.advanceTimersByTimeAsync(5_000);
    // Poll 2: pending
    await vi.advanceTimersByTimeAsync(5_000);
    // Poll 3: pending
    await vi.advanceTimersByTimeAsync(5_000);
    // Poll 4: approved
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(p).resolves.toBe("G");

    // Check: at most 1 abort listener should be registered (adds - removes <= 1)
    expect(addSpy.mock.calls.length - removeSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

const RETURN =
  STEAM_RETURN_URL +
  "?openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&openid.mode=id_res" +
  "&openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F76561198000000001" +
  "&openid.response_nonce=2026-09-22T10%3A00%3A00Zabc&openid.assoc_handle=1234567890" +
  "&openid.signed=signed%2Cop_endpoint&openid.sig=SIG%3D";

describe("Steam", () => {
  it("the login URL returns to the game's /steamsso/ page", () => {
    const u = new URL(steamLoginUrl());
    expect(u.origin + u.pathname).toBe("https://steamcommunity.com/openid/login");
    expect(u.searchParams.get("openid.return_to")).toBe(STEAM_RETURN_URL);
    expect(u.searchParams.get("openid.realm")).toBe(STEAM_RETURN_URL);
    expect(u.searchParams.get("openid.mode")).toBe("checkid_setup");
  });

  it("parses the pasted /steamsso/ address", () => {
    expect(parseSteamReturnUrl(`  ${RETURN}  `)).toEqual({
      claimedId: "76561198000000001",
      nonce: "2026-09-22T10:00:00Zabc",
      assocHandle: "1234567890",
      sig: "SIG=",
      signed: "signed,op_endpoint",
    });
  });

  it("rejects other hosts, missing data and garbage", () => {
    expect(() => parseSteamReturnUrl(RETURN.replace("legendsofidleon", "evil"))).toThrow("should start with");
    expect(() => parseSteamReturnUrl(STEAM_RETURN_URL)).toThrow("missing the Steam sign-in data");
    expect(() => parseSteamReturnUrl("not a url")).toThrow("isn't a web address");
  });

  it("exchangeSteamAssertion posts {data} to asil and returns the custom token", async () => {
    const f = mockFetchSeq({ body: { result: "CUSTOM" } });
    const a = parseSteamReturnUrl(RETURN);
    expect(await exchangeSteamAssertion(a)).toBe("CUSTOM");
    expect(f.mock.calls[0][0]).toBe("https://us-central1-idlemmo.cloudfunctions.net/asil");
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ data: a });
  });

  it("exchangeSteamAssertion surfaces the function's error", async () => {
    mockFetchSeq({ status: 400, body: { error: { message: "bad nonce", status: "INVALID_ARGUMENT" } } });
    await expect(exchangeSteamAssertion(parseSteamReturnUrl(RETURN))).rejects.toThrow(
      "Steam sign-in failed: bad nonce"
    );
  });
});
