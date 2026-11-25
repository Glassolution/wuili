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
- Desktop (24/11/2026, redesenhada no estilo de uma referência escura, em versão branca): `src/pages/dashboard/DashboardHomePage.tsx`. Fundo branco (`PAGE_BG`) com textura de pontinhos no topo; posições em `LAYOUT` (unidades de 1536, cqw). Título numa linha com o logo: "Por onde você quer começar?". Caixa do Atlas grande (`x(920)` × `y(232)`, cantos 28): texto animado em cima; embaixo, à esquerda "+" com borda (catálogo) e "Atlas" com selo "IA", à direita "Conversas" (`AtlasHistoryMenu`, só se houver histórico) e enviar redondo azul `#2563EB`; a lógica do chat não mudou (abre sugestões, Escape/clique fora fecha). Embaixo, três atalhos `ATALHOS_HOME` (ícones Hugeicons): Criar → `/dashboard/minha-loja`, Encontrar → `/dashboard/catalogo`, Agentes → `/dashboard/projetos` (alvo do tour `home-primeiros-passos`); e uma linha discreta "Próximo passo" com os dados reais do Mercado Livre. Saíram da Início os cards 01/02, os cards de Produtos/Pedidos/Mercado Livre e os agentes animados (as rotas continuam). Botão "Ver tutorial" no canto. Os componentes `AtlasPromptBox.tsx` e `AtlasMascote.tsx` ficaram no projeto sem uso, caso voltem. A Início segue sem a moldura branca das outras páginas.
- A busca do header abre a mesma paleta do atalho "/" pelo evento `ABRIR_BUSCA_EVENT` (`src/lib/abrirBusca.ts`), ouvido pela `DashboardSidebar`.
- Celular (<768px): continua no `MobileHome` (home estilo marketplace), por decisão.
- Sidebar (24/11/2026, visual igual ao da referência "Mova"; estrutura, rotas e ordem intocadas): `DashboardSidebar.tsx` + `DashboardSidebar.styles.ts`. Fonte Inter (classe `velo-fonte-inter` no `<aside>`, sem números tabulares). Ícones **Hugeicons Stroke Rounded** via `hugeicons-react` (traço 1.5; o pacote está marcado como deprecated e embrulha `@hugeicons/react`): Home01, TaskDone01, File01, Store01, UserGroup, Folder01, PlusSign, SidebarLeft, ArrowUp01, MoreVertical; os grupos de logo redondo seguem com lucide. Medidas: 256px, fundo `#F7F7F8`, borda direita 1px `#EBEBED` em todas as páginas, padding lateral 12px; topo 56px com logo + "Velo" 18px/600 `#18181B` e filete de ponta a ponta; rótulos 13px/400 `#8E8E93` (padding 16px 8px 8px); filetes `#EBEBED` com 12px de margem (o contêiner rolável usa `margin: 0 -12px; padding: 0 12px` para o filete não vazar e o menu não deslizar ao focar um botão); itens 38px, 15px/400 `#3F3F46`, ícone 18px `#52525B`, hover `#EFEFF1`, ativo = pílula branca com `0 1px 2px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.03)` e texto `#18181B`/500; subitens 34px, 14px, pasta 16px `#71717A`, guia vertical 1px `#E4E4E7`; "+ Novo projeto" `#A1A1AA` → `#52525B` no hover; card da conta branco, borda `#EBEBED`, raio 12, nome 14px/500, e-mail 12px `#8E8E93`. Seções: **Principal** (Início, Pedidos, Afiliados se admin/afiliado, Publicações, Lojas se admin; Imagens com IA e Avatares saíram do menu em 24/11/2026, rotas seguem no ar); **Espaço de trabalho** (recolhível) com grupos de logo redondo colorido: Projetos (verde; "Todos os projetos", os 3 projetos mais recentes via `fetchUserProjects()`, que abrem o editor, e "+ Novo projeto" → `/dashboard/minha-loja`), Produtos (azul; Catálogo, Páginas com IA, Templates) e Produtos vencedores (laranja; Produtos em Alta); A seção **Suporte** (Comunidade e Ajuda, Indique e ganhe) saiu da sidebar em 24/11/2026, provisoriamente: vai para outro lugar; `/dashboard/comunidade` e o `InviteFriendModal` continuam existindo, só sem atalho na sidebar. Recolher a sidebar (72px, `localStorage` `velo:sidebar:recolhida`) continua igual. Barra de rolagem só aparece com o mouse em cima.
- Moldura das páginas (desktop, 24/11/2026, referência Shopify): em `DashboardLayout.tsx` o fundo do shell é o mesmo `#F7F7F8` da sidebar (sem borda à direita) e a coluna de conteúdo (banner, header, `<main>` e painel do Atlas) fica num cartão branco com 14px de margem em cima e embaixo e 8px à direita, cantos de 14px, borda `black/7%` e sombra leve. No modo início (laranja) o fundo continua laranja. Mobile não muda. Exceção: a Início (`/dashboard`) fica sem moldura (página branca de tela cheia e filete `#ECEEF2` na direita da sidebar), a pedido do dono.

### Projetos (`/dashboard/projetos`)
- `src/pages/dashboard/ProjetosPage.tsx` (24/11/2026): é a antiga Início do desktop, com título "Seus projetos", breadcrumb "Início / Projetos", abas (Visão geral, Primeiros passos, Ferramentas, Atividade); banner "Loja, Agentes, Resultados" (`src/assets/home-banner-resultados.webp`, 1672×941) inteiro numa faixa de 280px, com o fundo na cor da imagem (`#F7F3ED`); "Atividade recente" mostra o trabalho no site da loja (criação, edição e publicação de cada projeto, via `fetchUserProjects()`/RPC `get_user_projects`), com a foto do agente pelo tipo de trabalho (lua = rascunho, cubo = edição, folha = publicação, sino = estado vazio; PNGs transparentes em `src/assets/agentes/`, também usados nos cartões da Início) e sem nome de agente, porque o banco ainda não registra qual agente fez cada mudança; as linhas de onboarding (próximo passo, Mercado Livre, publicação) ficam na aba Primeiros passos. Sem animação de entrada e sem alvos do tour. Editar agentes ainda não existe (o banco não guarda agentes): por enquanto só projetos e o botão de editar o site. Item "Projetos" na sidebar logo abaixo de Início.

## Admin `/admin/*`
`usuarios`, `suporte`, `reembolsos`, `vendas`, `rastreio`, `comissoes`, `central-de-ajuda`, `assistente-ia`, `evidencias`, `consulta`, `automacao-bot`… → [[Painel admin]]. Rota protegida por `AdminRoute`.

## Convenções
- Arquivos `*Old.tsx` e `*RoutePage.tsx` no admin: versões antigas/wrappers — confira qual a rota usa antes de editar.
- Testes: Vitest (`src/lib/*.test.ts`) → [[Deploy e comandos]].
