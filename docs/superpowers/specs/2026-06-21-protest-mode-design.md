# Protest Mode — Design Spec

- **Data:** 2026-06-21
- **Branch:** `atualizacao-idleon-jun19`
- **Status:** Aprovado (aguardando review do spec)

## Contexto / Problema

Um bug do jogo impede o acesso a personagens localizados em mapas de World 1, 2 e 3,
deixando contas afetadas efetivamente injogáveis. O bug atinge **apenas contas que
tinham um overflow de dungeon XP antes da atualização das Caverns** — atualização que
"consertou" o overflow, mas introduziu este bug como efeito colateral.

Em protesto, o dono do site quer transformar temporariamente o conjunto de trackers
(Arkh's Idleon Trackers) numa única página que:

1. Denuncia o bug de forma impactante.
2. Explica o que é o bug.
3. Direciona a comunidade a reportá-lo no Discord oficial do jogo.

Enquanto o protesto estiver ativo, **nenhuma outra página deve ser acessível** — todas
redirecionam para a página de protesto. Quando o bug for corrigido, o site deve voltar
ao normal **de forma trivialmente reversível**.

## Objetivos

- Bloquear o acesso a todas as rotas existentes (`/`, `/leaderboards`, `/tome`,
  `/drop-rate`, `/talents-level`, `/cooking-mastery`, `/sheets`) enquanto o protesto
  estiver ativo.
- Servir uma página de protesto impactante, com explicação do bug e guia de report.
- Liga/desliga por uma única flag no código; reversível com um `git revert`.
- Não modificar as páginas/ferramentas existentes (a única exceção é um guard mínimo
  no `TopNav`).

## Não-objetivos

- Nenhuma mudança na lógica das ferramentas (DR, Tome, Talents, etc.).
- Nenhum sistema de feature-flags genérico / painel de admin.
- Sem env var na Vercel — decidido usar flag no código.

## Decisões

| Decisão | Escolha |
|---|---|
| Mecanismo de liga/desliga | Constante `PROTEST_MODE` no código (não env var) |
| Mecanismo de bloqueio | Next.js Middleware com redirect **307 (temporário)** |
| Rota da página | `/protest` (rota nova e isolada) |
| Tom | Impacto ("ON STRIKE" + faixas de alerta) + explicação + guia de report |
| Discord | `https://discord.gg/bTcgBgnv`, canal `#bug-reports` |

### Alternativas consideradas (e descartadas)

- **Guard no `layout.tsx`:** a URL não muda, o Next ainda processa cada página e não há
  redirecionamento real. Menos limpo.
- **`redirects` no `next.config`:** estático demais para um "tudo exceto X" condicional.

## Arquitetura

Middleware do Next.js intercepta toda requisição. Com `PROTEST_MODE` ligado, qualquer
rota — exceto `/protest`, assets e rotas internas — recebe um **redirect 307** para
`/protest`. Desligado, o middleware é no-op (passa tudo direto). Roda no servidor, então
o usuário nunca vê nem um flash das páginas reais.

## Arquivos

| Arquivo | Tipo | Conteúdo |
|---|---|---|
| `web/lib/protest/config.ts` | novo | `PROTEST_MODE` + dados do protesto |
| `web/app/protest/page.tsx` | novo | página de protesto (server component) + `noindex` |
| `web/app/protest/CopyReportButton.tsx` | novo | client component do botão "Copy report" |
| `web/middleware.ts` | novo | redirect condicional |
| `web/components/TopNav.tsx` | edit | esconde a navbar quando `PROTEST_MODE` |

### `web/lib/protest/config.ts`

```ts
// Single switch for protest mode. Flip to false (or `git revert` the protest
// commit) to restore the site to normal.
export const PROTEST_MODE = true;

export const PROTEST = {
  discordInvite: "https://discord.gg/bTcgBgnv",
  bugReportChannel: "#bug-reports",
  headline: "THE TRACKERS ARE ON STRIKE",
  subhead:
    "Every tool on this site is offline on purpose — and will stay offline until a game-breaking bug is fixed.",
  whatsBroken: [
    "A game bug prevents players from accessing characters located on World 1, 2 and 3 maps — the account becomes effectively unplayable.",
    'It only affects accounts that had a dungeon XP overflow before the Caverns update. That update "fixed" the overflow — but introduced this bug as a side effect.',
  ],
  steps: [
    "Join the official Idleon Discord",
    "Go to the #bug-reports channel",
    "Paste the report below — that's it",
  ],
  reportText:
    "🐛 Bug: After the Caverns update (the one that fixed the dungeon XP overflow), I can't access characters located on World 1–3 maps. Only happens on accounts that had a dungeon XP overflow before that update. The account is now unplayable. Please prioritize a fix 🙏",
} as const;
```

### `web/middleware.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { PROTEST_MODE } from "@/lib/protest/config";

export function middleware(req: NextRequest) {
  if (!PROTEST_MODE) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/protest")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/protest";
  return NextResponse.redirect(url, 307); // temporário, preserva o SEO original
}

export const config = {
  // Exclui rotas internas e qualquer arquivo com extensão (assets).
  matcher: ["/((?!_next/|_vercel/|favicon.ico|.*\\.).*)"],
};
```

> Mesmo desligado, o middleware roda e retorna `next()` imediatamente (custo
> desprezível) — assim a reversão não exige tocar no `matcher`.

### `web/components/TopNav.tsx` (edit mínimo)

```tsx
import { PROTEST_MODE } from "@/lib/protest/config";
// ...logo no início do componente:
if (PROTEST_MODE) return null;
```

A navbar some durante o protesto e volta sozinha quando a flag for desligada.

### `web/app/protest/page.tsx`

Server component renderizando o conteúdo aprovado (ver mockup v3). Estrutura:

- Faixa de alerta (caution stripes) no topo e no rodapé.
- `📢` + headline `THE TRACKERS ARE ON STRIKE` + subhead.
- Bloco **"What's broken"** (borda vermelha) com as duas linhas de `whatsBroken`.
- Bloco **"Help get it fixed"** com os 3 passos, a caixa do `reportText` (monospace,
  borda tracejada), `<CopyReportButton />` e um `<a>` para `discordInvite`
  (`target="_blank" rel="noopener noreferrer"`) com o label "Report on Discord →".
- `export const metadata = { robots: { index: false, follow: false } }`.

Estilo seguindo o tema atual (dark `#0b0b0d` / accent gold), com Tailwind (mesmo stack
do resto do app). As cores dos mockups servem de referência.

