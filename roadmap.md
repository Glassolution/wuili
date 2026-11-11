# Roadmap

## Publicação com evidência salva e fila por instabilidade — 11/11
- [x] Reutilizar vereditos explícitos dos dois modelos, incluindo cache de produção, com principal e três fotos aprovadas; nenhuma alteração de catálogo
- [x] Reaproveitar pending_publications e auto-publish-pending com deduplicação, limites, lease e disjuntor persistente; migrations 0051–0052
- [x] Notificação transacional de publicação e ticket após 24h; cron gerenciado 51 a cada 5min substitui o antigo 46 pausado
- [x] 295/820 produtos prontos sem IA; 525 dependem dela; 33 testes Vitest + 35 Deno e checks passaram; produto real com 3 fotos confirmado sem IA
- [ ] Validação completa com publicação e retomada de IA: gateway retornou 402; conta autenticada sem papel admin nem conexão ML ativa
- [ ] Ativar ao enfileirar e pausar agendamento vazio: ferramenta gerenciada bloqueia funções SQL que consultem cron; rotina atual retorna vazia sem IA

## Aviso de fotos na publicação — 09/11
- [x] Separar principal reprovada de falha técnica, reservar checagens para os dois papéis e registrar diagnóstico por tentativa
- [x] 34 testes passaram; somente ml-publish publicada; teste autenticado com três fotos reais em cache retornou NO_ELIGIBLE_PRIMARY_IMAGE/409 e diagnóstico persistido, sem IA nova nem anúncio. Galeria completa e tela do cliente não exercitadas.

## Founder Mode — etapa 1 revisável, sem implantação (09/11)
- [x] Preparar proposta isolada de autorização, execução atômica e consultas agregadas para Qualidade de dados, sem alterar admin/crons
- [x] Reconferir histórico e número candidato (0051); não criar migration ativa nem editar journal
- [x] Preparar recuperação seletiva byte-exata de 0045–0050, snapshots e journal com manifesto
- [ ] Preservar UI do Mac sem recriar o design; integração visual aguarda arquivos locais, indisponíveis aqui

## Liberação dos 74 e parada antecipada — 08/11 07:16 UTC
- [x] Liberar os 74 com snapshot e CAS (execução 16571d52): 74 recuperados; 22 restantes intocados
- [x] Causa do custo: ~10,4 chamadas/produto (todas as fotos + principal testada em várias) e ~0,013/chamada por tokens de raciocínio
- [x] Rodar 388 candidatos C7Drop com parada antecipada (teste db641f3f + execução 84ff7d12): 188 liberados, 181 sem principal, 17 inconclusivos, 2 abaixo de 3; 820 chamadas, acumulado 33,51 de 45
- [x] Relatório em até 10 linhas; 1 candidato novo surgiu depois do início e não foi analisado

## Consolidação sem nova análise — 08/11 07:07 UTC
- [x] Consolidar os 100: 74 candidatos, 9 sem principal elegível, 13 inconclusivos sem principal e 4 abaixo de três aprovadas; sem IA/desbloqueios
- [x] Entregar até dez linhas com dez fotos aprovadas distintas e cinco reprovadas com motivo; custo acumulado estimado 23,150046 créditos (9,687429 histórico + 13,462617 acumulador novo, sem somar repetidamente acumuladores por foto)
- [x] Diagnóstico ML pulado: nenhum endpoint em lote sem anúncio previamente estabelecido; viabilidade não confirmada, sem investigação adicional

## Registro persistente e lote sem desbloqueio — 08/11 06:31 UTC
- [x] Criar e confirmar tabela permanente; resultados arquivados e históricos importados
- [x] Aprovações atuais do lote usam respostas vision_no_retry, não aprovação automática por código
- [x] Primeiro lote de 100 registrado: 1048 avaliações finais por papel (750 aprovadas, 250 reprovadas, 48 inconclusivas), reservas excluídas; sem desbloqueios
- [x] Relatório curto consolidado; diagnóstico pulado sem endpoint conhecido, orçamento acumulado estimado abaixo de 60

