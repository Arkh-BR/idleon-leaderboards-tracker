# Página Multikill — Design Spec

**Data:** 2026-09-24
**Status:** rascunho autônomo da noite de 24→25/09/2026. O usuário foi dormir e delegou todas as decisões ("tome as decisões sozinho e anote"). Ele avalia tudo de manhã. As decisões estão na seção própria (M1–M19).
**Branch:** `feat/multikill-page`, empilhado no branch do AFK Gains, que sai do `feat/exp-multi-page`.
**Base:**
- o kit `statTracker` do spec do EXP (`docs/superpowers/specs/2026-09-24-exp-multi-page-design.md`): página por config, Biggest Gains por what-if (`GainsModel.totalFromFlat`) e coletor do Observed Max compartilhado;
- os helpers fiéis que o spec do AFK Gains introduz.

## Problema

O site já tem Drop Rate, Coin Multi e EXP Multi, esta última sobre o kit `statTracker`. O AFK Gains está a caminho. O usuário pediu a mesma análise para três stats, nesta ordem:
1. EXP Multi;
2. AFK Gains Rate;
3. **Multikill**.

Este spec cobre o Multikill.

O Multikill é o % de kills e recursos *extras* por kill no AFK de luta. A bolha MR_MASSACRE diz que "multikill is bigtime for resources". Ele entra:
- nas drops do AFK de luta (`× (1 + MK/100)`);
- no `KillPerKill` (kills extras do Death Note e dos portais);
- no MULTI-SCALPING do Clamworks (`MK/1000 · …`).

Hoje nada no site calcula o Multikill. O Coin só usa o damage tier, e só no talento 643. A fórmula tem duas coisas que as páginas anteriores não tinham:
- um **damage tier**, que compara o max damage com o HP do alvo do mapa;
- um **soft cap** no W7.

## Objetivos

- **Página "Multikill"** com paridade de funcionalidades com Coin e EXP: calculadora + árvore, snapshots, Compare vs Observed Max e 💡 Biggest Gains.
- **Valor igual ao do jogo.** O total é o `MultiKillTOTAL`, a linha "MULTIKILL: X%" do AFK Info. No char validado (Markhe) é 81706%.
- **Só motor + config.**
  - A página usa o kit do EXP e os helpers do AFK Gains sem redefinir nada.
  - A única mudança no kit é um gancho opcional (M13).
- **Tier honesto.** O tier depende do max damage, que ainda não está reconciliado com o jogo.
  - Fora do W7 isso não importa: o endgame fica no teto 51.
  - Abaixo do teto, o tier aparece como estimativa (M4, M17).
- **DR intocado; Coin só no talento 643.** O único efeito fora da página é a correção do talento 643 do Coin (maldições e HP do Clamworks), em commit separado. O Markhe continua 6,88E35 no Coin.

## Decisões do usuário (24/09/2026)

| Tema | Decisão |
|---|---|
| Stats e ordem | EXP Multi → AFK Gains Rate → **Multikill**. |
| Funcionalidades | **Mesma estrutura do Coin**: calculadora + árvore, snapshots, Compare vs Observed Max, Biggest Gains (herdado do spec do EXP). |
| Abordagem | **Kit genérico** `statTracker` (abordagem B do EXP): o Multikill é motor + config. O DR fica como está. |
| Fidelidade | Responsabilidade do Claude: N.js + oráculo do IT termo a termo + uma leitura do jogo no fim. O usuário não valida fórmula, só decisões de produto. |
| Autonomia | Noite de 24/09: "continua fazendo a mesma coisa para o multikill e o afk gains rate. tome as decisões sozinho e anote". |
| Entrega | PR próprio; merge na `main` só com ordem explícita do usuário. |

O texto do site é em inglês.

## Decisões autônomas (noite de 24→25/09/2026)

Tudo abaixo foi decidido pelo Claude e será avaliado pelo usuário. M1–M10 são as decisões de produto e de arquitetura. M11–M19 detalham o que apareceu ao desenhar a página.

