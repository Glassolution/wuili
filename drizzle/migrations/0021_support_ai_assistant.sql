CREATE TABLE public.support_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','admin')),
  content text NOT NULL,
  tool_calls jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ai_messages_user_idx ON public.support_ai_messages(user_id, created_at);
GRANT SELECT, UPDATE ON public.support_ai_messages TO authenticated;
GRANT ALL ON public.support_ai_messages TO service_role;
ALTER TABLE public.support_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read ai messages" ON public.support_ai_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "own archive ai messages" ON public.support_ai_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND archived = true);

CREATE TABLE public.support_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_atendimento','resolvido')),
  reason text NOT NULL,
  summary text,
  ml_diagnostic jsonb,
  assigned_admin uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX support_escalations_one_open ON public.support_escalations(user_id) WHERE status <> 'resolvido';
GRANT SELECT, UPDATE ON public.support_escalations TO authenticated;
GRANT ALL ON public.support_escalations TO service_role;
ALTER TABLE public.support_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read escalations" ON public.support_escalations FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update escalations" ON public.support_escalations FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));