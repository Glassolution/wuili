ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS duplicate_of_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS refund_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS charge_id text,
  ADD COLUMN IF NOT EXISTS keep_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automated boolean NOT NULL DEFAULT false;

ALTER TABLE public.validapay_webhook_events
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_exhausted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vp_events_retry
  ON public.validapay_webhook_events (next_retry_at)
  WHERE processed = false AND retry_exhausted = false;

CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_created
  ON public.subscriptions (created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.payment_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  user_id uuid,
  subscription_id uuid,
  related_subscription_id uuid,
  charge_id text,
  amount numeric,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.payment_incidents TO authenticated;
GRANT ALL ON public.payment_incidents TO service_role;

ALTER TABLE public.payment_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver ocorrencias de pagamento"
  ON public.payment_incidents FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem atualizar ocorrencias de pagamento"
  ON public.payment_incidents FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_payment_incidents_created ON public.payment_incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_incidents_kind ON public.payment_incidents (kind, created_at DESC);

CREATE TRIGGER trg_payment_incidents_updated_at
  BEFORE UPDATE ON public.payment_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();