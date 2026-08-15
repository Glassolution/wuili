ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_conversions_payment_id_uidx
  ON public.affiliate_conversions (payment_id)
  WHERE payment_id IS NOT NULL;