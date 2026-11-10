# Talents no `lib/game` — Design

Data: 2026-11-09. Relacionado: `2026-11-03-game-engine-rewrite-design.md` (motor e Rulings), `2026-11-09-dr-v1-on-lib-game-design.md` (mesmo molde).

## Objetivo

A página `/talents-level` deixa de calcular no `lib/arkh` e passa a calcular no `lib/game`, sem mudar a tela.

Sucesso:
- o valor de cada talento é o do jogo;
- a árvore tem os mesmos caminhos de hoje, então a aba Hypothetical continua comparando com a referência salva (`lib/talentsLevel/topTalents.ts`);
- as abas To Max e Unbooked mostram os mesmos dados;
- nada do código novo importa `@/lib/arkh` em runtime.

## Decisões do usuário (09/11)

- A árvore é recriada inteira, com os mesmos caminhos (como no DR V1).
- Execução por subagentes, uma tarefa por família, com a troca de motor só no fim.
- Validação só com os saves mais novos (`feedback-oracle-newest-saves-only`).
- Onde o `lib/arkh` tem contador zerado (ex.: inventário), o valor segue o N.js.

## Fora do escopo

- O coletor `scripts/update-top-talents.ts` e os scripts de debug: passo próprio. Eles continuam chamando `computeTalentTreesForChars`, que mantém a assinatura.
- Mudar a tela, os textos ou a aba Hypothetical.
- Apagar o `lib/arkh` (último passo do roteiro).

## Arquitetura

### Entrada

`lib/game/trackers/talents.ts`:

`computeGameTalent(save, charIdx, talentId, opts?: { presetIdx?: 0 | 1; forceSuperActive?: boolean }): ArkhNode`

`lib/talentsLevel/compute.ts` mantém `computeTalentEffective`, `computeTalentTreesForChars` e `getActivePresetIdx` com as mesmas assinaturas, e passa a chamar a função acima. `useMaxResearchBaseLevel` sai das opções: a página não usa.

### A árvore

A raiz é a linha do talento, com o mesmo nome (`label("Talent", id)`). Os formatos são os de hoje:

| Caso | Filhos |
|---|---|
| Comum (id < 615) | `Active`, `Effective Level` → `Base Level`, `Bonus Levels`, `Super Levels` (quando o talento pode ser super) |
| Conta inteira | `Effective Level` do melhor personagem, com `Reference Character` sob `Base Level` |
| Estrela (id ≥ 615) | `Active`, `Level`, `Max Level` |
| Com wrap | os filhos do caso acima, mais `Talent Value` e o contador |

O miolo vem de `lib/dropRate/explain/talent.ts`, que já monta `Base Level`, `Max Book Lv Cap` e `Bonus Levels` a partir dos blocos do jogo. Ele ganha o que só esta página usa:
- `Super Levels` separada de `Bonus Levels`, com `Active` e a nota "would give +X" quando inativa. O DR V1 continua com a linha dentro de `Bonus Levels`;
- `forceSuperActive`, usada pela aba Hypothetical;
- o cap de cada talento no lugar do `Max Book Lv Cap`, quando há cap booster.

### Famílias

Cada família é uma tarefa, em `lib/talentsLevel/explain/`:

1. **Talento comum, conta inteira e estrela.** Inclui os caps de estrela: `SkillLevelsMAX` no máximo entre os personagens, os cinco de `Tasks[2][w][3]` (627, 630, 634, 651, 652), e 641–647 no `maxBookLv` vivo.
2. **Cap boosters** (12 talentos: 10, 11, 12, 23, 75, 79, 86, 87, 266, 267, 446, 447). Base fixa mais o valor de cada talento fonte, com a árvore da fonte embutida, o clamp de bolha (`CauldronInfo`) e o `SkillLevelsMAX` salvo como piso.
3. **Wraps** (63 talentos com valor final próprio). Tabela nova em `lib/talentsLevel/wraps.ts`, agrupada por tipo de contador (`OptionsListAccount`, `Lv0`, stats derivados, totais de upgrades, `TalentCalc`, inventário). Cada contador lê bloco do `lib/game`; o que faltar é portado do N.js na tarefa.
4. **To Max, Unbooked e nomes.** `computeMaxBookLv`, `SkillLevelsMAX`, `SLpre` e `entityName` passam a vir do `lib/game` (ou de `lib/talentsLevel`, para os dados de exibição). `accountWideTalents` e os cap boosters saem do `lib/arkh`; o `lib/arkh` reexporta (Ruling B).

### Presets

O `GameState` é congelado. Para ver o outro preset, a entrada monta um envelope derivado, com `SL_i` trocado por `SLpre_i` e `PlayerStuff_i[1]` pelo preset pedido, e constrói um `GameState` próprio. É isso que o `lib/arkh` faz hoje na memória, agora sem mutar nada.

### Página

`app/talents-level/TalentsLevelPageClient.tsx` não muda além dos imports de tipo. Erros passam por `pageError`, como nas outras páginas.

## Validação

**Só com os saves mais novos.**

- Um teste com saves reais (`skipIf` sem saves) compara a árvore nova com a do `lib/arkh`, caminho por caminho (mesmos caminhos, valores a 1e-9, formatos e notas), nos 5 saves mais novos, em todos os talentos da classe de cada personagem, nos 2 presets. Reaproveita `__tests__/lib/game/support/v1Compare.ts`.
- Onde o `lib/arkh` estiver errado, a árvore segue o N.js e a diferença entra numa lista explícita, com a evidência no N.js e o caminho afetado. Candidatos já conhecidos: `InvStorageOwned` (0 no `lib/arkh`) e os contadores de `TalentCalc` que ele deixa zerados.
- Cada família tem teste sintético, que roda no CI sem saves.
- `characterize --recent 5` em Damage, Coin, EXP, DR V2, AFK e Multikill se um bloco compartilhado mudar.
- Antes do PR: suíte no worktree limpo (Node 22), `tsc` e conferência do usuário no jogo.

## Riscos

- **Tamanho.** São cerca de 3.300 linhas no `lib/arkh` (`talent.ts` e os wraps). Boa parte é o que o `explain/talent.ts` já cobre, mas os 63 wraps pedem contadores que podem não estar portados.
- **Contadores de sessão.** Um contador que só existe com o jogo aberto passa por `runtime()`/`assumed()`, com a nota escrita, e não vira erro na página.
- **Cobertura.** Os 5 saves mais novos são de uma conta só, então classes que ela não tem ficam só nos sintéticos.
- **Licença.** Os rótulos internos seguem os atuais. A decisão sobre eles é a mesma do DR V1, na troca de licença.
