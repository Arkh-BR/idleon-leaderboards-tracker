# Login da conta Idleon (Google/Steam) → save automático — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logar com Google/Steam na própria conta do Idleon e puxar o save direto do Firebase do jogo (REST, só leitura) para as 4 ferramentas, com "Keep me signed in" e atualização automática com Pause/Stop.

**Architecture:** `web/lib/gameAuth/` com 4 módulos: REST do Firebase + decoder; provedores Google/Steam; montagem do envelope compatível com o IT + carimbo do Tome; sessão singleton com cache e modos de auto-update. UI: `GameLoginDialog` novo + `ProfileNameLoader` (ponto único das 4 páginas). O Drop Rate preserva mapa/chip num refresh da mesma conta. CSP só em produção.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 3; vitest 2 + happy-dom + Testing Library; `fetch` nativo; `date-fns` 2 (já instalado).

**Spec:** `docs/superpowers/specs/2026-09-22-game-login-save-sync-design.md` — leia antes. Este plano refina duas interfaces do spec: `startSession(auth, provider, keep)` (o spec omitia `provider`) e o polling do Google, que ganha `waitForGoogleIdToken(code, signal)`.

## Global Constraints

- Texto de UI em **inglês**; comentários de código em inglês (padrão do repo).
- **Nenhuma dependência npm nova.**
- Firestore/RTDB: **só `GET`**. Token nunca vai para rota `/api/*` nossa e nunca aparece em `console.*`.
- **Não copiar código do IdleonToolbox** (GPL-3.0) — o código abaixo foi escrito a partir do protocolo descrito no spec.
- **Nenhuma credencial do jogo no repositório** (decisão do usuário, 22/09): a chave web do Firebase e o client OAuth do Google vêm de `NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY`, `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_ID` e `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET` — cadastradas na Vercel (Production + Preview) e, localmente, em `web/.env.local` (já ignorado por `.env*.local`). Ler sempre com a expressão literal `process.env.NEXT_PUBLIC_…` (o Next só inlina assim). Valor faltando → erro `"Sign-in isn't set up on this site yet."`, e a linha de login do `ProfileNameLoader` não aparece.
- Sessão persistida só com "Keep me signed in" (checkbox **marcado por padrão**): `localStorage["gameAuth.session.v1"] = {v: 1, provider, uid, refreshToken}` — nunca `idToken`, nunca o envelope.
- Auto-update: a cada **5 min** com a aba visível, checagem com `mask.fieldPaths`; Stop = `localStorage["gameAuth.autoUpdate.v1"] = "off"`; Pause só em memória.
- **Nunca rodar `npm run dev`.** O `npm run build` local já quebra no prerender na main (pré-existente) — não perseguir. Verificação = vitest + tsc + preview da Vercel.
- Branch `claude/social-auth-game-save-sync-ea785d`. `git fetch` antes de commitar; stage só dos arquivos tocados (nada de `git add -A`); push ao fim de cada tarefa; **nunca** mergear na main.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comandos rodam de `web/`, salvo indicação.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `web/.gitignore` | Modificar | Ignorar `__tests__/fixtures/gameAuth/` (save privado do usuário) |
| `web/.env.local` | Criar (local, **nunca** commitado) | As 3 variáveis `NEXT_PUBLIC_IDLEON_*` para o spike e testes manuais |
| `web/lib/gameAuth/firebase.ts` | Criar | REST do Firebase do jogo (auth + leituras GET) e decoder Firestore |
| `web/lib/gameAuth/providers.ts` | Criar | Google device flow; Steam OpenID + `asil` |
| `web/lib/gameAuth/envelope.ts` | Criar | Envelope compatível com o IT + carimbo do Tome |
| `web/lib/gameAuth/session.ts` | Criar | Sessão singleton, "Keep me signed in", cache, auto-update |
| `web/components/GameLoginDialog.tsx` | Criar | Diálogo de login (abas Google/Steam) |
| `web/components/ProfileNameLoader.tsx` | Modificar | Linha de conta, precedência no mount, timer, `onSave(save, {refresh})` |
| `web/components/dropRate/DrCalculator.tsx` | Modificar | Preservar mapa/chip num refresh da mesma conta |
| `web/next.config.mjs` | Modificar | CSP em produção |
| `web/__tests__/lib/gameAuth/*.test.ts` | Criar | Testes dos 4 módulos |
| `web/__tests__/components/ProfileNameLoader.test.tsx` | Criar | Precedência, modos, timer |
| `web/__tests__/components/DrCalculator.keepView.test.tsx` | Criar | Mapa/chip preservados no refresh |

---

### Task 1: Setup + spike de paridade (sessão principal com o usuário — NÃO delegar a subagente)

Prova, com a conta Google real do usuário, que o caminho REST devolve **exatamente** o `data` que o IdleonToolbox exporta, e grava fixtures privadas para os testes de regressão. Scripts descartáveis ficam em `SPIKE_DIR` = pasta `spike/` dentro do scratchpad da sessão (fora do repo; o caminho absoluto está no system prompt da sessão).

**Files:**
- Modify: `web/.gitignore`
- Create (fora do repo, descartável): `SPIKE_DIR/parity.mjs`, `SPIKE_DIR/compare.mjs`
- Create (gitignored): `web/__tests__/fixtures/gameAuth/{data-rest.json,side-rest.json,it-export.json}`

- [ ] **Step 1: Instalar dependências (a worktree não tem `node_modules`)**

Run: `npm ci`
Expected: termina sem erro.

- [ ] **Step 2: Registrar a baseline**

Run: `npx vitest run` → anote o nº de testes passando.
Run: `npx tsc --noEmit -p . 2>&1 | tail -3` → anote se sai limpo ou com N erros. As próximas tarefas não podem aumentar esse número.

- [ ] **Step 3: Ignorar as fixtures privadas**

Acrescente ao fim de `web/.gitignore`:

```
# Private save captured by the game-login parity spike (never commit)
__tests__/fixtures/gameAuth/
```

Run: `git check-ignore -v __tests__/fixtures/gameAuth/x.json`
Expected: aponta para `web/.gitignore`.

- [ ] **Step 4: Commit**

```bash
git fetch -q origin
git add .gitignore
git commit -m "chore(web): gitignore private game-login fixtures" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

- [ ] **Step 5: Criar `web/.env.local` (local, nunca commitado)**

Três linhas: `NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY=` (o `apiKey` do config web público do Firebase do jogo — o mesmo que o IdleonToolbox usa em `firebase/config.js`), `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_ID=` e `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET=` (o client de device flow do jogo, em `services/auth/google.js` do IdleonToolbox). Os valores **nunca** entram em arquivo versionado.

Run: `git check-ignore -v .env.local`
Expected: aponta para a regra `.env*.local` de `web/.gitignore`.

- [ ] **Step 5b: Escrever `SPIKE_DIR/parity.mjs`**

```js
// THROWAWAY. Signs in with the game's Google device flow, saves the raw REST
// responses into web/__tests__/fixtures/gameAuth/ (gitignored). Never prints
// tokens. Usage (from web/): node --env-file=.env.local parity.mjs <path-to-web>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const FIX = path.join(process.argv[2], "__tests__/fixtures/gameAuth");
mkdirSync(FIX, { recursive: true });
const KEY = process.env.NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY;
const CID = process.env.NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_ID;
const CSECRET = process.env.NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET;
if (!KEY || !CID || !CSECRET) throw new Error("missing NEXT_PUBLIC_IDLEON_* — see web/.env.local");
const FS = "https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents";
const RTDB = "https://idlemmo.firebaseio.com";
const form = (o) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(o),
});

const dc = await (await fetch("https://oauth2.googleapis.com/device/code",
  form({ client_id: CID, scope: "email profile" }))).json();
console.log(`\n>>> Open https://www.google.com/device and enter: ${dc.user_code}\n`);

let gid;
for (let interval = dc.interval || 5; !gid; ) {
  await new Promise((r) => setTimeout(r, interval * 1000));
  const t = await (await fetch("https://oauth2.googleapis.com/token", form({
    client_id: CID, client_secret: CSECRET, device_code: dc.device_code,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  }))).json();
  if (t.id_token) gid = t.id_token;
  else if (t.error === "slow_down") interval += 5;
  else if (t.error !== "authorization_pending") throw new Error(`device flow: ${t.error}`);
}

const fb = await (await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postBody: `id_token=${gid}&providerId=google.com`,
      requestUri: "http://localhost", returnSecureToken: true }),
  })).json();
