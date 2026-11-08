---
atualizado: 2026-11-08
fontes: [AGENTS.md, roadmap.md]
---
# Assinatura e checkout

- Checkout: `/checkout` e modal de planos (`PlansUpgradeModal`) → `startValidaPayCheckout` (`src/lib/validapayCheckout.ts`) → `validapay-checkout`.
- Confirmação: `/assinatura/confirmada` chama `subscription-sync-self` para liberar em segundos se o webhook atrasar.
- Ativação e retentativas: `_shared/subscriptionLifecycle.ts`; banco impede reativar contrato terminal.
- Aviso de renovação mensal compartilhado entre UI e e-mails: `_shared/monthlyRenewal.ts`, `MonthlyRenewalNotice`.
- Vitalício → [[Vitalício com pagamento único]].
- **Gerenciar assinatura** (cancelar renovação): `/dashboard/configuracoes/central-da-assinatura` (`SubscriptionManageSection`). Sem botão/link no app; o link só vai na resposta fixa do suporte (`ORIENTAR_CANCELAMENTO`) → [[Cancelamento e reembolso]].
- Lembretes de plano: `lembrete-planos`. Regularização de inadimplentes: `regularize-subscriptions` (`RegularizePaymentPage`).
- Cálculo do plano no front: `src/hooks/usePlan.ts` (pode divergir da cota de IA em casos raros → [[Bugs conhecidos]]).

Ver também: [[ValidaPay]], [[Planos e preços]], [[Tabelas - Assinaturas e pagamentos]].
