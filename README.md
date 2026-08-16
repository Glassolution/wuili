# Velo

# Wuili — Plataforma de Dropshipping Completa

## O que é a Wuili

Wuili é uma plataforma de dropshipping simplificada para qualquer pessoa começar a vender online sem estoque. O usuário cria sua loja, escolha produtos de fornecedores reais e publica automaticamente no Mercado Livre, Shopee e mais — tudo com 1 clique.

---

## Stack

- React + TypeScript + Tailwind CSS
- Recharts (gráficos)
- React Router (rotas)
- Lucide React (ícones)
- shadcn/ui (componentes base)

---

## Design System

### Cores principais
```
Roxo principal:  #635bff
Roxo escuro:     #4f46e5
Roxo claro:      #ede9ff
Azul escuro:     #0a2540
Azul médio:      #425466
Azul cinza:      #697386
Cinza fundo:     #f6f9fc
Borda:           #e3e8ef
Verde:           #00d4aa
Verde claro:     #e0faf4
```

### Tipografia
- Font: Inter (Google Fonts)
- Títulos: font-weight 900, letter-spacing -2px
- Labels: uppercase, letter-spacing wide, font-weight 700
- Body: font-weight 400

### Estilo geral
- Design inspirado 100% na Stripe: fundo branco, limpo, profissional
- Cards com border-radius 16px, border 1px solid #e3e8ef
- Sombras suaves: 0 24px 72px rgba(10,37,64,0.14)
- Hover states com transition-all 150ms
- Botão primário: bg #635bff, texto branco, rounded-lg, shadow roxa

---

## ESTRUTURA DE ROTAS

```
/                    → Landing Page
/dashboard           → Visão Geral
/dashboard/catalogo  → Catálogo de Fornecedores
/dashboard/pedidos   → Pedidos Recebidos
/dashboard/publicacoes → Publicações
/dashboard/relatorios  → Relatórios
/dashboard/configuracoes → Configurações
```

---

## PARTE 1 — LANDING PAGE (`/`)

### Navbar (fixo no topo)
- Logo "Wuili" font-black à esquerda
- Links: Produtos, Soluções, Plano de preços, Desenvolvedores
- Direita: botão "Entrar" (ghost) + botão "Comece já ›" (roxo)
- Fundo branco com backdrop-blur, borda inferior sutil

### Hero Section (grid 2 colunas)

**Coluna esquerda:**
- Counter animado no topo: "Vendas hoje na plataforma: 1.247" (número incrementa +1 ou +2 a cada 2 segundos com setInterval)
- Título H1 gigante (font-size 56px, font-weight 900, letter-spacing -2.5px):
  "Plataforma de vendas online para qualquer pessoa."
- A palavra "qualquer" em cor roxa #635bff
- Subtítulo: "Crie sua loja, encontre produtos de fornecedores reais e publique automaticamente no Mercado Livre, Shopee e mais. Sem estoque, desde a primeira venda até a milionésima."
- Dois botões: "Comece já ›" (roxo) + "Registre-se com o Google" (branco com borda, ícone G colorido)

**Coluna direita — Cards flutuantes animados:**

Card principal (centro, levemente rotacionado -1 grau, animação float up-down):
- Barra de título estilo macOS (3 dots coloridos + URL bar mostrando "app.wuili.com.br")
- Corpo com 4 estados que ciclam automaticamente a cada 3.5 segundos:

  ESTADO 1 — "Passo 1 — Escolha seu template"
  3 opções de template clicáveis (Minimalista, Moderno, Dark Bold)
  
  ESTADO 2 — "Passo 2 — Adicione produtos"
  Lista de 3 produtos com emoji, nome, lucro estimado e botão "Adicionar"
  Ao clicar: botão vira "✓ Adicionado" em verde
  
  ESTADO 3 — "Passo 3 — Publicar com 1 clique"
  Produto selecionado no topo
  3 plataformas (Mercado Livre, Shopee, Minha Loja) com status animado:
  idle "Aguardando" → "Publicando..." → "✓ Publicado" (sequencial com delay)
  
  ESTADO 4 — "Passo 4 — Sua renda crescendo"
  Dois mini-cards: Lucro hoje R$284 (+24%) e Pedidos 12 (+3 hoje)
  Mini gráfico de barras com 7 barras (Seg-Dom), última barra roxa maior

- Dots de navegação na base do card (4 dots, ativo é roxo e mais largo)

