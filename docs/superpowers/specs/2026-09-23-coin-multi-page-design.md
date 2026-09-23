# Página Coin Multi (multiplicador de moedas) — Design Spec

**Data:** 2026-09-23
**Status:** design aprovado pelo usuário seção a seção (23/09/2026); aguardando revisão deste spec
**Branch:** `feat/coin-multi-page` (a partir de `main` `cff317b`)

## Problema

O site tem uma página de Drop Rate (`/drop-rate`) que calcula o DR de cada personagem a partir do save,
mostra a árvore completa de fontes, guarda snapshots, compara com o máximo observado nos top players e
ranqueia onde ganhar mais ("💡 Biggest Gains"). O usuário quer a mesma página para o **multiplicador de
moedas dos monstros** — no N.js, `ArbitraryCode("MonsterCash")`; no IdleonToolbox, "Cash Multi".

## Objetivos

- Página **"Coin Multi"** com paridade de funcionalidades com a de Drop Rate.
- Valor calculado localmente a partir do save e **igual ao exibido no jogo** para o personagem/mapa
  validado (mesmo critério que fechou o DR em 363.893,46).
- **Zero mudança de comportamento na página de DR.**

## Decisões do usuário (23/09/2026)

| Tema | Decisão |
|---|---|
| Escopo | **Tudo de uma vez**: calculadora + árvore, snapshots, Compare vs Observed Max, Biggest Gains |
| Nome | **Coin Multi** — título "Coin Multi Tracker", URL `/coin-multi`, item de menu "Coin Multi" |
| Abordagem | **B. Fork** das camadas do DR (página, calculadora, snapshots, Biggest Gains, coletor do Observed Max). O código do DR não é alterado. |
| Validação | Uma leitura do jogo (personagem + mapa + valor exibido), pedida quando o motor estiver pronto |
| Entrega | Um PR único; merge só quando o usuário mandar |

Esclarecimentos do fork: o **motor** (`web/lib/arkh`) é compartilhado e não se forka — o Coin ganha um
descritor e sistemas **novos**, e mudanças em tabelas compartilhadas são só **aditivas**. Peças que já são
genéricas e servem várias páginas (`DeepView`, `ProfileNameLoader`, `treeFlatten`, `extract`) são
**reusadas** como estão.

## Fórmula (fonte da verdade: N.js vivo, sha `6de681a96813`)

`ArbitraryCode("MonsterCash")` é um produto de **22 fatores multiplicativos + 1 grupo aditivo final**, nesta
ordem (parênteses conferidos no texto cru):

| # | Fator |
|---|---|
| G1 | `1 + (bolha CashSTR·⌊STR/250⌋ + bolha CashAGI·⌊AGI/250⌋ + bolha CashWIS·⌊WIS/250⌋)/100` — STR/AGI/WIS = `TotalStats` do personagem |
| G2 | `1 + min(4, Companions(24))` |
| G3 | `Stuff2("CoinDropMulti")` = `1 + Companions(38)` |
| G4 | `1 + min(4, Companions(45))` |
| G5 | `1 + min(4, Companions(159))` |
| G6 | `1 + 0,5·EventShopOwned(9)` |
| G7 | `1 + 0,6·EventShopOwned(20)` |
| G8 | `1 + EtcBonuses("77")/100` |
| G9 | `1 + SushiStuff RoG_BonusQTY(18)/100` |
| G10 | `1 + SushiStuff RoG_BonusQTY(37)/100` |
| G11 | `1 + (Grid_Bonus 149 + Grid_Bonus 169)/100` |
| G12 | `1 + EtcBonuses("100")/100` |
| G13 | `1 + GOLD_SET/100` |
| G14 | `1 + Holes GambitBonuses(7)/100` |
| G15 | `1 + 250·bun_y/100` |
| G16 | `1 + max(1, getbonus2(1,433,−1))·getLOG(OLA[362])/100` |
| G17 | `1 + (MealBonus("Cash") + Sailing ArtifactBonus(1) + Summoning RooBonuses(6) + VotingBonusz(34))/100` |
| G18 | `1 + (0,5·PetArenaBonus(5) + FriendBonusStatz(5) + PetArenaBonus(14) + StatueBonusGiven19/100)` — **sem** `/100` no grupo |
| G19 | `1 + (MainframeBonus(9) + VaultUpg(34)·VaultKillzTotal(8) + VaultUpg(37)·VaultKillzTotal(9))/100` |
| G20 | `1 + Ninja PristineBon(16)/100` |
| G21 | `1 + prayersReal(8)/100` |
| G22 | `1 + (Divinity Bonus_Minor(−1,3) + FarmingStuffs CropSCbonus(4))/100` |
| G23 | `1 + Σ/100`, Σ = `GetTalentNumber(1,657)` + frasco `MonsterCash` + `EtcBonuses("3")` + `CardBonusREAL(11)` + `7·CardLv("w5b1")` + `GetTalentNumber(1,22)` + `FlurboShop(4)` + `ArcadeBonus(10)` + `ArcadeBonus(11)` + `BoxRewards["13c"]` + **`GuildBonuses(8)·(1 + ⌊CurrentMap/50⌋)`** + `TalentCalc(643)` + `TalentCalc(644)` + `GoldFoodBonuses("MonsterCash")` + `VaultUpg(17)·getLOG(OLA[340])` + `5·Ach(235)` + `10·Ach(350)` + `20·Ach(376)` + `VaultUpg(2)` + `VaultUpg(14)·VaultKillzTotal(4)` + `VaultUpg(31)·VaultKillzTotal(7)` + `OLA[420]` + `VaultUpg(70)·Stuff2("CardsCollected")` |

