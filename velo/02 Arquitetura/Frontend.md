---
atualizado: 2026-11-24
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

### Início (`/dashboard`)
- Desktop: `src/pages/dashboard/DashboardHomePage.tsx`, no layout de workspace (referência "blobs", 24/11/2026): header com busca à esquerda, "+" azul e avatar; "Início /" + título com "Ver tutorial" e menu "⋯"; abas (Visão geral, Primeiros passos, Ferramentas, Atividade); destaque "Adicione seu primeiro produto" com título em Instrument Serif; "Atividade recente" mostra o trabalho no site da loja (criação, edição e publicação de cada projeto, via `fetchUserProjects()`/RPC `get_user_projects`), com a foto do agente pelo tipo de trabalho (lua = rascunho, cubo = edição, folha = publicação, sino = estado vazio; PNGs transparentes em `src/assets/agentes/`, sem moldura, com estrela e concha reservadas) e sem nome de agente, porque o banco ainda não registra qual agente fez cada mudança; as linhas de onboarding (próximo passo, Mercado Livre, publicação) ficam na aba Primeiros passos. Sem barra do Atlas desde 24/11/2026 (pedido do dono): no desktop a Início não abre mais o Atlas, e o último passo do `AtlasTour` (alvo `home-atlas-chat`) aparece centralizado, sem destaque. Fundo branco, fonte Inter (classe `velo-fonte-inter`, já que o painel força Hanken Grotesk), acento `#2F5BEA`. Fotos em `src/assets/home-card-*.webp`.
- A busca do header abre a mesma paleta do atalho "/" pelo evento `ABRIR_BUSCA_EVENT` (`src/lib/abrirBusca.ts`), ouvido pela `DashboardSidebar`.
- Celular (<768px): continua no `MobileHome` (home estilo marketplace), por decisão.
- Sidebar: `DashboardSidebar.tsx` + `DashboardSidebar.styles.ts` (248px, branca, item ativo `#EEF2FE`/`#2F5BEA`).

## Admin `/admin/*`
`usuarios`, `suporte`, `reembolsos`, `vendas`, `rastreio`, `comissoes`, `central-de-ajuda`, `assistente-ia`, `evidencias`, `consulta`, `automacao-bot`… → [[Painel admin]]. Rota protegida por `AdminRoute`.

## Convenções
- Arquivos `*Old.tsx` e `*RoutePage.tsx` no admin: versões antigas/wrappers — confira qual a rota usa antes de editar.
- Testes: Vitest (`src/lib/*.test.ts`) → [[Deploy e comandos]].
