# Motor novo a partir do N.js (`lib/game`) + ferramentas de diagnóstico — Design Spec

**Data:** 2026-11-03
**Status:** desenho aprovado pelo usuário (03/11/2026, via perguntas); aguardando revisão desta spec
**Meta final:** repositório sob **MIT**, sem código derivado de terceiros

## Problema

1. **Licença.** O motor `web/lib/arkh` (≈58 arquivos, ≈11,8 mil linhas citam o corgan; 47 se dizem "port 1:1 do corgan-source") vem do repositório `Corgan/idleon-research-optimizer`, que **não tem licença** (GitHub `license: null`). Sem permissão, isso trava a troca pra MIT e, a rigor, a própria distribuição. O código do IdleonToolbox já saiu (PRs #67 e #68).
2. **Arquitetura.** A caçada ao erro de ~9% no Damage (PR #65) e os bugs achados no caminho vieram de padrões da arquitetura herdada, não só de fórmula:
   - zeros silenciosos (`safe()`/try-catch devolvendo 0): Shrine 1, Family 18, quests nunca carregadas, voto 3 trocado por WinBonus;
   - a mesma regra do jogo portada em vários lugares (chips, signos, nível de card, multiplicador de voto);
   - estado global de módulo e "personagem ativo" misturado com o "personagem calculado";
   - ciclos de import (talent → calcTalent → overkill → damage → derived-damage → talent);
   - dois caminhos pro mesmo número (valor escalar e árvore de detalhamento);
   - nomes que não batem com os blocos do N.js, mapeados por tags `@njs` manuais.
3. **Diagnóstico caro.** Achar a divergência com o jogo exigiu captura manual do save (hook de fetch + receiver), scripts de hipótese escritos na hora e raciocínio manual sobre soft caps.

## Objetivos

- Motor novo em `web/lib/game`, **escrito a partir do N.js**, que substitui o `lib/arkh` inteiro.
- Ferramentas que reduzem a caçada "site ≠ jogo" a: registrar leituras → rodar `diagnose`.
- Migração **incremental**: o site funciona o tempo todo; cada tracker troca de motor só depois de validado.
- No fim: `lib/arkh` apagado, nenhuma menção a código de terceiros, README sem atribuição de código, **LICENSE → MIT** (o usuário confirma na hora).

## Fora do escopo

- Leaderboards do IT (é a API deles, não código).
- `public/talent-icons/`: é arte do jogo, não código de terceiros. Fica com uma nota no README de que os assets são do jogo.
- Mudanças de UX nas páginas. O kit `statTracker` e as páginas continuam iguais e recebem o mesmo `{ tree, total }`.

## Arquitetura do motor (`web/lib/game`)

### 1. Um módulo por função do N.js

- Cada `_customBlock_X` do N.js vira `lib/game/njs/X.ts`, com o **mesmo nome e a mesma assinatura** do jogo, por exemplo `Summoning(ctx, "VaultUpgBonus", 20)`, `TotalStats(ctx, "STR")`, `DamageDealed(ctx, "Max")`. Os sub-casos ficam num `switch` sobre a string, como no jogo.
- Atributos de jogo e listas (`CustomLists`, `ItemDefinitions`, `OptionsListAccount`…) são lidos por acessores tipados gerados.
- O nome do módulo **é** o vínculo com o N.js. O updater mapeia bloco do N.js ↔ módulo automaticamente, sem tags `@njs` manuais.
- O código é escrito a partir do N.js, com estrutura e nomes próprios. É proibido copiar código ou estrutura do `lib/arkh`, do corgan ou do IT. Esses só podem ser **lidos** pra entender intenção, e nunca são fonte.

### 2. Estado imutável e contexto explícito

- **`GameState`** é construído uma vez a partir do save: parse tipado de todas as chaves, imutável, sem globais de módulo.
- **`Ctx = { state, player, map, cache, trace? }`**:
  - `player` é o "personagem atual", explícito como o `UserInfo[0]` do jogo;
  - `map` é o `CurrentMap`.
- Funções puras: `(ctx, ...args) → number`. Calcular outro personagem é só criar outro `Ctx`.

### 3. Cache igual ao do jogo

- Memo por (função, argumentos) dentro do `Ctx`, espelhando os caches do N.js (`TotStatMAP`, `DNSM`). Calcula uma vez e reusa. Isso também resolve o custo do overkill e do talento 643, que chamam o Max em loop.

### 4. Valor primeiro, rastreio opcional

- Cada função calcula **só o número**.
- Com `ctx.trace` ligado, um wrapper registra cada termo: nome, valor, argumentos, bloco do N.js e filhos. A árvore das páginas é montada a partir desse rastreio por um adaptador por tracker, que define agrupamento e nomes de exibição.
- Um caminho só pro número, então árvore e total não divergem.

### 5. Modo estrito

- Chave do save ausente, índice fora da lista, `NaN` ou `undefined` viram **erro com nome e endereço** (`state.data.TomeQTY[4] ausente`), nunca 0.
- Valores que o jogo só tem em runtime, como buffs ativos, são declarados de forma explícita (`Runtime("Buff 108")`) e aparecem na árvore como "não contado", sem se passar por zero silencioso.
- Em produção, um termo que lança erro marca o tracker como "incompleto" de forma visível, em vez de mostrar um número errado em silêncio.

### 6. Dados só do N.js

- Todas as listas e constantes saem do updater (`data/njs-snapshot`, `lib/arkh/stats/data/game/*` → passam a viver em `lib/game/data`), sem tabelas coladas à mão.
- Os geradores (`gen-entity-names`, `gen-dr-items`, `gen-talent-tabs`, `gen-account-wide-talents`) passam a rodar no updater.

### 7. Compatibilidade com as páginas

- Cada `lib/arkh/compute*.ts` ganha um equivalente `lib/game/trackers/<tracker>.ts` que devolve o mesmo `StatResult = { tree, total }`. As páginas trocam o import quando o tracker é migrado.

## Ferramentas de diagnóstico

As ferramentas 1 e 2 funcionam também com o `lib/arkh`, então ajudam já durante a migração.

### 1. Registro de leituras do jogo

- **Botão "Record in-game reading"**, em modo debug (`?debug=1`), em cada tracker. A pessoa digita o que o jogo mostra: o stat do tracker e os intermediários do catálogo (ferramenta 5). O site baixa um pacote com o envelope do save daquele instante, o personagem, o mapa, o horário e os valores digitados. O token de sessão nunca entra no pacote.
- **Registro:** os pacotes vão pra `web/scripts/updater/golden/.cache/readings/` (gitignored, porque têm dados da conta). Um índice commitado `web/fixtures/readings.json` guarda só metadados: id, stat, personagem, mapa, string do jogo e hash do save.
- **Testes automáticos:** um teste gerado compara cada leitura no **formato de exibição do jogo** (os formatadores do jogo ficam em `lib/game/format`). Toda leitura feita passa a proteger o código, e o teste pula quando o save não está presente, como hoje.

### 2. `diagnose`

`npx tsx scripts/diagnose.ts <reading-id…>` imprime:

- **Fator** jogo/site por leitura.
- **Sensibilidade:** a elasticidade d ln(total) / d ln(termo) de cada termo, calculada numericamente pelo rastreio e respeitando soft caps, e o fator que cada termo precisaria ter pra fechar a diferença.
- **Consistência entre leituras:** pra cada hipótese de 1 ou 2 parâmetros, o valor exigido por leitura e o resíduo. As hipóteses saem ordenadas pelo resíduo.
- **Alertas:**
  - termos com valor 0 ou neutro que leem chaves do save ausentes ou vazias;
  - termos `Runtime`;
  - blocos sem leitura que os valide (ferramenta 4);
  - divergência de chamadas contra o N.js (ferramenta 3).
- **Próxima leitura sugerida:** a ação no jogo (tirar arma, trocar de mapa, mudar personagem…) que mais separa as hipóteses que sobraram, com a previsão de cada uma.

### 3. Diff de chamadas contra o N.js

- **Lado do jogo:** extração estática, do bloco do N.js, das chamadas a outros blocos com argumentos literais, por exemplo `Summoning("VaultUpgBonus",20)` e `TotalStats(…)`.
- **Lado nosso:** as chamadas reais registradas pelo rastreio do módulo correspondente.
- A diferença ("o jogo chama `TotalStats` dentro de `ArtifactBonus(25)` e o nosso não") é reportada **sem precisar de leitura**. Isso teria achado o Artifact 25 e o Mainframe 0/11.

### 4. Mapa de verificação

- Pra cada tracker, lista os blocos do N.js que ele alcança e o estado de cada um:
  - **validado por leitura** (com quais);
  - **só derivado do N.js**;
  - **runtime**;
  - **não portado**.
- Gera um relatório (markdown ou HTML) pra decidir onde validar primeiro.

### 5. Catálogo de intermediários do jogo

- Lista quais telas do jogo mostram números intermediários e com qual fórmula de exibição:
  - Player Info: STR/AGI/WIS/LUK, HP, MP, Accuracy, Defence, Crit, Move Speed, Drop Rate, Class EXP, Damage;
  - as linhas do Tome;
  - o Skill Info;
  - o AFK Info.
- O formulário da ferramenta 1 pede os intermediários relevantes pro stat investigado.

### 6. Diff de saves

- `npx tsx scripts/save-diff.ts <a> <b>` mostra as chaves do save que mudaram e quais termos rastreados se mexeram entre dois saves, por exemplo antes e depois de tirar uma arma.

## Migração

### Ordem

1. **Fundação:**
   - ferramentas 1, 2 e 6 sobre o `lib/arkh` atual;
   - formatadores do jogo;
   - registro de leituras com as 10 leituras de 03/11 (Damage 4, HP 4, Accuracy 2) e o Tome.
2. **Núcleo do `lib/game`:**
   - `GameState`, `Ctx`, cache, rastreio, modo estrito e acessores gerados;
   - ferramenta 3 (diff de chamadas) e ferramenta 4 (mapa).
3. **Trackers, um por vez, do menor pro maior:**

   | Ordem | Tracker | Observação |
   |---|---|---|
   | 1 | Artifact Find | pequeno, sem mapa; prova o núcleo |
   | 2 | Coin Multi | |
   | 3 | EXP Multi | |
   | 4 | AFK Gains | |
   | 5 | Damage | junto com o overkill tier; depois Multikill |
   | 6 | Multikill | |
   | 7 | Drop Rate V2 | |
   | 8 | Drop Rate V1 | migrar ou aposentar: decisão do usuário quando chegar lá |
   | 9 | Tome | |
   | 10 | Talents Level | |
   | 11 | Cooking Mastery | |
   | 12 | Demais usos | Sheets e libs que importam `lib/arkh` |

4. **Encerramento:**
   - apagar `lib/arkh` e as menções a corgan;
   - README com nota sobre os assets do jogo;
   - **LICENSE → MIT**, com confirmação do usuário.

### Critérios pra trocar um tracker

- **Leituras:** todas as leituras do jogo daquele tracker no registro passam no formato de exibição.
- **Caracterização:**
  - total e árvore comparados com o `lib/arkh` sobre os 106 saves (23 golden + 83 do `saves-fresh`);
  - toda diferença explicada com evidência do N.js;
  - a diferença vira correção (o motor novo está certo) ou bug no motor novo, que bloqueia a troca.
- **Sem zeros silenciosos:** nenhum `Runtime` não declarado e nenhum erro de modo estrito nos 106 saves.
- **Verificações:** `tsc` e a suíte completa verdes; preview do Vercel ok.
- **Revisão:** revisão independente do diff do tracker.
- **Merge:** um PR por tracker (ou por fundação/núcleo); merge só com pedido do usuário.

### Regras gerais

- N.js vivo (`web/scripts/updater/.cache/N.new.js`) é a única fonte da verdade. IdleonToolbox e corgan nunca são referência.
- Repo compartilhado: `git fetch` antes de trabalhar; nunca commitar na `main`; stage só dos arquivos tocados; nunca `npm run dev`.
- Textos do site em inglês.
- Saves e leituras com dados da conta ficam fora do git.

## Riscos

- **Tamanho:** são várias rodadas. Mitigação: incremental, um tracker por PR, com o site funcionando o tempo todo.
- **Regressão em números já validados:** DR 462.577, Damage, HP/Accuracy e Tome. Mitigação: o registro de leituras e a caracterização sobre os 106 saves bloqueiam a troca.
- **Valores de runtime:** buffs, formas de masterclass e `GenINFO`. Mitigação: o tipo `Runtime` explícito e a nota na página.
- **Desempenho:** o `GameState` com cache deve ficar mais rápido que o motor atual. É medido por tracker, e uma regressão bloqueia a troca.
- **"Escrito a partir do N.js":** o histórico de commits e a regra de não copiar do `lib/arkh` documentam a origem. Não é parecer jurídico; a decisão de licenciar MIT é do usuário no fim.
