---
data: 2026-11-08
atualizado: 2026-11-16
fontes: [AGENTS.md (main), drizzle 0046–0048]
---
# Validação de imagens do catálogo

**Decisão:**
- Evidência estruturada, versionada e por papel (principal/secundária), guardando códigos de aprovação e de rejeição; o campo de localização é só descritivo, nunca decide.
- Desde 14/11, somente Gemini 3.8 analisa fotos, sem segunda revisão GPT, por autorização de Felipe para reduzir consumo. Configuração compartilhada e cache versionado; falhas continuam inconclusivas. Reprovações explícitas históricas são preservadas.
- Falha técnica ou schema inválido **nunca bloqueia** nem gera cache negativo; dry-run não grava; recuperação de produtos só com aprovação.
- Publicação reserva até duas checagens por URL (galeria/principal). Principal explicitamente reprovada fica separada de falha técnica; ausência de principal não gera aviso de tentar em minutos. Diagnóstico por usuário/produto fica em `ml_publish_errors`, sem publicar foto não validada.
- Recuperação do catálogo: snapshot atômico/CAS; gatilho por hash das URLs da galeria só enfileira manualmente.
- Evidência fica em `catalog_image_analysis_results` (append-only), gravada antes de avançar o lote; arquivo temporário nunca é registro oficial.
**Por quê:** evitar bloquear produto bom por erro técnico ou por inferência por palavra, mantendo prova de cada decisão.
Ver [[Catálogo]], [[Tabelas - Catálogo]].

## 09/11 — Principal mais flexível + foto limpa como reserva
- A principal aceita o produto com os próprios acessórios ou em vários ângulos sobre fundo limpo.
- Sem principal aprovada, usa a primeira foto da galeria aprovada pelos dois modelos com código OK (sem texto, medida, inserção ou embalagem). Fotos só com texto/medida nunca viram principal.

## 11/11 — Reutilização na publicação
- Publicação aceita aprovação explícita dos dois modelos de qualquer revisão em dois níveis, mesma rodada/URL/papel; produção histórica estava no cache, não na tabela de análises, e também é reaproveitada.
- Três fotos aprovadas bastam: demais desconhecidas ficam de fora. Nova análise só dos papéis sem veredito; falha técnica enfileira sem alterar catálogo.
- Migrations 0051–0052 adicionam deduplicação, lease, pausa persistente e avisos transacionais. Créditos insuficientes confirmados; nenhuma publicação de teste criada.

## 16/11 — Sob demanda, cache global e reserva direta
- Crons `ml-catalog-vision-audit-1min`, `ml-compliance-worker-5min`, `ml-fix-noncompliant-5min` e `ml-catalog-image-filler-10min` pausados; auditoria manual responde que a análise em lote está desativada. As duas correções de anúncios também não fazem mais novas análises visuais fora de `ml-publish`.
- Publicação reutiliza todo veredito explícito por URL, sem escopo por cliente/produto e sem nova chamada para URL conhecida. Analisa todas as fotos novas; duas inconclusivas geram espera de 24h, e falta de crédito não conta tentativa.
- Não há teto/freio por gasto. `image_ai_daily_usage` registra custo estimado pela tarifa e notifica admins uma vez ao passar de 5 créditos/dia. Migrations 0058–0060.
- Somente Gemini 3.8 faz novas chamadas; Gemini direto com `GEMINI_API_KEY` é reserva quando Lovable fica sem créditos. Teste real encontrou 402 também no saldo pré-pago Google; fila preservada, sem anúncios ou catálogo alterados.
- Verificação ao vivo com as oito URLs de um produto já avaliado retornou cinco fotos aprovadas e `ai_calls=0`, em `validate_only/images_only`, sem criar anúncio. 61 testes passaram.