if (!fb.idToken) throw new Error(`signInWithIdp: ${fb.error?.message}`);
const uid = fb.localId;
const auth = { headers: { Authorization: `Bearer ${fb.idToken}` } };
const fsGet = async (p) => { const r = await fetch(`${FS}/${p}`, auth); return { status: r.status, body: await r.json() }; };
const rtGet = async (p) => { const r = await fetch(`${RTDB}/${p}.json?auth=${fb.idToken}`); return { status: r.status, body: await r.json() }; };

const data = await fsGet(`_data/${uid}`);
writeFileSync(path.join(FIX, "data-rest.json"), JSON.stringify(data.body));
const side = {
  charNames: await rtGet(`_uid/${uid}`),
  companion: await rtGet(`_comp/${uid}`),
  guildId: await rtGet(`_usgu/${uid}/g`),
  tournamentUser: await rtGet(`_tournament/${uid}`),
  tournamentMatch: await fsGet(`_T_RES_UID/${uid}`),
  tournamentGlobal: await fsGet("_TOURNAMENT/_TOURNAMENT"),
  serverVars: await fsGet("_vars/_vars"),
};
if (typeof side.guildId.body === "string") side.guild = await rtGet(`_guild/${side.guildId.body}`);
writeFileSync(path.join(FIX, "side-rest.json"), JSON.stringify(side));

const masked = await fsGet(`_data/${uid}?mask.fieldPaths=zzNoSuchField`);
console.log("_data status:", data.status);
console.log("side statuses:", Object.fromEntries(Object.entries(side).map(([k, v]) => [k, v.status])));
console.log("masked keys:", Object.keys(masked.body), "| same updateTime as full:", masked.body.updateTime === data.body.updateTime);
console.log("saved data-rest.json + side-rest.json");
```

- [ ] **Step 6: Rodar com o usuário**

Antes: peça ao usuário para **fechar o jogo** (o save não pode mudar durante o teste).
Run (em background, de `web/`): `node --env-file=.env.local "SPIKE_DIR/parity.mjs" "$PWD"`
Repasse o código impresso: o usuário abre `https://www.google.com/device`, digita o código e escolhe a conta Google do Idleon.
Expected: `_data status: 200`; `charNames` 200; `masked keys: [ 'name', 'createTime', 'updateTime' ]`; `same updateTime as full: true`.

- [ ] **Step 7: Capturar o export do IT**

O usuário, com o jogo ainda fechado, entra no idleontoolbox.com com a **mesma** conta Google e clica em **"Copy for Support"**. Depois:

Run (PowerShell, de `web/`): `Get-Clipboard -Raw | Set-Content -Encoding utf8 __tests__/fixtures/gameAuth/it-export.json`
Expected: arquivo de ~1 MB+ começando com `{`.

- [ ] **Step 8: Comparar — `SPIKE_DIR/compare.mjs`**

```js
// THROWAWAY. Decodes the REST save and diffs it against IT's export.
// Usage: node compare.mjs <path-to-web>/__tests__/fixtures/gameAuth
import { readFileSync } from "node:fs";

const dec = (v) =>
  "stringValue" in v ? v.stringValue
  : "integerValue" in v ? Number(v.integerValue)
  : "doubleValue" in v ? (Number.isFinite(Number(v.doubleValue)) ? Number(v.doubleValue) : null)
  : "booleanValue" in v ? v.booleanValue
  : "arrayValue" in v ? (v.arrayValue.values ?? []).map(dec)
  : "mapValue" in v ? Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, dec(x)]))
  : "timestampValue" in v ? v.timestampValue
  : null;
// Key-order-insensitive JSON for comparisons.
const stable = (x) => JSON.stringify(x, (_k, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v);

const dir = process.argv[2];
const read = (f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
const rest = read("data-rest.json"), side = read("side-rest.json"), itx = read("it-export.json");
const ours = Object.fromEntries(Object.entries(rest.fields).map(([k, v]) => [k, dec(v)]));
const keys = [...new Set([...Object.keys(ours), ...Object.keys(itx.data)])];
const diff = keys.filter((k) => stable(ours[k]) !== stable(itx.data[k]));
console.log(`keys ours=${Object.keys(ours).length} it=${Object.keys(itx.data).length} mismatched=${diff.length}`);
for (const k of diff.slice(0, 20)) {
  console.log(" ", k, "| ours:", stable(ours[k])?.slice(0, 100), "| IT:", stable(itx.data[k])?.slice(0, 100));
}
console.log("charNames equal:", stable(side.charNames.body) === stable(itx.charNames));
console.log("companion equal:", stable(side.companion.body) === stable(itx.companion));
console.log("IT tome total:", itx.extraData?.totalTomePoints ?? itx.parsedData?.totalTomePoints);
```

Run (de `web/`): `node "SPIKE_DIR/compare.mjs" "$PWD/__tests__/fixtures/gameAuth"`
Expected: `mismatched=0`, `charNames equal: true`, `companion equal: true`.

- [ ] **Step 9: Medir o Tome (risco R6 do spec)**

Run: `npx tsx -e "(async()=>{const {computeTome}=await import('./lib/tome/compute.ts');const fs=await import('node:fs');const x=JSON.parse(fs.readFileSync('__tests__/fixtures/gameAuth/it-export.json','utf8'));const {extraData,parsedData,...env}=x;console.log('ours',computeTome({...env,data:{...env.data}}).totalPts,'IT',extraData?.totalTomePoints??parsedData?.totalTomePoints)})()"`
Expected: os dois números próximos (diferença de ~1 tarefa, as que só existem em leaderboard).

- [ ] **Step 10: Gate**

- `mismatched=0` → segue para a Task 2 sem mudanças.
- `mismatched>0` → registre os campos e o padrão (ex.: `integerValue` que o IT guarda como string) numa seção "Spike findings" no fim deste plano, ajuste as regras do decoder na Task 2 **antes** de implementá-la e avise o usuário.
- Reporte ao usuário: paridade, diferença do Tome e status das leituras laterais.

---

### Task 2: `firebase.ts` — REST do Firebase do jogo + decoder

**Files:**
- Create: `web/lib/gameAuth/firebase.ts`
- Test: `web/__tests__/lib/gameAuth/firebase.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type FirebaseAuth = { uid: string; idToken: string; refreshToken: string; expiresAt: number }`
  - `class AuthRejectedError extends Error { readonly code: string }`
  - `jwtPayload(token: string): Record<string, unknown>`
  - `signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseAuth>`
  - `signInWithCustomToken(token: string): Promise<FirebaseAuth>`
  - `refreshSession(refreshToken: string): Promise<FirebaseAuth>`
  - `decodeFirestoreFields(fields: Record<string, Record<string, any>>): Record<string, unknown>`
  - `type FirestoreDoc = { fields: Record<string, unknown>; createTime: string; updateTime: string }`
  - `firestoreGet(path: string, idToken: string): Promise<FirestoreDoc | null>`
  - `firestoreUpdateTime(path: string, idToken: string): Promise<string | null>`
  - `rtdbGet(path: string, idToken: string): Promise<unknown>`

- [ ] **Step 1: Escrever o teste que falha**

`web/__tests__/lib/gameAuth/firebase.test.ts`:

```ts
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
describe.skipIf(!existsSync(REST_FIX) || !existsSync(IT_FIX))("decoder vs IdleonToolbox export (real save)", () => {
  it("decoded _data equals the `data` IdleonToolbox exported", () => {
    const rest = JSON.parse(readFileSync(REST_FIX, "utf8"));
    const itExport = JSON.parse(readFileSync(IT_FIX, "utf8"));
    expect(decodeFirestoreFields(rest.fields)).toEqual(itExport.data);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run __tests__/lib/gameAuth/firebase.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/gameAuth/firebase"`.

- [ ] **Step 3: Implementar `web/lib/gameAuth/firebase.ts`**

