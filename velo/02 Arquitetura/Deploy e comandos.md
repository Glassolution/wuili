---
atualizado: 2026-11-08
fontes: [package.json, vercel.json, CLAUDE.md §12]
---
# Deploy e comandos

```bash
npm run dev        # Vite local
npm run build      # build de produção (dist/)
npm test           # Vitest (src/**/*.test.ts)
npm run lint
supabase functions deploy <nome>          # landing-stats precisa de --no-verify-jwt
# Migrations: a pasta ativa é drizzle/migrations/ (Lovable). O `supabase db push` do CLAUDE.md §12 é do fluxo antigo → [[Banco de dados]]
deno test supabase/functions/_shared/     # testes Deno (*_test.ts)
```

## Regras do dono do projeto
- **Publicar = push direto na `main`**, só quando ele pedir. A Lovable sincroniza a `main`.
- **Nada é aplicado no Supabase** (migration, deploy de função, SQL que grava) sem aprovação explícita antes.
- O conector Supabase desta conta **não tem permissão** de leitura SQL no projeto (nov/2026); esquema vem de `types.ts`.
- `deno.lock` costuma mudar sozinho ao rodar Deno; cuidado ao commitar.

## Vercel
- `vercel.json`: SPA (`/index.html`), `/ref/*` → `/api/ref`, `X-Robots-Tag: noindex` em `/ajuda*`.

## Variáveis do front (`.env.example`)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_GA_MEASUREMENT_ID`… Segredos de servidor ficam nas Edge Functions.

Ver também: [[Arquitetura geral]], [[Migrations pendentes]].
