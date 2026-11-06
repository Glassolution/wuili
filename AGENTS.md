# AGENTS.md — Guia do Projeto Velo

## Visão Geral
Velo ("Apenas venda."): plataforma de dropshipping com IA para iniciantes brasileiros. O usuário escolhe produtos do catálogo (scraping C7Drop), personaliza com IA e publica no Mercado Livre e Shopee.
Stack: React + TypeScript + Tailwind (frontend); Supabase/Lovable Cloud (Postgres, Auth, Edge Functions Deno, Storage); Gemini via Edge Functions; deploy Lovable Cloud + Vercel.

## Padrões
- Recurring cancellation uses `_shared/providerCancellation.ts` with durable requests and provider confirmation; payment activation and retries share `_shared/subscriptionLifecycle.ts`, and a database guard prevents terminal-contract reactivation. Post-cancellation charges are review-only incidents; never sweep historical cancellations or refund without per-transaction confirmation, because local cancellation does not stop provider billing.
- Admin Support list uses the role-guarded `admin_support_tickets_page` RPC (open tickets + 50 latest closed, all tickets when searching; last message, unread and counts computed in SQL) and loads full history only for the opened ticket; polling pauses when the tab is hidden — avoids downloading every message and per-user lookups.
- Admin Users uses profiles-based server pagination and role-guarded SQL page/count functions; keep requested-ID admin-users compatibility for other screens, aggregate orders only for page users, and share one SQL segment rule between page and counts to prevent inconsistent totals.
- Refund cooldown recovery uses the shared server-only `refundCooldown.ts` in ValidaPay confirmation and ML publication; require a non-trial active paid subscription created after the latest completed refund, with payment evidence, and compare-and-set the cooldown to avoid overwriting a concurrent refund. Identity refund blocks remain unchanged.
- Lifetime purchases use dedicated ONE_TIME ValidaPay prices and a server-owned purchase_kind marker; verified amounts grant non-expiring access, while legacy recurring contracts remain unchanged. Database period enforcement prevents reconciliation jobs from adding expiry or renewal dates.
- ValidaPay ONE_TIME charges are not linked to checkout sessions and send no webhook; `_shared/lifetimeCharge.ts` matches paid charges by account email, exact amount and time window (used by `subscription-sync-self` and the `expire-pending-charges` cron) so paid lifetime buyers are never left without access. The time-only fallback for buyers who typed another email refuses charges whose email has a Velo account, charges with no email, and any charge another account's unpaid checkout of the same amount could claim within 3 days; read failures stop recovery instead of skipping these checks, and a unique index on lifetime charge IDs stops one payment from activating two accounts. This avoids handing a paying customer's plan to someone who abandoned checkout, at the cost of some cases going to support.
- UI sempre em português brasileiro; preços em BRL; USD → BRL multiplica por 5.0.
- RLS ativo em todas as tabelas; revisar policies existentes antes de mudar schema.
- Secrets só via `Deno.env.get`; nunca no código-fonte.
- `any` só com comentário justificando.
- Regras de Edge Functions: ver `supabase/functions/AGENTS.md`.
- Reembolso/cancelamento da assinatura tem um único caminho: Configurações → Perfil, linha "Garantia de 7 dias" (fora do prazo, "Encerrar assinatura") (`RefundSection`, âncora `#velo-reembolso`, link `?tab=Perfil#velo-reembolso`). Ela mostra a conta (uso, produtos publicados, vendas) antes de qualquer pedido; "Solicitar reembolso" pede o motivo e oferece tutoriais/suporte, sem bloquear o envio. A regra (7 dias, status aceitos, sem reembolso repetido) e os textos de prazo ficam em `supabase/functions/_shared/refundPolicy.ts`, usado pelo site, pela IA de suporte e pelo `request-refund` — evita botão liberado num lugar e recusado no outro. Depois dos 7 dias a seção some do Perfil e "Cancelar renovação" aparece na aba Plano (`RefundSection local="plano"`, `CANCEL_PAGE_PATH`). O chat não faz nem nega reembolso: a IA identifica se é assinatura ou fornecedora e só dá uma orientação geral em texto ("em Configurações, na área de gerenciamento da assinatura"), sem aba, etapas, links, botões ou atalhos, sem reter e sem fila humana (só quando não acha assinatura). Mensagens antigas com `__VELO_REFUND_PROMPT__` viram só esse texto. Pedido padrão é criado só pelo `request-refund` (sem INSERT do cliente) e um índice único permite um pendente por cliente — evita duplicados em clique duplo.
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
- Bolinha de não lido no suporte admin: existe mensagem não interna do cliente mais nova que `support_tickets.admin_last_seen_at` (ou qualquer uma se nulo), independente de IA/needs_human; calculada só no banco (`support_ticket_is_unread`, usada pela lista e por `admin_support_unread_count`), espelhada em `src/lib/supportUnread.ts` para testes. Só clique ou resposta do admin chamam `admin_mark_support_ticket_seen`, a tela nunca abre ticket sozinha, e mensagem do cliente reabre ticket fechado (gatilho), que entra na lista mesmo fora dos 50 fechados — evita marcar como lido sem o admin ver.
- Conta ML conectada: apelido salvo em `user_integrations.ml_nickname` na `ml-callback` e completado/reconferido (7 dias) pela função `ml-account-info`, que devolve só o ID com aviso quando o token falha — evita chamar o ML a cada abertura da tela.
- Mercado Envios: o campo status.mercadoenvios de /users/me NÃO é confiável sozinho (31 contas com etiqueta gerada constam not_accepted; o sinal real de ME2 ativo é logistic_type=xd_drop_off nas shipping_preferences). Por isso o ml-publish NÃO bloqueia nem avisa o vendedor: logistic_type=drop_off também é comum e gera etiqueta normalmente (7 de 33 contas com etiqueta verificadas), então não há sinal confiável — após publicar, só registra SHIPPING_WITHOUT_ME2 em ml_publish_errors para análise interna. O status fica em ml_seller_readiness.mercadoenvios para a IA de suporte, e o MlMissingInfoModal tem "Já fiz, verificar de novo".
