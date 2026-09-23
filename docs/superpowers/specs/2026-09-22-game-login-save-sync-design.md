# Login da conta Idleon (Google/Steam) → save automático — Design Spec

**Data:** 2026-09-22
**Status:** rascunho — aguardando revisão do usuário
**Branch:** `claude/social-auth-game-save-sync-ea785d`

## Problema

Hoje o save entra no site de dois jeitos, ambos com atrito:

- **Colar o JSON** "Copy for Support" do IdleonToolbox (~1,3 MB) — manual, a cada atualização.
- **Carregar por nome** (`/api/profile` → perfil público do IT) — exige perfil público no IT e o
  dado pode estar até ~1 dia atrasado.

O usuário quer logar com a conta do jogo (Google/Steam) e o site puxar o save sozinho, como o
IdleonToolbox faz.

## Objetivos

1. Login com **Google** e **Steam** usando a própria conta do Idleon.
2. Save puxado **direto do servidor do jogo**, no mesmo envelope que as 4 ferramentas já consomem
   (Drop Rate, Tome, Talents, Cooking) — pipeline dos engines intocado.
3. **"Keep me signed in"**: com a opção marcada, toda visita carrega o save atualizado sem re-login.
4. **Somente leitura**, garantido pelo código.
5. **Login nunca passa pelo nosso servidor** (browser ↔ Google/Steam/jogo).

## Não-objetivos

- Apple (v1.1 — `tspa`/`capsc` não têm CORS, exigem proxy) e Email/senha.
- Escrever qualquer coisa no save ou na conta.
- Sync em tempo real (listener) — 1 leitura por visita + botão Sync.
- Auto-preencher o nome na página Leaderboards.
- Pedir permissão à Lavaflame2.

## Decisões (22/09/2026)

| #  | Decisão | Origem |
|----|---------|--------|
| D1 | Google + Steam no v1; sem Apple | usuário |
| D2 | "Keep me signed in" existe — checkbox, **marcado por padrão** | usuário (padrão: proposta) |
| D3 | Sem contato com a Lava | usuário |
| D4 | Validação real só com Google (conta do usuário); Steam só por teste unitário até aparecer tester | usuário |
| D5 | REST puro (`fetch`), sem Firebase SDK — zero dependência nova | proposta |
| D6 | Reimplementar a partir do protocolo; **não copiar código do IT** (GPL-3.0; nosso repo é público sem licença) | proposta |
| D7 | Credenciais do jogo hardcoded num lugar só (como IT/IE). Env var não muda nada material: o valor vai pro browser de qualquer forma e o problema é usar credencial alheia, não onde ela está escrita | proposta |

## Como funciona (protocolo)

Mesmo protocolo do IdleonToolbox e do Idleon Efficiency: login no Firebase do **próprio jogo**
(projeto `idlemmo`). Viabilidade a partir do nosso domínio verificada por probes em 22/09/2026:
API key sem restrição de referrer; CORS liberado em `oauth2.googleapis.com`,
`identitytoolkit`/`securetoken`/`firestore.googleapis.com` e na cloud function `asil`.

### Google — OAuth device flow (client "TV" do jogo)

1. `POST https://oauth2.googleapis.com/device/code` (`client_id`, `scope=email profile`) →
   `device_code`, `user_code`, `interval`, `expires_in`.
2. Usuário abre `https://www.google.com/device` e digita o `user_code` (a tela do Google mostra o
   app do jogo, não o nosso site).
3. Polling `POST https://oauth2.googleapis.com/token`
   (`grant_type=urn:ietf:params:oauth:grant-type:device_code`) a cada `interval` segundos:
   `authorization_pending` → continua; `slow_down` → `interval += 5`;
   `access_denied` / `expired_token` → para com mensagem.
4. Sucesso → Google `id_token` → Firebase `accounts:signInWithIdp`
   (`postBody=id_token=…&providerId=google.com`, `requestUri=http://localhost`,
   `returnSecureToken=true`).

### Steam — OpenID 2.0 → cloud function `asil`

1. Popup `https://steamcommunity.com/openid/login?…` com `openid.return_to` e `openid.realm` =
   `https://www.legendsofidleon.com/steamsso/`. Fixo: a `asil` não recebe o `return_to`, então
   reconstrói a asserção com esse valor — um `return_to` nosso não validaria.
2. Usuário loga na Steam, cai na página do jogo, **copia a URL** e cola no site — **sem clicar no
   botão azul** da página (a asserção é de uso único).
