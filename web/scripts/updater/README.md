# Atualizador automático — track de mudanças do Idleon

Detecta o que mudou no jogo a cada atualização comparando o **N.js** live com o
baseline versionado, e junta o changelog da Steam.

## Uso (rodar de dentro de `web/`)

```bash
npx tsx scripts/updater/run.ts            # baixa o N.js live, diffa, gera relatório
npx tsx scripts/updater/run.ts --no-fetch # usa o N.js da raiz do repo como "atual" (seed inicial)
npx tsx scripts/updater/run.ts --dry      # só relata, não grava snapshots
```

Depois de rodar:

```bash
# revise o relatório e o diff dos dados
git diff web/data/njs-snapshot
git add web/data/njs-snapshot && git commit -m "chore(updater): bump baseline"
```

## Como funciona

Diffar o `N.js` cru (25 MB, minificado pelo Closure Compiler) é inútil: os
símbolos são renomeados a cada build. Em vez disso, extraímos **dados de chave
estável** e versionamos só eles — o `git diff` dos snapshots vira o changelog.

1. **`normalizeBundle`** remove o reflow de linha que o Closure injeta em pontos
   arbitrários (a fonte #1 de falsos positivos), preservando strings/regex.
2. Três camadas de extração (`extract.ts`):
   - **lists** — blocos `<obj>.<NomeEstável>=function(){return <literal>}`
     (CustomLists e constantes de gameplay).
   - **items** — `…b.h.<campo>=<valor>; … addNewEquip("KEY")`.
   - **strings** — literais de conteúdo legível (rede de segurança p/ mapas,
     monstros, diálogos, talentos).
3. **`diff.ts`** compara baseline × atual (added / removed / changed).
4. **`steam.ts`** puxa as notas via Steam News API (app 1476970, sem auth).
5. **`run.ts`** orquestra e escreve `…/reports/report-<data>.md`.

## Artefatos

- `web/data/njs-snapshot/{items,lists,strings,meta}.json` — baseline (commitado).
- `web/data/njs-snapshot/reports/report-<data>.md` — relatório por atualização.
- `web/scripts/updater/.cache/N.new.js` — download cru (gitignored, ~25 MB).

## Estendendo

Para capturar um novo tipo de dado (ex.: monstros, mapas), adicione um extrator
em `extract.ts` que opere sobre o bundle **já normalizado** e devolva um mapa
`chave → valor`, e inclua-o em `extractAll` + numa nova seção do `run.ts`.
