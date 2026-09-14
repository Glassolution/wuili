CREATE TABLE public.job_locks (
  job TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  last_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_locks TO authenticated;
GRANT ALL ON public.job_locks TO service_role;

ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver os locks de rotinas"
ON public.job_locks FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_job_locks_updated_at
BEFORE UPDATE ON public.job_locks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();