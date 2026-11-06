# Corrigir recorrências após cancelamento ou reembolso

## Objetivo
Impedir novas renovações de contratos cancelados ou reembolsados, sem reativar acesso nem gerar comissões por cobranças indevidas.

## Escopo proposto
1. Unificar o cancelamento recorrente na ValidaPay nos caminhos de cancelamento do cliente/admin e de solicitação/aprovação de reembolso. O estorno da cobrança não substitui o cancelamento do contrato.
2. Confirmar o cancelamento no provedor antes de informar que não haverá novas cobranças. Registrar solicitação, resultado e falhas; tentar novamente em falhas transitórias. Uma marca local sem confirmação não pode impedir novas tentativas.
3. Tratar `subscription.renewed` de contrato já cancelado/reembolsado antes da ativação: registrar a cobrança verificada, preservar o estado encerrado e não conceder acesso, Purchase, comissão, recompensa ou liberação de cooldown. Cancelamento de renovação mantém o período já pago; reembolso encerra o acesso conforme a regra vigente.
4. Aplicar a mesma proteção no reprocessamento de pagamentos, para que a reconciliação não reative um contrato bloqueado.
5. Detectar e listar cobranças posteriores em fila administrativa, com cliente, charge ID, valor, data e motivo. Estorno real somente após confirmação explícita de cada transação; não estornar automaticamente ou em massa.
6. Preparar revisão dos contratos antigos sem confirmação de cancelamento; executar inicialmente somente simulação, sem cancelar contratos existentes.

## Detalhes técnicos
- Helper compartilhado e idempotente para `DELETE /v1/subscriptions/{id}`; confirmar semântica e resultado por leitura do provedor, sem testar movimentação real.
- Gravar `provider_cancelled_at` somente com confirmação e verificar erros de gravação. Persistir pendências duráveis com retentativas e alerta administrativo.
- Decisão compartilhada de elegibilidade entre `validapay-webhook` e `payments-reconcile`, considerando reembolsos, cancelamento e data do pagamento, não apenas o status atual.
- Identificar cobrança por ID canônico; sem ID verificável, encaminhar para revisão e nunca executar estorno. Não excluir uma cobrança só porque coincide com `subscriptions.validapay_charge_id`.
- Dedupe por charge ID, com bloqueio de estorno já pendente ou concluído. Não confundir HTTP 200/evento processado com regularização financeira concluída.
- Ao atualizar o plano do perfil, preservar eventual outra assinatura legítima vigente.
- Rever permissões existentes antes de qualquer tabela/índice novo; dados de pagamento restritos a administradores.

## Validação
- Testes de reembolso que solicita cancelamento, repetição com confirmação ausente, falha do provedor, falha ao gravar a confirmação, renewal bloqueado, replay, charge ausente, estorno já concluído e outra assinatura válida.
- Testar com provedor simulado, sem cobranças, estornos ou cancelamentos reais.
- Publicar apenas funções atingidas pela correção aprovada e conferir logs.

## Fora desta aprovação
- Nenhum reembolso, repasse ou cancelamento em massa.
- Nenhuma regularização financeira dos oito casos históricos sem autorização específica.
- Esta investigação não confirma o saldo atual de cada cobrança na ValidaPay; o total apurado vem dos eventos e reembolsos registrados na Velo.