-- Central de Ajuda: três coleções novas (Catálogo e produtos, Ferramentas de IA
-- e Aprenda a vender), com artigos escritos a partir das telas e dos limites de
-- plano confirmados no código. Idempotente: não sobrescreve o que já existir.

INSERT INTO public.help_categories (slug, title, description, icon, section, position)
SELECT 'catalogo-e-produtos', $md$Catálogo e produtos$md$, $md$Encontrar produtos, entender preço e estoque e escolher o que vender.$md$, 'Package', 'Central de ajuda',
       (SELECT coalesce(max(position), 0) + 1 FROM public.help_categories)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'como-escolher-produto', $md$Como escolho um produto no Catálogo?$md$, $md$O Catálogo reúne produtos de fornecedores brasileiros. Na página de cada um você vê estoque, custo e preço sugerido antes de publicar.$md$,
       $md$O **Catálogo** reúne produtos reais de fornecedores brasileiros, prontos para você anunciar. Você não precisa ter estoque: quando sair uma venda, o fornecedor guarda e envia o produto.

## Abrir um produto

1. No menu, abra **Catálogo**.
2. Navegue pelas categorias ou use a busca.
3. Clique no produto para ver a página dele.

Na página do produto aparecem:

- as fotos e a **Descrição**;
- o **Estoque disponível** no fornecedor;
- quanto **você paga** pelo produto;
- o **Preço de venda sugerido** e a **Sobra bruta estimada**.

Dali você pode clicar em **Publicar produto** para levar o anúncio ao Mercado Livre ou em **Criar uma página de vendas**. Para publicar, é preciso ter um plano ativo.

## Dicas para escolher

- **Procura o ano inteiro:** produtos que as pessoas compram em qualquer época vendem de forma mais estável do que itens de temporada.
- **Fácil de mostrar:** produto simples de fotografar e de explicar gera menos dúvida no comprador.
- **Preço baixo para começar:** a decisão de compra é mais rápida, e um teste que não der certo custa pouco.
- **Estoque saudável:** prefira produtos com estoque folgado. Produto que acaba com frequência pausa o seu anúncio.

> Concentrar seus anúncios num mesmo tipo de produto (um **nicho**, como pets ou casa) ajuda você a conhecer o público e repetir o que funcionou.$md$,
       ARRAY['catalogo', 'escolher produto', 'produto', 'fornecedor', 'o que vender']::text[], 'published', 1, now()
FROM public.help_categories c WHERE c.slug = 'catalogo-e-produtos'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'preco-sugerido-e-sobra-bruta', $md$O que significam o preço sugerido e a sobra bruta?$md$, $md$A sobra bruta é a diferença entre o preço de venda sugerido e o que você paga ao fornecedor, antes das taxas do Mercado Livre, do frete e dos impostos.$md$,
       $md$Na página de cada produto do Catálogo aparecem três valores.

| Valor | O que é |
| --- | --- |
| Você paga | O custo do produto no fornecedor. É o que você paga quando sair uma venda. |
| Preço de venda sugerido | Um ponto de partida para o preço do seu anúncio. |
| Sobra bruta estimada | Preço sugerido menos o custo do produto. |

## A sobra bruta ainda não é o seu lucro

A sobra bruta é uma estimativa **antes** de três descontos:

- a **tarifa do Mercado Livre** sobre a venda;
- o **frete**, quando ele fica por sua conta;
- os **impostos**, conforme o seu caso.

Faça a conta completa antes de definir o preço. Veja como em [Como calcular a margem de um produto](/ajuda/aprenda-a-vender/como-calcular-margem).

> Você pode mudar o preço do anúncio. O valor sugerido é só uma referência.$md$,
       ARRAY['preco sugerido', 'sobra bruta', 'lucro', 'margem', 'quanto vou ganhar', 'custo']::text[], 'published', 2, now()
FROM public.help_categories c WHERE c.slug = 'catalogo-e-produtos'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'produto-sumiu-do-catalogo', $md$Por que um produto sumiu do Catálogo?$md$, $md$O Catálogo só mostra produtos com estoque no fornecedor. Quando o estoque zera, o produto sai da lista.$md$,
       $md$O Catálogo mostra apenas produtos que o fornecedor tem em estoque. Quando o estoque de um produto chega a zero, ele deixa de aparecer, para você não anunciar algo que não pode ser entregue.