| # | Decisão | Por quê |
|---|---|---|
| M1 | **Headline** = `WorkbenchStuff("MultiKillTOTAL")`, a linha "MULTIKILL: X%" do AFK Info, por char e mapa.<br>• Mapa padrão: o mapa salvo do char.<br>• Alvo: `AFKtarget_N` no mapa salvo e `MapAFKtarget[mapa]` nos outros, a mesma regra do talento 643 do Coin.<br>• Exibição como no jogo: `⌊MK⌋ + "%"`, sem separador (Markhe: 81706%).<br>• Rota `/multikill`, título "Multikill Tracker", menu "💥 Multikill" depois do AFK Gains. | É o número que o jogador compara e o que as mecânicas consomem (drops do AFK, `KillPerKill`, MULTI-SCALPING). O tier é secundário e preso ao mapa, e fica no teto 51 fora do W7. O N.js mede contra o `AFKtarget` vivo, que no load é o `AFKtarget_N` salvo. |
| M2 | **Árvore** com raiz `⌊B′ + T × P′⌋` e **descritor próprio** (não o `groupedDescriptor`). Três nós:<br>• "Base Multikill": 9 fontes, mais a linha do soft cap do W7 quando o mapa é ≥ 300;<br>• "Damage Tier": T de 1 a 51, com filhos max damage, HP do alvo (estático × fator de maldição), expoente E e limiares atual e próximo;<br>• "Multikill per Tier": 18 fontes, mais a linha do soft cap.<br>Casos especiais:<br>• o override do Crystal Glunko Cove (mapa 216 + cavern 17) substitui as duas metades por `OLA[645]·RandoListo2[13][15]` e `OLA[636]·RandoListo2[13][6]`;<br>• no Clamworks (mapa 306), o HP do alvo é `1e16·30^OLA[464]`;<br>• a flag `OverkillStuffs("3")` vira uma linha de status. Ela exige max ≥ HP·E, o Death Note construído (`TowerInfo[2] > 0,5`) e precisão > 1,5× a defesa do alvo.<br>O headline é sempre o `MultiKillTOTAL`. | A fórmula não é produto de grupos: é linear no tier, com soft cap em cada metade e override. A função devolve o número mesmo com a flag desligada; o jogo só esconde a linha. |
| M3 | **Biggest Gains** por what-if com `totalFromFlat` próprio (soft cap, piso, T × P′).<br>• O tier é uma fonte cujo Observed Max é o melhor tier.<br>• "+1 tier" aparece como a alavanca grande, que pede ×E de max damage. | No W7 o soft cap (inclinação 1/50) achata o ganho de cada fonte, e +1 tier vale um P′ inteiro. Fora do W7 as fontes per tier valem ×T (×51 no teto). |
| M4 | **Max damage** = `computeMaxDamage` do arkh.<br>• Fica 4–6×10⁴ abaixo do IT neste save.<br>• Fora do W7 não importa: todo endgame está no teto 51.<br>• No W7 move o tier (mapa 301: 24 no arkh, 30 no IT).<br>• O tier nos mapas do W7 é rotulado como estimativa até o usuário ler o "Max Dmg" no jogo. O painel de stats mostra `DamageDealed("Max")`.<br>• Reconciliar o max damage é follow-up, fora desta página. | Hoje não dá para saber quem acerta o jogo, e o max damage do arkh tem 16 sub-fontes `[STUB]`. O rótulo é honesto e não trava a página. |
| M5 | **Helper de tier compartilhado**: extrai o `multikillTier` do Coin, que já tem o laço certo e usa o `AFKtarget_N`.<br>• Acrescenta o fator de maldição no HP: `× (1 + (prayersReal(0,1) + prayersReal(7,1) + prayersReal(8,1))/100)`.<br>• O talento 643 do Coin passa a usar o mesmo helper. Isso corrige o Coin de quem tem essas maldições equipadas; vai em commit separado, e o Markhe continua 6,88E35 no teste do Coin.<br>• Nunca usar `derived-damage.ts:computeOverkillTier`. | O `MonsterRespawnTimeReset` (@6466652) multiplica o HP de todo monstro pelas maldições do char. Cada uma chega a +1475% no nível 50, ~4 tiers a menos com E = 2. O `computeOverkillTier` usa `MapAFKtarget` + gate `FIGHTING` e dá tier 1 aos 10 chars do mapa 216 deste save. |
| M6 | **Portar o que falta**:<br>• Salt Lick 8, reusando/generalizando o port do plano do EXP;<br>• Death Note por mundo, exportando o rank por mundo do `coin/gambit.ts`;<br>• minibosses (tabela 7842 sobre `Ninja[105]`);<br>• Measurement 9;<br>• soft cap do W7 e override do Cove;<br>• gate de equipar da MR_MASSACRE (companion 4 ou "c15" em `CauldronBubbles`);<br>• buffs 46/469 com os gates de classe e de buff;<br>• chip "mkill" por char;<br>• card 80, card set 11 e prayer 16 (com o ramo do super bit). | Paridade com o jogo. Os 14 termos que já existem são chamados como estão; os 4 genéricos só precisam de índice novo. |
| M7 | **Coletor num mapa fixo, o 251** (w6a1).<br>• Lá todo endgame está no tier 51, então `MK = B + 51·P` não depende do max damage.<br>• Troca para o 301 depois da reconciliação.<br>• Candidatos: #1 de cada board + top 10 do board mais ligado (M15). | O 301 é onde o endgame AFKa e é o mapa do coletor do Coin, mas lá o tier depende do max damage não reconciliado. O 251 evita o 300 (cidade) e os overrides do 216 e do 306. |
| M8 | **Oráculo** = IT `parsers/damage.ts`: `getMultiKillBase`, `getMultiKillPerTier`, `getMultiKillDiminished`, `getMultiKillTiers` e `getMonsterHpTotal`.<br>• Neste save, os 11 chars batem exato com arkh + stand-ins.<br>• Markhe (índice 8, mapa 14, `beanG`) = **81706%**: base 1063,45, per tier 1581,2331, tier 51.<br>• Lacunas do IT: não aplica o override do Cove e usa HP estático no Clamworks. | Mesmo método do EXP: termo a termo. Onde o IT diverge, vale o N.js, e o gap fica escrito no teste. |
| M9 | **Bugs laterais viram follow-up**:<br>• a letra da bolha ("d21" em vez de "c21" em `divinityMinor.ts:42` e `talent.ts:753,1394`);<br>• o escopo de todos os chars do `computeChipBonus`;<br>• o `computeOverkillTier`.<br>Onde esta página precisa do comportamento certo, ela usa os helpers novos (chip por char, helper de tier). | Consertá-los muda números do DR e do Coin fora desta página e pede validação própria. A página não depende deles. |
| M10 | **Branch empilhado no do AFK Gains**, com PR próprio; merge só com o usuário. | Reusa os helpers fiéis do AFK Gains (star signs ativos, `prayersReal` com super bit, chip por char) e a opção `unit` do kit. |
| M11 | A linha do **Death Note** no per tier leva o mundo no nome, por exemplo "Death Note (W6 page)". Assim, Biggest Gains e Compare só a comparam com a referência no mesmo mundo: W6, enquanto o coletor rodar no 251. | As páginas têm tamanhos diferentes: `DeathNoteMobs` tem 15/11/14/13/13/14/24 mobs, com tetos de 300/220/280/260/260/280/480. Comparar uma página W2 (teto 220) com a W6 (280) mostraria um ganho impossível. |
| M12 | O **tier** só é comparado com o Observed Max (51, medido no 251 com E = 2) em mapas < 300. No W7 (E = 5) ele aparece só como a alavanca "+1 tier". | No W7 ninguém chega perto de 51; o "51 observado" veio de outra escada. |
| M13 | A alavanca "+1 tier" entra por um **gancho opcional do kit**, `GainsModel.levers?(yoursFlat)`.<br>• São linhas calculadas pelo próprio modelo, sem Observed Max, ranqueadas junto com as outras.<br>• Some no tier 51.<br>• Texto: "needs ×E more max damage (next tier at X)". | O kit só sabe trocar uma fonte pela referência; o +1 tier é um passo, não uma referência. É a menor mudança que o M3 pede, e os outros stats não mudam. |
| M14 | **As regras de mapa vão dentro dos pools.**<br>• O `combine` é função pura dos pools, porque o coletor o chama sem ctx.<br>• Por isso o soft cap, os valores do Cove e a flag "3" chegam como itens (pools `rules` e `status`).<br>• Na árvore, eles aparecem como linhas de nome fixo.<br>• `combine` e `totalFromFlat` usam a mesma função pura, `mkTotal`. | Uma fórmula só para a página, o what-if e o coletor, sem duas cópias para divergir. |
| M15 | **Board do coletor = "monstersKilled"** (Tasks → Monsters Killed). | O Death Note soma as kills de cada mob em todos os mundos e dos minibosses. É o maior termo per tier e o que se constrói matando. Nenhum board mede multikill, e "highestDamage" não importa no 251, onde todos estão no teto 51. |
| M16 | **Gating por classe** = talentos 46 (VOID_RADIUS, Voidwalker) e 469 (MANA_IS_LIFE, Wizard/Elemental Sorcerer).<br>• O 654 é star talent (toda classe) e o 58 é account-wide: ficam sem gating.<br>• O coletor recebe `groups: []`. | É a saída do `deriveGatedTalentsFor` sobre as abas de talentos. Os dois talentos gated estão em somas, e o `profileFlat` já usa 0 como neutro por padrão. |
| M17 | O tier leva o rótulo de **estimativa sempre que fica abaixo de 51**, não só no W7. | O max damage do arkh fica abaixo do IT. Se o arkh já dá 51, o valor real também chega lá. Abaixo do teto, o erro move o tier: com E = 2, 4×10⁴ valem ~15 tiers. Contas do mid-game caem nesse caso fora do W7. |
| M18 | O `computeChipBonus` de todos os chars continua dentro do `computeMaxDamage` ("dmg") e do `computeAccuracy` ("acc"). Esta página não mexe nisso. Só o "mkill" usa o chip por char do AFK Gains. | O research dava o `computeChipBonus` como sem uso, mas ele alimenta o max damage e a precisão. Consertar agora mudaria o gate de precisão do talento 125 e o tier do 643. Isso vai junto da reconciliação do M4. |
| M19 | O cenário do **Cove** usa uma cópia do save editada em memória (`Holes[0][ci] = 17`). | Nenhum char deste save qualifica: os 10 chars no mapa 216 estão na cavern 3. A regra da casa é não pedir login e editar uma cópia do save em cache para outros estados. |

