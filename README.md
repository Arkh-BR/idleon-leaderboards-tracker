# Idleon Leaderboards Tracker

Rastreia a posição de qualquer jogador em todos os 153 leaderboards do
[IdleonToolbox](https://idleontoolbox.com), tudo automaticamente.

Tem dois sabores:

## 1. Versão Web (recomendada)

Site Next.js em [`web/`](web/) — interface rica com filtros, busca, ordenação,
top 10 expansível por leaderboard, e um dashboard com tier summary, heatmap por
categoria, top piores, quick wins e melhores posições. Funciona pra qualquer
jogador (campo de input).

**Deploy num clique no Vercel:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Arkh-BR/idleon-leaderboards-tracker&root-directory=web)

Pra rodar local:

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

Mais detalhes em [`web/README.md`](web/README.md).

## 2. Versão Planilha (Google Sheets)

Versão original — `Idleon_Leaderboards.xlsx` + `Code.gs` (Apps Script).
Instruções completas em [`INSTRUCOES.md`](INSTRUCOES.md).

Útil se você prefere mexer em planilha ao invés de site.

## Tome Tracker (bônus)

`Idleon_Tome_Tracker.xlsx` + os `Code_Tome*.gs` são uma planilha separada que
mostra o seu Best Tome — instruções em [`INSTRUCOES_TOME.md`](INSTRUCOES_TOME.md).

---

Fonte dos dados: [idleontoolbox.com](https://idleontoolbox.com) (API pública,
sem autenticação). Código do IT: [Morta1/IdleonToolbox](https://github.com/Morta1/IdleonToolbox).
