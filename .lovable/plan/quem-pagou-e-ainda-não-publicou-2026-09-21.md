# Quem pagou e ainda não publicou

## O que existe hoje
- Pagamento: tabela de assinaturas, com status pago/ativo e data.
- Conexão com o Mercado Livre: tabela de integrações, com token, validade e data em que foi ligada.
- Publicação: tabela de anúncios publicados + fila de publicações pendentes (com erro da última tentativa).
- Erros de publicação: tabela própria, com código e mensagem traduzida do Mercado Livre.
- Aptidão de vendedor: hoje só é consultada ao vivo quando a pessoa está usando o app; nada fica guardado. Por isso o funil usa "Mercado Livre conectado".

## O que vou fazer

### 1. Guardar a aptidão real de vendedor
Nova tabela por usuário com: pode anunciar (sim/não/desconhecido), códigos de bloqueio devolvidos pelo Mercado Livre, data da última verificação e origem (verificação automática ou tentativa de publicar).
Passa a ser gravada em três momentos: quando a pessoa conecta a conta, quando o app verifica o status, e quando uma publicação é recusada por bloqueio de conta.
Para quem pagou e sumiu, um verificador em lote (rodando no servidor, com o token já guardado) atualiza o status sem depender de a pessoa voltar.
Limite conhecido: se a conexão expirou e não dá para renovar o token, o Mercado Livre não responde — nesses casos o motivo vira "conexão expirada", que já é uma resposta útil.

### 2. Lista no admin
Nova aba "Pagou e não publicou" no Rastreio, com uma linha por pessoa:
nome, e-mail, contato, plano, data do pagamento, dias parado e motivo, em uma destas categorias:
- Mercado Livre não conectado
- Conexão expirada ou desfeita
- Conectado, mas sem perfil de vendedor
- Apto, nunca tentou publicar
- Tentou e deu erro (mostra o tipo de erro)
- Motivo desconhecido

Filtro por período de pagamento, resumo por categoria com quantidade e tempo mediano parado, e botão para baixar a lista em CSV.

### 3. Privacidade
Tudo atrás de verificação de administrador no próprio banco (mesmo padrão das telas atuais). Contato aparece só nessa tela interna de suporte.

### 4. Visão "pagou antes da conta ficar pronta"
Passa a usar aptidão real em vez de "conectado": conta como pronta quem o Mercado Livre confirma que pode anunciar, ou quem já publicou.

## Detalhes técnicos
- Migration: tabela `ml_seller_readiness` (grants + RLS, leitura só do dono e de admin), RPCs `rpc_admin_paid_not_published` (lista classificada) e `rpc_admin_paid_not_published_summary` (resumo por categoria + mediana), e atualização de `rpc_admin_paid_without_seller_cohort`.
- Edge function `ml-seller-readiness-refresh`: varre os pagantes sem publicação, renova token quando possível, consulta `/users/me`, grava o resultado; chamável pelo admin e por cron diário.
- `ml-seller-status` e o fluxo de publicação passam a persistir o resultado na mesma tabela.
- UI: novo componente em `src/components/admin/AdminPaidNotPublishedPanel.tsx`, adicionado como aba em `AdminTrackingPage`; nada do painel atual muda.