## Fórmula (fonte da verdade: N.js vivo)

`WorkbenchStuff("MultiKillTOTAL")` (@7756164):

```
MK = ⌊ B′ + T × P′ ⌋
B  = Σ das 9 fontes da base           (MultiKill_base,    @7754106)
P  = Σ das 18 fontes per tier         (MultiKill_perTier, @7751508)
T  = OverkillStuffs("2"), de 1 a 51   (@4075407)
B′, P′ = B e P depois do soft cap do W7 (mapa ≥ 300) ou do override do Cove (mapa 216 + cavern 17)
```

É **linear** no tier (base + tier × per tier), não uma potência.

### Base Multikill — `MKtzioDN2` (@7754106), 9 fontes somadas

| # | id | N.js | arkh | Markhe |
|---|---|---|---|---|
| B1 | `sign47` | `StarSigns.MultiKill`: sign 47 (Cullingo) +15, × Seraph | helper de star signs ativos do AFK Gains | 150 (15 × 10) |
| B2 | `saltLick8` | `SaltLick(8)` = nível × `SaltLicks[8][3]` (3 por nível, teto 10) | port do Salt Lick do EXP, generalizado | 30 |
| B3 | `stampC19` | `StampBonusOfTypeX("Overkill")` (só o StampC19 tem esse tipo) | `w1/stamp.ts:computeStampBonusOfTypeX` | 166 |
| B4 | `deathNoteBuilding` | `2·TowerInfo[2]` | `towerData[2]` × 2 | 102 |
| B5 | `etc29` | `EtcBonuses("29")` | sistema `etcBonus` 29 | 30,45 |
| B6 | `ach148` | `min(5, AchieveStatus(148))` | sistema `achievement` | 1 |
| B7 | `ach122` | `6·AchieveStatus(122)` | idem | 6 |
| B8 | `ach123` | `2·AchieveStatus(123)` | idem | 2 |
| B9 | `talent654` | `StatueOnyxOwned·GetTalentNumber(1,654)` (MONOLITHIALISM, star talent) | sistema `talent` 654 (wrap × estátuas ônix) | 576 |
| | | | **Σ** | **1063,45** |

### Multikill per Tier — `MKtzioDN` (@7751508), 18 fontes somadas

