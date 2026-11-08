---
atualizado: 2026-11-08
fontes: [package.json, vite.config.ts, vercel.json, src/App.tsx]
---
# Arquitetura geral

> Não é Next.js: é Vite + React Router (`src/pages`). Textos antigos que digam o contrário estão desatualizados.

## Camadas
| Camada | O quê |
|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind + shadcn/ui (Radix), React Router. Editado também pela **Lovable** (sincroniza com a `main`). → [[Frontend]] |
| Backend | Supabase / Lovable Cloud, projeto `nqzpoioxvbqavrtphtoa`: Postgres com RLS, Auth, Storage, **Edge Functions em Deno** (~134), `pg_cron` → [[Edge Functions]], [[Banco de dados]] |
| IA | Gemini direto (`GEMINI_API_KEY`) e Lovable AI Gateway → [[IA e modelos]] |
| Pagamentos | ValidaPay (atual) → [[ValidaPay]]; MP/Stripe legados |
| Fornecedor | C7Drop (scraping + bot Node externo que compra) → [[C7Drop]] |
| Deploy | Vercel (front, `dist/`) + Supabase (funções) → [[Deploy e comandos]] |

## Pastas que importam
- `src/pages/` (rotas; `dashboard/`, `admin/`, `help/`), `src/components/` (por área: `dashboard`, `admin`, `help-center`, `support`, `landing`, `storefront`…), `src/lib/` (regras e utilitários, com testes `*.test.ts`), `src/hooks/`, `src/contexts/` (Auth, Atlas).
- `src/integrations/supabase/` — cliente e `types.ts` (esquema gerado).
- `supabase/functions/` — Edge Functions; `_shared/` com regras de servidor → [[Módulos compartilhados]].
- `supabase/migrations/` — ~262 migrations SQL.
- `server/`, `api/` — Node antigo (afiliados, produtos, `/api/ref` na Vercel). Pouco usado.
- Ruído (ignorar ao procurar): `dist/`, `scratch/`, `tmp/`, `*.png` na raiz, relatórios `0X_*.md`, `drizzle/`.

## Regras fixas
- Sem rotas `src/app/api/`: lógica de servidor só em Edge Function.
- Edge Function é Deno: nada de pacote Node.
- Secrets só via `Deno.env.get`. RLS em todas as tabelas.
- `any` só com comentário justificando.
