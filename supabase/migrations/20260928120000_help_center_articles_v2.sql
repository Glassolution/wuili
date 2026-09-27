-- Central de Ajuda — artigos detalhados (v2).
--
-- Reescreve os 18 artigos iniciais com: por que o problema acontece, o passo a
-- passo no computador e no celular, o que fazer se não resolver e perguntas
-- comuns. É o conteúdo que o assistente de suporte por IA vai usar para atender.
--
-- Os caminhos de tela foram conferidos no código do painel (setembro/2026):
--   · Mercado Livre é conectado em Configurações → Integrações (a tela "Lojas"
--     é da Shopify);
--   · cancelamento e reembolso ficam em Configurações → Suporte;
--   · a assinatura é cobrada pela ValidaPay (Pix ou cartão);
--   · sincronização automática de estoque só existe nos planos Pro e Business.
--
-- Atualiza pelo endereço (categoria + slug). Sobrescreve edições feitas no
-- admin nesses 18 artigos; artigos novos criados no admin não são tocados.

DROP TABLE IF EXISTS _help_v2;
CREATE TEMP TABLE _help_v2 (
  category_slug text,
  slug text,
  title text,
  summary text,
  keywords text[],
  content text
);

INSERT INTO _help_v2 VALUES

-- ═══════════════════════════ PRIMEIROS PASSOS ═══════════════════════════════
('primeiros-passos', 'como-a-velo-funciona', 'Como a Velo funciona',
 'Você escolhe produtos do catálogo Velo, ajusta título e preço (com ajuda da IA) e publica na sua conta do Mercado Livre — sem precisar ter estoque.',
 ARRAY['começar', 'primeiro acesso', 'como funciona', 'catálogo', 'publicar', 'dropshipping', 'iniciante', 'primeira venda'],
$md$A Velo é uma plataforma de **dropshipping**: você vende produtos de fornecedores brasileiros no seu Mercado Livre sem comprar estoque antes. Quando alguém compra, você faz o pedido ao fornecedor e ele envia ao cliente.

O papel da Velo é tirar o trabalho pesado do caminho: o catálogo já vem pronto, a IA escreve título e descrição, e a publicação no Mercado Livre é feita por integração oficial.

## O que você precisa antes de começar

| O que | Por quê | Onde resolver |
|---|---|---|
| Uma assinatura ativa (Base, Pro ou Business) | Sem plano ativo não é possível publicar | Configurações → Plano |
| Conta no Mercado Livre com **cadastro de vendedor** completo | O Mercado Livre recusa anúncios de contas sem endereço, telefone ou identidade validados | No site ou app do Mercado Livre |
| Mercado Livre conectado à Velo | É por essa conexão que a Velo cria seus anúncios | Configurações → Integrações |

## O caminho até a primeira publicação

1. **Conecte o Mercado Livre.** Veja o artigo *Como conectar minha conta do Mercado Livre*.
2. **Abra o Catálogo** e escolha um produto. Prefira itens com várias fotos boas e estoque disponível.
3. Na página do produto, clique em **Publicar produto**. Abre o assistente de publicação.
4. **Título e precificação:** revise o título do anúncio (máximo de 60 caracteres) e defina seu preço de venda. A Velo mostra a *sobra bruta estimada* e lembra o que ainda sai desse valor (comissão e taxa fixa do Mercado Livre e impostos).
5. **Continuar para revisão:** confira marca, atributos exigidos pelo Mercado Livre e a descrição gerada pela IA. Ajuste o que quiser.
6. Clique em **Publicar produto**. Quando aparecer *Anúncio publicado*, ele já está no seu Mercado Livre e na tela **Publicações** da Velo.

## No computador

- O menu fica na barra lateral esquerda: **Produtos → Catálogo**, **Publicações** e **Pedidos**.
- As **Configurações** ficam no cartão com seu nome, no canto inferior esquerdo da barra lateral.

## No celular

- Use a barra inferior: **Início**, **Catálogo**, **Atlas** (o assistente, no botão do meio), **Pedidos** e **Minha Conta**.
- Em **Minha Conta** ficam Publicações, Suporte, Central de ajuda e Configurações.
- Abra a Velo no **Chrome ou no Safari**. Dentro do Instagram ou do TikTok, a conexão com o Mercado Livre costuma falhar.

## Depois da primeira venda

Quando alguém compra, o pedido aparece em **Pedidos**. Ali você faz a compra no fornecedor (*Comprar no fornecedor*, com pagamento por Pix) e acompanha o envio até a entrega. O dinheiro da venda cai no seu Mercado Pago, e não na Velo.

> **Dica:** você também pode pedir ao **Atlas**, o assistente da Velo, para encontrar produtos e publicar pela conversa. O resultado é o mesmo da publicação pelo catálogo.

## Perguntas comuns

**Preciso ter CNPJ?** O Mercado Livre permite vender com CPF. Se você precisa emitir nota ou abrir empresa, isso depende da sua situação fiscal; vale conversar com um contador.

**Preciso comprar o produto antes?** Não. Você só compra no fornecedor depois que o cliente comprar de você.$md$),

