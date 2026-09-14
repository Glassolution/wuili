CREATE TABLE public.ml_webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  resource text,
  ml_user_id text,
  application_id text,
  source text NOT NULL DEFAULT 'v1',
  payload_raw jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT ALL ON public.ml_webhook_queue TO service_role;

ALTER TABLE public.ml_webhook_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_ml_webhook_queue"
ON public.ml_webhook_queue FOR ALL
USING (false) WITH CHECK (false);

CREATE INDEX idx_ml_webhook_queue_pending
  ON public.ml_webhook_queue (status, received_at)
  WHERE status = 'pending';

CREATE INDEX idx_ml_webhook_queue_resource
  ON public.ml_webhook_queue (resource, received_at DESC);