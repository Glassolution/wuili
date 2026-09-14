ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;