-- ═══════════════════════ CONEXÃO COM MERCADO LIVRE ═══════════════════════════
('mercado-livre', 'conectar-conta', 'Como conectar minha conta do Mercado Livre',
 'A conexão é feita uma única vez, pelo site oficial do Mercado Livre: você entra na sua conta, toca em “Permitir” e volta sozinho para a Velo.',
 ARRAY['conectar', 'integração', 'oauth', 'mercado livre', 'ml', 'reconectar', 'desconectado', 'autorizar', 'permitir'],
$md$A Velo publica e atualiza anúncios **dentro da sua conta** do Mercado Livre. Para isso, o Mercado Livre precisa autorizar a Velo a agir em seu nome. Essa autorização é feita no site oficial do Mercado Livre (o padrão chamado OAuth).

**Sua senha é digitada só no Mercado Livre — a Velo nunca vê sua senha.** Com a autorização, a Velo cria e atualiza anúncios, ajusta preço e estoque e acompanha seus pedidos.

## No computador

1. Clique no cartão com seu nome, no **canto inferior esquerdo** da barra lateral, e abra **Configurações**.
2. Vá na aba **Integrações**.
3. Em *Marketplaces*, no item **Mercado Livre**, clique em **Conectar +**.
4. O Mercado Livre abre em uma nova aba. Entre com **a conta que vai vender**.
5. Clique em **Permitir** para autorizar a Velo.
6. Volte para a aba da Velo. O Mercado Livre aparece como **Conectado**.

Atalho: na tela **Início**, o cartão do Mercado Livre tem o botão **Conectar conta**. Ele também aparece quando você tenta publicar sem estar conectado.

## No celular

1. Abra a Velo no **Chrome** (Android) ou no **Safari** (iPhone). Não use o navegador de dentro do Instagram ou do TikTok: neles o retorno da autorização se perde. Se estiver num desses apps, use *Copiar link da página*, que a própria Velo mostra, e cole no Chrome ou no Safari.
2. Toque em **Minha Conta** na barra inferior e depois em **Configurações**.
3. Abra **Integrações** e toque em **Conectar +** no Mercado Livre.
4. Entre na sua conta do Mercado Livre e toque em **Permitir**.
5. Você volta para a Velo com a conta conectada.

## Se der errado

| Mensagem que aparece | O que significa | O que fazer |
|---|---|---|
| A autorização demorou demais ou foi aberta em outra janela | A página do Mercado Livre ficou aberta tempo demais ou foi aberta em outro navegador | Toque em conectar de novo e conclua sem fechar ou trocar de navegador |
| A autorização foi cancelada no Mercado Livre | Você tocou em cancelar em vez de “Permitir” | Conecte de novo e toque em **Permitir** |
| O Mercado Livre não confirmou a autorização | Instabilidade do lado do Mercado Livre | Aguarde alguns minutos e tente de novo |
| Não conseguimos salvar a conexão | Falha ao gravar a conexão | Tente novamente; se repetir, fale com o Suporte |

## Conta desconectada ou expirada

De tempos em tempos o Mercado Livre encerra a autorização, por exemplo quando você troca a senha lá ou revoga o acesso de aplicativos. Nesse caso a Velo mostra o aviso **Sua conta do Mercado Livre foi desconectada**. Toque em **Reconectar agora** e repita a autorização. Seus anúncios continuam no Mercado Livre; só a sincronização fica parada até reconectar.

> **Dica:** conecte sempre a **conta principal de venda**. Conectar a conta errada (de compras, por exemplo) faz os anúncios saírem nela. Para trocar, desconecte em Configurações → Integrações e conecte a conta certa.

## Perguntas comuns

**Posso conectar mais de uma conta do Mercado Livre?** A integração funciona com uma conta de Mercado Livre por vez.

**Conectar é o mesmo que ter cadastro de vendedor?** Não. A conexão só autoriza a Velo. Para o anúncio ser aceito, sua conta precisa estar com o cadastro de vendedor completo — veja o artigo *Não consigo publicar: conta sem cadastro de vendedor*.$md$),

('mercado-livre', 'conta-verificada-mercado-pago', 'Não consigo publicar: conta sem cadastro de vendedor',
 'O Mercado Livre só aceita anúncios de contas com o cadastro de vendedor completo: modo vendedor ativo, endereço, telefone, identidade e dados de faturamento.',
 ARRAY['verificação', 'documento', 'modo vendedor', 'não consigo publicar', 'conta incompleta', 'endereço', 'telefone', 'identidade', 'faturamento', 'bloqueio', 'restrictions_coliving', 'mercado pago'],
$md$Ter uma conta de comprador no Mercado Livre **não é o mesmo** que ter uma conta de vendedor. Confirmar o e-mail também não basta: o cadastro de vendedor é separado. Quando ele está incompleto, o Mercado Livre recusa o anúncio enviado pela Velo, e a Velo mostra qual informação está faltando.

## Por que isso acontece

O Mercado Livre exige dados completos de quem vende, para proteger os compradores e cumprir regras fiscais. Enquanto faltar algum deles, **nenhum sistema consegue publicar pela sua conta** — nem a Velo, nem outro aplicativo. A liberação é feita pelo Mercado Livre; a Velo não consegue acelerá-la.

## O que pode estar faltando

| Aviso na Velo | O que completar no Mercado Livre |
|---|---|
| Falta o endereço de cadastro | Endereço completo: CEP, rua, número e complemento |
| Falta confirmar seu telefone | Número de celular confirmado por código SMS |
| Falta validar sua identidade | Foto de documento (RG ou CNH) e validação facial, se pedida |
| Faltam os dados de faturamento | CPF ou CNPJ e endereço de cobrança |
| Sua conta está com restrição para anunciar | Bloqueio interno do Mercado Livre (código `restrictions_coliving`) — veja abaixo |

Também é preciso ter **18 anos ou mais**: menores de idade não podem vender no Mercado Livre.

## No computador

1. Acesse **mercadolivre.com.br** e entre na conta que você conectou à Velo.
2. Clique em **Vender**, no topo da página. Se aparecer **Ativar modo vendedor**, preencha nome, CPF, telefone, CEP e endereço.
3. Aceite o **Mercado Envios** e cadastre o **endereço de retirada**, se o Mercado Livre pedir.
4. Clique no seu nome, no canto superior direito, e abra **Minha conta** → **Dados pessoais**. Complete o que estiver pendente (endereço, telefone, identidade).
5. Para faturamento, abra **Dados de faturamento** e informe CPF ou CNPJ e endereço de cobrança.
6. Volte à Velo e publique de novo. No aviso da publicação, **Já criei minha conta, verificar de novo** confere na hora se o Mercado Livre liberou.

## No celular

1. Abra o **app do Mercado Livre** e entre na conta conectada à Velo.
2. Toque em **Mais** (menu no canto inferior) e procure **Vender** ou **Minha conta / Meu perfil**.
3. Complete os mesmos dados: modo vendedor, endereço, telefone, identidade e faturamento. A validação de identidade costuma pedir foto do documento e uma selfie.
4. Aguarde a confirmação do Mercado Livre, que costuma sair em até 24 horas.
5. Volte à Velo (no Chrome ou no Safari) e publique de novo.

> **Dica:** os nomes dos menus do Mercado Livre mudam de vez em quando. Se não encontrar uma opção, use a busca da página de ajuda do próprio Mercado Livre com o nome do dado (por exemplo, “validar identidade”). No passo 2 da verificação, a Velo também tem um **vídeo tutorial** de como ativar a conta de vendedor.

## Quando a conta tem restrição (`restrictions_coliving`)

Às vezes a conta parece liberada, mas o Mercado Livre bloqueia novos anúncios por uma **restrição interna de convivência ou reputação**. Isso só se resolve com o Mercado Livre:

1. Tente criar um anúncio manualmente em **Vender**, no próprio Mercado Livre. Ele mostra o aviso oficial do bloqueio.
2. Siga a verificação pedida (identidade, documentos ou aceite de termos).
3. Se nenhum aviso aparecer, fale com o atendimento do Mercado Livre e cite o código **restrictions_coliving**.
4. Quando liberarem, volte à Velo e publique.

## Perguntas comuns

**Já validei tudo e continua dando erro.** Aguarde algumas horas: a liberação pode demorar para refletir. Depois reconecte a conta em Configurações → Integrações e tente de novo. Se persistir, fale com o Suporte da Velo e mande um print da mensagem.

**A Velo consegue liberar minha conta?** Não. A validação é exclusiva do Mercado Livre e do Mercado Pago.$md$),

