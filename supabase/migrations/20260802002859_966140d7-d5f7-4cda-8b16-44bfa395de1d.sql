ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS validapay_charge_id text,
  ADD COLUMN IF NOT EXISTS validapay_subscription_id text,
  ADD COLUMN IF NOT EXISTS validapay_customer_id text;

CREATE INDEX IF NOT EXISTS subscriptions_validapay_charge_id_idx ON public.subscriptions (validapay_charge_id);
CREATE INDEX IF NOT EXISTS subscriptions_validapay_subscription_id_idx ON public.subscriptions (validapay_subscription_id);

CREATE TABLE IF NOT EXISTS public.validapay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  charge_id text,
  subscription_id text,
  payment_id text,
  status text,
  amount numeric,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.validapay_webhook_events TO service_role;
ALTER TABLE public.validapay_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_validapay_events" ON public.validapay_webhook_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS validapay_webhook_events_dedupe_idx
  ON public.validapay_webhook_events (event, coalesce(payment_id, charge_id, id::text));