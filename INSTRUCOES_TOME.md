# Idleon Tome Tracker

Planilha que mostra teus pontos de tome (118 tasks) comparados com:
- **Best Tome**: o melhor jogador observado em cada task (99.9% percentile)
- **Compare Tome**: outro jogador específico (Player 2), task a task

100% automático via API pública do IdleonToolbox. Funciona para qualquer jogador com perfil público no IT.

## Instalação (1 vez, ~2 min)

1. Upload `Idleon_Tome_Tracker.xlsx` no Google Drive
2. Botão direito → Abrir com → Google Sheets
3. **Extensões → Apps Script**
4. Apaga o conteúdo, cola o `Code_Tome.gs`
5. Ctrl+S (dá um nome ao projeto)
6. Volta na planilha, F5
7. Menu novo: **IT Tome**
8. Clica em **Refresh everything** (primeira vez vai pedir autorização)

## Como usar

- **Config!B5** → teu nome de jogador (Player 1)
- **Config!B6** → nome do amigo (Player 2 para compare)
- **Menu IT Tome → Refresh everything** → puxa tudo e popula as duas abas

Quer comparar outras pessoas? Muda os nomes em Config e clica em Refresh de novo.

## O que cada aba mostra

### Best Tome (118 linhas)
- `#` → índice da task (1-118)
- `Tome Task` → nome
- `My Pts` → seus pontos
- `Top Pts (99.9%)` → pontos do jogador no 99.9% percentile (proxy de "melhor jogador")
- `Diff to Top` → quanto falta
- `% of Top` → percentual, com cor: verde >= 90%, amarelo 50-90%, vermelho < 50%

### Compare Tome (118 linhas + totais)
- `#`, `Tome Task` → idênticos
- `Player 1 Pts` / `Player 2 Pts` → pontos de cada
- `Diff (P1 - P2)` → positivo = você ganha, negativo = perde. Verde/vermelho.
- `Winner` → texto: o nome do vencedor ou "tie"
- Última linha → totais + placar (X wins - Y wins - Z ties)

## API endpoints usados

- `https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=NAME` → perfil completo do jogador (parsedData.tomePoints é o array de 118 pontos)
- `https://profiles.idleontoolbox.workers.dev/api/tome-percentiles` → distribuição por task

## Limitações

- IT atualiza ~uma vez por dia. Refresh múltiplo não muda nada.
- Profile precisa estar Public (ou Anonymous) — configurar em IT > Account > Profile Access.
- "Top Pts" é o 99.9% percentile, não o absolute max teórico de cada task. Tasks com hard cap (ex: Account LV cap 1710) costumam ter 99.9% = cap.

## Tela de menu

```
IT Tome
├── Refresh everything          (faz tudo de uma vez)
├── Build Best Tome
├── Build Compare Tome
├── ──────────
├── Reset Config layout
└── About
```

## Para distribuir publicamente

Mesma estratégia da planilha de leaderboards: qualquer pessoa faz uma cópia, cola o Code_Tome.gs, troca o nome em Config!B5 e B6, clica Refresh. Funciona com qualquer perfil público.
