
-- Restrict sensitive columns from broad authenticated access
-- suppliers.api_config, supplier_products.raw_data, catalog_products.supplier_contact

-- suppliers: revoke column-level SELECT on api_config from authenticated/anon
REVOKE SELECT ON public.suppliers FROM authenticated;
REVOKE SELECT ON public.suppliers FROM anon;
GRANT SELECT (id, name, type, is_active, logo_url, created_at, updated_at) ON public.suppliers TO authenticated;

-- supplier_products: revoke and re-grant excluding raw_data
REVOKE SELECT ON public.supplier_products FROM authenticated;
REVOKE SELECT ON public.supplier_products FROM anon;
GRANT SELECT (id, product_id, supplier_id, external_id, cost_price, shipping_cost, shipping_days, stock_status, rating, created_at, updated_at) ON public.supplier_products TO authenticated;

-- catalog_products: revoke and re-grant excluding supplier_contact
REVOKE SELECT ON public.catalog_products FROM authenticated;
REVOKE SELECT ON public.catalog_products FROM anon;
GRANT SELECT (
  id, source, external_id, title, description, images, cost_price, suggested_price,
  margin_percent, category, supplier_name, stock_quantity, is_active, created_at, updated_at,
  weight, variants, rating, orders_count, original_price, product_url, is_blocked, scraped_at,
  brand, model, aliexpress_category_id, in_top_50, reviews_count
) ON public.catalog_products TO authenticated;

-- Ensure service_role retains full access
GRANT ALL ON public.suppliers TO service_role;
GRANT ALL ON public.supplier_products TO service_role;
GRANT ALL ON public.catalog_products TO service_role;