3. Site valida o prefixo, extrai os `openid.*` e o steamId de `openid.claimed_id`.
4. `POST https://us-central1-idlemmo.cloudfunctions.net/asil` com
   `{"data":{"claimedId","nonce","assocHandle","sig","signed"}}` → `{"result": <custom token>}` →
   Firebase `accounts:signInWithCustomToken`.

### Firebase REST (API key pública do jogo)

- Auth: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp|signInWithCustomToken?key=…`
  → `idToken` (1 h) + `refreshToken`.
- Refresh: `POST https://securetoken.googleapis.com/v1/token?key=…` (`grant_type=refresh_token`).
- `uid` = claim `sub` do `idToken` (o custom token não devolve `localId`).
- Leituras, **todas `GET`**:
  - Firestore: `https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents/{path}`
    com `Authorization: Bearer <idToken>`.
  - RTDB: `https://idlemmo.firebaseio.com/{path}.json?auth=<idToken>` (formato documentado do RTDB
    REST; request direto browser → Google).

### Envelope (compatível com o `rawJson` do IT)

| Campo | Fonte |
|-------|-------|
| `data` | Firestore `_data/{uid}`, decodificado |
| `charNames` | RTDB `_uid/{uid}` (vazio → erro "No characters found") |
| `companion` | RTDB `_comp/{uid}` |
| `guildData` | RTDB `_usgu/{uid}/g` → `_guild/{id}`: `{id, stats: JSON.parse(data.Guild), members: Object.values(guild.m), points: guild.p}` |
| `serverVars` | Firestore `_vars/_vars` (público) |
| `tournament` | `{user: RTDB _tournament/{uid}, match: Firestore _T_RES_UID/{uid}, global: Firestore _TOURNAMENT/_TOURNAMENT, leaderboard: []}` |
| `accountCreateTime` | `createTime` do doc `_data` (ms, truncado ao segundo — igual ao IT) |
| `lastUpdated` | `updateTime` do doc `_data` = quando o jogo gravou o save (o IT usa a hora do fetch; aqui é mais fiel) |
| `extraData.totalTomePoints` | **carimbado por nós** via `computeTome` (abaixo) |

`_data` e `charNames` são obrigatórios. Companion, guild e torneio falham para `null` sem derrubar
o login.

**Decoder Firestore REST → objeto JS** (equivalente ao `.data()` do SDK): `stringValue` → string;
`integerValue` → `Number`; `doubleValue` → number (não-finito → `null`, igual ao JSON colado);
`booleanValue`; `nullValue` → `null`; `arrayValue.values` (ausente → `[]`); `mapValue.fields`
(ausente → `{}`); `timestampValue` → string ISO.

**Carimbo do Tome.** O DR lê `extraData.totalTomePoints ?? parsedData.totalTomePoints`
(`web/lib/arkh/save/loader.ts:455-458`), número que só o IT fornece. Sem ele o DR perde os bônus de
Tome. O envelope recebe `extraData: { totalTomePoints: computeTome(cópia).totalPts }`. Passar
**cópia rasa** (`{...env, data: {...env.data}}`), porque `computeTome` copia os campos laterais para
dentro de `data`. Engine intocado.

## Arquitetura

Padrão `lib/{feature}/`. Nenhuma dependência nova (`date-fns`, já instalado, formata o tempo
relativo).

| Unidade | Faz | Interface | Depende de |
|---------|-----|-----------|------------|
| `web/lib/gameAuth/firebase.ts` | REST do Firebase do jogo + constantes do projeto + decoder | `signInWithGoogleIdToken(idToken)`, `signInWithCustomToken(token)`, `refreshSession(refreshToken)`, `firestoreGet(path, idToken)`, `rtdbGet(path, idToken)`, `decodeFirestoreFields(fields)` | `fetch` |
| `web/lib/gameAuth/providers.ts` | Google device flow + Steam OpenID/`asil` + constantes | `requestDeviceCode()`, `pollDeviceToken(deviceCode)` → `{status, idToken?}`, `steamLoginUrl()`, `parseSteamReturnUrl(url)`, `exchangeSteamAssertion(params)` | `fetch` |
| `web/lib/gameAuth/envelope.ts` | Monta o envelope a partir de `uid` + `idToken` | `fetchSaveEnvelope(uid, idToken)` | `firebase.ts`, `lib/tome/compute` |
| `web/lib/gameAuth/session.ts` | Estado da sessão, persistência opt-in, cache em memória do envelope | `startSession(auth, keep)`, `hasSession()`, `loadAccountSave({force})`, `signOut()` | `firebase.ts`, `envelope.ts`, `localStorage` |
| `web/components/GameLoginDialog.tsx` | Diálogo (`<dialog>` nativo), abas Google/Steam, checkbox "Keep me signed in" | `open`, `initialTab`, `onClose`, `onSignedIn()` | `providers.ts`, `session.ts` |
| `web/components/ProfileNameLoader.tsx` (edit) | Linha "Sign in" / "Signed in" + precedência do auto-load | inalterada (`onSave`) | `session.ts`, dialog |

