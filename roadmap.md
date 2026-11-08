# Roadmap

## Plano ampliado de recuperação — somente leitura nesta rodada
- [x] Reunir respostas brutas das três divergências e quatro diferenças de interpretação e fotos principais no relatório
- [x] Medir catálogo inteiro por fornecedor, motivos e filtros; propor critério, reanálise de galeria, fila, indicador e lotes sem executar
- [x] Conferir estado dos 20: zero perdeu desbloqueio, galeria igual; apenas kit 5 cm atualizado depois, 19 aguardam fornecedor
- [x] Preparar plano para aprovação; nenhuma mudança em parser, importadores, modelo, regras ou anúncios

## Execução por etapas do plano ampliado aprovado
- [x] Etapa 1: critério físico/embalagem versus overlay e interpretação estruturada versionada implementados localmente; 26 testes simulados passaram, sem IA real ou alteração de produtos
- [ ] Publicar critério após equivalência aprovada; modelo permanece 3.6 e funções publicadas permanecem intactas
- [ ] Etapas 2–4: mudanças de importadores/schema/admin/filtros aguardam aprovação específica por etapa prevista no plano
- [ ] Etapa 5: execução da nova equivalência exige aprovação específica, referência humana e reconciliação do orçamento; nenhum teste pago iniciado
- [ ] Etapa 6: lotes aguardam atualização real dos 19 natalinos e autorização individual

## Recuperação controlada de imagens — novembro
- [x] Sete conflitos recuperados, galerias iguais; CAS somente bloqueio/galeria e snapshots novos, preços/estoque intocados
- [x] Links e razões das duas principais entregues; cascata é foto de embalagem, não confirmação de arte sobreposta
- [x] Comparação 100/200 sem retries: estimado 1,645071; três divergências brutas e quatro diferenças só do parser; produção intacta
- [x] Confirmar versões observadas (auditoria 332→334, publicação 1875→1877, catálogo 1738) e nova revisão tri-state no ar; bundle anterior não disponível
- [x] Mapear gravadores e quantificar snapshot 645/624: 574 sem outro motivo detectável, 50 com evidência adicional; causa exclusiva não comprovável
- [x] Proteger validação visual contra falha técnica/cache negativo/URL heurística; 11 testes, dry-run real e importadores conferidos
- [x] Dry-run 40/290 fotos: 183 aprovadas, 101 reprovadas, 6 inconclusivas; 38 candidatos e 2 outras restrições; custo estimado 2,574444, projeção 43,93/teto proposto 60
- [x] Atualização automática retirou 94 bloqueios por leitura truncada: restaurados somente esses bloqueios, paginação corrigida; zero dos 645 originais liberados
- Limite: gatilho/scrapers ainda bloqueiam por três URLs e pré-checagem por heurística; alinhar no PASSO 3 sem desbloqueio automático. Total concorrente passou a 648.
- [x] PASSO 3 piloto Natal: 13 recuperados com snapshot/CAS; 7 pulados por fornecedor concorrente, 2 principal reprovada, 1 menos de três URLs; fila sem execução automática
- [ ] Preservação após fornecedor: kit 5 cm atualizado 00:15 UTC manteve desbloqueio/oito aprovadas; outros 19 dos 20 recuperados aguardam inclusão em atualização real
- [ ] Restante aguarda aprovação por etapa do plano ampliado e conferência do fornecedor; gravador/REP-p excluídos e outros riscos apresentados antes
- [x] Proposto Gemini 3.8 Flash, tarifa igual/custo condicional e teste de 100 fotos; nenhum modelo trocado ou inferência nova no piloto; teto 60/5.000 com pausas 25%/50%

## Cortesia Igor e aviso de renovação mensal
- [x] Estorno R$ 79,80 confirmado (ref_1794092439013_9qiienm65), motivo registrado, acesso encerrado sem cooldown
- [ ] Cancelamento ValidaPay: bloqueado por HTTP 400; provider_cancelled_at nulo, sem nova tentativa após falha
- [x] Aviso mensal e Como cancelar nos planos, checkout e confirmação por e-mail; vitalício excluído
- [x] Avisos e destino autenticados conferidos, registros financeiros relidos; lembrete exige esforço moderado e não foi implementado

