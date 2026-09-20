# Garantir que nenhum anúncio vá ao ar sem peso e medidas

## O problema

Hoje a Velo até envia peso e medidas quando publica, mas não há nenhuma conferência
depois. Quando o Mercado Livre recusa ou descarta esses dados (categorias que não
aceitam certos campos, tentativas de reenvio que removem atributos, produto sem peso
na origem), o anúncio é criado assim mesmo — e o frete vira R$ 90, R$ 130, quase o
preço do produto. Foi exatamente o que aconteceu no anúncio da chapinha: frete grátis
obrigatório, medidas vazias, frete de até R$ 119 num item de R$ 192.

Ou seja: faltam duas coisas — uma trava na publicação e uma correção do que já está no ar.

## Parte 1 — Trava na publicação (nunca mais sair sem medidas)

1. **Peso sempre definido antes de montar o anúncio.** Se o produto não tem peso do
   fornecedor nem estimativa por categoria confiável, a publicação para com uma mensagem
   clara em vez de seguir com um chute.
2. **Conferência obrigatória depois de criar o anúncio.** Logo após o Mercado Livre
   devolver o anúncio criado, a Velo lê o anúncio de volta e verifica se peso e medidas
   realmente ficaram gravados.
   - Se não ficaram, a Velo corrige o anúncio na hora (reenvio dos campos de embalagem).
   - Se mesmo assim não gravar, o anúncio é pausado automaticamente e o usuário recebe o
     aviso de que o produto ficou sem medidas — melhor pausado que vendendo com prejuízo.
3. **Reenvios não podem mais apagar medidas do anúncio.** As tentativas de reenvio hoje
   podem remover atributos de embalagem; passam a remover apenas o que está dentro da
   variação, nunca os do anúncio principal.
4. **Registro do que aconteceu.** Cada publicação guarda peso, medidas e se a conferência
   passou, para aparecer no diagnóstico da conta e no painel admin.

## Parte 2 — Corrigir o que já está no ar

Uma rotina de varredura que percorre os anúncios ativos de todos os vendedores:

1. Lê cada anúncio pela API oficial e identifica os que estão sem medidas ou sem peso.
2. Calcula peso e medidas a partir do produto de origem (mesma lógica da publicação).
3. Atualiza o anúncio e confere lendo de volta.
4. Anota o resultado: corrigido, já estava certo, ou não foi possível.
5. Roda em lotes com agendamento automático, respeitando o limite de chamadas do ML, até
   zerar a fila. Anúncios que não puderem ser corrigidos entram numa lista para revisão.

Também inclui uma conferência do custo de frete depois da correção, para mostrar quanto
o frete caiu em cada anúncio.

## Parte 3 — Visibilidade

Na aba Consulta do admin e no diagnóstico do usuário, um resumo simples: quantos anúncios
do vendedor estão com medidas corretas, quantos foram corrigidos, quantos precisam de
atenção.

## Detalhes técnicos

- `ml-publish`: validação fail-closed do peso, conferência pós-criação via `GET /items/{id}`
  comparando `shipping.dimensions` e os atributos `SELLER_PACKAGE_WEIGHT` /
  `SELLER_PACKAGE_DIMENSIONS`, `PUT` de correção, e `status: paused` como último recurso.
  Os retries de `family_name`/variações deixam de remover atributos do item.
- Nova função `ml-fix-dimensions`: fila persistida (tabela nova `ml_dimension_fixes` com
  RLS e grants), processamento em lotes com cron, renovação de token por vendedor,
  somente `GET` + `PUT` de embalagem, sem tocar em preço, título ou fotos.
- Colunas novas (aditivas) em `user_publications` para peso, medidas e status da
  conferência.
- Frete continua `me2`; nada muda em `free_shipping` nesta etapa.

## O que não muda

Preço, título, fotos e status dos anúncios que já estão corretos. A correção mexe
exclusivamente em peso e medidas da embalagem.