### `web/app/protest/CopyReportButton.tsx`

Client component (`"use client"`). Botão que copia `PROTEST.reportText` via
`navigator.clipboard.writeText`, com feedback visual curto ("Copied!").

## Comportamento

1. Usuário acessa qualquer URL → middleware → (se ligado) **307 → `/protest`**.
2. `/protest` e assets passam direto (sem loop).
3. **Report on Discord** abre o invite em nova aba; **Copy report** copia o texto pronto.
4. **Reverter:** `PROTEST_MODE = false` → middleware no-op, `TopNav` volta, ferramentas
   acessíveis. A `/protest` segue existindo, órfã e inofensiva.

## Detalhes que importam

- **SEO:** redirect **307 (temporário)** + `noindex` na `/protest` — evita que os
  buscadores troquem as URLs canônicas; ao reverter, as páginas originais voltam a
  indexar normalmente.
- **Sem loop / sem quebrar layout:** o `matcher` exclui `/protest`, `_next/*`,
  `_vercel/*`, `favicon.ico` e qualquer arquivo com extensão.

## Testes

- `web/__tests__/middleware.test.ts` (novo): com `PROTEST_MODE` mockado como `true`,
  uma rota arbitrária redireciona para `/protest` (307) e `/protest` passa direto; com
  `false`, tudo passa direto.
- `web/__tests__/components/TopNav.test.tsx` (ajuste): cobrir que o `TopNav` retorna
  `null` quando `PROTEST_MODE` está ligado, mantendo os testes atuais para o estado
  desligado.
- Página `/protest`: teste leve de render verificando headline, link do Discord e botão
  de copiar.

## Plano de reversão (quando o bug for corrigido)

1. `PROTEST_MODE = false` em `web/lib/protest/config.ts` (ou `git revert` do commit do
   protesto), commit + push na branch → deploy automático na Vercel.
2. (Opcional, depois) remover `web/app/protest/` e `web/middleware.ts` para limpeza
   total.
