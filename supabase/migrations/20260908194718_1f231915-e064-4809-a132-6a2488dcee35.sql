CREATE TABLE IF NOT EXISTS public.dropship_worker_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  audience text NOT NULL DEFAULT 'geral' CHECK (audience IN ('geral','admin')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.dropship_worker_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dropship_worker_settings TO authenticated;
GRANT ALL ON public.dropship_worker_settings TO service_role;

ALTER TABLE public.dropship_worker_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read worker settings"
  ON public.dropship_worker_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update worker settings"
  ON public.dropship_worker_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert worker settings"
  ON public.dropship_worker_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.dropship_worker_settings (id, enabled, audience)
VALUES (true, true, 'geral')
ON CONFLICT (id) DO NOTHING;