## Dois níveis e conclusão dry-run — 08/11 04:39 UTC
- [x] Aplicar principal estrita 500x500 e secundárias permissivas com códigos persistidos por função; duas funções publicadas
- [x] Reclassificar 112 recuperadas: 40 reprovações viram aprovação só por código; 60 chamadas ambíguas sem retry, 0,922857 estimados; final 89/19/4
- [ ] Recuperar 291 respostas e manifesto original dos 100 (73/27): artefatos não disponíveis; não repetir os 73 nem escolher outro lote
- [x] Entregar relatório curto e CSV com 10 aprovadas de produtos distintos / 5 reprovadas; zero desbloqueios
- [x] Reordenação testada, 27 testes e Deno check passaram; ml-publish OPTIONS 200 confirmou two-level-v4; audit OPTIONS 200; nenhum anúncio real

## Parser urgente e primeiro lote autorizado — 08/11 01:17 UTC
- [x] Aceitar cerca JSON completa mantendo esquema estrito; 22 testes passaram; duas funções publicadas
- [x] Reprocessar 112 respostas sem IA: 4 aprovadas, 107 reprovadas, 1 inconclusiva
- [x] JSON puro real confirmado; auditoria dry-run aprovou fotos, ml-publish validate_only validou fotos sem anúncio (conta ML recusou elegibilidade)
- [ ] Selecionar primeiro lote 100 C7Drop legado com estoque e checar restrições
- [ ] Reanalisar sem retry, parar ao ter principal e 3 aprovadas, respeitar 60 créditos/5.000 chamadas
- [ ] Aplicar desbloqueios: suspenso pela instrução 04:39 UTC; apenas relatório dry-run autorizado

## Ajustes aprovados e reanálise restrita — 08/11 00:58 UTC
- [x] Critério banner/colagem/inserção/medidas e principal estrita, esquema português validado sem regex de motivo; publicado 3.6 preservado e JSON mode adicionado após falha de formato
- [x] Reanalisar só 101 rejeitadas e 7 casos nos dois modelos: 112 chamadas, 1,374057 estimados, 101 rejeitadas inconclusivas no esquema estrito; 110 retornos Markdown, sem retries/escritas
- [x] Entregar relatório/CSV com 101 transições para inconclusivo por formato e 7 pares; não há 10 aprovadas válidas (bruto tem só 2 aceites)
- [x] Explicar nota/filtros e propostas no relatório sem aplicar Etapa 4; hash URLs/fila aplicado em migration0047, sem worker/bloqueio
- [x] Consultar saldo/limites: 130,60 créditos na última leitura, nenhum limite; 20 natalinos preservados, 19 sem atualização posterior
- [ ] Reanálise válida em JSON mode depende de nova autorização; sem repetir chamadas automaticamente
- [ ] Indicador/alerta admin depende de baseline 24h ainda não coletado; limiar aprovado apenas +10pp, percentual atual numérico
- [ ] Teste isolado reversível da fila sem tocar produtos reais ainda não exercitado

## Plano ampliado de recuperação — somente leitura nesta rodada
- [x] Reunir respostas brutas das três divergências e quatro diferenças de interpretação e fotos principais no relatório
- [x] Medir catálogo inteiro por fornecedor, motivos e filtros; propor critério, reanálise de galeria, fila, indicador e lotes sem executar
- [x] Conferir estado dos 20: zero perdeu desbloqueio, galeria igual; apenas kit 5 cm atualizado depois, 19 aguardam fornecedor
- [x] Preparar plano para aprovação; nenhuma mudança em parser, importadores, modelo, regras ou anúncios

## Execução por etapas do plano ampliado aprovado
- [x] Etapa 1: critério físico/embalagem versus overlay e interpretação estruturada versionada implementados localmente; 26 testes simulados passaram, sem IA real ou alteração de produtos
- [x] Publicar critério Etapa 1 após aprovação específica 00:58; modelo permanece 3.6, só ml-publish/ml-catalog-vision-audit publicadas
- [x] Etapa 2 simplificada: hash URLs/fila aplicado, sem mexer importadores/bloqueios; sem conteúdo de imagem
- [ ] Etapa 4: propostas entregues, aplicação aguarda aprovação específica; indicador admin/histórico ainda pendente
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
