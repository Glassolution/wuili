---
atualizado: 2026-11-08
---
# Integrações legadas

Código existe, mas não é o caminho atual. Não estender sem pedido explícito.

| Integração | Situação |
|---|---|
| **CJ Dropshipping** | **Descontinuada de vez.** Nunca reintroduzir → [[CJ Dropshipping descontinuada]]. `cj-*`, `cj_token_cache`, colunas `cj_*`. |
| Mercado Pago | Pagamento antigo (`mp-*`, `refresh-mp-tokens`); token morto; assinaturas migradas para [[ValidaPay]]. |
| Stripe | Antigo (`stripe-webhook`, `create-checkout-session`); 2 assinaturas ativas sem sincronizar (out/2026). |
| B2Drop | Scraper antigo (`scrape-b2drop`). |
| AliExpress, Shopify, TikTok Shop, Shopee | Conectores com código e tabelas, uso secundário. |
| `server/`, `api/` (Node) | Afiliados/produtos antigos; `/api/ref` ainda usado pela Vercel. |