| # | id | N.js | arkh | Markhe (mapa 14) |
|---|---|---|---|---|
| P1 | `deathNoteWorld` | `OverkillQTY(⌊mapa/50⌋)`: a página do Death Note do mundo do mapa | `overkillQTY(w)` exportado do `coin/gambit.ts` | 300 (W1) |
| P2 | `deathNoteMini` | `OverkillQTY(7)`: os 10 minibosses | port novo (tabela 7842 sobre `ninjaData[105]`) | 58 |
| P3 | `vialOverkill` | `AlchVials.Overkill` | sistema `vial` "Overkill" | 101,92 |
| P4 | `buff46` | `GetBuffBonuses(46,2)` (VOID_RADIUS) | port do `GetBuffBonuses` (classe 4 ou 5 + buff 45) | 0 |
| P5 | `talent58` | `getbonus2(1,58,-1)·⌊OLA[158]/5⌋` | sistema `talent` 58 (account-wide + wrap) | 265,77 |
| P6 | `arcade8` | `ArcadeBonus(8)` | sistema `arcade` 8 | 20,10 |
| P7 | `artifact26` | `Sailing("ArtifactBonus",26)` (Trilobite Rock) | `w5/sailing.ts:computeArtifactBonus(26, …)` | 150 |
| P8 | `buff469` | `GetBuffBonuses(469,2)` (MANA_IS_LIFE) | port do `GetBuffBonuses` | 0 |
| P9 | `chipMkill` | `chipBonuses("mkill")` (Wood Chip, 15) | `chipBonuses(key)` por char do AFK Gains | 0 |
| P10 | `etc71` | `EtcBonuses("71")` | sistema `etcBonus` 71 | 195,16 |
| P11 | `meas9` | `Holes("MeasurementBonusTOTAL",9)` | port novo | 281,38 |
| P12 | `card80` | `CardBonusREAL(80)` | `common/stats.ts:computeCardBonusByType(80, …)` | 0 |
| P13 | `sign78` | `StarSigns["78"]`: sign 78 (Killian Maximus) +3, × Seraph | helper de star signs ativos do AFK Gains | 30 (3 × 10) |
| P14 | `prayer16` | `prayersReal(16,0)` (Balance of Pain) | `prayersReal` do AFK Gains (com o ramo do super bit) | 0 |
| P15 | `shiny4` | `Breeding("ShinyBonusS","Nah",4,-1)` | sistema `shiny` 4 | 80 |
| P16 | `box13b` | `BoxRewards["13b"]` | `common/stats.ts:computeBoxReward(ci,"13b")` | 9,78 |
| P17 | `bubbleMKtier` | `AlchBubbles.MKtierACTIVE` (MR_MASSACRE) | `w2/alchemy.ts:bubbleValByKey` + gate de equipar | 89,11 |
| P18 | `cardSet11` | `CardSetBonuses(0,"11")` | `common/cards.ts:computeCardSetBonus(ci,"11")` | 0 |
| | | | **Σ** | **1581,2331** |

Os valores do Markhe estão arredondados; o teste usa precisão total.

### Regras

**Soft cap do W7 (Shimmerfin Deep).**
- Vale igual nas duas metades, com mapa ≥ 300.
- A base não tem bypass.
- O per tier pula o soft cap só com `e = 8675309`, a chamada "sem teto" que o aviso do W7 usa.

| Faixa | Valor |
|---|---|
| v ≥ 250 | 98,14 + (v − 250)/50 |
| v ≥ 200 | 95,6 + (v − 200)/20 |
| v ≥ 150 | 90,6 + (v − 150)/10 |
| v ≥ 100 | 80,6 + (v − 100)/5 |
| v ≥ 50 | 47,3 + (v − 50)/1,5 |
| v ≥ 20 | 20 + (v − 20)/1,1 |
| senão | v |

A curva é praticamente contínua: os degraus em 50, 100 e 250 são menores que 0,05. A faixa de cima não tem teto e tem inclinação 1/50.

**Damage tier** — `RunCodeOfTypeXforThingY("OverkillStuffs", b)` (@4075407), com `E` = 5 se o mapa é ≥ 300, senão 2, e `Max` = `DamageDealed("Max")`:
- **`"2"` (tier):** `t = 1; para f = 0..49: se Max ≥ HP·E^(f+2) então t = f + 2, senão para`.
  - Ou seja, tier k ⇔ `HP·E^k ≤ Max < HP·E^(k+1)`.
  - Tier 1 se `Max < HP·E²`; teto **51**.
  - Não há gate de tipo de AFK.
- **`"0"` e `"1"` (pontas da barra roxa):** `HP·E^T` (só `HP` no tier 1) e `HP·E^(T+1)`.
- **`"3"` (ativação):** `Max ≥ HP·E` **e** `TowerInfo[2] > 0,5` (Death Note construído) **e** `PlayerAccTot() > 1,5 × Defence do alvo`. Vira 1 ou 0.

**Alvo.** É o `AFKtarget` vivo, que no load é o `AFKtarget_N` salvo do char, não o `MapAFKtarget[mapa]`. Nos outros mapas, a página usa o `MapAFKtarget[mapa]` (M1).

**O HP do alvo não é o da tabela.** O `performETCaction("MonsterRespawnTimeReset")` (@6466652) reconstrói os monstros e faz duas coisas, nesta ordem:
1. Multiplica o HP de todo monstro por `1 + (prayersReal(0,1) + prayersReal(7,1) + prayersReal(8,1))/100`.
   - São as maldições de Big Brain Time, Midas Minded e Jawbreaker equipadas pelo char atual.
   - Cada uma chega a +1475% no nível 50.
   - No ramo do super bit, as maldições valem 0.
2. **Depois** troca o HP do `w7a6` (Clamworks, mapa 306) por `Thingies("Clamz_HP")` = `1e16·30^OLA[464]` (@10887166). Por vir depois, o Clamworks **não** leva o fator de maldição.

**Override do Crystal Glunko Cove.**
- Vale no mapa 216 com `Holes[0][char] == 17` e é aplicado depois do soft cap. Os dois nunca coincidem, porque 216 < 300.
- A soma das fontes é **substituída**, não somada:
  - base = `Holes2("Cglunko_MKbase")` = `OLA[645] · RandoListo2[13][15]` (= ×100);
  - per tier = `Holes2("Cglunko_MKtier")` = `OLA[636] · RandoListo2[13][6]` (= ×1).

**Helpers do N.js usados pelas fontes:**
- **`DeathNoteRank(k, e)`** (@7751297):
  - mobs: `<25e3 → 0`, `<1e5 → 1`, `<2,5e5 → 2`, `<5e5 → 3`, `<1e6 → 4`, `<5e6 → 5`, `<1e8 → 7`; acima disso, 20 se `>1e9` e `Rift[0] ≥ 20`, senão 10;
  - minibosses (`e = 7842`): `<100 → 0`, `<250 → 1`, `<1e3 → 2`, `<5e3 → 3`, `<25e3 → 4`, `<1e5 → 5`, `<1e6 → 7`, senão 10.