Card satélite 1 (canto superior esquerdo, rotação +2 grau, float diferente):
- "Lucro esta semana" + "R$ 284" em roxo grande + "↑ +24%" em verde
- Barra de progresso animada (vai de 30% a 78% e volta)

Card satélite 2 (canto superior direito, rotação +1.5 grau):
- "Plataformas conectadas"
- Pills: "🛒 Mercado Livre ✓" (roxo), "🧡 Shopee ✓" (roxo), "📦 AliExpress" (cinza), "🏪 Minha loja ✓" (roxo)

Card satélite 3 (canto inferior direito, rotação -2 grau):
- Ícone 💰 verde
- "Venda realizada!" em negrito
- "Fone TWS vendido no Mercado Livre"
- "agora mesmo" em cinza
- Este card muda de conteúdo a cada ciclo de estado

**Gradiente de fundo (metade direita):**
Gradiente colorido animado cobrindo a metade direita da tela (roxo, ciano, rosa, laranja), com fade suave para branco na borda esquerda. Use CSS com múltiplos radial-gradients animados com @keyframes.

### Seção Logos Strip
- Label "Integrado com" fixo à esquerda
- Ticker infinito scrollando: Mercado Livre, Shopee, AliExpress, Shopify, WooCommerce, Pix, Stripe
- Texto cinza claro, fonte grande e bold
- Animação CSS contínua da direita para esquerda

### Seção Produtos (fundo #f6f9fc)
- Label "Plataforma completa"
- H2: "Soluções flexíveis para cada modelo de negócio"
- 3 colunas com borda divisória:
  1. 🏪 Loja Online — Templates profissionais prontos
  2. 📦 Catálogo de Fornecedores — +4.200 produtos verificados
  3. 🚀 Publicação Automática — 1 clique publica em todas as plataformas
- Cada coluna tem ícone colorido, título, descrição e link "Saiba mais →"

### Seção Como Funciona
- Label "Como funciona"
- H2: "Do zero à primeira venda em 4 passos"
- Grid 4 colunas com bordas divisórias internas:
  01 🏪 Crie sua loja — Template pronto em 5 minutos
  02 📦 Escolha produtos — +4.200 produtos verificados
  03 🚀 Publique com 1 clique — Vai pro ML, Shopee e sua loja automaticamente
  04 💰 Receba o lucro — Fornecedor entrega, você embolsa a diferença

### Stats Band (fundo #0a2540 escuro)
4 colunas de números grandes brancos:
- +4.200 produtos
- 1 clique para publicar
- 0 estoque necessário
- 99.9% uptime

### Seção Features (Bento Grid)
- Label "Funcionalidades"
- H2: "Tudo que você precisa num só lugar"
- Grid: 1 card largo no topo (col-span-2) + 2 cards embaixo

Card largo: "Publique em qualquer plataforma com 1 clique"
- Lado esquerdo: texto + chips de plataformas
- Lado direito: lista de produtos com botão "Publicar" + badge "Publicado agora" verde

Card médio 1: "Loja pronta, identidade sua" — 3 templates visuais
Card médio 2: "Dashboard real" — 3 rows de métricas (Lucro hoje, Pedidos, Produto + vendido)

### Seção Testimonials (fundo #f6f9fc)
- Label "Depoimentos"
- H2: "Quem já usa a Wuili"
- 3 cards com 5 estrelas, depoimento em itálico, avatar (inicial colorida) + nome + cidade:
  1. Ana Paula S., São Paulo — "Em 3 dias já tinha minha loja no ar..."
  2. Marcos R., RJ — "Trabalho com dropshipping há 2 anos..."
  3. Camila F., Fortaleza — "Não entendia nada de e-commerce..."

### Seção Pricing
- Label "Preços"
- H2: "Comece grátis, escale quando quiser"
- 3 cards, o central destacado com borda roxa e badge "MAIS POPULAR":

  Grátis R$0 — 1 loja, 50 produtos, publicação manual, dashboard básico
  Pro R$59/mês — loja completa, +4.200 produtos, automação 1 clique, ML + Shopee, suporte prioritário
  Negócio R$149/mês — tudo do Pro, múltiplas lojas, AliExpress direto, API, gerente dedicado

### CTA Final (fundo #0a2540)
- Glow radial colorido no centro
- H2: "Comece a vender ainda hoje"
- Subtítulo: "Sem estoque, sem risco, sem complicação."
- Dois botões: "Criar minha loja grátis ›" (branco) + "Fale com a equipe ›" (ghost branco)

