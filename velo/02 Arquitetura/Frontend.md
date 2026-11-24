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
- Desktop (desde 24/11/2026, pedido do dono, no layout de uma referência de app de cofres): `src/pages/dashboard/DashboardHomePage.tsx`. Fundo cinza-claro `#F2F3F6`, coluna central de 660px. Barra do topo no desenho da referência: links centralizados (Projetos, Pedidos, Comunidade) e, à direita, botão redondo de busca (dispara `ABRIR_BUSCA_EVENT`) e pílula da conta (foto, primeiro nome e ícone de menu) que abre Configurações, Integrações e Comunidade e Ajuda (fecha com Esc); sem o "+". Cartão de vendas no alto (mantém o alvo do tour `home-primeiros-passos`): cabeçalho desfocado "Suas vendas / 7D 30D 3M Tudo" só decorativo, frase "Acompanhe as vendas da sua loja em um só lugar", degradê rosa/lilás/azul e ícone de sacola; **sem número**, porque não há leitura de vendas pronta para a Início (os pedidos são consultados dentro de `OrdersPage`) e consulta nova ao Supabase é da Lovable; o cartão leva a `/dashboard/pedidos`. Abaixo, "Ferramentas" (coluna de 720px) com abas em pílula (Para começar / Avançado) e, à direita, "Seus cards" com dois botões: personalizar e abrir Projetos. Grade de 3 colunas no padrão de cartão da referência: selo colorido (ícone ou logo) + PNG de agente, selo de tipo no canto, categoria, título, etiquetas (a primeira preenchida, com chama), "Ação" com um verbo grande em fonte fina e barra. Em Para começar a barra mostra a ordem sugerida (Etapa 1, 2, 3 de 3: Catálogo, Templates, Mercado Livre, que leva a Configurações > Integrações); em Avançado (Produtos em Alta, Imagens com IA, Avatares, Publicações) a barra é cheia e o rodapé diz "Abrir". "Páginas com IA" ficou de fora porque as páginas da loja moram em Projetos. O último cartão é o azul "Projetos", com o total real de projetos (`fetchUserProjects()`). **Personalizar cards**: painel com um interruptor por cartão; os escondidos ficam no `localStorage` (`velo:inicio:cartoes-ocultos:<userId>`, só neste navegador, com try/catch), aparece um cartão tracejado "Adicionar card" quando a aba tem cartões escondidos, e "Mostrar todos" volta ao padrão. Os dados dos cartões ficam em `FERRAMENTAS` no próprio arquivo. A animação de primeira entrada (intro pós-onboarding) continua aqui.
- A busca do header abre a mesma paleta do atalho "/" pelo evento `ABRIR_BUSCA_EVENT` (`src/lib/abrirBusca.ts`), ouvido pela `DashboardSidebar`.
- Celular (<768px): continua no `MobileHome` (home estilo marketplace), por decisão.
- Sidebar: `DashboardSidebar.tsx` + `DashboardSidebar.styles.ts` (248px, branca, item ativo `#EEF2FE`/`#2F5BEA`).

### Projetos (`/dashboard/projetos`)
- `src/pages/dashboard/ProjetosPage.tsx` (24/11/2026): é a antiga Início do desktop, com título "Seus projetos", breadcrumb "Início / Projetos", abas (Visão geral, Primeiros passos, Ferramentas, Atividade); banner "Loja, Agentes, Resultados" (`src/assets/home-banner-resultados.webp`, 1672×941) inteiro numa faixa de 280px, com o fundo na cor da imagem (`#F7F3ED`); "Atividade recente" mostra o trabalho no site da loja (criação, edição e publicação de cada projeto, via `fetchUserProjects()`/RPC `get_user_projects`), com a foto do agente pelo tipo de trabalho (lua = rascunho, cubo = edição, folha = publicação, sino = estado vazio; PNGs transparentes em `src/assets/agentes/`, também usados nos cartões da Início) e sem nome de agente, porque o banco ainda não registra qual agente fez cada mudança; as linhas de onboarding (próximo passo, Mercado Livre, publicação) ficam na aba Primeiros passos. Sem animação de entrada e sem alvos do tour. Editar agentes ainda não existe (o banco não guarda agentes): por enquanto só projetos e o botão de editar o site. Item "Projetos" na sidebar logo abaixo de Início.

## Admin `/admin/*`
`usuarios`, `suporte`, `reembolsos`, `vendas`, `rastreio`, `comissoes`, `central-de-ajuda`, `assistente-ia`, `evidencias`, `consulta`, `automacao-bot`… → [[Painel admin]]. Rota protegida por `AdminRoute`.

## Convenções
- Arquivos `*Old.tsx` e `*RoutePage.tsx` no admin: versões antigas/wrappers — confira qual a rota usa antes de editar.
- Testes: Vitest (`src/lib/*.test.ts`) → [[Deploy e comandos]].
