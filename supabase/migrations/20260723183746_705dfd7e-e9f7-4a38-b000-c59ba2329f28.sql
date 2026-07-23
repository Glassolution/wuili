
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Marca como bloqueados os produtos AliExpress que não têm o mínimo para publicar no Mercado Livre.
-- Critérios: precisa ter >=3 imagens, estoque > 0, título >= 20 chars, e categoria mapeável
-- (exclui 'moda' que exige SIZE_GRID_ID e 'outros'/vazio que caem em categorias imprevisíveis).
UPDATE public.catalog_products
SET is_blocked = true, is_active = false, updated_at = now()
WHERE source = 'aliexpress'
  AND NOT (
    jsonb_array_length(COALESCE(images,'[]'::jsonb)) >= 3
    AND COALESCE(stock_quantity,0) > 0
    AND char_length(COALESCE(title,'')) >= 20
    AND lower(unaccent(COALESCE(category,''))) IN (
      'eletronicos','casa','automotivo','beleza','pet',
      'esporte e fitness','saude e bem-estar','decoracao',
      'bebe e infantil','bijuterias'
    )
  );

-- Garante que os que passam nos critérios estão desbloqueados
UPDATE public.catalog_products
SET is_blocked = false, is_active = true, updated_at = now()
WHERE source = 'aliexpress'
  AND jsonb_array_length(COALESCE(images,'[]'::jsonb)) >= 3
  AND COALESCE(stock_quantity,0) > 0
  AND char_length(COALESCE(title,'')) >= 20
  AND lower(unaccent(COALESCE(category,''))) IN (
    'eletronicos','casa','automotivo','beleza','pet',
    'esporte e fitness','saude e bem-estar','decoracao',
    'bebe e infantil','bijuterias'
  );
