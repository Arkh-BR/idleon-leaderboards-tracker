# Cooking Mastery — mecânica (porte fiel do N.js)

Fonte: N.js live de 2026-06-07 (`web/scripts/updater/.cache/N.new.js`). Bloco principal em
`_customBlock_Summoning2` (~linha 18100). Desbloqueado no Rift 61. Todos os snippets abaixo são
literais do bundle.

## Estrutura no save — `CookMaster` (array 2D)

Inicialização quando vazio (N.js ~9489): `[0]` recebe 100 zeros, `[1]` 30 zeros, `[2]` 6 zeros.

| Acesso | Significado |
|---|---|
| `CookMaster[0][g]` (g=0..99) | **Yellow PTS** gastos na meal `g` |
| `CookMaster[1][0]` | **Mastery Rank** (nível atual) |
| `CookMaster[1][1]` | **EXP atual** acumulada no rank |
| `CookMaster[1][2]` | flag de UI (modo de reset; 0/1) |
| `CookMaster[1][3]` | **Ladles** alimentados (acumulador; `+= ItemQuantity` ao arrastar) |
| `CookMaster[2][b]` (b=0..5) | **Purple PTS** gastos no upgrade de mastery `b` |

No save bruto a chave é `CookMaster` (lista JSON). Carregado via `getLoadJsonList("CookMaster")`
(N.js ~30028). Ausente em saves pré-patch → engine deve tratar como tudo-zero.

## Exp/h — `ExpRateCook` (a métrica a maximizar)

```js
"ExpRateCook"==d) return 2
  *(1+Summoning2("BonusAmountcook",0,99)/100)   // b=0 Ladle
  *(1+Summoning2("BonusAmountcook",1,99)/100)   // b=1 Account Cooking LV
  *(1+Summoning2("BonusAmountcook",2,99)/100)   // b=2 Divorce Cake Level
  *(1+Summoning2("BonusAmountcook",4,99)/100)   // b=4 total Ribbon Ranks
  *(1+ResearchStuff("Grid_Bonus",190,0)/100)    // Research Grid K3 (Masterius_Cookerius)
  *(1+40*GamingStatType("SuperBitType",68,0)/100) // Zuperbit upg 68
  *(1+Summoning2("BonusAmountcook",5,99)/100)   // b=5 Mastery Rank
  *(1+2*Companions(87))                          // Companion 87 (x3 se possuído)
  *(1+(AlchVials["7cookmastery"]+ArcadeBonus(69)+SaltLick(10))/100); // vial + arcade + salt lick
```

**Multiplicativo.** Note que **b=3 NÃO entra na Exp/h** (é "daily Ribbon gains"). Os 5 upgrades de
Purple que afetam a Exp/h são **b ∈ {0,1,2,4,5}**.

### Contribuição de cada fonte — `BonusAmountcook(b, e)`

Com `e==99` retorna a contribuição em pontos percentuais; senão retorna o coeficiente puro:

```js
BonusAmountcook(b,0) = RandoListo2[8][b] * CookMaster[2][b]   // coef base × Purple PTS no upgrade b
```

`RandoListo2[8] = [200, 1, 30, 10, 2, 20]` (coef por upgrade b=0..5).

Com `e==99`, `base_b`:

| b | fonte | base_b | coef (RandoListo2[8][b]) |
|---|---|---|---|
| 0 | Ladle | `log10(CookMaster[1][3])` (via `getLOG`) | 200 |
| 1 | Account Cooking LV | `max(0, CkMst_AcLvT − 1000)` | 1 |
| 2 | Divorce Cake Level | `max(0, Meals[0][73] − 75)` | 30 |
| 3 | daily Ribbon gains (NÃO exp/h) | `250·(x/(25+x))`, x=coef | 10 |
| 4 | total Ribbon Ranks | `CkMst_RbLvT` | 2 |
| 5 | Mastery Rank | `CookMaster[1][0] + 1` | 20 |

⇒ contribuição da fonte b (em %): `contrib_b = base_b × RandoListo2[8][b] × CookMaster[2][b]`.

- `CkMst_AcLvT` = Σ `PlayerDATABASE[user].Lv0[10]` de todos os chars (= soma do Cooking LV de cada personagem).
- `CkMst_RbLvT` = Σ `Ribbon[28+f]` para f=0..(Ribbon.length−28) (= soma dos ranks de todas as ribbons de meal).
- `getLOG(a) = Math.log(max(a,1))/2.30259` = **log base 10**.

## Progressão de rank

