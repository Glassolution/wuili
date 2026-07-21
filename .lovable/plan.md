
# Storefront completo Loja 1 — estilo AERO STEP

Reconstrução do template "Loja 1" como uma storefront de verdade, com paleta creme (#f5f2ea / #e9e5d8), verde musgo (#3d4a2a) e dourado sutil (#c8a24a), cantos arredondados grandes e cards de estilo de vida. Entrego em 4 fases pequenas pra você validar cada uma antes de eu seguir — evita retrabalho.

## Design tokens (aplicados em todas as fases)

- Fundo base: `#f5f2ea` (creme claro)
- Superfícies/cards: `#ffffff` sobre creme, ou `#e9e5d8` (sálvia claro)
- CTA / cabeçalho / seções escuras: `#3d4a2a` (verde musgo)
- Acento (estrelas, badges, chip promocional): `#c8a24a` (dourado)
- Texto principal: `#1a1a1a` sobre creme, `#f5f2ea` sobre verde
- Raios: `rounded-[20px]` cards grandes, `rounded-full` botões/pills, `rounded-[14px]` cards de produto
- Botão primário: pill verde musgo com ícone circular claro à direita (igual print de referência)

## Fase 1 — Home da loja (a que aparece no editor)

Substitui integralmente o bloco JSX inline em `src/pages/GeneratedStoreEditorPage.tsx` (linhas ~3270–3450) e o componente público `src/components/store-templates/StorefrontLojaTemplate.tsx` para ficarem idênticos.

Estrutura nova (de cima pra baixo):

```text
[Navbar creme]  logo · nav central (Catálogo/Novidades/Ofertas/Sobre) · Entrar · Carrinho verde
[Hero card grande arredondado]
  esquerda: eyebrow "PRÊMIUM" · headline em 3 linhas · sub · 2 CTAs (pill verde + pill outline)
  direita: imagem de lifestyle recortada
  cards flutuantes: "Frete grátis" · "Prove antes de pagar" · "Produtos originais"
[Barra de busca creme + chips de categoria pill]
[Hits de venda]  título + "Ver todos" · grid de 5 cards de produto com heart, rating dourado, preço, badge de desconto
[2 cards lifestyle grandes]  Categoria A (imagem + copy + botão "Ver mais")  |  Categoria B
[Mais 2 cards lifestyle]  Categoria C  |  Categoria D
[Tech grid]  6 ícones em linha (Frete, Prova, Original, Qualidade, Suporte, Sustentável)
[Club card horizontal verde]  cartão membership + copy + CTA
[Strip de garantias]  4 colunas com ícone + label
[Footer]  logo · 4 colunas de links · social · copyright
```

Todos os textos, imagens, categorias e produtos continuam vindos das mesmas fontes de dados que já alimentam o editor ao vivo (`brandName`, `heroImage`, `displayedProducts`, `browseCategories`, `categoryHighlights` etc.), com os mesmos `data-editor-*` para o editor inline continuar funcionando.

## Fase 2 — Página de catálogo da loja

Rota `/loja/:slug/catalogo` (ou a rota pública equivalente já existente do storefront). Layout:

- Navbar + footer compartilhados da Fase 1
- Header creme com título "Catálogo", contagem de itens, busca
- Sidebar esquerda com filtros: categoria (checkbox), faixa de preço (slider), ordenação, marca. Colapsável no mobile.
- Grid de produtos em cards iguais aos da home
- Paginação em pills

Fonte de dados: os mesmos produtos que o storefront hoje lê (via `catalog` edge function + produtos importados pelo dono da loja).

## Fase 3 — Página de produto + carrinho

- **Página de produto** (`/loja/:slug/produto/:id`): galeria à esquerda, painel de compra à direita (título, rating, preço, variantes em pills, quantidade, botão "Adicionar ao carrinho" verde musgo, acordeão de descrição/entrega/devolução, seção "Você também pode gostar")
- **Carrinho** (`/loja/:slug/carrinho`): lista de itens com miniatura, ajuste de quantidade, resumo lateral com subtotal/frete/total e CTA "Finalizar compra"
- Sem checkout novo nessa fase — o botão de finalizar leva pro checkout que já existe hoje

## Fase 4 — Conta do cliente da loja

Isso exige backend novo (autenticação de clientes finais, separada do login do dono Velo). Entrego:

- Tabela `store_customers` (id, store_id, email, nome, senha via Supabase Auth) com RLS por `store_id`
- Tabela `store_customer_orders` (histórico) com RLS
- Edge function `store-customer-signup` e `store-customer-login`
- Páginas: `/loja/:slug/entrar`, `/loja/:slug/cadastro`, `/loja/:slug/conta` (dados, pedidos, endereços), todas no mesmo visual creme/verde
- Botão "Entrar" da navbar da loja passa a apontar pra essas rotas

Como isso mexe em auth e cria tabelas novas, faço só depois das Fases 1–3 aprovadas.

## Detalhes técnicos

- **Onde muda a home**: `src/pages/GeneratedStoreEditorPage.tsx` (JSX inline do preview do editor) + `src/components/store-templates/StorefrontLojaTemplate.tsx` (versão pública renderizada em `velods.com.br`). Os dois precisam ficar em paridade — tratei os dois na mesma edição.
- **Editor inline**: mantenho todos os atributos `data-editor-type`, `data-editor-section`, `data-editor-label`, `data-editor-product-id`, `data-editor-media-kind` pra edição inline (texto, imagens, ícones, seções) continuar funcionando sem regressão.
- **Seções customizadas**: preservo as chamadas `renderCustomSectionsAfter("hero" | "categories" | "body" | "promotions" | "collections" | "footer")` nos mesmos pontos, pra não quebrar seções que o usuário já tenha adicionado via `SectionsEditorPage`.
- **Dados**: nenhum mock — sigo usando `displayedProducts`, `catalog_products`, `user_projects`, integrações existentes.
- **Mobile**: cada fase usa o mesmo `mobilePreview` já suportado hoje e reflui pro celular (hero empilha, grid vira 2 colunas, sidebar de filtros vira drawer).
- **Fase 4 (auth de clientes)**: uso Lovable Cloud, RLS ativo em ambas as tabelas, sem `has_role`, sem tocar em schemas reservados.

## Ordem de entrega

1. Fase 1 (Home) — te mando pra revisar.
2. Se aprovar, sigo pra Fase 2 (Catálogo).
3. Depois Fase 3 (Produto + Carrinho).
4. Por último Fase 4 (Conta do cliente), já com o backend.

Posso começar pela Fase 1 agora?
