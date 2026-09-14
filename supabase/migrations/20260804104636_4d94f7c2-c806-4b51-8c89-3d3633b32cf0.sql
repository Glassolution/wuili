CREATE TABLE IF NOT EXISTS public.ml_api_cache (
  cache_key text PRIMARY KEY,
  body text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ml_api_cache_expires_idx ON public.ml_api_cache (expires_at);
GRANT ALL ON public.ml_api_cache TO service_role;
ALTER TABLE public.ml_api_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ml_api_circuit (
  id text PRIMARY KEY,
  failure_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz,
  open_until timestamptz,
  last_status integer,
  last_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ml_api_circuit TO service_role;
ALTER TABLE public.ml_api_circuit ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ml_api_circuit (id) VALUES ('mercadolivre') ON CONFLICT (id) DO NOTHING;