- **`OverkillQTY(w)`** (@7756375):
  - w = 0..6: soma o rank de cada mob de `DeathNoteMobs[w]` pelas kills da conta (Σ dos chars de `MapDetails[m][0][0] − KillsLeft2Advance[m][0]`, já em `coin/accountKills.ts:accountMapKills`);
  - w = 7: soma os 10 minibosses de `NinjaInfo[30]` sobre `Ninja[105][i]`;
  - tetos das páginas: W1 300, W2 220, W3 280, W4 260, W5 260, W6 280, W7 480, minibosses 100.
- **`StarSigns()`** (@6490716). Helper do AFK Gains; o Multikill só lê as chaves.
  - Signs ativas = equipadas (`PersonalValuesMap.StarSign`) ∪ desbloqueadas com índice < `enabledStarSigns`.
  - Com o chip "star" e antes das signs infinitas, há um segundo passe das equipadas.
  - O Seraph multiplica só os valores positivos (×10 neste save).
- **`AlchBubbles.MKtierACTIVE`** só existe com o companion 4 (Sheepie) ou com `"c15"` em `CauldronBubbles[char]`. As letras dos caldeirões 0–3 são `_ a b c`.
- **`GetBuffBonuses(c, b)`** (@4257299): se o buff `c` não está ativo, vale 0. Se está ativo:
  - buff 46: `GetTalentNumber(b, 46)` só com classe 4 ou 5 **e** `GetBuffBonuses(45,1) > 0`; senão 0;
  - outros buffs: `GetTalentNumber(b, c)`.
- **`chipBonuses(key)`** (@5139280). Helper do AFK Gains.
  - Soma os 7 slots do **char atual** (`Lab[1+char]`) com `ChipDesc[chip][10] == key`.
  - O Wood Chip (14) dá "mkill" 15.
- **`prayersReal(d, b)`** (@7774914). Helper do AFK Gains, com dois ramos:
  - equipado: `round(PrayerInfo[d][3+b] · max(1, 1 + (nv − 1)/10))`;
  - nenhum prayer equipado e super bit 9 ou 39: `round(0,2·(SB9 + SB39 + SB53) · PrayerInfo[d][3] · escala)`, só para d ≠ 5 e b ≠ 1.
- **`Holes("MeasurementBonusTOTAL", 9)`**:
  - base: `(1 + CosmoBonusQTY(1,3)/100) · 40·nv/(100 + nv)`, com `HolesInfo[55][9] = "40TOT"` e nv = `Holes[22][9]`;
  - × o multi do tipo `HolesInfo[52][9] = 0`: q = `getLOG(Holes[11][28])` (kills de Gloomie), `q < 5 ? 1 + 18q/100 : 1 + (18q + 8(q − 5))/100`.
- **`StatueOnyxOwned`** = `OLA[69] < 2 ? 0 : #{e : StatueG[e] ≥ 2}`.

### Cobertura no arkh

O inventário completo está no research: 33 linhas, que são as 27 fontes, as 3 entradas do tier e as 3 regras.
- **Existem (14):** chamados como estão.
- **Genéricos (4):** `deathNoteBuilding` (leitura crua × 2), `card80`, `cardSet11` e `prayer16`. Os três últimos precisam de índice novo; o prayer 16 também precisa do ramo do super bit.
- **Parciais (9):** signs 47/78, página do Death Note por mundo, buffs 46/469, chip "mkill", MR_MASSACRE, HP do alvo e max damage (M4).
- **Faltando (6):** Salt Lick 8, minibosses, Measurement 9, soft cap do W7, override do Cove e a composição da flag "3".

**Com cuidado extra:**
- a semântica do card set 11: o IT usa a chave `'CardSet9'`, o N.js usa `"{%_Multikill_Per_Tier"`;
- a letra do caldeirão ("c15");
- o gate de classe do buff 46;
- o HP do Clamworks, que não leva maldição;
- o teto 51.

Nenhuma chave nova no loader: tudo já está exposto, e o `AFKtarget_N` vem do `statCtx`.

## Exibição no jogo

`_GeneralINFO[91..94]` é preenchido quando o AFK Info abre (@3768103):
- [91] = `MultiKillTOTAL`;
- [92] = tier;
- [93] e [94] = limiares atual e próximo.

| Lugar | N.js | O que o jogador vê |
|---|---|---|
| **AFK Info, linha 7** | @3835457 | `MULTIKILL: 81706%` = `"MULTIKILL;_" + ⌊[91]⌋ + "%"`, sem separador de milhar. Pela convenção da fonte, `;` vira `:` e `_` vira espaço (presumido). A linha só aparece com a flag "3" = 1 **e** alvo `FIGHTING`; senão a linha 7 mostra a linha normal do AFK. |
| **AFK Info, barra roxa** | @3821498 (preenchimento), @3824526 (rótulos), @3841213 (legenda) | Rótulos `T[` e `T+1[` nas pontas. O `[` é um glifo da fonte, provavelmente uma caveira (não confirmado). Legenda "Max Dmg"; preenchimento `27 + (Max − [93])/([94] − [93]) · 97` px. Com a flag "3" desligada, a mesma barra mostra a taxa AFK de 5% a 100%. |
| **Cabeçalho THE_COVE** (cavern 17) | @11988151 | `MK < 100 ? ⌊10·MK⌋/10 + "%" : CommaNotation(MK) + "%"`, ao lado de Drop Rarity e da taxa AFK de luta. |
| **Aviso do W7** (Shimmerfin Deep) | @20997188 | "…Multikill requires 5x DMG to activate and is reduced … by around X%", com X = `round(100 · (1 − P′/max(1, P)))`. Markhe no 301: ~93%. |
| **Bolha MR_MASSACRE** | @13903873 | Explica que o damage tier é a barra roxa do AFK Info. |

A página mostra `⌊MK⌋ + "%"`, como a linha do AFK Info (M1). Ela não desenha a barra: o tier e os dois limiares ficam na árvore.

