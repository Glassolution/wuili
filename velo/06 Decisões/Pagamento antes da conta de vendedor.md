---
fontes: [roadmap.md]
---
# Pagamento antes da conta de vendedor

**Decisão:** o usuário pode pagar antes de a conta ML estar apta. Checagem de vendedor roda em segundo plano (sem modal), aviso honesto antes do pagamento; o anúncio vai para `pending_publications` e `auto-publish-pending` publica quando a conta liberar. Lembretes no app em 24h/72h; checagem por hora.
**Por quê:** não perder a venda do plano nem travar o usuário num modal. Aberto: lembretes por e-mail → [[Próximos passos]].
