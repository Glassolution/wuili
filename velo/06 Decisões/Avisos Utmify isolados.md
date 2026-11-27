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
32 testes simulados e checks de quatro entradas passaram. Tabela vazia. Token salvo, habilitação e modo teste ausentes; nenhuma publicação/envio externo.

## Por que não ligar ainda
- Felipe escolheu só compras novas e autorizou primeiro nome/e-mail real, sem telefone/CPF/IP. A política precisa mencionar a Utmify antes do envio; não alterada.
- Taxa não informada; não tratar comissão calculada com padrão zero como lucro líquido real.
- Índice parcial impede dois sucessos locais, não dois POSTs concorrentes. Entrega incerta não é reenviada; idempotência oficial ainda precisa confirmação antes de produção.
- Vitalício sem webhook não é automaticamente capturado; pagamentos/reembolsos históricos sem primeira cobrança/data confirmadas são pulados, nunca inferidos.

Ver [[Pixels e medição]], [[ValidaPay]] e [[Próximos passos]].