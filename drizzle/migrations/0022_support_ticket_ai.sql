ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ai_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_human_reason text,
  ADD COLUMN IF NOT EXISTS needs_human_at timestamptz;

-- Mensagens internas (avisos da IA para a equipe) nunca aparecem para o cliente.
DROP POLICY IF EXISTS users_own_messages ON public.support_messages;
CREATE POLICY support_messages_select ON public.support_messages FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role)
  OR (NOT internal AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid())));
CREATE POLICY support_messages_insert ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role)
  OR (NOT internal AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid())));

-- Cliente não pode mexer nos campos de controle da IA.
CREATE OR REPLACE FUNCTION public.support_tickets_guard_ai_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.ai_paused := false; NEW.needs_human := false; NEW.needs_human_reason := NULL; NEW.needs_human_at := NULL;
    ELSE
      NEW.ai_paused := OLD.ai_paused; NEW.needs_human := OLD.needs_human;
      NEW.needs_human_reason := OLD.needs_human_reason; NEW.needs_human_at := OLD.needs_human_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS support_tickets_guard_ai ON public.support_tickets;
CREATE TRIGGER support_tickets_guard_ai BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_tickets_guard_ai_fields();

-- Token para o gatilho chamar a IA sem segredo escrito no SQL.
INSERT INTO public.cron_tokens (name, token)
SELECT 'support-assistant', encode(gen_random_bytes(24), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.cron_tokens WHERE name = 'support-assistant');

-- Cada mensagem do cliente aciona a IA do suporte.
CREATE OR REPLACE FUNCTION public.support_messages_notify_ai()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE tok text;
BEGIN
  IF NEW.sender <> 'user' OR NEW.internal THEN RETURN NEW; END IF;
  SELECT token INTO tok FROM public.cron_tokens WHERE name = 'support-assistant';
  IF tok IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/support-assistant',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-support-token', tok),
    body := jsonb_build_object('action', 'ticket_reply', 'ticket_id', NEW.ticket_id, 'message_id', NEW.id),
    timeout_milliseconds := 60000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS support_messages_ai ON public.support_messages;
CREATE TRIGGER support_messages_ai AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_messages_notify_ai();