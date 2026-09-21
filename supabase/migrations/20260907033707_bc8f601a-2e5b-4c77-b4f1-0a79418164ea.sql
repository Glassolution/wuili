CREATE TABLE public.dropship_worker_heartbeats (
  worker_id text PRIMARY KEY,
  status text NOT NULL,
  current_order_id uuid REFERENCES public.dropship_orders(id),
  current_order_number text,
  details jsonb NOT NULL DEFAULT '{}',
  seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dropship_worker_heartbeats TO authenticated;
GRANT ALL ON public.dropship_worker_heartbeats TO service_role;

ALTER TABLE public.dropship_worker_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read worker heartbeats"
ON public.dropship_worker_heartbeats
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TABLE public.dropship_worker_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.dropship_orders(id),
  order_number text,
  worker_id text,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  code text NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.dropship_worker_alerts TO authenticated;
GRANT ALL ON public.dropship_worker_alerts TO service_role;

ALTER TABLE public.dropship_worker_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read worker alerts"
ON public.dropship_worker_alerts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can resolve worker alerts"
ON public.dropship_worker_alerts
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));