ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS origin_provider text,
  ADD COLUMN IF NOT EXISTS origin_payment_id text,
  ADD COLUMN IF NOT EXISTS origin_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS refundable_until timestamptz,
  ADD COLUMN IF NOT EXISTS migrated_to_validapay_at timestamptz;

CREATE TABLE IF NOT EXISTS public.subscription_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  origin_provider text NOT NULL,
  origin_payment_id text,
  origin_subscription_id text,
  plan text NOT NULL,
  status text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  origin_paid_at timestamptz,
  current_period_end timestamptz,
  refundable boolean NOT NULL DEFAULT false,
  refundable_until timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id)
);

GRANT SELECT ON public.subscription_migrations TO authenticated;
GRANT ALL ON public.subscription_migrations TO service_role;

ALTER TABLE public.subscription_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver migracoes"
  ON public.subscription_migrations FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_subscription_migrations_updated_at
  BEFORE UPDATE ON public.subscription_migrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_subscription_migrations_origin
  ON public.subscription_migrations (origin_provider, status);