## Objetivo

Cada página de vendas gerada passa a ter **3 telas conectadas** que o cliente final do usuário percorre:

1. **Tela 1 — Produto** (a landing atual): CTA "Comprar agora".
2. **Tela 2 — Carrinho / Confirmação**: resumo do pedido, quantidade, forma de pagamento, botão "Ir para checkout" (inspirada na imagem 2 — Cart / Coralab).
3. **Tela 3 — Checkout**: dados do comprador + endereço + pagamento (Cartão ou **Pix**), botão "Pagar" (inspirada na imagem 3 — Configure your plan).

No **editor**, as três telas aparecem lado a lado (fluxo horizontal estilo Google Stitch), conectadas por linhas indicando "Tela 1 → Tela 2 → Tela 3", e cada uma é clicável para editar seu conteúdo. Após pagamento aprovado, o pedido cai automaticamente em `/dashboard/pedidos` do usuário dono da página.

---

## Rotas públicas novas

Hoje existe apenas `/p/:slug` (landing). Serão adicionadas:

```
/p/:slug              → Tela 1 (produto)  [já existe]
/p/:slug/carrinho     → Tela 2 (confirmação)
/p/:slug/checkout     → Tela 3 (checkout + Pix/cartão)
/p/:slug/obrigado     → confirmação pós-pagamento
```

Todas leem da mesma linha em `generated_sales_pages` (via slug) — as 3 telas compartilham produto, preço, imagens, cor de marca. Estado do carrinho passa via querystring/sessionStorage por enquanto (produto único).

---

## Editor: visão em fluxo horizontal

Em `GeneratedStoreEditorPage` (ou página equivalente da sales page) adiciono um modo **"Fluxo"**:

```text
┌────────────┐    ┌────────────┐    ┌────────────┐
│  Tela 1    │───▶│  Tela 2    │───▶│  Tela 3    │
│  Produto   │    │  Carrinho  │    │  Checkout  │
└────────────┘    └────────────┘    └────────────┘
```

- Cada card é um iframe do preview real da rota correspondente com `?editor=1`.
- Clicar num card seleciona a tela e abre o painel de edição à direita (headline, CTA, cores, textos do checkout como "Pagamento seguro").
- Setas SVG entre os cards indicam a transição.
- Zoom / pan simples (scroll horizontal + botões +/−) para caber tudo.

## Telas — o que cada uma mostra

**Tela 2 (Carrinho)** — inspirada na imagem 2:
- Título "Carrinho" + contador
- Card com imagem, nome, preço, seletor de quantidade, "Remover"
- Bloco "Pagamento seguro — Visa, Master, Pix, até 12x"
- Total + botão preto largo "Ir para checkout"

**Tela 3 (Checkout)** — inspirada na imagem 3, adaptada ao BR:
- Coluna esquerda: **Forma de pagamento** (tabs Cartão / **Pix**), Nome completo, CPF, e-mail, telefone, CEP + endereço.
- Coluna direita: resumo do pedido fixo (imagem, título, preço, frete, total), botão "Pagar".
- Se Pix escolhido → após clicar, mostra QR Code + copia-cola (retornados pela edge function).
- Se Cartão → campos de cartão (Mercado Pago SDK JS para tokenizar no browser, sem passar número pelo backend).

## Backend — pagamento + pedido

Edge Function nova: `public-sales-checkout`
- Recebe: `slug`, dados do comprador, método (`pix` | `credit_card`), `card_token?`.
- Busca a `generated_sales_pages` pelo slug → pega `user_id` (dono) e `catalog_product_id`, `price_brl`, `product_title`, `hero_image_url`.
- Cria pagamento no Mercado Pago usando o `MERCADOPAGO_ACCESS_TOKEN` da plataforma (mesma conta do checkout de assinatura — **não mexe** no fluxo de assinatura nem no OAuth de sellers).
- Retorna: `pix_qr_code` + `pix_qr_code_base64` (Pix) ou `status` (cartão).

Tabela `store_orders` (nova):

```sql
create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,           -- dono da página (recebe o pedido)
  sales_page_id uuid not null references public.generated_sales_pages(id),
  catalog_product_id uuid,
  product_title text not null,
  product_image_url text,
  quantity int not null default 1,
  unit_price numeric(10,2) not null,
  total numeric(10,2) not null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  buyer_cpf text,
  shipping_address jsonb,
  payment_method text not null,    -- 'pix' | 'credit_card'
  payment_status text not null default 'pending',  -- pending|approved|rejected
  mp_payment_id text,
  pix_qr_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
grant select, insert, update on public.store_orders to authenticated;
grant insert on public.store_orders to anon;   -- cliente final sem login
grant all on public.store_orders to service_role;
alter table public.store_orders enable row level security;

-- Dono da página vê seus pedidos
create policy "owner reads own store orders"
  on public.store_orders for select to authenticated
  using (auth.uid() = user_id);

-- Inserção só via edge function (service_role); nenhuma policy para anon/authenticated insert direto.
```

Webhook `mp-webhook` já existe → adicionar branch: quando `metadata.kind = 'store_order'`, atualizar `store_orders.payment_status` e `mp_payment_id` pelo `external_reference`. Isso dispara também uma notificação para o dono via `notify_new_order` trigger equivalente (já existe para `orders`; replicaremos o padrão).

## Dashboard — página de Pedidos

`OrdersPage` (`/dashboard/pedidos`) já lista pedidos ML. Adiciono uma aba/segmento **"Loja"** que consulta `store_orders` do `auth.uid()` e mostra: comprador, produto, valor, método, status, data. Detalhe do pedido com endereço, telefone, CPF e status de pagamento.

## Arquivos a criar / alterar

Novos:
- `src/pages/public-sales/SalesCartPage.tsx` (Tela 2)
- `src/pages/public-sales/SalesCheckoutPage.tsx` (Tela 3, com Pix + cartão)
- `src/pages/public-sales/SalesThankYouPage.tsx`
- `src/components/editor/SalesFlowCanvas.tsx` (visão horizontal 3 cards + setas)
- `supabase/functions/public-sales-checkout/index.ts`
- migration `store_orders` + política + policies + branch no `mp-webhook`

Alterados:
- `src/App.tsx` — registrar `/p/:slug/carrinho`, `/p/:slug/checkout`, `/p/:slug/obrigado`
- Página do editor da sales page — adicionar toggle "Fluxo" que renderiza `SalesFlowCanvas`
- `src/pages/dashboard/OrdersPage.tsx` — aba "Loja" lendo `store_orders`
- `supabase/functions/mp-webhook/index.ts` — tratar `kind=store_order`

## O que NÃO muda

- OAuth de seller MP (`connect-mercadopago-seller`, `mp-seller-auth-url`) — intocado.
- Checkout de assinatura (`mp-checkout`) — intocado.
- Nenhuma RLS existente é alterada.
- Nenhum campo sensível novo em `get_public_store_products`.

## Fora de escopo desta entrega

- Múltiplos itens no carrinho (order bumps da imagem 2). Estrutura já suporta, mas UI de add-on fica para depois.
- Cálculo real de frete por CEP (usaremos frete fixo configurável por página; default R$ 0).
- Split de pagamento para seller conectado — nesta primeira versão o pagamento cai na conta da plataforma; repasse manual. Split via seller MP fica para uma iteração seguinte.

---

Confirma que posso seguir com esse escopo? Em especial: (a) frete fixo por enquanto, (b) pagamento cai na conta da plataforma nesta primeira versão (sem split ainda).