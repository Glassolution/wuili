---
data: 2026-11-07
status: no código, não publicado; o formulário virou o atendimento de reembolso com IA (08/11)
fontes: [AGENTS.md]
---
# Reembolso só pela Central de Ajuda

**Contexto:** reembolso podia ser pedido por vários lugares (Configurações, chat), e o cliente conseguia inserir pedido direto na tabela com qualquer status.
**Decisão:** caminho único = formulário no artigo de reembolso (hoje `pedir-reembolso`); a Central não tem link no app; o chat só envia a resposta fixa `ORIENTAR_REEMBOLSO`; só o servidor grava `refund_requests`.
**Por quê:** concentra regra, prazo e confirmação de fim de acesso num lugar; evita IA prometer/negar reembolso e pedidos forjados.
**Atualização 08/11:** o formulário foi trocado pelo [[Atendimento de reembolso com IA]]; o resto continua valendo.
**Pendente:** [[Migrations pendentes]]. Detalhes: [[Cancelamento e reembolso]].
