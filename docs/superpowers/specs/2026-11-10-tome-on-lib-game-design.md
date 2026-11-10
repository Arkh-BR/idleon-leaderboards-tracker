# Tome no `lib/game` — Design

Data: 2026-11-10. Relacionado: `2026-11-03-game-engine-rewrite-design.md` (Ruling K), `2026-11-09-talents-on-lib-game-design.md` (mesmo molde).

## Objetivo

O Tome deixa de depender do `lib/arkh`. Isso vale nos dois lugares em que ele roda:
- na página `/tome` (`lib/tome/compute.ts`, `TomeRawPanel`, `BestTomePanel`);
- dentro do motor, porque `DNSM.TomeQTYtot` chama `computeTome` (Ruling K), e por isso todo tracker que lê o Tome (Damage, Artifact Find e outros) ainda importa o `lib/arkh` em runtime.

Sucesso:
- cada quantidade do Tome é a do jogo, lida do bloco portado do N.js;
- a pontuação total é a do jogo, a mesma que o usuário conferiu em 03/11;
- a tela continua igual: as 124 linhas, as fontes, os pontos, o Best Tome e os top players;
- nada do `lib/tome` nem do `lib/game` importa `@/lib/arkh` em runtime, e o guard `noArkhImports` perde a exceção do `lib/tome`.

## Decisão do usuário (10/11)

"Faça do 2 ao 5": o Tome entra no mesmo molde do Talents (subagentes, validação só com os saves mais novos), sem nova rodada de perguntas.

## Arquitetura

### No jogo

- `_customEvent_TomeQTY` @5739264 preenche `DNSM.TomeQTY`, uma quantidade por tarefa de `CustomLists.Tome`, na ordem de cálculo. São 124 hoje.
- Antes de preencher, o evento sobe `OptionsListAccount[198]` e `[200]` para o máximo entre o salvo e o valor vivo (dinheiro no banco e Drop Rate).
- `Summoning("TomePTS", g)` @10915591 = `ceil(TomePCT(g) × Tome[g][3])`.
- `DNSM.TomeQTYtot` é a soma de `TomePTS` sobre todas as tarefas (@5769566 e @5778759).

### No `lib/game`

- `lib/game/njs/TomeQTY.ts`: `TomeQTY(ctx): readonly number[]`, um bloco por estado. É o evento sem efeitos colaterais. Os máximos de OLA[198]/[200] são feitos em memória, com o mesmo `assumed:` do bloco 378 para o recorde de Drop Rate. O portão de cena ("utorial") não se aplica: uma conta rastreada está no mundo.
- Cada quantidade cita o seu `@offset` RAW. Uma quantidade que lê um bloco ainda não portado porta o sub-caso que falta.
- `Summoning` ganha `TomePCT` e `TomePTS`.
- `DNSM.TomeQTYtot` passa a somar `TomePTS` no próprio motor. O `assumed()` que existe hoje continua, porque o total do jogo é estado de sessão (`GenInfo[84]`). A nota passa a dizer que a soma é a do N.js.
- `IncompleteTome` some: um save pré-migração é recusado pelas regras de sempre (Ruling E).

### Na página

`lib/tome/compute.ts` mantém `computeTome(input)` e o tipo `TomeResult`. Muda só de onde vêm os números:

- `rawValue` de cada linha é `TomeQTY[computeIdx]`, sobre `stateOf` do save desembrulhado.
- `pts` é `TomePTS(computeIdx)`.
- `source` guarda o rótulo de hoje de cada linha. É informação de tela.
- Continuam:
  - o caminho do IT (`parsedData.tomePoints`, `[IT]`), usado pelos top players;
  - o fallback de leaderboard quando o save não abre (rótulo `MISSING (LB: …)`), que agora também cobre um save que o motor recusa.
- `lib/tome/extractors.ts` deixa de importar o `lib/arkh`. Funções que só o `computeTome` usava e que o motor substitui são apagadas. O que outras partes usam (golden, `topPlayers`, scripts) fica, sem `lib/arkh`.

## Fora do escopo

- O coletor `scripts/update-top-players.ts` (passo 3 do roteiro): só precisa continuar compilando.
- Os scripts de debug que importam o `lib/tome` (passo 4).

## Validação

**Só com os saves mais novos.**

- Um comparador (`skipIf` sem saves) confere as 124 quantidades e os pontos de cada linha contra o `computeTome` de hoje, guardado como oráculo de teste (`__tests__/lib/game/support/arkhTome.ts`, uma cópia do compute atual, nunca o da página). Usa os 5 saves mais novos. O total é conferido também.
- Onde o `computeTome` atual estiver errado, o N.js decide, e a diferença entra numa lista `TOME_KNOWN` com o offset.
- Cada tarefa tem testes sintéticos das quantidades que porta.
- `characterize --recent 5 --map 251` nos seis trackers: o Tome entra no Damage, no Artifact Find e em outros, então o valor deles não pode mudar sem explicação.
- Antes do PR: suíte limpa no Node 22, `tsc`, e o usuário confere o Tome no jogo.

## Riscos

- **Tamanho.** São 124 quantidades e cerca de 30KB de N.js; várias leem blocos ainda não portados.
- **Saves antigos.** O `computeTome` de hoje é tolerante e mostra `MISSING` por linha. O motor recusa um save antigo inteiro. Na página, o save recusado vira a mensagem amigável do `pageError`, e o caminho do IT continua.
- **Top players.** Os perfis do IT podem ser saves estranhos. O coletor pula o que o motor recusar e diz qual foi.
