CREATE OR REPLACE FUNCTION public.catalog_products_enforce_min_images()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  distinct_images integer := 0;
BEGIN
  IF NEW.images IS NOT NULL AND jsonb_typeof(NEW.images) = 'array' THEN
    SELECT count(DISTINCT x) INTO distinct_images
    FROM jsonb_array_elements_text(NEW.images) x
    WHERE x IS NOT NULL AND btrim(x) <> '';
  END IF;

  IF distinct_images < 3 THEN
    NEW.is_blocked := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_products_min_images ON public.catalog_products;
CREATE TRIGGER catalog_products_min_images
BEFORE INSERT OR UPDATE ON public.catalog_products
FOR EACH ROW EXECUTE FUNCTION public.catalog_products_enforce_min_images();

UPDATE public.catalog_products p
SET is_blocked = true, updated_at = now()
WHERE p.is_blocked = false
  AND COALESCE((
    SELECT count(DISTINCT x)
    FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END) x
    WHERE btrim(x) <> ''
  ), 0) < 3;