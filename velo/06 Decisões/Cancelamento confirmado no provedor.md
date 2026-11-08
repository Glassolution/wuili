---
data: 2026-10
fontes: [AGENTS.md, roadmap.md]
---
# Cancelamento confirmado no provedor

**Decisão:** cancelamento recorrente usa `_shared/providerCancellation.ts` com pedidos duráveis (`provider_cancellation_requests`) e confirmação do gateway; ativação e retentativas compartilham `subscriptionLifecycle.ts`; o banco impede reativar contrato terminal.
**Por quê:** cancelar só localmente **não para a cobrança** no [[ValidaPay]] — clientes eram cobrados depois de cancelar.
**Regra:** cobrança pós-cancelamento vira incidente só para revisão (`payment_incidents`); nunca varrer cancelamentos antigos nem estornar sem confirmação por transação.
