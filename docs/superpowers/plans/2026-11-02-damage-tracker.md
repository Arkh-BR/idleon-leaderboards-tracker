# Damage Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/damage` com o Damage do Player Info (`Min ~ Max`) por personagem e mapa, no kit `statTracker`, e o dano máximo do motor virando fonte única (overkill tier usa o mesmo número).

**Architecture:** Descriptor próprio `defs/damage.ts` (três camadas L0/L1/L2 de `StatGroup` do `grouped.ts` + passos de soft cap/pow, raiz com `replace` do mapa 43, nó Mastery fora do Max). O corpo de `computeMaxDamage` sai de `derived-damage.ts` e vira o sistema `systems/damage/damage.ts` (uma fonte por termo do N.js); `computeMaxDamage` passa a ser `dmgMax` sobre essas fontes. Primeiro migra sem mudar o número, depois completa os termos.

**Tech Stack:** Next.js 16 / TypeScript, vitest, tsx scripts. App em `web/` (todos os caminhos abaixo são relativos a `web/`).

**Spec:** `docs/superpowers/specs/2026-11-02-damage-tracker-design.md` (na raiz do repo)

## Global Constraints

- N.js é a única fonte da verdade: `web/data/njs-snapshot/formulas.json`, chave `_customBlock_DamageDealed` (e o bloco de cada termo). IdleonToolbox nunca é referência.
- Todo termo portado/novo leva `// @njs <NomeDoBloco>`; depois de mexer em tags, rodar `npx tsx scripts/updater/registry/gen-registry.ts` e commitar `scripts/updater/registry/formula-registry.gen.ts`.
- Textos do site em inglês. Respostas/commits: mensagens de commit em inglês, terminando com a linha exata `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nunca `npm run dev`. Verificação: `npx tsc --noEmit`, `npx vitest run <arquivos>`, scripts tsx.
- Stage só os arquivos da task (nunca `git add -A`). Branch `feat/damage-tracker`; nunca commitar na `main`.
- Nada em `web/lib/it` muda.
- Saves reais: `scripts/updater/golden/.cache/*.json` (gitignored). Testes com save real usam `describe.skipIf(!existsSync(path))`; o implementer confirma que **não** pularam (`--reporter=verbose`).
- Buffs `GetBuffBonuses(108,2)` e `(124,2)`: fonte presente com valor **0** e nota `"active buff only"`.
- Formas Wraith/Tempest/Tesseract e ramo de dungeon: não implementados.
- Número na página: `formatIdleon` de `lib/format.ts`.

## Review Focus

- Personagem com termo neutro (sem bolha, sem talento, sem companion): fonte emitida com o valor neutro do grupo (0 em `pct`/`add`, 1 em `mult`), nunca omitida nem `NaN` — senão `totalFromFlat` ≠ total da árvore. Teste na Task 1 (combine com pools vazios) e Task 6 (gains = árvore em save real).
- Mapa 43 e 306 no seletor: total substituído pelo RatDMG / dividido; Biggest Gains não ranqueia nada no 43 (`replacedBy`). Teste na Task 3 e Task 6.
- Personagem não logado (sem `CurrentMap` válido) → página abre no primeiro mapa da lista sem erro (comportamento do kit; coberto pelo kit, não retestar).
- Dano acima de 6e10 em L2 e de 1e8 em L1 (contas endgame): soft caps encadeados na ordem do N.js. Teste na Task 1.
- Save sem nada de W5–W7 (conta nova): nenhum resolver lança exceção; Max finito > 0. Teste na Task 2 (save mais fraco do `.cache`).

---

### Task 1: Descriptor `defs/damage.ts`

**Files:**
- Create: `lib/arkh/stats/defs/damage.ts`
- Test: `__tests__/lib/arkh/damage.combine.test.ts`

**Interfaces:**
- Consumes: `StatGroup`, `applyGroupStep`, `groupVal`, `groupNote`, `neutralValue` de `defs/grouped.ts`; `Descriptor`, `SourceSpec` de `stats/tree-builder`.
- Produces:
  - `DMG_ROOT = "Damage"`
  - `DMG_NODES = { base: "Base Damage", pct: "Damage %", mult: "Damage Multipliers", mastery: "Mastery (Min)" }`
  - `DMG_RULES = { capBase: "Base Damage soft cap", capPct: "Damage % soft cap", capMult: "Damage Multipliers soft cap", relic: "Reliquarium", rat: "Royal Guardian arena (map 43)" }`
  - `type DmgStep = StatGroup | { key: string; name: string; kind: "cap" } | { key: string; name: string; kind: "pow"; sources: readonly string[] }`
  - `type DmgLayer = { key: "base" | "pct" | "mult"; node: string; start: number; steps: readonly DmgStep[] }`
  - `DMG_LAYERS: readonly DmgLayer[]`, `DMG_MASTERY: StatGroup` (key `mastery`), `DMG_RAT: StatGroup` (key `rat`, kind `replace`)
  - `DMG_GROUPS: readonly StatGroup[]` — todo `StatGroup` das camadas + mastery + rat (para o coletor e valores neutros)
  - `capBase(v)`, `capPct(v)`, `capMult(v): number`
  - `type ValsOf = (key: string) => readonly number[]`
  - `dmgLayer(layer: DmgLayer, valsOf: ValsOf): { val: number; capIn: number; capOut: number }`
  - `dmgMax(valsOf: ValsOf): number` — `L0·L1·L2`, depois o `replace` do rat
  - `dmgMastery(valsOf: ValsOf): number` — `min(0.8, 0.35 + Σ/100)`; `0.2` quando o rat substitui
  - `default` export: o `Descriptor` (`id: "damage"`, `scope: "character+map"`, `category: "progression"`, pools = um pool por passo com fontes — cada `StatGroup` e o `pow` — com `{ system: "damage", id }`; o pool do `pow` não está em `DMG_GROUPS`, e o coletor o trata como `pct`, cujo neutro 0 é o neutro do `pow`)
  - O sistema registrado se chama `"damage"`.

Grupos (chave · tipo · nome no tree · ids das fontes, na ordem do N.js). Nomes de grupo são únicos na camada; os ids são os que a Task 2 resolve.

| Camada (start) | key | kind | name | ids |
|---|---|---|---|---|
| base (0) | `l0` | add | `Base Damage sources` | `wpSquared statType goldFoodBase statWpFloor arcade0 owl1 vault0 vault20 stampBaseDmg etc16 statue0 boxBaseDmg bubbleHP bubbleSPD bubbleMP card4 sigil4 cardFallEvent2` |
| | `capBase` | cap | `Base Damage soft cap` | — |
| | `l0food` | add | `Food (after soft cap)` | `foodBaseDmg` |
| pct (1) | `l1base` | pct | `Damage % sources` | `statPow vault27 vault15 vault10 bribe30 bribe20 stampPctDmg lankRank14 statue22 talent113 talent86 talent446 owl2 roo4 bubbaRoG4 vault80 spelunkShop64` |
| | `l1smith` | pct | `Smithing level` | `talent284` |
| | `l1win` | pct | `Summoning Win Bonus` | `win0` |
| | `l1chain` | pct | `Talents & skills` | `talent463 bubbleW12 bubbleA12 bubbleM12 tc31 tc110 tc125 tc485 tc305 tc470 bUpg57 talent290 tc656 talent649 talent638 talent658 divMinor7` |
| | `l1gold` | mult | `Golden Food` | `goldFoodDmg` |
| | `capPct` | cap | `Damage % soft cap` | — |
| mult (1) | `l2wb` | mult | `Workbench` | `workbench` |
| | `l2a` | mult | `Multipliers` | `vial7dmg eclipse palette34 dream6 pristine0 summUpg79 cglunko19` |
| | `l2buff` | pct | `Buffs, Friends & Star Signs` | `buff108 friend0 starSignPctDmg divinity507 level50` |
| | `l2grim` | pct | `Account bonuses I` | `grimoire35 lustreSet shrine0 monument06 box12c box21c box23c fam20 artifact25 atom9 shiny5 msa0 shimmer178 cropSC0 vault41` |
| | `l2rift` | pct | `Account bonuses II` | `riftEtc0 pctDmg1 pctDmg2 pctDmg3 artifact2 artifact8 bubbleW5 bubbleA5 bubbleM5 constMastery1 tome0 compass48 exotic41 ola419` |
| | `l2t6` | pct | `Account bonuses III` | `talent6 saltLick9 etc45 prayer15 mainframe0 mainframe11 mainframe110 artifact27 artifact29 bUpg84 arcade46 ola435` |
| | `l2comp` | pct | `Companions & Cards` | `comp10 comp156 card42 cardSet5` |
| | `l2arena` | pct | `Arena, Chips, Meals & Achievements` | `petArena2 petArena15 chipDmg mealTotDmg achievements bless7 bless8` |
| | `l2penalty` | mult | `Penalties` | `penalty` |
| | `l2late` | mult | `Late multipliers` | `minehead0 wepPowDmg jelly37 royalStatue0 coralKid11 weeklyBoss cactolyte` |
| | `capMult` | cap | `Damage Multipliers soft cap` | — |
| | `l2post` | mult | `After soft cap` | `etc72 etc75 etc104 voting1 fountain16 sushi49 superBit64 ola232 card96 sticker tome6 killroy` |
| | `l2post2` | mult | `Companions, Crystal & Sigils` | `companions crystal6 meritoc5 greenSigils` |
| | `l2bundle` | mult | `Bundle & Family` | `bundleA fam80` |
| | `l2relic` | pow | `Reliquarium` | `reliquarium` |
| | `l2map` | mult | `Map` | `map306` |
| raiz | `rat` | replace | `Royal Guardian arena (map 43)` | `ratDmg` |
| mastery | `mastery` | pct | `Mastery (Min)` | `talent113b bubbleMastery card21 talent123 etc21` |

Semântica dos valores (contrato com a Task 2): fonte `mult` = fator já pronto (`1 + x/100`, ou o fator do N.js); fonte `pct`/`add` = o termo somado; `pow` = expoente quando ativo, 0 quando não (0 = passo neutro); `replace` = valor > 0 só no mapa 43; `talent113b` = `−GTN(2,113)` (negativo). Soft caps (N.js):
- `capBase`: `v > 4000 → 4000 + (v−4000)^0.91`; depois `v > 15000 → 15000 + (v−15000)^0.84`
- `capPct`: `>100 → 100 + (v−100)^0.86`; `>2e6 → 2e6·(v/2e6)^0.5`; `>1e8 → 1e8·(v/1e8)^0.3`
- `capMult`: `>100 → 100 + (v−100)^0.86`; `>2e7 → 2e7·(v/2e7)^0.8`; `>5e8 → ·^0.6`; `>2e9 → ·^0.45`; `>15e9 → ·^0.36`; `>6e10 → ·^0.28`

Tree do `combine`: raiz `Damage` (val = Max, fmt `raw`, note `"Min ~ Max · Min = Max × Mastery"`), filhos = um nó por camada (val = valor da camada, children = um nó por passo: grupo com seus itens, `cap` como linha com `val = capOut/capIn` fmt `x` e note `"<capIn> → <capOut>"`, `pow` como grupo com seu item), depois o grupo `rat` (sempre emitido), depois o nó `Mastery (Min)` (val = mastery, children = itens). O `combine` não recebe ctx (o coletor chama sem).

- [ ] **Step 1: Escrever os testes que falham** em `__tests__/lib/arkh/damage.combine.test.ts`:
  - `capBase(5000)` ≈ `4000 + 1000**0.91`; `capBase(20000)` = cap em duas etapas (calcular a expectativa no teste com as mesmas constantes); `capBase(3000) === 3000`.
  - `capPct(3e8)` encadeia os três; `capMult(1e11)` encadeia os seis; `capMult(50) === 50`.
  - `combine` com pools vazios (todo grupo sem itens) → `val` finito; L0 = 0 → Max = 0, sem `NaN` na árvore.
  - Pools sintéticos: `l0 = [5000]`, `l1base = [50]`, `l2a = [2]`, resto vazio → Max = `capBase(5000) · 1.5 · 2`.
  - `l2relic = [0.5]` com L2 = 400 → L2 vira `400**0.5`; `l2relic = [0]` → passo neutro.
  - `rat = [123]` → Max = 123 e `dmgMastery` = 0.2; `rat = [0]` → não substitui.
  - `mastery = [10, 5]` → `0.5`; `mastery = [100]` → `0.8`.
  - Árvore: filhos da raiz na ordem `Base Damage, Damage %, Damage Multipliers, Royal Guardian arena (map 43), Mastery (Min)`.
- [ ] **Step 2:** `npx vitest run __tests__/lib/arkh/damage.combine.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar `defs/damage.ts`** com as interfaces acima. `dmgLayer` aplica `applyGroupStep` para `StatGroup`, o cap da camada para `cap`, `v ** e` para `pow` com `e > 0`. `// @njs DamageDealed` no `dmgMax` e nos caps.
- [ ] **Step 4:** testes passam; `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** `git add lib/arkh/stats/defs/damage.ts __tests__/lib/arkh/damage.combine.test.ts` → `feat(damage): descriptor with L0/L1/L2 soft caps`.

---

### Task 2: Sistema `damage` — migração sem mudar o número

**Files:**
- Create: `lib/arkh/stats/systems/damage/damage.ts`, `lib/arkh/computeDamage.ts`
- Modify: `lib/arkh/stats/systems/common/derived-damage.ts` (remove o corpo de `computeMaxDamage`; mantém WP, speed, accuracy, `talentCalcTerms`, `greenSigilDmgPct`, `mapDamageDivisor`, star sign helper e os stubs ainda não religados), `lib/arkh/stats/registry.ts` (registra `damage`), `lib/arkh/stats/systems/common/overkill.ts` e todo importador de `computeMaxDamage` (novo caminho), `__tests__/lib/arkh/max-damage-*.test.ts` (import)
- Test: `__tests__/lib/arkh/damage.migrate.save.test.ts`

**Interfaces:**
- Consumes: Task 1 (`DMG_LAYERS`, `DMG_GROUPS`, `dmgMax`, descriptor default).
- Produces:
  - `damage: SystemResolver` (padrão `systems/multikill/multikill.ts`: `resolve(id, ctx)` → `ArkhNode`); `DMG_CLASS_TALENTS: readonly number[]` = todo id de talento lido pelo bloco (o coletor filtra com `deriveGatedTalentsFor`).
  - `damageValsOf(ctx: SystemCtx): ValsOf` — resolve todos os ids e devolve os valores por grupo (memo por ctx, como `overkillMemo`).
  - `computeMaxDamage(charIdx: number, ctx: Ctx, mapIdx?: number): number` — agora em `systems/damage/damage.ts`; `mapIdx` default = mapa salvo do char. Mesma assinatura para quem passa 2 argumentos.
  - `computeArkhDamage(save, charIdx, mapIdx)`, `computeArkhDamagePools(save, charIdx, mapIdx)`, `combineDamagePools(pools)` em `computeDamage.ts` (padrão `computeMultikill.ts`).
- Nomes de nó: `label("Talent", n)` (sufixo `(Talent n)`) para todo talento — o coletor gateia por esse sufixo. Buffs: fonte `buff108` com nome `"Buff 108 (active buff only)"` e val 0; o buff 124 é filho da fonte `penalty`, nome `"Buff 124 (active buff only)"`, val 0.

Nesta task **todo termo mantém o valor de hoje**: os stubs continuam 0/1, os termos que faltam (Owl2, Spelunk64, Cglunko19, Fountain16, food pós-cap, Cactolyte, Reliquarium, map306, rat, mastery, buffs) entram como fontes com o valor neutro. O que muda é só onde o número mora.

- [ ] **Step 1: Capturar o número atual.** Antes de mexer, rodar um script tsx (scratch, não commitado) que imprime `computeMaxDamage(ci, ctx)` para todos os chars de `scripts/updater/golden/.cache/arkhe-live-2026-11-01-postupdate.json` e de 3 outros saves do `.cache` (o mais forte, um médio e o mais fraco por nível de conta). Gravar esses valores no teste do Step 2.
- [ ] **Step 2: Teste que falha** `damage.migrate.save.test.ts`: para cada save/char capturado, `computeMaxDamage` (novo caminho) ≈ valor antigo (`toBeCloseTo` relativo 1e-9) e `computeArkhDamage(save, ci, mapaSalvo).total` igual a ele; árvore sem `NaN` (flattenTree); save fraco → Max finito > 0. `skipIf` sem os saves.
- [ ] **Step 3:** rodar → FAIL (módulo não existe).
- [ ] **Step 4: Implementar** o sistema (um `case` por id da tabela da Task 1, com `// @njs` do bloco de origem e note curta com o termo do N.js), `computeDamage.ts`, registro, e trocar os imports.
- [ ] **Step 5:** `npx vitest run __tests__/lib/arkh/damage.migrate.save.test.ts __tests__/lib/arkh/max-damage-bare-gtn.test.ts __tests__/lib/arkh/max-damage-talentcalc-once.test.ts __tests__/lib/arkh/overkill.test.ts __tests__/lib/arkh/coin-multi.save.test.ts __tests__/lib/arkh/multikill.save.test.ts --reporter=verbose` → tudo passa, nenhum pulado; `npx tsc --noEmit` limpo.
- [ ] **Step 6:** `npx tsx scripts/updater/registry/gen-registry.ts`.
- [ ] **Step 7: Commit** (arquivos da task + `formula-registry.gen.ts`) → `refactor(damage): max damage as the damage system's sources (same number)`.

---

### Task 3: Religar termos já portados em outros sistemas + regras de mapa

**Files:**
- Modify: `lib/arkh/stats/systems/damage/damage.ts`, `lib/arkh/stats/systems/common/derived-damage.ts` (apaga os stubs religados; Flurbo vive no WP)
- Test: `__tests__/lib/arkh/damage-terms.test.ts`, atualizar `damage.migrate.save.test.ts`

**Interfaces:**
- Consumes: Task 2. Os ports existentes (localizar com grep; não reimplementar): `VaultKillzTotal` (`coin/accountKills.ts`), Flurbo shop (onde `defs/coin-multi.ts`/`afk-gains.ts` o tiram), `RooBonuses` (`afk/afk.ts`/`coin/coin.ts`), `BubbaRoG_Bonuses` (`exp/bubba.ts`), `LankRankUpgBonus` (`w6/farming.ts`/`dr2`), Divinity `Bonus_Minor` (`coin/divinityMinor.ts`), `RiftSkillETC` (`common/derived-stats.ts`), `CompassBonus` (`exp/compass.ts`), `MSA_Bonus` (`exp/msa.ts`), `CropSCbonus` (`dr2`), `PetArenaBonus` (`exp/petArenaCruc.ts`), `SaltLick` (`exp/saltLick.ts`), `OwlBonuses` (`exp/exp.ts`), `Spelunk ShopUpgBonus` (`w7/spelunking.ts`), `Cglunko_upgBon` (`afk`/`dr2`), `Fountain_BonTOT` (`data/w5/fountain.ts`/exp), RoyalG `ArmoryUpgBonus` (`w7/royalG.ts`).
- Produces: as fontes da tabela da Task 1 com o valor do N.js (não mais neutro) para: `vault20 vault27` (Killz 5/6), Flurbo no `wpSquared`, `roo4 bubbaRoG4 lankRank14 divMinor7 riftEtc0 compass48 msa0 cropSC0 petArena2 petArena15 saltLick9 owl2 spelunkShop64 cglunko19 fountain16 foodBaseDmg cactolyte reliquarium map306 ratDmg` e as cinco fontes de `mastery`.

Regras do N.js para os termos novos desta task:
- `foodBaseDmg`: Σ sobre os `FoodSlotsOwned` slots de comida com `Effect == "BaseDmgBoosts"` e quantidade ≠ 0 de `Amount × FoodBonuses("BaseDmgBoostsEffectBonus")` — o multiplicador de comida já calculado para `WeaponPowerBoosts` em `derived-damage.ts` (mesma função `FoodBonuses`); extrair esse multiplicador para um helper compartilhado em vez de duplicar.
- `cactolyte`: `0.5` se `QuestComplete.Cactolyte3 == 0` **e** classe do char `== 2` **e** `Quest47` no inventário; senão `1`.
- `reliquarium`: expoente `4/(5 + OLA[473])` se `"Quest105"` está em `InventoryOrder`; senão `0`.
- `map306`: `1 / 100^Menagerie[5][2]` no mapa 306; senão `1` (mesma leitura de `mapDamageDivisor`, que deixa de ser usado pelo overkill na Task 5).
- `ratDmg`: no mapa 43, `(10 + ArmoryUpgBonus(35)) · (1 + ArmoryUpgBonus(36)/100)`; senão `0`.
- `mastery`: `talent113b = −GTN(2,113)`, `bubbleMastery = AlchBubbles.Mastery`, `card21 = CardBonusREAL(21)`, `talent123 = GTN(1,123)`, `etc21 = EtcBonuses("21")`.

- [ ] **Step 1: Testes que falham** `damage-terms.test.ts` (save real `arkhe-live-2026-11-01-postupdate.json`, `skipIf`): para cada fonte religada, `damage.resolve(id, ctx).val` = o mesmo helper chamado direto (prova o fio, não a fórmula); `ratDmg` > 0 só com `mapIdx = 43`; `map306` < 1 só com `mapIdx = 306` (se `Menagerie[5][2] > 0` no save; senão asserção de `=== 1` e comentário); `reliquarium` coerente com `Quest105` no inventário do save; `combineDamagePools` com `mapIdx = 43` → `total === ratDmg`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar.** Cada termo novo leva `// @njs` do bloco (`RoyalG`, `ReliquariumInPosession`, `FoodBonuses`, …).
- [ ] **Step 4:** atualizar `damage.migrate.save.test.ts`: os valores esperados agora vêm de um novo script de captura (o número **muda** de propósito); o teste vira pin de regressão "valor da Task 3". Registrar no commit, por save, `antes → depois` do Max.
- [ ] **Step 5:** `npx vitest run __tests__/lib/arkh/damage*.test.ts --reporter=verbose`; `npx tsc --noEmit`; `gen-registry.ts`.
- [ ] **Step 6: Commit** → `feat(damage): wire already-ported damage terms, map 43/306, Reliquarium, Cactolyte, mastery`.

---

### Task 4: Ports novos (Bless, eclipse skulls, Killroy, sticker)

**Files:**
- Modify: `lib/arkh/stats/systems/damage/damage.ts`; os ports ficam no sistema de origem: `systems/w5/divinity.ts` (ou o arquivo de divindade existente) para `BlesssBonus`, `systems/w4/rift.ts` (ou o de rift existente) para `eclipseSkulls`/`KillroyDMG`, `systems/w6/farming.ts` para `StickerDMGmulti`
- Test: `__tests__/lib/arkh/damage-ports.test.ts`

**Interfaces:**
- Produces: `divinityBlessBonus(i: number, s: SaveData): number` (N.js `Divinity("BlesssBonus", i)`), `eclipseSkulls(s): number` (`RiftStuff("eclipseSkulls")`), `killroyDmg(s): number` (`RiftStuff("KillroyDMG")`), `stickerDmgMulti(s): number` (`FarmingStuffs("StickerDMGmulti")` = `1 + Grid_Bonus(47)·TotalStickers/100` se `FarmingStickerDMG_unlocked`, senão 1); fontes `bless7 bless8 eclipse killroy sticker` ligadas.

- [ ] **Step 1: Ler cada bloco** em `formulas.json`. Para cada leitura que não vem do save (ex.: `_GenINFO`, `PixelHelperActor`, `CalcTalentMAP`), achar a origem no save ou concluir que é só runtime; runtime-only → fonte 0 com note `"runtime only"` e registrar no relatório da task. Conferir também se `MSA_Bonus` (religado na Task 3) depende de `_GenINFO[114]`: se sim, documentar a origem usada pelo port existente.
- [ ] **Step 2: Testes que falham** `damage-ports.test.ts`: para cada port, um caso no save real com o valor esperado calculado **à mão no teste** a partir dos campos crus do save (montar a expressão do N.js no próprio teste com os campos lidos de `saveData`), e um caso de borda (sistema não desbloqueado → 0 / 1).
- [ ] **Step 3:** FAIL. **Step 4:** implementar com `// @njs`. **Step 5:** testes + `tsc` + `gen-registry.ts`; atualizar o pin da Task 3 (`antes → depois` no commit).
- [ ] **Step 6: Commit** → `feat(damage): port Divinity bless, eclipse skulls, Killroy damage, sticker damage multi`.

---

### Task 5: Overkill na fonte única

**Files:**
- Modify: `lib/arkh/stats/systems/common/overkill.ts`, `lib/arkh/stats/systems/common/derived-damage.ts` (apaga `mapDamageDivisor` se ficar sem uso), `__tests__/lib/arkh/overkill.test.ts`, `__tests__/lib/arkh/coin-multi.save.test.ts`, `__tests__/lib/arkh/multikill.save.test.ts`, `__tests__/lib/arkh/multikill.smoke.test.ts` (só os pins que mudarem)
- Test: os mesmos

**Interfaces:**
- Consumes: `computeMaxDamage(ci, ctx, mapIdx)` da Task 2.
- Produces: `computeOverkillTier`/`overkillStuffs` chamam `computeMaxDamage(ci, ctx, map)` e **não** dividem mais por `mapDamageDivisor` (a regra do 306 está no Max via `map306`). `opts.maxDmg`, se existir, segue sendo o Max já com mapa.

- [ ] **Step 1:** teste em `overkill.test.ts`: no mapa 306 o tier usa `computeMaxDamage(ci, ctx, 306)` sem divisão extra (comparar com `computeMaxDamage(ci, ctx, 100) / 100^Menagerie[5][2]` do mesmo char). FAIL.
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** rodar `npx vitest run __tests__/lib/arkh --reporter=verbose`. Para cada pin de Coin/Multikill que mudar: confirmar que a mudança vem de tier de overkill (imprimir tier antes/depois) e atualizar o pin com comentário `// tier X→Y: max damage completed (damage tracker)`. Pin que mude por outro motivo = bug, parar e investigar.
- [ ] **Step 4:** `npx tsc --noEmit`; `npx tsx scripts/updater/golden/run.ts` verde (atualizar refs do golden só se a diferença for o tier, explicado no commit).
- [ ] **Step 5: Commit** → `feat(overkill): read the damage tracker's max damage (map rules included)`.

---

### Task 6: Página `/damage`

**Files:**
- Create: `lib/damage/format.ts`, `lib/damage/gains.ts`, `lib/damage/pageConfig.ts`, `lib/damage/topDamage.ts` (placeholder gerado à mão no formato do coletor, vazio — a Task 7 regenera), `lib/damage/topDamage.meta.ts`, `app/damage/page.tsx`, `app/damage/DamagePageClient.tsx`
- Modify: `lib/statTracker/config.ts` (opcionais `headline?(tree: ArkhNode, total: number): string`; `unit` aceita `""`), `components/statTracker/StatCalculator.tsx` (usa `headline` quando houver), `components/statTracker/StatSnapshotSection.tsx` (`<Num unit={unit}>` em vez de `"x"` fixo), `components/TopNav.tsx` (`{ href: "/damage", label: "⚔️ Damage" }` depois de Multikill)
- Test: `__tests__/lib/damage/gains.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`DMG_*`, `dmgMax`, `computeArkhDamage`).
- Produces:
  - `formatDamage(x: number): string` = `formatIdleon(Math.ceil(x))`.
  - `damageGainsModel: GainsModel`: `sources` = toda fonte direta de grupos `StatGroup` das três camadas (não `cap`, não `pow`, não `rat`, não `mastery`), display por kind (`pct`→"pct", `add`→"raw", `mult`→"x"), pulando a fonte `Buff 108 (active buff only)`; `totalFromFlat(flat)` = `dmgMax` com `valsOf(key)` lido de `directChildren("Damage / <camada> / <grupo>")` (rat: `"Damage / <rat>"`); `replacedBy` = nome do rat quando > 0.
  - `DAMAGE_PAGE: StatPageConfig` — `statName: "Damage"`, `gainLabel: "Damage"`, `emoji: "⚔️"`, `calculatorTitle: "Damage Calculator"`, `totalLabel: "Damage"`, `unit: ""`, `formatTotal: formatDamage`, `headline: (tree, total) => \`${formatDamage(total × mastery)} ~ ${formatDamage(total)}\`` (mastery = val do nó `Mastery (Min)`), `totalTitle` = Min e Max com `toLocaleString("en-US")`, storage keys `damage-tracker.*` / `damage.snapshot-section.collapsed.v1` / `damage-snapshots`, `compute` via `computeArkhDamage`.
  - Copy (inglês): subtitle "Computes every character's damage from your save — the Damage line of the in-game Player Info panel (Min ~ Max). Select character & map. All processing local in your browser."; mapTitle "The map sets the Royal Guardian arena (map 43) and Clamworks' damage divider (map 306)"; methodologyNote cobre: gain medido no Max, Observed Max por família só nas fontes de stat, "Active buffs (Talents 108/124) and masterclass forms (Wraith, Tempest, Tesseract) are not counted", dungeon fora.
- `app/damage/page.tsx` metadata `title: "Damage Tracker"` + description no padrão Multikill.

- [ ] **Step 1: Testes que falham** `__tests__/lib/damage/gains.test.ts` (save real, `skipIf`): para 3 chars, `damageGainsModel.totalFromFlat(flattenTree(tree)) ≈ tree.val` (relativo 1e-9), também com `mapIdx` 43 e 306; `replacedBy` não-nulo só no 43; `sources` não contém `cap`/`rat`/`mastery`/buffs; trocar uma fonte `pct` por um valor maior aumenta `totalFromFlat`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar arquivos + kit (`headline`, `unit: ""`) + TopNav.
- [ ] **Step 4:** testes + `npx vitest run __tests__/lib/statTracker` (kit não regrediu) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** → `feat(damage): /damage page on the statTracker kit`.

---

### Task 7: Observed Max (coletor)

**Files:**
- Create: `scripts/update-top-damage.ts`
- Modify: `lib/arkh/computeDamage.ts` (exporta `DMG_COLLECTOR_MAP = 251`)
- Generated: `lib/damage/topDamage.ts`, `lib/damage/topDamage.meta.ts`

**Interfaces:**
- Consumes: `runTopCollector` (`scripts/_shared/topStatCollector.ts`), `deriveGatedTalentsFor(DMG_CLASS_TALENTS)`, `computeArkhDamagePools(save, ci, 251)`, `combineDamagePools`, `DMG_GROUPS`, `DMG_ROOT`.
- Produces: `TOP_DAMAGE_*` + `topDamageFlatForClass` (o `pageConfig` da Task 6 já importa esses nomes).
- Config: `label: "Damage"`, `focusBoard: "monstersKilled"` (não há board de dano; o de combate, como o Multikill), `groups: DMG_GROUPS`, mapa fixo `251` (`DMG_COLLECTOR_MAP` exportado de `computeDamage.ts`), `familySources` = itens por nome (nomes reais dos nós da Task 2): em `l0` as linhas de `statType`, `statWpFloor`, `bubbleHP`, `bubbleSPD`, `bubbleMP`; em `l1base` `statPow`, `talent86`, `talent446`; em `l2rift` `bubbleW5`, `bubbleA5`, `bubbleM5`.

- [ ] **Step 1:** escrever o script (header no padrão `update-top-multikill.ts`, explicando mapa e familySources).
- [ ] **Step 2:** `npx tsx scripts/update-top-damage.ts --saves-dir scripts/updater/.cache/saves-fresh` → gera os dois arquivos; conferir no log: nenhum save com erro além dos já conhecidos, `maxTotal` finito.
- [ ] **Step 3:** `npx tsc --noEmit`; `npx vitest run __tests__/lib/damage`.
- [ ] **Step 4: Commit** (script + 2 gerados) → `feat(damage): Observed Max collector (per family only for stat-scaled sources)`.

---

### Task 8: Validação no jogo + PR (controller, com o usuário)

Não é task de subagente: precisa de leitura do jogo.

- [ ] **Step 1:** pedir ao usuário (AskUserQuestion) a leitura do Player Info → Damage `Min~Max` de um personagem, capturando o save no mesmo momento (playbook `web/scripts/dr-debug/README.md`: hook no site de prod → Sync now → receiver `scripts/dr-debug/capture/receiver.mjs` → `build-envelope.ts`).
- [ ] **Step 2:** comparar `ceil(Min)`/`ceil(Max)` do site com o jogo. Divergiu → bisseção com duas leituras (playbook), termo a termo; corrigir na task de origem.
- [ ] **Step 3:** pin `__tests__/lib/arkh/damage-live-2026-11-02.save.test.ts` com o save capturado em `scripts/updater/golden/.cache/`.
- [ ] **Step 4:** suíte completa `npx vitest run`, `npx tsc --noEmit`, golden; push; PR com tabela de pins que mudaram (Coin/Multikill) e o motivo; link do preview Vercel (commit status `Vercel`).
- [ ] **Step 5:** não mergear; esperar pedido do usuário (review postado no PR antes de qualquer merge).
