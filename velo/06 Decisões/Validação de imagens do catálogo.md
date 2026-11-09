---
data: 2026-11-08
atualizado: 2026-11-09
fontes: [AGENTS.md (main), drizzle 0046–0048]
---
# Validação de imagens do catálogo

**Decisão:**
- Evidência estruturada, versionada e por papel (principal/secundária), guardando códigos de aprovação e de rejeição; o campo de localização é só descritivo, nunca decide.
- Modelos de visão formam pipeline em que **todos precisam aprovar**; os modelos entram na versão/chave de cache.
- Falha técnica ou schema inválido **nunca bloqueia** nem gera cache negativo; dry-run não grava; recuperação de produtos só com aprovação.
- Publicação reserva até duas checagens por URL (galeria/principal). Principal explicitamente reprovada fica separada de falha técnica; ausência de principal não gera aviso de tentar em minutos. Diagnóstico por usuário/produto fica em `ml_publish_errors`, sem publicar foto não validada.
- Recuperação do catálogo: snapshot atômico/CAS; gatilho por hash das URLs da galeria só enfileira manualmente.
- Evidência fica em `catalog_image_analysis_results` (append-only), gravada antes de avançar o lote; arquivo temporário nunca é registro oficial.
**Por quê:** evitar bloquear produto bom por erro técnico ou por inferência por palavra, mantendo prova de cada decisão.
Ver [[Catálogo]], [[Tabelas - Catálogo]].

## 09/11 — Principal mais flexível + foto limpa como reserva
- A principal aceita o produto com os próprios acessórios ou em vários ângulos sobre fundo limpo.
- Sem principal aprovada, usa a primeira foto da galeria aprovada pelos dois modelos com código OK (sem texto, medida, inserção ou embalagem). Fotos só com texto/medida nunca viram principal.
