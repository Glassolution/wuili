CREATE OR REPLACE FUNCTION public.current_user_ml_seller_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT ui.ml_user_id::text), '{}'::text[])
  FROM public.user_integrations ui
  WHERE ui.user_id = auth.uid()
    AND ui.platform = 'mercadolivre'
    AND ui.ml_user_id IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.current_user_ml_seller_ids() TO authenticated;

DROP POLICY IF EXISTS "Sellers can view orders of their connected ML account" ON public.orders;
CREATE POLICY "Sellers can view orders of their connected ML account"
ON public.orders
FOR SELECT
TO authenticated
USING (
  ml_user_id IS NOT NULL
  AND ml_user_id = ANY (public.current_user_ml_seller_ids())
);