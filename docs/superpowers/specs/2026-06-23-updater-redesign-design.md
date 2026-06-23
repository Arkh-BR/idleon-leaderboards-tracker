# Updater Redesign — Design Spec

**Data:** 2026-06-23
**Status:** aprovado (brainstorming) — pronto para plano de implementação

## Problema

O updater atual (`web/scripts/updater/`) detecta mudanças de **dados** do jogo (camadas
`lists`, `items`, `strings`) e gera um relatório cru de "X mudou". Ele **não conecta
essas mudanças às fórmulas portadas** que consomem aquele dado, nem detecta mudanças
na **lógica** (funções) do N.js. A ponte "dado/fórmula mudou → qual arquivo portado
revisar" era manual (na cabeça do operador) e falhou repetidamente:

- **friend bonus** (Summer Event, jun/26): a curva inteira do `FriendBonusQTY` foi
  reformulada no N.js — invisível para um diff de dados; só pega quem lê a função.
- **hat rack** (Pet2/Companion 31): um companion placeholder foi ativado e passou a dar
  `+15% Hat Rack Bonus Multi`, um **termo novo** que entra no DR via
  `hatrackBonusMulti → etcBonus(2) → premhat`. Passou como "cosmético".
- **Dreadnaught Captain** (Companion 57): mesma classe de mudança (placeholder ativado),
  felizmente neutro — mas só descoberto por revisão humana.

A causa raiz: **detecção de dados, não de lógica; e nenhuma garantia mecânica de que a
varredura cruze todas as fórmulas portadas.**

## Objetivos

1. **Precisão:** nenhuma mudança do jogo que afete uma fórmula portada pode passar
   silenciosamente. Detecção de **lógica** (não só dados).
2. **Cobertura total:** todo o código portado do site — engine arkh (~49 sistemas),
   as 4 features (drop-rate, tome, cooking-mastery, talents-level), leaderboards, e o
   parser `lib/it` (~100 arquivos).
3. **Automático:** trigger periódico (cron via skill `schedule`) que detecta o update,
   aplica as correções, valida e abre um **PR**.
4. **Gate humano:** o agente nunca mergeia na main. Quem confirma o merge é o usuário.

## Não-objetivos

- Mergear na main automaticamente (sempre via gate humano).
- Golden tests para todo o `lib/it` interno (só o que o site expõe — ver §6).
- Reescrever as engines portadas; só detectar/portar deltas.

---

## Arquitetura geral

Duas **fontes de verdade** distintas, cada uma com seu mecanismo de detecção:

| Origem do port | Código | Fonte de verdade | Mecanismo de detecção |
|---|---|---|---|
| **A — N.js direto** | engine arkh + 4 features | `N.js` (bundle do jogo) | camada `formulas` + `lists`/`items`/`strings` + registry `@njs` |
| **B — IdleonToolbox** | parser `lib/it/` | `it-source/` (clone upstream) | re-sync diff `it-source ↔ lib/it` |

```
            ┌─────────────── N.js (live) ───────────────┐   ┌── it-source (upstream) ──┐
            │ extract: lists·items·strings·FORMULAS(novo)│   │   git pull / refresh     │
            └───────────────────┬────────────────────────┘   └────────────┬─────────────┘
                                │                                          │
              diff vs snapshot (web/data/njs-snapshot/)        re-sync diff vs lib/it
                                │                                          │
                   ┌────────────┴───────────┐                             │
                   │   FORMULA REGISTRY      │ (gerado de anotações @njs)  │
                   │  njsName → arquivos     │                             │
                   └────────────┬───────────┘                             │
                                │                                          │
                    IMPACT REPORT (unificado): para cada mudança →         │
                    arquivo a revisar · auto-portável? · golden delta ◄────┘
                                │
              GOLDEN HARNESS (4 features + leaderboards):
              ground-truth (extraData) · regressão (baseline) · sintéticos
                                │
              CRON (schedule, 6h, hash-gated) → aplica mecânico +
              porta fórmulas (só se golden provar) + re-sync IT +
              valida (tsc+golden+testes) → abre PR → PUSH notification
                                │
                   [GATE: usuário revisa o PR e mergeia pra main]
```

---

## Componentes

### 1. Camada de extração de fórmulas — `extract-formulas.ts`

As fórmulas de gameplay do N.js vivem em formato estável e enumerável: custom-blocks
despachados por string, `if("<Name>"==d)return <expr>` (ex.: `FriendBonusQTY`,
`HatrackBonusMulti`, `FriendBonusXtraMulti`, `PremHatBonusesSystemON`), e funções
`_customBlock_X=function(...){…}` (dispatchers).

- Varre o bundle **normalizado** (reusa `normalizeBundle` + o scanner com consciência de
  strings/brackets que `extract.ts` já tem) capturando cada `if("<Name>"==d)return <expr>`
  até o próximo `;if(`/fim do ternário.
