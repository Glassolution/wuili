# Recuperação permanente do catálogo — aprovação por etapas

## Escopo e situação atual
Recuperar produtos elegíveis do catálogo inteiro e impedir bloqueios por falha técnica, sem alterar anúncios existentes. Esta rodada foi somente leitura: nenhum lote executado, nenhuma regra, modelo, parser ou importador alterado.

- C7Drop: **935 ativos com estoque; 628 bloqueados; 307 disponíveis na grade comum**.
- AliExpress: **231 ativos com estoque; 29 bloqueados; 202 desbloqueados**, mas fonte continua restrita a admins e fora da grade comum.
- B2Drop: **zero registros**. CJ: legado inativo, não reintroduzir.
- Erro antigo nos bloqueados: C7Drop 571 (506 sem outra evidência detectável; 65 com outra), AliExpress 26 (26 sem outra). Não é possível provar causa exclusiva: os 657 bloqueados têm motivo histórico não documentado.
- Restrições/evidências sobrepostas: C7Drop 38 Anatel, 32 menos de três URLs, 5 celulares, 63 com alguma rejeição visual antiga; AliExpress 3 com rejeição visual antiga. Conteúdo proibido detectado: zero. Não tratar rejeição de uma foto como rejeição de todo produto.
- **20 natalinos continuam liberados, estoque positivo e galeria igual.** Só o kit de bolas de 5 cm foi atualizado após recuperação e preservou o desbloqueio. Os outros 19 aguardam atualização que realmente os inclua. Não iniciar lote seguinte antes dessa conferência, salvo autorização expressa.

Relatório entregue: respostas originais, filtros e fotos. Cascata: impressão na embalagem; tiara: sobreposição, marca-d’água e colagem. Sem nova inferência.

## Etapa 1 — aprovar o critério antes de aplicar
**Texto proposto para a análise visual:**

> Avalie a fotografia, distinguindo o objeto fotografado de elementos adicionados sobre a imagem. Texto, marca, especificações, etiquetas e rótulos fisicamente impressos ou fixados no produto ou em sua embalagem original NÃO são motivo de reprovação. Fotografias da embalagem original não são automaticamente imagens sem produto. Ilustrações e quadros impressos nessa embalagem não são automaticamente colagem da fotografia.
>
> Reprove somente quando houver evidência visual clara de texto, selo ou logo acrescentado SOBRE a fotografia (promoção, preço, telefone, marca-d’água, logo de loja ou anotação sobreposta), colagem digital de fotografias ou imagem que não apresente o produto nem sua embalagem original. Linhas de medida e números digitais sobrepostos são elementos adicionados; medidas impressas no próprio objeto ou embalagem não são.
>
> Se não conseguir baixar, abrir, ler ou distinguir com segurança a imagem, retorne INCONCLUSIVA. Download, formato, timeout, erro da IA ou resposta ilegível nunca são reprovação. Indique veredito, código de motivo, localização da evidência e uma breve justificativa. Nunca invente evidência.

Somente após aprovação: alinhar prompt, interpretação estruturada e testes. Evitar regex que decide pelo uso da palavra “texto”; ela causou as quatro diferenças entre respostas de igual decisão. Preservar tri-state e converter resposta inválida em inconclusiva.

**Liberação continua exigindo** três fotos distintas aprovadas, principal aprovada, estoque positivo e nenhuma restrição independente. Menos de três aprovadas fica fora da recuperação, com pendência; não confundir isso com reprovação visual nem remover produto já visível só por falha técnica.

## Etapa 2 — motivos e mudança da galeria
- Aproveitar `block_reasons` e trilha de auditoria existentes; não inventar motivos históricos. Separar visual, Anatel, proibido, URLs insuficientes e motivo legado desconhecido. Registrar evidência e versão do critério.
- Guardar assinatura da galeria, ordem/principal e identidade do conteúdo: URL reutilizada pode mudar de imagem.
- Galeria diferente invalida aprovação visual antiga e cria pendência; não limpa bloqueio/restrições automaticamente.
- Produto visualmente bloqueado volta à análise; só retirar o motivo visual após nova análise elegível e CAS. Produto já visível apenas inconclusivo permanece visível, salvo estoque ou restrição independente; publicação exige validação das imagens atuais.
- CAS compara **is_blocked e galeria**, não preço/estoque. Em transação, reler estoque, motivos e campos independentes atuais para manter elegibilidade. Atualizar só campos de recuperação; nunca restaurar preço/estoque sobre atualização do fornecedor.
- Snapshot antes/depois com evidência e versão; reversão usa CAS dos campos alterados.
- Alterações em importadores/gatilhos precisam de aprovação específica desta etapa e testes de concorrência. Não mudar a regra de três URLs.

## Etapa 3 — fila e visibilidade administrativa
- Propor **máximo de três tentativas totais por imagem/galeria/critério**, sem repetir chamadas de orçamento ambíguo; uma nova galeria só abre novo ciclo mediante registro e controle de gasto.
- Intervalos propostos: inicial autorizada; segunda após 24h; terceira após 72h da segunda. Permanecer manual/aguardando aprovação: nenhum worker ou retentativa automática está autorizado.
- Após limite: revisão necessária, nunca bloqueio. Falha individual não para lote; orçamento/segurança podem parar.
- Medir servidor, etapa (download, MIME/tamanho, chamada IA, interpretação, CAS), status, latência, modelo, consumo estimado/confirmado e motivo técnico.
- Indicador admin por fornecedor: ativos com estoque, visíveis para cliente, bloqueados por motivo (categorias sobrepostas), motivo desconhecido e inconclusivos em fila.
- Alerta proposto, a aprovar: bloqueados acima de **50%** dos ativos com estoque ou crescimento de **10 pontos percentuais em 24h**. Mostrar base/data e separar falha técnica de rejeição explícita. C7Drop está em 67,2% agora.

