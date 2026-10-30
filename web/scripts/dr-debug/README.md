# DR ≠ jogo — playbook para achar a diferença

Método que achou o −0,112% de DR após o update de 2026-10 (PR #56): Dank Ranks
(talento 207) sem os +125 níveis de super talent do *outro* preset. Vale para
qualquer stat do engine (DR, Coin, EXP…), não só DR.

**Regra de ouro: a fonte da verdade é o N.js** (`data/njs-snapshot/formulas.json`,
`scripts/updater/.cache/N.new.js`). IdleonToolbox não é referência: bater com o IT
não prova nada.

Todos os scripts rodam de dentro de `web/`:
`npx tsx --tsconfig tsconfig.json scripts/dr-debug/<script>.ts …`

---

## 1. Reproduza o valor do site EXATO, no MESMO estado do print

Print do jogo e save precisam ser do mesmo momento. Logo após o print, espere
cerca de 1 min (o jogo salva na nuvem). Então:

1. Abra o site (prod ou preview) no navegador embutido e faça o login do jogo.
   **Feche o popup do Google** depois: popup aberto bloqueia o `javascript_tool`.
2. Rode `node scripts/dr-debug/capture/receiver.mjs <pasta-de-saída>` (fica
   ouvindo em `127.0.0.1:8767`).
3. Cole os dois trechos de `capture/in-page.js` via `javascript_tool`: o (A)
   intercepta o `fetch`, depois clique em "Sync now", e o (B) empacota e envia.
4. `build-envelope.ts <pasta>/bundle.json <saída>/envelope.json <char> <mapa>`
   remonta o envelope igual ao `lib/gameAuth/envelope.ts` e imprime o DR. Ele
   **tem que bater com o site ao centavo**; se não bater, o save não é o mesmo.

Por que esse caminho: o CSP do site bloqueia `fetch` para localhost, o
clipboard é negado no painel, o `window.open` reaproveita a mesma aba e o fetch
do Firestore (cross-origin) não aparece em `read_network_requests`. Navegar para
`127.0.0.1/#<gzip+base64>` funciona. **Nunca toque no token**
(`gameAuth.session.v1`).

O painel de stats do jogo mostra `Math.floor(DR)` quando DR > 9999, então o
valor real está em `[leitura, leitura+1)`.

## 2. Descarte regressão antes de caçar no update

Se "antes do update batia", rode os testes de save real
(`__tests__/lib/arkh/family-guy-dr.test.ts`: setembro, 363.893,46). Os saves
privados ficam em `scripts/updater/golden/.cache/` (gitignored). Sem eles os
testes são **pulados** e o verde é falso; procure cópias em
`.claude/worktrees/*/web/scripts/updater/golden/.cache/`.
Se o save antigo ainda bate, o erro está numa mecânica nova que o save atual
exercita.

## 3. Bisseção com uma 2ª leitura do jogo (o passo decisivo)

`bisect.ts <envelope> <char> <mapa> <leitura-do-jogo> [slot-da-comida]` tira um
termo grande (por padrão a comida dourada do slot 0) e imprime o valor que o
jogo deve mostrar em cada hipótese:

| hipótese | o que significa |
|---|---|
| multiplicativa | erro num ×fator da cadeia final |
| aditiva constante | um termo do pool aditivo fora da comida |
| proporcional ao Golden Food | erro no multiplicador do GFood |

Peça ao usuário a leitura do jogo sem o termo e passe-a como 5º argumento
(`--second <leitura2>`). O script cruza as duas leituras e devolve a **faixa
exata** do termo que falta (ex.: +91,08 a +91,15 pp aditivo). Daí, procure qual
termo, com um nível, um doubler ou um multiplicador a mais, dá exatamente esse
valor. No caso de 2026-10: o Dank Ranks no nível 802 dava +91,1 pp, e 802 era
o nível do talento 328 (que inclui o super talent).

## 4. Varredura do que o update mudou

- `njs-reach.mjs <git-ref-antigo> [Drop_Rarity]` lista as fórmulas do N.js
  alcançáveis a partir do ramo do stat que **mudaram de verdade** (diff
  insensível a renome do minificador).
  Com `--calls ArtifactBonus` (ou `ExoticBonusQTY`, `PaletteBonus`, `UpgradeQTY`…)
  lista quais índices o caminho do stat consulta.
- `njs-collisions.mjs` lista sub-casos homônimos (`"X"==d` em vários
  dispatchers). O `formulas.json` guarda só um por nome, então a mudança dos
  outros some do diff (ex.: `UpgradeQTY`, `RoG_BonusQTY`).
- `custommaps-diff.mjs` compara `custommaps.js` com os builders `a.h.K=…` do
  N.js. O updater **não** regenera esse arquivo.
- Mudanças em `_customEvent_*` e nos blocos gigantes (`TalentCalc`,
  `TotalStats`) ficam em `fdiff-big`. `AlchBubbles`, `BoxRewards`,
  `CardBonusS`, `FamBonusQTYs` e `MealBonusesS` são montados dentro de
  `TalentCalc`.

## 5. Diff de árvore entre dois saves

`tree-diff.ts <saveA> <saveB> <charA> <mapA> <charB> <mapB>` mostra cada folha
que mudou. Folhas que mudaram por mecânica nova são os suspeitos. O caso de
2026-10 apareceu assim: a refeição do Golden Food tinha dobrado
(BonusMultiCook) e o Corsair trocado.

## Armadilhas já pagas

- **getbonus2 / AllTalentLVz("t|g")**: o super talent conta se `t` estiver em
  *qualquer* preset do jogador `g`. Os outros caminhos olham só o preset
  atual (`talent.ts → superTalentListed`).
- Leitura do jogo = `floor` (> 9999). Golden Food = **atribuição** (vale a última
  comida dourada do mesmo efeito, não soma).
- Galeria: nametag `n` = item `EquipmentNametag{n}` (6 → `6b`), troféu =
  `Trophy{id}`, tier por pódios `PodiumsOwned_Lv2/3/4`.
- Voto ativo = `serverVars.voteCategories[0]`. `voteCat2` e `OLA[453]` são da
  Meritocracia.
- `OLA[200]` é o DR **máximo** já visto, não o atual. Não use como alvo.