('mercado-livre', 'tarifas-mercado-livre', 'Como funcionam as tarifas do Mercado Livre',
 'A Velo não cobra comissão por venda. As tarifas descontadas a cada venda são do Mercado Livre e variam por categoria, tipo de anúncio e preço.',
 ARRAY['tarifa', 'taxa', 'comissão', 'clássico', 'premium', 'taxa fixa', 'margem', 'lucro', 'custo por venda'],
$md$A Velo cobra apenas a **assinatura do plano**. Ela não fica com parte das suas vendas. Os descontos que aparecem em cada venda são do **Mercado Livre**.

## O que o Mercado Livre desconta

| Tarifa | Como funciona |
|---|---|
| **Comissão por venda** | Um percentual sobre o preço de venda, que varia conforme a categoria do produto |
| **Tipo de anúncio** | *Clássico* tem comissão menor; *Premium* tem comissão maior e mais exposição (e permite parcelamento sem juros para o comprador) |
| **Taxa fixa** | Cobrada por unidade vendida em produtos de valor mais baixo |
| **Frete** | Dependendo do preço e da categoria, parte do frete grátis pode ser cobrada do vendedor |

Os percentuais mudam com o tempo. Os valores oficiais ficam em **mercadolivre.com.br/vender/precos**.

## Onde a Velo mostra isso

Ao publicar, na etapa **Título e precificação**, a Velo mostra a **sobra bruta estimada**: seu preço de venda menos o custo do produto no fornecedor. Logo abaixo aparece *O que ainda sai desse valor*: comissão e taxa fixa do Mercado Livre e impostos. Use essa conta para decidir o preço antes de publicar.

## Como conferir a tarifa de uma venda

**No computador:** no Mercado Livre, vá em **Vendas**, abra a venda e veja o detalhamento com valor da venda, tarifas e valor a receber.

**No celular:** no app do Mercado Livre, abra **Vendas** (pelo menu **Mais**, se não estiver na tela inicial), toque na venda e veja o detalhamento.

## Exemplo

Produto vendido por R$ 100,00, com custo de R$ 45,00 no fornecedor:

1. O Mercado Livre desconta a comissão da categoria (por exemplo, 12% = R$ 12,00) e a taxa fixa, se houver.
2. O restante cai no seu Mercado Pago.
3. Desse valor você paga o fornecedor (R$ 45,00) e os impostos que se aplicarem a você.

> **Dica:** antes de baixar o preço para competir, refaça essa conta. Um preço muito baixo pode vender bem e ainda assim dar prejuízo depois das tarifas.

## Perguntas comuns

**Pagar para publicar?** O Mercado Livre não cobra para publicar no formato Clássico; a comissão só é cobrada quando vende.

**A Velo cobra por venda?** Não. Só a assinatura do plano.$md$),

('mercado-livre', 'dinheiro-das-vendas', 'Onde vejo o dinheiro das vendas',
 'O dinheiro de cada venda cai na sua conta do Mercado Pago (ligada ao seu Mercado Livre), já com as tarifas descontadas, e é liberado depois da entrega.',
 ARRAY['saldo', 'dinheiro', 'receber', 'mercado pago', 'saque', 'liberação', 'dinheiro liberado', 'transferir'],
$md$Os compradores pagam dentro do Mercado Livre, então o dinheiro **não passa pela Velo**. Ele vai para a conta do **Mercado Pago** ligada à mesma conta do Mercado Livre que você conectou.

## Por que o dinheiro não aparece na hora

O Mercado Livre segura o valor até confirmar que o comprador recebeu o produto. Isso protege o comprador. Enquanto isso, o valor aparece como **a liberar**. Depois da entrega confirmada, ele é liberado, normalmente em alguns dias. O prazo exato depende da sua reputação e do tipo de envio.

## No computador

1. Acesse **mercadopago.com.br** e entre com a **mesma conta** do Mercado Livre conectado à Velo.
2. Na tela inicial, veja o **saldo disponível** e o valor **a liberar**.
3. Em **Atividade**, cada venda aparece com o valor líquido (já sem as tarifas).
4. Para mandar o dinheiro ao seu banco, use **Transferir** e escolha Pix ou conta bancária.

## No celular

1. Abra o **app do Mercado Pago** e entre com a mesma conta.
2. O saldo aparece na tela inicial. Toque nele para ver o que está disponível e o que está a liberar.
3. Em **Atividade** (ou *Sua atividade*), toque numa venda para ver os detalhes.
4. Para sacar, toque em **Transferir** e escolha a chave Pix ou a conta de destino.

## E o custo do produto?

O fornecedor é pago **por você**, pedido a pedido, na tela **Pedidos** da Velo (*Comprar no fornecedor*, com pagamento por Pix). Faça esse pagamento logo que a venda entrar: o envio ao cliente só começa depois dele.

> **Dica:** separe no seu saldo o valor que vai para os fornecedores antes de transferir o lucro para o banco. Assim nenhum pedido fica parado por falta de pagamento.

## Perguntas comuns

**A venda aparece no Mercado Livre mas não no Mercado Pago.** Confira se você entrou com a mesma conta. O valor aparece *a liberar* até a entrega.

**Posso receber na conta da Velo?** Não. A Velo não recebe nem guarda o dinheiro das suas vendas.$md$),

