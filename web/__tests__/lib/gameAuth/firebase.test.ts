import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  AuthRejectedError,
  decodeFirestoreFields,
  firestoreGet,
  firestoreUpdateTime,
  jwtPayload,
  refreshSession,
  rtdbGet,
  signInWithCustomToken,
  signInWithGoogleIdToken,
} from "@/lib/gameAuth/firebase";

const b64url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const jwt = (payload: object) => `h.${b64url(JSON.stringify(payload))}.sig`;

function mockFetch(status: number, body: unknown) {
  const f = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status })
  );
  vi.stubGlobal("fetch", f);
  return f;
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "test-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("decodeFirestoreFields", () => {
  it("decodes every value type the save uses", () => {
    expect(
      decodeFirestoreFields({
        s: { stringValue: "[1,2]" },
        i: { integerValue: "42" },
        d: { doubleValue: 1.5 },
        b: { booleanValue: true },
        n: { nullValue: null },
        a: { arrayValue: { values: [{ integerValue: "1" }, { stringValue: "x" }] } },
        m: { mapValue: { fields: { k: { doubleValue: 2 } } } },
        t: { timestampValue: "2026-09-22T10:00:00Z" },
      })
    ).toEqual({
      s: "[1,2]",
      i: 42,
      d: 1.5,
      b: true,
      n: null,
      a: [1, "x"],
      m: { k: 2 },
      t: "2026-09-22T10:00:00Z",
    });
  });

  it("empty array/map come back empty; non-finite doubles become null", () => {
    expect(
      decodeFirestoreFields({
        a: { arrayValue: {} },
        m: { mapValue: {} },
        nan: { doubleValue: "NaN" },
        inf: { doubleValue: "Infinity" },
      })
    ).toEqual({ a: [], m: {}, nan: null, inf: null });
  });
});

describe("jwtPayload", () => {
  it("reads base64url claims, including non-ASCII", () => {
    expect(jwtPayload(jwt({ sub: "u1", name: "João" }))).toEqual({ sub: "u1", name: "João" });
  });
});

describe("auth", () => {
  it("signInWithGoogleIdToken posts the id_token and takes the uid from the JWT", async () => {
    const f = mockFetch(200, { idToken: jwt({ sub: "u1" }), refreshToken: "r1", expiresIn: "3600" });
    const a = await signInWithGoogleIdToken("g-tok");
    expect(a).toMatchObject({ uid: "u1", refreshToken: "r1" });
    expect(a.expiresAt).toBeGreaterThan(Date.now() + 3_500_000);
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=test-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      postBody: "id_token=g-tok&providerId=google.com",
      requestUri: "http://localhost",
      returnSecureToken: true,
    });
  });

  it("signInWithCustomToken posts the custom token", async () => {
    const f = mockFetch(200, { idToken: jwt({ sub: "u2" }), refreshToken: "r2", expiresIn: "3600" });
    expect((await signInWithCustomToken("ct")).uid).toBe("u2");
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ token: "ct", returnSecureToken: true });
  });

  it("without the site's key, sign-in says it isn't set up (no request made)", async () => {
    vi.stubEnv("NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY", "");
    const f = mockFetch(200, {});
    await expect(signInWithGoogleIdToken("g")).rejects.toThrow("Sign-in isn't set up on this site yet.");
    expect(f).not.toHaveBeenCalled();
  });

  it("a rejected sign-in throws AuthRejectedError with Google's code", async () => {
    mockFetch(400, { error: { message: "INVALID_IDP_RESPONSE : Unable to parse" } });
    await expect(signInWithGoogleIdToken("bad")).rejects.toMatchObject({
      name: "AuthRejectedError",
      code: "INVALID_IDP_RESPONSE",
    });
  });

  it("refreshSession sends a form and maps the snake_case answer", async () => {
    const f = mockFetch(200, { id_token: jwt({ sub: "u1" }), refresh_token: "r2", expires_in: "3600" });
    expect(await refreshSession("r1")).toMatchObject({ uid: "u1", refreshToken: "r2" });
    expect(f.mock.calls[0][0]).toContain("securetoken.googleapis.com/v1/token?key=test-key");
    expect(String(f.mock.calls[0][1]?.body)).toBe("grant_type=refresh_token&refresh_token=r1");
  });

  it("refreshSession rejection keeps the code", async () => {
    mockFetch(400, { error: { message: "TOKEN_EXPIRED" } });
    const err = await refreshSession("r1").catch((e) => e);
    expect(err).toBeInstanceOf(AuthRejectedError);
    expect(err.code).toBe("TOKEN_EXPIRED");
  });
});

describe("reads (GET only)", () => {
  it("firestoreGet: bearer GET → decoded fields + times; 404 → null", async () => {
    const f = mockFetch(200, {
      fields: { x: { integerValue: "7" } },
      createTime: "2021-01-01T00:00:00Z",
      updateTime: "2026-09-22T10:00:00Z",
    });
    expect(await firestoreGet("_data/u1", "tok")).toEqual({
      fields: { x: 7 },
      createTime: "2021-01-01T00:00:00Z",
      updateTime: "2026-09-22T10:00:00Z",
    });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(
      "https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents/_data/u1"
    );
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.headers).toEqual({ Authorization: "Bearer tok" });

    mockFetch(404, {});
    expect(await firestoreGet("_data/u1", "tok")).toBeNull();
  });

  it("firestoreGet: other errors throw a readable message", async () => {
    mockFetch(403, {});
    await expect(firestoreGet("_data/u1", "tok")).rejects.toThrow("Couldn't read your save (HTTP 403)");
  });

  it("firestoreUpdateTime asks for metadata only", async () => {
    const f = mockFetch(200, { name: "x", createTime: "c", updateTime: "2026-09-22T10:05:00Z" });
    expect(await firestoreUpdateTime("_data/u1", "tok")).toBe("2026-09-22T10:05:00Z");
    expect(f.mock.calls[0][0]).toContain("/_data/u1?mask.fieldPaths=zzNoSuchField");
    expect(f.mock.calls[0][1]?.method ?? "GET").toBe("GET");
  });

  it("rtdbGet: GET with the auth param", async () => {
    const f = mockFetch(200, ["Alpha"]);
    expect(await rtdbGet("_uid/u1", "tok")).toEqual(["Alpha"]);
    expect(f.mock.calls[0][0]).toBe("https://idlemmo.firebaseio.com/_uid/u1.json?auth=tok");
    expect(f.mock.calls[0][1]?.method ?? "GET").toBe("GET");
  });
});

// Real save captured by the Task 1 spike (gitignored) — skipped when absent.
const REST_FIX = "__tests__/fixtures/gameAuth/data-rest.json";
const IT_FIX = "__tests__/fixtures/gameAuth/it-export.json";
const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));
describe.skipIf(!existsSync(REST_FIX) || !existsSync(IT_FIX))("decoder vs IdleonToolbox export (real save)", () => {
  // The game stores MapBon as JSON text; IdleonToolbox's export has it
  // pre-parsed. Every reader of ours accepts the text (parseSaveKey,
  // buildMapOptions, IT's tryToParse), so the decoder stays faithful.
  it("decoded _data equals IdleonToolbox's `data` (MapBon compared parsed)", () => {
    const { MapBon, ...decoded } = decodeFirestoreFields(readJson(REST_FIX).fields);
    const { MapBon: itMapBon, ...itData } = readJson(IT_FIX).data;
    expect(decoded).toEqual(itData);
    expect(typeof MapBon).toBe("string");
    expect(JSON.parse(MapBon as string)).toEqual(itMapBon);
  });
});
