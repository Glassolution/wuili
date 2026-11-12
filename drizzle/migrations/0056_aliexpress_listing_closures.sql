CREATE TABLE public.aliexpress_listing_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ml_item_id text NOT NULL,
  catalog_product_id text,
  previous_status text,
  result text NOT NULL,
  ml_http_status integer,
  ml_response text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.aliexpress_listing_closures IS 'Append-only log of admin-ordered closures of Mercado Livre listings for AliExpress catalog products.';
CREATE INDEX aliexpress_listing_closures_pub_idx ON public.aliexpress_listing_closures (publication_id, created_at DESC);
GRANT SELECT ON public.aliexpress_listing_closures TO authenticated;
GRANT ALL ON public.aliexpress_listing_closures TO service_role;
ALTER TABLE public.aliexpress_listing_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view aliexpress listing closures"
  ON public.aliexpress_listing_closures FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));