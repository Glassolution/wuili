ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text;

CREATE OR REPLACE FUNCTION public.rpc_admin_store_sales(p_status text DEFAULT NULL, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT o.id, o.created_at, o.product_title, o.product_image_url, o.quantity,
           o.unit_price, o.total, o.payment_status, o.payment_method,
           o.buyer_name, o.buyer_email, o.buyer_phone, o.shipping_address,
           o.user_id AS seller_user_id,
           pr.display_name AS seller_name,
           pr.email AS seller_email,
           pr.pix_key AS seller_pix_key,
           pr.pix_key_type AS seller_pix_key_type
    FROM public.store_orders o
    LEFT JOIN public.profiles pr ON pr.user_id = o.user_id
    WHERE p_status IS NULL OR p_status = '' OR p_status = 'all' OR o.payment_status = p_status
    ORDER BY o.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  ) t;

  RETURN jsonb_build_object('sales', v_rows);
END;
$$;