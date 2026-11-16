# Leaderboards v4 (API nova do IT) — Design

Data: 2026-11-15. Mockups aprovados na conversa de 15/11: página, Dashboard completo, Worst positions e seletor do head-to-head.

## Objetivo

O Idleon Toolbox (IT) trocou o leaderboard em 13–14/11. Agora são 220 boards (temos 177), em abas novas, e há uma API nova bem mais rica. Vamos levar a página `/leaderboards` para essa API, reorganizá-la como o IT e usar os dados novos no Dashboard.

Sucesso:
- os 220 boards aparecem, nas mesmas abas e seções do IT, sem lista mantida à mão;
- a busca de um jogador custa 1 request ao IT (hoje são 8+);
- cada board mostra o rank, o top %, quanto falta para subir 1 rank e quanto falta para o top 100;
- o Dashboard ganha as análises aprovadas, e as atuais continuam;
- o visual segue o do site (escuro, zinc e emerald), sem redesign; todo o texto fica em inglês;
- o volume de requests fica dentro do combinado com o dono do IT, e ele é avisado antes do deploy.

Fora de escopo:
- as páginas de stats (Drop Rate, Coin, EXP, Tome, Talents…) e os coletores do Observed Max;
- o `gatherCandidates` dos coletores, que continua lendo `lib/registry.ts` e a API antiga (veja Follow-ups);
- reativar o deploy: o site está pausado no Vercel (HTTP 402) até o usuário resolver no painel.

## A API nova do IT

Base `https://profiles.idleontoolbox.workers.dev/api`. Todo request leva `Origin: https://arkh-idleon-trackers.vercel.app` exato, sem barra final. O UA é `IdleonTrackersWeb/1.0` nas rotas do site e `IdleonTrackersScraper/1.0` no cron.

| Endpoint | Devolve |
|---|---|
| `/leaderboards/meta` | `{createdAt, totalPlayers, tabs[{key,label,sections[{name,metrics[{key,label,notation,top,topTies,players,maxed,section}]}]}]}`, com 5 abas e 220 métricas. `notation` pode ser `default`, `multiplier`, `seconds` ou `bits`. |
| `/leaderboards/player?name=` | `{createdAt, player{mainChar,rank,compositeScore,profileAccess,mainClass,bestMetrics[]}, ranks{<metric>:{r,v,p,t,nr?,nv?}}}`. Os campos: `r` é o rank, `v` o valor, `p` o top %, `t` quantos jogadores estão empatados naquele valor, e `nr`/`nv` o próximo rank e o valor dele (ausentes quando `r` = 1). Responde 404 quando o jogador não existe. |
| `/leaderboards/board?metric=&limit=100[&around=<nome>][&public=1]` | `{metric, createdAt, top[{mainChar,value,rank,globalRank}], around[...]}`. `around` traz ±5 vizinhos do jogador. |
| `/leaderboards/names?q=` | `{players:[...]}`, para o autocomplete. |
| `globalRanking` | Também é uma métrica de `/board`, usada para o top 10 global e para os rivais (`around`). |

O IT atualiza a cada ~30 min (`createdAt`).

## Arquitetura

### Rotas do site (`web/app/api/lb/*`, runtime nodejs)

