---
atualizado: 2026-11-12
fontes: [CLAUDE.md, roadmap.md]
---
# Catálogo

Produtos da [[C7Drop]] para o usuário escolher e importar.

- AliExpress exclusivo de admins por `user_roles`: migration 0054 aplica RLS restritiva e fecha RPC de loja por IDs; guard no servidor bloqueia ML, TikTok Shop e páginas IA antes de chamadas externas, inclusive dados antigos. Atlas restringe ficha completa e categorias a C7Drop. Não altera anúncios existentes.
- Verificação autenticada: admin acessa a ficha; Davi (não admin) recebe zero linhas no link/favoritos/RPC público e 403 em ML com e sem ID. Quatro testes de regra passaram.

- Rotas: `/dashboard/catalogo`, `/dashboard/catalogo/:id` (ficha), `/dashboard/produtos-em-alta`, `/colecoes`, `/catalogo` (público).
- Servido pela função `catalog` (paginado); filtros em `src/lib/catalogFilters.ts`, categorias em `catalogCategories.ts`.
- Regras: nunca mostrar `stock_quantity = 0`; respeitar `is_active`/`is_blocked`; preço sugerido e "sobra bruta estimada" iguais na home, ficha e publicação (`src/lib/productPricing.ts`); nada de métrica sem origem verificável.
- Home mobile personaliza e ordena por dados reais (`mobile_catalog_popularity`).
- Imagens: pipeline de visão (todos os modelos precisam aprovar), recuperação de produtos só com aprovação → [[Validação de imagens do catálogo]].
- Importar: `src/lib/productImportDraft.ts`, `importedProductsContext.tsx` → [[Publicação no Mercado Livre]].

Tabelas: [[Tabelas - Catálogo]].