- **XP p/ próximo rank:** `ExpReqCook = 100 · 2.5^rank · 5^max(0, rank−40)` (rank = `CookMaster[1][0]`).
- **Ganho:** `CookMaster[1][1] += ExpRateCook · (dt_segundos/3600)`; ao atingir `ExpReqCook`, subtrai e `rank++`.
- **Rank p/ desbloquear upgrade b:** `RankREQcook = [0,1,5,10,25,100,150,250,500]` → upgrades b=0..5 exigem rank ≥ [0,1,5,10,25,100].

## Pools de pontos

```js
PtsLeftCook_P = max(0, round( rank + (1 + 5·Companions(87)) − Σ CookMaster[2][f] ))
PtsLeftCook_Y = max(0, round( rank + (1 + 5·Companions(87)) + ResearchStuff("Grid_Bonus",190,1) − Σ CookMaster[0][f] ))
```

⇒ **Purple total** = `rank + 1 + 5·Comp87`. **Yellow total** = `rank + 1 + 5·Comp87 + ResearchGrid190(modo1)`.
Cada rank dá +1 de cada cor; Companion 87 (rift1) dá +5 de cada; Research Grid K3 dá Yellow extra.

## Yellow PTS → meals (NÃO afeta a Exp/h)

```js
"BonusMultiCook"==d) return 1 + 100*CookMaster[0][b]/(CookMaster[0][b]+5)/100;  // = 1 + Y_g/(Y_g+5)
```
Multiplica o bônus da meal g (range 1→~2). Já portado em `lib/arkh/stats/systems/common/cooking.ts:35`.

## Implicações para o otimizador (Exp/h)

- A otimização é **puramente sobre os Purple PTS** entre os 5 upgrades {0,1,2,4,5} desbloqueados pelo rank.
  (b=3 é inútil para Exp/h; Yellow não entra na Exp/h.)
- Fatores externos (Research Grid, Zuperbit, Companion 87, vial, Arcade, SaltLick) são **constantes**
  em relação à alocação de Purple → não mudam o ranking nem a alocação ótima; só escalam a Exp/h absoluta.
- Por ponto no upgrade b, o fator `(1 + contrib_b/100)` cresce em `base_b × coef_b / 100`.
  Ganho marginal de Exp/h ao add 1 PT no upgrade b: `ExpRate × (base_b·coef_b/100) / (1 + base_b·coef_b·P_b/100)`
  → **rendimento decrescente** ⇒ **greedy por ganho marginal** (water-filling) é ótimo.
- "Valor" de cada upgrade (ganho marginal do 1º ponto, em pp ao fator): `base_b × coef_b`:
  Ladle `log10(ladles)·200`, Account `max(0,ΣcookLv−1000)·1`, Divorce `max(0,mealLv73−75)·30`,
  Ribbon `ΣribbonRanks·2`, Rank `(rank+1)·20`.

Nomes p/ UI (strings do jogo): `EXP boost via Ladle / account Cooking LV / Divorce Cake Level /
daily Ribbon gains / total Ribbon Ranks / Mastery Rank`.

## Fatores externos da Exp/h (portados — `externalExpMulti`)

Os 6 fatores multiplicativos são constantes em relação à alocação de Purple, mas necessários
para a Exp/h absoluta. Validados a **0.08%** contra um save real (Exp/h in-game 56,6M).

| Fator | N.js | Porte na engine |
|---|---|---|
| Research Grid K3 | `ResearchStuff("Grid_Bonus",190,0)` | `gridBonusValue(190, s)` (w4/lab) |
| Zuperbit 68 | `GamingStatType("SuperBitType",68,0)` | ver nota abaixo |
| Companion 87 (rift1) | `1 + 2·Companions(87)` | `companionIds.has(87)` |
| Vial Canteen Read | `AlchVials["7cookmastery"]` | `computeVialByKey("7cookmastery", s)` (w2/alchemy) |
| Arcade 69 | `ArcadeBonus(69)` | `arcadeBonus(69, s)` (w2/arcade) |
| Salt Lick 10 (Refinery6) | `SaltLick(10) = SaltLick[10]·SaltLicks[10][3]` | inline (linear) |

**SuperBitType / Number2Letter:** `SuperBitType(b) = Gaming[12].indexOf(Number2Letter[b]) != -1`.
`Number2Letter` é um GameAttribute default do runtime Stencyl — **não existe como texto no bundle
N.js** (só aparece em `getGameAttribute("Number2Letter")`, nunca atribuído). Como os super bits do
Gaming são desbloqueados sequencialmente, `Gaming[12]` é um prefixo de `Number2Letter`, então
`SuperBitType(b) = (b < Gaming[12].length)`. Exato para progressão sequencial densa (o caso comum);
um `extBonusOverrides.cookMasteryExtMulti` (calibrado da Exp/h in-game) sobrescreve o produto se preciso.