## O que acontece com o meu anúncio

Se você já tinha publicado o produto, o anúncio no Mercado Livre pode ficar **pausado** enquanto falta estoque. Quando o fornecedor repõe, o anúncio costuma voltar sozinho. Veja mais em [Meu anúncio foi pausado](/ajuda/publicacao/anuncio-pausado).

## O que fazer

- Espere alguns dias: muitos produtos voltam quando o fornecedor repõe.
- Enquanto isso, procure no Catálogo um produto parecido para não ficar sem anúncio no ar.
- Se você tem uma **venda pendente** de um produto que sumiu, fale com o suporte com o número do pedido do Mercado Livre.$md$,
       ARRAY['produto sumiu', 'sem estoque', 'esgotado', 'catalogo', 'nao encontro produto']::text[], 'published', 3, now()
FROM public.help_categories c WHERE c.slug = 'catalogo-e-produtos'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'produtos-em-alta', $md$O que é a área Produtos em Alta?$md$, $md$Uma vitrine de produtos com bom desempenho de vendas, com filtros e ordenação, para inspirar a escolha do que vender.$md$,
       $md$**Produtos em Alta** é uma área do painel com produtos que estão vendendo bem, para ajudar você a ter ideias do que anunciar.

## Como usar

1. No menu, abra **Produtos em Alta**.
2. Use **Categorias**, **Filtros** e **Ordenar por** para encontrar o que interessa.
3. Compare preço, avaliação e vendas mensais de cada produto.

A área está em **versão beta**, então pode mudar e ganhar novidades.

## Antes de decidir

Um produto vender bem para outras pessoas não garante que vai vender para você. Antes de anunciar, confira:

- se o produto está no **Catálogo** com estoque;
- se a **sobra bruta** cobre a tarifa do Mercado Livre e o frete;
- quantos vendedores já oferecem o mesmo produto.$md$,
       ARRAY['produtos em alta', 'mais vendidos', 'tendencia', 'produto vencedor', 'ideias']::text[], 'published', 4, now()
FROM public.help_categories c WHERE c.slug = 'catalogo-e-produtos'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_categories (slug, title, description, icon, section, position)
SELECT 'ferramentas-de-ia', $md$Ferramentas de IA$md$, $md$Atlas, imagens, influencers e páginas de venda criadas com IA.$md$, 'Sparkles', 'Central de ajuda',
       (SELECT coalesce(max(position), 0) + 1 FROM public.help_categories)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'o-que-e-o-atlas', $md$O que é o Atlas?$md$, $md$O Atlas é o assistente de IA da Velo. Ele tira dúvidas sobre dropshipping e sobre o painel e indica o caminho certo dentro da Velo.$md$,
       $md$O **Atlas** é o assistente de IA da Velo. Ele fica na tela inicial do painel e conversa com você sobre:

- como começar no dropshipping e escolher um nicho;
- preço, margem, anúncios e reputação no Mercado Livre;
- onde fica cada função do painel, com atalhos para a tela certa.

## O que o Atlas não faz

- **Não publica anúncios.** Quem publica é você, pelo botão **Publicar produto**.
- **Não promete resultado.** Ele explica e orienta, mas não garante vendas nem prazos.
- **Não resolve problemas da sua conta.** Cobrança, reembolso e problemas com pedidos são tratados pelo suporte.

## Limite de mensagens por dia

| Plano | Mensagens por dia |
| --- | --- |
| Base | 40 |
| Pro | 150 |
| Business | 400 |

> Os limites podem mudar. Os valores atuais de cada plano ficam em **Planos**, dentro do painel.$md$,
       ARRAY['atlas', 'assistente', 'ia', 'chat', 'inteligencia artificial']::text[], 'published', 1, now()
FROM public.help_categories c WHERE c.slug = 'ferramentas-de-ia'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'imagens-com-ia', $md$Como crio imagens de produto com IA?$md$, $md$Em Imagens com IA você gera uma foto de um produto seu ou do Catálogo, e pode incluir um dos seus influencers de IA na cena.$md$,
       $md$Em **Imagens com IA** você cria uma foto nova para o seu produto, sem precisar de estúdio.

## Criar uma imagem

1. No menu, abra **Imagens com IA**.
2. Escolha o **Produto**: envie a foto de um produto seu ou escolha um produto do Catálogo.
3. Se quiser, escolha um **Avatar** da sua biblioteca para aparecer com o produto.
4. Ajuste o **Estilo** e descreva a cena no campo **Prompt**.
5. Clique em **Criar** e aguarde a imagem ficar pronta.

