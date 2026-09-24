# Página AFK Gains Rate (Fighting) — Design Spec

**Data:** 2026-09-24
**Status:** executado durante a noite (24→25/09/2026), revisado e **validado no jogo em 24/09/2026** (Markhe no mapa 14, save fresco: **58870%**, motor 588.7052987540884 — âncora anterior, save de 23/09 usado nos testes: 42231%). O usuário delegou as decisões ("tome as decisões sozinho e anote"); as decisões autônomas estão na seção própria.
**Branch:** `feat/afk-gains-page`, empilhado em `feat/exp-multi-page` (que traz o kit `statTracker`)

## Problema

O site tem páginas de Drop Rate (`/drop-rate`) e Coin Multi (`/coin-multi`), e a de EXP Multi (`/exp-multi`) está sendo implementada agora. Todas:
- calculam o stat de cada personagem a partir do save;
- mostram a árvore completa de fontes;
- guardam snapshots;
- comparam com o máximo observado nos top players;
- ranqueiam onde ganhar mais ("💡 Biggest Gains").

O usuário quer a mesma análise para três stats: EXP Multi, **AFK Gains Rate** e Multikill. Este spec cobre o **AFK Gains Rate**.

O AFK Gains Rate é o valor que `AFKgainrates(tipo)` devolve: o multiplicador dos ganhos AFK (kills ou ações de skill por hora) sobre o jogo ativo. O jogo mostra `⌊100·rate⌋%` no painel AFK Info. A página roda sobre o kit genérico do spec do EXP (`docs/superpowers/specs/2026-09-24-exp-multi-page-design.md`), então o custo é o port do motor, a config no kit e uma opção nova de unidade.

## Objetivos

- **Página "AFK Gains Tracker"** com as mesmas funcionalidades do Coin Multi e do EXP Multi: calculadora + árvore, snapshots, Compare vs Observed Max e Biggest Gains.
- **Valor igual ao do jogo.** O número calculado localmente a partir do save deve ser igual à linha AFK GAINS RATE do AFK Info para o personagem/mapa validado (Markhe no mapa 14: **42231%** no save de 23/09 usado nos testes; **confirmado no jogo em 24/09/2026** com save fresco: **58870%**, motor 588.7052987540884).
- **Só motor + config.** O kit ganha uma única opção nova (`unit`). O resto é descritor, sistema e config.
- **DR, Coin e EXP intocados.** Zero mudança de comportamento (números, chaves de storage, snapshots). As correções de fidelidade entram como funções novas; as antigas continuam alimentando o DR.

## Decisões do usuário (24/09/2026)

| Tema | Decisão |
|---|---|
| Stats e ordem | EXP Multi → **AFK Gains Rate** → Multikill, cada um com spec, plano e PR próprios. |
| Funcionalidades | "mesma estrutura do coin multi e drop rate" (mais cedo, em 24/09): calculadora + árvore, snapshots, Compare vs Observed Max, Biggest Gains. |
| Resto | Delegado na noite de 24/09: "tome as decisões sozinho e anote, amanhã quando acordar eu avalio tudo o que você fez". |
| Fidelidade | Mesma regra do EXP: responsabilidade do Claude (N.js + oráculo do IT termo a termo + uma leitura do jogo no fim). O usuário só valida decisões de produto e uma leitura do jogo. |
| Entrega | PR próprio; merge na `main` só com ordem explícita do usuário. |

Nome, rota e item de menu foram decididos pelo Claude (A1). O texto do site é em inglês.

## Decisões autônomas (noite de 24/09/2026)

O usuário foi dormir e pediu: "tome as decisões sozinho e anote". Tudo abaixo foi decidido pelo Claude e será avaliado pelo usuário.

