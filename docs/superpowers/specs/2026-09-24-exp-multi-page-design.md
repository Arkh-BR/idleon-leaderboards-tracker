# Página EXP Multi (Class EXP) + kit de páginas de stat — Design Spec

**Data:** 2026-09-24
**Status:** design aprovado pelo usuário (24/09/2026). O usuário delegou o resto da noite ("tome as decisões sozinho e anote") e avalia tudo de manhã. As decisões autônomas estão na seção própria.
**Branch:** `feat/exp-multi-page` (a partir de `main` `0912392`)

## Problema

O site tem páginas de Drop Rate (`/drop-rate`) e Coin Multi (`/coin-multi`) que:
- calculam o stat de cada personagem a partir do save;
- mostram a árvore completa de fontes;
- guardam snapshots;
- comparam com o máximo observado nos top players;
- ranqueiam onde ganhar mais ("💡 Biggest Gains").

O usuário quer a mesma análise para mais três stats, nesta ordem:
1. **EXP Multi**;
2. AFK Gains Rate;
3. Multikill.

Este spec cobre o **EXP Multi** e o **kit genérico** que os três vão usar. AFK Gains e Multikill terão spec e plano próprios depois, e vão custar só o port do motor mais a configuração no kit.

## Objetivos

- **Página "EXP Multi"** com paridade de funcionalidades com a de Coin Multi.
- **Valor igual ao do jogo.** O valor é calculado localmente a partir do save e deve ser igual ao que o painel de stats mostra para o personagem/mapa validado.
- **Kit reusável.** As camadas de página do Coin (calculadora, snapshots, Biggest Gains, página e coletor do Observed Max) viram um kit parametrizado por stat. O EXP é o primeiro consumidor e o Coin migra para o kit.
- **DR intocado.** Zero mudança de comportamento no Drop Rate e no Coin Multi (números, chaves de storage, snapshots salvos).

## Decisões do usuário (24/09/2026)

| Tema | Decisão |
|---|---|
| Escopo | **Só Class EXP**: `ExpMulti(0)`, o valor do painel de stats do personagem. Skill EXP (`ExpMulti(1..19)`) fica fora. |
| Funcionalidades | **Mesma estrutura do Coin**: calculadora + árvore, snapshots, Compare vs Observed Max, Biggest Gains. |
| Abordagem | **B. Kit genérico** extraído do Coin. O EXP usa o kit e o Coin migra para ele na última task. O DR fica como está. |
| Fidelidade | Responsabilidade do Claude: N.js + oráculo do IT termo a termo + uma leitura do jogo no fim. O usuário não valida fórmula, só decisões de produto. |
| Entrega | Um PR; merge na `main` só com ordem explícita do usuário. |

Nome e navegação (padrão, sem objeção):
- título "EXP Multi Tracker";
- URL `/exp-multi`;
- item de menu "✨ EXP Multi" logo após "🪙 Coin Multi";
- card na home.

O texto do site é em inglês.

## Decisões autônomas (noite de 24/09/2026)

O usuário foi dormir e pediu: "tome as decisões sozinho e anote". Tudo abaixo foi decidido pelo Claude e será avaliado pelo usuário.