> Para usar um avatar, crie antes o seu influencer em **Avatares**. Veja [Como crio um influencer de IA?](/ajuda/ferramentas-de-ia/influencers-de-ia)

## Quantas imagens posso criar

| Plano | Imagens por mês |
| --- | --- |
| Base | 20 |
| Pro | 100 |
| Business | 300 |

> Os limites podem mudar. Os valores atuais de cada plano ficam em **Planos**, dentro do painel.

## Dicas

- Use uma foto de produto nítida e com fundo limpo como base.
- Descreva o ambiente no prompt: "na bancada de uma cozinha clara", "nas mãos de uma pessoa ao ar livre".
- Confira se a imagem mostra o produto como ele é. Foto diferente do produto real gera reclamação.$md$,
       ARRAY['imagem ia', 'foto produto', 'gerar imagem', 'imagens com ia', 'foto anuncio']::text[], 'published', 2, now()
FROM public.help_categories c WHERE c.slug = 'ferramentas-de-ia'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'influencers-de-ia', $md$Como crio um influencer de IA?$md$, $md$Em Avatares você cria um personagem com aparência, estilo e personalidade próprios e usa ele nas imagens de produto.$md$,
       $md$Em **Avatares** você cria o seu **influencer de IA**: um personagem com aparência, estilo e personalidade que você define. Ele fica salvo para você reutilizar.

## Criar um influencer

1. No menu, abra **Avatares**.
2. Vá na aba **Criar**.
3. Personalize aparência, estilo e personalidade.
4. Conclua a criação. O personagem passa a aparecer na sua biblioteca.

## Usar o influencer

- Em **Imagens com IA**, escolha o influencer no campo **Avatar** para ele aparecer com o produto.
- Na biblioteca de Avatares, você pode **Baixar imagem** do personagem.
- Cada personagem também traz um **prompt UGC pronto para o Google Flow**, para quem quiser criar vídeos curtos fora da Velo.

## Quantos influencers posso criar

| Plano | Influencers |
| --- | --- |
| Base | 3 |
| Pro | 10 |
| Business | 30 |

> Os limites podem mudar. Os valores atuais de cada plano ficam em **Planos**, dentro do painel.$md$,
       ARRAY['avatar', 'influencer', 'personagem', 'ugc', 'avatares', 'video']::text[], 'published', 3, now()
FROM public.help_categories c WHERE c.slug = 'ferramentas-de-ia'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'paginas-de-venda-com-ia', $md$Como crio uma página de vendas com IA?$md$, $md$A IA monta uma página de vendas para o seu produto em cerca de um minuto. Ela fica salva como prévia para você revisar, sem ser publicada sozinha.$md$,
       $md$Uma **página de vendas** é uma página só do seu produto, com textos e imagens pensados para convencer o comprador. A Velo cria essa página com IA.

## Criar uma página

1. Abra **Páginas com IA** e clique em **Criar página de produto com IA**, ou clique em **Criar uma página de vendas** na página de um produto do Catálogo.
2. Escolha o **produto**.
3. Escolha o **idioma** da página (português, inglês ou espanhol) e quantas imagens criar junto com ela.
4. Clique em **Gerar página** e aguarde. A geração leva cerca de um minuto.

## Revisar antes de usar

A página termina como **prévia**. Nada é publicado automaticamente: ela fica salva em **Páginas com IA** para você revisar os textos, os preços e as imagens.

## Quantas páginas posso ter

| Plano | Páginas de venda |
| --- | --- |
| Base | 1 |
| Pro | 10 |
| Business | Ilimitadas |

> Os limites podem mudar. Os valores atuais de cada plano ficam em **Planos**, dentro do painel.$md$,
       ARRAY['pagina de vendas', 'landing page', 'pagina com ia', 'site do produto']::text[], 'published', 4, now()
