# Roadmap

- [x] Simplificar a home mobile para o primeiro anúncio
- [x] Exibir preços e estimativas honestas nos cartões mobile, mantendo vendas e avaliações simuladas
- [x] Personalizar e ordenar produtos com dados reais
- [x] Melhorar categorias, toque e carregamento
- [x] Registrar o funil da home mobile
- [x] Validar celular e preservar desktop
- [x] Destacar preço sugerido e sobra bruta estimada na ficha mobile
- [x] Unificar a estimativa entre home, ficha e publicação
- [x] Simplificar ações, manter publicação fixa e avisar sobre plano
- [x] Remover métricas sem origem verificável da ficha
- [x] Medir ficha, importação, conexão, planos e publicação
- [x] Validar a ficha em celulares e preservar o desktop
- [x] Tornar honestas e claras as quatro etapas da publicação mobile
- [x] Preservar o rascunho ao fechar ou conectar o Mercado Livre
- [x] Gerar descrição automaticamente e mostrar prévia editável
- [x] Medir avanço, saída, erros e duração do fluxo de publicação
- [x] Validar o novo fluxo em celulares e preservar o desktop
- [x] Sincronizar aumentos de custo C7 com preços no Mercado Livre, preservando margem e pausando em falhas

## Pagamento antes da ativação da conta de vendedor
- [x] Fluxo: detalhes → conexão → revisão → plano → pagamento → verificação
- [x] Checagem de vendedor após conexão só em segundo plano (sem modal)
- [x] Aviso honesto antes do pagamento
- [x] Fila `pending_publications` + publicação automática quando a conta liberar
- [x] Lembretes no app (24h/72h) e verificação automática por hora
- [x] Eventos: paid_without_seller, seller_ready_after_paid, pending_publication_*
- [ ] Decidir se os lembretes também vão por e-mail

## Central de Ajuda
- [x] Aplicar o conteúdo revisado do FAQ enviado pelo usuário
- [x] Conferir todos os artigos publicados após a atualização
- [x] Publicar a revisão central-de-ajuda_3 com menus conferidos e sem inferências sobre bloqueios do ML
- [x] Ensinar ao suporte as páginas reais e validar links de navegação em conversa autenticada e FAQ público

## Cancelamento da renovação no suporte
- [x] Separar cancelamento autônomo de reembolso encaminhado à equipe
- [x] Adaptar o botão do cartão à situação da assinatura
- [x] Validar regras e publicar somente o assistente de suporte

## Contexto de reembolso no suporte
- [x] Corrigir cartão conforme a assinatura do cliente, inclusive após cancelar renovação
- [x] Distinguir reembolso da assinatura e da compra na fornecedora
- [x] Validar regras em 31 testes e publicar o assistente sem executar reembolso real
- [ ] Conferir conversa real e cartão no suporte administrativo — sessão disponível sem acesso de administrador

## Auditoria de pagamentos (out/2026)
- [x] ETAPA 1: migrados sem assinatura ValidaPay; status real dos 776 no gateway; webhook token; estornos das duplicidades; eventos ativos no painel
- [x] ETAPA 2: webhook recusa ativação sem chargeId sem confirmação; token obrigatório; eventos de reembolso tratados; erro nowIsoRefund corrigido; publicado e testado (401 sem token)
- [ ] ETAPA 3: aguardando aprovação da proposta (expiração em modo simulação + aviso de 7 dias para migrados)

## Pré-requisitos da ETAPA 3 (auditoria)
- [ ] 1. Confirmar paginação do gateway e consultar as 638 assinaturas por ID
- [ ] 2. Corrigir bug dos 80 que pagam sem período atualizado (causa + correção)
- [ ] 3. Verificar os 18 renewed sem chargeId na ValidaPay; garantir fila de reprocessamento
- [ ] 4. Monitorar 24h se algum evento real foi recusado com 401
- [ ] 5. Checar cobrança recorrente ativa dos 135 MP + 2 Stripe
- [ ] 6. Enviar lista das 94 duplicadas MP (id, data, valor, e-mail mascarado)
- [ ] 7. Confirmar se anúncios ML são pausados ao voltar ao plano grátis
