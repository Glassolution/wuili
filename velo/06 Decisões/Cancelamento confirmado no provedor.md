---
data: 2026-10
fontes: [AGENTS.md, roadmap.md]
atualizado: 2026-11-18
---
# Cancelamento confirmado no provedor

**Decisão:** cancelamento recorrente usa `_shared/providerCancellation.ts` com pedidos duráveis (`provider_cancellation_requests`) e confirmação do gateway; ativação e retentativas compartilham `subscriptionLifecycle.ts`; o banco impede reativar contrato terminal.
**Por quê:** cancelar só localmente **não para a cobrança** no [[ValidaPay]] — clientes eram cobrados depois de cancelar.
**Regra:** cobrança pós-cancelamento vira incidente só para revisão (`payment_incidents`); nunca varrer cancelamentos antigos nem estornar sem confirmação por transação.

**Correção de 18/11:** migration 0070 enfileira transições novas de cancelamento atomicamente, sem backfill histórico. Código reconhece `cancelAtPeriodEnd=true` e o 400 explícito “já está agendado”, preserva o corpo integral de erro e não substitui a resposta DELETE pela falha de uma consulta posterior. Exclusão de conta espera confirmação; sweep usa o contrato exato e a fila, não escrita por usuário. Publicadas cancel-subscription, admin-cancel-subscription, delete-account, validapay-cancel-sweep e payments-reconcile (cron inalterado, nenhuma execução manual). 27 testes passaram e migration testada em Postgres isolado; 28 falhas históricas não reiniciadas. A documentação informa ciclos automáticos e DELETE para impedir novos ciclos; não foi encontrado veto pré-renovação. Cobranças já emitidas não são removidas.

**Correção de 13/11:** confirmações novas de estorno compartilham `confirmedRefundLifecycle.ts` no webhook e nas duas reconciliações; honram `keep_access`, solicitam encerramento durável do contrato exato e preservam outras assinaturas. Cortesia também usa a fila durável. DELETE rejeitado só é reconhecido como cancelado se uma nova consulta comprovar o encerramento; erro do provedor fica registrado. Estorno pontual aceita data de reembolso concluído como corte quando falta `cancelled_at`; não repete envio incerto. Incidente só se resolve após estorno e cancelamento confirmados. Estorno automático futuro não implementado por conflitar com a confirmação individual permanente.
