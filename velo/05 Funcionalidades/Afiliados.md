---
atualizado: 2026-11-08
---
# Afiliados

- Entrada por `/ref/:code` (Vercel → `/api/ref`), registro de visita `rpc_record_affiliate_visit`, atribuição no cadastro `rpc_affiliate_attach_signup`.
- Comissão: `_shared/affiliateCommission.ts`; estorno de comissão no reembolso: `affiliateRefund.ts`. Saques: `rpc_affiliate_request_withdrawal`, decisão admin `rpc_admin_withdrawal_decide` (`/admin/comissoes`).
- Indicação entre usuários: `create-referral`, `accept-referral`, `referral_rewards`.
- ⚠️ Divergência antiga sobre comissão (20% recorrente vs "30% uma vez") → [[Bugs conhecidos]].

Tabelas: [[Tabelas - Afiliados, lojas e outros]].
