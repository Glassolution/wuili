---
atualizado: 2026-11-23
fontes: [supabase/functions/_shared/validapay.ts, AGENTS.md, roadmap.md]
---
# ValidaPay

Gateway de pagamento atual (cartão e Pix) das assinaturas da Velo. Substituiu Mercado Pago e Stripe → [[Integrações legadas]].

- Auth OAuth2 `client_credentials` (`VALIDAPAY_CLIENT_ID`/`_SECRET`), token em cache no isolate. Cliente: `_shared/validapay.ts`.
- **Webhook** `validapay-webhook`: exige token (`VALIDAPAY_WEBHOOK_TOKEN`, `?token=` ou header); recusa ativação sem `chargeId` confirmado; dispara Purchase do TikTok.
- **Sem webhook** para: cobrança ONE_TIME (vitalício) e conclusão de estorno. Por isso existem:
  - `subscription-sync-self` (tela de confirmação consulta na hora), `expire-pending-charges`, `lifetimeCharge.ts` → [[Vitalício com pagamento único]]
  - `check-pending-refunds` (cron 30 min; estorno fica em PROCESSING mesmo pago — a cobrança é a prova).
- `payments-reconcile` (cron 5 min): reprocessa webhooks falhos e consulta pendentes.
- Auditoria de validade preparada (sem deploy): `subscriptionExpiryAudit.ts`, apenas no ramo horário existente. Consulta contratos ativos além da tolerância, listagem completa de cobranças, identidade e outros contratos da conta; protege PAID dos últimos 35 dias e vitalícios, não corrige casos inconclusivos. Até 100 candidatos por hora em grupos rotativos; backup antes de atualizar com compare-and-set. Não cancela, cobra, estorna nem envia aviso.
- `validapay-cancel-sweep`: encerra no gateway recorrências canceladas do nosso lado (dry-run padrão).
- Estorno: `POST /v1/wallet/refunds` (em `admin-refund-action`). Cartão pode levar até 30 dias.

Ver também: [[Assinatura e checkout]], [[Cancelamento confirmado no provedor]], [[Tabelas - Assinaturas e pagamentos]].
