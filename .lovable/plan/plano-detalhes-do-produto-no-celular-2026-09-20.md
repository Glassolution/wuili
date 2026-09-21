# Plano — Detalhes do produto no celular

## O que confirmei
- A primeira dobra destaca apenas o custo do fornecedor e exibe um percentual verde artificial, ajustado pelo ID, nota e “vendidos”; ele não representa lucro real.
- O preço sugerido usa regras divergentes: a ficha usa o valor salvo ou 2× o custo; o fluxo de publicação inicia em 2,5×. A “sobra/lucro” atual é apenas preço menos custo e não desconta comissão do Mercado Livre, taxa fixa, frete nem impostos.
- A nota é simulada pelo ID. “Vendidos” mistura o valor salvo com outro simulado. Portanto, ambos não têm origem verificável para esta ficha.
- Existem nome, estoque, marca, custo, nome do fornecedor e link direto. O link permite abrir o anúncio do fornecedor, ver preço e comprar fora da Velo.
- Há uma consulta isolada de preços similares no Mercado Livre, mas ela não alimenta esta tela nem o catálogo e também não desconta tarifas. Não será exibida como referência nesta etapa.
- O modal de publicação, a conexão do Mercado Livre e os planos não registram etapas separadas hoje.

## Mudanças
1. **Decisão financeira clara acima da dobra**
   - Criar uma única regra compartilhada para home, ficha e fluxo de publicação.
   - Mostrar “Preço sugerido” e “Sobra bruta estimada”, com explicação curta de que comissão, frete e impostos ainda podem reduzir o valor.
   - Remover o percentual verde artificial desta ficha.

2. **Um caminho principal**
   - Dar destaque total a “Publicar produto”.
   - Mover “Criar página” para ação secundária discreta, sem removê-la.
   - Informar perto do botão: “Para publicar, você precisa ter um plano ativo.”, sem preço.

3. **Ação sempre acessível no celular**
   - Adicionar uma barra fixa acima do menu inferior, com a estimativa e o botão de publicar.
   - Reservar espaço no final da página para não cobrir conteúdo.

4. **Informação confiável e simples**
   - Ocultar nota e vendidos nesta ficha porque hoje são simulados/não verificáveis; a home permanece como está, conforme sua decisão anterior.
   - Filtrar características vazias e trocar “Preço do fornecedor” por “Quanto você paga pelo produto”.
   - Manter fornecedor e link sem alterações.

5. **Carregamento e acessibilidade**
   - Priorizar a primeira imagem e carregar as demais sob demanda.
   - Garantir texto legível, contraste e áreas de toque de pelo menos 44 px.

6. **Medição do funil**
   - Registrar visualização, tempo, profundidade de rolagem e cliques da ficha.
   - Registrar separadamente abertura/fechamento e etapas do fluxo de publicação, início da conexão com Mercado Livre, abertura/fechamento dos planos e resultado da publicação.
   - Reutilizar a tabela de eventos já criada, ampliando apenas os nomes e detalhes registrados; nenhuma informação sensível será gravada.

## Validação
- Testar a ficha e a barra fixa em 393×750 e 375×667.
- Confirmar que modais, menu inferior e conteúdo não ficam cobertos.
- Conferir o desktop em 1280 px e preservar sua estrutura atual.
