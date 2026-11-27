---
atualizado: 2026-11-27
fontes: [supabase/functions/_shared/utmify.ts, drizzle/migrations/0074_utmify_order_events.sql, roadmap.md]
---
# Avisos Utmify isolados

## Decisão
Medição é um aviso adicional, nunca parte da decisão financeira. Tarefas de compra/reembolso executam em `EdgeRuntime.waitUntil` com erro isolado e HTTP limitado a cinco segundos.

## Implementação aprovada
- `_shared/utmify.ts`: montagem, flags, limite de sete dias para pago/45 para reembolso, sanitização das UTMs e log técnico sem comprador/token/corpo bruto.
- `validapay-webhook/index.ts`: prepara aviso e só agenda após o trabalho existente. Meta/TikTok, ativação, comissão e e-mails intactos.
- `confirmedRefundLifecycle.ts` e `adminCourtesyRefund.ts`: só estorno confirmado da primeira compra com evidência; `PROCESSING`, renovação com acesso mantido ou cobrança de outro ciclo não geram estorno da compra inicial.
- `utmify-backfill`: manual, serviço interno/admin verificado; dry-run padrão, 1–7 dias, leitura paginada, sem inventar data de pagamento. Não executada.
- Migration 0074: `utmify_order_events`, dois índices além da PK, RLS e nenhuma policy; só service role.

## Estado
Liberação de 27/11 concluída para compras novas; renovações continuam desligadas.
- GitHub main confirmado em bf5babdc, com e039ec7a ancestral, sem divergência.
- Taxa fixa R$ 0,67 configurada por UTMIFY_GATEWAY_FEE_CENTS; commit 95195ea3, 26 testes Deno passaram. Inválida falha sem envio, taxa limitada ao total; percentual só quando fixa ausente.
- Parágrafo aprovado e data 27/11/2026 na política: 98abc951, print local conferido a 393 px; Felipe confirmou a publicação.
- Publicadas validapay-webhook, utmify-backfill, admin-refund-action, check-pending-refunds, validapay-refund-status e admin-refund-post-cancel, entre 22:49:17 e 22:50:13 UTC.
- Único teste manual do pedido 21abe785 às 23:48:09 UTC: data do primeiro pagamento verificada, HTTP 200, `sent`, `is_test=true`. Função temporária excluída em seguida.
- Dry-run de sete dias: 37 pedidos elegíveis e 6 reembolsos pulados por evidência incompleta. Backfill real executado uma vez: 37 HTTP 200, zero falhas, 401/403 ou incertos.
- UTMIFY_ENABLED=true, UTMIFY_TEST_MODE=false e UTMIFY_SEND_RENEWALS ausente. Zero alterações em subscriptions/refund_requests/profiles durante a retomada; nenhuma migration ou operação financeira nesta tarefa.

## Limites que continuam
- Felipe escolheu só compras novas e autorizou primeiro nome/e-mail real, sem telefone/CPF/IP; taxa fixa e parágrafo aprovados.
- Índice parcial impede dois sucessos locais, não dois POSTs concorrentes. Entrega incerta nunca é reenviada sem decisão de Felipe; idempotência oficial segue sem nova confirmação documental.
- Vitalício sem webhook não é automaticamente capturado; pagamentos/reembolsos históricos sem primeira cobrança/data confirmadas são pulados, nunca inferidos.

Ver [[Pixels e medição]], [[ValidaPay]] e [[Próximos passos]].