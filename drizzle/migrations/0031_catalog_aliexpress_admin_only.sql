DROP POLICY IF EXISTS "Authenticated can read active catalog" ON public.catalog_products;

CREATE POLICY "Authenticated can read active catalog"
ON public.catalog_products
FOR SELECT
TO authenticated
USING (
  is_blocked = false
  AND (source <> 'aliexpress' OR public.is_admin(auth.uid()))
);