| # | Decisão | Por quê |
|---|---|---|
| A1 | **Escopo: só o ramo Fighting** (`AFKgainrates("Fighting")`), página personagem+mapa. Rota `/afk-gains`, título "AFK Gains Tracker", menu "💤 AFK Gains" logo após "✨ EXP Multi". Os ramos de skill (Mining, Choppin, Fishing, Catching, Cooking, Laboratory, Divinity, Spelunking, Research) ficam fora. `ALL` e `MULTI` ficam como pools nomeados, separados do pool da luta, para um seletor de skill futuro só acrescentar o ramo. | É o que os jogadores comparam: o AFK Info de luta, o "AFK gains" do IT e as nossas páginas de DR e Coin, todas de luta e por mapa. A luta tem 41 termos, 27 já existentes no arkh. Os ramos de skill somam ≈46 termos (pré-bloco de 8, ≈26 específicos, 12 só da Research, que tem outra forma), quase todos MISSING, e cada ramo exige um char fazendo AFK naquela skill para validar. |
| A2 | **Número principal igual ao AFK Info:** `Math.floor(100·rate) + "%"` (Markhe: 42231%). O kit ganha a opção `unit: "x" \| "%"` (padrão `"x"`), usada no número principal da calculadora e na tabela de snapshots. | É o texto do jogo (@3790178). O "x" fixo do kit leria errado para uma taxa. Coin e EXP não passam `unit` e ficam iguais. |
| A3 | **Forma:** `max(.01, (0,4 + Σ/100) × (1 + arcane₂/100) × (1 + Etc92/100))`, ×0,2 no mapa 306 (Clamworks) e **substituída** pela fórmula da Crystal Glunko Cove, `Cglunko_AFKgains × (1 + 30·min(1, bun_u)/100)`, no mapa 216 quando `Holes[0][ci] == 17`. Como não é produto de grupos "1 + x", a página usa um **descritor próprio** (não o `groupedDescriptor`) e um `GainsModel.totalFromFlat` próprio para o what-if do Biggest Gains (D10 do EXP). Grupos: G1 "⚔️ Fighting AFK pool" (Σ da base 40, dos termos de luta e dos termos do `ALL`; fator Σ/100), G2 arcane slot 2, G3 Etc 92, depois as regras de mapa e o piso. A base 0,4 vira a fonte visível "Base fighting rate (40%)". | Nenhum `GroupKind` (`pct`, `raw`, `min4`, `mult`) expressa a base dentro do Σ, o piso ou a substituição. Com o what-if do D10, basta o stat ter o próprio `totalFromFlat`. A base como fonte deixa G1 exatamente Σ/100 e mostra de onde vêm os 40%. |
| A4 | **Correções de fidelidade** portadas para esta página, todas aditivas (o DR não muda): VOID_SET (+10 no save, valor + fallback de peças equipadas, via A11); helper novo de star signs ativos (equipados ∪ desbloqueados abaixo de `enabledStarSigns`, o −7 do signo 54, gates de nível, 2ª passada do star chip, Seraph só em positivo), usado no `FightAFK` e depois no Multikill, com o caminho de star sign do DR intocado (follow-up anotado); Divinity `Bonus_MAJOR` com `GemItemsPurchased[9]` e a regra do Polytheism; `prayersReal` com o ramo "nenhuma prayer equipada + Super Bits 9/39/53" (helper novo, também do Multikill); `chipBonuses(key)` por personagem sobre `Lab[1+ci]` (helper novo); flurbo 7 e roo 5 extraídos do `coin.ts` (como o `votingMulti` do EXP); `bun_u`; mérito W2 (`Tasks[2][1][2] > ci`); compass 57 pelo `compassBonus` do plano do EXP. Detalhes na Arquitetura. | O VOID_SET vale −10 pts provados no save. As outras só aparecem em contas mid-game, mas sem elas a página erra calada nessas contas. Funções novas, porque as antigas alimentam o DR: `getSetBonus("SECRET_SET")` na comida dourada, `hasBonusMajor(…, 2)` no `talent.ts`. O `computeChipBonus` de hoje soma os chips de todos os chars (escopo errado para `chipBonuses`). |
| A5 | **Shrine 8:** mesma simplificação do DR e do EXP, tratado como sempre ativo. | Igual ao D8 do EXP. No N.js o gate é o artefato Moai Head (Sailing 0), o mapa do próprio shrine ou o mesmo mundo com Mainframe 5. Com Moai Head (endgame) ele é global de verdade. No save vale 6,075 pts (0,07% do Σ). |
| A6 | **Mapa do coletor:** por save, o mapa de **luta** (`MapAFKtarget` com AFKtype `FIGHTING`) com o maior arcane slot 2 (`MapBon[m][2]`), sem 216 e 306; empate vai para o menor índice. Se nenhum mapa tiver kills no slot 2: o mapa do próprio char se for de luta, senão 301. Candidatos: #1 de cada board + top 10 do board `afkTime` ("AFK Time", que existe em `web/lib/registry.ts`). | Entre mapas de luta, o arcane₂ é o único termo que muda (o shrine é tratado como global; 216 e 306 nunca são pico). Na conta do save o mapa pesa ×1,30: 549,68 no mapa 1 contra 422,32 no 14. O 301 é o `BEST_MAP` do Coin (primeiro mapa de luta do W7). O `afkTime` é o board de quem mais joga AFK. |
| A7 | **Oráculo:** `getAfkGain(character, characters, account)` do IT (`parsers/character.ts:3164`), com seus 3 bugs provados: base/100, `etc59` sem `account` e comida dourada 7,99 pts abaixo. Os testes comparam termo a termo e com o valor reconciliado **422,3187 → "42231%"** (Markhe, mapa 14), não com o total cru do IT (418,9473). | Com os 3 bugs corrigidos e o VOID_SET, o IT dá exatamente 422,3187, e os outros 38 termos batem com o arkh a 1e-4. O total cru do IT está errado por construção. A âncora externa final é a leitura do jogo. |
| A8 | **Branch e PR:** `feat/afk-gains-page` empilhado em `feat/exp-multi-page`; PR próprio; merge só com o usuário. | Precisa do kit, que ainda está sendo implementado no branch do EXP. |
| A9 | **Tipo do alvo AFK** = o do alvo padrão do mapa selecionado (`MONSTERS[MapAFKtarget[mapa]].AFKtype`), nunca o `AFKtarget_N`. `Nothing`, `Paying_Respect` ou alvo sem definição → **0%**, como o AFK Info. O mapa 216 com caverna 17 conta como luta. Alvo de skill → a taxa de luta, com nota na árvore. | A página é what-if por mapa, e o `AFKtarget_N` só descreve o mapa salvo (nem está no loader). É a mesma escolha do D1 do EXP. Nos mapas de luta os dois coincidem (Markhe: mapa 14 → `beanG`). A Cove mostra `AFKgainrates("Fighting")` (@11987854), mesmo com `MapAFKtarget[216] = "Nothing"`. |
| A10 | **Gating por classe** do Observed Max: talentos **79, 88, 268 e 448**. 621 (Tick Tock) e 650 (Rando Event Looty) ficam fora. | Pela `TALENT_TABS_BY_CLASS`: o 79 só está na aba Beginner (4 classes), o 88 na Warrior (7), o 268 na Archer (6) e o 448 na Mage (6). 621 e 650 são star talents das 23 classes. |
| A11 | **VOID_SET pelo sistema `setBonus`** (`w3/setBonus.ts`), que já faz OLA[379] ∪ peças equipadas (`checkSetEquipped`): basta a entrada `void` em `SET_DATA`. O `getSetBonus` não muda. | Realiza o A4 sem tocar no DR. O `getSetBonus` não tem o fallback de peças, e a comida dourada do DR lê `getSetBonus("SECRET_SET")`. |