## Arquitetura

### 1. Motor (`web/lib/arkh`)

**Descritor próprio** `stats/defs/multikill.ts`. Não usa o `groupedDescriptor` (M2).
- Pools (M14):
  - `base`: 9 fontes;
  - `perTier`: 18 fontes;
  - `tier`: o nó do damage tier;
  - `rules`: soft cap e Cove;
  - `status`: flag "3".
- `combine` = `mkTotal`, função pura de `{ B, P, T, soft cap, Cove }` que devolve `⌊B′ + T × P′⌋`. Ela é exportada para o `totalFromFlat` usar a mesma conta.
- Exporta `MK_ROOT = "Multikill"`, as listas de fontes, os nomes fixos das linhas de regra e `mkSoftCap(v)`.

A árvore usa nomes em inglês, porque é texto do site:

```
Multikill = ⌊B′ + T × P′⌋        (raiz, em %)
├─ Base Multikill       B′   9 fontes  [+ "Shimmerfin Deep soft cap" no W7 | + "Crystal Glunko Cove" no override]
├─ Damage Tier          T    Max Damage · Target HP (Static HP, Prayer curses) · Exponent · Tier reached at · Next tier at
├─ Multikill per Tier   P′   18 fontes [+ as mesmas linhas de regra]
└─ Active in AFK        1/0  Max damage ≥ HP × E · Death Note built · Accuracy > 1.5 × Defence
```

- A linha do soft cap mostra `Σ → valor` e o "reduced by ~X%" do aviso do jogo.
- O Damage Tier leva a nota "estimate" quando T < 51 (M17), com o alvo e o mapa.
- O status diz também se o AFK Info mostra a linha (alvo `FIGHTING`).

**Sistema** `stats/systems/multikill/multikill.ts`:
- `resolveMultikill(id, ctx)`, com um id por termo do N.js e tag `@njs`, no molde do `coin.ts`/`exp.ts`;
- `MK_CLASS_TALENTS = [46, 469]`;
- registrado em `registry.ts` como `multikill`;
- os nós dos buffs terminam em "(Talent 46)" e "(Talent 469)", para o gating do coletor.

**Helpers compartilhados** (novos ou extraídos, sempre aditivos):

| Helper | Onde | O quê |
|---|---|---|
| `multikillTier(hp, maxDmg, E)` | `systems/common/overkill.ts` (novo), movido do `coin.ts` | O laço do `OverkillStuffs("2")`, sem mudança. |
| `overkillStuffs(ci, map, ctx)` | idem | Alvo (M1), HP com maldições ou `Clamz_HP`, E, max damage (`computeMaxDamage`), tier, limiares "0"/"1" e flag "3" com as três partes (`computeAccuracy`, `towerData[2]`, `Defence`). |
| `overkillQTY(w, s)` | `coin/gambit.ts` (exportar) | Página do Death Note do mundo w (0–6) e minibosses (7, tabela 7842). `deathNoteSkulls` vira `Σ overkillQTY(0..6)`, sem mudar o número do Coin. |
| `saltLick(i, s)` | port do Salt Lick do plano do EXP | Generalizado para qualquer índice, se tiver saído preso ao 3. O número do EXP não muda. |
| `measurementBonusTotal(9, s)` | ao lado do `measurement13` do `gambit.ts` | Base comum + multi do tipo 0 (Gloomie). |
| `getBuffBonuses(c, b, ci, ctx)` | port novo exportado | Inclui o caso 615 → 1 e o gate do 46. O `getBuffBonus` privado do `derived-stats.ts` não muda. |
| `cglunkoUpgBon(b, s)` | junto do sistema | `OLA[630+b] · RandoListo2[13][b]`. |

**Do AFK Gains.** Reusar sem redefinir; nomes e arquivos são os do spec dele:
- o helper de star signs ativos (signs 47 e 78);
- o `prayersReal` com o ramo do super bit (prayer 16 e as maldições 0/7/8);
- o `chipBonuses(key)` por char ("mkill");
- a opção `unit: "%"` do kit, para o headline e a raiz da árvore.

**Entrada** `lib/arkh/computeMultikill.ts`:
- embrulhos finos sobre o `computeStat.ts`: `computeArkhMultikill`, `computeArkhMultikillPools` e `combineMultikillPools`;
- o ctx é o de sempre: `mapIdx` + `afkTarget` do `statCtx`.

**Coin, em commit separado (M5):**
- O `case "talent643"` do `coin.ts` troca o `multikillTier` com HP cru pelo tier do `overkillStuffs`.
- O `computeOverkillTier` continua ali só para dividir o tier do wrap de volta.
- No próximo cron, o coletor do Coin (mapa 301) baixa o 643 de quem tem maldição equipada.

### 2. Página no kit

| Arquivo | Papel |
|---|---|
| `lib/multikill/pageConfig.ts` | `MULTIKILL_PAGE: StatPageConfig` |
| `lib/multikill/format.ts` | `formatMultikill(v)` = `⌊v⌋` sem separador, "—" se não for finito |
| `lib/multikill/gains.ts` | `multikillGainsModel`, o `GainsModel` próprio (abaixo) |
| `lib/multikill/topMultikill.ts` + `.meta.ts` | Observed Max gerado |
| `app/multikill/page.tsx` + `MultikillPageClient.tsx` | Cascas: `<StatPageClient config={MULTIKILL_PAGE} />` |

`MULTIKILL_PAGE`:
- **Textos:** `statName` "Multikill", `gainLabel` "Multikill", `emoji` "💥", `calculatorTitle` "Multikill Calculator", `totalLabel` "Total Multikill", `unit` "%", `errPrefix` "Multikill compute failed".
- **Seletor de mapa:** `mapTitle` "The map sets the Death Note page, the W7 soft cap and ×5 tier ladder, the target's HP and the Crystal Glunko Cove".
- **Storage:** `multikill-tracker.last-upload.v1`, `multikill-tracker.playerName`, `multikill-tracker.v1` e `multikill.snapshot-section.collapsed.v1`. Export `multikill-snapshots` / `multikill-tracker`, sem `legacyValueKey`.
- **Nota de metodologia:** a referência é do mapa 251; o Death Note só é comparado no W6 e o tier só fora do W7; "+1 tier" pede ×E de max damage.

