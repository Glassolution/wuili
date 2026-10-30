# AGENTS.md — Guia do Projeto Velo

## Visão Geral
Velo ("Apenas venda."): plataforma de dropshipping com IA para iniciantes brasileiros. O usuário escolhe produtos do catálogo (scraping C7Drop), personaliza com IA e publica no Mercado Livre e Shopee.
Stack: React + TypeScript + Tailwind (frontend); Supabase/Lovable Cloud (Postgres, Auth, Edge Functions Deno, Storage); Gemini via Edge Functions; deploy Lovable Cloud + Vercel.

## Padrões
- Lifetime purchases use dedicated ONE_TIME ValidaPay prices and a server-owned purchase_kind marker; verified amounts grant non-expiring access, while legacy recurring contracts remain unchanged. Database period enforcement prevents reconciliation jobs from adding expiry or renewal dates.
- ValidaPay ONE_TIME charges are not linked to checkout sessions and send no webhook; `_shared/lifetimeCharge.ts` matches paid charges by account email, exact amount and time window (used by `subscription-sync-self` and the `expire-pending-charges` cron) so paid lifetime buyers are never left without access.
- UI sempre em português brasileiro; preços em BRL; USD → BRL multiplica por 5.0.
- RLS ativo em todas as tabelas; revisar policies existentes antes de mudar schema.
- Secrets só via `Deno.env.get`; nunca no código-fonte.
- `any` só com comentário justificando.
- Regras de Edge Functions: ver `supabase/functions/AGENTS.md`.
- Support refund routing uses shared customer-message context before subscription actions; only the server inserts refund cards, and shared eligibility keeps renewal cancellation separate from refund eligibility. This avoids supplier requests becoming subscription cancellations and duplicate cards. Completed cancellation receipts must not reopen requests.
- Support navigation uses a verified public-page map shared by both support conversation paths; navigation-only questions do not require seller diagnostics or human escalation. This avoids invented menus and unnecessary AI tool calls.

## Tabelas principais
- `profiles`: dados do usuário (nome, plano, preferências, origem do anúncio).
- `user_integrations`: tokens OAuth do Mercado Livre e Shopee.
- `catalog_products`: produtos coletados só pelo scraping C7Drop.
- `user_publications`: anúncios publicados pelo usuário.
- `cj_token_cache`: legada, não usar.

## Integrações
- ML Client ID `5831446135077053`; redirect `https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/ml-callback`.
- Gemini: secret `GEMINI_API_KEY`.

## O que NÃO fazer
- Nunca reintroduzir a API da CJ Dropshipping (descontinuada).
- Nunca usar dados mockados na interface.
- Nunca exibir produtos com `stock_quantity = 0`.
- Nunca criar rotas `src/app/api/`; usar Edge Functions.

## Fluxo principal
Catálogo → importar produto → IA gera título/descrição → usuário revisa → publica no ML (`ml-publish`) → registro em `user_publications`.

## Identidade visual
Azul escuro `#1E3A8A`, azul elétrico `#2563EB`, branco/preto; logo nuvem preta com caixa; fundo da landing gradiente azul/lilás escuro.

- Servidor MCP (Claude etc.): definir ferramentas em `src/lib/mcp/` (o `supabase/functions/mcp` é gerado); só admins, via OAuth e RLS, somente leitura e sem tabelas de tokens — evita exposição de credenciais e ações com dinheiro.
- Vínculo anúncio → catálogo: quando a publicação ou a venda chega sem `catalog_product_id`, as funções usam `_shared/catalogLink.ts` (SELLER_SKU do anúncio = código do catálogo, depois RPC `resolve_catalog_product_for_listing`: título idêntico, foto, início do título; só resultado único) e gravam o vínculo no anúncio — evita vendas com "Fornecedor indisponível".
- Token ML morto: refresh que falha com `invalid_grant`/"client_id does not match" (token emitido pelo app antigo) marca `user_integrations.refresh_failed_at` via `_shared/mlSellerToken.ts` (`markRefreshTokenDead`, que também notifica o usuário 1x/semana); todos os jobs pulam o refresh enquanto a marca existir e a `ml-callback` a limpa na reconexão — evita centenas de chamadas inúteis ao ML a cada cron.
- Bolinha de não lido no suporte admin: calculada das mensagens (última não interna e não da IA é do cliente e mais nova que `support_tickets.admin_last_seen_at`), mesma regra em `src/lib/supportUnread.ts` e na RPC `admin_support_unread_count`; só clique ou resposta do admin chamam `admin_mark_support_ticket_seen`, e mensagem do cliente reabre ticket fechado (gatilho) — evita estado só no navegador e bolinha que não volta.
- Conta ML conectada: apelido salvo em `user_integrations.ml_nickname` na `ml-callback` e completado/reconferido (7 dias) pela função `ml-account-info`, que devolve só o ID com aviso quando o token falha — evita chamar o ML a cada abertura da tela.