FROM public.help_categories c WHERE c.slug = 'ferramentas-de-ia'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_categories (slug, title, description, icon, section, position)
SELECT 'aprenda-a-vender', $md$Aprenda a vender$md$, $md$Conceitos de dropshipping e boas práticas para vender no Mercado Livre.$md$, 'BookOpen', 'Central de ajuda',
       (SELECT coalesce(max(position), 0) + 1 FROM public.help_categories)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'o-que-e-dropshipping', $md$O que é dropshipping?$md$, $md$É vender sem manter estoque: você anuncia, e o fornecedor guarda e envia o produto depois da venda.$md$,
       $md$**Dropshipping** é um jeito de vender sem ter estoque. Você anuncia o produto, e quem guarda e envia a mercadoria é o fornecedor.

## Como funciona na prática

1. Você escolhe um produto no Catálogo e publica o anúncio no seu Mercado Livre.
2. Um comprador faz o pedido e paga pelo Mercado Livre.
3. Você faz o pedido com o fornecedor, que separa e envia o produto.
4. O Mercado Livre libera o dinheiro da venda no seu Mercado Pago depois da entrega.

O seu ganho é a diferença entre o preço de venda e o custo do produto, já descontadas a tarifa do Mercado Livre e o frete.

## Vantagens

- Você começa sem comprar estoque.
- Pode testar vários produtos com pouco risco.
- Não precisa de espaço para guardar mercadoria.

## Cuidados

- **Prazo de entrega:** depende do fornecedor. Coloque no anúncio um prazo realista.
- **Margem:** a tarifa e o frete só aparecem depois da venda. Faça a conta antes.
- **Reputação:** atraso e produto diferente do anunciado viram reclamação e derrubam a sua nota no Mercado Livre.

> Nenhum método garante vendas. O resultado depende do produto, do preço, do anúncio e do atendimento.$md$,
       ARRAY['dropshipping', 'como funciona', 'sem estoque', 'iniciante', 'o que e']::text[], 'published', 1, now()
FROM public.help_categories c WHERE c.slug = 'aprenda-a-vender'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'como-calcular-margem', $md$Como calcular a margem de um produto$md$, $md$Margem é o que sobra do preço de venda depois de tirar o custo do produto, a tarifa do Mercado Livre, o frete e os impostos.$md$,
       $md$**Margem** é o que sobra para você em cada venda. Margem apertada é o erro mais comum de quem começa, porque a tarifa e o frete só aparecem na conta depois que a venda acontece.

## A conta

**Margem = preço de venda − custo do produto − tarifa do Mercado Livre − frete − impostos**

- **Custo do produto:** o valor que aparece em "Você paga" na página do produto no Catálogo.
- **Tarifa do Mercado Livre:** um percentual sobre a venda que muda conforme a categoria e o tipo de anúncio. Veja [Quanto o Mercado Livre cobra?](/ajuda/mercado-livre/tarifas-mercado-livre).
- **Frete:** quando o frete grátis fica por sua conta, ele sai da sua margem.
- **Impostos:** dependem de como você vende (CPF, MEI ou outra empresa).

## Exemplo ilustrativo

Os números abaixo servem só para mostrar a conta. Use os valores reais do seu produto.

| Item | Valor |
| --- | --- |
| Preço de venda | R$ 100,00 |
| Custo do produto | − R$ 45,00 |
| Tarifa (exemplo de 14%) | − R$ 14,00 |
| Frete | − R$ 20,00 |
| **Sobra** | **R$ 21,00** |

## Dicas

- Calcule a margem **antes** de publicar, não depois da primeira venda.
- Desconfie de produto com sobra muito pequena: qualquer aumento no custo do fornecedor apaga o seu ganho.
- Ticket mais baixo vende mais rápido. Ticket mais alto rende mais por venda, mas exige mais confiança do comprador.$md$,
       ARRAY['margem', 'lucro', 'calcular preco', 'precificacao', 'quanto cobrar', 'tarifa']::text[], 'published', 2, now()
FROM public.help_categories c WHERE c.slug = 'aprenda-a-vender'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'como-fazer-um-bom-anuncio', $md$Como fazer um bom anúncio$md$, $md$Título com as palavras que o comprador digita, fotos claras e uma descrição que responde as dúvidas antes da pergunta.$md$,
       $md$Um bom anúncio é encontrado na busca e responde as dúvidas do comprador antes que ele precise perguntar.

## Título

- Use as palavras que as pessoas **realmente digitam** na busca: o que é o produto, a marca e a característica principal.
- Evite palavras soltas como "promoção" ou "imperdível". Elas ocupam espaço e não ajudam na busca.

## Fotos

