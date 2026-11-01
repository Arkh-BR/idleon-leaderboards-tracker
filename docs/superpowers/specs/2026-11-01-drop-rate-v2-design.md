# Drop Rate V2 (do zero, no kit dos trackers) — Design Spec

**Data:** 2026-11-01
**Status:** design aprovado pelo usuário (01/11/2026, via perguntas); aguardando revisão deste spec
**Branch:** `feat/drop-rate-v2` (a partir de `main` `e2fa06f`)

## Problema

O Drop Rate atual (`/drop-rate`) é um port do corgan-source: pools com categorização (`categorize.ts`),
telas próprias (`DrCalculator`, `DeepView`, `BiggestGains`, `SnapshotSection`) e coletor próprio
(`update-top-dr.ts`). Os trackers novos (Coin, EXP, AFK, Multikill, Artifact Find) usam o kit `statTracker`,
um descritor por grupos fiel ao N.js e o coletor compartilhado com Observed Max por família de classe. O
usuário quer um **DR V2 do zero**, no mesmo formato dos trackers novos.

## Objetivos (decisões do usuário, 01/11/2026)

| Tema | Decisão |
|---|---|
| Objetivo | Mesma UX dos trackers · código fiel ao N.js (um termo por linha, na ordem) · Observed Max por família de classe |
| V1 | **Intocado** — código e tela do DR atual não mudam; o V1 continua sendo a página `/drop-rate` |
| Convivência | `/drop-rate-v2` no grupo "📈 Trackers" como **"🎲 Drop Rate V2 (beta)"** |
| Extras além do kit | **Toggle do Arcane no Compare** (incluir/excluir o multiplicador do Arcane Map no Observed Max) |
| Validação | **Só N.js + jogo** — o V1 não é critério |
| Dungeon | **Fora do V2** |
| Abordagem | **A**: estender o descritor por grupos do kit com passos em ordem (`add`, `replace`) |
| Entrega | Um PR; merge só quando o usuário mandar |

## Fórmula (fonte da verdade: N.js vivo, snapshot sha `4a6cb9a0c645`)

`_customBlock_TotalStats("Drop_Rarity")` (N.js @4188223), fora de dungeon:

1. `DropRateLUK` = curva de `TotalStats("LUK")`: `LUK < 1000 → ((LUK+1)^0.37 − 1)/40`, senão
   `0.5·(LUK − 1000)/(LUK + 2500) + 0.297`.
2. `DropRateLUK2` = soma de: `min(10, 1.5·CardLv(mini5a))`, `min(100, 4·CardLv(caveC) + 6·CardLv(caveD))`,
   `min(20, 2·CardLv(anni4Event1))`, `min(25, 3·CardLv(luckEvent1))`, `GoldFoodBonuses("DropRatez")`,
   `6·AchieveStatus(377)`, `4·AchieveStatus(381)`, `OwlBonuses(4)`, `LankRankUpgBonus(9)`, `VotingBonusz(27)`,
   `B_UPG(46)`, `CropSCbonus(7)`, `GrimoireUpgBonus(44)`, `VaultUpgBonus(18)`, `MeasurementBonusTOTAL(15)`,
   `Companions(22)`, `Companions(158)`, `B_UPG(82, 20)`, `MonumentROGbonuses(2, 6)`, `EmperorBon(11)`,
   `EFAUNT_SET`, `ExoticBonusQTY(59)`, `FriendBonusStatz(3)`, `LegendPTS_bonus(1)`, `Spelunk ShopUpgBonus(50)`,
   `Companions(111)`, `GetTalentNumber(1, 239) · RoyalG("TotalStatz")`.
