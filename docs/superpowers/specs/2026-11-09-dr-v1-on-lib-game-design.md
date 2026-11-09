# Drop Rate V1 no `lib/game` — Design

Data: 2026-11-09. Relacionado: `2026-11-03-game-engine-rewrite-design.md` (motor e Rulings A–FFF), `2026-11-01-drop-rate-v2-design.md`.

## Objetivo

A página `/drop-rate` deixa de calcular no `lib/arkh` e passa a calcular no `lib/game`, sem mudar a tela. É a última página de tracker no motor antigo, e tirá-la é necessário pra trocar a licença do repo.

Sucesso:
- o total é o mesmo do jogo (a leitura do Player Info, com o jogo recém-aberto);
- a árvore tem os mesmos caminhos da V1, até os 15 níveis;
- snapshots antigos e o Compare vs Observed Max continuam comparando linha a linha;
- nada do código novo importa `@/lib/arkh` em runtime.

## Decisões do usuário (09/11)

- A V1 não é aposentada e continua como página própria, ao lado da V2.
- A árvore é recriada inteira (15 níveis, ~1740 linhas num save atual), e não só até a fonte.
- Construção por explicadores, um por família, com troca de motor única, no fim: até lá nada muda pro jogador.
- Validação só com os saves mais novos.

## Fora do escopo

Continuam no `lib/arkh` e precisam de outro passo antes da troca de licença:
- a ferramenta de pesquisa DR Max (`lib/dropRate/maxToolEntry.ts`, `scripts/build-dr-bundle.ts`, e a opção `useMaxResearchBaseLevel`);
- os 29 scripts de debug e auditoria que importam `lib/arkh/computeDR`;
- `/talents-level` (`lib/talentsLevel/compute.ts`);
- o coletor do Observed Max, que gera `lib/dropRate/topDropRate.ts`.

## Arquitetura

### Entrada

`computeGameDropRateV1(save, charIdx, mapIdx, opts?: { chipGalleryActive?: boolean }): { tree: ArkhNode; total: number }` em `lib/game/trackers/dropRateV1.ts`.

- O total vem de uma única chamada de `TotalStats(ctx, "Drop_Rarity")`, a mesma da V2. Um guard confere que a árvore recombina até esse total (na mesma linha do guard do Multikill: compara as partes com as chamadas do próprio bloco, pra uma diferença de ordem de soma não virar erro na página).
- O tipo do nó (`ArkhNode`, hoje em `lib/arkh/node`) passa pra `lib/dropRate/node.ts`, e o `lib/arkh` reexporta.

### Topo da árvore

Raiz `Drop Rate`, filhos nomeados como hoje: `LUK Scaling`, `Additive Pool`, `Total Sum`, `Chip Cap-Break`, `Post-Processing`. Os caminhos são os do `flattenTree` (`lib/dropRate/treeFlatten.ts`), incluindo o sufixo `#i` de irmãos com o mesmo nome. A ordem das fontes e dos buckets é a da V1, inclusive a regra "runs" do Post-Processing.

### Agrupamento por sistema

`lib/arkh/stats/categorize.ts` (buckets 🎯 Talents, Cards…, `systemWorld`, `classifySystem`) é reescrito em `lib/dropRate/systems.ts`, e o `lib/arkh` reexporta (Ruling B). `DeepView` passa a importar de lá, o que mantém o Per World funcionando sem tocar na tela.

### Explicadores

`lib/dropRate/explain/`, um arquivo por família. Cada explicador recebe o `Ctx` e devolve o nó da fonte com a sub-árvore da V1, lendo só blocos do `lib/game` (`GetTalentNumber`, `Gallery`, `FarmingStuffs`…). Nenhum valor é recalculado à parte quando o `lib/game` já tem o bloco que o jogo usa.

| Família | Linhas num save atual (ARKHE, ci 8) | Observação |
|---|---|---|
| Talentos (nível efetivo, bônus de nível) | ~600 | a explicação que mais se repete |
| Gallery | ~295 | |
| Farming | ~170 | |
| Hatrack | ~125 | |
| Obols | ~60 | |
| Equipamento | ~55 | |
| Cards | ~45 | |
| Companions | ~40 | |
| Cape Vine, Golden Food, Stamps, Holes | ~30 cada | |
| Fontes simples (Owl, Shiny, Summoning, Research, Emperor, Arcade, Tome, Sushi e o resto) | até ~15 cada | rótulo, valor e poucas linhas |

Regras:
- Uma linha que o bloco do jogo não calcula é lida protegida e vira folha com nota, nunca erro na página (mesma regra de Coin e Multikill).
- Um valor que depende de estado de sessão do jogo passa por `runtime()`/`assumed()`, com a explicação escrita.
- Rótulos que dependem do save (ex.: "Not owned — would grant +X") são reproduzidos a partir dos dados do jogo.

### Chip Silkrode

O botão atual (`chipGalleryActive`: automático, forçar ligado, forçar desligado) continua. N.js lê `chipBonuses("troph")` do personagem atual; o override entra como semente do `Ctx`, declarada como `assumed:` quando diferente do automático.

### Página

Muda só a chamada em `components/dropRate/DrCalculator.tsx` (`computeGameDropRateV1` por import dinâmico, atrás do mesmo tratamento de erro do kit) e os imports de tipo e de categorização. `DeepView`, `BiggestGains`, `SnapshotSection` e `topDropRate` ficam como estão.

Os mapas sem definição de monstro não têm efeito aqui: Drop Rate não lê o alvo.

## Validação

**Só com os saves mais novos** (decisão do usuário, ver `feedback-oracle-newest-saves-only`).

- Um teste com saves reais (`skipIf` sem saves) compara a árvore nova com a do `lib/arkh`, caminho por caminho (mesmos caminhos, mesmos valores a 1e-9, mesmos formatos e notas), nos 5 saves mais novos (mesma regra do `characterize --recent`), nos mapas 251, 301, 216 e 150.
- Onde o `lib/arkh` estiver errado, a árvore segue o N.js e a diferença entra numa lista explícita, com a evidência no N.js e o caminho afetado. Os bugs já provados nas outras migrações (LUK da foto do save, medições da HourZero, comida dourada, prece 6 e outros) são os candidatos esperados.
- Cada família tem um teste sintético do que o CI consegue rodar sem saves.
- Antes do PR: suíte no worktree limpo (Node 22), `tsc` e conferência do usuário no jogo.
- A página só troca de motor na última tarefa, com a árvore inteira batendo.

## Riscos

- **Tamanho:** é a migração com mais código de apresentação. Os explicadores vão por família, cada um revisado, e nada chega ao jogador antes do fim.
- **Estrutura diferente do N.js:** a árvore da V1 não segue a estrutura de chamadas do jogo em vários pontos. O explicador monta a linha da V1 a partir dos valores corretos; se uma linha da V1 não tiver equivalente no jogo, ela é apontada na tarefa da família, com a evidência, e o usuário decide.
- **Licença:** os rótulos internos das linhas vêm da V1, que foi portada do Corgan (repositório sem licença). O código novo não copia lógica, mas os rótulos e a forma da árvore são os mesmos. Fica para o usuário decidir na hora da troca de licença se eles podem ficar.
- **Cobertura limitada:** os 5 saves mais novos são todos de uma conta, então um caso raro de outra conta pode aparecer depois do merge.
