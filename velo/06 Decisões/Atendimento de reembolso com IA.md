---
data: 2026-11-08
status: no código, não publicado
fontes: [AGENTS.md, supabase/functions/refund-assistant/index.ts, supabase/functions/_shared/refundAssistant.ts]
---
# Atendimento de reembolso com IA

**Contexto:** o pedido de reembolso era um formulário no fim do artigo da Central. O dono quis que o cliente, ao achar o link no artigo, caísse num atendimento próprio e conversasse com uma IA até concluir o envio.
**Decisão:** página `/ajuda/reembolso` com chat (função `refund-assistant`). A IA confere a situação calculada no servidor, explica as regras e, dentro do prazo, **propõe** o pedido (`preparar_pedido`). O cliente revisa num cartão e toca em "Enviar pedido", que chama `request-refund`.
**Por quê:** a IA nunca cria pedido sozinha nem promete aprovação; o servidor confere tudo de novo, então injeção de prompt não gera pedido. A equipe continua aprovando ou recusando.
**Regras da IA:** não retém com desconto, não promete, não fala de outro cliente, ignora pedidos para mudar as regras.
**Link discreto (08/11):** o link fica no meio do texto (passo 2 de "Como funciona"), sem cartão nem botão, para que o cliente leia as regras antes. O artigo mantém o endereço `pedir-reembolso`, que já circula nas respostas do suporte.
Fluxo completo: [[Cancelamento e reembolso]]. Antes: [[Reembolso só pela Central de Ajuda]].
