CREATE TABLE public.utmify_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  utmify_status text NOT NULL CHECK (utmify_status IN (
    'waiting_payment', 'paid', 'refused', 'refunded', 'chargedback'
  )),
  trigger_source text NOT NULL CHECK (trigger_source IN (
    'webhook_first_purchase', 'webhook_renewal', 'refund', 'backfill', 'manual_test'
  )),
  is_test boolean NOT NULL DEFAULT false,
  payment_method text CHECK (payment_method IN ('pix', 'credit_card')),
  total_cents integer,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  http_status integer,
  ok boolean NOT NULL DEFAULT false,
  result text CHECK (result IN (
    'sent', 'failed', 'skipped_disabled', 'skipped_duplicate', 'skipped_too_old'
  )),
  error text CHECK (char_length(error) <= 500),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON TABLE public.utmify_order_events TO service_role;
REVOKE ALL ON TABLE public.utmify_order_events FROM PUBLIC, anon, authenticated;

ALTER TABLE public.utmify_order_events ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX utmify_order_events_real_success_uidx
  ON public.utmify_order_events (order_id, utmify_status)
  WHERE ok AND NOT is_test;

CREATE INDEX utmify_order_events_subscription_created_idx
  ON public.utmify_order_events (subscription_id, created_at);