-- Bolinha de "nova mensagem do cliente" calculada a partir das mensagens + admin_last_seen_at.

-- 1) Só admins mexem em admin_last_seen_at.
CREATE OR REPLACE FUNCTION public.support_tickets_guard_ai_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.ai_paused := false; NEW.needs_human := false; NEW.needs_human_reason := NULL; NEW.needs_human_at := NULL;
      NEW.admin_last_seen_at := NULL;
    ELSE
      NEW.ai_paused := OLD.ai_paused; NEW.needs_human := OLD.needs_human;
      NEW.needs_human_reason := OLD.needs_human_reason; NEW.needs_human_at := OLD.needs_human_at;
      NEW.admin_last_seen_at := OLD.admin_last_seen_at;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 2) Toda mensagem nova: atualiza a atividade do ticket; mensagem do cliente reabre ticket fechado.
CREATE OR REPLACE FUNCTION public.support_messages_after_insert_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sender = 'user' AND NOT COALESCE(NEW.internal, false) THEN
    UPDATE public.support_tickets
       SET status = 'open', updated_at = now()
     WHERE id = NEW.ticket_id;
  ELSE
    UPDATE public.support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS support_messages_activity ON public.support_messages;
CREATE TRIGGER support_messages_activity
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_messages_after_insert_activity();

-- 3) Admin marca o ticket como visto (ao abrir ou responder).
CREATE OR REPLACE FUNCTION public.admin_mark_support_ticket_seen(p_ticket_id uuid)
 RETURNS timestamptz
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_now timestamptz := now();
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;
  UPDATE public.support_tickets SET admin_last_seen_at = v_now WHERE id = p_ticket_id;
  RETURN v_now;
END $function$;

REVOKE ALL ON FUNCTION public.admin_mark_support_ticket_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_support_ticket_seen(uuid) TO authenticated;

-- 4) Total de tickets não lidos (mesma regra da lista).
CREATE OR REPLACE FUNCTION public.admin_support_unread_count()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.support_tickets t
  JOIN LATERAL (
    SELECT sm.sender, sm.created_at
    FROM public.support_messages sm
    WHERE sm.ticket_id = t.id
      AND NOT COALESCE(sm.internal, false)
      AND sm.sender <> 'ai'
    ORDER BY sm.created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE lm.sender = 'user'
    AND (t.admin_last_seen_at IS NULL OR lm.created_at > t.admin_last_seen_at);
  RETURN COALESCE(v_count, 0);
END $function$;

REVOKE ALL ON FUNCTION public.admin_support_unread_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_support_unread_count() TO authenticated;

CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx
  ON public.support_messages (ticket_id, created_at DESC);

-- 5) Tickets já fechados antes desta regra contam como vistos (evita centenas de bolinhas antigas).
UPDATE public.support_tickets SET admin_last_seen_at = now()
 WHERE status = 'closed' AND admin_last_seen_at IS NULL;