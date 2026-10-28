Altere somente as Edge Functions do Supabase listadas abaixo: `support-assistant`, `request-refund` e `admin-refund-action`. Não mexa no frontend (pasta `src/`), não crie migrations e não altere tabelas nem RLS. O frontend vai ser ajustado à parte.

## Objetivo

Mudar como o suporte responde quando o cliente pede reembolso ou cancelamento no chat de suporte:

- Hoje a IA responde com 3 textos fixos prometendo reembolso.
- Agora o chat deve mostrar uma mensagem curta de pesar e, logo depois, o cartão com o botão que abre o formulário de reembolso.
- O pedido vai para o painel admin (/admin/reembolsos) para ser aprovado.
- Depois de 7 dias do pagamento, só é permitido cancelar o plano.
- O prazo oficial passa a ser o mesmo em todos os lugares.

## Texto oficial do prazo (usar exatamente este, em todos os lugares)

```
O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura, conforme o seu banco.
```

Crie uma constante `PRAZO_REEMBOLSO` com esse texto em cada função que o usar.

## 1. `supabase/functions/support-assistant/index.ts`

### 1.1 Marcador do cartão
O frontend já mostra o cartão com o botão quando uma mensagem do suporte (`sender: "ai"`) tem exatamente este texto:

```
__VELO_REFUND_PROMPT__
```

- Crie `const MARCADOR_CARTAO_REEMBOLSO = "__VELO_REFUND_PROMPT__";`.
- Essa mensagem deve ser inserida diretamente com `admin.from("support_messages").insert(...)`, ou com a função `enviar`.
- Ela nunca pode passar por `limparTexto` nem por `dividirMensagens`: o `limparTexto` remove `__` e quebraria o marcador.
- Use o mesmo marcador dentro e fora do prazo. É o frontend que decide se o botão diz "Pedir reembolso" ou "Cancelar plano", conforme a idade da assinatura.

### 1.2 Novos textos fixos
Remova as constantes `AVISO_REEMBOLSO` e `AVISO_REEMBOLSO_FORA_DO_PRAZO` e crie estas:

```ts
const PRAZO_REEMBOLSO = "O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura, conforme o seu banco.";

const PESAR_REEMBOLSO_DENTRO_DO_PRAZO =
  `Sentimos muito que a sua experiência com a Velo não tenha sido boa. Para pedir o reembolso, toque no botão abaixo e responda algumas perguntas rápidas. ${PRAZO_REEMBOLSO}`;

const PESAR_REEMBOLSO_FORA_DO_PRAZO =
  "Sentimos muito que a sua experiência com a Velo não tenha sido boa. O reembolso só é possível em até 7 dias após o pagamento, e esse prazo já passou na sua conta. Você pode cancelar o plano tocando no botão abaixo: não haverá novas cobranças e tudo continua funcionando até o fim do período já pago.";

const REEMBOLSO_EM_ANALISE =
  `Seu pedido de reembolso já foi recebido e está em análise pela nossa equipe. ${PRAZO_REEMBOLSO}`;

const REEMBOLSO_JA_APROVADO =
  `Seu reembolso já foi aprovado pela nossa equipe. ${PRAZO_REEMBOLSO}`;

const SEM_ASSINATURA_PARA_REEMBOLSO =
  `Não encontramos uma assinatura ativa na sua conta. Nossa equipe vai verificar e te responde aqui mesmo nesta conversa. ${HORARIOS_ATENDIMENTO}`;
```

### 1.3 Regra de reembolso no `SYSTEM_TICKET`
Substitua o parágrafo que começa com `Reembolso: reembolso da assinatura SÓ é possível...` por:

```
Reembolso e cancelamento: sempre que a pessoa PEDIR reembolso, cancelamento, estorno, dinheiro de volta ou algo do tipo (mesmo com erro de digitação, como "reemolso" ou "rembolso"), chame "acionar_suporte_humano" com motivo "reembolso" e um resumo curto do que ela disse. Não escreva você mesmo a resposta sobre reembolso: o sistema envia uma mensagem padrão com o botão para a pessoa fazer o pedido. Nunca prometa reembolso, nunca diga que o reembolso já foi feito e nunca cite outro prazo. Se a pessoa só fizer uma PERGUNTA sobre como funciona (sem pedir), responda normalmente: o reembolso é possível em até 7 dias após o pagamento; depois disso só é possível cancelar o plano, mantendo o acesso até o fim do período pago; e "O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura, conforme o seu banco." Não tente convencer a pessoa a desistir.
```

### 1.4 Histórico enviado ao Gemini
No laço que monta `contents` a partir de `ateUltimaUser`, ignore as mensagens cujo texto seja igual a `MARCADOR_CARTAO_REEMBOLSO`. Elas não devem ir para a IA, para que ela não repita o marcador.

### 1.5 Nota interna para a equipe (`marcarHumano` com motivo "reembolso")
Continue marcando o ticket para a equipe (`needs_human`), como hoje. Só troque os textos internos:

- Dentro do prazo:
  `SOLICITAÇÃO DE REEMBOLSO — dentro do prazo de 7 dias. O cliente recebeu o botão para fazer o pedido pelo formulário (o pedido aparece em /admin/reembolsos). Prazo informado ao cliente: até 5 dias. ${resumo}`