## Fórmula (fonte da verdade: N.js vivo)

`k._customBlock_AFKgainrates(d)` com `d = "Fighting"` (@4421667, 10.242 caracteres; N.js vivo sha256 `6de681a96813`, o mesmo do port do Coin e de `web/data/njs-snapshot/meta.json`). O updater já rastreia a função em `web/data/njs-snapshot/formulas.json`, e o sistema novo leva a tag `// @njs _customBlock_AFKgainrates`. Parênteses conferidos no texto cru (`scratchpad/afk/afkfn.txt`).

Ordem de avaliação no N.js:
1. `ALL = 2` se `Tasks[2][1][2] > ci` (mérito W2 "+2% AFK Gains for your first {} characters"), senão 0.
2. O pré-bloco de skill (`FamBonusQTYs["50"] + 2 + Card(46) + …`) só roda quando `d ≠ "Fighting"`.
3. `ALL += arcade6 + compass57 + voidSet + flurbo7 + 30·divMajor + divMinor5 + comp6 + comp25 + shrine8 + talent650 + winBonus11 + goldFood + 1,5·cardW6d3 + roo5 + vote6 + 20·eventShop5 + vault23`.
4. `MULTI = (1 + arcane₂/100) × (1 + Etc92/100)`.
5. `ALL += 30` se `bun_u == 1`. Vem depois do MULTI, mas antes da soma da luta, então conta.
6. `v = (0,4 + (fam8 + box + T88 + bribe3 + T268 + cardSet10 + T448 + T621 + ALL + card43 + T79 + etc20 + etc59 + star + guild4 + prayer4 − curse12 + chip + cardW6d1)/100) × MULTI`.
7. Mapa 306: `v = 0,2 × (a mesma conta)`.
8. Mapa 216 com `Holes[0][ci] == 17`: `v = Holes2("Cglunko_AFKgains") × (1 + 30·min(1, bun_u)/100)`. `Cglunko_AFKgains = (10 + Cglunko_upgBon(8) + Cglunko_upgBon(13))/100` (@10969315), com `Cglunko_upgBon(i) = OLA[630+i]·RandoListo2[13][i]` (@10969789).
9. `rate = max(.01, v)`. O piso vem por último, depois das duas substituições.

Na forma da página:

```
rate = max(.01, v)
v    = Cove                        no mapa 216 com Holes[0][ci] = 17
     = 0.2 × Σ/100 × G2 × G3        no mapa 306
     = Σ/100 × G2 × G3              nos demais
Σ    = 40 + Σ_ALL + Σ_luta
G2   = 1 + arcane₂/100
G3   = 1 + Etc92/100
Cove = (10 + OLA[638]·RandoListo2[13][8] + OLA[643]·RandoListo2[13][13])/100 × (1 + 30·min(1, bun_u)/100)
```

Com alvo `Nothing`/`Paying_Respect` a página mostra 0% (A9).

**Nós da árvore**, na ordem. Os ids são os da pesquisa (`scratchpad/afk/research.md`, §3); dentro de cada pool, ordem do N.js.

| # | Nó (nome na árvore) | Fator | Fontes (ids, em ordem) |
|---|---|---|---|
| G1 | ⚔️ Fighting AFK pool | Σ/100 | pool `fight`: `base` (40), `fam8`, `boxFightAFK`, `talent88`, `bribe3`, `talent268`, `cardSet10`, `talent448`, `talent621`, `card43`, `talent79`, `etc20`, `etc59`, `starFightAFK`, `guild4`, `prayer4`, `curse12` (**negativo**: maldição), `chipFafk`, `cardW6d1`; pool `all`: `merit`, `arcade6`, `compass57`, `voidSet`, `flurbo7`, `divMajor` (×30), `divMinor5`, `comp6`, `comp25`, `shrine8`, `talent650`, `winBonus11`, `goldFoodAllAFK`, `cardW6d3` (×1,5), `roo5`, `vote6`, `eventShop5` (×20), `vault23`, `bunU` |
| G2 | 🗺️ Arcane map bonus (slot 2) | 1 + x/100 | pool `multi`: `arcaneMapAfk` = `min(bonMAX, ArcaneMapMulti(MapBon[mapa][2]))`, por mapa |
| G3 | 🎽 AFK Gains multi gear (Etc 92) | 1 + x/100 | pool `multi`: `etc92` |
| R1 | 🦪 Clamworks ×0.2 (map 306) | × fonte | pool `rules`: `clamworks306` = 0,2 no mapa 306, senão 1 |
| R2 | 🏝️ Crystal Glunko Cove (map 216, cavern 17) | substitui | pool `rules`: `cglunkoCove` = a taxa da Cove quando ativa, senão 0 |
| R3 | 🎯 AFK target type | × fonte | pool `rules`: `afkType` = 1 (luta, ou a Cove) ou 0 (`Nothing`, `Paying_Respect`, sem definição) |

