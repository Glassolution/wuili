
-- Tabela de solicitações de reembolso
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID,
  payment_id TEXT,
  reason TEXT NOT NULL,
  reason_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  refund_amount NUMERIC NOT NULL DEFAULT 0,
  provider_response JSONB,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own refund requests"
  ON public.refund_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own refund requests"
  ON public.refund_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages refund requests"
  ON public.refund_requests FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_refund_requests_user ON public.refund_requests(user_id, requested_at DESC);

-- Habilitar realtime para subscriptions (badge plano em tempo real)
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
