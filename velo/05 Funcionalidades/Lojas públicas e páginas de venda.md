---
atualizado: 2026-11-08
---
# Lojas públicas e páginas de venda

- Loja própria do seller: editor em `/minha-loja/*`, pública em `/loja/:slug/*` (alias `/store/:slug/*`, prévia `/preview/:slug/*`). Templates em `src/components/store-templates/`, seções em `store-sections/`.
- Páginas de venda com IA: `/dashboard/paginas-com-ia` (`ai-page-create`, `generate-sales-page`, PagePilot).
- Pixel Meta do seller: `src/lib/metaPixel.ts`.
- Tabelas: `user_projects`, `project_members`, `store_orders`, `store_reviews` → [[Tabelas - Afiliados, lojas e outros]].
- Pendências de segurança antigas (ago/2026) envolvem lojas públicas → [[Bugs conhecidos]].