A raiz "AFK Gains Rate" vale `R3 × max(.01, R2 > 0 ? R2 : G1·G2·G3·R1)`, com a nota "max(1%, ·)".
- `base` ("Base fighting rate (40%)") e `afkType` são ids novos, fora da pesquisa: a base como fonte (A3) e o tipo do alvo (A9).
- No G1, `fight` vem antes de `all`. O N.js soma o `ALL` no meio da luta (depois do `talent621`), o que não muda a soma. Com os pools separados, um ramo de skill futuro troca só o `fight` (base 50 + termos do ramo) e acrescenta o pré-bloco.
- R1–R3 têm nomes fixos (o tipo e o monstro vão na nota), para os caminhos da árvore não mudarem com o mapa. Snapshots e Observed Max comparam por caminho.

**Cobertura no arkh** (41 termos: 27 EXISTS, 5 GENERIC, 5 PARTIAL, 4 MISSING; inventário completo, com helper e status por termo, na pesquisa, §3):
- **A maioria já existe** e só precisa de um `case`: arcade, divinity minor, companions, talentos (inclusive o `TalentCalc` do 650), win bonus, comida dourada, cartas, event shop, vault, arcane por mapa, etc bonus, family bonus, post office, bribe, card set 10, guild e a maldição da prayer 12.
- **O que falta ou diverge**, e como entra:

  | Termo | Status | Como entra |
  |---|---|---|
  | `merit` | MISSING | inline: `tasksGlobalData[2][1][2] > ci ? 2 : 0` |
  | `compass57` | MISSING | `compassBonus(57, s)` do plano do EXP: `Compass[0][57]·CompassUpg[57][5]`, 0,2 por nível (`CompassUpg[57][9] = 0`, sem o fator das bússolas 39/80) |
  | `clamworks306` | MISSING | regra R1 |
  | `cglunkoCove` | MISSING | porte novo, inline no sistema (R2) |
  | `voidSet` | PARTIAL | A11 |
  | `divMajor` | PARTIAL | função nova `bonusMajorReal` |
  | `shrine8` | PARTIAL | continua sem gate (A5) |
  | `starFightAFK` | PARTIAL | função nova `starSignBonusReal("FightAFK", …)` |
  | `prayer4` | PARTIAL | função nova `prayersReal(4, 0, …)`. O `curse12` usa a mesma (`prayersReal(12, 1, …)`), que dá 0 no ramo dos super bits, igual ao de hoje |
  | `flurbo7` | GENERIC | `flurboShop(7, s)`, extraído do `flurbo4` do Coin |
  | `roo5` | GENERIC | `rooBonus(5, 0.5, s)`, extraído do `roo6` do Coin |
  | `vote6` | GENERIC | `votingBonusz(6, votingMulti(ctx), s)`; o plano do EXP extrai o `votingMulti` |
  | `bunU` | GENERIC | inline: `bun_u == 1 ? 30 : 0` |
  | `chipFafk` | GENERIC | função nova `chipBonuses("fafk", ci)` |

