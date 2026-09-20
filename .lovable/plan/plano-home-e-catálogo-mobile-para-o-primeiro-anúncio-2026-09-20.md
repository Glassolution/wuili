# Plano — Home e catálogo mobile para o primeiro anúncio

## O que foi confirmado

- A home mobile atual reúne busca, categorias, banner, quatro atalhos, faixa de envio, grade e cinco itens inferiores antes de indicar o próximo passo.
- “Publica em 1 clique” não é verdadeiro: ainda há revisão, conexão com o Mercado Livre, assinatura e confirmação da publicação.
- “Margem até 3x” não tem comprovação por produto e será removido.
- O catálogo tem 487 produtos disponíveis, mas só 5 possuem volume de pedidos do fornecedor maior que zero. As avaliações e contagens de “vendas” hoje são geradas a partir do código do produto, não são dados reais; elas serão retiradas dessas telas.
- O preço sugerido existe no catálogo. A diferença atual é `preço sugerido - custo`, sem descontar comissão do Mercado Livre, frete, impostos ou outras taxas. Portanto, ela não pode ser apresentada como lucro líquido.
- Já existem respostas do onboarding, estado real da conexão com o Mercado Livre e publicações do usuário para adaptar a experiência.

## Mudanças

### 1. Caminho único para quem ainda não publicou

Na home mobile, mostrar no topo um checklist compacto “Seu primeiro anúncio”:

1. Escolher um produto.
2. Conectar o Mercado Livre.
3. Publicar o anúncio.

- O progresso usará dados reais da conta.
- O primeiro passo será concluído após o primeiro clique em produto e ficará salvo para aquela conta.
- A conexão será consultada na integração real.
- A publicação será concluída quando houver uma publicação registrada.
- Se a pessoa respondeu que ainda não vende no Mercado Livre, o segundo passo abrirá uma orientação simples para criar a conta; caso contrário, abrirá a conexão.
- Depois da primeira publicação, o checklist some e a home normal continua disponível.

### 2. Menos distrações na primeira sessão

- Para quem ainda não publicou, retirar da área principal os quatro atalhos secundários e a faixa repetida de envio/margem.
- Esses recursos continuam acessíveis por “Minha conta” e pela navegação existente, com nomes mais claros onde aparecerem no mobile.
- Quem já publicou mantém a experiência normal, sem perda de acessos.

### 3. Banner honesto

Trocar as promessas por uma mensagem direta sobre escolher um produto e preparar o anúncio para o Mercado Livre. Remover “1 clique” e “margem até 3x”. Manter apenas afirmações verificáveis, como catálogo com estoque disponível de fornecedores no Brasil.

### 4. Cartões úteis e honestos

Cada cartão mobile mostrará:

- “Preço sugerido” usando o valor real do catálogo.
- “Sobra bruta estimada” calculada como preço sugerido menos custo do fornecedor.
- Aviso curto “antes de taxas” junto da estimativa.

Não mostraremos esse valor como lucro líquido, porque a Velo ainda não calcula comissão, frete e impostos por anúncio. Avaliações e números de vendas simulados serão removidos da home e do catálogo mobile.

### 5. Ordem dos produtos

- Primeiro, produtos do tipo escolhido no onboarding, quando houver.
- Dentro do grupo, priorizar quantidade real de publicações na Velo.
- Como desempate, usar volume real do fornecedor e atualização mais recente.
- Para quem não escolheu tipo, aplicar diretamente esse critério geral.
- Criar uma consulta agregada protegida para fornecer essa popularidade sem expor dados de outros usuários.

### 6. Categorias e desempenho

- Manter categorias em rolagem horizontal, com nomes curtos e um indicador visual de continuidade.
- Aumentar legibilidade e alvos de toque.
- Trocar imagens da home de carregamento imediato para carregamento sob demanda, mantendo apenas as primeiras visíveis prioritárias.
- Preservar esqueletos e estados de erro existentes.

### 7. Medição

Registrar, por usuário e sessão:

- visualização da home;
- busca iniciada e enviada;
- categoria escolhida;
- clique no banner, checklist, atalhos e cartões;
- conclusão de cada etapa do checklist;
- tempo entre abrir a home e o primeiro clique em produto.

Os registros terão acesso restrito ao próprio usuário; relatórios agregados continuarão administrativos.

## Escopo e validação

- Alterações visuais focadas apenas em celular; desktop será preservado.
- Não alterar a tela de produto nem o fluxo de importação/publicação.
- Testar em 393×750 e 375×667, além de conferir o desktop em 1280px.
- Validar conta sem publicação, conta conectada e conta que já publicou.
