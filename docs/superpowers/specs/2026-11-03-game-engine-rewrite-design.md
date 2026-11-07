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
- Save de versão anterior: não é recusado de forma estrita. O jogo migra o save ao carregá-lo, e o motor repete essas etapas; só o que elas não dão é recusado. Decisão de 2026-11-04, em "Decisões da migração do Artifact Find (2026-11-04)", no fim deste documento.

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
- **Desempenho:** o `GameState` com cache deve ficar mais rápido que o motor atual. É medido por tracker. Revisto em 2026-11-04: o que bloqueia a troca é uma lentidão perceptível, não qualquer regressão (ver "Decisões da migração do Artifact Find (2026-11-04)", no fim deste documento).
- **"Escrito a partir do N.js":** o histórico de commits e a regra de não copiar do `lib/arkh` documentam a origem. Não é parecer jurídico; a decisão de licenciar MIT é do usuário no fim.

## Decisões da migração do Artifact Find (2026-11-04)

Registro do que foi decidido ao migrar o Artifact Find (branch `feat/artifact-find-game`, plano `docs/superpowers/plans/2026-11-04-artifact-find-on-lib-game.md`). O código cita "Ruling A" a "Ruling P"; elas estão definidas aqui. Onde esta seção diverge do texto acima, esta seção vale.

### Decisões do usuário (2026-11-04)

- **Desempenho:** aceito como "sem lentidão perceptível", não como "mais rápido que o motor atual". Com o save já carregado, trocar de personagem custa o mesmo que no `lib/arkh` (cerca de 2 ms, paridade). Carregar um save custa cerca de 24 ms a frio, uma vez por save (montar o `GameState` e o Tome), contra cerca de 2 ms no `lib/arkh`. A regra de desempenho (Riscos e critérios de troca) passa a ler assim.
- **Saves antigos:** um save de versão anterior usa os padrões de inicialização do jogo e as migrações que o jogo roda ao carregar (`lib/game/migrations.ts`). Um atributo com gate de CSver que o save não tem recebe o valor inicial do jogo (por exemplo, Menagerie), e os blocos `DoOnceREAL` que o save ainda não rodou são repetidos na ordem do jogo. Só o que essas etapas não dão continua recusado (§5), e a página diz isso em palavras. Isso substitui "um save pré-migração é recusado de forma estrita".
- **Bloco 378 (registro de Drop Rate):** quando o bloco 378 rodou no save (0celot8, 5OhTree), o jogo reajusta `OptionsListAccount[200]` para o Drop Rate vivo antes de o Tome o ler, e o motor não calcula o Drop Rate vivo. Decisão: "número com aviso". O score usa o valor zerado pelo bloco e a folha do Tome fica marcada `assumed:`, visível na página.
- **Saves abaixo de CSver 30:** portados (o preenchimento do Sushi no `initialize3`, os outros preenchimentos e ajustes de `initialize1..3` que o Artifact Find lê e os blocos 251 a 366), com a premissa de que Sushi e MapBon começam vazios (o valor inicial do jogo vem do `game.mbs`, fora do N.js). A premissa está no código e aparece na árvore como `assumed:`.
- **`NONdummies[60]`** (capitães de tipo 6): sempre contado, como no PR #71. O jogo só o preenche depois que algum personagem entra no mapa 200 (a cidade do W5) na sessão; a nota da página já diz isso.

### Rulings

Cada linha: o que, por quê, custo se errada.

