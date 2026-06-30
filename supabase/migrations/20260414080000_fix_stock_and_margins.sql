-- Fix 1: Atualiza stock_quantity de 0 para 999 em todos os produtos ativos C7Drop
UPDATE public.catalog_products
SET stock_quantity = 999
WHERE source = 'c7drop'
  AND is_active = true
  AND (stock_quantity IS NULL OR stock_quantity = 0);

-- Fix 2: Recalcula suggested_price usando multiplier por faixa de custo
UPDATE public.catalog_products
SET suggested_price = ROUND(
  cost_price * CASE
    WHEN cost_price < 20  THEN 3.0
    WHEN cost_price < 50  THEN 2.8
    WHEN cost_price < 100 THEN 2.5
    WHEN cost_price < 300 THEN 2.2
    ELSE 2.0
  END,
  2
)
WHERE source = 'c7drop'
  AND is_active = true;

-- Fix 3: Recalcula margin_percent com base no novo suggested_price
UPDATE public.catalog_products
SET margin_percent = CASE
  WHEN suggested_price > 0
  THEN ROUND(((suggested_price - cost_price) / suggested_price) * 100, 2)
  ELSE 0
END
WHERE source = 'c7drop'
  AND is_active = true;
