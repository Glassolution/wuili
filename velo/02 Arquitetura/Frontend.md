---
atualizado: 2026-11-08
fontes: [src/App.tsx]
---
# Frontend

Rotas em `src/App.tsx`; páginas em `src/pages/`.

## Público
- `/` landing (`Index.tsx`) → [[Landing e cadastro]]; `/login`, `/cadastro`, `/auth`, `/reset-password`, `/bem-vindo`, `/comecar`, `/onboarding/*`
- `/checkout`, `/assinatura/confirmada` → [[Assinatura e checkout]]
- `/ajuda`, `/ajuda/:categoria/:artigo` → [[Central de Ajuda]] (noindex; `/dashboard/ajuda` redireciona)
- `/loja/:slug/*`, `/store/:slug/*`, `/preview/:slug/*` → [[Lojas públicas e páginas de venda]]
- `/ref/:code`, `/convite/:token` → [[Afiliados]]
- `/termos`, `/privacidade`, `/docs`, callbacks OAuth (`/mercadopago/callback`, `/aliexpress/callback`)

## Painel `/dashboard/*` (logado)
`catalogo`, `catalogo/:id`, `produtos-em-alta` → [[Catálogo]] · `publicacoes`, `produtos-ml` → [[Publicação no Mercado Livre]] · `pedidos`, `orders/:id` → [[Pedidos e dropshipping]] · `planos`, `configuracoes`, `configuracoes/central-da-assinatura` → [[Assinatura e checkout]] · `atlas` → [[Atlas]] · `integracoes` · `saldos`, `transacoes`, `pagamentos`, `comissoes` · ferramentas de IA (`imagens-ia`, `criar-video`, `avatares`, `personagem-video`, `paginas-com-ia`) · `minha-loja` (editor de loja).

## Admin `/admin/*`
`usuarios`, `suporte`, `reembolsos`, `vendas`, `rastreio`, `comissoes`, `central-de-ajuda`, `assistente-ia`, `evidencias`, `consulta`, `automacao-bot`… → [[Painel admin]]. Rota protegida por `AdminRoute`.

## Convenções
- Arquivos `*Old.tsx` e `*RoutePage.tsx` no admin: versões antigas/wrappers — confira qual a rota usa antes de editar.
- Testes: Vitest (`src/lib/*.test.ts`) → [[Deploy e comandos]].