```ts
// Read-only REST client for the game's own Firebase project (`idlemmo`), the
// backend the game, IdleonToolbox and Idleon Efficiency all sign into. Written
// from the protocol (IdleonToolbox is GPL-3.0; nothing copied). Auth calls
// return tokens; data calls are GET-only by construction.

const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";
const SECURE_TOKEN = "https://securetoken.googleapis.com/v1/token";
const FIRESTORE =
  "https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents";
const RTDB = "https://idlemmo.firebaseio.com";

// The game's Firebase web API key comes from the environment (Vercel + local
// .env.local) so no third-party credential lives in this public repo. It still
// ships to the browser — Firebase web keys identify the project, they aren't
// secrets. Keep the literal `process.env.NEXT_PUBLIC_…`: it's what Next inlines.
function apiKey(): string {
  const key = process.env.NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY;
  if (!key) throw new Error("Sign-in isn't set up on this site yet.");
  return key;
}

export type FirebaseAuth = {
  uid: string;
  idToken: string;
  refreshToken: string;
  /** Epoch ms when `idToken` expires. */
  expiresAt: number;
};

/** A Firebase auth endpoint said no (as opposed to a network failure).
 *  `code` is Google's code, e.g. TOKEN_EXPIRED or INVALID_REFRESH_TOKEN. */
export class AuthRejectedError extends Error {
  constructor(readonly code: string) {
    super(`Sign-in was rejected (${code})`);
    this.name = "AuthRejectedError";
  }
}

/** Claims of a JWT (base64url JSON). Only reads them — Google verifies the
 *  token, we never do. */
export function jwtPayload(token: string): Record<string, unknown> {
  const b64 = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

function toAuth(idToken: string, refreshToken: string, expiresInSec: unknown): FirebaseAuth {
  const uid = String(jwtPayload(idToken).sub ?? "");
  if (!uid) throw new AuthRejectedError("NO_UID");
  return { uid, idToken, refreshToken, expiresAt: Date.now() + Number(expiresInSec) * 1000 };
}

async function authPost(url: string, headers: HeadersInit, body: BodyInit): Promise<any> {
  const r = await fetch(url, { method: "POST", headers, body });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    // "INVALID_IDP_RESPONSE : details" → "INVALID_IDP_RESPONSE"
    throw new AuthRejectedError(String(json?.error?.message ?? `HTTP_${r.status}`).split(" ")[0]);
  }
  return json;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Google ID token (from the device flow) → Firebase session. */
export async function signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseAuth> {
  const b = await authPost(
    `${IDENTITY}:signInWithIdp?key=${apiKey()}`,
    JSON_HEADERS,
    JSON.stringify({
      postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
      requestUri: "http://localhost",
      returnSecureToken: true,
    })
  );
  return toAuth(b.idToken, b.refreshToken, b.expiresIn);
}

/** Custom token (from the game's Steam function) → Firebase session. */
export async function signInWithCustomToken(token: string): Promise<FirebaseAuth> {
  const b = await authPost(
    `${IDENTITY}:signInWithCustomToken?key=${apiKey()}`,
    JSON_HEADERS,
    JSON.stringify({ token, returnSecureToken: true })
  );
  return toAuth(b.idToken, b.refreshToken, b.expiresIn);
}

/** Refresh token → fresh ID token (plus the possibly rotated refresh token). */
export async function refreshSession(refreshToken: string): Promise<FirebaseAuth> {
  const b = await authPost(
    `${SECURE_TOKEN}?key=${apiKey()}`,
    { "Content-Type": "application/x-www-form-urlencoded" },
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
  );
  return toAuth(b.id_token, b.refresh_token, b.expires_in);
}

type FsValue = Record<string, any>;

function decodeValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) {
    const n = Number(v.doubleValue);
    return Number.isFinite(n) ? n : null; // NaN/Infinity → null, like a pasted JSON
  }
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFirestoreFields(v.mapValue.fields ?? {});
  if ("timestampValue" in v) return v.timestampValue;
  return null; // nullValue, plus types the save never uses (bytes, reference, geo)
}

/** Firestore REST typed fields → the plain object the SDK's `.data()` gives. */
export function decodeFirestoreFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

export type FirestoreDoc = {
  fields: Record<string, unknown>;
  createTime: string;
  updateTime: string;
};

const bearer = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

/** GET a Firestore document; null when it doesn't exist. */
export async function firestoreGet(path: string, idToken: string): Promise<FirestoreDoc | null> {
  const r = await fetch(`${FIRESTORE}/${path}`, bearer(idToken));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Couldn't read your save (HTTP ${r.status})`);
  const doc = await r.json();
  return {
    fields: decodeFirestoreFields(doc.fields ?? {}),
    createTime: doc.createTime,
    updateTime: doc.updateTime,
  };
}

/** Just the document's updateTime (~200 B instead of the whole save): a field
 *  mask naming a field that doesn't exist returns the metadata only. */
export async function firestoreUpdateTime(path: string, idToken: string): Promise<string | null> {
  const r = await fetch(`${FIRESTORE}/${path}?mask.fieldPaths=zzNoSuchField`, bearer(idToken));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Couldn't check your save (HTTP ${r.status})`);
  return (await r.json()).updateTime ?? null;
}

