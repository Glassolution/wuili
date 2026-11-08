---
atualizado: 2026-11-08
---
# Próximos passos

## Publicar o novo fluxo de reembolso e da Central
- [x] Código na `main` do GitHub (08/11)
- [x] Coleções novas da Central aplicadas (`drizzle/migrations/0049`, Lovable)
- [x] Lovable aplicou a `0050` e publicou as 14 funções (incluindo `refund-assistant`)
- [ ] Publicar o site na Lovable (até lá, `/ajuda/reembolso` mostra "Artigo não encontrado" no endereço publicado)
- [ ] Conferir em produção: link no artigo, atendimento `/ajuda/reembolso` com IA real, envio, histórico, admin, respostas fixas do chat

## Atendimento de reembolso com IA (feito no local, 08/11)
- [x] Artigo completo de reembolso na migration `20261107120000` (marcador `[[atendimento-reembolso]]`)
- [x] Tela/rota `/ajuda/reembolso` (chat próprio, exige login), link discreto no artigo `pedir-reembolso`, `RefundRequestForm` removido
- [x] Função `refund-assistant` + `_shared/refundAssistant.ts` (8 testes); IA propõe, cliente confirma no cartão, `request-refund` envia
- [x] `refundPolicy.ts` e respostas fixas do `support-assistant` falam em atendimento, não formulário
- [x] Bullet de atualização do reembolso acrescentado no `AGENTS.md`
- [ ] Testar com o Gemini de verdade depois do deploy (no local foi testado com a função simulada)

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
