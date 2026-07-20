ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_real_mp_payment_id_unique
  ON public.subscriptions (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL
    AND mp_payment_id ~ '^[0-9]+$';