/** GET a Realtime Database path (JSON null when absent). */
export async function rtdbGet(path: string, idToken: string): Promise<unknown> {
  const r = await fetch(`${RTDB}/${path}.json?auth=${encodeURIComponent(idToken)}`);
  if (!r.ok) throw new Error(`Couldn't read your save (HTTP ${r.status})`);
  return r.json();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run __tests__/lib/gameAuth/firebase.test.ts`
Expected: PASS em tudo, **incluindo** o bloco "real save" (as fixtures da Task 1 existem nesta máquina). Se o bloco real falhar, a diferença mostra qual regra do decoder ajustar.

- [ ] **Step 5: Tipos**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "gameAuth" ; echo done`
Expected: nenhuma linha antes de `done`.

- [ ] **Step 6: Commit**

```bash
git fetch -q origin
git add lib/gameAuth/firebase.ts __tests__/lib/gameAuth/firebase.test.ts
git commit -m "feat(game-auth): read-only REST client for the game's Firebase" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

---

### Task 3: `providers.ts` — Google device flow + Steam

**Files:**
- Create: `web/lib/gameAuth/providers.ts`
- Test: `web/__tests__/lib/gameAuth/providers.test.ts`

**Interfaces:**
- Consumes: nada (só `fetch`).
- Produces:
  - `GOOGLE_DEVICE_URL: string`, `STEAM_RETURN_URL: string`
  - `type DeviceCode = { deviceCode: string; userCode: string; interval: number; expiresAt: number }`
  - `requestDeviceCode(): Promise<DeviceCode>`
  - `type DevicePoll = { status: "pending" | "slow_down" | "denied" | "expired" } | { status: "ok"; idToken: string }`
  - `pollDeviceToken(deviceCode: string): Promise<DevicePoll>`
  - `waitForGoogleIdToken(code: DeviceCode, signal: AbortSignal): Promise<string>` — rejeita com `"Google sign-in was cancelled."` / `"The code expired — try again."`
  - `steamLoginUrl(): string`
  - `type SteamAssertion = { claimedId: string; nonce: string; assocHandle: string; sig: string; signed: string }`
  - `parseSteamReturnUrl(raw: string): SteamAssertion`
  - `exchangeSteamAssertion(a: SteamAssertion): Promise<string>` (custom token)

- [ ] **Step 1: Escrever o teste que falha**

`web/__tests__/lib/gameAuth/providers.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run __tests__/lib/gameAuth/providers.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/gameAuth/providers"`.

- [ ] **Step 3: Implementar `web/lib/gameAuth/providers.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run __tests__/lib/gameAuth/providers.test.ts`
Expected: PASS.

- [ ] **Step 5: Tipos**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "gameAuth" ; echo done`
Expected: nenhuma linha antes de `done`.

- [ ] **Step 6: Commit**

```bash
git fetch -q origin
git add lib/gameAuth/providers.ts __tests__/lib/gameAuth/providers.test.ts
git commit -m "feat(game-auth): Google device flow and Steam OpenID providers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

---

### Task 4: `envelope.ts` — envelope compatível com o IT + carimbo do Tome

**Files:**
- Create: `web/lib/gameAuth/envelope.ts`
- Test: `web/__tests__/lib/gameAuth/envelope.test.ts`

**Interfaces:**
- Consumes (Task 2): `firestoreGet(path, idToken): Promise<FirestoreDoc | null>`, `rtdbGet(path, idToken): Promise<unknown>`; `computeTome(input)` de `@/lib/tome/compute` (existente; retorna `{ totalPts: number, … }`).
- Produces:
  - `type SaveEnvelope = { data: Record<string, unknown>; charNames: string[]; companion: unknown; guildData: { id: string | null; stats: unknown; members: unknown[]; points: unknown }; serverVars: Record<string, unknown> | null; tournament: { user: unknown; match: unknown; global: unknown; leaderboard: unknown[] }; accountCreateTime: number; lastUpdated: number; extraData: { totalTomePoints: number } }`
  - `class NoCharactersError extends Error` (mensagem `"No characters found for this account"`)
  - `fetchSaveEnvelope(uid: string, idToken: string): Promise<SaveEnvelope>`

- [ ] **Step 1: Escrever o teste que falha**

`web/__tests__/lib/gameAuth/envelope.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSaveEnvelope, NoCharactersError } from "@/lib/gameAuth/envelope";

const doc = (fields: Record<string, unknown>) => ({
  name: "doc",
  fields,
  createTime: "2021-01-02T03:04:05.678Z",
  updateTime: "2026-09-22T10:00:00.123456Z",
});
const int = (n: number) => ({ integerValue: String(n) });

// Routes by URL substring. Unrouted Firestore docs → 404; unrouted RTDB → null.
function mockGame(routes: Record<string, unknown>) {
  const f = vi.fn(async (url: string, _init?: RequestInit) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (key) return new Response(JSON.stringify(routes[key]), { status: 200 });
    return url.includes("firestore.googleapis.com")
      ? new Response("{}", { status: 404 })
      : new Response("null", { status: 200 });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

// >100 keys so computeTome unwraps the envelope — and would write side
// fields into `data` if it weren't handed a copy.
const bigSave = {
  Guild: { stringValue: "[1,2]" },
  Lv0_0: int(5),
  ...Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`K${i}`, int(i)])),
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchSaveEnvelope", () => {
  it("assembles the IdleonToolbox-compatible envelope", async () => {
    mockGame({
      "documents/_data/u1": doc(bigSave),
      "/_uid/u1.json": ["Alpha", "Beta"],
      "/_comp/u1.json": { l: [1] },
      "/_usgu/u1/g.json": "G1",
      "/_guild/G1.json": { m: { a: { n: "Alpha" } }, p: 42 },
      "/_tournament/u1.json": { w: 1 },
      "documents/_T_RES_UID/u1": doc({ r: int(3) }),
      "documents/_TOURNAMENT/_TOURNAMENT": doc({ T: int(7) }),
      "documents/_vars/_vars": doc({ X: int(1) }),
    });
    const env = await fetchSaveEnvelope("u1", "tok");
    expect(env.charNames).toEqual(["Alpha", "Beta"]);
    expect(env.data.Lv0_0).toBe(5);
    expect(env.data).not.toHaveProperty("companion"); // computeTome got a copy
    expect(env.companion).toEqual({ l: [1] });
    expect(env.guildData).toEqual({ id: "G1", stats: [1, 2], members: [{ n: "Alpha" }], points: 42 });
    expect(env.serverVars).toEqual({ X: 1 });
    expect(env.tournament).toEqual({ user: { w: 1 }, match: { r: 3 }, global: { T: 7 }, leaderboard: [] });
    expect(env.accountCreateTime).toBe(Date.parse("2021-01-02T03:04:05Z"));
    expect(env.lastUpdated).toBe(Date.parse("2026-09-22T10:00:00.123Z"));
    expect(typeof env.extraData.totalTomePoints).toBe("number");
  });

  it("reads everything with GET and the user's token", async () => {
    const f = mockGame({
      "documents/_data/u1": doc(bigSave),
      "/_uid/u1.json": ["Alpha"],
      "/_usgu/u1/g.json": "G1",
    });
    await fetchSaveEnvelope("u1", "tok");
    expect(f.mock.calls.length).toBe(9); // 8 in parallel + the guild
    for (const [url, init] of f.mock.calls) {
      expect(init?.method ?? "GET").toBe("GET");
      if (url.includes("firestore.googleapis.com")) {
        expect(init?.headers).toEqual({ Authorization: "Bearer tok" });
      } else {
        expect(url).toContain("?auth=tok");
      }
    }
  });

  it("missing side data → nulls, not a failure", async () => {
    mockGame({ "documents/_data/u1": doc({ Lv0_0: int(1) }), "/_uid/u1.json": ["Alpha"] });
    const env = await fetchSaveEnvelope("u1", "tok");
    expect(env.companion).toBeNull();
    expect(env.guildData).toEqual({ id: null, stats: null, members: [], points: null });
    expect(env.serverVars).toBeNull();
    expect(env.tournament).toEqual({ user: null, match: null, global: null, leaderboard: [] });
  });

  it("no characters → NoCharactersError; no save → error", async () => {
    mockGame({ "documents/_data/u1": doc({}) });
    await expect(fetchSaveEnvelope("u1", "tok")).rejects.toBeInstanceOf(NoCharactersError);
    mockGame({ "/_uid/u1.json": ["Alpha"] });
    await expect(fetchSaveEnvelope("u1", "tok")).rejects.toThrow("No save found for this account");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run __tests__/lib/gameAuth/envelope.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/gameAuth/envelope"`.

- [ ] **Step 3: Implementar `web/lib/gameAuth/envelope.ts`**

```ts
// The game account's save, assembled into the envelope IdleonToolbox's
// "Copy for Support" produces — so every tool page consumes it unchanged.
import { firestoreGet, rtdbGet } from "./firebase";
import { computeTome } from "@/lib/tome/compute";

export type SaveEnvelope = {
  data: Record<string, unknown>;
  charNames: string[];
  companion: unknown;
  guildData: { id: string | null; stats: unknown; members: unknown[]; points: unknown };
  serverVars: Record<string, unknown> | null;
  tournament: { user: unknown; match: unknown; global: unknown; leaderboard: unknown[] };
  /** Epoch ms in whole seconds, like IdleonToolbox. */
  accountCreateTime: number;
  /** Epoch ms the game last wrote the save. */
  lastUpdated: number;
  /** Our own Tome score, stamped where the DR loader already looks for IT's. */
  extraData: { totalTomePoints: number };
};

export class NoCharactersError extends Error {
  constructor() {
    super("No characters found for this account");
    this.name = "NoCharactersError";
  }
}

/** Side data is best-effort: a missing guild/tournament must not block the save. */
const optional = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

function parseJson(v: unknown): unknown {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export async function fetchSaveEnvelope(uid: string, idToken: string): Promise<SaveEnvelope> {
  const [save, charNames, companion, guildId, tUser, tMatch, tGlobal, vars] = await Promise.all([
    firestoreGet(`_data/${uid}`, idToken),
    rtdbGet(`_uid/${uid}`, idToken),
    optional(rtdbGet(`_comp/${uid}`, idToken)),
    optional(rtdbGet(`_usgu/${uid}/g`, idToken)),
    optional(rtdbGet(`_tournament/${uid}`, idToken)),
    optional(firestoreGet(`_T_RES_UID/${uid}`, idToken)),
    optional(firestoreGet("_TOURNAMENT/_TOURNAMENT", idToken)),
    optional(firestoreGet("_vars/_vars", idToken)),
  ]);
  if (!save) throw new Error("No save found for this account");
  if (!Array.isArray(charNames) || charNames.length === 0) throw new NoCharactersError();

  const gid = typeof guildId === "string" && guildId ? guildId : null;
  const guild = (gid ? await optional(rtdbGet(`_guild/${gid}`, idToken)) : null) as {
    m?: Record<string, unknown>;
    p?: unknown;
  } | null;

  const envelope = {
    data: save.fields,
    charNames: charNames as string[],
    companion: companion ?? null,
    guildData: {
      id: gid,
      stats: parseJson(save.fields.Guild),
      members: Object.values(guild?.m ?? {}),
      points: guild?.p ?? null,
    },
    serverVars: vars?.fields ?? null,
    tournament: {
      user: tUser ?? null,
      match: tMatch?.fields ?? null,
      global: tGlobal?.fields ?? null,
      leaderboard: [],
    },
    accountCreateTime: Math.floor(Date.parse(save.createTime) / 1000) * 1000,
    lastUpdated: Date.parse(save.updateTime),
  };
  return { ...envelope, extraData: { totalTomePoints: tomePoints(envelope) } };
}

// computeTome copies side fields (companion, guildData, …) INTO the inner
// save, so it gets a shallow copy — the envelope's `data` stays the pristine
// save. The DR loader reads `extraData.totalTomePoints`; without it every
// Tome-driven DR bonus would be missing (IdleonToolbox normally stamps it).
function tomePoints(env: Omit<SaveEnvelope, "extraData">): number {
  try {
    return computeTome({ ...env, data: { ...env.data } } as Parameters<typeof computeTome>[0])
      .totalPts;
  } catch {
    return 0; // same fallback the DR loader uses for a save without tome points
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run __tests__/lib/gameAuth/envelope.test.ts`
Expected: PASS.

- [ ] **Step 5: Tipos**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "gameAuth" ; echo done`
Expected: nenhuma linha antes de `done`.

- [ ] **Step 6: Commit**

```bash
git fetch -q origin
git add lib/gameAuth/envelope.ts __tests__/lib/gameAuth/envelope.test.ts
git commit -m "feat(game-auth): assemble the IT-compatible save envelope" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

---

### Task 5: `session.ts` — sessão, "Keep me signed in", cache, auto-update

**Files:**
- Create: `web/lib/gameAuth/session.ts`
- Test: `web/__tests__/lib/gameAuth/session.test.ts`

**Interfaces:**
- Consumes (Tasks 2 e 4): `refreshSession`, `firestoreUpdateTime`, `AuthRejectedError`, `type FirebaseAuth`; `fetchSaveEnvelope`, `NoCharactersError`, `type SaveEnvelope`.
- Produces:
  - `type Provider = "google" | "steam"`; `type AutoUpdateMode = "on" | "paused" | "off"`
  - `class SessionExpiredError extends Error` (mensagem `"Session expired — sign in again"`)
  - `startSession(auth: FirebaseAuth, provider: Provider, keep: boolean): void`
  - `signOut(): void`
  - `hasSession(): boolean`
  - `cachedEnvelope(): SaveEnvelope | null`
  - `loadAccountSave(opts?: { force?: boolean }): Promise<SaveEnvelope>`
  - `checkForUpdate(): Promise<SaveEnvelope | null>`
  - `autoUpdateMode(): AutoUpdateMode`
  - `setAutoUpdateMode(mode: AutoUpdateMode): void`

- [ ] **Step 1: Escrever o teste que falha**

`web/__tests__/lib/gameAuth/session.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run __tests__/lib/gameAuth/session.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/gameAuth/session"`.

- [ ] **Step 3: Implementar `web/lib/gameAuth/session.ts`**

```ts
// The signed-in game account, shared by every tool page. A module singleton on
// purpose: TopNav uses next/link, so switching tools keeps this module alive
// and the pages share one save download (and one refresh) per visit.
import {
  AuthRejectedError,
  firestoreUpdateTime,
  refreshSession,
  type FirebaseAuth,
} from "./firebase";
import { fetchSaveEnvelope, NoCharactersError, type SaveEnvelope } from "./envelope";

export type Provider = "google" | "steam";
export type AutoUpdateMode = "on" | "paused" | "off";

const SESSION_KEY = "gameAuth.session.v1";
const AUTO_KEY = "gameAuth.autoUpdate.v1";
/** Refresh the ID token when less than this is left on it. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

type Session = FirebaseAuth & { provider: Provider; keep: boolean };
type Stored = { v: 1; provider: Provider; uid: string; refreshToken: string };

let session: Session | null = null;
let envelope: SaveEnvelope | null = null;
let paused = false;

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired — sign in again");
    this.name = "SessionExpiredError";
  }
}

function readStored(): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return s?.v === 1 && typeof s.uid === "string" && typeof s.refreshToken === "string" ? s : null;
  } catch {
    return null;
  }
}

// Only with "Keep me signed in" — never the ID token, never the save.
function persist(s: Session) {
  if (!s.keep) return;
  const stored: Stored = { v: 1, provider: s.provider, uid: s.uid, refreshToken: s.refreshToken };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  } catch {
    // storage blocked: the session just lasts this visit
  }
}

export function startSession(auth: FirebaseAuth, provider: Provider, keep: boolean) {
  signOut();
  session = { ...auth, provider, keep };
  persist(session);
}

export function signOut() {
  session = null;
  envelope = null;
  paused = false;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function hasSession(): boolean {
  return session !== null || readStored() !== null;
}

export function cachedEnvelope(): SaveEnvelope | null {
  return envelope;
}

/** The session with an ID token good for 5+ more minutes. A rejected refresh
 *  signs out (SessionExpiredError); network errors propagate, session kept. */
async function liveSession(): Promise<Session> {
  if (!session) {
    const stored = readStored();
    if (!stored) throw new SessionExpiredError();
    const { provider, uid, refreshToken } = stored;
    session = { provider, uid, refreshToken, idToken: "", expiresAt: 0, keep: true };
  }
  if (session.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    try {
      session = { ...session, ...(await refreshSession(session.refreshToken)) };
    } catch (e) {
      if (e instanceof AuthRejectedError) {
        signOut();
        throw new SessionExpiredError();
      }
      throw e;
    }
    persist(session);
  }
  return session;
}

/** The account save, cached for the visit unless `force`. */
export async function loadAccountSave({ force = false } = {}): Promise<SaveEnvelope> {
  if (envelope && !force) return envelope;
  const s = await liveSession();
  let fresh: SaveEnvelope;
  try {
    fresh = await fetchSaveEnvelope(s.uid, s.idToken);
  } catch (e) {
    if (e instanceof NoCharactersError) signOut();
    throw e;
  }
  // Signed out (or switched account) while downloading: drop the result.
  if (session?.uid !== s.uid) throw new SessionExpiredError();
  envelope = fresh;
  return fresh;
}

/** Cheap poll: a newer save if the game wrote one since ours, else null. */
export async function checkForUpdate(): Promise<SaveEnvelope | null> {
  if (!envelope) return loadAccountSave();
  const s = await liveSession();
  const t = await firestoreUpdateTime(`_data/${s.uid}`, s.idToken);
  if (!t || Date.parse(t) === envelope.lastUpdated) return null;
  return loadAccountSave({ force: true });
}

/** "off" (Stop) is remembered on this device; "paused" lasts this visit. */
export function autoUpdateMode(): AutoUpdateMode {
  try {
    if (localStorage.getItem(AUTO_KEY) === "off") return "off";
  } catch {}
  return paused ? "paused" : "on";
}

export function setAutoUpdateMode(mode: AutoUpdateMode) {
  paused = mode === "paused";
  try {
    if (mode === "off") localStorage.setItem(AUTO_KEY, "off");
    else localStorage.removeItem(AUTO_KEY);
  } catch {}
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run __tests__/lib/gameAuth/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Tipos**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "gameAuth" ; echo done`
Expected: nenhuma linha antes de `done`.

- [ ] **Step 6: Commit**

```bash
git fetch -q origin
git add lib/gameAuth/session.ts __tests__/lib/gameAuth/session.test.ts
git commit -m "feat(game-auth): session with keep-me-signed-in and auto-update modes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

---

### Task 6: UI — `GameLoginDialog` + `ProfileNameLoader`

**Files:**
- Create: `web/components/GameLoginDialog.tsx`
- Modify: `web/components/ProfileNameLoader.tsx` (arquivo inteiro abaixo)
- Test: `web/__tests__/components/ProfileNameLoader.test.tsx`

**Interfaces:**
- Consumes (Tasks 2, 3 e 5): `signInWithGoogleIdToken`, `signInWithCustomToken`, `type FirebaseAuth`; `requestDeviceCode`, `waitForGoogleIdToken`, `GOOGLE_DEVICE_URL`, `steamLoginUrl`, `parseSteamReturnUrl`, `exchangeSteamAssertion`, `type DeviceCode`, `type SteamAssertion`; `startSession`, `signOut`, `hasSession`, `cachedEnvelope`, `loadAccountSave`, `checkForUpdate`, `autoUpdateMode`, `setAutoUpdateMode`, `type Provider`, `type AutoUpdateMode`; `type SaveEnvelope`.
- Produces:
  - `ProfileNameLoader` prop `onSave: (save: unknown, meta?: { refresh?: boolean }) => void` — `refresh: true` = cópia mais nova do save da conta que já está na tela. As 4 páginas continuam compilando sem mudança (ignoram o 2º argumento); o Drop Rate passa a usá-lo na Task 7.
  - `GameLoginDialog({ tab: Provider | null; onClose(): void; onSignedIn(): void })`.

- [ ] **Step 1: Escrever o teste que falha**

`web/__tests__/components/ProfileNameLoader.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run __tests__/components/ProfileNameLoader.test.tsx`
Expected: FAIL — `Unable to find an element with the text: /Sign in to load your save automatically/` (e demais).

- [ ] **Step 3: Criar `web/components/GameLoginDialog.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  GOOGLE_DEVICE_URL,
  exchangeSteamAssertion,
  parseSteamReturnUrl,
  requestDeviceCode,
  steamLoginUrl,
  waitForGoogleIdToken,
  type DeviceCode,
  type SteamAssertion,
} from "@/lib/gameAuth/providers";
import {
  signInWithCustomToken,
  signInWithGoogleIdToken,
  type FirebaseAuth,
} from "@/lib/gameAuth/firebase";
import { startSession, type Provider } from "@/lib/gameAuth/session";