| # | Decisão | Por quê |
|---|---|---|
| D1 | O gate do **Shiny Medallions** (talento 429) segue o N.js: vale se `Compass[3]` contém `MapAFKtarget[mapa]`, o mob **padrão do mapa**. Nunca usa o `AFKtarget_N`. | Único escritor do `_GenINFO[17]` (@12976791). O IT usa o alvo AFK e erra em cidades e em side-skilling; neste save os dois coincidem. |
| D2 | O total usa uma **escada nova** (`formatExpMulti`), que trunca e só usa M/T (tabela abaixo). | Nenhum formatador existente bate com o painel. Os glifos M/T são inferidos de outros usos das fontes 251/244 e ficam para o print do usuário confirmar. |
| D3 | O **gating por classe** do Observed Max vale só para o talento **35** (Lucky Charms, aba Maestro). | 632 é star talent (toda classe). 55/328/429/434 são account-wide, lidos por `getbonus2` e já na lista `account-wide-talents`. |
| D4 | O fator de LUK `LUK·(1+T35/100)/1,8` vira **duas fontes aditivas**: `luk` = `100·curva/1,8` e `talent35` = `curva·T35/1,8`. | É algebricamente idêntico, e assim o gating do D3 zera só a parte do talento. |
| D5 | **Mapa do coletor:** por save, o mapa que maximiza `(1 + arcane₁/100) × (gate D1 ? max(1, t429) : 1)`; empate vai para o menor índice. | São os dois únicos termos que dependem do mapa (o Shrine é tratado como global). É a mesma ideia do "mapa de pico" do coletor do DR. |
| D6 | **Termos sem helper** (14) são portados do N.js, incluindo o subsistema Bubba (`BubbaRoG_Bonuses(6)`, ×4,02 neste save), Salt Lick, Sticker, Dancing Coral (`TowerInfo`), comida normal (`TotalFoodBonuses`), Compass 51, Zenith 9 e Flurbo 2. | Paridade com o jogo. Vários são ×-grandes neste save. |
| D7 | **MSA** (`GamingStatType("MSA_Bonus",4)`, que lê estado de NPC `_GenINFO[114+]`): portar a partir do que o `_GenINFO` reconstrói no load, se sair do save. Se não sair, a fonte fica **0 com nota** e o gap é documentado no teste. | O IT mostra 1,78 neste save (`msaTotalizer`), então dá para derivar do save. O que não der fica explícito, não inventado. |
| D8 | **Shrine** reusa o sistema do DR (tratado como global). | Mesma simplificação do DR. Com Moai Head o shrine é global de verdade (endgame). |
| D9 | O pool aditivo é **uma lista plana** de fontes (~60), na ordem do jogo. Os blocos LUK2/LUK4/LUK6 não viram subnós. | O Biggest Gains só enxerga filhos diretos do grupo. |

## Fórmula (fonte da verdade: N.js vivo)

`x._customBlock_ExpMulti(0)` (@4238487–@4247524). Parênteses conferidos no texto cru; o `/100` final vale só para Σ, não para a curva de LUK:

```
EXP = Workbench × (1 + LUK3/100) × LUK5 × (1 + Etc78/100) × (1 + LUKcurva·(1+T35/100)/1,8 + Σ/100)
```

**Grupos** na ordem do produto. O tipo `mult` significa que cada fonte já é um fator e o grupo é o produto delas.

