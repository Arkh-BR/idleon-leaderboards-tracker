# Página Artifact Find (Sailing) — Design Spec

**Data:** 2026-10-31
**Status:** decisões aprovadas pelo usuário (31/10/2026, via perguntas); aguardando revisão deste spec
**Branch:** `feat/artifact-find-page` (a partir de `main` `031e18c`)

## Problema

O site tem trackers de Coin Multi, EXP Multi, AFK Gains e Multikill no kit `statTracker`. Todos calculam o
stat a partir do save, mostram a árvore de fontes, guardam snapshots, comparam com o Observed Max dos top
players e ranqueiam onde ganhar mais (💡 Biggest Gains). O usuário quer o mesmo tracker para o
**Artifact Find** do Sailing.

## Objetivos

- Página **"Artifact Find"** no mesmo formato de Coin/AFK/EXP (paridade de abas e comportamento).
- Total **igual ao "Artifact Find" mostrado no Skill Info de Sailing** do jogo, para o personagem logado.
- Nenhuma mudança visível nas páginas existentes.

## Decisões do usuário (31/10/2026)

| Tema | Decisão |
|---|---|
| Número principal | O multi do **Skill Info de Sailing** = `Sailing("BoatArtiMulti", 0)` (barco 0 fixo, como o jogo) |
| Abordagem | **Kit `statTracker`**: o kit ganha a opção "sem mapa" e o coletor a opção "sem família de classe" |
| Seletor | **Só personagem**, sem mapa |
| Observed Max | **Conta toda, sem família** — uma referência só |
| Escopo | **Só o multi** (sem chance % por ilha, sem seletor de barco) |
| Entrega | Um PR; merge só quando o usuário mandar |

## Fórmula (fonte da verdade: N.js vivo, snapshot sha `4a6cb9a0c645`)

`_customBlock_Sailing("BoatArtiMulti", b)` com `b = 0`. É o mesmo valor que o Skill Info empurra para
`_PlayerInfoNumbers`. Estrutura (parênteses conferidos no texto cru):

```
max(1, A × M1 × M2 × … × M23)
```

**A — grupo aditivo:** `1 + (soma)/100`, onde a soma é

| # | Termo |
|---|---|
| A1 | `Sailing("ArtifactBonus", 3)` |
| A2 | `CaptBonusCalc(3, Boats[b][0])` — bônus do capitão do barco (ver novos termos) |
| A3 | `Breeding("ShinyBonusS", 21)` |
| A4 | `20 · RandomEvent("FractalIslandBonus", 3)` |
| A5 | `GetBribeBonus("34")` |
| A6 | `25 · min(30, NONdummies[60])` |
| A7 | `ArcadeBonus(32) + ArcadeBonus(66)` |
| A8 | `Holes("B_UPG", 55)` |
| A9 | `FarmingStuffs("StickerBonus", 2, 99)` |
| A10 | `ResearchStuff("Grid_Bonus", 109)` |
| A11 | `Summoning("VaultUpgBonus", 63)` |

**M — fatores multiplicativos, nesta ordem:**

| # | Fator |
|---|---|
| M1 | `1 + StarSigns["61"]/100` — Artifosho (+15%), **único termo do personagem** |
| M2 | `1 + StickerBonus(2, 100)/100` |
| M3 | `MenagerieStuff("NightmarinerBon", 0)` |
| M4 | `max(1, min(2, 1 + 2·Companions(154)) + CompLV2(154))` |
| M5 | `max(1, RandomEvent("KillroyBonuses", 0))` |
| M6 | `1 + Minehead("Button_Bonuses", 3)/100` |
| M7 | `1 + Grid_Bonus(106)/100` |
| M8 | `1 + AlchVials["6turtle"]/100` |
| M9 | `max(1, 1.5 ^ Stuff2("PurpleChestSlugsOwned"))` — `= round(EventShopOwned(48))` |
| M10 | `1 + SushiStuff("RoG_BonusQTY", 7)/100` |
| M11 | `1 + Summoning("WinBonus", 3)/100` |
| M12 | `1 + JellyOperation("RoG_BonusQTY", 19)/100` |
| M13 | `DaveyJonesBonus(b)` (ver novos termos) |
| M14 | `1 + MainframeBonus(14)/100` |
| M15 | `1 + Thingies("LoreEpiBon", 3)/100` |
| M16 | `1 + Ninja("PristineBon", 2)/100` |
| M17 | `1 + Summoning("VotingBonusz", 20)/100` — voto semanal |
| M18 | `1 + Companions(43)` |
| M19 | `max(1, Companions(56)/5)` |
| M20 | `1 + Holes("MonumentROGbonuses", 1, 2)/100` |
| M21 | `1 + FarmingStuffs("ExoticBonusQTY", 45)/100` |
| M22 | `1 + GamingStatType("PaletteBonus", 5)/100` |
| M23 | `max(1, 1.02 ^ Spelunk[6].length · GamingStatType("SuperBitType", 26))` |

### Termos novos no motor

O motor (`web/lib/arkh`) já tem a maioria dos termos (usados por DR, Coin, EXP). Faltam:

