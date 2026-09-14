
CREATE OR REPLACE FUNCTION public.get_customer_orders(p_slug text, p_email text)
RETURNS TABLE(
  id uuid,
  product_title text,
  product_image_url text,
  quantity integer,
  unit_price numeric,
  total numeric,
  payment_status text,
  payment_method text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.product_title, o.product_image_url, o.quantity, o.unit_price, o.total,
         o.payment_status, o.payment_method, o.created_at
  FROM public.store_orders o
  JOIN public.user_projects p ON p.id = o.project_id
  WHERE lower(o.buyer_email) = lower(p_email)
    AND p.metadata->>'slug' = p_slug
    AND p.status = 'publicado'
  ORDER BY o.created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_orders(text, text) TO anon, authenticated;