- Fora do prazo:
  `PEDIDO DE REEMBOLSO/CANCELAMENTO FORA DO PRAZO (assinatura com mais de 7 dias) — reembolso não se aplica; o cliente recebeu a opção de cancelar o plano. ${resumo}`

Remova o trecho "avaliar se cabe exceção": não haverá exceção.

### 1.6 Resposta quando `reembolso === true`
Substitua o bloco atual, que monta o texto fixo de 3 partes (`Entendi a sua situação e sinto muito pelo transtorno...`), por esta lógica. Ela deve rodar antes do envio normal e no lugar dele:

1. Busque o último pedido de reembolso do usuário:
   ```ts
   const { data: pedido } = await admin.from("refund_requests")
     .select("status").eq("user_id", ticket.user_id)
     .order("created_at", { ascending: false }).limit(1).maybeSingle();
   ```
2. Escolha a resposta pela primeira condição que valer:
   - **Pedido existente com status "pending":** responda só `REEMBOLSO_EM_ANALISE`, sem cartão.
   - **Pedido com status "processed" ou "approved":** responda só `REEMBOLSO_JA_APROVADO`, sem cartão.
   - **Nenhuma assinatura encontrada** (`assinatura` vazio): responda só `SEM_ASSINATURA_PARA_REEMBOLSO`, sem cartão.
   - **Já existe uma mensagem com `MARCADOR_CARTAO_REEMBOLSO` neste ticket criada depois da `ultimaUser`:** o site já mostrou o cartão. Não envie nada ao cliente e retorne `json({ ok: true, escalou: true, skip: "cartao_ja_exibido" })`, depois de `marcarHumano`.
   - **Dentro do prazo** (`dentroDoPrazoReembolso`): envie `PESAR_REEMBOLSO_DENTRO_DO_PRAZO` e, depois de cerca de 900 ms, o `MARCADOR_CARTAO_REEMBOLSO`.
   - **Fora do prazo:** envie `PESAR_REEMBOLSO_FORA_DO_PRAZO` e, depois de cerca de 900 ms, o `MARCADOR_CARTAO_REEMBOLSO`.
3. Mantenha a checagem existente `chegou_mensagem_nova` antes de enviar: se o cliente mandou outra mensagem enquanto a IA pensava, esta chamada desiste.
4. O texto de pesar vai como uma única mensagem, sem `dividirMensagens`. O marcador vai em uma mensagem separada, sem `limparTexto`.
5. Atualize `support_tickets.updated_at`, como a função `enviar` já faz.
6. Nesses casos não acrescente `AVISO_ESPERA` nem os horários, exceto no caso sem assinatura, que já inclui os horários.

Todo o resto da função continua igual: Mercado Livre, Central de Ajuda, limite de respostas e espera de 8 s.

## 2. `supabase/functions/request-refund/index.ts`

Na resposta de sucesso, troque:

```
"Sua solicitação foi recebida. O reembolso será analisado em até 48 horas."
```

por:

```
"Recebemos o seu pedido de reembolso. O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura, conforme o seu banco."
```

Não altere a regra dos 7 dias, a validação de `reason_details`, o sandbox nem as notificações para os admins.

## 3. `supabase/functions/admin-refund-action/index.ts`

1. **Notificação de reembolso aprovado** (`notifications.insert`, quando `refundOk`), troque:
   ```
   "Seu reembolso foi aprovado. O estorno foi enviado ao banco emissor do cartão e pode levar até 30 dias para aparecer na sua fatura (normalmente entra na próxima fatura)."
   ```
   por:
   ```
   "Seu reembolso foi aprovado. O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura, conforme o seu banco."
   ```
2. **Mensagem no chat de suporte depois da aprovação** (`support_messages.insert`, quando `refundOk`), troque:
   ```
   "Olá! Seu reembolso foi analisado e aprovado por uma pessoa da nossa equipe. O valor já foi enviado para estorno e deve aparecer em breve na mesma forma de pagamento que você usou. Qualquer dúvida, estamos por aqui."
   ```
   por:
   ```
   "Olá! Seu reembolso foi analisado e aprovado por uma pessoa da nossa equipe. O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura, conforme o seu banco. Qualquer dúvida, estamos por aqui."
   ```

Não altere a lógica de aprovação, a detecção de sandbox, a chamada à ValidaPay ou ao Mercado Pago nem a recusa.

## 4. Publicação

Faça o deploy das três funções: `support-assistant`, `request-refund` e `admin-refund-action`. Não é preciso criar nenhum secret novo.

## 5. Como conferir depois

1. **Assinatura com menos de 7 dias:** no chat de suporte, mande "quero reemolso" (com erro de digitação). Devem chegar a mensagem "Sentimos muito… toque no botão abaixo…" com o prazo de 5 dias e, em seguida, o cartão com o botão. O ticket deve ficar marcado para a equipe.
2. **Assinatura com mais de 7 dias:** chega a mensagem de pesar dizendo que o prazo passou e oferecendo cancelar o plano, mais o cartão.
3. **Com um pedido "pending" já criado:** mandar "quero reembolso" de novo responde que o pedido está em análise, sem cartão.
4. **Pergunta, não pedido** ("como funciona o reembolso?"): a IA explica normalmente e não envia cartão.
5. **Aprovar o pedido em /admin/reembolsos:** a notificação e a mensagem no chat devem citar o prazo de 5 dias.