### Footer (5 colunas)
- Logo + tagline + ícones sociais
- Produtos, Soluções, Recursos, Empresa
- Rodapé: CNPJ + Privacidade / Termos / Cookies

---

## PARTE 2 — DASHBOARD (rotas /dashboard/*)

### Layout do Dashboard
Sidebar fixa à esquerda (largura 224px, fundo branco, borda direita):
- Logo "Wuili" no topo
- Menu: 🏠 Visão Geral, 📦 Catálogo, 🛒 Pedidos, 🚀 Publicações, 📊 Relatórios
- Rodapé: ⚙️ Configurações + avatar do usuário
- Item ativo: fundo roxo claro (#f5f3ff), texto roxo, font-semibold

Topbar (altura 56px, fundo branco, borda inferior):
- Esquerda: título da página atual
- Direita: badge "● Online" verde + sino + avatar "TD" roxo

Conteúdo: margin-left 224px, fundo #f6f9fc, padding 32px

---

### Dashboard — Visão Geral (`/dashboard`)

**Tabs de período:** Últimas 24h | Semanal (ativo) | Mensal | Anual

**4 StatCards (grid 4 colunas):**
- 💰 Lucro: R$ 6.961,19 — ↑ +24%
- 🛒 Pedidos: 47 — ↑ +18%
- 📦 Produtos vendidos: 12 — ↑ +12%
- 👤 Clientes: 8 — ↑ +11%

**Grid inferior (2 colunas):**

Coluna esquerda — Gráfico de Faturamento (Recharts AreaChart):
```
Dados semanais:
Seg: 820, Ter: 1240, Qua: 980, Qui: 1680, Sex: 2100, Sáb: 1890, Dom: 2961
Linha roxa #635bff com área gradiente rgba(99,91,255,0.08)
Tooltip customizado branco com sombra
```

Coluna direita — Plataformas Conectadas:
- Mercado Livre ✓ Conectado (badge verde)
- Shopee ✓ Conectado (badge verde)
- AliExpress — Conectar + (badge cinza, clicável)
- Minha Loja ✓ Conectado (badge verde)
- Métricas: Lucro semanal R$6.961,19 / Pedidos 47 / Produtos 12

**Tabela Pedidos Recentes:**
Colunas: # | Produto | Plataforma | Status | Valor | Data

Dados:
```
#4821 | Fone TWS      | Mercado Livre | Entregue    | R$189,00 | hoje 14:32
#4820 | Tênis Casual  | Shopee        | Em trânsito | R$127,00 | hoje 11:15
#4819 | Kit Skincare  | Minha Loja    | Processando | R$89,00  | ontem 18:40
#4818 | Relógio Smart | Mercado Livre | Entregue    | R$234,00 | ontem 09:22
#4817 | Mochila Urban | Shopee        | Cancelado   | R$156,00 | 2 dias atrás
```

Status badges: Entregue=verde, Em trânsito=âmbar, Processando=roxo, Cancelado=vermelho

---

### Dashboard — Catálogo (`/dashboard/catalogo`)

**Header:** título + input busca + tabs (Todos | Eletrônicos | Moda | Beleza | Casa) + botão "Importar do AliExpress +"

**Grid de produtos (4 colunas):**

```
Produtos (16 itens):
1.  🎧 Fone Bluetooth TWS      | TechImport BR  | lucro R$63  | preço R$89
2.  👟 Tênis Casual Masculino  | ModaFlex SP    | lucro R$47  | preço R$127
3.  💄 Kit Skincare Coreano    | BeautyAsia     | lucro R$38  | preço R$89
4.  ⌚ Relógio Smartwatch      | TechImport BR  | lucro R$82  | preço R$234
5.  🎒 Mochila Urbana          | UrbanBags      | lucro R$55  | preço R$156
6.  🕶️ Óculos de Sol Retrô     | StyleVision    | lucro R$34  | preço R$78
7.  🖱️ Mouse Sem Fio           | TechImport BR  | lucro R$28  | preço R$67
8.  📱 Capa iPhone 15          | CaseBR         | lucro R$22  | preço R$39
9.  🌸 Perfume Importado       | BeautyAsia     | lucro R$71  | preço R$189
10. 👠 Tênis Feminino          | ModaFlex SP    | lucro R$52  | preço R$144
11. 📷 Câmera de Segurança     | TechImport BR  | lucro R$94  | preço R$278
12. 💻 Suporte Notebook        | OfficeGear     | lucro R$31  | preço R$89
13. 💅 Kit Maquiagem           | BeautyAsia     | lucro R$45  | preço R$119
14. 💡 Luminária LED           | HomeDeco       | lucro R$38  | preço R$97
15. 🔊 Caixa de Som BT         | TechImport BR  | lucro R$57  | preço R$167
16. 👜 Carteira Couro          | LeatherBR      | lucro R$44  | preço R$134
```

Cada card: área de imagem (emoji grande em fundo cinza), nome, fornecedor, lucro em roxo, preço, botão "+ Adicionar à minha loja" roxo (vira "✓ Adicionado" verde ao clicar).

---

### Dashboard — Pedidos (`/dashboard/pedidos`)

**3 StatCards:** Total pedidos 47 | Receita R$8.432 | Lucro líquido R$2.847

**Filtros:** busca + status (Todos/Processando/Em trânsito/Entregue/Cancelado) + plataforma

**Tabela completa** com 15 pedidos mock variados em status e plataforma.

Colunas: # | Produto | Cliente | Plataforma | Status | Valor | Lucro | Data | Ações (olho + nota)

---

### Dashboard — Publicações (`/dashboard/publicacoes`)

**Header:** botão "Nova Publicação +" + filtros de status

**Lista de publicações (12 itens):**
Cada row: emoji + nome do produto + badges de plataforma com status individual

Status por plataforma:
- ✓ Publicado → badge verde
- ⟳ Publicando → badge âmbar com animação pulse
- ✗ Erro → badge vermelho
- — Não publicado → badge cinza

Ao clicar numa publicação: painel lateral desliza da direita (w-96) com detalhes + botões Republicar/Editar/Remover.

---

### Dashboard — Relatórios (`/dashboard/relatorios`)

**4 KPI cards:** Ticket médio R$179,40 | Cancelamentos 3,2% | Produtos ativos 12 | Recorrentes 34%

**4 gráficos Recharts:**

1. AreaChart — Faturamento vs Lucro (mensal, linha roxa + linha verde)
```
Dados: Jan(4200/1400), Fev(5800/2100), Mar(4900/1700), Abr(7200/2800),
       Mai(6800/2400), Jun(9100/3600), Jul(8400/3200), Ago(11200/4500),
       Set(10800/4200), Out(13400/5600), Nov(15200/6800), Dez(18900/8400)
```

2. BarChart — Pedidos por plataforma (semanal, 3 barras: ML roxo, Shopee laranja, Loja verde)

3. Lista rankeada — Top 5 produtos mais vendidos com barra de progresso

4. PieChart — Distribuição por plataforma (ML 52%, Shopee 31%, Loja 17%)

---

### Dashboard — Configurações (`/dashboard/configuracoes`)

**6 tabs:** Perfil | Minhas Lojas | Integrações | Plano | Notificações | Segurança

**Perfil:** avatar circular com inicial + campos nome/email/telefone/CPF + botão salvar

**Minhas Lojas:** card com TrendStore BR (Ativa, template Moderno, 8 produtos, 23 vendas) + botão "+ Nova Loja"

**Integrações:**
- Mercado Livre ✓ Conectado
- Shopee ✓ Conectado
- AliExpress → Conectar +
- Shopify → Conectar +
- Stripe ✓ Conectado
- Pix ✓ Ativo

**Plano:** card mostrando plano Pro R$59/mês, renovação em 15 dias, botão upgrade

**Notificações:** 5 toggles (Nova venda, Produto publicado, Erro de publicação, Pedido em trânsito, Relatório semanal)

**Segurança:** formulário alterar senha + toggle 2FA + tabela sessões ativas

---

## REGRAS GERAIS DE IMPLEMENTAÇÃO

1. Use dados mock reais em todas as páginas — nenhuma tela vazia
2. Todos os botões devem ter estado de hover visível
3. Todos os números monetários formatados: R$ 0.000,00
4. Responsive básico (mobile: sidebar vira menu hamburguer)
5. Transições suaves em todos os estados (150ms ease)
6. Skeleton loading ao trocar de página
7. Empty states com emoji + texto + botão quando lista estiver vazia
8. Todas as animações do hero (float, counter, ciclo de estados) devem funcionar
9. O gradiente animado do hero deve cobrir a metade direita com movimento suave
10. Navegação entre páginas do dashboard deve ser instantânea com React Router

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wuili.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fb3d941a-e724-4fe6-9889-bdb7ec8b36f3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
