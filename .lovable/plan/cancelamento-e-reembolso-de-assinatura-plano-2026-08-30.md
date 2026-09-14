# Cancelamento e reembolso de assinatura — plano

## 0. O que já existe hoje (e onde há conflito)

- **UI:** `src/components/dashboard/RefundSection.tsx` — título já é "Cancelar assinatura / reembolso", mas na prática só existe o fluxo de **reembolso**. Fora do prazo de 7 dias o card mostra apenas o texto morto "Prazo expirado", sem nenhuma ação. **Não existe hoje nenhum botão de cancelar assinatura.**
- **Backend de reembolso:** `request-refund` (cria pedido `pending`, valida janela de 7 dias, notifica admins) → `admin-refund-action` (aprova/recusa, estorna na ValidaPay, marca assinatura como `cancelled`, rebaixa perfil para `gratis`, fecha anúncios no ML). Também existem `process-refund` (legado, Mercado Pago) e `check-pending-refunds`.
- **Banco:** tabela `subscriptions` **não tem** campo de "cancelar ao fim do ciclo". Tem `status`, `current_period_end`, `next_charge_at`, `refundable_until`.
- **Renovação:** feita pelo webhook `validapay-webhook` (eventos `subscription.renewed` / `payment.success`), que reativa e empurra `current_period_end` +1 mês.

**Conflitos identificados:**
1. Hoje "cancelar" e "reembolsar" são a mesma coisa no back (aprovar reembolso já cancela). O item 1 do pedido, na prática, só precisa ficar explícito na UI/textos — não muda o back.
2. Não há como marcar "cancelado mas com acesso até o fim do ciclo": o único caminho existente coloca `status = cancelled` e rebaixa para `gratis` na hora. Precisa de campo novo.
3. `usePlan` considera ativo quem tem `status` em `active/paid/approved/trialing`. Se cancelarmos ao fim do ciclo mantendo `status = active`, o acesso continua correto até o vencimento — é o caminho mais seguro.

## 1. Reembolso dentro de 7 dias = cancelamento automático

Sem mudança de banco. Ajustes:
- `RefundSection.tsx`: o fluxo passa a se chamar "Cancelar assinatura e pedir reembolso"; a tela de confirmação deixa claro que a assinatura é encerrada junto com o estorno.
- `request-refund`: além de criar o pedido, marca a assinatura como `cancel_at_period_end = true` (para não renovar enquanto o pedido está em análise) e registra `cancellation_requested_at`. A aprovação em `admin-refund-action` continua fazendo o cancelamento imediato e o estorno.

## 2. Fora dos 7 dias = só cancelar, sem reembolso

- **Migração** em `public.subscriptions`: novos campos `cancel_at_period_end boolean default false`, `cancelled_at timestamptz`, `cancellation_reason text`.
- **Nova Edge Function `cancel-subscription`**: valida o JWT, confere a titularidade da assinatura, marca `cancel_at_period_end = true`, grava motivo/data e cria notificação. Mantém `status = active` e `current_period_end` intactos → acesso preservado até o fim do ciclo pago. Tenta também cancelar a recorrência na ValidaPay pelo `validapay_subscription_id` (se a API recusar, o bloqueio local abaixo já garante a não renovação).
- **`validapay-webhook`**: ao receber renovação de uma assinatura com `cancel_at_period_end = true`, não reativa — coloca `status = expired` e rebaixa o perfil para `gratis`. Rede de segurança contra cobrança nova.
- **UI (`RefundSection.tsx`)**: fora do prazo, no lugar de "Prazo expirado" aparece o botão **"Cancelar assinatura"**, que abre um modal com aviso claro: *"O prazo de 7 dias para reembolso já expirou. Não haverá devolução do valor pago. Você mantém o acesso até DD/MM/AAAA e a assinatura não será renovada."* Depois de cancelado, o card mostra "Cancelado — acesso até DD/MM".
- Um job/checagem já existente não é necessário: quem tem `cancel_at_period_end` simplesmente deixa de ser renovado; a expiração natural cuida do resto.

## 3. Cancelar a renovação de joaopaulolimamartins09@gmail.com

Assinatura encontrada: plano **Pro**, R$ 79,80, ativa, ciclo até **23/09/2026** (ValidaPay `sub_1787503207382_ixlo09oia`). Existe também uma assinatura antiga já `expired` — será ignorada.

Ação: marcar `cancel_at_period_end = true` na assinatura ativa. Ele mantém o Pro até 23/09/2026 e não é cobrado novamente.

## Resumo técnico

| Item | Alteração |
|---|---|
| `subscriptions` | + `cancel_at_period_end`, `cancelled_at`, `cancellation_reason` |
| `cancel-subscription` (nova função) | cancelamento sem reembolso, fim de ciclo |
| `request-refund` | passa a marcar cancelamento junto do pedido |
| `validapay-webhook` | não renova assinatura marcada para cancelar |
| `RefundSection.tsx` | dois caminhos distintos por elegibilidade + avisos |
| Dados | cancelar renovação do usuário citado |

Sem impacto em `admin-refund-action`, `process-refund` ou nos limites de plano.
