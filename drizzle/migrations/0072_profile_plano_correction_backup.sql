CREATE TABLE public.profile_plano_correction_backup (
  correction_id text NOT NULL,
  user_id uuid NOT NULL,
  plano_anterior text NOT NULL,
  profile_updated_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  applied_profile_updated_at timestamptz,
  PRIMARY KEY (correction_id, user_id)
);
GRANT SELECT ON public.profile_plano_correction_backup TO authenticated;
GRANT ALL ON public.profile_plano_correction_backup TO service_role;
ALTER TABLE public.profile_plano_correction_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_profile_plano_backup ON public.profile_plano_correction_backup FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
COMMENT ON TABLE public.profile_plano_correction_backup IS 'Original profile plan before authorized corrections; no FK so the audit survives account deletion. Restore only with compare-and-set against the applied profile timestamp.';