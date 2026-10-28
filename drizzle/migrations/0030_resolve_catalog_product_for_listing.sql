CREATE OR REPLACE FUNCTION public.resolve_catalog_product_for_listing(p_title text, p_thumbnail text)
RETURNS TABLE(id uuid, external_id text, product_url text, title text, stock_quantity integer, is_active boolean, match_kind text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text := lower(btrim(coalesce(p_title, '')));
  v_thumb text := btrim(coalesce(p_thumbnail, ''));
  v_ids uuid[];
BEGIN
  -- 1) Título idêntico (único)
  IF length(v_title) >= 8 THEN
    SELECT array_agg(c.id) INTO v_ids FROM catalog_products c WHERE lower(btrim(c.title)) = v_title;
    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
      RETURN QUERY SELECT c.id, c.external_id, c.product_url, c.title, c.stock_quantity::integer, c.is_active, 'title'::text
        FROM catalog_products c WHERE c.id = v_ids[1];
      RETURN;
    END IF;
  END IF;

  -- 2) Primeira foto do anúncio presente nas fotos do produto (única)
  IF length(v_thumb) >= 15 THEN
    SELECT array_agg(c.id) INTO v_ids FROM catalog_products c WHERE c.images::text LIKE '%' || v_thumb || '%';
    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
      RETURN QUERY SELECT c.id, c.external_id, c.product_url, c.title, c.stock_quantity::integer, c.is_active, 'image'::text
        FROM catalog_products c WHERE c.id = v_ids[1];
      RETURN;
    END IF;
  END IF;

  -- 3) Título do anúncio é o começo do título do produto (títulos cortados em 60 caracteres)
  IF length(v_title) >= 25 THEN
    SELECT array_agg(c.id) INTO v_ids FROM catalog_products c WHERE lower(btrim(c.title)) LIKE v_title || '%';
    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
      RETURN QUERY SELECT c.id, c.external_id, c.product_url, c.title, c.stock_quantity::integer, c.is_active, 'title_prefix'::text
        FROM catalog_products c WHERE c.id = v_ids[1];
      RETURN;
    END IF;
  END IF;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_catalog_product_for_listing(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_catalog_product_for_listing(text, text) TO service_role;