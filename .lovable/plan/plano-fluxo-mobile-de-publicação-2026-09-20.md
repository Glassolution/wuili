# Plano — fluxo mobile de publicação

## O que foi confirmado
- O texto promete **2 passos**, mas a tela apresenta **Detalhes, Revisão e Plano**.
- A conexão aparece antes do título/preço em alerta vermelho e bloqueia “Próximo” sem orientação junto ao botão.
- A estimativa é a mesma da home e da ficha, mas hoje é apenas **preço de venda − custo do produto**; não desconta comissão, tarifa fixa, frete ou impostos.
- A descrição começa vazia, a tradução aparece para qualquer título, “Estoque publicado” não explica o limite e “Criar vídeo” compete com a publicação.
- Título, preço, descrição e etapa ficam apenas na memória da tela; no celular, sair para conectar pode apagar tudo.

## Mudanças
1. **Quatro etapas honestas:** Detalhes → Conexão → Revisão → Plano. Para assinantes, a última ação continua sendo publicar, sem cobrança nem mudança nas regras atuais.
2. **Detalhes primeiro:** destacar título, preço sugerido e sobra bruta estimada; adicionar “Usar preço sugerido”, teclado numérico e explicação de que taxas/frete/impostos ainda não estão descontados.
3. **Conexão separada e positiva:** remover o alerta vermelho inicial, mostrar estado neutro ou verde e só permitir seguir quando a conta estiver conectada, explicando exatamente o motivo.
4. **Revisão pronta para conferir:** gerar a descrição automaticamente ao chegar, mostrar carregamento e permitir edição; incluir uma prévia simples do anúncio. Ocultar tradução quando o título já parecer português, remover “Criar vídeo” e explicar o estoque em linguagem simples.
5. **Continuidade:** salvar um rascunho local por usuário/produto e restaurar etapa, título, preço, descrição e atributos após fechar ou voltar da conexão. Apagar o rascunho somente após publicação concluída.
6. **Medição sem duplicação:** ampliar os eventos existentes com abertura, avanço, saída, erro e duração por etapa, incluindo conexão, revisão, plano e conclusão.
7. **Mobile sem regressão:** tela inteira no celular, rodapé principal fixo e confortável acima do teclado; manter a apresentação desktop e testar os dois tamanhos.

## Riscos e proteção
- **Publicação:** não alterar a chamada que envia o anúncio nem suas validações do backend.
- **Cobrança:** não alterar planos, preços ou checkout; apenas abrir a tela existente depois de conexão e revisão.
- **Assinantes:** preservar publicação direta após revisão e a verificação atual da conta de vendedor.
- **IA:** se a descrição automática falhar, manter edição manual e oferecer nova tentativa com mensagem simples.

## Pendente de decisão futura
- Para exibir lucro líquido confiável, será necessário definir uma regra de comissão/tarifa/frete por categoria e tipo de anúncio. Nesta etapa, a interface continuará chamando o valor atual de **sobra bruta estimada** e deixando as exclusões explícitas, sem prometer lucro líquido.
