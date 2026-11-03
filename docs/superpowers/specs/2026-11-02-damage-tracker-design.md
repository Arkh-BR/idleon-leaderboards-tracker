# Página Damage (Player Info) — Design Spec

**Data:** 2026-11-02
**Status:** decisões aprovadas pelo usuário (02/11/2026, via perguntas); aguardando revisão deste spec
**Branch:** `feat/damage-tracker` (a partir de `main` `ec2b109`)

## Problema

O site tem trackers de Coin Multi, EXP Multi, AFK Gains, Multikill e Artifact Find no kit `statTracker`.
O usuário quer o mesmo tracker para o **Damage** que o jogo mostra na tela **Player Info** de cada
personagem (`Mín~Máx`).

O motor já calcula o dano máximo em `lib/arkh/stats/systems/common/derived-damage.ts`
(`computeMaxDamage`), usado só como escalar para o tier de overkill (talento 643 do Coin, Multikill).
Ele tem 16 funções `[STUB]` (0 ou 1 neutro) e alguns termos faltando, por isso é uma estimativa
(Multikill no mapa 301: tier 27 no site vs 30 no IT).

## Objetivos

- Página **"⚔️ Damage"** no mesmo formato de Coin/EXP/AFK/Multikill (paridade de abas e comportamento).
- Total **igual ao Damage do Player Info** do jogo, para o personagem logado, no mapa em que ele está.
- **Uma fonte só** para o dano máximo: o tier de overkill (Coin 643, Multikill) passa a usar o mesmo número.
- O motor existente é a base (completar stubs e termos faltando); o modo como o DR V2 foi construído
  **não** é modelo (decisão do usuário).

## Decisões do usuário (02/11/2026)

