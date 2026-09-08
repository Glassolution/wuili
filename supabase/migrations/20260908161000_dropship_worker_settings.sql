CREATE TABLE IF NOT EXISTS public.dropship_worker_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  audience text NOT NULL DEFAULT 'geral' CHECK (audience IN ('geral', 'admin')),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dropship_worker_settings (id, enabled, audience)
VALUES (true, true, 'geral')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.dropship_worker_settings TO authenticated;
GRANT ALL ON public.dropship_worker_settings TO service_role;

ALTER TABLE public.dropship_worker_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados veem config do worker dropship" ON public.dropship_worker_settings;
CREATE POLICY "Usuarios autenticados veem config do worker dropship"
  ON public.dropship_worker_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins gerenciam config do worker dropship" ON public.dropship_worker_settings;
CREATE POLICY "Admins gerenciam config do worker dropship"
  ON public.dropship_worker_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
