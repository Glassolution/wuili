ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

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
    INSERT INTO public.support_messages (ticket_id, user_id, message, sender)
    VALUES (
      v_ticket.id,
      NULL,
      '🔒 Este ticket foi fechado automaticamente por inatividade (48 horas sem novas mensagens). Se ainda precisar de ajuda, é só reabri-lo pelo histórico de tickets.',
      'admin'
    );

    UPDATE public.support_tickets
    SET status = 'closed', ai_active = false, updated_at = now()
    WHERE id = v_ticket.id;

    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        v_ticket.user_id,
        'Ticket de suporte fechado',
        'Seu ticket foi fechado automaticamente por 48h sem novas mensagens. Você pode reabri-lo a qualquer momento pelo histórico.',
        'support',
        jsonb_build_object('ticket_id', v_ticket.id, 'reason', 'inactivity_48h')
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_stale_support_tickets() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('close-stale-support-tickets')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close-stale-support-tickets');
    PERFORM cron.schedule(
      'close-stale-support-tickets',
      '7 * * * *',
      $cron$SELECT public.close_stale_support_tickets();$cron$
    );
  END IF;
END
$$;