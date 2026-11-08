---
atualizado: 2026-11-08
fontes: [AGENTS.md (fonte mais atual), supabase/functions/_shared/refundPolicy.ts]
---
# Cancelamento e reembolso

> ⚠️ O fluxo descrito aqui está **no código mas não publicado**: depende de [[Migrations pendentes]] e de deploy das funções. Em produção ainda vale o fluxo pelas Configurações (commit de 06/11). Para detalhes, `AGENTS.md` é a fonte mais atual.

## O que está publicado hoje (`main`, 08/11)
Configurações → Perfil, linha "Garantia de 7 dias" (`RefundSection`, âncora `#velo-reembolso`): mostra uso da conta antes do pedido; "Solicitar reembolso" pede motivo. Depois dos 7 dias some do Perfil e "Cancelar renovação" aparece na aba Plano. Pedido só pelo `request-refund`; um pendente por cliente (drizzle `0045`). O chat só orienta em texto, sem link.

## Reembolso de cortesia (admin)
Fora da regra padrão: confirmação explícita de cobrança/usuário/assinatura/valor e reserva durável da cobrança; não aplica cooldown nem bloqueio de identidade; nunca reenviar estorno incerto. `_shared/adminCourtesyRefund.ts`, `courtesyRefundPolicy.ts` → [[Reembolso de cortesia]].

## Fluxo novo (local, não publicado) — abaixo

## Cancelar renovação (sem reembolso)
A qualquer momento, na página **Gerenciar assinatura** (`/dashboard/configuracoes/central-da-assinatura`). Mostra o plano, cancela a renovação e diz **em texto, sem link**, que o reembolso é pela Central. Cancelamento no gateway → [[Cancelamento confirmado no provedor]].

## Reembolso (caminho único)
- Formulário no fim do artigo `/ajuda/pagamentos-e-planos/como-solicitar-reembolso` (marcador `[[formulario-reembolso]]` no Markdown → componente `RefundRequestForm`).
- Exige login na conta cobrada; mostra elegibilidade (data, valor, prazo) e a confirmação de fim de acesso (`access_end_acknowledged`, também exigida pelo `request-refund`).
- Regra: **7 dias**, status aceitos, sem reembolso repetido, bloqueio de identidade. Fonte única: `_shared/refundPolicy.ts` (site, IA e funções).
- Pedido = cancela a renovação já na solicitação; aprovação estorna (ValidaPay) e derruba anúncios ativos no ML.
- Admin (`/admin/reembolsos`, `RefundReviewDialog`): approve, reject (mensagem obrigatória), respond, note interna → `admin-refund-action`.
- Como o cliente chega: só pela resposta fixa `ORIENTAR_REEMBOLSO` do `support-assistant`. Nunca texto livre da IA → [[Reembolso só pela Central de Ajuda]].
- Depois: [[Cooldown de reembolso]].

Tabelas: [[Tabelas - Reembolsos]]. Front: `src/lib/refundEligibility.ts`, `refundRequestHistory.ts`, `refundStatus.ts`.
