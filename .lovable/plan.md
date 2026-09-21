# Página de planos própria (venda) — celular primeiro

## O que encontrei hoje

- A escolha de plano é a **etapa 4 dentro da janela de importar** (`ImportProductModal`), com pouco espaço.
- Confirmado: o título diz **"Assine o Pro para publicar este produto"**, o botão principal diz **"Assinar Base — R$ 39,90/mês"** e o Pro fica num link sublinhado. É contraditório.
- Não há prova social, nem perguntas frequentes, nem explicação do que a "sobra bruta estimada" inclui.
- `/dashboard/planos` hoje só abre o modal antigo e volta para a home.
- Pagamento: checkout hospedado ValidaPay (Pix e cartão). Reembolso real: **7 dias**, análise em até 48h, assinatura cancelada e anúncios removidos.
- Assinantes ativos reais hoje: **813** (posso mostrar esse número atualizado, vindo do banco).
- Rascunho do anúncio já é guardado por 7 dias no aparelho (título, preço, descrição).

## O que vou mudar

1. **Nova página `/dashboard/planos`** (rota própria, sem modal), pensada para celular:
   - resumo do anúncio preparado (imagem, título, preço, sobra estimada), lido do rascunho guardado;
   - o plano comparado ao ganho possível por venda, sem prometer resultado;
   - prova social: contagem real de assinantes ativos (via função protegida no banco) + **espaços claramente marcados** para depoimentos reais, que você me enviar com autorização. Nada inventado;
   - "o que acontece depois de pagar" em 3 passos;
   - comparação Base x Pro em linguagem de resultado, com **Base recomendado** e nome idêntico no título, no botão e no resumo;
   - redução de risco: cancelamento, reembolso em 7 dias, o que acontece com o anúncio ao cancelar;
   - perguntas que travam o pagamento, em blocos que abrem (conta de vendedor, e se eu não vender, como cancelo, formas de pagamento, como recebo);
   - formas de pagamento reais (Pix e cartão) e ajuda humana visível;
   - botão de assinar fixo ao rolar, sem cobrir conteúdo.
2. **Janela de importar volta a ter 3 etapas** (detalhes, conexão, revisão). Ao concluir a revisão sem plano, o rascunho é salvo e a pessoa é levada à página de planos, com o texto do cabeçalho ajustado. Voltar retorna à revisão do mesmo produto.
3. **Depois do pagamento**, confirmação e volta ao produto para publicar, mantendo a verificação da conta de vendedor e a publicação automática já existentes.
4. **Medição** reaproveitando os eventos atuais (`plans_open`, `plans_exit`, `plan_checkout_clicked`) e somando: rolagem, clique em plano, abertura de pergunta e retorno pós-pagamento.
5. **Lembrete de quem sai sem pagar**: proposta é notificação dentro do app em D+1 e D+3 (já existe esse mecanismo) e e-mail só se você autorizar, com aviso de privacidade.

## Cuidados

- O modal antigo de planos continua existindo para os outros pontos do app (limite atingido, configurações), então nada muda para quem já assina.
- A criação do checkout não é alterada: mesma função de pagamento, mesmos planos e preços.
- Desktop preservado: a página é responsiva, sem mexer nas telas existentes.

## O que preciso de você

- Depoimentos e resultados reais com autorização (nome, foto opcional, frase).
- Confirmar que o plano recomendado é o **Base**.
- Autorizar (ou não) o lembrete por e-mail.