- **A:** os atributos do save (`SAVE_ATTRS`) são só os que o loader do N.js carrega. Os que existem só em runtime (`NONdummies`, `DNSM`, `CurrentMap`) ficam fora e viram funções (`NONdummies60`, `DNSM_*`) ou entram pelo `Ctx`. Por quê: modo estrito (§5), nada lê como save o que o save não tem. Custo: uma lista de teste.
- **B:** `ARTI_GROUPS`, `ARTI_ROOT` e `ARTI_VOTE_NAME` moveram para `lib/artifactFind/groups.ts`, e `lib/arkh/stats/defs/artifact-find.ts` os reexporta (não só importa). Por quê: os importadores existentes e o oráculo dos testes seguem funcionando. Custo: caminhos de import.
- **C:** quem precisa de um sub-caso de função que é de uma tarefa posterior porta esse sub-caso no módulo da função (criando-o se faltar), e a tarefa dona o estende. Por quê: não travar a ordem das tarefas. Custo: um módulo tocado por duas tarefas.
- **D:** o oráculo dos testes guarda em cache a árvore do `lib/arkh` por (save, personagem), por processo. Por quê: o `lib/arkh` por fonte sobre 1163 pares é lento demais sem isso. Custo: memória no worker de teste.
- **E:** save sem uma chave que o loader atual mapeia continua `MissingSaveKey` estrito, nunca um chute. Por quê: §5. Hoje o motor repete as etapas de load antes (N, O), então só recusa o que elas não dão (um save com `DoOnceREAL` abaixo de 248, `UNPORTED_STEPS`, ou um Tome incompleto); nenhum save real é recusado. Custo: um save muito antigo mostra erro na página em vez de número.
- **F:** linhas do inventário inalcançáveis para os argumentos dados ficam `- [~] … não alcançada para <args>: <por quê>`, não marcadas como portadas, e a função lança `NotPorted`. Por quê: um bloco nomeado é uma sobre-aproximação. Custo: o texto do checklist.
- **G:** a posse de companheiros vem do `companion` do envelope (a resposta capturada de `getCompanionInfoMe`) mais os tokens de `OptionsListAccount[606]`; `null` dá sem companheiros e uma folha `runtime()`; objeto sem `l` dá `MissingSaveKey`. Por quê: runtime só para o que o save não dá (§5). Custo: termos de companheiro 0 em envelope sem o campo.
- **H:** `BundlesReceived` ausente é a conta que nunca comprou bundle (o loader, `getLoadMap` @19927310, não tem gate de CSver): lê como o mapa vazio, com uma folha `(absent)` citando o loader. Por quê: espelhar o jogo, não ser estrito por reflexo; as chaves com gate de CSver seguem em E. Custo: um save recusado passaria a mostrar valor sem os bônus de bundle.
- **I:** `Number2Letter` é dado do jogo que o N.js não traz (padrão de atributo fora do bundle): vem da tabela legada, com proveniência no código e um teste de que os usos batem (verificado de forma indireta: slugs e eventshop iguais ao `lib/arkh` em 1163 pares). Por quê: não há outra fonte. Custo: a letra de `EventShopOwned` e `SuperBitType`.
- **J:** a conexão do nó do Laboratório (`GenINFO[92]`, vivo no jogo) é uma assunção declarada, `assumed()`, não um 0 de runtime: o nó conta como conectado, e a folha diz `assumed:`. Por quê: 0 quebraria o 167Q validado; portar a caminhada do Lab fica para depois. Custo: o dobro do `mainframe14`/vial superestimado para quem não conecta o nó (igual ao `lib/arkh` hoje).
- **K:** o score de Tome do Lore Episode vem do `computeTome` do `lib/tome` (nosso re-port do N.js, validado no jogo em 03/11), nunca do `parsedData`/`extraData` do IdleonToolbox; as diferenças contra o `lib/arkh` vão para `KNOWN_ARKH_DIFFS` com esse motivo. Por quê: o IdleonToolbox nunca é referência. Custo: `lib/game` depende de `lib/tome` (e, por ele, de cerca de 20 módulos do `lib/arkh`) até o Tome migrar (#9); é a única exceção transitiva a "`lib/game` não importa `lib/arkh`".
- **L:** tamanho do snapshot. A árvore bruta do adaptador tinha 983 nós contra 98 (cerca de 207 KB contra 8,6 KB por snapshot, e o `localStorage` descarta escrita sem avisar). A página guarda a profundidade por fonte e um rastro aparado (sem `cached` e `(absent)`, só os ramos com `runtime:`/`assumed:`), no máximo 2x os nós do `lib/arkh`; o rastro completo continua num `Ctx` com trace. A nota de cada folha é curta e em inglês simples; o motivo completo (offsets, nomes internos) fica em `detail`, só no rastro completo. Custo: menos detalhe do N.js no detalhamento da página.
- **M:** otimização sem arrependimento antes de qualquer decisão de spec: o `GameState` fica em cache por objeto de envelope (`WeakMap`), uma vez por save carregado. Um memo compartilhado entre personagens foi descartado (a chave inclui o jogador, não reusaria nada). Custo: uma camada de memo.
- **N:** padrões de inicialização do loader para atributos com gate de CSver (Menagerie primeiro), listados à mão com os offsets do N.js e testados contra o N.js vivo. Hoje vivem em `lib/game/migrations.ts` (O). Custo: uma entrada de tabela.
- **O:** camada de migrações de load: ao montar o estado, repete literalmente, com offsets e na ordem do jogo, os blocos do N.js que um save antigo não rodou (gates `DoOnceREAL` e CSver); o estado guarda a lista aplicada e as assunções, e a árvore as mostra. Por quê: o jogo nunca calcula num save como está armazenado. Custo: o escopo da camada; só o que o Artifact Find lê está portado, e o fim do arquivo lista cada passo examinado que não foi.
- **P:** uma onda final de correções: o registro do updater cobre `lib/game`, as rulings e decisões entram no git (esta seção), a suíte completa roda em Node 22, a página não carrega o motor estaticamente, o cache de God Shard está documentado, o comentário falso sobre `lib/arkh` foi corrigido e a página mostra textos simples. Custo: nenhum, é limpeza.

- **M5:** `buildGameState` lança a recusa das migrações (`MissingSaveKey`/`InvalidSaveValue`) na construção; não existe `GameState` meio válido, e `data` é um campo comum congelado. Por quê: ler `data` já não esconde um estado recusado. Custo: quem monta o estado captura o erro na construção (o cache por envelope do Artifact Find já não guarda um envelope recusado).
- **M6:** um cache do DNSM que as fórmulas leem por chave (`DNSM.StarSigns["61"]`) é um `block("DNSM.<Nome>")` por chave que devolve número; um cache cujos consumidores já são blocos por id (`Companions`) pode ficar como função que devolve um `Map`. A regra está no cabeçalho de `njs/DNSM.ts`. Custo: nenhum, só convenção.
- **M7:** `NotPorted.sub` é sempre texto: `"<Sub>"` para um sub-caso nomeado, `"<Sub>:<arg>=<valor>"` para um argumento fora do portado (`"VaultUpgBonus:b=5"`; sem sub nomeado, só `"d=15"`) e `"<estado>"` para uma condição do jogo (`"CurrentMap=41"`). `__tests__/lib/game/conventions.test.ts` confere todos os pontos de chamada. Custo: as mensagens mudaram.

### Adiado para o plano do Coin Multi

- **M5, M6 e M7:** feitos no plano do Damage (Tarefa 0), nas linhas M5, M6 e M7 acima. As letras Q a Z são as rulings da migração do Damage (seção abaixo).

## Decisões da migração do Damage (2026-11-05)

Registro do que foi decidido ao migrar o Damage (branch `feat/damage-game`, plano `docs/superpowers/plans/2026-11-04-damage-on-lib-game.md`). O código cita "Ruling Q" a "Ruling Z"; elas estão definidas aqui. As rulings A a P e M5 a M7 (acima) continuam valendo.

### Decisões do usuário (2026-11-05)

- **O que o Damage conta (decisão de produto da página, mantida):** buffs ativos (talentos 108/124) e as formas de masterclass (Wraith, Tempest, Tesseract) não entram; no `lib/game` são valores `runtime()` com nota, nunca um 0 silencioso. O mapa 43 (arena do Royal Guardian) substitui o Max e o mapa 306 (Clamworks) o divide; os dois vêm do `ctx.map`.
- **Mapas de dungeon (39, 40, 70, 71, 118, 119):** a página mostra o Max normal com um aviso, como hoje ("Max normal + aviso"). Ver Y.
- **Mapa 43:** a árvore mostra só a arena e a Mastery, fiel ao N.js ("Só arena + Mastery"). Ver Z.
- **Desempenho:** a regra é "sem lentidão perceptível" (ver Artifact Find): troca de personagem com o save carregado em paridade com o `lib/arkh`, e o custo a frio uma vez por save. Medido na troca da página (Tarefa 10), em 5 saves reais (54 personagens), mediana no Node: trocar de personagem custa cerca de 40 ms no `lib/game` contra cerca de 220 ms no `lib/arkh`, trocar de mapa 39 ms contra 254 ms, e o primeiro cálculo de um save carregado (montar o `GameState`, o Tome e o primeiro Damage) cerca de 63 ms contra 247 ms. O `lib/game` é mais rápido nos dois casos, então X não precisa de um cache de conta.

### Rulings

Cada linha: o que, por quê, custo se errada.

- **Q:** os extras das leituras de Damage (HP, MP, Accuracy, STR/AGI/WIS/LUK) passam ao `lib/game` só se os 7 valores batem com o texto do jogo nas 4 leituras; senão ficam no `lib/arkh` e a diferença é relatada. Bateram nos 19 extras: estão em `TRACKERS`, e as leituras os calculam por lá. Por quê: o critério de leituras desta spec. Custo: o teste de leituras misturaria motores por um tempo.
- **R:** o marcador do inventário (`njs-closure --mark`) decide "portado" pela cobertura que cada módulo de `lib/game/njs` declara (`PORTED`: sub-casos, conjuntos de índices ou "generic"), não por uma sonda com um `Ctx` que lança; um teste de guarda confere que cada entrada chega a um caminho que não é `NotPorted`. Por quê: a sonda marcava `[x]` falso quando o módulo lê estado antes do `NotPorted`. Custo: um export por módulo.
- **S:** o oráculo dos testes de Damage é `arkhDamageLeaves(save, ci, map)` (só números, um flatten) mais `arkhStats` (os 7 numa carga), com cache em disco em `scripts/updater/golden/.cache/oracle/` (fora do git), chaveado pelo sha1 do save e por um hash do conteúdo de `lib/arkh/**/*.ts`; um acerto nunca recalcula. Por quê: recalcular a árvore do `lib/arkh` por família custava cerca de 6 minutos. Custo: cache velho se uma mudança escapar do hash (os 2 imports externos do `lib/arkh` ficam fora dele).
- **T:** a nota da raiz do Artifact Find "migrated (1 load step)" em saves anteriores ao bloco 399 fica. Por quê: é verdadeira, e o save de quem joga já rodou o 399. Custo: uma linha de nota num save antigo colado.
- **U:** os buffs 94, 273 e 288 contam a partir do `BuffsActive` do save (o N.js os lê; o 94 é confirmado pela leitura de STR do markhe); só os talentos 108/124 ficam `runtime()`, pela decisão de produto. Custo: os stats incluem os buffs ativos no momento do save.
- **V:** o `AFKtarget` segue o `ctx.map` pela regra de carga de cena do jogo: o salvo quando `ctx.map` é o `CurrentMap` salvo do personagem; senão, o salvo se está em `MapAFKtargetSide[map]` ou num caso listado, e `MapAFKtarget[map]` no resto (`lib/game/afkTarget.ts`). Por quê: o N.js reescreve o alvo ao carregar a cena. Custo: o gate do talento 125 usaria a Defence de outro monstro nos mapas que não são o salvo.
- **W:** as linhas ainda abertas de `ArcaneType`, `Windwalker`, `ReturnClasses` e `TotalStats` (Weapon_Power, Dung_Power, inteiro) só são alcançadas pelo `DamageDealed`, então a Tarefa 8 as porta (C: quem precisa primeiro). Custo: nenhum, a Tarefa 3 estava fechada.
- **X:** "reusar termos de conta" fica no nível do `GameState` e do Tome; os blocos de conta continuam por jogador (M: a chave do memo inclui o jogador). A Tarefa 10 mede a troca de personagem contra o `lib/arkh`; se ficar pior que a paridade, rever com um cache de conta compartilhado. Medido: cerca de 40 ms contra 220 ms (ver Desempenho acima), sem revisão. Custo: uma troca mais lenta.
- **Y:** nos mapas de dungeon, o `lib/game` calcula o Max normal e a árvore mostra o aviso. Fica no próprio `Dungon()` (`njs/Dungon.ts`, @7831096): nesses mapas ele responde -1 por `assumed("outside a dungeon …")`, então todo ramo de dungeon de todo bloco (o do `DamageDealed` @4106070, os de `PlayerHPmax`, `PlayerMPmax`, `PlayerSpeedBonus`, `FoodBonuses`, `GetTalentNumber`, `TotalStats`…) vê um mapa normal, e cada chamador continua literal. Vale para o motor inteiro: qualquer stat calculado num mapa de dungeon. Um tracker que conte a corrida de dungeon porta o `DungeonStat` (@7831416) e tira a assunção. Por quê: decisão do usuário; uma assunção só nos quatro guardas do Damage deixaria o `FoodBonuses` lançando. Custo: num mapa de dungeon o Max mostrado não é o da corrida (igual ao de hoje).
- **Z:** no mapa 43 a árvore da página é só a arena e a Mastery (0,2), fiel ao N.js @4106216 (o `DamageDealed` devolve o `RatDMG` antes de calcular o resto); ali o "mesmo formato do `lib/arkh`" cede. Por quê: decisão do usuário; mostrar as camadas exigiria uma segunda chamada que o jogo não faz. Custo: o detalhamento e as linhas do Compare ficam ausentes no 43 (os valores nunca afetavam o total).
- **Referência do Observed Max (decisão do usuário, 05/11):** o Compare e o Biggest Gains do Damage seguem usando a referência dos top players (`web/lib/damage/topDamage.ts`), gerada pelo coletor sobre o `lib/arkh` (`scripts/update-top-damage.ts`), com os bugs já provados nos `KNOWN_ARKH_DIFFS` (gfood, pray6, tome, fam68, powerSuffix, signsDmg, statues, comp0). Fica documentado na nota de metodologia da página, e **a migração do coletor para o `lib/game` é o próximo passo**. Por quê: a revisão final achou a diferença e o usuário preferiu documentar a migrar junto com o PR. Custo: até lá, a referência de algumas fontes pode diferir um pouco do que o `lib/game` calcularia.

## Decisões da migração do AFK Gains (2026-11-06)

Registro do que foi decidido ao migrar o AFK Gains (branch `feat/afk-game`, plano `docs/superpowers/plans/2026-11-05-afk-gains-on-lib-game.md`). O código cita "Ruling AA" a "Ruling GG"; elas estão definidas aqui. As rulings A a Z (acima) continuam valendo.

### Decisões do usuário

- **O que o AFK Gains conta (decisão de produto da página, mantida):** só o AFK de luta; o arcane é o slot 2; o mapa 306 (Clamworks) dá ×0,2; no mapa 216 com caverna 17 a taxa da Cove substitui tudo; o voto semanal aparece e não entra no ranking.
- **Tipo do alvo (06/11, "Alvo salvo, como o jogo"):** no mapa do próprio personagem o tipo vem do alvo AFK salvo (Ruling V), não do padrão do mapa. A spec da página (A9) foi emendada. Ver GG.
- **Desempenho:** "sem lentidão perceptível" (ver Artifact Find). Ver FF.
- **Referência do Observed Max:** o coletor continua no `lib/arkh` (como no Damage). O Compare e o Biggest Gains do AFK usam a referência gerada por ele; só a página calcula no `lib/game`.
- **Leituras do jogo:** o usuário ainda não mandou os prints (EE); o PR declara se nenhuma foi registrada.

### Rulings

- **AA:** a Etapa 5 da Tarefa 1 (leituras do jogo) é do controlador com o usuário, antes da Tarefa 4; sem leitura, o teste de leituras pula. Custo: nenhum.
- **BB:** `StampDetails`/`StampOverLevel` entram em `PORTED` (ou `unreached`) para o inventário do Damage mostrar 0 abertas; sem mudança de comportamento. Custo: só o inventário.
- **CC:** vale a decisão A9 da página: alvo de skill dá a taxa de luta com nota; `Nothing`/`Paying_Respect`/sem definição dão 0. O "×0 se não é luta" do plano era um resumo com perda. Custo: mapas de skill mostram a taxa de luta (como hoje).
- **DD:** num mapa cujo alvo A9 dá 0, a árvore da página é só a folha A9, total 0, sem linhas de fonte; igual à Ruling Z (mapa 43 do Damage). O jogo nunca calcula a taxa ali. Custo: o Compare não mostra fontes nesses mapas.
- **EE:** a Tarefa 5 segue sem leituras do jogo; o teste continua pulando se a fixture não existe e o controlador registra ao menos uma antes do merge. Custo: a revisão do PR vem antes da conferência no jogo.
- **FF:** desempenho aceito: troca de personagem em paridade com o `lib/arkh` (cerca de 22 ms) e carga a frio uma vez por save (cerca de 56 ms contra 23 ms). Custo: troca um pouco mais lenta; o cache de conta da Ruling X é o caminho de melhora.
- **GG:** o tipo do alvo A9 segue a Ruling V (alvo salvo no mapa do próprio personagem, regra de carga de cena nos demais), por decisão do usuário de 06/11. Em saves reais isso muda 350 personagens de 0 para a taxa de luta com nota (cidades de Lab/Div/Cooking/Spelunk) e 56 de 0 para luta (cavernas do 216), contra o `lib/arkh`. Custo: nenhum.

## Decisões da migração do EXP Multi (2026-11-07)

Registro do que foi decidido ao migrar o EXP Multi (branch `feat/exp-game`, plano `docs/superpowers/plans/2026-11-06-exp-multi-on-lib-game.md`, na main pelo PR #75, `34a643c`; esta seção é o registro feito depois). O código cita "Ruling HH" a "Ruling KK"; elas estão definidas aqui. As rulings A a GG (acima) continuam valendo.

### Decisões do usuário

- **O que o EXP conta (decisão de produto da página, mantida):** a linha "Class EXP" do Player Info; o mapa define o bônus Arcane e qual Shiny Medallion vale; o voto semanal aparece e não entra no ranking; as fontes circunstanciais mantêm o tratamento da página.
- **LUK ao vivo:** o EXP usa o LUK calculado, como o jogo (o `lib/arkh` lia a foto `PVStatList` do save: `lukSnapshot`).
- **Notas por save:** as linhas da Workbench (talento 328) e do talento 632 perdem as notas por save do `lib/arkh`; valores e entradas continuam na árvore.
- **Leitura do jogo:** o usuário conferiu o Class EXP no preview em 07/11 ("tá certinho") antes do merge.

### Rulings

- **HH:** o merge espera a conferência do usuário no jogo (a leitura do Player Info com o jogo aberto do zero, por causa do cache de shiny da sessão); sem leitura gravada, o teste de leituras pula e o PR declara isso. Custo: a revisão do PR vem antes da conferência no jogo.
- **II:** o Shiny Medallion usa `MapAFKtarget[ctx.map]`, o estático que o N.js lê, e não o alvo AFK salvo (diferente das Rulings V e GG do AFK). Custo: nenhum.
- **JJ:** os comentários `@offset` citam o offset do `N.new.js` bruto; os revisores às vezes citam as coordenadas normalizadas do `loadNjs()`, que é preciso converter. Custo: nenhum.
- **KK:** as folds de grupo foram reescritas do zero em `lib/statTracker/groups.ts` (o `lib/arkh` as reexporta), e o guard `noArkhImports.test.ts` proíbe `@/lib/arkh` em runtime alcançado pelos trackers, exceto `lib/game/data` e `lib/tome`. Custo: nenhum.

## Decisões da migração do Drop Rate V2 (2026-11-07)

Registro do que foi decidido ao migrar o Drop Rate V2 (branch `feat/drop-rate-game`, plano `docs/superpowers/plans/2026-11-07-drop-rate-on-lib-game.md`). O código cita "Ruling LL" a "Ruling RR"; elas estão definidas aqui. As rulings A a KK (acima) continuam valendo.

### Decisões do usuário (2026-11-07)

- **Escopo:** migra a página V2 (`/drop-rate-v2`, kit, `TotalStats("Drop_Rarity")` @4190432). A V1 (`/drop-rate`, `computeDR` + DeepView) também migra, num plano próprio depois deste; não vai ser aposentada.
- **Execução:** subagent-driven.
- **Notas:** das 12 notas por save do `lib/arkh`, voltam as 6 dos companheiros ("Not owned — would grant +X", companheiros 3, 22, 50, 158, 111 e 132), com o valor tirado dos dados do jogo (`CompanionDB[id][2]`); as outras 6 (o decaimento dos talentos 279, 24 e 655, o log da Workbench, a prece 7 e a conquista 381) somem, como no EXP.
- **Referência do Observed Max:** o coletor continua no `lib/arkh` (como no Damage, AFK e EXP); só a página calcula no `lib/game`.

### Rulings

- **LL:** a chave do `TRACKERS` é o StatKey `dropRateV2` (o verify-map e as leituras indexam por StatKey). Custo: nenhum.
- **MM:** leituras do jogo como em HH: a Etapa 6 da Tarefa 1 é do controlador com o usuário, e o merge espera a conferência do Drop Rate no Player Info, com o jogo recém-aberto. Custo: o verify-map não tem leitura de DR até o usuário gravar uma.
- **NN:** os portes mais largos que o mínimo ficam (`ResearchStuff` `Grid_Bonus` para todo `e`; `Holes` `MeasurementQTYfound` para todo tipo, o que cobre `WorkbenchStuff` `OverkillQTY`): conferidos literalmente contra o N.js bruto, e 15 linhas `[~]` do Damage, AFK e EXP viraram `[x]` sem mudar nenhum valor. Custo: ramos só com teste sintético até um tracker alcançá-los.
- **OO:** `DungeonStat("DropRarity")` e `DungeonCalc("TraitBonus",6)` ficam `[~]` pela Ruling Y; o ramo dentro da dungeon (@4194067) lança erro em vez de calcular. Custo: se a Ruling Y mudar, esse ramo precisa ser portado.
- **PP:** quando o bloco não chamou `chipBonuses("dr")` (total ≥ 5), o nó do chip não pode quebrar a página onde o jogo calcula: a leitura é protegida e, se falhar, vira uma folha 0 com nota. Custo: nenhum.
- **QQ:** desempenho aceito como em FF: carga a frio de cerca de 51 ms contra 16 ms do `lib/arkh` (uma vez por save), troca de personagem e de mapa em paridade (cerca de 17 ms). Custo: o primeiro cálculo pode parecer lento num celular fraco.
- **RR:** bugs do `lib/arkh` provados no N.js nesta migração, com prova estreita e contagem exata: `luk` (a foto `PVStatList`), `meas15` (o `lib/arkh` pula o passo de carga @6420350 que zera as medições 10 a 15 da HourZero) e `glimbo` (0 no `lib/arkh`, 1 no N.js; o max(1, ·) do grupo esconde a diferença no total), além dos já conhecidos (tome, pray6, gfood, fam68, comp0). Custo: nenhum.
