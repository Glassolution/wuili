CREATE TABLE IF NOT EXISTS public.catalog_products_aliexpress_archive (
  archived_at timestamptz NOT NULL DEFAULT now(),
  product_id uuid PRIMARY KEY,
  row_data jsonb NOT NULL,
  linked_order_ids uuid[] NOT NULL DEFAULT '{}'
);
GRANT ALL ON public.catalog_products_aliexpress_archive TO service_role;
GRANT SELECT ON public.catalog_products_aliexpress_archive TO authenticated;
ALTER TABLE public.catalog_products_aliexpress_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read aliexpress archive" ON public.catalog_products_aliexpress_archive
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

INSERT INTO public.catalog_products_aliexpress_archive (product_id, row_data, linked_order_ids)
SELECT c.id, to_jsonb(c), COALESCE((SELECT array_agg(o.id) FROM public.orders o WHERE o.catalog_product_id = c.id), '{}')
FROM public.catalog_products c WHERE c.source = 'aliexpress'
ON CONFLICT (product_id) DO NOTHING;

DELETE FROM public.catalog_products WHERE source = 'aliexpress';

CREATE OR REPLACE FUNCTION public.catalog_products_block_aliexpress()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source = 'aliexpress' THEN
    RAISE EXCEPTION 'Produtos AliExpress foram removidos do catálogo Velo';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_catalog_products_block_aliexpress ON public.catalog_products;
CREATE TRIGGER trg_catalog_products_block_aliexpress
  BEFORE INSERT OR UPDATE OF source ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.catalog_products_block_aliexpress();