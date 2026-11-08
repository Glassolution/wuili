---
data: 2026-11
fontes: [AGENTS.md, roadmap.md]
---
# Cooldown de reembolso

**Decisão:** após reembolso, `profiles.refund_cooldown_until` bloqueia publicar. Libera (via `_shared/refundCooldown.ts`, na confirmação ValidaPay e no `ml-publish`) só com assinatura **paga, ativa, não-trial, criada depois do último reembolso concluído**, com prova de pagamento; compare-and-set para não sobrescrever reembolso concorrente.
**Por quê:** evita usar e pedir reembolso em ciclo, sem prender quem volta a pagar de verdade. Bloqueio por identidade (`refund_identity_blocks`) não muda.
