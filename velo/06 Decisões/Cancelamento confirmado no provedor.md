---
data: 2026-10
fontes: [AGENTS.md, roadmap.md]
atualizado: 2026-11-13
---
# Cancelamento confirmado no provedor

**Decisão:** cancelamento recorrente usa `_shared/providerCancellation.ts` com pedidos duráveis (`provider_cancellation_requests`) e confirmação do gateway; ativação e retentativas compartilham `subscriptionLifecycle.ts`; o banco impede reativar contrato terminal.
**Por quê:** cancelar só localmente **não para a cobrança** no [[ValidaPay]] — clientes eram cobrados depois de cancelar.
**Regra:** cobrança pós-cancelamento vira incidente só para revisão (`payment_incidents`); nunca varrer cancelamentos antigos nem estornar sem confirmação por transação.

**Correção de 13/11:** confirmações novas de estorno compartilham `confirmedRefundLifecycle.ts` no webhook e nas duas reconciliações; honram `keep_access`, solicitam encerramento durável do contrato exato e preservam outras assinaturas. Cortesia também usa a fila durável. DELETE rejeitado só é reconhecido como cancelado se uma nova consulta comprovar o encerramento; erro do provedor fica registrado. Estorno pontual aceita data de reembolso concluído como corte quando falta `cancelled_at`; não repete envio incerto. Incidente só se resolve após estorno e cancelamento confirmados. Estorno automático futuro não implementado por conflitar com a confirmação individual permanente.