3. **Base** = `1 + 1.4·DropRateLUK + (Σ)/100`, Σ = `GetTalentNumber(1,279)`, `BoxRewards.DropRate`,
   `EtcBonuses("2")`, `EtcBonuses("102")`, `AlchBubbles.DropRate`, `CardBonusREAL(10)`, `GetTalentNumber(1,24)`,
   `StarSigns.Drop`, `GuildBonuses(10)`, `CardSetBonuses("5")`, `CardSetBonuses("6")`, `Shrine(4)`,
   `prayersReal(7)`, `SigilBonus(11)`, `ShinyBonusS(0)`, `ArcadeBonus(27)`, `Companions(3)`, `Companions(50)`,
   `StampBonusOfTypeX("DropRate")`, `GetTalentNumber(1,655)·OLA[189]`, `5·Dream[10]`, `WinBonus(9)`,
   `TomeBonus(2)`, `DropRateLUK2`, `Grid_Bonus(173)`, `Companions(132)`.
   (A curva do LUK fica **fora** do `/100` — confirmado no PR #27.)
4. **Piso do chip:** se `< 5`: `min(5, x + chipBonuses("dr")/100)`.
5. **Pós-processamento, nesta ordem:** `+2` se `bun_v` · `× WorkbenchStuff("AdditionExtraEXPnDR")` ·
   `+0.3` se `OLA[232] ≥ 1` · `×1.2` se `bun_p` ·
   `× (1 + ArcaneMapMulti_bon/100) × (1 + RoyalG StatueBon(1)/100) × (1 + Menagerie BoostQTY(24)/100) ×
   (1 + CardBonusREAL(101)/100) × (1 + FamBonusQTYs["32"]/100) × (1 + 0.3·Companions(168)) ×
   (1 + min(0.5, Companions(132)) + 0.2·CompLV2(132)) × (1 + (Sushi RoG(48) + Jelly RoG(14))/100) ×
   max(1, Minehead GlimboDRmulti) × (1 + TomeBonus(7)/100) × (1 + EtcBonuses("99")/100) ×
   (1 + Minehead BonusQTY(0)/100) × (1 + 5·CloudBonus(69)/100)` ·
   `× (1 + PristineBon(3)/100) × (1 + EtcBonuses("91")/100) × (1 + AlchVials["7drMulto"]/100)` ·
   `× max(1, min(1.3, 1 + Companions(26)) · (1 + 0.5·Companions(160)))` ·
   `× max(1, min(1.01, 1 + Companions(50)/2500))`.
6. **Cove:** no mapa 216 com `Holes[0][char] == 17`, o total vira `Holes2("Cglunko_DR")`.

## Arquitetura

### Kit (extensão aditiva — os trackers atuais não mudam)

- `lib/arkh/stats/defs/grouped.ts`: novos `GroupKind`:
  - `add` — `total += Σ`; com `below?: number` vira `total < below ? min(below, total + Σ) : total` (piso do chip);
  - `replace` — só com o primeiro valor finito > 0 (emitir 0 quando não se aplica); `total = esse valor` (Cove).
  `groupedDescriptor.combine` e `groupedGainsModel.totalFromFlat` passam a aplicar cada grupo como um passo
  em ordem (`pct/raw/min4/mult` continuam multiplicando como hoje). `neutralValue`: `add → 0`,
  `replace → 0` (nenhuma troca). Display no Biggest Gains: `add`/`replace` → `raw`.
- `StatPageConfig.refToggle?: { label: string; title: string; groupPath: string }`: um checkbox no Compare;
  desligado, o subtree em `groupPath` (filho direto da raiz: `<raiz> / <grupo>`) é removido da referência e
  só a raiz é recomputada, com `totalFromFlat`. Só a linha-base do Compare; o Biggest Gains mantém a
  referência completa. Sem `refToggle`, nada muda.

### Motor

- `lib/arkh/stats/defs/drop-rate-v2.ts`: `DR2_ROOT = "Drop Rate"`, `DR2_GROUPS` na ordem da fórmula:
  - **base** (`pct`): a fonte da curva do LUK em % (`140·DropRateLUK`), cada termo de Σ e cada termo do
    `DropRateLUK2` como **fonte individual** (para o Biggest Gains apontar cada um);
  - **chip** (`add`, `below: 5`), **bun_v** (`add`), **Workbench** (`mult`), **OLA[232]** (`add`),
    **bun_p** (`mult`), um grupo por fator do passo 5 (`pct`, `raw` ou `mult`/`max1` conforme a forma),
    **Cove** (`replace`).
  - `DR2_VOTE_NAME` (Vote 27, fora do Biggest Gains como nos outros trackers).
- `lib/arkh/stats/systems/dr2/dr2.ts`: `resolveDr2(id, ctx)`, um id por termo, nomes no padrão
  "nome do jogo (Fonte N)" com jargão na nota; reusa os helpers existentes **sem alterá-los** (onde o nome
  do helper é compartilhado com o V1, renomeia na chamada com `renamed()`). `@njs` em todo termo novo.
- `lib/arkh/computeDropRateV2.ts`: `computeArkhDropRateV2(raw, ci, map)`, `computeArkhDropRateV2Pools`,
  `combineDropRateV2Pools`, `bestDrMapIdx(save, ci)` (mapa de luta com o maior bônus Arcane slot 0, fora o 216).
- Talentos de classe da fórmula (`GetTalentNumber(1, …)`: 24, 239, 279, 655) listados em
  `DR2_CLASS_TALENTS` para o gating por classe do coletor. O 328 do Workbench **não** entra: o N.js
  o lê como `getbonus2(1,328,-1)` (@7821743), o melhor valor entre todos os personagens da conta,
  então não depende da classe.

### Página

- `lib/dropRateV2/{pageConfig,format}.ts` (formato do painel de stats do jogo: até 9999 com 2 casas, acima disso `Math.floor(DR)` — confirmar o texto exato do painel no N.js durante o plano),
  `app/drop-rate-v2/` com o `StatPageClient` do kit, item "🎲 Drop Rate V2 (beta)" no menu e card na home
  marcado beta. `refToggle` = a fonte do Arcane Map Multi. Textos em inglês.

### Observed Max

- `scripts/update-top-dr2.ts` sobre `runTopCollector` (por família de classe, padrão), mapa
  `bestDrMapIdx`, `gated: deriveGatedTalentsFor(DR2_CLASS_TALENTS)`, `focusBoard: "dropRate"` (o mesmo do V1).
  Referência inicial dos saves em cache (`--saves-dir`); passo novo no `refresh-top-max` (orçamento de tempo
  revisto).

## Validação e testes

1. Termo a termo contra o N.js (`@njs`, guard do registry verde).
2. **Jogo:** leitura do Drop Rate no painel do personagem + save capturado no mesmo momento
   (`scripts/dr-debug/README.md`); teste de save real fixado (pula sem o save). Se não bater: bisseção com
   duas leituras do playbook.
3. Unitários: os tipos `add`/`replace` no descritor e no modelo de ganhos; o `refToggle`; o lookup gerado.
4. `tsc --noEmit`, `vitest run`, CI e Vercel verdes; conferência em produção depois do merge.
5. O V1 **não é critério**; uma comparação V1 × V2 pode ser usada só como diagnóstico.

## Fora do escopo

- Dungeon (fórmula `1 + (LUK + DungeonStat)/100`).
- Substituir ou remover o V1 (passo futuro, separado).
- Toggle do Chip Gallery e o catálogo "Max DR" do V1.
