# IA do suporte — mudanças no reembolso (pendências para o Supabase)

Lista viva: cada instrução nova entra aqui. Quando for pedido, vira um prompt
único para aplicar no Supabase (função `support-assistant`).

Arquivo da função: `supabase/functions/support-assistant/index.ts`

## Como está hoje (ponto de partida)

- Cliente pede reembolso no chat → a IA chama `acionar_suporte_humano` com motivo
  "reembolso" e o ticket fica marcado para a equipe (`needs_human`).
- A resposta ao cliente NÃO é escrita pela IA: é trocada por um texto fixo.
  - Dentro de 7 dias (linha ~501), dividido em 3 balões:
    1. "Entendi a sua situação e sinto muito pelo transtorno."
    2. `AVISO_REEMBOLSO` (linha ~336): "Pode ficar tranquilo(a): vou solicitar o seu
       reembolso à nossa equipe agora mesmo. O prazo para ele ser feito é de até 5 dias."
       + horários de atendimento.
    3. "Assim que alguém da equipe Velo analisar, você recebe a resposta aqui mesmo nesta conversa."
  - Fora de 7 dias: `AVISO_REEMBOLSO_FORA_DO_PRAZO` (linha ~338), explica que passou
    o prazo e oferece cancelar a renovação.
- Regra no prompt `SYSTEM_TICKET` (linha ~340): só promete reembolso dentro de 7 dias,
  prazo "até 5 dias", não tenta convencer a desistir.
- Balões saem com pausa entre eles (linha ~512).

## Prazos divergentes hoje (alinhar)

- IA no chat: "até 5 dias"
- Botão de reembolso no chat (widget): "até 72h após a aprovação"
- Configurações (RefundSection): "análise em até 48h" e "até 30 dias na fatura"

## O que já existe no site (descoberto ao analisar a instrução 1)

- `messageHasRefundIntent` (src/lib/support.ts): detecta pedido de reembolso/cancelamento
  na mensagem do cliente e o widget grava um cartão (`__VELO_REFUND_PROMPT__`, sender "ai")
  com botão vermelho "Pedir reembolso".
- Problema: o detector só reconhece a palavra exata. "Quero reemolso" (erro de digitação),
  "quero meu dinheiro de volta" etc. NÃO disparam o cartão — por isso no teste só a IA respondeu.
- Ao clicar no botão abre um popup POR CIMA do chat (não o próprio chat) com 2 passos:
  motivo (chips + texto + vídeos tutoriais + "Falar com a equipe") → confirmar.
- Confirmar chama `request-refund` (ou `cancel-subscription` se passou de 7 dias) →
  cria pedido "pending" em `refund_requests` → aparece em /admin/reembolsos para aprovar.
- Ao mesmo tempo a IA (`support-assistant`) responde com os 3 textos fixos prometendo
  "vou solicitar o seu reembolso… até 5 dias" — conflita com o cartão quando os dois aparecem.

## Instruções recebidas

1. Qualquer menção a cancelamento, reembolso ou algo do tipo no chat → aparece uma
   mensagem automática dizendo que sentimos muito + botão VERMELHO "Pedir reembolso".
   Ao clicar, o próprio modal do chat muda para uma série de perguntas para entender o
   reembolso da pessoa; no fim a pessoa confirma e o pedido vai para o painel admin
   (/admin/reembolsos) para ser aprovado lá.

2. Perguntas da série (respondendo ao "em aberto" da instr. 1):
   - Qual o motivo do reembolso?
   - O que podemos melhorar?
   - Oferecer uma última chance de falar com a equipe antes da decisão.
3. Passou de 7 dias → permitir SOMENTE o cancelamento do plano (sem pedido de reembolso).
4. Prazo oficial de reembolso: 5 dias, em todos os lugares.
5. Respostas às perguntas em aberto:
   - Pedido de reembolso continua marcando a conversa para a equipe (`needs_human`).
   - Vídeos tutoriais saem da sequência de reembolso.
   - Texto oficial do prazo aprovado: "O reembolso é feito em até 5 dias. No cartão, o valor
     pode aparecer só na próxima fatura, conforme o seu banco."

## O que vai para o Supabase

> Prompt montado em `scratch/prompt-supabase-reembolso.md` (cobre todos os itens abaixo).

- [Instr. 1] Na função `support-assistant`, quando a IA identificar pedido de reembolso ou
  cancelamento (ela entende erros de digitação e frases como "quero meu dinheiro de volta"):
  - NÃO enviar mais os 3 textos fixos (linhas ~336 e ~501: "Entendi a sua situação…",
    `AVISO_REEMBOLSO`, "Assim que alguém da equipe…") nem prometer prazo.
  - Enviar UMA mensagem curta de pesar ("Sentimos muito…") seguida do cartão do botão:
    inserir mensagem com o marcador `__VELO_REFUND_PROMPT__` (sender "ai"), o mesmo que o
    site já usa para mostrar o botão vermelho "Pedir reembolso".
  - Não inserir o cartão se ele já existir no ticket (evitar duplicado com o detector do site).
  - [Instr. 5] Continuar marcando o ticket para a equipe (`needs_human`, motivo "reembolso")
    como hoje — a conversa segue indo para o time além do pedido no painel.