| Tema | Decisão |
|---|---|
| Número principal | Total = **`Min ~ Max`** igual ao jogo. Árvore, Compare e Biggest Gains medem o **Max**; Min = Max × Mastery, mostrado |
| Abordagem | Parte do `derived-damage.ts` existente e traz tudo o que falta; estrutura de página igual Coin/EXP/AFK/MK. Fórmulas do DR V2 podem ser reusadas |
| Fonte única | `computeMaxDamage` passa a ser o total do descriptor de Damage. Coin 643 e Multikill mudam junto; os pins deles são reconferidos |
| Buffs | `GetBuffBonuses(108,2)` e `(124,2)` aparecem como fonte com **0** e nota "active buff only" |
| Formas de masterclass | Wraith (Death Bringer), Tempest (Wind Walker), Tesseract (Arcane Cultist): **ignoradas** (dano normal) + nota |
| Mapa | **Seletor**, padrão = mapa atual do personagem |
| Formato do número | **Compacto do site** (`formatIdleon`: M/B/T/Q/QQ/QQQ) |
| Observed Max | Por família de classe **só nas fontes escaladas por stat** (como PR #63); talentos de classe filtrados por classe |
| Fora do escopo | Ramo de dungeon (`Dungon() != -1`) |
| Entrega | Um PR; merge só quando o usuário mandar |

## Fórmula (fonte da verdade: N.js vivo, snapshot sha `c7b0b20b290c`)

`_customBlock_DamageDealed(d)` em `web/data/njs-snapshot/formulas.json`. O Player Info mostra
`ceil(DamageDealed("Min")) ~ ceil(DamageDealed("Max"))`.

### Ramos, nesta ordem

1. `"Min"` → `Max × Mastery`.
2. Dungeon → fora do escopo.
3. **Mapa 43** → `Mastery = 0.2`, `Max = RoyalG("RatDMG")` = `(10 + ArmoryUpgBonus(35)) · (1 + ArmoryUpgBonus(36)/100)`.
   O total inteiro é **substituído** (banner `replacedBy` do kit, como a Cove no DR V2).
4. Formas Wraith / Tempest / Tesseract → ignoradas (nota na página).
5. `Mastery = min(0.8, 0.35 − GTN(2,113)/100 + (AlchBubbles.Mastery + CardBonusREAL(21) + GTN(1,123) + EtcBonuses("21"))/100)`.
6. `Max = L0 · L1 · L2` (abaixo).

### L0 — Base Damage

```
STAT = TotalStats(stat principal da classe) · (1 + (GTN 95 + GTN 455 + GTN 20 + W6 + A6 + M6)/100)
L0 = ((WP · (1 + (GTN 97 + 277 + 457 + CosmoBonusQTY(2,4))/100) + GTN 5) / 3)²
   + STAT + GoldFood("BaseDamage") + min(150, 2·WP + STAT)
   + Arcade(0) + Owl(1) + Vault(0) + Vault(20)·VaultKillzTotal(5)
   + StampBaseDmg + Etc("16") + Statue(0) + Box basedmg
   + bdmgHP·log10(max(HP−250,1)) + bdmgSPD·log2(max(SPD−0.1,0))/0.25 + bdmgMP·log10(max(MP−150,1))
   + CardBonusREAL(4) + Sigil(4) + CardLv("fallEvent2")
soft cap: > 4000 → 4000 + (L0−4000)^0.91; depois > 15000 → 15000 + (L0−15000)^0.84
L0 += Σ comidas BaseDmgBoosts (Amount × FoodBonuses("BaseDmgBoostsEffectBonus"))   ← depois do cap
```

`WP = TotalStats("Weapon_Power")` (o motor já tem o port inline, com Flurbo shop em stub).

### L1 — Damage %

```
L1 = 1 + (STAT^0.7 + Vault27·Killz(6) + Vault15·OLA[338] + 0.4·Vault10 + Bribe30 + Bribe20
          + StampPctDmg + LankRankUpgBonus(14) + Statue(22) + GTN 113
          + log10(HP)·GTN 86 + log10(MP)·GTN 446 + Owl(2) + Roo(4) + BubbaRoG(4) + Vault80
          + Spelunk ShopUpgBonus(64)) / 100
   × (1 + GTN 284 · min(100, Lv0[2])/10 / 100)
   × (1 + WinBonus(0)/100)
   × (1 + (GTN(2,463)·⌊Minigame[0]/25⌋ + W12 + A12 + M12 + TC31 + TC110 + GTN125·TC125 + TC485
           + TC305/50 + TC470/10 + B_UPG(57) + GTN290·⌊min(SPD−1,10)/0.15⌋ + TC656
           + log10(OLA[161])·GTN649 + log10(OLA[71])·GTN638 + min(quests, GTN658)
           + Divinity Bonus_Minor(char, 7)) / 100)
   × GoldFood("Damage")
soft cap (aplicado depois do bloco L2 no N.js, independente dele):
  > 100 → 100 + (L1−100)^0.86; > 2e6 → 2e6·(L1/2e6)^0.5; > 1e8 → 1e8·(L1/1e8)^0.3
```

### L2 — Damage Multipliers

Fatores na ordem do N.js; cada `(1 + Σ/100)` é um grupo da árvore.

```
L2 = AdditionExtraDMG × (1+vial 7dmg/100) × (1+eclipseSkulls/100) × (1+Palette(34)/100)
   × (1+Dream[6]/10) × (1+Pristine(0)/100) × (1+SummUpg(79)/100) × (1+Cglunko_upgBon(19)/100)
   × (1 + (Buff(108) + Friend(0) + StarSigns.PctDmg + max(0,Div[25]−10)·gb2(507) + ⌊max(0,Lv−200)/50⌋·gb2(50))/100)
   × (1 + (Grimoire35 + LUSTRE_SET + Shrine0 + Monument(0,6) + Box 12c+21c+23c + Fam20 + Artifact25
           + Atom9 + Shiny5 + MSA0 + OLA[178]·Shimmer + CropSC(0) + Vault41·log10(OLA[346]))/100)
   × (1 + (RiftSkillETC(0) + pctDmg1+2+3 + Artifact2 + Artifact8 + W5·⌊max(STR,LUK)/250⌋
           + A5·⌊AGI/250⌋ + M5·⌊WIS/250⌋ + ConstMastery(1) + Tome0 + Compass48 + Exotic41 + OLA[419])/100)
   × (1 + (GTN6 + SaltLick9 + Etc45 + Prayer15 + Mainframe 0+11+110 + Artifact27+29 + B_UPG(84,100)
           + Arcade46 + OLA[435])/100)
   × (1 + (Comp10 + Comp156 + Card42 + CardSet5)/100)
   × (1 + (20·PetArena(2) + 40·PetArena(15) + chip dmg + Meal TotDmg + conquistas + Bless 7 + Bless 8)/100)
   × max((1 − GTN24/100)·(1 − Buff(124)/100)·max(0.01, 1 − (Prayer6 + Prayer13 maldições)/100), 0.05)
   × (1+Minehead BonusQTY(0)/100) × (1+WepPowDmgPCT/100) × (1+Jelly37/100) × (1+RoyalStatue(0)/100)
   × (1+CoralKid(11)/100)^max(0, Div[25]−35)
   × (1 + min(150, WeeklyBoss.g)/100)            se WeeklyBoss tem "g"
   × 0.5                                          Cactolyte: quest Cactolyte3 = 0 e classe 2 e Quest47 no inventário
soft cap: 100 (^0.86 sobre o excedente), 2e7 (^0.8), 5e8 (^0.6), 2e9 (^0.45), 15e9 (^0.36), 6e10 (^0.28)
L2 ×= (1+Etc72/100)(1+Etc75/100)(1+Etc104/100)(1+Voting(1)/100)(1+Fountain_BonTOT(1,16)/100)
      (1+Sushi RoG49/100)(1+0.1·SuperBit64)(1+10·⌊(96+OLA[232])/100⌋/100)(1+Card96/100)
      max(1, StickerDMGmulti)(1+(Tome6 + ach371 + ach384)/100)(1 + max(0, min(2, KillroyDMG/100)))
L2 ×= max(1, (1+C12)(1+C33)(1+2·C160)(1+0.5·C168)(1+C170)) × (1+min(1.5·CardLv Crystal6, 15)/100)
      × (1+Meritoc5/100) × (1+min(100, GreenSigils·Grid127)/100)
L2 ×= 1.5                                         se BundlesReceived.bon_a == 1
L2 ×= 1 + Fam80/100
L2 = L2^(4/(5+OLA[473]))                          se Reliquarium (Quest105 no inventário)
L2 /= 100^Menagerie[5][2]                         se mapa 306
```

### O que falta no motor hoje (levantado em 02/11 contra o N.js acima)

| Termo | Situação | Origem do port |
|---|---|---|
| VaultKillzTotal(5/6), FlurboShop (WP), Roo(4), BubbaRoG(4), LankRank(14), Divinity Bonus_Minor, RiftSkillETC, Compass(48), MSA(0), CropSC(0), PetArena(2/15), SaltLick(9) | `[STUB]` em `derived-damage.ts` | **já portados** em outros sistemas (coin/afk/exp/dr2/w6/w7) — religar |
| Divinity BlesssBonus(7/8), eclipseSkulls, KillroyDMG, StickerDMGmulti | `[STUB]` | **novos** — portar do N.js |
| Owl(2) e Spelunk ShopUpgBonus(64) no L1 | **faltam** | Owl em `exp`; ShopUpgBonus em `w7/spelunking.ts` |
| Cglunko_upgBon(19) no L2 | **falta** | Cglunko em `afk`/`dr2` |
| Fountain_BonTOT(1,16) pós-cap | **falta** | `data/w5/fountain.ts` / exp |
| Comidas BaseDmgBoosts depois do cap do L0 | **falta** | novo (loop igual ao `WeaponPowerBoosts`) |
| Cactolyte ×0.5 | **falta** | novo |
| Reliquarium | `[STUB]` no-op | novo (`Quest105` em `InventoryOrder`) |
| Mapa 43 (RatDMG), Mastery | **faltam** | RoyalG `ArmoryUpgBonus` já existe em `w7/royalG.ts` |
| Mapa 306 | hoje fora, em `mapDamageDivisor` do overkill | vira regra dentro do Max |

O plano confere **cada** termo do bloco contra o port (não só a tabela acima), com a tag `@njs` de origem.

## Arquitetura

### Motor

- `lib/arkh/stats/defs/damage.ts`: descriptor próprio (como `multikill.ts`: L0/L1/L2 com soft caps não
  são passos do `grouped`). `dmgTotal(pools)` é **a única cópia** da fórmula: `combine` do descriptor,
  Biggest Gains (`lib/damage/gains.ts`) e o coletor passam por ela. Exporta `DMG_ROOT`, `DMG_NODES`,
  `DMG_POOLS`.
- `lib/arkh/stats/systems/damage/damage.ts`: as fontes (pools) de L0, L1, L2, Mastery, regras de mapa e
  buffs. Os resolvers dos termos saem de `derived-damage.ts` ou são importados dos sistemas que já os têm;
  os novos ficam no arquivo do sistema de origem.
- `computeMaxDamage(charIdx, ctx, mapIdx?)` vira um invólucro: pools → `dmgTotal` → Max. Assinatura
  compatível com os chamadores atuais. `computeOverkillTier` passa o mapa e **deixa de dividir** por
  `mapDamageDivisor` (a regra do 306 já está no Max).
- `lib/arkh/computeDamage.ts`: `computeArkhDamage(save, charIdx, mapIdx)`, `computeArkhDamagePools`,
  `combineDamagePools` (padrão `computeMultikill.ts`).
- Todo termo novo leva a tag `@njs` do bloco de origem (guard do registry).

### Árvore

Raiz `Damage` (valor = Max) com filhos:

| Nó | Conteúdo |
|---|---|
| `Base Damage` | fontes do L0; linha de regra "Base Damage soft cap" com o fator aplicado; comidas pós-cap |
| `Damage %` | grupos do L1 (soma base, ferraria, WinBonus, cadeia de talentos, comida dourada); linha "Damage % soft cap" |
| `Damage Multipliers` | um grupo por fator do L2; linha "Damage Multipliers soft cap"; pós-cap; Reliquarium e mapa 306 como linhas de regra |
| `Mastery (Min)` | fontes da Mastery; mostra Min = Max × Mastery; não entra no Max |

Nomes fixos (snapshot e Observed Max não mudam de caminho). Buffs 108/124 = fontes com 0 e nota.
Mapa 43 = total substituído por RatDMG (banner `replacedBy`).

### Página

- Rota `/damage`, entrada "⚔️ Damage" no menu Trackers (depois de Multikill).
- `lib/damage/{pageConfig,gains,format,topDamage,topDamage.meta}.ts`, `app/damage/` — padrão Multikill.
- Seletor de personagem + mapa (padrão = mapa atual do personagem).
- Total: `Min ~ Max` com `formatIdleon`. Compare, History/Save, Biggest Gains e Observed Max usam o Max.
- Notas: "Active buffs (Buff 108/124) are not counted"; "Masterclass forms (Wraith, Tempest, Tesseract)
  are not counted"; dungeon fora.
- Textos do site em inglês.

### Observed Max

- `scripts/update-top-damage.ts` com `runTopCollector` (roda offline com `--saves-dir`).
- Mapa do coletor: 251 (o mesmo do Multikill). Fora de 43 e 306 o Max não depende do mapa.
- `familySources` = fontes escaladas por stat: STAT (L0 e `min(150,…)`), STAT^0.7 (L1), bolhas
  W5/A5/M5 (L2), bdmgHP/bdmgSPD/bdmgMP (L0), `log(HP)·GTN86` e `log(MP)·GTN446` (L1). Resto = melhor
  entre famílias.
- Talentos de classe filtrados com `deriveGatedTalentsFor`.

## Impacto em outras páginas

- Coin Multi (talento 643) e Multikill: tier de overkill sobe/desce com os stubs completos. Esperado
  (mais perto do jogo). Os testes com save real desses trackers são rodados; pins que mudarem são
  atualizados **só** com justificativa no PR (termo que entrou).
- Coletor do Multikill (mapa 251, tier 51 no teto) não muda.

## Validação

1. Leitura no jogo: Player Info → Damage `Min~Max` do personagem logado + save capturado no mesmo
   momento (playbook `web/scripts/dr-debug/README.md`).
2. Site = jogo no `ceil` de Min e Max → teste de pin com o save (`__tests__/lib/arkh/`).
3. Se divergir: bisseção com duas leituras (playbook), termo a termo.
4. Checks: `npx tsc --noEmit`, `npx vitest run`, golden do updater.

## Riscos

- Termos de runtime (`_GenINFO` no MSA, Killroy, eclipse) podem não estar no save: o plano confirma a
  origem de cada um antes de portar; se for só runtime, vira 0 com nota (como os buffs).
- `TotStatMAP.MaxDmg812` é cache do jogo: o jogo pode mostrar um valor calculado antes de uma mudança.
  A leitura de validação é feita com o painel recém-aberto.