`multikillGainsModel` usa o what-if do kit (D10 do EXP):
- **`totalFromFlat`** = `mkTotal` lido da árvore achatada:
  - B e P são a soma das fontes: os filhos diretos menos as linhas de regra;
  - o soft cap entra se a linha dele existe;
  - com a linha do Cove, a metade vale o valor da linha, e as fontes não movem o total.
- **`sources`** = as 27 fontes do próprio save (não as da referência), mais o tier:
  - o Death Note casa pelo nome com o mundo (M11);
  - o tier sai da lista em mapas ≥ 300 (M12); o modelo lê o E da árvore.
- **`levers`** = "+1 damage tier", com ganho `⌊B′ + (T+1)·P′⌋ / ⌊B′ + T·P′⌋ − 1` e o próximo limiar. Some em T = 51 (M13).
- **Exibição:** as fontes como "pct", o tier como "raw".

**Única mudança no kit:** `GainsModel.levers?(yoursFlat): GainRow[]`, opcional.
- O `computeGains` acrescenta essas linhas ao ranking, sem contá-las em `comparableSources`.
- EXP, Coin e AFK não mudam.

### 3. Observed Max + cron

`scripts/update-top-multikill.ts` é a config do `runTopCollector`:

| Campo | Valor |
|---|---|
| `label` | "Multikill" |
| `focusBoard` | "monstersKilled" (M15) |
| `root` | `MK_ROOT` |
| `groups` | `[]` (M16) |
| `computePools` | pools de cada char no **mapa 251** (M7) |
| `combine` | `combineMultikillPools` |
| `gated` | `deriveGatedTalentsFor(MK_CLASS_TALENTS)` |
| saída | `lib/multikill/topMultikill.ts` + `.meta.ts` |
| `constPrefix` / `flatForClassFn` | "TOP_MULTIKILL" / "topMultikillFlatForClass" |

- **Travas:** as mesmas do coletor compartilhado. Uma passada de `combine`, `MIN_PLAYERS = 20`, e nunca publica uma referência encolhida.
- **O que sai no 251:** o `mergeBest` guarda o melhor valor por fonte, o tier 51 e a página W6 do Death Note.
- **Cron:**
  - passo "Refresh top-player Multikill max" no `.github/workflows/refresh-top-max.yml`, depois do AFK Gains, com `continue-on-error` e timeout 12;
  - os dois arquivos entram na lista do commit;
  - o nome do workflow e a mensagem do commit ganham "multikill".
- **Troca para o 301:** follow-up, só depois da reconciliação do max damage.

### 4. Navegação

- `components/TopNav.tsx`: `{ href: "/multikill", label: "💥 Multikill" }` depois do AFK Gains.
- `app/page.tsx`: card "Multikill Tracker".
- e2e da home: card novo.
- `__tests__/components/TopNav.test.tsx`: item novo.

## Testes e validação

**Motor, sem save (roda no CI):**
- `mkSoftCap` nas bordas (20, 50, 100, 150, 200, 250) e na faixa de cima.
- `multikillTier` nos limiares `HP·E^k`: tier 1 abaixo de `HP·E²` e teto 51.
- `mkTotal`: piso; soft cap só com a linha; Cove substitui a soma.
- Smoke com envelope vazio: total finito, 4 filhos, 9 e 18 fontes.

**Smoke dos saves em cache:** todos os saves de top players em `golden/.cache` calculam um total finito para todos os chars, nos mapas 14, 251 e 301.

**Save** (privado, `describe.skipIf`, pulado no CI), com o Markhe (índice 8, mapa 14, alvo `beanG`):
- cada termo das tabelas;
- Base **1063,45**, per tier **1581,2331**, tier **51** e total **81706%**;
- os outros 10 chars batem com o IT: ARKHE 77116, ARKHELUCK 106167, zArkhe 107748, farkhe 77116, Darkhe 77116, Parkhe 106167, Warkhe 105652, Sarkhe 107748, Barkhe 106167 e Arkhiiiiii 106167;
- onde o IT divergir do N.js, vale o N.js, com comentário `// N.js ≠ IT:` e o offset.

**Cenários** (mesmo save):

| Cenário | Esperado | Nota |
|---|---|---|
| Mapa 301: soft cap + tier estimado | Markhe: B′ 114,409 e P′ 127,9647 (página W7 = 460). Tier **24** com o max damage do arkh (estimativa) → **3185%**. | Com o max damage do IT (tier 30) daria 3953%. Aviso "reduced by ~93%". |
| Mapa 251: mapa do coletor | Markhe no tier 51 → **80686%** (página W6 = 280). Os 11 chars ficam no tier 51. | Prova que o coletor não depende do max damage. |
| Mapa 216 + cavern 17: override | Nenhum char qualifica; os 10 chars no 216 estão na cavern 3. Numa cópia editada em memória com `Holes[0][ci] = 17`: B′ = 38 × 100 = **3800** e P′ = 46 × 1 = **46**. Com T = 51 → **6146%**. | M19 |
| Mapa 306: Clamworks | HP do alvo = 1e16·30^8 = **6,561e27**, e não o 1e18 da tabela, sem fator de maldição. Markhe no tier 4 (estimativa) → 626%. | |
| Maldições | zArkhe (índice 2) tem a maldição do Jawbreaker em 1180%, então o HP fica ×12,8. No 301, o tier cai de 21 para **19** → **2754%**. | Sem o fator daria 3032%. |
| Flag "3" | Os 11 chars ficam ativos, mas só o Markhe mira um alvo `FIGHTING`. Os outros 10 miram `Bravery_Monument`, do tipo `Paying_Respect`. | O jogo esconde a linha deles, mas o headline continua o `MultiKillTOTAL` (M2). |