- **Com cuidado extra:**
  - `etc59` já vem certo do arkh (719,56, com o chip Silkrode ×2 e o Well-Dressed). É o termo em que o IT erra (699,26 sem `account`).
  - `goldFoodAllAFK` usa o multi de comida dourada do arkh, validado ao centavo no DR (PR #28).
  - `fam8` depende do buff do Family Guy (talento 144) do char ativo, que o `computeFamBonusQTYs` já aplica (PR #26).
  - `roo5` tem coeficiente 0,5 e offset 5; o `roo6` do Coin usa 3 e 6 (`RooBonuses` @10827396).
  - `vote6` só vale com o voto 6 ativo no servidor (`activeVoteIdx`). No save, o voto ativo é o 32.
  - Talentos: `talent.resolve(id, …)` já devolve o valor embrulhado. Nunca multiplicar por contador de novo.

## Exibição no jogo

| Onde | Condição | Texto |
|---|---|---|
| AFK Info, 5ª linha `AFK_GAINS_RATE` (rótulos em `Ia.AFKdescriptions` @14749087) | alvo com AFKtype `Nothing` ou `Paying_Respect` | `"0%"` literal |
| idem | alvo `FIGHTING` | `⌊100·rate⌋ + "%"`, com `_AFKnumberCalcs[3] = AFKgainrates("Fighting")` (@3790178) |
| idem | alvo de skill | `⌊100·AFKgainrates("<Skill>")⌋ + "%"` (fora do escopo) |
| Painel da Cove ("THE_COVE", @11987854) | `rate < 1` | `⌊1000·rate⌋/10 + "%"` (uma casa decimal) |
| idem | senão | `CommaNotation(100·rate) + "%"` |

- O tipo vem de `MonsterDefinitionsGET[AFKtarget].AFKtype` (despacho @3786279).
- O valor é o cru de `AFKgainrates`. A comida não mexe na taxa (`AFKfoodsTimeRedux` só encurta o tempo AFK no resgate), e `afkAttackBonses` alimenta o `HourlyKillRate`, não a taxa.
- Nas formas Wraith (Death Bringer) e Tempest (Wind Walker) as primeiras linhas viram os literais 0–4. Pelo código, a taxa não aparece nessas formas (inferido).
- **Na página** vale o formato do AFK Info em todos os mapas, inclusive na Cove (decisão: um formato só; a Cove difere só na exibição). `formatAfkGains(v) = ⌊100·v⌋`, e o kit acrescenta o "%". Markhe: 422,3187 → "42231%". O float segue o JS do jogo (`Math.floor(100*v)`, igual ao N.js).
- A raiz da árvore fica em `x`: 422,319x = 42231%.

## Arquitetura

### 1. Motor (`web/lib/arkh`)

- **Descritor próprio** `stats/defs/afk-gains.ts`:
  - `AFK_ROOT = "AFK Gains Rate"`;
  - `AFK_POOLS: readonly StatGroup[]`: `fight` (base + 18), `all` (19), `multi` (2) e `rules` (3), com os ids da tabela. O `kind` só serve ao coletor (valor neutro de um talento zerado): `pct` nos três primeiros, `mult` em `rules`;
  - `afkRate({ sum, arcane, etc92, clam, cove, type })`: função pura, a **única cópia** da conta, usada pelo `combine` e pelo `totalFromFlat`;
  - o `combine` monta G1 (filhos `fight` + `all`, val Σ/100), G2 e G3 (`1 + x/100`) e as regras R1–R3 como filhos diretos da raiz;
  - o `combine` não lê o `ctx`, porque o coletor o chama sem contexto (`combineStatPools`). Tudo o que depende do mapa chega como fonte do pool `rules`.
- **Sistema** `stats/systems/afk/afk.ts`: `resolveAfk(id, ctx)`, um `case` por termo, com a tag `@njs`, no mesmo molde do `coin.ts`. Registrado como `afk` no `registry.ts`, depois do `exp`.
  - Mapa = `ctx.mapIdx`, ou o `CurrentMap` salvo do char.
  - Os talentos usam `label("Talent", id)`, porque o gating casa o sufixo "(Talent N)".
  - Exporta `AFK_CLASS_TALENTS = [79, 88, 268, 448] as const` (A10).
  - Regras:
    - `clamworks306` = `map === 306 ? 0.2 : 1`;
    - `cglunkoCove` = `map === 216 && holesData[0][ci] === 17 ? Cglunko_AFKgains·(1 + 30·min(1, bun_u)/100) : 0`;
    - `afkType` segue o A9 (`MONSTERS` de `data/game/monsters.js`, `MapAFKtarget` de `customlists.js`).
  - Nenhuma chave nova no loader. O `AFKtarget_N` não é usado (A9), e o resto já está exposto (pesquisa, §4).
- **Correções do A4**, todas com funções ou entradas novas. As funções antigas e seus chamadores não mudam.

  | Correção | Onde | O que faz (N.js) | Reuso |
  |---|---|---|---|
  | VOID_SET | `w3/setBonus.ts`: entrada `void` em `SET_DATA` (+ nome "Void Set Bonus") | `setBonus.resolve("void")`: OLA[379] (CSV) ∪ peças equipadas; valor `EquipmentSets.VOID_SET[3][2]` = 10 (`GetSetBonus` @11008519) | — |
  | Divinity major | `w5/divinity.ts`: `bonusMajorReal(ci, tipo, s)` | `hasBonusMajor` ∪ (`GemItemsPurchased[9] == 1` e tipo 0) ∪ Polytheism: com `Divinity[ci+12] ≠ −1` e `g = SL505 − 10·⌊SL505/10⌋` (nível do talento 505 do char), vale se `GodsInfo[g][13] == tipo` e `Divinity[25] > g` (@10683007) | — |
  | Prayers | `w3/prayer.ts`: `prayersReal(idx, custo, ci, s)` | sem prayer equipada (`Prayers_ci` todo −1) e com o Super Bit 9 ou o 39: `round((0,2·SB9 + 0,2·SB39 + 0,2·SB53)·PrayerInfo[idx][3]·max(1, 1 + (lv−1)/10))`, só para `idx ≠ 5`, custo 0 e prayer desbloqueada; maldição dá 0. Senão, o ramo equipado de hoje (@7774914) | Multikill |
  | Chips | `w4/lab.ts`: `chipBonuses(key, ci)` | Σ `ChipDesc[c][11]` dos chips do `Lab[1+ci]` com `ChipDesc[c][10] == key` (@5139280) | Multikill |
  | Flurbo, Roo | `coin/coin.ts`: exporta `flurboShop(idx, s)` e `rooBonus(idx, coef, s)` | `DungPassiveStats2[idx]` no nível `DungUpg[5][idx]`; `coef·(1 + Legend26/100)·(1 + Comp51)·(1 + RooBonusAll/100)·max(0, ⌈(OLA[271] − idx)/7⌉)` (@10827396). O `flurbo4` e o `roo6` do Coin passam a chamar os dois, com a mesma conta | EXP (`flurbo2`) |
  | Voting, Compass | do plano do EXP: `votingMulti(ctx)` e `compassBonus(idx, s)` | `votingBonusz(6, votingMulti(ctx), s)` (@10874564); `compassBonus(57, s)` (@10989794) | — |
  | Mérito W2, `bun_u` | inline no `afk.ts` | `Tasks[2][1][2] > ci ? 2 : 0`; `bun_u == 1 ? 30 : 0` | — |

  **Star signs ativos**: `common/starSign.ts`, `starSignBonusReal(key, ci, s)` + tabela `STAR_SIGN_TERMS` por chave (N.js `_customBlock_StarSigns` @6490716). Reusado pelo Multikill.
  1. DL = signos equipados (`PVtStarSign_ci`, CSV) ∪ índices `k < enabled` cujo nome `StarSigns[k][0]` está em `StarSignsUnlocked`, com `enabled = getEnabledStarSigns(s)`.
  2. Soma os termos da chave cujo signo está em DL e passa no gate. `FightAFK`: 19 → +2; 28 → +6; 29 → −6 se `29 ≥ enabled`; 54 → −7 se `54 ≥ enabled`; 56 → +4 se o nível de classe > 99.
  3. 2ª passada (@6491933), só com o star chip no char (`chipBonuses("star", ci) == 1`) e `enabled < 1`: soma de novo os termos dos signos equipados, com os mesmos gates, a não ser que o total da 1ª passada seja negativo (o N.js guarda os negativos e os restaura).
  4. Seraph (@6514021): valor positivo × `computeSeraphMulti(ci, s)`, que já tem o star chip ×2 com `enabled ≥ 1`, o Meritoc 22 e `min(5, (1,1 + min(Arcane[40], 10)/100)^⌈(Lv0[18]+1)/20⌉)`, e dá 1 sem `Seraph_Cosmos`.
- **Entrada** `lib/arkh/computeAfk.ts`: `computeArkhAfkGains(raw, ci, map?)`, `computeArkhAfkPools(raw, ci, map?)` e `combineAfkPools(pools)`, embrulhos finos do `computeStat.ts`, mais `bestAfkMapIdx(raw, ci)` (seção 3).

### 2. Página no kit (config)

| Arquivo | Papel |
|---|---|
| `lib/afkGains/pageConfig.ts` | `AFK_PAGE: StatPageConfig`, o `GainsModel` próprio e `formatAfkGains` |
| `lib/afkGains/topAfkGains.ts` + `.meta.ts` | Observed Max gerado, carregado sob demanda |
| `app/afk-gains/page.tsx` + `AfkGainsPageClient.tsx` | Cascas: `<StatPageClient config={AFK_PAGE} />`, metadata com o título "AFK Gains Tracker" |

- `formatAfkGains(v) = Number.isFinite(v) ? String(Math.floor(100 * v)) : "—"`. Uma linha não justifica um `format.ts` próprio, como o do EXP.
- **GainsModel próprio** (D10 do EXP):
  - `sources()` lista os filhos diretos de G1, G2 e G3, com exibição `pct`, pelo `directChildren` do kit. As regras R1–R3 ficam fora: dependem do mapa, não de progresso;
  - `totalFromFlat(flat)` monta as partes pelos caminhos da árvore e chama o mesmo `afkRate` do descritor;
  - a base 40 entra na lista, mas é igual para todos, então nunca vira linha.
- **Opção nova do kit: `unit`** (A2), campo opcional de `StatPageConfig`, padrão `"x"`. Biggest Gains e Compare não mudam.

  | Lugar | `"x"` (hoje) | `"%"` |
  |---|---|---|
  | Número principal da calculadora | `formatTotal(total) + "x"` | `formatTotal(total) + "%"` |
  | `title` do número | `total.toExponential(6) + "x"` | `(100·total).toFixed(2) + "%"` |
  | Aviso de snapshot salvo | `… {formatTotal(v)}x on …` | `… {formatTotal(v)}% on …` |
  | Valor na tabela de snapshots | `<Num value unit="x" />` | `formatTotal(value) + "%"` |

- **Config**:

  | Campo | Valor |
  |---|---|
  | `statName` / `gainLabel` | "AFK Gains Rate" / "AFK" |
  | `emoji` / `calculatorTitle` | "💤" / "AFK Gains Calculator" |
  | `totalLabel` | "AFK Gains Rate (Fighting)" |
  | `unit` / `formatTotal` | `"%"` / `formatAfkGains` |
  | `errPrefix` | "AFK gains compute failed" |
  | `compute` | import dinâmico de `@/lib/arkh/computeAfk` → `computeArkhAfkGains` |
  | `storage` | `afk-gains-tracker.last-upload.v1`, `afk-gains-tracker.playerName`, `afk-gains-tracker.v1`, `afk-gains.snapshot-section.collapsed.v1`; export `afk-gains-snapshots` / `afk-gains-tracker`; sem `legacyValueKey` |
  | `mapTitle` | "The map sets the Arcane map bonus (slot 2), Clamworks' ×0.2 (map 306), the Crystal Glunko Cove (map 216) and whether the map's AFK target is a fight" |
  | `methodologyNote` | a do EXP, dizendo que cada top player é medido no seu melhor mapa de Arcane AFK (slot 2), então essa linha reflete a escolha do mapa |

### 3. Observed Max + cron

- **`scripts/update-top-afk.ts`**, config do coletor compartilhado (`runTopCollector`):
  - `label: "AFK Gains Rate"`, `focusBoard: "afkTime"`, `root: AFK_ROOT`, `groups: AFK_POOLS`;
  - `computePools: (save, ci) => computeArkhAfkPools(save, ci, bestAfkMapIdx(save, ci))`, `combine: combineAfkPools`;
  - `gated: deriveGatedTalentsFor(AFK_CLASS_TALENTS)`;
  - saída `lib/afkGains/topAfkGains.ts` + `.meta.ts`, `constPrefix: "TOP_AFK"`, `flatForClassFn: "topAfkFlatForClass"`, `scriptName: "scripts/update-top-afk.ts"`.
- **Valor neutro.** Os talentos com gate estão todos no pool `fight` (aditivo), então um talento zerado vale 0.
- **Melhor valor por fonte.** O coletor fica com o maior valor de cada fonte. No `curse12` (negativo), é o mais perto de 0, e o Biggest Gains mostra quanto a maldição da Ruck Sack custa. As regras ficam neutras (R1 = 1, R2 = 0, R3 = 1), porque o mapa escolhido nunca é 216 nem 306.
- **`bestAfkMapIdx(raw, ci)`** (A6), no molde do `bestExpMapIdx`. O `buildMapOptions` do DR não serve, porque ranqueia pelo slot 0.

  ```
  candidatos = mapas m com MONSTERS[MapAFKtarget[m]]?.AFKtype == "FIGHTING", m ∉ {216, 306}
  score(m)   = computeArcaneMapMultiBon(2, { ...ctx, mapIdx: m })   // já com o teto bonMAX
  melhor     = argmax score; empate → menor índice
  score(melhor) == 0 → CurrentMap do char se for candidato, senão 301
  ```

- **Cron:** passo novo no `.github/workflows/refresh-top-max.yml`, depois do passo do EXP (`continue-on-error`, timeout 12, `npx tsx scripts/update-top-afk.ts`), com os dois arquivos gerados na lista do commit. O nome do workflow e a mensagem do commit passam a citar o AFK.

### 4. Navegação

- `components/TopNav.tsx`: `{ href: "/afk-gains", label: "💤 AFK Gains" }` logo após o EXP Multi.
- `app/page.tsx`: card "AFK Gains Tracker" depois do card do EXP.
- e2e da home e teste do TopNav: item e card novos.

## Testes e validação

- **Smoke** (CI, sem save privado):
  - num envelope vazio, todas as fontes resolvem (o `switch` lança erro em id desconhecido);
  - no mapa 1 a taxa é só a base, 0,4 → "40%"; no mapa 0 (cidade, alvo `Nothing`), 0;
  - todos os saves de top players em cache calculam um total finito para todos os chars.
- **Save** (privado, `describe.skipIf`, pulado no CI): Markhe (índice 8) no mapa 14, `web/scripts/updater/golden/.cache/arkhe-live-2026-09-23.json`, termo a termo contra o IT reconciliado (A7). O teste usa os valores do oráculo em precisão total; aqui, arredondados:

  | Pool | Termos ≠ 0 | Σ |
  |---|---|---|
  | `all` | merit 2; arcade6 8,040; compass57 10,8; voidSet 10; flurbo7 5; divMajor 30; divMinor5 268,98; comp6 8 (LV2); comp25 50; shrine8 6,075; talent650 2,5; winBonus11 212,94; goldFoodAllAFK 5500,84; cardW6d3 10,5; roo5 1361,25; eventShop5 20; vault23 59,1; bunU 30 (vote6 = 0) | 7596,025 |
  | `fight` | base 40; fam8 4,37; boxFightAFK 8,478; talent88 18,617; bribe3 5; talent621 6,340; etc20 62,58; etc59 719,56; starFightAFK 120 (12 × Seraph 10); guild4 5; curse12 −89; cardW6d1 7 (os demais, 0) | 907,945 |
  | `multi` | arcaneMapAfk 0; etc92 396,61 | G2 = 1; G3 ≈ 4,9661 |

  G1 = 8503,97/100 = 85,0397, e o total é **422,3187 → "42231"**. Onde o IT diverge, vale o N.js, com comentário `// N.js ≠ IT:` no teste:
  - base/100: o IT faz `((0,4 + S)/100)·MULTI`, −0,396·MULTI = −1,9666;
  - `etc59`: IT 699,26 (sem `account`), −20,30 pts;
  - `goldFoodAllAFK`: IT 5492,85, −7,99 pts.

  Os três somam −3,3715 → 418,9472, o total do IT (418,9473). No `voidSet` o IT está certo (10); o arkh de hoje dá 0 (421,822, "42182%").
- **Cenários de mapa** (mesmo save, Markhe):
  - mapa 1: arcane₂ 30,16 → G2 = 1,3016 → 549,68 → "54968";
  - mapa 306: ×0,2 → 84,4637 → "8446";
  - mapa 0 (cidade, alvo `Nothing`): 0 → "0%", e o Biggest Gains fica vazio;
  - `bestAfkMapIdx` = 1 (o slot 2 só tem kills nos mapas 1, com 441.562, e 156, com 37).
- **Correções do A4** (saves sintéticos):
  - star signs: signo 54 equipado com `enabled ≤ 54` dá −7; signo 56 num char de nível 99 dá 0; star chip com `enabled = 0` dobra os positivos equipados e não mexe num total negativo; Seraph só em valor positivo;
  - VOID_SET: peças equipadas sem OLA[379] → 10;
  - `prayersReal`: sem prayer equipada e com SB9 → `round(0,2·base·escala)`; maldição → 0; prayer 5 → 0;
  - `chipBonuses`: o chip `fafk` de outro char não conta;
  - `bonusMajorReal`: `GemItemsPurchased[9]` liga o tipo 0; regra do Polytheism;
  - Cove: mapa 216 com `Holes[0][ci] = 17` → `(10 + OLA[638]·RandoListo2[13][8] + OLA[643]·RandoListo2[13][13])/100`, ×1,3 com `bun_u`; caverna ≠ 17 → alvo `Nothing` → 0.
- **GainsModel:**
  - `totalFromFlat(flatten(árvore))` = total da árvore (1e-12) nos mapas 14, 1, 306 e 0;
  - +100 pts num termo do G1 dá +1,1759% (100/8503,97), também no mapa 306;
  - com a Cove ativa ou alvo `Nothing`, não sai linha.
- **Kit:**
  - `unit: "%"` no número principal ("42231%"), no aviso e na tabela de snapshots;
  - sem `unit`, "x" como hoje (os testes do Coin e do EXP não mudam);
  - `deriveGatedTalentsFor([79, 88, 268, 448])` → os quatro; `deriveGatedTalentsFor([621, 650])` → `[]`.
- **DR, Coin e EXP protegidos**: regressão do DR (363.893,46), `coin-multi.save` (6,88E35, agora com `flurboShop`/`rooBonus` extraídos) e os testes do EXP, todos verdes.
- **Jogo**: o AFK Info (AFK GAINS RATE) do Markhe bate com a página, com save fresco obtido **sem login quando possível** (perfil público do IT ou "Copy for Support" colado). No save em cache (23/09), o esperado é 42231%. **Validado em 24/09/2026** com save fresco: Markhe no mapa 14 = **58870%** (motor 588.7052987540884).
- **Verificação**: `tsc --noEmit` + vitest + preview da Vercel; **nunca** `npm run dev`.
- **Critério de pronto**: bater a leitura do jogo, na mesma formatação da tela.

## Entrega

- Branch `feat/afk-gains-page`, criado da ponta de `feat/exp-multi-page` depois do SDD do EXP. Este spec vai para `docs/superpowers/specs/2026-09-24-afk-gains-page-design.md` nesse branch.
- Plano em `docs/superpowers/plans/2026-09-24-afk-gains-page.md`; execução por subagentes.
- PR próprio com base `feat/exp-multi-page` (vira `main` quando o EXP entrar). Merge na `main` só com ordem explícita do usuário.

## Fora de escopo

- Ramos de skill: Mining, Choppin, Fishing, Catching, Cooking, Laboratory, Divinity (constante 1), Spelunking e Research. São ≈46 termos a mais; os pools `all` e `multi` já ficam prontos para um seletor.
- Consertar o caminho de star sign do DR (`starSign "drop"` e `computeStarSignBonus`, que somam os signos sem checar equipado ou desbloqueado). Follow-up anotado; o `starSignBonusReal` já serve para ele.
- Migrar os outros chamadores para as funções corrigidas:
  - `getSetBonus` (SECRET_SET, EMPEROR_SET, COPPER_SET, GOLD_SET);
  - `hasBonusMajor` (tipo 2, no `talent.ts`);
  - `computePrayerReal` (Coin e `derived-stats`);
  - `computeChipBonus` (soma a conta toda).

  Mudam números do DR e do Coin e pedem validação própria.
- O gate de mapa do Shrine 8 (A5).
- O formato próprio do painel da Cove, a taxa da aba Research do Player Info e as formas Wraith/Tempest.
- As outras linhas do AFK Info (kills, dinheiro e EXP por hora, sobrevivência): `HourlyKillRate × rate × Survivability% × KillPerKill`.
- Corrigir os 3 bugs no IT.
- Migrar a página de DR para o kit.

## Riscos e pontos em aberto

1. **Star signs em contas mid-game.** O save de validação não exercita a correção: no Markhe (`enabled ≥ 57`, nível 120) o caminho antigo e o novo dão os mesmos 120. Só os testes sintéticos cobrem o −7 do signo 54, os gates de nível e a 2ª passada do star chip. O próprio `getEnabledStarSigns` (rift ≥ 10 → 5 + Shiny 3) não é revalidado aqui.
2. **Qualidade do oráculo.** O total do IT está errado por 3 bugs (A7), então o teste depende da reconciliação termo a termo. A âncora externa é a leitura do jogo: 42231% no save de 23/09 (usado nos testes) e, validado no jogo em 24/09/2026 com save fresco, 58870% (motor 588.7052987540884) — o motor bateu com o jogo nas duas leituras.
3. **Sensibilidade.** Comida dourada (5500,84) e canguru (1361,25) somam 6862,09 pts: ≈81% do Σ do G1, ≈90% do `ALL`. Um erro de escala neles aparece no total, não como detalhe. A comida dourada do arkh é a validada ao centavo no DR (PR #28), e o `rooBonus` é a mesma conta do `roo6` do Coin (validado em 6,88E35).
4. **Cove.** É caso de borda (char fazendo AFK na caverna 17). Não há oráculo: o `getCglunkoAfkGains` do IT não está ligado e não tem o ×1,3 do `bun_u`. Vale só a leitura do N.js e um teste sintético. O painel da Cove formata diferente (Exibição no jogo).
5. **Tipo do alvo (A9).** No mapa salvo, o painel usa o `AFKtarget_N` real; a página usa o alvo padrão do mapa. Os dois só divergem fora da luta (ex.: o minério escolhido num mapa de mineração), que já está fora do escopo. Com alvo `Nothing`/`Paying_Respect`, o total 0 esvazia o Biggest Gains, e a aba mostra a mensagem de "no comparable reference".
6. **Shrine 8 (A5).** Superestima contas sem Moai Head com o char fora do mapa ou do mundo do shrine. No save: 6,075 pts (0,07% do Σ).
7. **Save de validação**: o save em cache é de 23/09 05:25 UTC, e o jogo já andou. A leitura do usuário precisa de um save do mesmo momento (perfil público do IT ou "Copy for Support"), sem login.
8. **Dependência do kit.** Os nomes vêm do plano do EXP: `StatPageConfig`, `GainsModel`, `directChildren`, `computeStat.ts`, `topStatCollector.ts`, `votingMulti` e `compassBonus`. Se a revisão do EXP mudar algum, este branch rebaseia e ajusta.
9. **Primeira geração do `topAfkGains.ts`** depende da API de perfis do IT (rede). Se ela falhar, o PR sai com a referência gerada pelos saves de top players em cache (`web/scripts/updater/golden/.cache`), e o cron regenera.
