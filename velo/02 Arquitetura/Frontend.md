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
- Desktop (24/11/2026, a pedido do dono, voltou à versão anterior ao redesenho do dia, a do commit 2137d6bc): `src/pages/dashboard/DashboardHomePage.tsx`. Fundo `#F5F4F1`, "Bem-vindo à Velo! / Por onde você quer começar?", barra do Atlas em pílula com histórico, cartões 01 "Adicione seu primeiro produto" e 02 "Escolha o visual da sua loja", cartões Programa de afiliados, Página de vendas com IA e Venda no Mercado Livre, faixa "Próximo passo" e botão "Ver tutorial". Os componentes `AtlasPromptBox.tsx` e `AtlasMascote.tsx` (caixa do Atlas no estilo Shopify com o mascote) ficaram no projeto sem uso, caso voltem. A Início segue sem a moldura branca das outras páginas.
- A busca do header abre a mesma paleta do atalho "/" pelo evento `ABRIR_BUSCA_EVENT` (`src/lib/abrirBusca.ts`), ouvido pela `DashboardSidebar`.
- Celular (<768px): continua no `MobileHome` (home estilo marketplace), por decisão.
- Sidebar (24/11/2026, no desenho de uma referência de workspace): `DashboardSidebar.tsx` + `DashboardSidebar.styles.ts`. Fonte Inter (classe `velo-fonte-inter` no `<aside>`, sem números tabulares) e ícones Phosphor de traço fino (`@phosphor-icons/react`, já instalado) no lugar dos lucide nos itens, pastas, "+", recolher e seta; topo de 56px com "Velo" 20px/600; rótulos de seção cinza `#71717A` um pouco à esquerda dos ícones; filetes de ponta a ponta. Fundo `#F7F7F8`, 256px de largura com recuo de 20px à esquerda (recolhida volta a 12px), topo com marca e botão de recolher (`PanelLeft`; recolhida = 72px só com ícones, guardado em `localStorage` `velo:sidebar:recolhida`), filetes entre seções. Seções: **Principal** (Início, Pedidos, Afiliados se admin/afiliado, Publicações, Imagens com IA, Avatares, Lojas se admin); **Espaço de trabalho** (recolhível) com grupos de logo redondo colorido: Projetos (verde; subitens "Todos os projetos", os 3 projetos mais recentes via `fetchUserProjects()`, que abrem o editor, e "+ Novo projeto" → `/dashboard/minha-loja`), Produtos (azul; Catálogo, Páginas com IA, Templates) e Produtos vencedores (laranja; Produtos em Alta); **Suporte** (Comunidade e Ajuda, Indique e ganhe, que abre o convite). Item ativo = pílula branca com sombra leve, texto escuro. Card de upgrade e cartão da conta continuam embaixo; os cards promocionais "Indique e ganhe"/"Páginas com IA" viraram itens de menu. Barra de rolagem só aparece com o mouse em cima.
- Moldura das páginas (desktop, 24/11/2026, referência Shopify): em `DashboardLayout.tsx` o fundo do shell é o mesmo `#F7F7F8` da sidebar (sem borda à direita) e a coluna de conteúdo (banner, header, `<main>` e painel do Atlas) fica num cartão branco com 14px de margem em cima e embaixo e 8px à direita, cantos de 14px, borda `black/7%` e sombra leve. No modo início (laranja) o fundo continua laranja. Mobile não muda. Exceção: a Início (`/dashboard`) fica sem moldura (página branca de tela cheia e filete `#ECEEF2` na direita da sidebar), a pedido do dono.

### Projetos (`/dashboard/projetos`)
- `src/pages/dashboard/ProjetosPage.tsx` (24/11/2026): é a antiga Início do desktop, com título "Seus projetos", breadcrumb "Início / Projetos", abas (Visão geral, Primeiros passos, Ferramentas, Atividade); banner "Loja, Agentes, Resultados" (`src/assets/home-banner-resultados.webp`, 1672×941) inteiro numa faixa de 280px, com o fundo na cor da imagem (`#F7F3ED`); "Atividade recente" mostra o trabalho no site da loja (criação, edição e publicação de cada projeto, via `fetchUserProjects()`/RPC `get_user_projects`), com a foto do agente pelo tipo de trabalho (lua = rascunho, cubo = edição, folha = publicação, sino = estado vazio; PNGs transparentes em `src/assets/agentes/`, também usados nos cartões da Início) e sem nome de agente, porque o banco ainda não registra qual agente fez cada mudança; as linhas de onboarding (próximo passo, Mercado Livre, publicação) ficam na aba Primeiros passos. Sem animação de entrada e sem alvos do tour. Editar agentes ainda não existe (o banco não guarda agentes): por enquanto só projetos e o botão de editar o site. Item "Projetos" na sidebar logo abaixo de Início.

## Admin `/admin/*`
`usuarios`, `suporte`, `reembolsos`, `vendas`, `rastreio`, `comissoes`, `central-de-ajuda`, `assistente-ia`, `evidencias`, `consulta`, `automacao-bot`… → [[Painel admin]]. Rota protegida por `AdminRoute`.

## Convenções
- Arquivos `*Old.tsx` e `*RoutePage.tsx` no admin: versões antigas/wrappers — confira qual a rota usa antes de editar.
- Testes: Vitest (`src/lib/*.test.ts`) → [[Deploy e comandos]].
