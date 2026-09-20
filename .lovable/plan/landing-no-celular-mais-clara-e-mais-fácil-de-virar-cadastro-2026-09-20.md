# Landing no celular: mais clara e mais fácil de virar cadastro

Todas as mudanças ficam **só na versão de celular**. O desktop continua exatamente como está hoje (cada bloco novo é escondido a partir de `sm:`).

## O que encontrei hoje

- O botão principal só diz "Entrar no dashboard" para quem já está logado; para visitante novo já diz "Começar agora", mas leva a uma tela que começa pedindo e-mail sem deixar claro que é criação de conta.
- O texto do topo é genérico: não fala em vender sem estoque nem em lucro por venda.
- Não existe nenhuma prova social na página.
- O título no celular usa peso fino (light) sobre foto, difícil de ler para gente mais velha.
- A foto do topo é grande e é a primeira coisa a carregar.
- "Ver como funciona" leva a uma seção longa e pouco visual.

## O que vou mudar (só celular)

1. **Botão principal**: "Criar minha conta grátis" levando direto para a criação de conta (`/login?novo=1`, que abre já no passo de cadastro). Abaixo, discreto: "Já tenho conta".
2. **Mensagem do topo**: título com mais peso e frase concreta — vender no Mercado Livre sem comprar produto antes e sem estoque; subtítulo dizendo que a pessoa vê o custo e o preço de venda antes de publicar. Sem promessa de ganho.
3. **Como funciona em 3 passos**, logo abaixo do topo: escolher o produto, a Velo monta o anúncio, publicar no Mercado Livre. Blocos grandes, ícones simples, texto curto.
4. **Prova social honesta**: número real de assinantes ativos vindo do banco (arredondado para baixo, ex.: "+1.200 pessoas já usam a Velo"), atualizado sozinho. Se o número não vier, o bloco simplesmente não aparece. Depoimentos ficam como espaço marcado para você preencher — não vou inventar nenhum.
5. **Leitura confortável**: fonte maior, peso médio, mais contraste sobre a foto, botões com pelo menos 52px de altura.
6. **Velocidade**: a foto do topo passa a carregar em versão menor no celular, com prioridade, e as seções de baixo só carregam quando a pessoa chega nelas. Vou medir antes e depois e te mostrar os dois números.
7. **Medição do funil**: registro de visita da landing, clique no botão principal e clique em "como funciona", para você ver a taxa de clique até o cadastro na tela de rastreio do admin.

## Parte técnica

- `src/pages/Index.tsx`: bloco mobile do hero (novo copy, CTA, 3 passos, prova social), tudo dentro do container `sm:hidden` já existente.
- `src/index.css`: estilos mobile-only novos, no mesmo padrão das classes `landing-mobile-*`.
- Nova função de backend só-leitura para o total de assinantes ativos (sem expor dados de usuário).
- Eventos de funil gravados em `user_page_views`/evento de clique, aproveitando o rastreamento que já existe.
- `LoginPage`: aceitar `?novo=1` para abrir direto no cadastro.

## O que preciso de você depois

- Depoimentos reais (nome, foto, frase) ou permissão para usar prints reais de clientes.
- Se quiser, um número oficial para destacar (ex.: anúncios publicados).
