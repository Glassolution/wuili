
CREATE OR REPLACE FUNCTION public.get_aliexpress_cron_status()
RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  RETURN QUERY
    SELECT j.jobid, j.jobname, j.schedule, j.active
    FROM cron.job j
    WHERE j.jobname = 'aliexpress-sync-every-6h';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_aliexpress_cron_active(p_active boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'aliexpress-sync-every-6h';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'cron_job_not_found';
  END IF;
  PERFORM cron.alter_job(job_id := v_id, active := p_active);
  RETURN p_active;
END;
$$;

REVOKE ALL ON FUNCTION public.get_aliexpress_cron_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_aliexpress_cron_active(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_aliexpress_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_aliexpress_cron_active(boolean) TO authenticated;