## Etapa 4 — filtros (correções separadas, não aplicadas)
- Natal: retirar categoria exclusiva do processo de recuperação, não da categoria do fornecedor. Kit em Mais vendidos foi pulado e já recuperado; 7 títulos natal/pisca/cascata/árvore visíveis têm outra categoria (busca ampla).
- Endpoint: oito categorias antigas mapeadas têm zero dos 307 visíveis; unificar com categorias reais. Grade dinâmica não usa esse mapa.
- Três URLs afetam 32 ativos com estoque; zero exclusão extra dos 307 atuais. Não mudar limite nem afirmar exigência universal oficial do ML baseada em comentário.
- Preço/título/fotos excluem zero adicionais. Fonte exclui 202 AliExpress deliberadamente.
- Nota sintética por ID: 4.5+ esconde **135/307**; propor retirar nota/filtro falsos, mediante aprovação.
- Faixas inclusivas sobrepõem 50/150: 162/110/37; corrigir limites mediante aprovação. Caminho de avaliação limitado a 1.200 pode truncar catálogo futuro.
- Busca/favoritos/Atlas dependem da seleção; descartes antes de importar não têm contagem histórica recuperável nesta base.

## Etapa 5 — equivalência e modelo (após critério aprovado)
1. Referência humana nas mesmas 100 fotos: embalagem/rótulo, overlay, colagem e falha técnica. Teste antigo não certifica novo critério.
2. Comparar 3.6 e **3.8 Flash**, 200 chamadas sem retry, teto proposto 3 créditos dentro do saldo global; execução exige aprovação.
3. ≥95% concordância humana e zero aceite indevido de overlay/colagem confirmados; medir inconclusivos/latência/custo e separar divergências brutas das de interpretação.
4. Tarifa anterior igual: 0,000003 entrada/token e 0,000015 saída/token. Teste antigo: estimados 1,645071 créditos. Revalidar tarifa/disponibilidade; custo novo não garantido.
5. Aprovar resultado antes da troca e expiração informada em 19/11. Versionar cache por modelo/critério. Não trocar agora.

## Etapa 6 — catálogo inteiro em lotes aprovados
- Primeiro encerrar monitoramento dos 19 natalinos ainda sem atualização posterior; depois analisar Natal pendente com novo critério. Parar para conferência como cliente comum.
- Depois C7Drop por estoque decrescente, lotes de aproximadamente **100 produtos**, com lista prévia de riscos. Gravador espião e reconhecimento facial REP-p excluídos; câmera disfarçada/vigilância e itens controlados aguardam decisão individual.
- Não tratar todos os 628 como elegíveis. Separar restrições independentes antes de gastar IA. AliExpress fica em diagnóstico separado, sem liberação para cliente; B2Drop reavaliar se passar a ter registros.
- Deduplicar análise de fotos idênticas dentro da versão aprovada; analisar principal primeiro, parar a elegibilidade ao obter três aprovadas, sem enviar fotos restantes não analisadas ao ML. Oferecer relatório parcial de galeria quando parar cedo.
- A cada lote: snapshots/CAS; relatório recuperados, rejeitados visualmente, inconclusivos, menos de três aprovadas, sem estoque, outros motivos, riscos excluídos e conflitos de galeria.
- Confirmar leitura pública/cliente e, após atualização real do fornecedor em cada ID liberado, comparar bloqueio, motivos, galeria e evidência. Se galeria mudou, não presumir perda indevida: revalidar. Pausar se desbloqueio for removido sem causa independente justificável.
- **Aprovação explícita para cada próximo lote**; nada roda após esta resposta sem nova execução autorizada.

## Orçamento e paradas
- Referências atuais: bloqueados C7Drop 4.821 URLs únicas; AliExpress 169. Limite superior por fonte: 4.990 chamadas numa passagem, ~44,30 créditos pela média antiga. Todos ativos com estoque: até 8.450 URLs, ~75,01 — **não cabe** em 60 créditos/5.000 chamadas.
- Pelo menos 496 chamadas históricas relacionadas (290 amostra + 200 equivalência + 6 publicadas); custo conhecido estimado 4,219515 créditos mais seis análises ainda não consolidadas. Não resetar orçamento nem deduzir que há 5.000 chamadas novas disponíveis.
- Antes de executar: reconciliar gastos/uso desconhecido e reservar saldo. Parar na primeira barreira: 15 créditos/1.250 chamadas, 30/2.500 e máximo 60/5.000 cumulativos; também após cada lote para conferência.
- Teste novo e tentativas futuras precisam caber no saldo ou de orçamento adicional aprovado. Timeout com cobrança desconhecida reserva custo e pausa; nunca repetir às cegas. Limite local não garante fatura: verificar limite financeiro disponível sem mudá-lo sem autorização.
- Sem orçamento adicional, tratar catálogo inteiro como objetivo por fases, não promessa de reanalisar todas as imagens numa rodada.

## Detalhes técnicos e verificação
Usar política compartilhada, evidência versionada, auditoria atômica e fila existente. Testar cada regra: embalagem, overlay/colagem, inconclusivo sem bloqueio/cache negativo, CAS/galeria, elegibilidade, orçamento e tentativas. Revisar policies/grants antes de migrations.
Não alterar clientes/assinaturas nem enviar anúncios de teste ao ML; validação interna não garante aceitação oficial.