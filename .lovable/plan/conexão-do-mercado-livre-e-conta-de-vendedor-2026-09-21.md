# Conexão do Mercado Livre e conta de vendedor

## O que eu confirmei no código hoje

- **A checagem de "consegue vender" só acontece na hora de publicar.** A função `ml-seller-status` (que lê o status real da conta no Mercado Livre) é chamada em dois lugares: no fluxo de importar, no clique de publicar, e no compositor do Atlas. Não roda ao terminar a conexão. Como a tela de planos vem depois da conexão e antes da publicação, **é possível alguém pagar e só então descobrir que a conta não está apta**.
- A resposta do onboarding ("já tenho conta de vendedor") já é lida na home mobile para o passo do checklist, mas **não muda nada** quando a pessoa vai conectar.
- O retorno do Mercado Livre já volta para a tela do produto quando a origem é o fluxo de importar, e o rascunho (produto, título, preço, etapa) já é preservado por 7 dias. Falta só cobrir quem sai para **criar** a conta de vendedor.
- Mensagens de erro da conexão hoje são técnicas ("Parametros ausentes", "invalid_state" nem tem texto).
- Números reais: **61 contas** têm conexão realmente quebrada (sem o dado que renova o acesso) e **18 vendedores com 193 anúncios no ar** não têm nenhuma conexão registrada. Causa mais provável: conexões feitas na versão antiga do app, que não guardavam o dado de renovação, e revogações feitas pelo próprio usuário no Mercado Livre.
- O vídeo do tutorial é um Vimeo carregado dentro de um modal. Só carrega quando o modal abre (bom para 4G), mas **não consigo confirmar se tem legenda** — isso depende do vídeo no Vimeo e você precisa verificar.

## O que vou mudar

1. **Tela curta de preparo antes de ir ao Mercado Livre** (novo modal, mobile e desktop): três frases do que vai acontecer (você vai ao Mercado Livre, autoriza a Velo, volta sozinho), o que a Velo faz com a conta (publica e atualiza seus anúncios, vê seus pedidos) e o botão para continuar. Sem afirmar nada que eu não consiga comprovar no código.
2. **Verificar a conta logo depois de conectar**, não no clique de publicar: assim que o retorno do Mercado Livre chega, a Velo consulta o status e, se a conta não estiver apta, abre o modal de tutorial ali mesmo. O clique de publicar continua verificando (rede de segurança), então nada muda para quem já vende.
3. **Bloqueio antes da cobrança**: a etapa de plano do fluxo de importar só libera o checkout depois da verificação de conta apta. Se não estiver apta, mostra o guia em vez do pagamento.
4. **Quem disse no onboarding que não tem conta de vendedor** vê o guia de criação antes de tentar conectar, tanto no checklist da home quanto no fluxo de importar.
5. **Modal do tutorial repaginado**: texto mais curto, botão "Já criei minha conta, verificar de novo" que refaz a verificação sem repetir todo o fluxo, e um atalho para falar com o suporte humano.
6. **Retomada**: quem sai para criar a conta de vendedor volta no mesmo produto, título e preço (reaproveitando o rascunho que já existe), e o checklist da home passa a mostrar "falta ativar sua conta de vendedor" quando for esse o caso.
7. **Celular mais robusto**: detectar quando a Velo está aberta dentro do navegador do Instagram/TikTok e, nesse caso, orientar a abrir no Chrome/Safari antes de conectar (dentro desses navegadores o retorno costuma perder a sessão). Erros comuns traduzidos para português simples com o que fazer.
8. **Reconexão**: o aviso de reconectar passa a cobrir também quem tem anúncios no ar e nenhuma conexão, com um caminho de poucos toques. Nenhum anúncio é apagado.
9. **Medição**: reaproveitando os eventos que já existem, acrescento início/sucesso/falha por tipo, conta sem perfil de vendedor detectada, abertura do modal, play no vídeo, clique em "já criei" e tempo até a conta ficar apta.

## Riscos e como evito

- Tokens e integração são sensíveis: **não mexo no `ml-connect`, no callback nem na gravação de tokens**. Todas as mudanças são de tela e de momento da verificação.
- Verificação que falha (API do ML fora do ar) **não bloqueia** ninguém: nesse caso o fluxo segue como hoje, para não travar quem já vende.
- Desktop preservado; os novos avisos aparecem nos mesmos pontos, sem reorganizar as telas existentes.

## O que preciso de você

- Confirmar se o vídeo do tutorial tem legenda (e regravar/legendar se não tiver).
- Decidir se quero enviar aviso (e-mail/notificação) para os 61 vendedores com conexão quebrada, ou só mostrar dentro do app.
- Testar em aparelho real: conectar pelo Chrome do Android e pelo Safari do iPhone, e abrir o link da Velo dentro do Instagram para ver o aviso.
