
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS mp_customer_id text,
  ADD COLUMN IF NOT EXISTS mp_card_id text,
  ADD COLUMN IF NOT EXISTS last_charge_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_dunning_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS charge_attempts int NOT NULL DEFAULT 0;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
