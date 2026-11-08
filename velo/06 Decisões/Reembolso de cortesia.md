---
data: 2026-11-08
fontes: [AGENTS.md (main)]
---
# Reembolso de cortesia

**Decisão:** o admin pode estornar fora da regra padrão, pela função de admin já existente, com confirmação explícita de cobrança, usuário, assinatura e valor, e reserva durável da cobrança.
**Por quê:** cortesia não é elegibilidade padrão: não aplica [[Cooldown de reembolso]] nem bloqueio de identidade.
**Regra:** nunca reenviar estorno com resultado incerto.
Código: `_shared/adminCourtesyRefund.ts`, `courtesyRefundPolicy.ts`, `src/lib/adminCourtesyRefund.test.ts`. Ver [[Cancelamento e reembolso]].
