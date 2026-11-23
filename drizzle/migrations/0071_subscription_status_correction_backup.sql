CREATE TABLE public.subscription_status_correction_backup (
  correction_id text NOT NULL,
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz,
  atualizado_em timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  target_status text NOT NULL,
  batch_number integer NOT NULL,
  provider_status text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  applied_status text,
  PRIMARY KEY (correction_id, id)
);
GRANT SELECT ON public.subscription_status_correction_backup TO authenticated;
GRANT ALL ON public.subscription_status_correction_backup TO service_role;
ALTER TABLE public.subscription_status_correction_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_subscription_status_backup ON public.subscription_status_correction_backup FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
COMMENT ON TABLE public.subscription_status_correction_backup IS 'Reversible subscription status corrections; original status, period end and updated_at must be saved before mutation. No FK so audit survives account deletion.';