**Coin** (commit do M5):
- `coin-multi.save` continua **6,88E35**, porque o Markhe não tem maldição.
- Asserções novas:
  - zArkhe no 301: talento 643 no tier 19 (hoje 21);
  - Markhe no 306: tier 4 (hoje 18), pelo HP do Clamworks.

**Kit e página:**
- `multikillGainsModel`:
  - `totalFromFlat` igual ao `combine` nos casos 81706, 3185 e 6146;
  - what-if de uma fonte da base e de uma fonte per tier;
  - tier fora da lista no W7;
  - "+1 tier" some no 51;
  - Death Note só casa no mesmo mundo.
- `levers` no `biggestGains.test.ts`.
- `formatMultikill`, `pageConfig` (chaves e `unit`) e coletor (o `profileFlat` zera os talentos 46 e 469).
- Os testes de UI do kit rodam com a config do Multikill (título "Multikill Calculator", chave do nome), além do TopNav e do e2e da home.

**Jogo:**
- Com o Markhe no `beanG`, o AFK Info deve mostrar `MULTIKILL: 81706%`.
- A leitura precisa de um save do mesmo momento, obtido **sem login quando possível** (perfil público do IT ou "Copy for Support").
- O "Max Dmg" do painel de stats, lido na mesma hora, decide o M4.

**Verificação:** `tsc --noEmit` + vitest + preview da Vercel; **nunca** `npm run dev`.

**Critério de pronto:** bater a leitura do jogo, na mesma formatação da tela.

## Entrega

- Branch `feat/multikill-page`, empilhado no branch do AFK Gains e criado depois do SDD do EXP.
- Este spec vai para `docs/superpowers/specs/2026-09-24-multikill-page-design.md` nesse branch; o plano vai para `docs/superpowers/plans/`.
- Execução por subagentes.
- Um PR próprio, com base no branch do AFK Gains, para o diff mostrar só o Multikill. A base muda para `main` quando o AFK entrar.
- A correção do talento 643 do Coin vai em commit separado.
- Merge só com ordem explícita do usuário.

## Fora de escopo

- **Reconciliar o max damage** do arkh com o jogo e com o IT, e depois mover o coletor para o 301. É follow-up e inclui:
  - as 16 sub-fontes `[STUB]` do `derived-damage.ts`, entre elas o `computeSaltLick` zerado;
  - o chip "dmg"/"acc" somado sobre todos os chars.
- `derived-damage.ts:computeOverkillTier` e o `calcTalent.ts` 643 que o usa (alvo `MapAFKtarget`, gate `FIGHTING`, sem maldição). Follow-up.
- A letra da bolha: "d21" → "c21" em `coin/divinityMinor.ts:42` e `common/talent.ts:753,1394`. O erro fica mascarado quando o Sheepie existe, como neste save. Follow-up.
- `w4/lab.ts:computeChipBonus`, que soma todos os chars e pula o chip 0. Follow-up (M18).
- O sistema `starSign` sem gate de equipado (o "drop" do DR). O caminho é o helper do AFK Gains.
- Os efeitos do Multikill (drops, `KillPerKill`, MULTI-SCALPING) e a página do Clamworks.
- Referência do Death Note por mundo, para comparar os outros mundos (M11).

## Riscos e pontos em aberto

1. **Reconciliação do max damage.**
   - O arkh fica 4–6×10⁴ abaixo do IT (Markhe: 6,0e30 contra 2,45e35), e não se sabe quem acerta o jogo.
   - Fora do W7 não importa: o endgame está no teto 51 com folga.
   - No W7 decide o headline. Tiers arkh × IT: 24 × 30 no mapa 301 (3185% × 3953%, −19%), 4 × 10 no 306 (com o HP do Clamworks) e 11 × 17 no 310.
   - Mitigação: o rótulo de estimativa (M4, M17), a leitura do "Max Dmg" no jogo e o follow-up.
2. **Star signs e gate de ativação.**
   - Esta conta tem 245 signs habilitadas (Seraph ×10), então todas contam, e o teste do save não exercita o gate de equipado.
   - Contas do mid-game dependem do helper do AFK Gains.
   - A flag "3" usa o `computeAccuracy`, que herda o chip "acc" de todos os chars. Ela só aparece como status e não mexe no headline. Neste save os 11 chars estão ativos.
3. **Sensibilidade do tier no W7.**
   - Cada ×5 de max damage vale +1 tier = +P′: ~+128 no Markhe no 301, de 3185% para 3313% (+4,0%).
   - A diferença arkh × IT (~4×10⁴ ≈ 5^6,6) vale 6 tiers.
   - O soft cap achata as fontes: +100 cru no per tier dá +1,5% no 301, contra +6,2% no mapa 14. Por isso a alavanca é o tier (M3, M13).
4. **Divergências IT × N.js.**
   - O IT não aplica o override do Cove e usa o HP estático no Clamworks.
   - O card set 11 tem outra chave no IT. Não há card set de Multikill neste save, então não está confirmado.
   - O max damage difere (item 1).
   - Vale o N.js, com cada gap escrito no teste.
5. **Referência presa ao 251.**
   - O Death Note só é comparado no W6 (M11), e o tier só fora do W7 (M12).
   - Os buffs 46 e 469 são de runtime: dependem do `BuffsActive_N` no momento do save.
6. **Empilhamento.**
   - A página depende dos helpers e do `unit` do AFK Gains.
   - Se os nomes mudarem na revisão do AFK, o plano acompanha.
   - Se o PR do AFK cair, os helpers vêm para este branch.
7. **Save de validação.**
   - O save em cache é de 23/09, e a leitura do jogo precisa de um save do mesmo momento, sem login.
   - O Markhe tem que estar no alvo de luta, senão a linha não aparece.
8. **Primeira geração do `topMultikill.ts`.**
   - Depende da API de perfis do IT.
   - Se ela falhar, o PR sai com a referência gerada pelos saves de top players em cache, e o cron regenera.
