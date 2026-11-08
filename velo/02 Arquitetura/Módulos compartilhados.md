---
atualizado: 2026-11-08
fontes: [supabase/functions/_shared/]
---
# Módulos compartilhados (`supabase/functions/_shared`)

Regras de negócio do servidor. Antes de reescrever lógica numa função, procure aqui.

| Arquivo | Para quê |
|---|---|
| `refundPolicy.ts` | Regra e textos do reembolso (7 dias, status aceitos, sem repetição), `REFUND_PAGE_PATH`, `CANCEL_PAGE_PATH`. Roda em Deno **e** Vite → [[Cancelamento e reembolso]] |
| `refundAssistant.ts` | Prompt, ferramenta `preparar_pedido`, validação da proposta e saudação do atendimento de reembolso (`refund-assistant`); testes em `refundAssistant_test.ts` → [[Atendimento de reembolso com IA]] |
| `refundCooldown.ts`, `refundIdentity.ts` | Cooldown pós-reembolso e bloqueio por mesma pessoa → [[Cooldown de reembolso]] |
| `providerCancellation.ts` | Cancelamento durável com confirmação do provedor → [[Cancelamento confirmado no provedor]] |
| `subscriptionLifecycle*.ts`, `paymentGuard.ts` | Ativação, retentativas e proteção de reativação |
| `lifetimeCharge.ts`, `lifetimePlans.ts` | Vitalício: casar cobrança paga sem webhook → [[Vitalício com pagamento único]] |
| `validapay.ts` | Cliente ValidaPay (OAuth2, token em cache) → [[ValidaPay]] |
| `plan-limits.ts` | Limites por plano (fonte real) → [[Planos e preços]] |
| `mlClient.ts`, `mlSellerToken.ts` | Chamadas ML e refresh de token → [[Token ML morto não é renovado]] |
| `mlWebhookQueue.ts`, `mlWebhookHandler.ts` | Fila de webhooks do ML → [[Webhook ML com fila]] |
| `catalogLink.ts` | Vincular anúncio ao produto do catálogo → [[Vínculo anúncio-catálogo]] |
| `c7dropBotDispatch.ts` | Resolve SKU C7Drop e grava `dropship_orders` → [[C7Drop]] |
| `ml-compliance-precheck.ts`, `ml-content-sanitizer.ts`, `ml-image-vision.ts`, `ml-variations.ts`, `mlPackage.ts`, `mlShippingLabel.ts`, `mlBuyerDetails.ts` | Publicação e logística ML |
| `supportNavigation.ts`, `supportCancellation.ts`, `supportRefundContext.ts` | Suporte: mapa de páginas reais, respostas fixas → [[Suporte com IA]] |
| `atlas-*.ts` | Contexto, cota, roteamento e base do [[Atlas]] |
| `tiktokEvents.ts` | Eventos de servidor TikTok (dedupe) → [[Pixels e medição]] |
| `transactional-email-templates.ts`, `regularization-email.ts` | [[E-mail]] |
| `affiliateCommission.ts`, `affiliateRefund.ts`, `referral-rewards.ts`, `coupons.ts` | [[Afiliados]] |
| `monthlyRenewal.ts` | Aviso de renovação mensal igual na UI e nos e-mails (`MonthlyRenewalNotice`) → [[Assinatura e checkout]] |
| `adminCourtesyRefund.ts`, `courtesyRefundPolicy.ts` | [[Reembolso de cortesia]] |
| `ml-vision-*.ts`, `ml-image-criterion.ts`, `ml-image-input.ts`, `ml-primary-size.ts`, `catalog-recovery-policy.ts` | Validação de imagens e recuperação do catálogo → [[Validação de imagens do catálogo]] |
| `generated/ai-gateway/` | Tipos gerados dos modelos do Lovable AI Gateway |
| `overdueCheck.ts` | Diagnóstico temporário de vencidas (nov/2026) |