-- ═══════════════════════ PUBLICAÇÃO DE PRODUTOS ══════════════════════════════
('publicacao', 'erro-ao-publicar', 'Deu erro ao publicar — o que verificar',
 'Cada erro de publicação tem uma causa e uma solução. Veja o que significa a mensagem que apareceu para você e como resolver.',
 ARRAY['erro', 'falha', 'publicar', 'categoria', 'reconectar', 'limite', 'fotos', 'título', 'atributos', 'não publica', 'recusado'],
$md$Quando a publicação falha, a Velo mostra a mensagem exata que recebeu do Mercado Livre ou do seu plano. **Leia a mensagem com atenção** e procure por ela na tabela abaixo.

## Mensagens mais comuns

| Mensagem (ou parte dela) | Por que acontece | Como resolver |
|---|---|---|
| Conecte sua conta do Mercado Livre para publicar | Nenhuma conta do Mercado Livre está conectada | Configurações → Integrações → **Conectar +** |
| Sessão do Mercado Livre expirada. Reconecte sua conta | A autorização venceu ou foi revogada | Configurações → Integrações → reconectar |
| Sua conta do Mercado Livre está incompleta / Falta o endereço, telefone, identidade… | Cadastro de vendedor incompleto | Veja *Não consigo publicar: conta sem cadastro de vendedor* |
| Você atingiu o limite de anúncios ativos do seu plano | O número de anúncios ativos chegou ao teto do plano | Pause ou encerre anúncios parados, ou faça upgrade |
| Você já publicou X anúncios neste mês | Chegou ao limite mensal de publicações do plano | Aguarde o próximo mês ou faça upgrade |
| O Mercado Livre exige no mínimo 3 fotos | O produto tem menos de 3 fotos públicas | Escolha outro produto do catálogo |
| Nenhuma das fotos está dentro das diretrizes | As fotos têm texto, selo, marca d'água ou banner | Escolha outro produto |
| Não conseguimos identificar a categoria | O título não deixou claro o que é o produto | Deixe o título mais descritivo (o que é, material, uso) |
| Título muito longo | O Mercado Livre aceita até 60 caracteres | Encurte o título |
| Mercado Livre rejeitou atributos | Falta ou está inválido um dado da ficha técnica | Preencha **Marca e atributos** na revisão |
| Configuração de envio necessária | Suas preferências de frete no Mercado Livre não estão prontas | Ative o Mercado Envios na sua conta |
| Você solicitou um reembolso recentemente | Depois de um reembolso, novas publicações ficam bloqueadas por um período | Aguarde a data informada na mensagem |
| Produto sem estoque disponível | O fornecedor está sem o item | Escolha outro produto |

## Passo a passo para resolver

**No computador:**

1. Leia a mensagem de erro no assistente de publicação.
2. Se for sobre conta ou conexão, clique no cartão com seu nome (canto inferior esquerdo) → **Configurações** → **Integrações** e confira se o Mercado Livre aparece como **Conectado**.
3. Se for sobre título, marca ou atributos, volte uma etapa no assistente, ajuste e clique em **Publicar produto** de novo.
4. Se for limite do plano, veja seu plano em **Configurações → Plano**.

**No celular:**

1. Leia a mensagem de erro.
2. Para conta e conexão: **Minha Conta** → **Configurações** → **Integrações**.
3. Para título e atributos: volte no assistente, ajuste e toque em **Publicar produto**.
4. Para limite: **Minha Conta** → **Configurações** → **Plano**.

> **Dica:** tentar de novo **sem mudar nada** raramente resolve, a não ser nos erros de instabilidade (“tente novamente em alguns minutos”). Nos outros casos, ajuste a causa antes.

## Ainda não resolveu?

Abra uma conversa com o Suporte e envie **um print da mensagem de erro** e o **nome do produto**. Com isso o time identifica o caso na hora.$md$),

('publicacao', 'anuncio-pausado', 'Meu anúncio está pausado. E agora?',
 'O Mercado Livre pausa anúncios por falta de estoque, dado obrigatório faltando, problema com a conta ou infração de política. O motivo exato aparece no próprio anúncio.',
 ARRAY['pausado', 'estoque', 'atributo', 'gtin', 'inativo', 'sem estoque', 'anúncio parado', 'reativar'],
$md$Um anúncio **pausado** continua existindo, mas não aparece para os compradores. Quase sempre é o **Mercado Livre** quem pausa, e ele sempre informa o motivo.

## Por que isso acontece

| Motivo | O que significa |
|---|---|
| **Sem estoque** | O estoque do anúncio chegou a zero, porque vendeu tudo ou porque o fornecedor ficou sem |
| **Dado obrigatório faltando** | A categoria passou a exigir um atributo (marca, modelo, GTIN/código de barras…) |
| **Problema na conta** | Pendência no cadastro, na reputação ou em pagamentos da sua conta do Mercado Livre |
| **Infração de política** | Foto, título ou produto fora das regras do Mercado Livre |
| **Pausa manual** | Alguém pausou pelo painel do Mercado Livre |

## Descubra o motivo

**No computador:**

1. Acesse **mercadolivre.com.br** → clique no seu nome → **Vendas** → **Anúncios**.
2. Filtre por **Pausados** e abra o anúncio.
3. O motivo aparece em destaque no topo do anúncio.

**No celular:**

1. No **app do Mercado Livre**, toque em **Mais** → **Vendas** (ou *Meus anúncios*).
2. Filtre os anúncios pausados e toque no anúncio.
3. Leia o aviso com o motivo.

## Como resolver cada caso

- **Sem estoque:** nos planos **Pro** e **Business**, a Velo sincroniza preço e estoque com o fornecedor, e o anúncio volta sozinho quando o produto é reposto. No plano **Base** não há sincronização automática: quando o fornecedor repuser, atualize o estoque no próprio anúncio do Mercado Livre ou publique o produto de novo pela Velo.
- **Dado obrigatório:** abra o anúncio no Mercado Livre, vá na **ficha técnica**, preencha o campo pedido e salve. Para GTIN, se o produto não tiver código de barras, marque a opção de que o produto não tem código, quando a categoria permitir.
- **Problema na conta:** resolva a pendência indicada pelo Mercado Livre em **Minha conta**. Veja também *Não consigo publicar: conta sem cadastro de vendedor*.
- **Infração:** leia a política citada. Se for foto ou título, corrija e salve. Se o produto não for permitido, encerre o anúncio.
- **Pausa manual:** toque em **Reativar** no anúncio.

> **Dica:** um anúncio pausado por falta de estoque **não precisa ser apagado**. Apagar e publicar de novo faz você perder o histórico de vendas e as avaliações do anúncio.

## Ainda com dúvida?

Mande ao Suporte um **print do aviso do Mercado Livre** e o **título do anúncio**.$md$),

