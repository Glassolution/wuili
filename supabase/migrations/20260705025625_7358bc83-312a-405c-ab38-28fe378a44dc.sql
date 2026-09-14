ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_charge_amount numeric,
  ADD COLUMN IF NOT EXISTS next_charge_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_trial_plan text;