// Sign in to the player's own Idleon account. Runs entirely in the browser,
// straight against Google / Steam / the game's servers — nothing touches ours.
export default function GameLoginDialog({
  tab,
  onClose,
  onSignedIn,
}: {
  /** Tab to open on; null = closed. */
  tab: Provider | null;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Provider>("google");
  const [keep, setKeep] = useState(true);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (tab) {
      setActive(tab);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [tab]);

  function done(auth: FirebaseAuth, provider: Provider) {
    startSession(auth, provider, keep);
    onSignedIn();
  }

  const tabClass = (t: Provider) =>
    `flex-1 px-3 py-1.5 text-sm rounded ${
      active === t ? "bg-gold text-ink font-bold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
    }`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-zinc-700 bg-zinc-900 p-5 text-zinc-200 backdrop:bg-black/60"
    >
      {/* Content only while open: unmounting stops the Google polling. */}
      {tab && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-gold">Sign in with your Idleon account</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-zinc-400 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
          <div role="tablist" className="flex gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={active === "google"}
              className={tabClass("google")}
              onClick={() => setActive("google")}
            >
              Google
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={active === "steam"}
              className={tabClass("steam")}
              onClick={() => setActive("steam")}
            >
              Steam
            </button>
          </div>
          {active === "google" ? (
            <GoogleTab onAuth={(a) => done(a, "google")} />
          ) : (
            <SteamTab onAuth={(a) => done(a, "steam")} />
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
              className="mt-1"
            />
            <span>
              Keep me signed in on this device
              <span className="block text-xs text-zinc-500">
                Stores a login token in this browser so your save loads on every visit. Sign out
                removes it.
              </span>
            </span>
          </label>
          <p className="text-xs text-zinc-500">
            Your login goes straight from your browser to Google/Steam and the game&apos;s servers
            — never through ours. We only read your save; we never change it.
          </p>
        </div>
      )}
    </dialog>
  );
}

function GoogleTab({ onAuth }: { onAuth: (a: FirebaseAuth) => void }) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onAuthRef = useRef(onAuth);
  useEffect(() => {
    onAuthRef.current = onAuth;
  });

  useEffect(() => {
    const ac = new AbortController();
    setCode(null);
    setError(null);
    (async () => {
      try {
        const c = await requestDeviceCode();
        if (ac.signal.aborted) return;
        setCode(c);
        const googleIdToken = await waitForGoogleIdToken(c, ac.signal);
        onAuthRef.current(await signInWithGoogleIdToken(googleIdToken));
      } catch (e) {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ac.abort();
  }, [attempt]);

  function copyAndOpen() {
    if (!code) return;
    navigator.clipboard?.writeText(code.userCode).catch(() => {});
    window.open(GOOGLE_DEVICE_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-zinc-300">
        <li>Click the button below — we copy your code and open google.com/device.</li>
        <li>Enter the code and pick the Google account you play Idleon with.</li>
        <li>Come back here — we detect the approval automatically.</li>
      </ol>
      <div className="self-center rounded border border-zinc-600 px-4 py-2 font-mono text-2xl tracking-widest">
        {code ? code.userCode : "…"}
      </div>
      <button
        type="button"
        onClick={copyAndOpen}
        disabled={!code || !!error}
        className="self-center rounded bg-gold px-4 py-2 font-bold text-ink disabled:opacity-50"
      >
        Copy code &amp; open Google
      </button>
      <p className="text-xs text-zinc-500">
        Google will show <em>Legends of Idleon</em> — that&apos;s the game&apos;s own login.
      </p>
      {code && !error && <p className="text-xs text-zinc-400">Waiting for approval…</p>}
      {error && (
        <p className="text-xs text-red-400">
          ⚠ {error}{" "}
          <button type="button" className="underline" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}

function SteamTab({ onAuth }: { onAuth: (a: FirebaseAuth) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let assertion: SteamAssertion;
    try {
      assertion = parseSteamReturnUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setBusy(true);
    try {
      onAuth(await signInWithCustomToken(await exchangeSteamAssertion(assertion)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={logIn} className="flex flex-col gap-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-zinc-300">
        <li>
          <button
            type="button"
            className="text-gold underline"
            onClick={() => window.open(steamLoginUrl(), "_blank", "popup")}
          >
            Sign in through Steam
          </button>{" "}
          (opens a Steam window).
        </li>
        <li>
          After signing in you land on an Idleon page. Copy its address —{" "}
          <strong>don&apos;t click its blue button</strong>.
        </li>
        <li>Paste the address here:</li>
      </ol>
      <input
        type="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
        }}
        placeholder="https://www.legendsofidleon.com/steamsso/?openid…"
        className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
      />
      <button
        type="submit"
        disabled={busy || !url.trim()}
        className="self-start rounded bg-gold px-4 py-2 font-bold text-ink disabled:opacity-50"
      >
        {busy ? "Logging in…" : "Log in"}
      </button>
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Reescrever `web/components/ProfileNameLoader.tsx` (arquivo inteiro)**

```tsx
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatDistanceToNow } from "date-fns";
import GameLoginDialog from "@/components/GameLoginDialog";
import type { SaveEnvelope } from "@/lib/gameAuth/envelope";
import {
  autoUpdateMode,
  cachedEnvelope,
  checkForUpdate,
  hasSession,
  loadAccountSave,
  setAutoUpdateMode,
  signOut,
  type AutoUpdateMode,
  type Provider,
} from "@/lib/gameAuth/session";

// Loads a save for the Tome / Drop Rate / Talents / Cooking pages, either from
// the player's own game account (sign-in, auto-updating every 5 min) or from a
// public IdleonToolbox profile by name (via the /api/profile proxy). Both give
// the same envelope, so each page feeds `onSave(save)` into its pipeline.
// `meta.refresh` marks a newer copy of the account save already on screen, so
// a page can keep the user's selections instead of resetting them.
//
// On mount: account save already loaded this visit → signed in with
// auto-update not stopped → the last player name (persisted per page).
// The manual-paste fallback is passed as `children` and rendered inside.

const AUTO_UPDATE_MS = 5 * 60 * 1000;
const BTN =
  "px-2 py-1 text-xs rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50";

export default function ProfileNameLoader({
  storageKey,
  onSave,
  onError,
  children,
  rightSlot,
}: {
  storageKey: string;
  /** Called with the raw save envelope ({ data, charNames, … }) on success. */
  onSave: (save: unknown, meta?: { refresh?: boolean }) => void;
  onError?: (msg: string) => void;
  /** Manual-paste fallback, rendered inside the card below the loader. */
  children?: ReactNode;
  /** Optional control rendered to the right of the Load button (e.g. a
   *  page-specific toggle). */
  rightSlot?: ReactNode;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const initialized = useRef(false);

  // Sign-in needs the game's Firebase key (NEXT_PUBLIC_IDLEON_*); without it
  // the site simply doesn't offer it.
  const loginEnabled = !!process.env.NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY;
  const [signedIn, setSignedIn] = useState(false);
  const [account, setAccount] = useState<{ mainChar: string; lastUpdated: number } | null>(null);
  const [mode, setMode] = useState<AutoUpdateMode>("on");
  const [syncing, setSyncing] = useState(false);
  const [dialogTab, setDialogTab] = useState<Provider | null>(null);
  // Whether the page currently shows the account save (vs one loaded by name).
  const showingAccount = useRef(false);
  // Latest callbacks: pages pass inline lambdas, and the auto-update timer
  // must not restart on every render.
  const cb = useRef({ onSave, onError });
  useEffect(() => {
    cb.current = { onSave, onError };
  });

  const fail = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
    cb.current.onError?.(msg);
    if (!hasSession()) {
      setSignedIn(false);
      setAccount(null);
    }
  }, []);

  const applyAccount = useCallback((env: SaveEnvelope) => {
    setAccount({ mainChar: env.charNames[0] ?? "?", lastUpdated: env.lastUpdated });
    const refresh = showingAccount.current;
    showingAccount.current = true;
    cb.current.onSave(env, { refresh });
  }, []);

  const syncAccount = useCallback(
    async (force: boolean) => {
      setSyncing(true);
      setError(null);
      try {
        applyAccount(await loadAccountSave({ force }));
      } catch (e) {
        fail(e);
      } finally {
        setSyncing(false);
      }
    },
    [applyAccount, fail]
  );

  const load = useCallback(
    async (raw: string) => {
      const player = raw.trim();
      if (!player) return;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(
          `/api/profile?player=${encodeURIComponent(player)}`
        );
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            (body && body.error) || `Failed to load (HTTP ${r.status})`
          );
        }
        try {
          localStorage.setItem(storageKey, player);
        } catch {}
        showingAccount.current = false;
        onSave(body);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    },
    [onSave, onError, storageKey]
  );

  // Mount: account save already loaded this visit → signed in with
  // auto-update not stopped → the last player name.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const m = autoUpdateMode();
    setMode(m);
    const session = loginEnabled && hasSession();
    setSignedIn(session);
    const cached = loginEnabled ? cachedEnvelope() : null;
    if (cached) {
      applyAccount(cached);
      return;
    }
    if (session && m !== "off") {
      syncAccount(false);
      return;
    }
    let saved = "";
    try {
      saved = localStorage.getItem(storageKey) || "";
    } catch {}
    if (saved) {
      setName(saved);
      load(saved);
    }
  }, [storageKey, load, applyAccount, syncAccount, loginEnabled]);

  // Auto-update: signed in, not paused/stopped, tab visible → a cheap check
  // every 5 min; a newer save replaces the one on screen.
  useEffect(() => {
    if (!signedIn || mode !== "on") return;
    let last = Date.now();
    const tick = async () => {
      last = Date.now();
      try {
        const env = await checkForUpdate();
        if (env) applyAccount(env);
      } catch (e) {
        if (!hasSession()) fail(e); // session gone; network blips retry next tick
      }
    };
    const id = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, AUTO_UPDATE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= AUTO_UPDATE_MS) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, mode, applyAccount, fail]);

  function changeMode(m: AutoUpdateMode) {
    setAutoUpdateMode(m);
    setMode(m);
    // Resume / Start: check right away instead of waiting a full cycle.
    if (m === "on") checkForUpdate().then((env) => env && applyAccount(env), fail);
  }

  function onSignedIn() {
    setDialogTab(null);
    setSignedIn(true);
    setMode(autoUpdateMode());
    showingAccount.current = false;
    syncAccount(false);
  }

  function onSignOut() {
    signOut();
    setSignedIn(false);
    setAccount(null);
    showingAccount.current = false;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(name);
  }

  return (
    <div className="rounded-lg bg-zinc-900/60 p-4 mb-4 border border-zinc-800">
      {loginEnabled && (signedIn ? (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <span>
            ✅ <span className="font-semibold text-gold">{account?.mainChar ?? "Signed in"}</span>
          </span>
          {account && (
            <span className="text-zinc-400">
              · save updated {formatDistanceToNow(account.lastUpdated, { addSuffix: true })}
            </span>
          )}
          <span className="text-zinc-400">
            · {mode === "on" ? "auto-updating" : mode === "paused" ? "paused" : "auto-update off"}
          </span>
          {mode === "on" && (
            <button type="button" className={BTN} onClick={() => changeMode("paused")}>
              ⏸ Pause
            </button>
          )}
          {mode === "paused" && (
            <button type="button" className={BTN} onClick={() => changeMode("on")}>
              ▶ Resume
            </button>
          )}
          {mode !== "off" && (
            <button type="button" className={BTN} onClick={() => changeMode("off")}>
              ⏹ Stop
            </button>
          )}
          {mode === "off" && (
            <button type="button" className={BTN} onClick={() => changeMode("on")}>
              ▶ Start auto-update
            </button>
          )}
          <button
            type="button"
            className={BTN}
            disabled={syncing}
            onClick={() => syncAccount(true)}
          >
            {syncing ? "Syncing…" : "⟳ Sync now"}
          </button>
          <button type="button" className={BTN} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <span className="font-semibold text-gold">🔑 Sign in to load your save automatically</span>
          <button type="button" className={BTN} onClick={() => setDialogTab("google")}>
            Google
          </button>
          <button type="button" className={BTN} onClick={() => setDialogTab("steam")}>
            Steam
          </button>
        </div>
      ))}
      {loginEnabled && (
        <GameLoginDialog tab={dialogTab} onClose={() => setDialogTab(null)} onSignedIn={onSignedIn} />
      )}

      <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-center">
        <span className="font-semibold text-gold">👤 Load by player name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter player name"
          className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm flex-1 min-w-[160px] font-mono"
        />
        <button
          type="button"
          onClick={() => setWarnOpen((v) => !v)}
          aria-expanded={warnOpen}
          className="flex items-center gap-1 px-2 py-2 text-sm rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          title="Where does this data come from?"
        >
          ⚠️ <span className="text-xs">{warnOpen ? "▾" : "▸"}</span>
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load"}
        </button>
        {rightSlot}
      </form>

      {warnOpen && (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          This is the player&apos;s last upload to IdleonToolbox — it may be
          older than your current in-game save. Sign in or paste manually for
          the latest.
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">⚠ {error}</p>}

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run __tests__/components/ProfileNameLoader.test.tsx`
Expected: PASS (7 testes).

- [ ] **Step 6: Suíte inteira + tipos (as 4 páginas usam o loader)**

Run: `npx vitest run`
Expected: baseline da Task 1 + novos, todos passando.
Run: `npx tsc --noEmit -p . 2>&1 | grep -E "gameAuth|ProfileNameLoader|GameLoginDialog|cooking-mastery|talents-level|dropRate|tome" ; echo done`
Expected: nenhuma linha antes de `done`.

- [ ] **Step 7: Commit**

```bash
git fetch -q origin
git add components/GameLoginDialog.tsx components/ProfileNameLoader.tsx __tests__/components/ProfileNameLoader.test.tsx
git commit -m "feat(game-auth): sign-in dialog and auto-updating account save in the loader" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

---

### Task 7: Drop Rate preserva mapa/chip num refresh da mesma conta

Hoje cada save novo volta o mapa para o mapa atual do personagem (`applyParsedSave` e o efeito de `charIdx/save`) e o chip 16 para AUTO. Com auto-update a cada 5 min isso apagaria a escolha do usuário.

**Files:**
- Modify: `web/components/dropRate/DrCalculator.tsx` (`applyParsedSave` ~113-141, efeito do mapa ~183-190, efeito do chip ~195-234, `<ProfileNameLoader onSave>` ~345-347)
- Test: `web/__tests__/components/DrCalculator.keepView.test.tsx`

**Interfaces:**
- Consumes (Task 6): `ProfileNameLoader` chama `onSave(save, { refresh: true })` numa cópia mais nova do save da conta.
- Produces: nada novo.

- [ ] **Step 1: Escrever o teste que falha**

`web/__tests__/components/DrCalculator.keepView.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

type LoaderProps = { onSave: (s: unknown, meta?: { refresh?: boolean }) => void };
let loader: LoaderProps | null = null;
vi.mock("@/components/ProfileNameLoader", () => ({
  default: (props: LoaderProps) => {
    loader = props;
    return null;
  },
}));
// The DR engine isn't under test: fail fast instead of computing.
vi.mock("@/lib/arkh/computeDR", () => ({
  computeArkhDropRate: () => {
    throw new Error("stub");
  },
}));

import DrCalculator from "@/components/dropRate/DrCalculator";

// Two chars on different maps; buildMapOptions always lists each CurrentMap_N.
const save = () => ({
  charNames: ["Alpha", "Beta"],
  data: {
    PVStatList_0: [1, 1, 1, 1, 100],
    PVStatList_1: [1, 1, 1, 1, 90],
    CurrentMap_0: 2,
    CurrentMap_1: 3,
  },
});
const mapSelect = () => screen.getAllByRole("combobox")[1] as HTMLSelectElement;

describe("DrCalculator — account refresh keeps the view", () => {
  it("keeps map + chip on refresh, re-derives them on a fresh load", () => {
    render(<DrCalculator />);
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2"); // char 0's current map

    fireEvent.change(mapSelect(), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Chip Gallery AUTO/ }));
    expect(mapSelect().value).toBe("3");
    expect(screen.getByRole("button", { name: /Chip Gallery ON/ })).toBeInTheDocument();

    act(() => loader!.onSave(save(), { refresh: true }));
    expect(mapSelect().value).toBe("3");
    expect(screen.getByRole("button", { name: /Chip Gallery ON/ })).toBeInTheDocument();

    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
    expect(screen.getByRole("button", { name: /Chip Gallery AUTO/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run __tests__/components/DrCalculator.keepView.test.tsx`
Expected: FAIL — depois do refresh, `expected '2' to be '3'`.

- [ ] **Step 3: Implementar em `web/components/dropRate/DrCalculator.tsx`**

3a. Logo **antes** de `const applyParsedSave = useCallback(`, adicione:

```tsx
  // A refresh of the same account (auto-update / Sync now) keeps the user's
  // map + chip choices; a fresh load re-derives them from the save.
  const keepViewRef = useRef(false);
  const lastCharIdxRef = useRef(charIdx);
```

3b. Em `applyParsedSave`, troque a assinatura e o bloco do mapa. De:

```tsx
    (parsed: any, opts: { silent?: boolean } = {}) => {
```
para:
```tsx
    (parsed: any, opts: { silent?: boolean; keepView?: boolean } = {}) => {
```

E de:

```tsx
        setSave(parsed);
        setChars(list);
        setCharIdx((prev) =>
          list.some((c) => c.charIndex === prev) ? prev : list[0].charIndex
        );
        const opts2 = buildMapOptions(parsed);
        setMapOptions(opts2);
        // Default to character's current map if available, else Town
        const data = (parsed as any)?.data ?? {};
        const currentMap = Number(data[`CurrentMap_${list[0].charIndex}`]) || 0;
        setMapIdx(opts2.some((m) => m.index === currentMap) ? currentMap : 0);
```
para:
```tsx
        keepViewRef.current = !!opts.keepView;
        setSave(parsed);
        setChars(list);
        setCharIdx((prev) =>
          list.some((c) => c.charIndex === prev) ? prev : list[0].charIndex
        );
        const opts2 = buildMapOptions(parsed);
        setMapOptions(opts2);
        // Default to character's current map if available, else Town — unless
        // this is a refresh and the user's map is still on the list.
        const data = (parsed as any)?.data ?? {};
        const currentMap = Number(data[`CurrentMap_${list[0].charIndex}`]) || 0;
        const fallback = opts2.some((m) => m.index === currentMap) ? currentMap : 0;
        setMapIdx((prev) =>
          opts.keepView && opts2.some((m) => m.index === prev) ? prev : fallback
        );
```

3c. No efeito do mapa (o que começa com `// When the character selection changes, auto-jump`), troque:

```tsx
  useEffect(() => {
    if (!save || chars.length === 0) return;
    const data = (save as any)?.data ?? {};
```
por:
```tsx
  useEffect(() => {
    if (!save || chars.length === 0) return;
    const charChanged = lastCharIdxRef.current !== charIdx;
    lastCharIdxRef.current = charIdx;
    // Same-account refresh with the same character: keep the user's map.
    if (keepViewRef.current && !charChanged) return;
    const data = (save as any)?.data ?? {};
```

3d. No fim do efeito do chip (deps `[save]`), troque:

```tsx
    setChipDetected(found);
    setChipGalleryActive(undefined);
  }, [save]);
```
por:
```tsx
    setChipDetected(found);
    if (!keepViewRef.current) setChipGalleryActive(undefined);
  }, [save]);
```

3e. No `<ProfileNameLoader>`, troque:

```tsx
        onSave={(s) => applyParsedSave(s)}
```
por:
```tsx
        onSave={(s, meta) => applyParsedSave(s, { keepView: meta?.refresh })}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run __tests__/components/DrCalculator.keepView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Suíte inteira + tipos**

Run: `npx vitest run`
Expected: tudo passando.
Run: `npx tsc --noEmit -p . 2>&1 | grep -E "DrCalculator" ; echo done`
Expected: nenhuma linha antes de `done`.

- [ ] **Step 6: Commit**

```bash
git fetch -q origin
git add components/dropRate/DrCalculator.tsx __tests__/components/DrCalculator.keepView.test.tsx
git commit -m "feat(drop-rate): keep map and chip choice across account auto-updates" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

---

### Task 8: CSP em produção

**Files:**
- Modify: `web/next.config.mjs` (arquivo inteiro abaixo)

**Interfaces:** nenhuma. Os hosts do `connect-src` são exatamente os que `firebase.ts` e `providers.ts` chamam com `fetch` (`google.com/device` e `steamcommunity.com` são navegação, fora do `connect-src`). Hoje nenhum código de cliente chama domínio externo — o IT só é chamado pelas rotas `/api/*` no servidor.

- [ ] **Step 1: Reescrever `web/next.config.mjs`**

```js
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Game-account sign-in keeps a refresh token in localStorage, so lock down
// where the page can send data. ponytail: 'unsafe-inline' scripts are needed
// by Next without nonces; nonces force dynamic rendering on every page —
// upgrade path if script-src ever needs tightening. Production only: the dev
// server (and the CI e2e run on it) needs eval for fast refresh.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://oauth2.googleapis.com https://identitytoolkit.googleapis.com" +
    " https://securetoken.googleapis.com https://firestore.googleapis.com" +
    " https://idlemmo.firebaseio.com https://us-central1-idlemmo.cloudfunctions.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: CSP }] },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Conferir que a config carrega e só emite CSP em produção**

Run: `node -e "import('./next.config.mjs').then(async m=>{process.env.NODE_ENV='production';const h=await m.default.headers();console.log(h[0].headers[0].value.includes('firestore.googleapis.com'));process.env.NODE_ENV='development';console.log((await m.default.headers()).length)})"`
Expected: `true` e depois `0`.

- [ ] **Step 3: Commit**

```bash
git fetch -q origin
git add next.config.mjs
git commit -m "feat(security): production CSP limiting where the page can send data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
```

A CSP de verdade só é validada na preview (Task 9). Se quebrar algo lá, reverta **só este commit**.

---

### Task 9: Verificação final, PR e preview (sessão principal)

**Files:** nenhum código.

- [ ] **Step 1: Suíte + tipos contra a baseline da Task 1**

Run: `npx vitest run` → baseline + novos, zero falhas (o bloco "real save" roda nesta máquina).
Run: `npx tsc --noEmit -p . 2>&1 | tail -3` → mesmo resultado da baseline (sem erros novos).

- [ ] **Step 2: Nenhum token em log, nenhum write**

Run: `grep -rnE "console\.|method: \"(PUT|PATCH|DELETE)\"" lib/gameAuth components/GameLoginDialog.tsx ; echo done`
Expected: nenhuma linha antes de `done`.
Run: `git grep -nE "AIza[0-9A-Za-z_-]{35}|CLIENT_(ID|SECRET) = \"" -- ':/' ; echo done`
Expected: nenhuma linha antes de `done` — nenhuma credencial do jogo escrita no repositório.

- [ ] **Step 2b: Variáveis na Vercel (usuário)**

O usuário cadastra `NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY`, `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_ID` e `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET` nas Environment Variables do projeto na Vercel, em **Production e Preview** (os mesmos valores do `web/.env.local`). `NEXT_PUBLIC_*` entra no bundle **na hora do build**: se a preview for gerada antes do cadastro, é preciso fazer um redeploy. Sem as variáveis, o site só não mostra o login.

- [ ] **Step 3: Abrir PR draft (sem merge)**

```bash
git fetch -q origin
git push -q
gh pr create --draft --base main --head claude/social-auth-game-save-sync-ea785d \
  --title "Sign in with your Idleon account (Google/Steam) to load your save automatically" \
  --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-09-22-game-login-save-sync-design.md.

- Google (device flow) and Steam (OpenID → game's `asil`) sign-in into the game's own Firebase, straight from the browser — nothing goes through our server.
- Read-only REST (GET-only, enforced by tests); IT-compatible envelope + our own Tome score stamped for the DR.
- "Keep me signed in" (default on) stores only the refresh token; auto-update every 5 min while the tab is visible (cheap masked check), with Pause / Stop / Sync now / Sign out.
- Drop Rate keeps the user's map/chip across auto-updates.
- Production CSP limiting where the page can send data.
- No game credential in the repo: set `NEXT_PUBLIC_IDLEON_FIREBASE_API_KEY`, `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_IDLEON_GOOGLE_CLIENT_SECRET` in Vercel (Production + Preview). Without them the site just hides sign-in.

Not in this PR: Apple (needs a proxy), email login.

Test plan:
- [ ] vitest green (incl. real-save decoder parity, local only)
- [ ] Preview: Google login → DR / Tome / Talents / Cooking load
- [ ] Preview: reload with "Keep me signed in" → loads by itself; without → asks to sign in
- [ ] Preview: play → save updates within 5 min; Pause freezes; Resume resumes; Stop survives reload
- [ ] Preview: Sign out clears; no CSP errors in the console
- [ ] Steam login by someone with a Steam account

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Pegar a URL da preview**

Run: `gh pr checks --watch=false` (ou `gh pr view --json statusCheckRollup`) → link da Vercel Preview.

- [ ] **Step 5: Validação do usuário na preview (ele loga; o agente nunca digita credencial)**

Mande o link e o checklist do PR. Registre o resultado de cada item. Steam: só com tester — o merge com Steam não validado é decisão do usuário.

- [ ] **Step 6: Parar**

Não mergear. Mergear na main só quando o usuário pedir explicitamente.

---

## Spike findings

(preenchido na Task 1, Step 10, se houver diferenças)