('publicacao', 'reprovado-marca-modelo', 'Anúncio reprovado por marca ou modelo',
 'Algumas categorias do Mercado Livre exigem marca e modelo específicos e não aceitam “Genérica”. Corrigir a ficha técnica resolve na maioria dos casos.',
 ARRAY['reprovado', 'marca', 'modelo', 'ficha técnica', 'genérica', 'atributos', 'moderado'],
$md$O Mercado Livre usa **marca** e **modelo** para organizar a busca e comparar produtos iguais. Em várias categorias (eletrônicos, beleza, autopeças, entre outras), esses campos são obrigatórios e o valor **“Genérica”** não é aceito.

## Por que isso acontece

- A Velo tenta identificar a marca a partir do título e dos dados do fornecedor. Quando não encontra, o campo pode ir vazio ou genérico.
- O Mercado Livre revisa os anúncios depois de publicados e pode reprovar se a marca ou o modelo não baterem com o produto.

## Antes de publicar (evita a reprovação)

Na etapa de revisão do assistente, em **Marca e atributos** (marcado como *Exigido pelo Mercado Livre*), confira se a marca e o modelo estão corretos antes de clicar em **Publicar produto**.

## Corrigindo um anúncio já reprovado

**No computador:**

1. Acesse **mercadolivre.com.br** → clique no seu nome → **Vendas** → **Anúncios**.
2. Abra o anúncio reprovado e clique em **Modificar**.
3. Vá na **Ficha técnica** e ajuste **Marca** e **Modelo**.
4. Salve. O anúncio é reavaliado automaticamente, em geral em poucos minutos.

**No celular:**

1. No **app do Mercado Livre**, toque em **Mais** → **Vendas** → **Anúncios**.
2. Toque no anúncio reprovado → **Modificar** → **Ficha técnica**.
3. Corrija **Marca** e **Modelo** e salve.

## Não sei qual marca ou modelo usar

1. Procure o mesmo produto no Mercado Livre e veja o que anúncios **ativos** da mesma categoria usam.
2. Confira fotos da embalagem ou do produto: a marca costuma aparecer ali.
3. Use o nome real do fabricante. Não use marca famosa para um produto que não é dela: isso gera reprovação por propriedade intelectual e pode prejudicar sua conta.

> **Dica:** se o fabricante não tem marca registrada, algumas categorias aceitam o nome do fabricante ou do próprio produto como modelo. Evite repetir a mesma palavra em marca e modelo.$md$),

('publicacao', 'anuncio-sem-vendas', 'Anúncio ativo mas sem vendas',
 'Um anúncio pode estar no ar e não vender por preço, título, fotos, frete ou pouca exposição. Veja o que ajustar e quanto tempo esperar antes de mexer.',
 ARRAY['sem vendas', 'visitas', 'preço', 'título', 'fotos', 'não vende', 'exposição', 'frete grátis', 'concorrência'],
$md$Anúncio ativo significa que ele pode ser encontrado, mas **não garante vendas**. O Mercado Livre decide quem aparece primeiro na busca com base em preço, relevância do título, qualidade das fotos, frete, reputação e histórico de vendas.

## Por que isso acontece

- **Anúncio novo:** nas primeiras 48 horas o Mercado Livre testa o anúncio com pouco tráfego.
- **Preço acima da concorrência** para o mesmo produto.
- **Título** sem as palavras que o comprador realmente pesquisa.
- **Fotos** fracas ou em pouca quantidade.
- **Frete** caro ou prazo longo.
- **Conta nova**, ainda sem reputação.

## O que fazer (na ordem)

1. **Espere 48 horas** depois de publicar antes de mudar qualquer coisa.
2. **Veja as visitas.** Se o anúncio tem visitas mas não vende, o problema costuma ser preço, frete ou confiança. Se não tem visitas, o problema é título ou exposição.
3. **Compare o preço** com os 3 primeiros resultados da mesma busca, somando o frete.
4. **Revise o título:** comece pelo que o produto é, depois marca, modelo e característica principal. Máximo de 60 caracteres, sem palavras como “promoção” ou “oferta”.
5. **Confira as fotos:** 3 a 6 fotos boas, fundo limpo, sem textos nem selos.
6. **Avalie o frete grátis** ou o **Mercado Envios Full**, quando disponível para a sua conta.

## Onde ver visitas e ajustar

**No computador:** no Mercado Livre, vá em **Vendas → Anúncios** e abra o anúncio para ver visitas e desempenho. Para mudar preço ou título, clique em **Modificar**. Na Velo, a tela **Publicações** lista tudo o que você publicou.

**No celular:** no app do Mercado Livre, toque em **Mais → Vendas → Anúncios**, abra o anúncio e toque em **Modificar**. Na Velo, **Minha Conta → Publicações**.

> **Dica:** mude **uma coisa de cada vez** e espere alguns dias para medir o efeito. Mudar tudo junto impede saber o que funcionou.

## Perguntas comuns

**Devo apagar e publicar de novo?** Normalmente não. Um anúncio novo começa do zero em relevância e perde o histórico.

**A Velo garante vendas?** Não. A Velo facilita a escolha do produto e a publicação, mas as vendas dependem de preço, concorrência e demanda.$md$),

('publicacao', 'reativar-anuncio', 'Como reativar um anúncio fechado',
 'Anúncios finalizados pelo Mercado Livre podem ser reativados por lá, depois de resolver o motivo. Anúncios encerrados pela Velo devem ser publicados de novo pela Velo.',
 ARRAY['reativar', 'finalizado', 'fechado', 'encerrado', 'republicar', 'anúncio sumiu'],
$md$Um anúncio **finalizado** (ou fechado) não aparece mais para os compradores. Ele pode ter sido encerrado pelo Mercado Livre, por você ou pela Velo. O caminho para voltar depende de quem encerrou.

## Por que isso acontece

- Ficou **pausado por muito tempo** (por exemplo, sem estoque) e o Mercado Livre finalizou.
- Teve uma **infração de política** que não foi corrigida.
- Foi **encerrado manualmente** no painel do Mercado Livre.
- Foi **removido pela Velo**, por exemplo depois de um pedido de reembolso da assinatura, em que as publicações feitas pela Velo são removidas.

## Encerrado pelo Mercado Livre ou por você

**No computador:**

1. Acesse **mercadolivre.com.br** → seu nome → **Vendas** → **Anúncios**.
2. Filtre por **Finalizados**.
3. Abra o anúncio e clique em **Reativar**. Se o Mercado Livre pedir correções (ficha técnica, fotos, estoque), faça antes.

**No celular:**

1. No **app do Mercado Livre**, toque em **Mais → Vendas → Anúncios**.
2. Abra os **Finalizados**, toque no anúncio e em **Reativar**.

## Encerrado pela Velo

**Não force a reativação pelo Mercado Livre.** Publique de novo pela Velo: **Catálogo** → abra o produto → **Publicar produto**. Assim o anúncio volta ligado à Velo, com sincronização (nos planos que têm) e com os pedidos aparecendo na tela **Pedidos**.

> **Dica:** se você pediu reembolso da assinatura recentemente, novas publicações ficam bloqueadas até a data informada na mensagem de erro.

## Perguntas comuns

**O botão Reativar não aparece.** Alguns anúncios, como os finalizados há muito tempo ou por infração grave, não podem ser reativados. Nesse caso, publique de novo pela Velo.$md$),

