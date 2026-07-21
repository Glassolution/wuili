# Correção da categorização ML para publicação

## Contexto verificado

- **Schema real de `catalog_products`** (checado agora): não existe coluna `metadata`. Colunas existentes de categoria: `category` (texto humano), `aliexpress_category_id` (texto do AliExpress). Migração dedicada é obrigatória.
- **`category_predictor/predict`**: retorna 404 mesmo com Bearer válido de vendedor. Descontinuado. Remover.
- **Normalização não é bala de prata**: rodei contra 20 títulos AliExpress reais (categorias variadas). Resultado bruto:
  - 6 casos onde só o título normalizado devolveu resultado (o cru truncado em 60 chars devolveu vazio).
  - 7 casos com match idêntico entre cru e normalizado.
  - 7 casos onde a normalização **regrediu** (ex: "gargantilha com pingente" → cru retornou Colares, normalizado retornou Pingentes; "moda multicolorido tênis pulseira" → cru vazio, normalizado retornou Delineador). A normalização às vezes descarta a palavra-âncora certa.
  - Conclusão: precisa ser **estratégia de duas consultas**, não substituição. Cada tentativa é uma chamada barata à API pública.
- **Check dinâmico de SIZE_GRID_ID**: viável via `GET /categories/{id}/attributes`, mas API tem rate-limit agressivo. Precisa de cache.

## O que vai ser feito

### 1. Migração de schema

Adicionar em `catalog_products`:
- `ml_category_id text` — ID da categoria ML confirmada (predita ou escolhida manualmente).
- `ml_category_status text` com CHECK em (`pending`, `auto`, `needs_manual`, `manual`) default `pending`. Persistente, consultável, indexável.
- `ml_size_grid_id text` — grade de tamanho quando fashion.
- Índice em `(ml_category_status)` para filtro/painel futuro de "pendentes".

Sem colunas em JSON. Sem `metadata`. Padrão coerente com o resto da tabela.

### 2. Edge Function `ml-publish/index.ts`

- **Remover** a chamada a `category_predictor/predict` inteira.
- **Novo `predictCategory(title)`** com estratégia de duas tentativas + cache de atributos:
  1. Consulta `domain_discovery/search` com título truncado em 60 chars (comportamento atual).
  2. Se retornar vazio OU cair em categoria com `SIZE_GRID_ID` obrigatório, consulta novamente com título normalizado (regex removendo faixas `\d+[-–/]\d+`, tokens numéricos soltos, unidades, stopwords PT-BR de marketing) e compara.
  3. Escolhe a categoria não-vazia. Se as duas divergem em categoria-folha, prioriza a com menos atributos obrigatórios ou a que **não** exige grade de tamanho.
- **Check de SIZE_GRID_ID dinâmico**: função `requiresSizeGrid(categoryId)` que consulta `GET /categories/{id}/attributes` e olha `tags.required` no atributo `SIZE_GRID_ID`. Cachear em memória (module-level `Map`) por `categoryId` durante o lifetime da instância. Não é allowlist hardcoded — usa a verdade da própria API.
- **Fluxo de decisão** na publicação:
  - Se payload traz `override_category_id` → validar folha via `GET /categories/{id}` (`children_categories == []`), usar direto. Se for fashion, exigir `size_grid_id` também no payload.
  - Sem override + predição limpa (não-fashion, ou fashion **com** `size_grid_id` já no payload) → publica, grava `ml_category_status = 'auto'` e `ml_category_id`.
  - Sem override + fashion sem grade → **não publica**. Grava `ml_category_status = 'needs_manual'` e `ml_category_id = <predicted>` como sugestão. Retorna 409 com body `{ code: 'CATEGORY_REQUIRES_MANUAL', predicted_category_id, predicted_category_name }`.
- **Logging estruturado por 30 dias após deploy**: logar `{ product_id, title_raw, title_normalized, predicted_raw, predicted_normalized, final_category, status, requires_size_grid }` para permitir análise de acerto e ajuste da lista de stopwords.

### 3. Frontend

**`src/components/dashboard/ImportProductModal.tsx`**
- Novo `<CategorySelector />` — autocomplete que chama `GET /sites/MLB/domain_discovery/search?q=…` direto do browser (endpoint público sem auth necessária), com debounce 300ms.
- Ao clicar "Publicar":
  - Se `catalog_products.ml_category_status == 'manual'` → envia `override_category_id` no payload direto.
  - Caso contrário, publica normalmente e trata 409 `CATEGORY_REQUIRES_MANUAL` abrindo o seletor com a sugestão pré-preenchida. Ao confirmar, faz retry.
- Se a categoria escolhida requer grade, mostrar `<SizeGridSelector />` que carrega `GET /categories/{id}/size_grids?attributes=SIZE_GRID_ID`. Salvar em `ml_size_grid_id`.

**Novo painel `Produtos pendentes de categoria`** (rota `/admin/produtos-pendentes` ou seção em Catálogo): lista `WHERE ml_category_status = 'needs_manual'`. Não bloqueia essa fase — só preparar a query e um link no menu.

### 4. Telemetria pós-deploy

- Nova view SQL `v_ml_category_predictions_last_30d` agregando os logs por (categoria prevista, status) para consulta rápida.
- Depois de 1 semana rodando, revisar amostra ~50 produtos e ajustar stopwords.

## Detalhes técnicos

**Normalização (`normalizeTitleForPrediction`)**

```
lowercase → remover unidades (mm|cm|m|ml|l|g|kg|mah|w|v|hz|gb|mb|tb|pcs|pçs)
→ remover faixas \d+[-–—/]\d+
→ remover números soltos → remover pontuação
→ tokenizar → filtrar stopwords → tokens[:6] → join
```

Stopwords iniciais: `nova novo moda grande premium luxo vintage sexy elegante casual chic requintado estilo estiloso bonito lindo fofo simples super mega ultra melhor perfeito diy artesanal 2020..2026 verão inverno primavera outono nova novidade tendência oferta promoção kit set`. A lista **vai ficar incompleta** — por isso a estratégia de fallback duplo é obrigatória e o log serve para calibrar depois.

**Cache de atributos**

```
const attrCache = new Map<string, { requiresGrid: boolean; isLeaf: boolean; ts: number }>()
// TTL 6h; invalida na inicialização de nova instância — bom o suficiente
```

**Contrato do payload `ml-publish`**

```json
{
  "product_id": "...",
  "override_category_id": "MLB424841",   // opcional
  "size_grid_id": "12345",               // opcional, exigido se override é fashion
  ...resto do payload atual
}
```

**Response 409 novo**

```json
{
  "code": "CATEGORY_REQUIRES_MANUAL",
  "predicted_category_id": "MLB424841",
  "predicted_category_name": "Calças",
  "requires_size_grid": true
}
```

## O que NÃO vai ser feito

- Sem allowlist hardcoded de domínios fashion — check dinâmico via API + cache.
- Sem coluna JSON `metadata`. Colunas dedicadas.
- Sem fila assíncrona nesta fase — só o status persistente, que a fila usará depois quando o import em lote existir.
- Sem alteração no scraper C7Drop nem em outras funções.

## Ordem de execução

1. Migração SQL (colunas + índice).
2. `ml-publish/index.ts` reescrita da predição + fluxo 409 + logging.
3. `ImportProductModal.tsx` — seletor de categoria + tratamento de 409 + seletor de grade.
4. View `v_ml_category_predictions_last_30d`.
5. Testar publicação com 3 produtos AliExpress reais cobrindo: eletrônico (auto), fashion sem grade (409 → manual), fashion com override + grade (auto após seleção).
