ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS customer_document text,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_detail text,
  ADD COLUMN IF NOT EXISTS support_ticket_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ml_price_update_status text,
  ADD COLUMN IF NOT EXISTS ml_price_update_error text,
  ADD COLUMN IF NOT EXISTS ml_price_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_gerado_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_retry_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_retry_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS c7drop_cart_ref text,
  ADD COLUMN IF NOT EXISTS c7drop_order_ref text,
  ADD COLUMN IF NOT EXISTS c7drop_shipping_method text,
  ADD COLUMN IF NOT EXISTS c7drop_payment_method text,
  ADD COLUMN IF NOT EXISTS c7drop_order_status_text text,
  ADD COLUMN IF NOT EXISTS frete_real numeric(12,2),
  ADD COLUMN IF NOT EXISTS preco_produto numeric(12,2),
  ADD COLUMN IF NOT EXISTS reservado_at timestamptz,
  ADD COLUMN IF NOT EXISTS c7drop_checkout_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fornecedor_finalizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS etiqueta_ml_anexada_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz,
  ADD COLUMN IF NOT EXISTS c7drop_pix_copy_paste text,
  ADD COLUMN IF NOT EXISTS c7drop_pix_key text,
  ADD COLUMN IF NOT EXISTS c7drop_pix_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS c7drop_pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS c7drop_pix_renewal_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS dropship_orders_support_ticket_required_idx
  ON public.dropship_orders (support_ticket_required)
  WHERE support_ticket_required = true;

CREATE INDEX IF NOT EXISTS dropship_orders_ml_price_update_status_idx
  ON public.dropship_orders (ml_price_update_status)
  WHERE ml_price_update_status IS NOT NULL;

NOTIFY pgrst, 'reload schema';