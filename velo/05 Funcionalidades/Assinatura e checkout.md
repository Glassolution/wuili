---
atualizado: 2026-11-23
fontes: [AGENTS.md, roadmap.md]
---
# Assinatura e checkout

- Checkout: `/checkout` e modal de planos (`PlansUpgradeModal`) → `startValidaPayCheckout` (`src/lib/validapayCheckout.ts`) → `validapay-checkout`.
- Upgrade mensal: cotação da diferença integral antes de confirmar; item ONE_TIME no mesmo contrato ValidaPay, seguido de substituição sem pró-rata. `_shared/planUpgrade.ts` e `plan_upgrade_requests` preservam datas e reservam operações incertas; webhook e reconciliação distinguem ajuste de renovação. Não altera contratos históricos. Troca mensal/vitalício não segue este fluxo. Validação financeira real ainda pendente.
- Confirmação: `/assinatura/confirmada` chama `subscription-sync-self` para liberar em segundos se o webhook atrasar.
- Tutorial de início oferecido após a compra mensal e após confirmação ativa do vitalício: “Assistir agora” abre o vídeo já disponível em Início, sem autoplay; fechar volta à confirmação e “Ver depois” leva ao painel. Componente `PostPurchaseTutorial`; nenhuma alteração de pagamento ou ativação.
- Ativação e retentativas: `_shared/subscriptionLifecycle.ts`; banco impede reativar contrato terminal.
- Aviso de renovação mensal compartilhado entre UI e e-mails: `_shared/monthlyRenewal.ts`, `MonthlyRenewalNotice`.
- Vitalício → [[Vitalício com pagamento único]].
- **Gerenciar assinatura** (cancelar renovação): `/dashboard/configuracoes/central-da-assinatura` (`SubscriptionManageSection`). Sem botão/link no app; o link só vai na resposta fixa do suporte (`ORIENTAR_CANCELAMENTO`) → [[Cancelamento e reembolso]].
- Lembretes de plano: `lembrete-planos`. Regularização de inadimplentes: `regularize-subscriptions` (`RegularizePaymentPage`).
- Acesso vem só de subscriptions: ValidaPay mensal exige status válido e `current_period_end` com três dias de tolerância; vitalício ativo nunca vence. Mercado Pago, Stripe e manuais mantêm acesso por status. Fallback de `profiles.plano` removido definitivamente; perfil é apenas espelho da ativação. Código não publicado. 65 testes passaram, inclusive restauração de Base/Pro/Business no perfil gratis por `syncPaidProfile` após nova assinatura ativa; webhook e `subscription-sync-self` também gravam o plano após pagamento confirmado.
- Perfis corrigidos em 23/11: 834 (750 Base, 80 Pro, 4 Business), sendo 833 da correção de assinaturas e um com assinatura encerrada. Backup `profile_plano_correction_backup`, correction_id `2026-11-23-profile-plano`, plano anterior e datas para CAS. UPDATE rechecou ausência de assinatura em status de acesso e timestamp do perfil; todos confirmados gratis, nenhum pago sem status de acesso restante. Gatilhos apenas protegem alterações administrativas e atualizam updated_at, sem email/pixel/notificação.
- Correção autorizada em 23/11: 620 linhas ValidaPay → `expired`, 222 → `past_due`, em nove lotes de até 100, com backup em `subscription_status_correction_backup`. PAID recente (qualquer contrato, 35 dias), vitalício e respostas não confirmadas ficam fora; nenhum provedor legado foi alterado. A prévia detalhada foi apresentada depois da aplicação, contrariando a ordem pedida; comunicado ao usuário.

Ver também: [[ValidaPay]], [[Planos e preços]], [[Tabelas - Assinaturas e pagamentos]].
