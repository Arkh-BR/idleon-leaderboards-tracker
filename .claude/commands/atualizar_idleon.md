---
description: Processa o PR auto-update do Idleon (porta as fórmulas sinalizadas, roda o golden, deixa o PR pronto pra merge). Nunca mergeia na main.
---

Você vai processar um PR **auto-update** criado pelo workflow `idleon-update-watch` (a Fase 4 do updater). Objetivo: portar qualquer mudança de fórmula sinalizada até o golden ficar verde, e devolver o PR pronto pra o usuário mergear. **NUNCA mergeie na main** — o merge é gate humano.

Trabalhe a partir da raiz do repo `idleon-leaderboards-tracker` (o app fica em `web/`). Siga os passos:

## 1. Achar o PR auto-update
- `git fetch origin`
- Liste o PR aberto:
  `gh pr list --state open --json number,headRefName,title,url --jq '.[] | select(.headRefName|startswith("auto-update-"))'`
- Se **não houver** nenhum: avise "nenhum PR auto-update aberto — o vigia está quieto" e **pare**.
- Faça checkout do branch do PR: `git checkout <headRefName>` e `git pull`.

## 2. Ler o relatório de impacto
- Abra o relatório mais recente em `web/data/njs-snapshot/reports/report-*.md` (o do dia).
- Foque na seção **"Impacto nas fórmulas portadas"**:
  - `revise <arquivo>` = uma fórmula portada **mapeada** mudou → precisa re-portar.
  - `⚠️ NÃO catalogado` = fórmula mudou mas não está no registry → investigue se alimenta algum sistema portado (DR/Tome/Cooking/Talents); é a rede de segurança.
- Veja também a seção **"Fórmulas"** do diff: ela mostra a expressão **antes → depois** do N.js.

## 3. Portar cada fórmula sinalizada (fielmente)
Para cada uma:
- Pegue a expressão nova autoritativa em `web/data/njs-snapshot/formulas.json` (N.js live) e, pra leitura, o TS correspondente em `web/scripts/it-source/` (clone do IdleonToolbox).
- Compare **termo a termo** contra o nosso port (o arquivo apontado pelo registry / relatório). Registry: `web/scripts/updater/registry/formula-registry.gen.ts`.
- Corrija a divergência. Engines: DR `web/lib/arkh/`, Tome `web/lib/tome/`, Cooking `web/lib/cookingMastery/`, Talents `web/lib/talentsLevel/`.
- **Regra de ouro:** nunca commite uma fórmula que você não conseguiu verificar. Na dúvida, deixe o código como está e registre no PR `⚠️ precisa de humano: <fórmula> — <motivo>`.
- Metodologia de referência: o fix do **Cards Total LV** (termo do spelunking no `maxStars`) — extrair a expr do N.js, diffar contra o port, corrigir; e atenção a **constantes hardcoded** (ex. `CARDS_PER_TIER`, `MASTERY_COEF`, `fountain.ts`) que mudanças de lista não pegam sozinhas.

## 4. Validar
- Golden até ficar verde: `cd web && npx tsx scripts/updater/golden/run.ts`. Se um termo novo não é alcançado por nenhum save real, adicione um caso sintético em `scripts/updater/golden/cases.ts`.
- Checks: `cd web && npm run build && npm run test`.

## 5. Atualizar o PR (sem mergear)
- Commite os fixes **só dos arquivos tocados** (NUNCA `git add -A`), e `git push` no branch do PR.
- `gh pr ready <number>` (tira de draft).
- Se estava `needs-human` e o golden agora passa: `gh pr edit <number> --remove-label needs-human --add-label auto-update || true`.

## 6. Reportar
Resuma: o que mudou no jogo, o que você portou (arquivo + termo), status do golden, e o que (se algo) ainda **precisa de humano**. Finalize com: **"PR pronto para revisão + merge (seu gate)"** e o link do PR. **Não mergeie.**

---

**Se o PR já estiver `clean`** (sem fórmula pra portar): só confirme que o golden está verde (`cd web && npx tsx scripts/updater/golden/run.ts`) e diga que está pronto pra mergear.

**Lembretes do projeto:** repo compartilhado (sempre `git fetch` antes; nunca commitar/divergir a main local); nunca rodar `npm run dev`; textos do site em inglês. Referência completa: `docs/superpowers/runbooks/2026-06-23-updater-phase4-runbook.md`.
