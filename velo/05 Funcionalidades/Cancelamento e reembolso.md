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

## Atendimento de reembolso com IA (local, não publicado — 08/11)
Substituiu o formulário. Caminho: resposta fixa do chat de suporte → artigo **"Pedir reembolso de uma cobrança"** (`/ajuda/pagamentos-e-planos/pedir-reembolso`, endereço mantido; texto longo na migration) → **link discreto** no passo 2 da seção "Como funciona o atendimento de reembolso" (link Markdown comum, sem cartão; pedido do dono: o cliente precisa ler para achar). Os marcadores `[[atendimento-reembolso]]`/`[[formulario-reembolso]]` ainda funcionam e viram uma frase simples com link → **`/ajuda/reembolso`** (`RefundSupportPage` + `RefundChat`).
- Exige login. Mostra conta logada, elegibilidade e situação do pedido (`RefundParts.tsx`) e o chat com a IA (função `refund-assistant`, Gemini com function calling).
- A situação (prazo, pedido em análise, reembolso anterior) é calculada **no servidor**; a IA só conhece o que a função passa no prompt (`_shared/refundAssistant.ts`).
- A IA **não envia**: dentro do prazo, chama `preparar_pedido` e aparece um **cartão de confirmação** (motivo, resumo, Sim/Não, ciência do fim do acesso). Só o botão "Enviar pedido" chama `request-refund` (`source: "refund_chat"`), que confere tudo de novo. `reason_details` = resumo da IA + palavras do cliente (`composeRefundChatDetails`).
- Conversa guardada no `sessionStorage` da aba; o oficial é o banco.
- Decisão → [[Atendimento de reembolso com IA]].

## Cancelar renovação (sem reembolso)
A qualquer momento, na página **Gerenciar assinatura** (`/dashboard/configuracoes/central-da-assinatura`). Mostra o plano, cancela a renovação e diz **em texto, sem link**, que o reembolso é pela Central. Cancelamento no gateway → [[Cancelamento confirmado no provedor]].

## Reembolso (caminho único)
- Atendimento de reembolso `/ajuda/reembolso`, aberto pelo link discreto do artigo `/ajuda/pagamentos-e-planos/pedir-reembolso` (o `RefundRequestForm` foi removido em 08/11).
- Exige login na conta cobrada; mostra elegibilidade (data, valor, prazo); a confirmação de fim de acesso fica no cartão (`access_end_acknowledged`, também exigida pelo `request-refund`).
- Regra: **7 dias**, status aceitos, sem reembolso repetido, bloqueio de identidade. Fonte única: `_shared/refundPolicy.ts` (site, IA e funções).
- Pedido = cancela a renovação já na solicitação; aprovação estorna (ValidaPay) e derruba anúncios ativos no ML.
- Admin (`/admin/reembolsos`, `RefundReviewDialog`): approve, reject (mensagem obrigatória), respond, note interna → `admin-refund-action`.
- Como o cliente chega: só pela resposta fixa `ORIENTAR_REEMBOLSO` do `support-assistant` (link do artigo, que leva ao atendimento). Nunca texto livre da IA → [[Reembolso só pela Central de Ajuda]].
- Depois: [[Cooldown de reembolso]].

Tabelas: [[Tabelas - Reembolsos]]. Front: `src/components/help-center/RefundChat.tsx`, `RefundChatLink.tsx`, `RefundParts.tsx`, `src/pages/RefundSupportPage.tsx`, `src/lib/refundEligibility.ts`, `refundRequestHistory.ts`, `refundStatus.ts`.
