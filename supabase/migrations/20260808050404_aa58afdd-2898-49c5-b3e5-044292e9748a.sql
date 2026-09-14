UPDATE public.catalog_products
SET is_active = false
WHERE is_active = true
  AND COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(images)='array' THEN images ELSE '[]'::jsonb END), 0) < 3;