Cada rota é um proxy fino com cache em memória e contador diário logado, no mesmo molde de `app/api/profile/route.ts` (PR #88).

| Rota | Upstream | Cache |
|---|---|---|
| `meta` | `/leaderboards/meta` | 30 min |
| `player?name=` | `/leaderboards/player` | 15 min por nome em minúsculas |
| `board?metric=&around=&public=` | `/leaderboards/board?limit=100` | 30 min por chave |
| `names?q=` | `/leaderboards/names` | 10 min; mínimo de 2 caracteres |

- Teto diário de requests ao IT, contado no conjunto das rotas `lb/*` e logado como `[api/lb] … n/CAP`. O número sai do aviso ao dono do IT e começa em 500. Acima do teto a rota devolve 429, com uma mensagem que a UI mostra.
- Respostas não-ok do IT viram 502 com o status de origem. O 404 do `/player` vira 404 "Player not found".
- Ganha um helper compartilhado `lib/leaderboards/itFetch.ts` com os headers, o cache, o contador e o teto. A rota `/api/profile` passa a usá-lo também, com o próprio teto de 200 e o mesmo comportamento de hoje.

### Snapshot diário (cron novo)

`scripts/update-lb-snapshot.ts` + `.github/workflows/refresh-lb-snapshot.yml`, uma vez por dia:
- baixa o `/meta` e, para cada uma das 220 métricas, o `/board?limit=100`, com 500 ms de intervalo: 221 requests por dia;
- grava `web/lib/leaderboards/snapshot.ts` com `{generatedAt, meta (tabs/sections/metrics), boards: {<metric>: {top10, top100, lowerIsBetter, firstSeen}}}`. `top10` e `top100` são os valores do #10 e do #100. `lowerIsBetter` vale `top[0].value < top[last].value`. `firstSeen` é a data da primeira vez que a métrica apareceu (lida do snapshot anterior);
- falha sem gravar se vierem menos de 200 boards, que é o mesmo princípio do piso de 20 jogadores dos coletores;
- roda sob `timeout -s KILL`, em Node 24, e commita só esse arquivo, como o `refresh-top-max`.

O snapshot serve a três coisas:
1. o "to top 100" e o "to top 10" de qualquer jogador sem request extra;
2. a estrutura de abas e seções quando o `/meta` ao vivo falha;
3. a contagem de boards da home (`app/page.tsx`).

### Biblioteca (`web/lib/leaderboards/`, funções puras e testadas)

- `types.ts`: os tipos do meta, do player e do board.
- `metrics.ts`:
  - `gapToNext(rankEntry, lowerIsBetter)` e `gapToCutoff(value, cutoff, lowerIsBetter)` devolvem a diferença com o sinal certo, ou `null` quando já está dentro;
  - `gapPct` dá a diferença relativa, usada nas ordenações.
- `format.ts`: `formatMetric(value, notation)` para `x`, segundos, bits e o padrão do site (reusa `lib/format`).
- `sections.ts`: `sectionStrength(ranks, meta)` dá a mediana do top % por seção.
- `history.ts`, sobre o localStorage por jogador:
  - `sinceLastVisit` guarda a baseline `{createdAt, ranks}` e só a troca quando chega um `createdAt` mais novo, como o IT faz;
  - `appendHistory` acrescenta `{createdAt, globalRank, top10Count, top100Count}`, um ponto por `createdAt` novo, até 365 pontos.
- `headToHead(a, b)` conta vitórias, derrotas e empates e devolve a tabela por board.

### Página `/leaderboards`

Segue o mockup 1.
- **Cabeçalho**:
  - o nome do jogador, com autocomplete via `lb/names`;
  - "Jump to a board (220)", que filtra os rótulos do meta no cliente e rola até a linha;
  - o toggle "Show anonymous", que manda `public=1` nas listas de board. O rank do jogador vem sempre do ranking completo, como no IT;
  - a linha "N players · updated HH:MM".
- **Cartões**: rank global (com seta desde a última visita), ranks líquidos desde a última visita, boards no top 10 e boards no top 100.
- **Abas**: Overview, Dashboard e as 5 do meta (Account, Character, Skills, Combat e Worlds, com a contagem de boards). As seções de cada aba aparecem como subtítulos e como links de atalho.
- **Linha de board**:
  - colunas: Board, Rank (`#50 ▲3`, com o total `/ players` no tooltip), Value, Top %, To climb (`+35 passes #49`, ou "tied #1"), To top 100 (só quando o jogador está fora; senão aparece "in top 100");
  - selos "Maxed" (`metric.maxed`) e "New" (`firstSeen` há 14 dias ou menos).
- **Ordenação**: a ordem do IT (padrão), "closest to next rank" (`gapPct`) e "worst rank" (pelo rank: o `p` do IT conta o grupo de empatados inteiro, então um #1 empatado lê "top 29%"; decisão do usuário em 16/11).
- **Linha expandida**: os ±5 vizinhos (`lb/board?around=`) e um botão "Full top 100" que lista o top 100 inline.
- **Overview**: o top 10 global (`globalRanking`) e um cartão por aba com a contagem de boards.
- **Sem jogador carregado**: Overview e listas funcionam; as colunas do jogador ficam vazias.

### Dashboard

Segue o mockup 2, de cima para baixo.
1. **Os cartões**.
2. **"Progress since <data>"**: o snapshot manual atual (`lib/lbSnapshot.ts`), mantido como está.
3. **"Tier summary"**: mantido. Ao lado entra "Strength by section", e clicar numa seção filtra as listas de baixo.
4. **"Worst positions"**: 40 boards ordenados pelo rank, do maior para o menor (decisão de 16/11, pelo mesmo motivo), com as colunas Board, Section, Rank `#812 / 2,790`, Top % e To top 100, mais um filtro por seção.
5. **"Cheapest climbs"**: subir 1 rank, ordenado por `gapPct`. Ao lado, "Points to reach the top 100", com toggle Top 100 / Top 10, só com os boards em que o jogador está fora, do menor esforço para o maior.
6. **"Maxed boards you're missing"**: `maxed` verdadeiro e o jogador fora do teto. Mostra o valor dele, o teto e quantos já estão lá. Ao lado, "Your best positions": mantido, agora com o top %.
7. **"Global rivals"**: `globalRanking` com `around`. Mostra rank, pontos e a diferença; cada rival abre o head-to-head. A contagem "beats you on N" só aparece depois de comparar, para não gastar 10 requests.
8. **"Head-to-head"**:
   - o seletor aceita o nome digitado (autocomplete) e chips de rivais, do top 10 global e dos "recently compared" (até 8, no localStorage);
   - mostra o placar W/L/T e a tabela por board, filtrável por seção.
9. **"Your history"**: o rank global e os boards no top 10 por visita.

### O que sai

- `components/LeaderboardsTable.tsx` e o `Dashboard.tsx` atual dão lugar aos componentes novos em `components/leaderboards/`.
- A rota `app/api/leaderboards` e o `lib/registry.ts` deixam de ser usados pela página e pela home. O registro e a rota velha ficam só enquanto o `gatherCandidates` depender deles (veja Follow-ups). O teste `registry.test.ts` continua valendo para eles.

## Tratamento de erro

- **IT fora do ar ou 5xx**: a página mostra "Couldn't reach Idleon Toolbox. Retry". Com o snapshot, abas e seções aparecem mesmo assim.
- **Jogador inexistente ou privado (404)**: "Player not found. Check the name or make the profile public on Idleon Toolbox".
- **Teto atingido (429)**: "Too many lookups today. Try again tomorrow".
- **Board novo sem dado no snapshot**: "To top 100" mostra "—", com o tooltip "available after the next daily refresh".

## Volume de requests (para o aviso ao dono do IT)

- **Por visita com jogador**: 1 `/player`, mais o `/meta` (cache compartilhado de 30 min), mais o `globalRanking around` (cache de 30 min).
- **Sob demanda**: 1 `/board` ao expandir uma linha, 1 `/player` por head-to-head e o autocomplete (com debounce de 300 ms e cache).
- **Cron**: 221 por dia.
- **Teto das rotas**: 500 por dia, a confirmar com ele. O teto e o UA já combinados no PR #88 continuam valendo para `/api/profile`.

Antes do deploy, sai um texto em inglês para o dono do IT com esses números, no tom dos anteriores.

## Testes

- **Lib**: testes unitários de `gapToNext`/`gapToCutoff` (inclusive `lowerIsBetter` e o rank 1 sem `nr`), `formatMetric` (as 4 notações), `sectionStrength`, `sinceLastVisit` (não troca a baseline com o mesmo `createdAt`), `appendHistory` (deduplicação e o limite de 365) e `headToHead` (empates).
- **Rotas**: os headers exatos (Origin sem barra e o UA do site), cache hit sem contar no teto, 429 acima do teto, e 404 e 502 propagados. O `fetch` é mockado, como já faz o `setupTests`.
- **Cron**: com o `fetch` mockado, grava o snapshot com `top10`, `top100`, `lowerIsBetter` e `firstSeen` preservado; com menos de 200 boards, falha sem gravar.
- **Componentes**: a linha de board (as colunas e os selos), a ordenação e o seletor do head-to-head (digitar e escolher um chip).
- **Validação real**: uma busca do ARKHE no preview, conferindo 3 boards contra o site do IT (rank, top % e o próximo valor).

## Follow-ups (fora deste trabalho)

- Passar o `gatherCandidates` para o `/meta` e o `/board`, e então apagar `lib/registry.ts`, `app/api/leaderboards` e `scripts/fetch-it-leaderboards.ts`.
- Atualizar a memória `it-leaderboard-sync`: a sincronização manual acaba.