-- ═══════════════════════════ PAGAMENTOS E PLANOS ═════════════════════════════
('pagamentos-e-planos', 'preciso-pagar-para-publicar', 'Preciso pagar para publicar?',
 'Sim. A Velo não tem plano gratuito: publicar exige uma assinatura ativa (Base, Pro ou Business). O Mercado Livre só cobra comissão quando você vende.',
 ARRAY['plano', 'assinatura', 'preço', 'pagar', 'mensalidade', 'grátis', 'gratuito', 'base', 'pro', 'business', 'upgrade', 'limite'],
$md$A Velo funciona por **assinatura**. Sem um plano ativo você consegue entrar e ver a plataforma, mas **não consegue publicar**: ao tentar, o assistente leva você para escolher um plano (*Continuar para o plano*).

## Os planos

| | **Base** | **Pro** | **Business** |
|---|---|---|---|
| Preço | R$ 39,90/mês | R$ 79,80/mês | R$ 2.278,80/ano (R$ 189,90/mês) |
| Anúncios ativos no Mercado Livre | até 50 | até 300 | ilimitados |
| Publicações por mês | 50 | 300 | sem limite |
| Publicação em lote e variações (cor, tamanho) | — | ✓ | ✓ |
| Sincronização automática de preço e estoque | — | ✓ | ✓ |
| Catálogo validado e IA para título e descrição | ✓ | ✓ | ✓ |
| Suporte | por e-mail | prioritário | prioritário e dedicado |

Os valores e benefícios sempre atualizados aparecem na própria tela de planos da Velo. Base e Pro também podem ser pagos no ciclo anual.

## O que está incluído

O plano cobre o acesso ao catálogo, a publicação no Mercado Livre, a IA de título e descrição e o suporte. **A Velo não cobra comissão por venda.**

## O que não está incluído

- **Tarifas do Mercado Livre:** comissão e taxa fixa por venda, cobradas pelo próprio Mercado Livre. Veja *Como funcionam as tarifas do Mercado Livre*.
- **Custo do produto:** você paga o fornecedor a cada pedido, pela tela **Pedidos**.

## Como assinar ou mudar de plano

**No computador:** clique no cartão com seu nome (canto inferior esquerdo) → **Assinatura**, ou **Configurações → Plano**. Escolha o plano e clique em **Fazer upgrade**. O pagamento é feito no checkout seguro da ValidaPay, por **Pix** ou **cartão de crédito**.

**No celular:** **Minha Conta → Configurações → Plano** → escolha o plano → **Fazer upgrade** → pague por Pix ou cartão.

Depois da confirmação do pagamento você volta para a Velo com o plano ativo.

> **Dica:** se você está começando, o **Base** já permite publicar e aprender. Quando os limites apertarem (50 anúncios ou falta de sincronização de estoque), o **Pro** passa a valer a pena.

## Perguntas comuns

**Existe teste grátis?** Não há plano gratuito. Nos primeiros 7 dias depois da cobrança, você pode cancelar e pedir reembolso — veja *Pedir reembolso de uma cobrança*.

**O Mercado Livre cobra para publicar?** No formato Clássico, não. A comissão só é descontada quando o produto vende.$md$),

('pagamentos-e-planos', 'cobranca-nao-reconhecida', 'Cobrança que não reconheço',
 'Antes de contestar no banco, confira na Velo se existe uma assinatura ativa no seu nome. A cobrança é feita pela ValidaPay, então o nome na fatura pode não ser “Velo”.',
 ARRAY['cobrança', 'fatura', 'cartão', 'não reconheço', 'cobrança indevida', 'validapay', 'débito', 'pix', 'renovação'],
$md$A assinatura da Velo é cobrada pela **ValidaPay**, a intermediadora de pagamentos que usamos. Por isso, a descrição na fatura do cartão ou no extrato pode trazer o nome dela, e não “Velo”.

## Por que isso acontece

As causas mais comuns de uma cobrança “desconhecida”:

- **Renovação automática** do plano no fim do período (mensal ou anual).
- Assinatura feita **com outro e-mail** que você esqueceu que tinha.
- Cartão usado por **outra pessoa da família** ou da empresa.
- Nome do intermediador na fatura, diferente de “Velo”.

## Como conferir

**No computador:**

1. Entre na Velo e clique no cartão com seu nome (canto inferior esquerdo) → **Configurações**.
2. Na aba **Plano**, veja se existe um plano ativo.
3. Na aba **Suporte**, role até **Cancelar assinatura / reembolso**: lá aparecem seus pagamentos, com valor e data.
4. Compare **valor e data** com a cobrança da fatura.

**No celular:**

1. **Minha Conta → Configurações → Plano** para ver o plano ativo.
2. **Minha Conta → Suporte** e role até **Cancelar assinatura / reembolso** para ver os pagamentos.

## Se a cobrança for da sua assinatura

É a cobrança recorrente do plano. Se não quer mais usar, veja *Cancelar minha assinatura* ou, se estiver nos primeiros 7 dias depois da cobrança, *Pedir reembolso de uma cobrança*.

## Se você não reconhece mesmo assim

Abra uma conversa com o **Suporte** e informe:

1. O **valor exato** e a **data** da cobrança.
2. Os **4 últimos dígitos** do cartão, se foi no cartão (nunca envie o número completo).
3. O **e-mail** que você usa na Velo.

Em caso de cobrança indevida, o valor é devolvido.

> **Dica:** fale com o Suporte **antes** de abrir contestação no banco. A contestação costuma demorar semanas; pelo Suporte, a verificação é mais rápida.$md$),

('pagamentos-e-planos', 'pedir-reembolso', 'Pedir reembolso de uma cobrança',
 'Nos primeiros 7 dias depois da cobrança, você pode cancelar e pedir reembolso direto pela Velo. O pedido é analisado em até 48 horas.',
 ARRAY['reembolso', 'estorno', 'devolução', 'dinheiro de volta', '7 dias', 'arrependimento', 'cancelar e pedir reembolso'],
$md$Você tem **7 dias** a partir da cobrança para cancelar e pedir o dinheiro de volta. Depois desse prazo ainda é possível cancelar, mas sem reembolso: veja *Cancelar minha assinatura*.

## Como funciona

- Ao confirmar, a assinatura é **cancelada na hora**.
- O pedido de reembolso é **analisado em até 48 horas**.
- Se aprovado, o valor é **estornado no cartão** e pode levar **até 30 dias** para aparecer na fatura. Esse é o prazo do banco emissor, não da Velo.
- As **publicações feitas pela Velo no seu Mercado Livre são removidas**.
- Depois de um reembolso, **novas publicações ficam bloqueadas** por um período. A data de liberação aparece se você tentar publicar.

## No computador

1. Clique no cartão com seu nome (canto inferior esquerdo) → **Configurações** → aba **Suporte**.
2. Role até **Cancelar assinatura / reembolso**.
3. No pagamento, clique em **Cancelar e pedir reembolso**. O botão só aparece dentro dos 7 dias.
4. Escolha o **motivo** (por exemplo, “Não era o que eu esperava”).
5. Explique com suas palavras. São pelo menos **30 caracteres**, e isso ajuda o time a analisar.
6. Na tela **Antes de confirmar**, leia o resumo e escolha:
   - **Falar com suporte antes**, se quiser tentar resolver o problema primeiro; ou
   - **Confirmar cancelamento mesmo assim**.
7. Acompanhe a resposta pelo chat de suporte.

## No celular

1. Toque em **Minha Conta** → **Suporte**.
2. Role até **Cancelar assinatura / reembolso**.
3. Toque em **Cancelar e pedir reembolso** e siga os mesmos passos: motivo, detalhes e confirmação.

> **Dica:** se o motivo é uma dificuldade (não conseguiu publicar, não entendeu uma tela), vale tocar em **Falar com suporte antes**. Muitas vezes resolvemos em minutos, e você não perde as publicações.

## Perguntas comuns

**Passou dos 7 dias. Tenho direito?** O botão de reembolso não aparece depois do prazo. Você pode cancelar para não haver renovação e falar com o Suporte sobre casos específicos, como cobrança duplicada.

**Paguei por Pix.** Siga os mesmos passos. O time informa pelo chat de suporte como o valor será devolvido.

**O dinheiro não apareceu na fatura.** Estornos no cartão podem levar até 30 dias e às vezes aparecem como crédito na fatura seguinte.$md$),

