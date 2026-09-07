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
  ADD COLUMN IF NOT EXISTS cancelado_at timestamptz;

CREATE INDEX IF NOT EXISTS dropship_orders_support_ticket_required_idx
  ON public.dropship_orders (support_ticket_required)
  WHERE support_ticket_required = true;

CREATE INDEX IF NOT EXISTS dropship_orders_ml_price_update_status_idx
  ON public.dropship_orders (ml_price_update_status)
  WHERE ml_price_update_status IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dropship_worker_heartbeats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unknown',
  current_order_id uuid REFERENCES public.dropship_orders(id) ON DELETE SET NULL,
  current_order_number text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dropship_worker_heartbeats_last_seen_idx
  ON public.dropship_worker_heartbeats (last_seen_at DESC);

GRANT SELECT ON public.dropship_worker_heartbeats TO authenticated;
GRANT ALL ON public.dropship_worker_heartbeats TO service_role;

ALTER TABLE public.dropship_worker_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem heartbeats do worker dropship" ON public.dropship_worker_heartbeats;
CREATE POLICY "Admins veem heartbeats do worker dropship"
  ON public.dropship_worker_heartbeats FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.dropship_worker_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id text,
  order_id uuid REFERENCES public.dropship_orders(id) ON DELETE SET NULL,
  order_number text,
  severity text NOT NULL DEFAULT 'warning',
  code text,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dropship_worker_alerts_open_idx
  ON public.dropship_worker_alerts (created_at DESC)
  WHERE resolved_at IS NULL;

GRANT SELECT, UPDATE ON public.dropship_worker_alerts TO authenticated;
GRANT ALL ON public.dropship_worker_alerts TO service_role;

ALTER TABLE public.dropship_worker_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem alertas do worker dropship" ON public.dropship_worker_alerts;
CREATE POLICY "Admins veem alertas do worker dropship"
  ON public.dropship_worker_alerts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins resolvem alertas do worker dropship" ON public.dropship_worker_alerts;
CREATE POLICY "Admins resolvem alertas do worker dropship"
  ON public.dropship_worker_alerts FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.dropship_worker_commands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('start', 'stop')),
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);

CREATE INDEX IF NOT EXISTS dropship_worker_commands_status_idx
  ON public.dropship_worker_commands (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.dropship_worker_commands TO authenticated;
GRANT ALL ON public.dropship_worker_commands TO service_role;

ALTER TABLE public.dropship_worker_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam comandos do worker dropship" ON public.dropship_worker_commands;
CREATE POLICY "Admins gerenciam comandos do worker dropship"
  ON public.dropship_worker_commands FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.stale_dropship_worker_heartbeats()
RETURNS TABLE(worker_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.worker_id
  FROM public.dropship_worker_heartbeats h
  WHERE public.is_admin(auth.uid())
    AND h.last_seen_at < now() - interval '2 minutes';
$$;

GRANT EXECUTE ON FUNCTION public.stale_dropship_worker_heartbeats() TO authenticated;
