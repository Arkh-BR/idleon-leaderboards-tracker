# Idleon Leaderboards — Versão Web

Versão site da planilha `Idleon_Leaderboards.xlsx`. Mostra sua posição em todos
os 153 leaderboards do [IdleonToolbox](https://idleontoolbox.com), com:

- Busca, filtro por categoria e ordenação por coluna
- Top 10 expansível por leaderboard
- Dashboard com tier summary, heatmap por categoria, top piores, quick wins e melhores 30
- Funciona para qualquer jogador (campo de input)
- Cache server-side de 15min por jogador (a API do IT atualiza ~1x por dia)

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** para estilo
- API route `/api/leaderboards` atua como proxy server-side
  (necessário porque o IT bloqueia chamadas CORS direto do navegador)

## Rodar local

Pré-requisito: Node.js 20+ (testado com Node 24).

```bash
cd web
npm install
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

## Build de produção

```bash
npm run build
npm start
```

## Deploy no Vercel (recomendado, grátis)

1. Suba o repositório no GitHub
2. Em [vercel.com/new](https://vercel.com/new), importe o repo
3. **Root Directory:** `web`
4. Framework Preset: Next.js (auto-detectado)
5. Deploy → pronto, URL `https://seu-projeto.vercel.app`

Sem variáveis de ambiente. Sem banco. Sem nada além de Node.

## Arquitetura

```
web/
├── app/
│   ├── api/leaderboards/route.ts   # Proxy server-side para a API do IT
│   ├── layout.tsx
│   ├── page.tsx                    # UI principal (tabs + input do jogador)
│   └── globals.css
├── components/
│   ├── LeaderboardsTable.tsx       # Tabela filtrável dos 153 leaderboards
│   └── Dashboard.tsx               # 5 seções analíticas
└── lib/
    ├── registry.ts                 # Os 153 leaderboards (porta do Code.gs)
    ├── format.ts                   # Notação Idleon (M/B/T/Q/QQ/QQQ)
    └── rank.ts                     # Cores e tiers do rank
```

### Por que o proxy server-side?

A API `profiles.idleontoolbox.workers.dev` responde 200 server-side, mas o
preflight OPTIONS **não retorna `Access-Control-Allow-Origin`**, então o
navegador bloqueia chamadas diretas (`net::ERR_FAILED`). A API route do Next
faz a chamada server-side, monta um payload combinado de top10 + rank/score do
jogador, e devolve pro frontend com CORS implícito (mesma origem).

O cache em memória dura 15min por jogador (a API do IT só atualiza ~1x por
dia, então não faz sentido refetchar com mais frequência).

## Limitações conhecidas

- Mesmas da planilha: se o perfil do jogador no IT estiver "Private", a API
  não retorna nada — peça pra mudar pra Public ou Anonymous em IT → Account →
  Profile Access
- Nomes anônimos (`Anon#xxxxxx`) precisam ser digitados com esse formato exato
- O cache é por instância serverless; em deploys com várias regiões cada uma
  tem seu próprio cache (não é problema na prática)
