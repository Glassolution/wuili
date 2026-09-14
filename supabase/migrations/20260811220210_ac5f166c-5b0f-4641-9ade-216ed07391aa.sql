CREATE OR REPLACE FUNCTION public.close_stale_support_tickets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_count integer := 0;
BEGIN
  FOR v_ticket IN
    SELECT t.id, t.user_id
    FROM public.support_tickets t
    WHERE t.status = 'open'
      AND GREATEST(
            t.created_at,
            COALESCE((SELECT max(m.created_at) FROM public.support_messages m WHERE m.ticket_id = t.id), t.created_at)
          ) < now() - interval '48 hours'
  LOOP
    UPDATE public.support_tickets
    SET status = 'closed', ai_active = false, updated_at = now()
    WHERE id = v_ticket.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_stale_support_tickets() TO authenticated, service_role;