Dois termos dependem do **mapa**: a guilda (G23), via o mundo `⌊mapa/50⌋`, e o `TalentCalc(643)`, via o tier de multikill contra o monstro do mapa (`OverkillStuffs("2")`, expoente 5 a partir do mapa 300). *(Corrigido na execução, Task 1: antes dizia que só a guilda dependia do mapa.)*

**Exibição no jogo** (N.js @11794100): `> 1e16` → `NotateNumber(x,"Big")`; `> 1e10` →
`⌊x/1e8⌋/10 + "B"`; `> 1e7` → `⌊x/1e5⌋/10 + "M"` (as duas **truncam**); senão
`NotateNumber(x,"MultiplierInfo")` (arredonda a 2 casas; `M` com 2 casas acima de 1e6).

## Arquitetura

### 1. Motor (`web/lib/arkh`)

- **Descritor** `stats/defs/coin-multi.ts`: um pool por grupo G1–G23, na ordem acima. O `combine()`
  multiplica os grupos respeitando as formas literais (`min(4,·)`, `1 + comp38`, G18 sem `/100`) e emite a
  raiz **"Coin Multi"** com um filho por grupo e as fontes dentro de cada um.
- **Sistemas**: reusar os existentes (companions, sushi RoG, grid, set bonus, vault, meal, friend, prayer,
  divinity, crop depot, golden food, cartas, arcade, post office, guild, achievements, vials, etc bonus,
  talentos). Talentos por `getbonus2` passam **sempre o char ativo** (lição do PR #27/#28). Criar só o que
  falta: bolhas de cash por stat, gambit, pet arena, flurbo, Roo, vault kills, estátua 19, cartas
  coletadas, TalentCalc 643/644. Tabelas compartilhadas (cartas, etc bonus, star sign, categorize) só por
  **adição**.
- **Entrada** `lib/arkh/computeCoin.ts`: `computeArkhCoinMulti(save, charIdx, mapIdx)` → `{ total, tree }`,
  fork do `computeDR.ts`.
- **Categorias** (`stats/categorize.ts`): regras novas para as fontes de moeda, para a árvore agrupar por
  sistema como no DR.

### 2. Página e UI

- `web/app/coin-multi/page.tsx` (casca de servidor, metadata "Coin Multi Tracker") +
  `CoinMultiPageClient.tsx` (fork do `DropRatePageClient`).
- `web/components/coinMulti/CoinCalculator.tsx` (fork do `DrCalculator`): login da conta / nome / colar,
  auto-update, mantém personagem e mapa no refresh; **seletor de mapa simples agrupado por mundo** (padrão =
  mapa atual do personagem); **sem** Arcane e **sem** Chip Gallery; valor na notação do jogo com o valor
  completo no hover.
- `web/components/coinMulti/CoinSnapshotSection.tsx` + `web/lib/coinMulti/storage.ts`: snapshots pessoais,
  chave `coin-multi-tracker.v1`; guarda valor, mapa e árvore achatada.
- Reuso: `DeepView` (árvore + abas), `ProfileNameLoader`, `treeFlatten`, `extract`.
- Armazenamento: o login da conta é compartilhado (mesma sessão); save colado e snapshots em chaves
  próprias (`coin-multi-tracker.*`).
- Navegação: "Coin Multi" em `components/TopNav.tsx` logo após "Drop Rate"; card na home (`app/page.tsx`).
- Texto do site em inglês.

### 3. Observed Max + Biggest Gains

- **Coletor** `web/scripts/update-top-coin.ts` (fork do `update-top-dr.ts`):
  - Jogadores: #1 de cada leaderboard do IT + **top 10 do board `cashMulti`**; mesmos filtros do DR
    (anônimos, denylist, saves hackeados).
  - Cada personagem calculado no **mapa 301** (primeiro mapa de luta do W7: mundo mais alto para a guilda e tier de multikill real; o 300 é cidade).
  - Melhor valor por fonte e **uma única passada** do `combine` sobre os melhores pools (total e ramos
    consistentes).
  - **Limite de cartas** (fork de `_shared/top8DrCards.ts`): só as cartas de moeda que cabem nos slots de
    um personagem.
  - **Gating por classe** (fork de `_shared/classGating.ts`): fontes de classe só no teto das classes que
    podem tê-las.
  - Trava `MIN_PLAYERS`: não publica referência vazia/encolhida.
  - Saída gerada: `web/lib/coinMulti/topCoinMulti.ts` + `topCoinMulti.meta.ts`, carregados sob demanda.
- **Cron**: passo novo no `.github/workflows/refresh-top-max.yml` (a cada 3 dias), reaproveitando o
  fetch/cache de perfis do `_shared/itProfiles.ts`; passos de DR e Talents inalterados.
- **Biggest Gains** (`web/lib/coinMulti/biggestGains.ts` + `components/coinMulti/CoinBiggestGains.tsx`):
  matemática multi-grupo — fechar o gap de uma fonte do grupo *g* (seu valor *y*, máximo *m*, soma do
  grupo *S_g*) multiplica o total por `(1 + (S_g − y + m)/100) / (1 + S_g/100)`; fatores especiais usam a
  razão direta. Ranking por **ganho percentual** (mostrando também o absoluto). Botão "Compare vs Observed
  Max" com a coluna Δ na árvore.

## Testes e validação

- **Motor**: testes unitários do `combine` com pools sintéticos (produto dos grupos, `min(4,·)`, `1 + comp38`,
  G18 sem `/100`, guilda × mundo).
- **Save real** (privado, `describe.skipIf`, pulado no CI): Coin Multi do personagem/mapa validado =
  **string exibida no jogo** (regras de exibição acima).
- **Oráculo**: script de dev compara termo a termo, em precisão total, com o `getCashMulti` do IT vivo
  (`web/scripts/updater/.cache/it-live`). Onde o IT divergir do N.js, vale o N.js.
- **DR protegido**: o teste de regressão do DR (363.893,46), os golden tests e todos os testes do DR
  continuam verdes, sem edição.
- **Biggest Gains**: testes da matemática multi-grupo com árvores achatadas sintéticas.
- **Coletor**: testes do limite de cartas e do gating de classe com entradas sintéticas; trava `MIN_PLAYERS`.
- **UI**: forks dos testes de componente do DR (mantém personagem/mapa no refresh; save da conta prevalece
  sobre o colado; "Coin Multi" no menu) e o card na home no e2e.
- Verificação: `tsc --noEmit` + vitest + preview da Vercel; **nunca** `npm run dev`.
- **Critério de pronto**: bater a leitura do jogo fornecida pelo usuário (personagem + mapa + valor), na
  mesma formatação da tela.

## Entrega

Branch `feat/coin-multi-page` a partir da `main`; plano de implementação em
`docs/superpowers/plans/`; execução por subagentes; um PR; merge na `main` só com ordem explícita do
usuário.

## Fora de escopo

- Generalizar a página de DR ou mexer nos componentes dela (decisão B).
- Outros stats (EXP multi etc.).
- Consertar o `POOL_NAMES` desatualizado do `DeepView` (badge "% do pool" do DR) — anotado, não faz parte.

## Riscos e pontos em aberto

1. **Divergências do IT × N.js** já vistas: `VaultUpg(37)·VaultKillzTotal(9)` (o IT usa níveis de bolha até
   100), o termo `7·CardLv("w5b1")` (ausente no IT) e `Divinity Bonus_Minor(−1,3)` (o IT soma os personagens
   ligados ao deus 3). Resolver pelo N.js.
2. **`TotalStats` de STR/AGI/WIS**: G1 usa `⌊stat/250⌋`, então um total levemente errado erra em degrau.
   Validar o `computeTotalStat` existente (`stats.ts:1123`).
3. **Semântica a confirmar no N.js**: `PetArenaBonus(5/14)`, `StatueBonusGiven19`, `TalentCalc(643/644)`
   (multikill tiers; nível de cooking/10), `VaultKillzTotal(4/7/8/9)`, `OLA[340/362/420]`.
4. **Onde ler o valor no jogo**: o painel que usa o template `~` (N.js @11794100) ainda precisa ser
   identificado, para orientar a leitura do usuário.
5. **Precisão da validação**: acima de 1e7 a tela trunca em 0,1M/0,1B, então a validação vale nessa
   precisão (a árvore em precisão total segue conferida contra o IT).