## Leitura de imagens do catálogo
- [x] Corrigir envio das fotos e não memorizar análises inconclusivas como reprovação
- [x] Preservar produtos em falhas temporárias; seis testes passaram e fotos reais foram aprovadas
- [x] Publicar ml-publish e ml-catalog-vision-audit; reavaliar/restaurar os dois produtos e conferir fotos no site autenticado
- Limites: outros produtos anteriormente bloqueados ainda precisam de reavaliação; nenhum anúncio foi publicado. Check Deno de ml-publish mantém dez erros de tipagem preexistentes, enquanto os módulos alterados e a auditoria passam.

## Recorrências após cancelamento/reembolso
- [x] Unificar cancelamento confirmado na ValidaPay com fila de retentativas para novos pedidos; aproveita reconciliação existente, sem novo agendamento
- [x] Bloquear reativação e efeitos financeiros no webhook e reconciliação; preservar outras assinaturas válidas e adicionar proteção no banco
- [x] Exibir incidentes e diagnóstico histórico somente leitura; estorno em massa desativado e operação pontual exige confirmação/reserva durável
- [x] 15 testes simulados passaram, sete funções publicadas e diagnóstico autenticado conferido; logs da reconciliação sem movimentações e oito contratos históricos sem alterações
- Limite de validação: nenhum cancelamento/estorno real executado; resposta real de agendamento da ValidaPay permanece não exercitada. Falha antes/depois do envio de estorno reservado exige revisão manual, nunca repetição cega.

## Admin — Fase 1
- [x] Paginar Usuários no servidor com abas, busca e contadores globais
- [x] Corrigir leituras inválidas de role e validar quatro índices com EXPLAIN
- [x] Quatro testes de entrada e nove regras SQL; abas/página/busca e 401/400 conferidos sem gravações; abertura 40,3s (função 546) → 4,3s (200), duas chamadas principais
- Escopo: não alterar Suporte, Reembolsos, pagamentos nem registros de clientes

## Nova compra após reembolso e FAQ 5
- [x] Liberar cooldown no webhook e na tentativa de publicar somente para nova assinatura paga ativa posterior ao reembolso
- [x] Contar, limpar e reconferir: 59 cooldowns ativos, 1 elegível liberado, 58 mantidos e zero elegíveis restantes
- [x] Atualizar FAQ 5: 52 artigos publicados, cinco novos; links e menus conferidos, preservando ressalvas sobre causas do ML
- [x] Nove testes passaram; publicadas validapay-webhook e ml-publish; FAQ verificado no navegador e webhook recusou token inválido. Sem executar nova compra/publicação real; check Deno de ml-publish segue com erros preexistentes

## Oferta vitalícia para novas compras
- [x] Substituir opção anual por vitalício sem mudar assinaturas existentes
- [x] Configurar pagamento único confirmado e acesso sem expiração
- [x] Exibir preço final igual ao mensal e referência 20% maior com clareza
- [x] Validar preços e checkout autenticado na ValidaPay sem pagar; 13 testes passaram
- [x] Liberar vitalícios pagos sem webhook (busca da cobrança na ValidaPay) e novos preços 89,90/179,80/427,90

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
- [x] 1. Paginação confirmada (100 reais); 638 consultadas por ID: 8 pagando, 211 canceladas, 20 inexistentes, 339 nunca ativadas
- [x] 2. Bug dos 80 não existe: ativação atualiza o período; recorrência parou no gateway
- [x] 3. Nenhum dos 18 era pago; falha de consulta já vai para fila de reprocessamento
- [ ] 4. Monitorar 24h se algum evento real foi recusado com 401 (até agora: nenhum evento, nenhum 401)
- [x] 5. MP: token morto (401), 2 preapprovals exigem cheque manual; Stripe: 2 ativas cobrando sem sincronizar período
- [x] 6. Lista das 94 duplicadas MP entregue em CSV (R$ 4.839,40)
- [x] 7. Anúncios ML NÃO são pausados ao voltar ao grátis (só no reembolso); aviso não promete pausa