('pagamentos-e-planos', 'cancelar-assinatura', 'Cancelar minha assinatura ou conta',
 'Você pode cancelar a assinatura a qualquer momento em Configurações → Suporte; o acesso continua até o fim do período pago. Excluir a conta é outra ação, em Configurações → Segurança.',
 ARRAY['cancelar', 'cancelamento', 'excluir conta', 'lgpd', 'apagar conta', 'não renovar', 'parar assinatura'],
$md$Existem duas coisas diferentes:

- **Cancelar a assinatura:** a cobrança para de se renovar. Sua conta continua existindo.
- **Excluir a conta:** apaga sua conta e seus dados da Velo **permanentemente**.

## Cancelar a assinatura

**O que acontece:** a assinatura **não é renovada**, e você mantém o acesso **até o fim do período já pago**. A data aparece na tela, como *Cancelada — acesso até DD/MM/AAAA*. Se ainda estiver dentro dos 7 dias da cobrança, você pode cancelar com reembolso — veja *Pedir reembolso de uma cobrança*.

**No computador:**

1. Clique no cartão com seu nome (canto inferior esquerdo) → **Configurações** → aba **Suporte**.
2. Role até **Cancelar assinatura / reembolso**.
3. Clique em **Cancelar assinatura**.
4. Escolha o motivo, escreva os detalhes (mínimo de 30 caracteres) e confirme em **Confirmar cancelamento mesmo assim**.

**No celular:**

1. **Minha Conta → Suporte**.
2. Role até **Cancelar assinatura / reembolso** e toque em **Cancelar assinatura**.
3. Siga os mesmos passos: motivo, detalhes e confirmação.

Você também pode pedir o cancelamento pelo chat de suporte (o botão azul de conversa), na opção de cancelamento.

## Excluir a conta

**Atenção:** essa ação **não pode ser desfeita**. Sua conta e todos os dados da Velo são apagados.

**No computador:** **Configurações → Segurança → Excluir conta**. Confirme nas duas janelas de confirmação.

**No celular:** **Minha Conta → Configurações → Segurança → Excluir conta**.

Cancele a assinatura **antes** de excluir a conta, para garantir que não haja nova cobrança.

## E meus anúncios no Mercado Livre?

Os anúncios ficam na **sua conta do Mercado Livre**. Se você pediu **reembolso**, as publicações feitas pela Velo são removidas. Pedidos que já existem continuam sendo seus: conclua o envio dos que estão em andamento antes de sair.

> **Dica:** se o motivo do cancelamento é uma dificuldade com a plataforma, fale com o Suporte antes. Pela tela de cancelamento, o botão **Falar com suporte antes** abre a conversa com o seu motivo já preenchido.

## Perguntas comuns

**Posso voltar depois?** Sim. Basta assinar um plano de novo em Configurações → Plano.

**Quero que apaguem meus dados (LGPD).** Use **Excluir conta** em Configurações → Segurança ou peça pelo Suporte.$md$),

-- ════════════════════════════ CONTA E SUPORTE ════════════════════════════════
('conta-e-suporte', 'esqueci-minha-senha', 'Esqueci minha senha',
 'Na tela de login, digite seu e-mail, toque em “Esqueceu a senha?” e use o link que chega por e-mail para criar uma senha nova.',
 ARRAY['senha', 'login', 'acesso', 'recuperar', 'redefinir', 'não consigo entrar', 'esqueci', 'link de recuperação', 'google'],
$md$Você recebe por e-mail um link para criar uma senha nova. O processo leva poucos minutos.

## No computador ou no celular

1. Acesse a tela de login da Velo.
2. Digite o **e-mail** da sua conta e continue.
3. Na etapa da senha, clique em **Esqueceu a senha?**.
4. Confira o e-mail e clique em **Enviar link de recuperação**.
5. Abra o e-mail da Velo e clique no link. **Verifique também o spam e a aba Promoções.**
6. Crie a nova senha, com **pelo menos 8 caracteres**, e confirme digitando de novo.
7. Pronto: aparece *Senha atualizada com sucesso* e você já pode entrar.

**No celular**, abra o link do e-mail no **Chrome ou no Safari**. Se o app de e-mail abrir o link dentro dele e der erro, copie o link e cole no navegador.

## Se der errado

| Situação | Por que acontece | O que fazer |
|---|---|---|
| “Link de recuperação inválido ou expirado” | O link venceu ou já foi usado | Peça um link novo e use o **mais recente** |
| O e-mail não chega | Foi para o spam, ou o e-mail digitado está diferente do cadastro | Confira o spam, espere alguns minutos e confira se digitou o e-mail certo |
| “As senhas não conferem” | Os dois campos estão diferentes | Digite a mesma senha nos dois |
| “A senha precisa ter pelo menos 8 caracteres” | Senha curta demais | Use 8 caracteres ou mais |

## Criei a conta com o Google

Se você entrou pela primeira vez com **Continuar com Google**, sua conta pode não ter senha. Use o botão **Continuar com Google** na tela de login.

> **Dica:** evite pedir vários links seguidos. Cada novo pedido invalida o anterior, então use sempre o último e-mail recebido.

## Ainda sem acesso?

Fale com o Suporte informando o **e-mail da conta**. Por segurança, nunca envie sua senha, nem para o time da Velo.$md$),