| # | Grupo (nome na árvore) | Tipo | Fontes (ids, em ordem) |
|---|---|---|---|
| G1 | 🛠️ Workbench | mult | `workbench` = `1 + getbonus2(328)·getLOG(OLA[139])/100` (sistema `workshop` existente) |
| G2 | 🎁 Bundle + Superbit | pct | `bunQ` (20 se `bun_q`), `superbit19` (50 se merit W1#3 > 0, char **estritamente** de menor nível e Super Bit 19) |
| G3 | 🏅 Shiny Medallions | mult | `medallion429` = gate D1 ? `max(1, getbonus2(429))` : 1 |
| G4 | 🐾 Companions · Jelly · Lab | mult, `max(1,·)` | `comp37` (1+9c), `comp33`, `comp160` (1+4c), `comp32`, `comp168` (1+0,4c), `comp34`, `comp145`, `jelly30`, `jelly62`, `comp128` (1+min(0,5,c)+0,25·LV2), `gridExp` (Grid 130+131+132+152), `sticker0`, `superbit63` (1+0,1·b), `zenith9`, `comp50` (clamp [1, 1,01] de 1+c/2500) |
| G5 | 🎽 Gear · Card · Arcade · Vial | mult | `etc84`, `card100`, `arcade60`, `vialClassExp` (vial `7classexp`) — cada um 1+x/100 |
| G6 | ⚔️ Slayer Abominator | mult | `talent434` = `max(1, getbonus2(434))^TotalTitanKills` (wrap existente) |
| G7 | 🗺️ Arcane · Spelunk · Reef · Sets | mult | `arcane1` (slot 1, por mapa), `bigFish4`, `dancingCoral3`, `coralKid` = `(1+CK2/100)^max(0, Divinity[25]−10)` com CK2 = `20·OLA[429]/(25+OLA[429])`, `cardSet12`, `bubba6`, `sushi15`, `cloud70` (1+5x/100), `fountain16`, `royalStatue3` |
| G8 | 💎 Classy Discoveries | mult | `classy` = `max(1, 1,03^len(Spelunk[6]) · SB24 · (1+Meritoc27/100) · (1+max(0, 5·(OLA[464]−8))/100))` |
| G9 | 🎽 Class EXP Equip | pct | `etc78` |
| G10 | ➕ Additive Pool | pct | `luk`, `talent35` (D4), `etc4`, `boxMonsterExp`, `food` (`TotalFoodBonuses("ClassEXP")`), `starSignMainXP`, `vialMonsterExp`, `bubbleExp` (`expACTIVE`), `card44`, os termos de **LUK2**, `statue10`, `talent632`, `shrine5`, `saltLick3`, `prayer0`, `prayer2`, `prayer9` (**negativo**: maldição), `flurbo2`, `ach57`, `ach357` (×20), `ach61` (×3), `ach124` (×2), `ach188` (×5), `arcade12`, `sigil8`, `ach286` (×25), `shiny1`, `msa4`, `talent55`, os termos de **LUK6** |

Termos de LUK2 dentro do G10:
- `merit3` (3·merit W1#3, só para o char de menor nível);
- `vault12` (só para o char de menor nível);
- `cardSet0` (nível < 50);
- `mealClexp` (nível < 120);
- `weeklyBoss` (`min(150, WeeklyBoss.c)`);
- `newbie` (150/100/50 para nível < 10/30/50);
- `divMinor4`;
- `cardSet5`.

Termos de LUK6 dentro do G10:
- `cardSpring` (2·CardLv springEvent1);
- `comp3`, `comp50add`;
- `shimmer179` (OLA[179]·AllShimmer);
- `goldFood` (`ClassEXPz`);
- `owl0`, `vote15`, `monument1_6`;
- os termos de LUK4: `compass51`, `hole47`, `win23`, `grimoire24`, `vault3`, `vault35` (×getLOG(OLA[345])), `hole83`;
- `ironSet`, `exotic50`, `ola421`, `stampClassxp`, `friend1`, `comp47`, `comp111`, `button8`, `comp128add`.

**Cobertura no arkh** (inventário completo de 109 linhas, com helper e status por termo, no plano):
- **A maioria já existe** e só precisa de índice/chave nova: companions, grid, vault, summoning, sushi, fountain, royal statue, cloud, meritoc, gold food, stamps, prayers, achievements, arcade, sigil, shiny, star sign, vials, etc bonus, cards, talentos e workshop.
- **Portes novos:** Bubba RoG, Salt Lick, Sticker, Dancing Coral (+ chave `TowerInfo` no loader), comida normal, Compass 51, Zenith 9, Flurbo 2, Weekly Boss, faixas de nível, char de menor nível, Spelunk pow, Coral Kid e MSA (D7).
- **Com cuidado extra:** card sets 0/12 (equipado × possuído — vale o N.js), Holes B_UPG 47/83, bolha `expACTIVE`, `ExoticBonusQTY(50)` e o roteamento do star talent 632.

**Exibição no jogo** (`ActorEvents_29._event_PlayerInfo` @6665695, rótulo "Class EXP:"). Truncamento, sem arredondar, avaliado de cima para baixo:

| Condição | Texto |
|---|---|
| `v ≥ 1e15` | `⌊v/1e12⌋` + "T" |
| `v ≥ 1e14` | `⌊v/1e11⌋/10` + "T" |
| `v ≥ 1e13` | `⌊v/1e10⌋/100` + "T" |
| `v ≥ 1e9` | `⌊v/1e6⌋` + "M" (sem B) |
| `v ≥ 1e8` | `⌊v/1e5⌋/10` + "M" |
| `v ≥ 1e7` | `⌊v/1e4⌋/100` + "M" |
| `v ≥ 1e3` | `⌊v⌋` |
| valor inteiro exato | `v` + ".00" |
| décimo exato | `v` + "0" |
| senão | `round(100v)/100` |

A página acrescenta o "x". A referência do IT neste save, 1,45e19, sai como "14504214T" pela escada.

## Arquitetura

### 1. Motor (`web/lib/arkh`)

- **Grupos compartilhados.** `stats/defs/grouped.ts`, novo, extraído do `coin-multi.ts`, com:
  - os tipos `GroupKind = "pct" | "raw" | "min4" | "mult"` e `StatGroup`;
  - `groupFactor(kind, items)`;
  - `groupedDescriptor({ id, name, scope, category, system, groups })`, que monta pools e `combine()`.

  Regras de `groupFactor` por tipo:

  | Tipo | Fator do grupo |
  |---|---|
  | `pct` | `1 + Σ/100` |
  | `raw` | `1 + Σ` |
  | `min4` | `1 + min(4, Σ)` |
  | `mult` | produto dos filhos, onde cada filho já é um fator, com `max(1, ·)` opcional por grupo |

  O `coin-multi.ts` passa a usar o helper, sem mudar nenhum número.
- **Descritor** `stats/defs/exp-multi.ts`: `EXP_GROUPS` na ordem do jogo, raiz **"EXP Multi"**.
- **Sistema** `stats/systems/exp/*.ts`: `resolveExp(id)`, com um id por termo do N.js e tag `@njs`, no mesmo molde do `coin.ts`.
  - Reusa os helpers existentes, que são a maioria.
  - Porta só o que falta (tabela da fórmula, coluna "arkh").
  - Mudanças em tabelas e helpers compartilhados são só **aditivas**.
  - Talentos lidos por `getbonus2` seguem a regra já validada no DR (PR #27/#28).
- **Entrada.** `lib/arkh/computeStat.ts`, novo, com `computeStatTree`, `computeStatPools` e `combineStatPools` para qualquer descritor agrupado.
  - O contexto é o mesmo do Coin: `mapIdx` e o `afkTarget` do char.
  - `computeCoin.ts` e o novo `computeExp.ts` ficam como embrulhos finos.

### 2. Kit de página (`statTracker`)

| Arquivo | Origem | Papel |
|---|---|---|
| `lib/statTracker/config.ts` | novo | Tipo `StatPageConfig` (abaixo) |
| `lib/statTracker/storage.ts` | `lib/coinMulti/storage.ts` | `createSnapshotStore(key, legacyValueKey?)`: snapshots por char, export/import |
| `lib/statTracker/biggestGains.ts` | `lib/coinMulti/biggestGains.ts` | Ganho por fonte para os 4 tipos de grupo |
| `lib/statTracker/mapOptions.ts` | `lib/coinMulti/mapOptions.ts` | Lista de mapas (todos + `CurrentMap_*`) |
| `components/statTracker/StatCalculator.tsx` | `CoinCalculator.tsx` | Login/nome/colar, char online, char+mapa, total, árvore |
| `components/statTracker/StatSnapshotSection.tsx` | `CoinSnapshotSection.tsx` | Histórico, Δ, compare, export/import |
| `components/statTracker/StatBiggestGains.tsx` | `CoinBiggestGains.tsx` | Aba 💡 Biggest Gains |
| `components/statTracker/StatPageClient.tsx` | `CoinMultiPageClient.tsx` | Monta a página e o "Compare vs Observed Max" |

`StatPageConfig` concentra tudo o que muda de um stat para outro:
- ids e textos: título, emoji, subtítulo, rótulo do total, dica do seletor de mapa, nota de metodologia, rodapé, prefixo do arquivo de export;
- chaves de storage: save colado, nome, snapshots, colapso;
- `compute(save, char, map)`, com import dinâmico;
- `formatTotal`, a notação do jogo;
- raiz e grupos, para o Biggest Gains;
- `loadTop(classKey)` e o meta do Observed Max (data e players).

Regras do kit:
- **Snapshots do Coin preservados.** O snapshot genérico guarda o valor em `value`. A loja do Coin lê o campo antigo `computedCoinMulti` como fallback (`legacyValueKey`), então históricos e exports antigos continuam funcionando. As chaves de localStorage do Coin não mudam.
- **Ganho do tipo `mult`.** A razão é `máx/você`. Com `max(1, ·)`, é `max(1, F·máx/você) / F`.
  - Os tipos `pct`, `raw` e `min4` mantêm a matemática atual do Coin.
  - O `min4` passa a usar a soma do grupo, igual ao atual quando o grupo tem uma fonte só.
- **Rotas.** As páginas viram cascas: `app/exp-multi/page.tsx` e `app/coin-multi/page.tsx` renderizam `<StatPageClient config={…} />`.
- **Arquivos por stat.** Cada stat tem `lib/<stat>/pageConfig.ts` (a `StatPageConfig`), `lib/<stat>/format.ts` (notação do jogo) e `lib/<stat>/top*.ts`/`.meta.ts` (Observed Max gerado).
  - EXP: `lib/expMulti/{pageConfig,format,topExpMulti,topExpMulti.meta}.ts`.
  - Coin: `lib/coinMulti/{pageConfig,format,topCoinMulti,topCoinMulti.meta}.ts`. Os demais arquivos de `lib/coinMulti` e `components/coinMulti` somem na migração.

### 3. Observed Max + cron

- **Coletor compartilhado** `scripts/_shared/topStatCollector.ts`, extraído do `update-top-coin.ts`:
  1. candidatos;
  2. pools por char;
  3. melhor valor por fonte;
  4. gating por classe;
  5. **uma** passada de `combine`;
  6. `MIN_PLAYERS = 20`;
  7. emissão de `top*.ts` + `.meta.ts` com os mesmos nomes exportados que o Coin usa hoje, parametrizados por prefixo.
- **Neutro no gating por classe.** Um talento de classe zerado vale **0** em `pct`/`raw`/`min4` e **1** em `mult`.
- **Gating genérico.** `deriveGatedTalentsFor(ids)` substitui o `coinClassGating.ts`.
- **EXP** (`scripts/update-top-exp.ts`):
  - candidatos: #1 de cada board + **top 10 do `totalLevels`**;
  - cada char medido no **mapa de maior bônus Arcane de EXP** do próprio save, como o coletor do DR;
  - saída em `lib/expMulti/topExpMulti.ts` + `.meta.ts`, carregados sob demanda.
- **Coin**: `update-top-coin.ts` vira config do coletor, com o mapa fixo 301 como hoje.
- **Cron**: passo novo no `.github/workflows/refresh-top-max.yml` (`continue-on-error`, timeout 12), com os arquivos do EXP na lista do commit.

### 4. Navegação

- `components/TopNav.tsx`: `{ href: "/exp-multi", label: "✨ EXP Multi" }` após o Coin.
- `app/page.tsx`: card "EXP Multi Tracker".
- e2e da home: card novo.

## Testes e validação

- **Motor**:
  - testes do `groupFactor`/`combine` com pools sintéticos, incluindo `mult` com `max(1, ·)`;
  - `coin-multi.combine` inalterado e verde.
- **Oráculo**: o teste com save real (privado, `describe.skipIf`, pulado no CI) compara termo a termo, em precisão total, com o `getClassExpMulti` do IT vivo (`web/scripts/updater/.cache/it-live`).
  - Referência do IT no save em cache (Markhe, mapa 14): **1,4504214791708842e19**.
  - Onde o IT divergir do N.js, vale o N.js, e cada gap fica explicado no teste.
- **Jogo**: o valor exibido no painel de stats (formatação abaixo) bate com a leitura do usuário, com save fresco obtido **sem login quando possível** (perfil público do IT ou "Copy for Support" colado).
- **Smoke**: todos os saves de top players em cache calculam um total finito para todos os chars.
- **Kit**: testes de storage (legacy key do Coin, import/export), Biggest Gains (4 tipos) e mapOptions, migrados dos testes do Coin e generalizados.
- **UI**: os testes do Coin (keepView/char online, save da conta prevalece sobre o colado, Biggest Gains, TopNav) viram testes do kit e rodam também com a config do EXP. e2e da home com o card novo.
- **Coin e DR protegidos**: `coin-multi.save` (6,88E35), regressão do DR (363.893,46) e todos os testes existentes verdes.
- **Verificação**: `tsc --noEmit` + vitest + preview da Vercel; **nunca** `npm run dev`.
- **Critério de pronto**: bater a leitura do jogo, na mesma formatação da tela.

## Entrega

Branch `feat/exp-multi-page`; plano em `docs/superpowers/plans/`; execução por subagentes; um PR; merge na `main` só com ordem explícita do usuário.

## Fora de escopo

- Skill EXP (`ExpMulti(1..19)`).
- Migrar a página de DR para o kit (ela tem world buckets, luck e frankenstein próprios).
- AFK Gains Rate e Multikill (specs próprios, depois deste).
- Portar o gate de mapa do Shrine. O arkh trata os shrines como globais, igual ao DR. No N.js, o gate é Moai Head, mesmo mapa ou mesmo mundo com o Shrine World Tour.

## Riscos e pontos em aberto

1. **Divergências IT × N.js esperadas.**
   - O gate do Medallion (D1) coincide neste save.
   - Termos que o IT não lista separadamente: `comp168`, `comp145`, `jelly30`, `jelly62`.
   - A semântica dos card sets 0/12.
   - O super talent num preset não ativo: gap pequeno do arkh, que também afeta o DR (328). Não se corrige aqui; fica anotado.

   Vale o N.js, e cada gap fica escrito no teste do save.
2. **MSA (D7)**: pode não ser derivável do save. Se ficar 0, o total diverge do jogo por esse fator (neste save, +1,78 pontos no pool aditivo, que é minúsculo frente ao total).
3. **Glifos M/T (D2)** são inferidos. Confirmar com um print do painel quando o usuário ler o valor.
4. **Termos gigantes do pool aditivo** (Monument, Statue, Gallery/Hat Rack via Etc) dominam o total. Um erro de escala neles não aparece como detalhe, aparece no número final. A comparação termo a termo com o IT é o que protege.
5. **Save de validação**: o save em cache é de 23/09 05:25 UTC, e o jogo já andou. A leitura do usuário precisa de um save do mesmo momento (perfil público do IT ou "Copy for Support"), sem login.
6. **Migração do Coin para o kit**: risco de regressão de UI. Os testes do Coin rodam contra o kit e as chaves de storage são as mesmas. Se a migração falhar na revisão, a task sai do PR sem afetar o EXP.
7. **Primeira geração do `topExpMulti.ts`** depende da API de perfis do IT (rede). Se ela falhar, o PR sai com a referência gerada pelos saves de top players em cache (`web/scripts/updater/golden/.cache`), e o cron regenera.