| Termo | N.js |
|---|---|
| `CaptBonusCalc(d, capitão)` | soma `Captains[c][3]·Captains[c][5]` se `Captains[c][1] == d` e `Captains[c][3]·Captains[c][6]` se `Captains[c][2] == d`; 0 se capitão < 0 |
| `FractalIslandBonus(3)` | `DNSM.FracIsBn[3]` = `OLA[184] ≥ limiar[3]`, limiares de `_GenINFO[25]` da tela de eventos (a extrair) |
| `NONdummies[60]` | campo bruto do save (a localizar no loader) |
| `CompLV2(154)` | `CompanionLVz[154] ≥ 1` (o motor já lê o campo LV2 dos companions — reusar) |
| `PurpleChestSlugsOwned` | `round(EventShopOwned(48))` |
| `LoreEpiBon(3)` | `(1 + (GrimoireUpgBonus 17 + TROLL_SET)/100) · a · f(GenInfo[84] − b)`, com `a` e `b` = os dois números de `Spelunky[21][3]`, se `Spelunk[13][2] > 3`, com `f(x) = ⌊x/100⌋^0.7/(25 + ⌊x/100⌋^0.7)`. **Risco:** `GenInfo[84]` é um número de runtime; identificar a origem no plano. |
| `DaveyJonesBonus(b)` | `(1 + (50·GemItemsPurchased[8] + LegendPTS_bonus(11))/100) · (1 + 2·clamp01(⌊(Boats[b][3] + Boats[b][5] + 99600)/1e5⌋ · Grid_Bonus(105, 1)))` |

Todo termo novo leva a tag `@njs` do bloco de origem (guard do registry).

## Arquitetura

### Motor

- `lib/arkh/stats/defs/artifact-find.ts`: descritor agrupado (`groupedDescriptor`), um grupo `pct` (A) e
  um grupo `mult` por fator M, com o mesmo padrão de `coin-multi.ts`. Exporta `ARTI_ROOT`, `ARTI_GROUPS`
  e o nome do voto (`ARTI_VOTE_NAME`) para o Biggest Gains pular.
- `lib/arkh/stats/systems/w5/sailing.ts` (existente) recebe `CaptBonusCalc` e `DaveyJonesBonus`; os outros
  termos novos vão no arquivo do sistema de origem (event shop, companions, spelunk/thingies).
- `lib/arkh/computeArtifactFind.ts`: `computeArkhArtifactPools(save, charIdx)` e
  `computeArkhArtifactFind(save, charIdx)` → `{ tree, total }`, igual a `computeCoin`.

### Kit

- `StatPageConfig.noMap?: true`: o `StatCalculator` esconde o seletor de mapa e passa `mapIdx = 0` para o
  `compute` (que o ignora). O rótulo vira "Character:". Sem `noMap`, nada muda.
- `StatCollectorConfig.perFamily?: false`: o coletor junta todos os chars numa família só
  (`"all"`) e o arquivo gerado mantém o mesmo formato (`*_FAMILY_FLAT`, `*FlatForClass`), então a página
  não muda. Sem talentos de classe: `gated: []`.

### Página

- `lib/artifactFind/pageConfig.ts` (`ARTIFACT_PAGE`), `format.ts` (formato do Skill Info:
  `> 1e4 → NotateNumber Big`, senão `MultiplierInfo`; reusar `notateBig`/`notateMultiplierInfo` de
  `lib/coinMulti/format.ts`), `topArtifactFind.ts` (+ `.meta.ts`) gerados.
- `app/artifact-find/` com o `StatPageClient` do kit; título "Artifact Find Tracker", URL `/artifact-find`,
  emoji 🏺, item no grupo "📈 Trackers" da barra e card na home, como os outros.
- Textos em inglês.

### Observed Max

- `scripts/update-top-artifact.ts` sobre `runTopCollector` com `perFamily: false`, `gated: []`,
  `focusBoard: "sailing"`.
- Primeira referência gerada com `--saves-dir scripts/updater/.cache/saves-fresh` (a API de perfis do IT
  recusa daqui com 403; o cron do GitHub passa).
- O workflow de refresh (`refresh-top-max`) ganha o passo do Artifact.

## Validação e testes

1. **Fórmula:** cada termo conferido contra o N.js; `@njs` em todo termo novo; guard do registry verde.
2. **Jogo:** um print do Skill Info de Sailing (personagem logado) + o save capturado no mesmo momento
   (`web/scripts/dr-debug/README.md`). Teste de save real fixa o valor (pula sem o save, como os outros).
3. **Unitários:** cada termo novo com um caso pequeno; o lookup gerado sem família; o kit sem mapa.
4. `tsc --noEmit`, `vitest run` e o check do Vercel verdes; conferência da página em produção depois do
   merge.

## Fora do escopo

- Chance % por ilha/baú (`ArtifactChance`), que depende da ilha, dos artefatos que faltam e do tier.
- Seletor de barco (os termos A2 e M13 variam por barco; o jogo mostra o barco 0).
- Observed Max por família de classe.