- [Instr. 3] Fora dos 7 dias (`dentroDoPrazoReembolso = false`): a IA NÃO mostra o botão de
  reembolso. Explica com gentileza que o prazo de reembolso passou e que é possível cancelar
  o plano (acesso continua até o fim do período pago). `AVISO_REEMBOLSO_FORA_DO_PRAZO`
  (linha ~338) já diz isso — revisar texto; tirar "vou passar o seu pedido para a equipe
  avaliar exceção" e a marcação "avaliar se cabe exceção" (linha ~478), já que não haverá exceção.
  Mostrar o cartão/botão de CANCELAR (ver site) em vez do de reembolso.
- [Instr. 5] Texto oficial do prazo, igual em todos os lugares (IA, notificações, site):
  "O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura,
  conforme o seu banco."
- [Instr. 4] Prazo "até 5 dias" em todos os textos da IA: `AVISO_REEMBOLSO` (linha ~336),
  regra no `SYSTEM_TICKET` (linha ~348), nota interna (linha ~477) — já usam 5 dias, manter.
- [Instr. 4] `request-refund` (linha ~176): notificação "será analisado em até 48 horas" → 5 dias.
- [Instr. 4] `admin-refund-action` (linha ~230): notificação de aprovado "pode levar até 30 dias
  para aparecer na fatura" → alinhar com 5 dias (ver ponto de atenção sobre cartão).
- [Instr. 4] Mensagem no chat quando o admin aprova (`admin-refund-action`, linha ~243) — sem
  prazo hoje; incluir os 5 dias se fizer sentido.

## Fora do Supabase (código do site)

> FEITO no site (ainda não publicado): área de reembolso ocupando o painel do suporte
> (`SupportRefundFlow.tsx`), situação do cliente (`src/lib/refundStatus.ts`), detector com
> erros de digitação + testes, cartão com "Pedir reembolso"/"Cancelar plano"/"Pedido em
> análise", pesar antes do cartão (mesmo texto da IA), vídeos removidos, prazo oficial em
> Configurações, FAQ e Central de Ajuda. Texto interno do admin (~740) mantido: descreve o
> processamento no banco, não é promessa ao cliente.

- [Instr. 1] Detector `messageHasRefundIntent` (src/lib/support.ts): aceitar variações e
  erros de digitação (reemolso, rembolso, dinheiro de volta, estorno, cancela…), para o
  botão aparecer na hora mesmo antes da IA responder.
- [Instr. 1] Mensagem de pesar junto do botão vermelho "Pedir reembolso" no cartão.
- [Instr. 1] Ao clicar: em vez de popup por cima, o PRÓPRIO painel do chat troca para a
  sequência de perguntas (com voltar), e no fim "Confirmar" envia o pedido →
  `request-refund` → painel admin.

- [Instr. 2] Sequência no próprio painel do chat (um passo por tela, com voltar):
  1. "Qual o motivo do reembolso?" — opções + "Outro" com texto.
  2. "O que podemos melhorar?" — texto livre.
  3. Última chance: "Antes de decidir, quer falar com a nossa equipe?" — botão principal
     "Falar com a equipe" (volta para a conversa e avisa o time) e secundário
     "Continuar com o reembolso".
  4. Confirmar: resumo + prazo de 5 dias + botão vermelho "Confirmar pedido de reembolso"
     → `request-refund` (motivo + "o que podemos melhorar" vão em `reason_details`,
     que exige mínimo de 30 caracteres — o texto montado precisa garantir isso).
  - [Instr. 5] Remover os vídeos tutoriais da sequência (hoje no passo do motivo:
    `tutorialsForReason`, `refundTutorial`/`VideoTutorialModal` — tirar só do reembolso).
- [Instr. 3] Fora dos 7 dias: no lugar do botão vermelho "Pedir reembolso", mostrar
  "Cancelar plano" (cancel-subscription: sem devolução, acesso até o fim do período pago).
  O widget já escolhe `cancel-subscription` quando passou de 7 dias — ajustar textos e o
  cartão para não falar em reembolso nesse caso.
- [Instr. 4] Trocar prazos para 5 dias:
  - Widget (SupportFloatingWidget.tsx ~782): "até 72 horas" → 5 dias; e nota no ticket (~466).
  - Configurações (RefundSection.tsx ~201 e ~372): "análise em até 48h" / "até 30 dias na fatura".
  - FAQ do suporte (src/lib/support.ts ~369): "análise em até 48h".
  - Central de ajuda (src/pages/help/guides.ts ~200-201): "48h úteis" e "5 a 10 dias úteis
    (prazo do Mercado Pago)" — este último também cita Mercado Pago, hoje a cobrança é ValidaPay.
  - Admin (AdminRefundsPage.tsx ~740): "até 30 dias para aparecer na fatura" (texto interno).
  - Termos de Uso (TermsPage.tsx 4.3): fala do direito de arrependimento de 7 dias (CDC art. 49),
    sem prazo de devolução — não precisa mudar; não mexer em texto legal sem confirmar.

## Ponto de atenção (resolvido na instr. 5)

- "5 dias" é o prazo para a Velo FAZER o reembolso; no cartão o banco pode demorar mais para
  aparecer na fatura. Por isso o texto oficial inclui "conforme o seu banco".

## Em aberto (perguntar)

_(nada em aberto)_