('conta-e-suporte', 'trocar-email', 'Trocar o email da conta',
 'Por segurança, a troca do e-mail de acesso é feita pelo Suporte, depois de confirmarmos que você é o dono da conta.',
 ARRAY['email', 'trocar email', 'alterar conta', 'mudar e-mail', 'e-mail errado'],
$md$O e-mail é o que identifica sua conta e é para onde vão os links de recuperação de senha. Por isso ele **não pode ser alterado direto pelo painel**: a troca é feita pelo Suporte, depois de confirmar que o pedido veio de você.

## Por que é assim

Se alguém conseguisse trocar o e-mail sem verificação, poderia tomar sua conta e pedir uma nova senha. A confirmação protege você.

## Como pedir

**No computador:**

1. Entre na Velo com o e-mail atual.
2. Abra o chat de suporte (o **botão azul**, no canto inferior direito) e toque em **Enviar uma mensagem**, ou vá em **Configurações → Suporte**.
3. Escreva: *Quero trocar o e-mail da minha conta de [e-mail atual] para [e-mail novo].*
4. Aguarde a resposta no mesmo chat.

**No celular:**

1. **Minha Conta → Suporte**.
2. Envie a mesma mensagem com o e-mail atual e o novo.

## Prazo

A troca é feita em até **24 horas úteis**. Quando concluída, entre com o **e-mail novo** e a mesma senha.

> **Dica:** a troca na Velo **não muda** o e-mail do seu Mercado Livre nem do Mercado Pago. Esses você altera direto neles.

## Perguntas comuns

**Não tenho mais acesso ao e-mail antigo.** Fale com o Suporte explicando a situação. Podemos pedir informações extras para confirmar que a conta é sua.$md$),

('conta-e-suporte', 'fornecedor-sem-produto', 'Cliente comprou mas o fornecedor sumiu',
 'Se o fornecedor ficou sem o produto ou não responde depois de uma venda, abra um chamado com o número do pedido. A Velo intervém para proteger sua reputação.',
 ARRAY['fornecedor', 'pedido', 'entrega', 'reputação', 'sem estoque', 'atraso', 'cancelar venda', 'produto não enviado'],
$md$É raro, mas pode acontecer de um produto vender e o fornecedor ficar sem estoque, atrasar ou não responder. Como o comprador comprou de **você** no Mercado Livre, o atraso afeta a **sua reputação**. Por isso a ação precisa ser rápida.

## Por que isso acontece

- O estoque do fornecedor acabou entre a publicação e a venda. No plano **Base** não há sincronização automática de estoque, então o anúncio pode continuar ativo depois que o fornecedor zerou.
- Problemas operacionais do fornecedor, como atraso no despacho ou falta de embalagem.

## O que fazer assim que perceber

**No computador:**

1. Abra **Pedidos** na barra lateral e localize a venda.
2. Veja o status do pedido e da compra no fornecedor.
3. Abra o chat de suporte (o **botão azul**, canto inferior direito) e envie o **número do pedido do Mercado Livre** e o que aconteceu.

**No celular:**

1. Toque em **Pedidos** na barra inferior e localize a venda.
2. Vá em **Minha Conta → Suporte** e envie o número do pedido.

## O que a Velo faz

1. Contata o fornecedor pelos nossos canais.
2. Se não houver solução em **48 horas**, reembolsamos o comprador em nome do vendedor para preservar sua reputação no Mercado Livre.
3. Você não perde nota na reputação por problema de fornecedor da nossa base.

## Enquanto isso

- **Não ignore o comprador:** responda às mensagens no Mercado Livre avisando que está verificando o envio.
- **Não cancele a venda por conta própria** antes de falar com o Suporte: cancelamentos feitos pelo vendedor pesam na reputação.

> **Dica:** nos planos **Pro** e **Business**, a sincronização automática de estoque reduz muito esse risco, porque o anúncio é pausado quando o fornecedor zera.$md$),

('conta-e-suporte', 'falar-com-suporte', 'Como falar com o suporte humano',
 'O suporte da Velo é por chat dentro da plataforma: o botão azul no canto inferior direito ou Configurações → Suporte. Você recebe aviso quando o time responder.',
 ARRAY['suporte', 'atendimento', 'chamado', 'contato', 'ajuda', 'chat', 'ticket', 'falar com humano', 'whatsapp'],
$md$O atendimento da Velo é feito por **chat dentro da própria plataforma**. Cada conversa vira um **ticket**: você acompanha as respostas no mesmo lugar e recebe um aviso quando o time responder.

## No computador

1. Clique no **botão azul de conversa** no canto inferior direito da tela.
2. Toque em **Enviar uma mensagem** para abrir uma conversa com o time.
3. Descreva o problema. Se puder, **anexe um print** (imagem de até 8 MB).
4. Envie. Aparece *Ticket aberto. Nosso time responde por aqui.*
5. As respostas aparecem na aba **Mensagens** do chat.

O botão azul não aparece em algumas telas (Início, Catálogo e Coleções) e fica escondido quando o Atlas está aberto. Nesses casos, use **Configurações → Suporte**: clique no cartão com seu nome (canto inferior esquerdo) → **Configurações** → aba **Suporte**.

## No celular

1. Toque em **Minha Conta** na barra inferior.
2. Toque em **Suporte**.
3. Escreva a mensagem, anexe um print se tiver e envie.

## Como ser atendido mais rápido

- Diga **o que você tentou fazer** e **o que aconteceu**.
- Envie **print da mensagem de erro**, com a tela inteira se possível.
- Informe o **nome do produto** ou o **número do pedido**, quando for o caso.
- Mantenha **um assunto por conversa**.

> **Dica:** antes de abrir um chamado, pesquise aqui na Central de Ajuda. Muitas dúvidas (conexão com o Mercado Livre, erros de publicação, reembolso) já têm o passo a passo completo.

## Prazo de resposta

Respondemos pelo chat em até algumas horas em dias úteis. O tempo pode variar conforme o plano: o Pro tem suporte prioritário e o Business tem atendimento dedicado. Quando o problema é resolvido, o ticket aparece como **Resolvido**.

## Perguntas comuns

**Tem WhatsApp ou telefone?** O canal oficial é o chat dentro da Velo, porque assim o time vê os dados da sua conta e resolve mais rápido.

**Nunca envie** sua senha nem dados completos de cartão pelo chat.$md$);

-- Aplica: título, resumo, palavras-chave e conteúdo de cada artigo.
UPDATE public.help_articles a
SET title = v.title,
    summary = v.summary,
    keywords = v.keywords,
    content = v.content
FROM _help_v2 v
JOIN public.help_categories c ON c.slug = v.category_slug
WHERE a.category_id = c.id
  AND a.slug = v.slug;

DROP TABLE _help_v2;
