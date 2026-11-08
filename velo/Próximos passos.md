---
atualizado: 2026-11-08
---
# Próximos passos

## Publicar o novo fluxo de reembolso e da Central (aguarda aprovação)
- [ ] Decidir se as migrations novas vão para `drizzle/migrations/` (pasta ativa) e conciliar com a `0045` → [[Migrations pendentes]]
- [ ] Aplicar `20261107120000_refund_help_center.sql`
- [ ] Aplicar `20261108120000_help_center_new_collections.sql`
- [ ] Deploy de `request-refund`, `admin-refund-action`, `support-assistant` (e demais funções alteradas)
- [ ] Commit/push na `main` das mudanças de reembolso e Central (só quando o dono pedir)
- [ ] Conferir em produção: formulário no artigo, histórico, admin, respostas fixas do chat

## Pagamentos (auditoria out/2026)
- [ ] ETAPA 3: expiração em modo simulação + aviso de 7 dias para migrados — aguarda aprovação
- [ ] Monitorar se algum webhook real foi recusado com 401
- [ ] Resolver Stripe (2 ativas) e MP (2 preapprovals) → [[Bugs conhecidos]]
- [ ] Apagar `validapay-overdue-check` após o diagnóstico

## Produto
- [ ] Decidir se os lembretes de conta ML pendente também vão por e-mail → [[Pagamento antes da conta de vendedor]]
- [ ] Conferir conversa real e cartão de reembolso no suporte admin (faltou acesso de admin)
- [ ] Reconferir os achados de ago/2026 listados em [[Bugs conhecidos]]

## Documentação
- [x] Corrigir §1–2 do `CLAUDE.md` (Vite, não Next.js) — feito em 2026-11-08
- [ ] Completar notas com o que surgir: crons exatos (`cron.job`), policies RLS das tabelas centrais