- **Escopo de captura (Fase 1 + 1.5 — implementado).** Captura: (a) **named-blocks de
  qualquer dispatcher** `if("<Name>"==<v>)…` (`v` ∈ `a..z`, nome ≥3 chars — exclui ruído de
  1–2 chars); e (b) os **corpos de `_customBlock_X=function`** (scaffolds), com os named-blocks
  internos colapsados para `~` (o scaffold reflete só a lógica FORA deles, sem duplicar o
  granular). Isso pega lógica despachada por número (`if(918==d)…`) e helpers diretos — fechando
  o gap que o review da Fase 1 apontou. Baseline atual: **1303 entradas** (named-blocks +
  233 scaffolds `_customBlock_` + non-`d`).
- Saída: `web/data/njs-snapshot/formulas.json` = `{ blockName → expressão normalizada }`,
  ao lado de `lists/items/strings`.
- Diffado pelo `diff.ts` existente (diff genérico de mapas).

Esta camada é **universal**: diffa TODAS as fórmulas nomeadas do N.js, qualquer mecânica.

### 2. Formula registry — anotações `@njs` + geração + guard

O mapeamento "fórmula do N.js → arquivo portado" **não é um doc paralelo** (driftaria).
É derivado do próprio código:

- **Co-localização:** cada fórmula portada (resolver, função, constante espelhada) ganha
  uma anotação legível por máquina, ao lado dela:
  ```ts
  // @njs FriendBonusQTY
  export const friend = { resolve(id, ctx) { … } };

  // @njs RandoListo2[8]
  export const MASTERY_COEF = [200, 1, 30, 10, 2, 20] as const;
  ```
- **Geração:** `registry/gen-registry.ts` varre o código via AST (TS Compiler API — já
  usado pelo callgraph tool) e emite `registry/formula-registry.gen.ts`. Nunca editado à
  mão. Estrutura de cada entrada:
  ```ts
  { njsName, kind: "customBlock"|"list"|"const",
    portedFiles: string[], mirroredConstants?: {const,source}[],
    golden?: ("dr"|"cooking"|"tome"|"talents")[], note?: string }
  ```
- **CI guard** (`web/__tests__/registry.guard.test.ts`) — quebra o build se:
  1. o registry gerado está desatualizado (regenera e compara — força commitar);
  2. uma anotação `@njs X` aponta para um nome que **não existe** no snapshot do N.js
     (typo / fórmula removida-renomeada no jogo → port órfão);
  3. **cobertura de DR:** todo `{system,id}` nos pools de `drop-rate.ts` cujo resolver não
     tem `@njs` → falha pedindo catalogação. (Cooking/Tome/Talents: o guard varre as
     constantes/extractors em locais fixos.)

### 3. Rede de segurança (backstop em runtime)

Qualquer custom-block (N.js) ou parser (it-source) que **mude** e **não esteja
catalogado/reconhecido** → flagrado no impact report como
`⚠️ não-catalogado mudou: investigar (port faltando ou fonte nova?)`. Garante que mesmo
com registry incompleto, nada passa silenciosamente. É o que teria gritado no
`+Companions(31)` do hat rack.

### 4. Re-sync diff do parser IT — `it-resync.ts`

- Atualiza o `it-source/` (clone do IdleonToolbox upstream).
- Diffa **arquivo-a-arquivo** `it-source/parsers/** ↔ lib/it/parsers/**`.
- Reporta quais parsers o upstream mudou que ainda não aplicamos. Cobre os ~100 arquivos
  sem precisar de `@njs` em cada um — o upstream já portou do N.js; só detectamos o delta.

### 5. Golden harness — `golden/`

Escopo: **4 features (DR, Cooking, Tome, Talents) + stats de leaderboard**. Três modos:

1. **Ground-truth** — compara a saída da engine vs o valor que o **jogo** gravou no save
   (`save.extraData.dropRate`, etc.), com tolerância p/ desync save↔leitura. Prova o port
   contra a verdade. Usado onde o `extraData` expõe o valor.
2. **Regressão** — `golden/baseline.json` versionado guarda saída de cada feature × save.
   Recomputa e diffa a cada update. Mudança intencional → baseline regravado **no mesmo
   PR** (o diff do baseline documenta o impacto numérico da correção).
3. **Sintéticos** — `golden/cases.ts`: casos construídos por injeção (como o
   `validate-hatrack.ts`) para cobrir o que nenhum save real exercita ainda. Quando a
   camada `formulas` flagra um termo novo e ele é portado, um caso sintético entra aqui.

Conjunto de saves: ARKHE (local) + N top players via IT profiles endpoint
(`profiles.idleontoolbox.workers.dev/api/profiles/?profile=<name>`). Versiona os profile
*names* + o baseline; saves buscados na hora.

Roda (a) no updater (alimenta o impact report) e (b) no CI (`golden.test.ts`, guard de
regressão em qualquer commit).

### 6. Impact report unificado — `report.ts`

