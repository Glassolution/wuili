
-- 0. Função is_admin (SECURITY DEFINER, evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND is_admin = true
  );
$$;

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. catalog_products
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS aliexpress_category_id text,
  ADD COLUMN IF NOT EXISTS in_top_50 boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_source_external_id_key
  ON public.catalog_products (source, external_id);

CREATE INDEX IF NOT EXISTS catalog_products_aliexpress_category_idx
  ON public.catalog_products (aliexpress_category_id)
  WHERE aliexpress_category_id IS NOT NULL;

-- 3. category_mapping
CREATE TABLE IF NOT EXISTS public.category_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  velo_category text NOT NULL,
  aliexpress_category_id text NOT NULL,
  aliexpress_category_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (velo_category, aliexpress_category_id)
);

GRANT SELECT ON public.category_mapping TO authenticated;
GRANT ALL ON public.category_mapping TO service_role;

ALTER TABLE public.category_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read active mappings"
  ON public.category_mapping FOR SELECT TO authenticated
  USING (active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins insert mappings"
  ON public.category_mapping FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update mappings"
  ON public.category_mapping FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete mappings"
  ON public.category_mapping FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_category_mapping_updated_at
  BEFORE UPDATE ON public.category_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. aliexpress_sync_log
CREATE TABLE IF NOT EXISTS public.aliexpress_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running',
  triggered_by text NOT NULL DEFAULT 'cron',
  categories_processed integer NOT NULL DEFAULT 0,
  products_new integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  products_dropped_from_top integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.aliexpress_sync_log TO authenticated;
GRANT ALL ON public.aliexpress_sync_log TO service_role;

ALTER TABLE public.aliexpress_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sync log"
  ON public.aliexpress_sync_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS aliexpress_sync_log_started_at_idx
  ON public.aliexpress_sync_log (started_at DESC);