- Prefira fotos nítidas, com **fundo limpo**.
- Mostre o produto de mais de um ângulo e, se possível, em uso.
- A foto precisa mostrar o produto como ele é. Foto que engana gera devolução.

> Você pode criar fotos novas em **Imagens com IA**. Veja [Como crio imagens de produto com IA?](/ajuda/ferramentas-de-ia/imagens-com-ia)

## Descrição

- Comece pelo principal: o que é e para que serve.
- Liste medidas, material, cor e o que vem na embalagem.
- Informe um **prazo de entrega realista**. É o que mais evita reclamação no dropshipping.

## Depois de publicar

- Responda as perguntas dos compradores rápido.
- Acompanhe visitas e vendas. Se o anúncio não vende, veja [Meu anúncio não vende](/ajuda/publicacao/anuncio-sem-vendas).$md$,
       ARRAY['anuncio', 'titulo', 'descricao', 'fotos', 'vender mais', 'visitas']::text[], 'published', 3, now()
FROM public.help_categories c WHERE c.slug = 'aprenda-a-vender'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'reputacao-mercado-livre', $md$Como funciona a reputação no Mercado Livre$md$, $md$A reputação é a nota do vendedor. Ela sobe com entrega no prazo, anúncio fiel e resposta rápida, e cai com atrasos e reclamações.$md$,
       $md$A **reputação** é a nota do vendedor no Mercado Livre. Reputação ruim faz os seus anúncios aparecerem menos na busca, e por isso ela vale tanto quanto o preço.

## O que melhora a reputação

- **Entregar no prazo** que está no anúncio.
- **Anúncio fiel:** fotos e descrição que mostram o produto como ele é.
- **Responder rápido** às perguntas e mensagens dos compradores.

## O que derruba a reputação

- Atrasos na entrega.
- Cancelamentos feitos pelo vendedor.
- Reclamações e mediações abertas pelo comprador.

## Cuidados no dropshipping

- Coloque um prazo de entrega que o fornecedor consegue cumprir.
- Evite vender produtos com estoque baixo no fornecedor.
- Se um fornecedor não enviar, fale com o suporte da Velo logo, com o número do pedido do Mercado Livre. Veja [O fornecedor não tem o produto](/ajuda/pos-venda/fornecedor-sem-produto).$md$,
       ARRAY['reputacao', 'termometro', 'nota do vendedor', 'reclamacao', 'atraso']::text[], 'published', 4, now()
FROM public.help_categories c WHERE c.slug = 'aprenda-a-vender'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, content, keywords, status, position, published_at)
SELECT c.id, 'mediacao-e-chargeback', $md$O que é mediação e chargeback$md$, $md$Mediação é a reclamação aberta pelo comprador no Mercado Livre. Chargeback é quando ele contesta a cobrança direto com o banco ou o cartão.$md$,
       $md$## Mediação

A **mediação** é uma reclamação que o comprador abre dentro do Mercado Livre, por exemplo quando o produto não chegou ou veio diferente do anúncio.

**O que fazer:**

1. Responda o comprador o quanto antes.
2. Envie o **código de rastreio** e explique a situação com calma.
3. Se o problema for com o fornecedor, fale com o suporte da Velo com o número do pedido.

Responder rápido e mostrar o rastreio é o que mais ajuda a resolver a mediação sem prejudicar a sua reputação.

## Chargeback

O **chargeback** acontece quando o comprador contesta a cobrança direto com o banco ou com o cartão, e o valor é estornado. Costuma vir de compra não reconhecida ou de produto que não chegou.

**Como evitar:**

- Prazo de entrega realista no anúncio.
- Rastreio informado assim que o fornecedor enviar.
- Atendimento rápido quando o comprador pergunta pelo pedido.$md$,
       ARRAY['mediacao', 'chargeback', 'reclamacao', 'disputa', 'contestacao', 'estorno']::text[], 'published', 5, now()
FROM public.help_categories c WHERE c.slug = 'aprenda-a-vender'
ON CONFLICT (category_id, slug) DO NOTHING;

-- Pós-venda e envio estava sem descrição no card da página inicial.
-- Só preenche se estiver vazia, para não sobrescrever texto editado no admin.
UPDATE public.help_categories
SET description = $md$Pedido na fornecedora, etiqueta, frete, rastreio e devoluções.$md$,
    updated_at = now()
WHERE slug = 'pos-venda'
  AND coalesce(btrim(description), '') = '';