Para cada mudança detectada (N.js ou IT), uma linha com: **o que mudou**, **arquivo(s) a
revisar** (via registry / re-sync), **status** (auto-portado-e-validado / precisa-humano /
neutro), e o **delta do golden** quando aplicável. Markdown, em
`web/data/njs-snapshot/reports/report-<data>.md`.

### 7. Orchestrator — `run.ts` (atualizado)

Roda todo o pipeline: fetch N.js + it-source → extrai (incl. formulas) → diffa → cruza com
registry → re-sync IT → golden → emite impact report. Flags: `--write-game-data`,
`--no-fetch`, `--dry`, e um novo `--apply` (aplica as correções auto-portáveis).

### 8. Agente automático — routine `schedule` (cron, a cada 6h)

Checagem barata e **hash-gated**: baixa N.js + compara hash, atualiza it-source + diffa.
Se nada mudou → **no-op, sem PR**. Só dispara o trabalho pesado em mudança real. Pipeline:

1. Snapshot (extrai formulas/lists/items/strings; re-sync diff it-source↔lib/it).
2. Aplica o mecânico (`--write-game-data`, nomes de mapa, constantes espelhadas).
3. Porta as fórmulas sinalizadas (custom-blocks mapeados → reescreve a fórmula portada
   p/ casar com a nova expressão; parsers IT mudados → aplica o re-sync).
4. Valida: `tsc` + golden (3 modos) + suíte de testes existente.
5. **Regra de ouro:** nunca commita uma fórmula que não passou no golden. Sem confiança
   (golden falhou / fórmula nova sem mapeamento) → mantém o código atual e marca
   `⚠️ precisa de humano: <fórmula> — <motivo>`. Sinaliza, não inventa.
6. Atualiza baseline do golden (mudanças intencionais) + registry/memória.
7. Abre PR em branch `auto-update-<data>` com relatório + diffs + o que precisa de humano.
   **Não mergeia.**
8. **Push notification** com resumo + link do PR + o que precisa de humano.

**Gate:** o usuário revisa o PR e mergeia. O agente nunca toca a main.

---

## Garantias de cobertura (como nada passa silenciosamente)

- **Detecção universal:** `formulas` + `lists`/`items`/`strings` (N.js) + re-sync diff
  (IT) cobrem 100% das mudanças do código portado, em qualquer mecânica.
- **Rede de segurança:** mudanças não-catalogadas são flagradas, nunca silenciadas.
- **Mapeamento explícito** (registry `@njs`): incremental, **forçado por CI guard** — a
  cobertura só cresce; esquecer de anotar quebra o build ou é pego no próximo update.
- **Golden:** prova numérica do port (4 features + leaderboards), incl. ground-truth
  contra o próprio jogo e sintéticos para termos que saves reais não alcançam.

Caminhos silenciosos fechados: mudança de **curva** (golden + formulas), **termo novo**
(formulas + rede de segurança + sintético), **constante espelhada** (lists + registry),
**parser IT** (re-sync diff).

## Tratamento de erros / casos de borda

- Fetch (N.js / it-source / profiles) falha → retry; persistindo → notifica falha, não
  abre PR quebrado.
- N.js sem mudança (hash idêntico) → no-op.
- Golden falha geral ou tsc não passa → PR aberto, marcado "revisar, não-mergeável".
- Auto-port sem confiança → sinaliza (regra de ouro), nunca força.
- main avançou desde a checagem → o PR é contra a main atual (merge é do humano).

## Testes

- `registry.guard.test.ts` — consistência registry↔código (§2).
- `golden.test.ts` — regressão das 4 features + leaderboards (§5).
- Testes unitários do extractor de fórmulas (`extract-formulas`) com fixtures do N.js.
- Teste do re-sync diff com um par it-source/lib/it sintético.

## Decisões operacionais

- **Cadência:** a cada 6h (hash-gated).
- **Notificação:** push no celular (resumo + link do PR + o que precisa de humano).
- **Gate:** sempre humano para a main; o agente só abre PR.
- **Construção incremental:** o registry começa derivado do que já é explícito (pools de
  `drop-rate.ts`, constantes das features) e cresce a cada update; a rede de segurança
  cobre o gap até o registry amadurecer.

## Estrutura de arquivos (proposta)

```
web/scripts/updater/
  run.ts                      (orchestrator, atualizado)
  extract.ts                  (existente)
  extract-formulas.ts         (NOVO)
  diff.ts                     (existente, reusado)
  fetch-njs.ts / steam.ts / emit-game-data.ts (existentes)
  it-resync.ts                (NOVO)
  report.ts                   (NOVO/refatorado)
  registry/
    gen-registry.ts           (NOVO)
    formula-registry.gen.ts   (GERADO)
  golden/
    saves.ts / cases.ts / baseline.json / run.ts (NOVOS)
web/data/njs-snapshot/
  formulas.json               (NOVO) + items/lists/strings/meta.json (existentes)
web/__tests__/
  registry.guard.test.ts      (NOVO)
  golden.test.ts              (NOVO)
.claude/ (ou equivalente)
  routine "idleon-update-watch" (schedule, 6h)
```