`session.ts` é um módulo singleton de propósito: o `TopNav` usa `next/link`, então trocar de
ferramenta não recarrega o documento e o envelope em memória é reaproveitado pelas 4 páginas —
1 leitura de ~1,3 MB por visita, não por página.

## Sessão e "Keep me signed in"

- **Em memória:** `{provider, uid, idToken, idTokenExp, refreshToken}` + `{envelope, fetchedAt}`.
- **Persistido** só com a checkbox marcada:
  `localStorage["gameAuth.session.v1"] = {v: 1, provider, uid, refreshToken}`.
  **Nunca** o `idToken` nem o envelope.
- **Carga de página:** sessão em memória → usa o envelope em cache. Senão, sessão persistida →
  `refreshSession` → `fetchSaveEnvelope` → `onSave`. O refresh devolve `refresh_token` → regrava.
- **Sync:** força novo fetch (botão desabilitado durante o fetch). `idToken` a menos de 5 min de
  expirar → refresh antes.
- **Sign out:** limpa memória + `localStorage`. Não há revogação no servidor (o refresh token do
  Firebase só cai com conta desativada/apagada ou troca de credencial) — limitação conhecida,
  igual ao IT.
- **Erro de auth no refresh** (`TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, `USER_DISABLED`,
  `USER_NOT_FOUND`) → sign out + "Session expired — sign in again". Erro de rede → mantém a
  sessão, mostra o erro, permite retry.
- **Multi-aba:** sign out numa aba vale nas outras no próximo carregamento. Aceito.

## UI (texto do site em inglês)

**`ProfileNameLoader`** — nova linha no topo do card (cobre as 4 páginas):

- Deslogado: `🔑 Sign in to load your save automatically` + `[Google]` `[Steam]` → abre o diálogo
  na aba certa.
- Logado: `✅ {charNames[0]} · save updated {tempo relativo de lastUpdated} · [Sync] [Sign out]`.
- **Precedência no mount:** há sessão → carrega da conta (pula o auto-load por nome). Senão →
  comportamento atual (último nome). Carregar por nome continua disponível logado (ex.: ver o save
  de outro jogador).

**`GameLoginDialog`** (`<dialog>` nativo, abas):

- **Google:** passos numerados, código grande, `[Copy code & open Google]`, aviso
  "Google will show *Legends of Idleon* — that's the game's own login.", spinner
  "Waiting for approval…".
- **Steam:** `[Sign in through Steam]` (popup, botão de texto) → "Copy the address of the Idleon
  page that opens — don't click its blue button" → campo da URL + `[Log in]`, validação inline do
  prefixo.
- Checkbox **"Keep me signed in on this device"** (marcado) + "Stores a login token in this
  browser so your save loads on every visit. Sign out removes it."
- Rodapé: "Your login goes straight from your browser to Google/Steam and the game's servers —
  never through ours. We only read your save; we never change it."

## Segurança

**Ameaça.** O token Firebase dá **escrita total no save** e ações na conta (trade, compras), e o
refresh token persistido não expira sozinho. Se vazar, alguém pode zerar o save do usuário. XSS ou
dependência comprometida no nosso domínio leriam o `localStorage`.

**Mitigações (todas no v1):**

1. **Nada passa pelo nosso servidor:** nenhuma rota `/api/*` recebe token; o fluxo inteiro é
   browser ↔ Google/Steam/jogo.
2. **Somente leitura por construção:** `firebase.ts` só expõe leitura de Firestore/RTDB. Um teste
   unitário espia o `fetch` e falha se algum request para `firestore.googleapis.com` ou
   `*.firebaseio.com` não for `GET`.
3. **Sem log de token:** nenhum `console.*` com respostas de auth; erros expõem só a mensagem.
4. **Persistência opcional:** desmarcar a checkbox = nada é guardado.
5. **CSP em `web/next.config.mjs`** (commit separado, validado na preview):

   ```
   default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
   img-src 'self' data:; font-src 'self';
   connect-src 'self' https://oauth2.googleapis.com https://identitytoolkit.googleapis.com
     https://securetoken.googleapis.com https://firestore.googleapis.com
     https://idlemmo.firebaseio.com https://us-central1-idlemmo.cloudfunctions.net;
   frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
   ```

   Ganho: `connect-src`/`img-src` barram exfiltração por fetch, beacon ou imagem para host de
   atacante. Teto: `'unsafe-inline'` em script é exigido pelo Next sem nonce; nonce força render
   dinâmico em todas as páginas (caminho de upgrade, se preciso). A toolbar da Vercel na preview
   (`vercel.live`) fica bloqueada — aceito.
6. **Zero dependência nova** (sem SDK do Firebase).

## Erros (mensagens em inglês)

| Situação | Comportamento |
|----------|---------------|
| Código Google expirou / negado | para o polling; "The code expired — try again" / "Google sign-in was cancelled" |
| URL Steam inválida | validação inline antes de chamar a `asil` |
| `asil` devolve erro | "Steam sign-in failed: {message}" |
| Conta sem personagens | "No characters found for this account" + sign out |
| Firestore/RTDB 403 | "Couldn't read your save" (mantém a sessão) |
| Rede | mensagem + retry; sessão mantida |
| Refresh inválido | sign out + "Session expired — sign in again" |

## Testes e verificação

**Unitários (vitest):**

- `decodeFirestoreFields`: todos os tipos, array/map vazios, `NaN` → `null`.
- `fetchSaveEnvelope` com `fetch` mockado: forma do envelope; guild/torneio ausentes → `null`;
  `charNames` vazio → erro; **todas as leituras são GET**; carimbo do Tome presente; `data`
  original não mutado.
- `pollDeviceToken`: pending / slow_down / access_denied / expired_token / sucesso.
- Steam: `parseSteamReturnUrl` (válida, host errado, sem `claimed_id`) e corpo do request da `asil`.
- `session`: keep=true persiste só `{v, provider, uid, refreshToken}`; keep=false não persiste;
  `signOut` limpa; refresh inválido limpa; `uid` vem do `sub` do JWT.

**Spike de paridade** (1ª tarefa do plano, descartável, com a conta Google do usuário): script
`tsx` local → usuário aprova o código em google.com/device → REST → envelope. Com o jogo
**fechado**, o usuário exporta o "Copy for Support" do IT no mesmo momento. Critérios:

- `data` do REST **igual** (deep-equal) ao `data` do IT;
- engines de DR/Talents/Cooking/Tome rodam no envelope sem erro;
- `computeTome` vs `totalTomePoints` do IT dentro de ~1 task.

A resposta REST crua vira fixture gitignored (`web/__tests__/fixtures/gameAuth/`) para regressão
do decoder, no padrão dos saves reais já usados nos testes.

**Build:** `tsc` nos arquivos tocados + vitest (o `npm run build` local já quebra no prerender na
main — problema pré-existente). Sem `npm run dev`.

**Preview Vercel (usuário):** login Google → 4 páginas carregam; recarregar com "Keep me signed
in" → carrega sozinho; sem a opção → pede login; Sign out → limpa; CSP sem erro no console.
**Steam:** precisa de alguém com conta Steam antes do merge, ou merge com Steam validado só por
teste unitário — decisão do usuário no PR.

Merge na main só quando o usuário pedir.

## Riscos

| #  | Risco | Sev. | Mitigação |
|----|-------|------|-----------|
| R1 | Token persistido vaza (XSS/supply chain) → escrita no save | Crítico | §Segurança 1–6 |
| R2 | Lava muda client/CORS/regras → login quebra sem aviso | Alto | Nome e colar seguem como fallback; protocolo reverificável por probe |
| R3 | Termos do Google (credencial de outro dev); sem permissão explícita da Lava | Alto | Aceito pelo usuário (D3); prática de IT, IE e ha-idleon |
| R4 | Steam sem validação real | Médio | Testes unitários + tester antes do merge |
| R5 | UX do Steam frágil (copia-cola, uso único) | Médio | Instrução explícita, igual ao IT |
| R6 | Tome calculado por nós ~1 task abaixo do IT (tasks só de leaderboard) | Baixo | Medido no spike |
| R7 | Leitura de ~1,3 MB por visita no Firestore da Lava | Baixo | Cache em memória entre páginas, sem listener |

## Futuro (fora do v1)

- Apple: proxy allowlist para `tspa`/`capsc`, ou a Lava cadastrar nosso domínio no Services ID.
- Auto-preencher o nome no Leaderboards via `charNames[0]`.
- CSP com nonce.
