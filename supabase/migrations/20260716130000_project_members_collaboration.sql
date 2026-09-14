-- Colaboração em projetos (equipe) — compartilhamento por projeto, restrito a assinantes pagos.
-- Regra de negócio: para compartilhar/colaborar, o DONO e o CONVIDADO precisam ter
-- assinatura paga ativa. Um convite libera acesso a UM projeto específico, nunca a todos.

-- 1. Helper: usuário tem plano pago ativo?
CREATE OR REPLACE FUNCTION public.user_has_active_paid_plan(target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = target_user
      AND s.status = 'active'
      AND lower(s.plan) NOT IN ('gratis', 'free')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = target_user
      AND p.plano IS NOT NULL
      AND lower(p.plano) NOT IN ('gratis', 'free')
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_active_paid_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_active_paid_plan(uuid) TO authenticated, service_role;

-- 2. Tabela de membros do projeto
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'editor', 'viewer')),
  CONSTRAINT project_members_status_check CHECK (status IN ('pending', 'active'))
);

CREATE UNIQUE INDEX idx_project_members_email_unique
  ON public.project_members (project_id, lower(invited_email));
CREATE UNIQUE INDEX idx_project_members_user_unique
  ON public.project_members (project_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_project_members_user ON public.project_members (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_project_members_email ON public.project_members (lower(invited_email));

GRANT SELECT, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 3. Helpers (SECURITY DEFINER evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_projects p
    WHERE p.id = p_project AND p.user_id = p_user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_project_member(p_project uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = p_project AND m.user_id = p_user AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_project_editor(p_project uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = p_project AND m.user_id = p_user
      AND m.status = 'active' AND m.role IN ('owner', 'editor')
  );
$$;

REVOKE ALL ON FUNCTION public.is_project_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_project_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_project_editor(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_project_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_project_editor(uuid, uuid) TO authenticated, service_role;

-- 4. RLS de project_members
-- Ver: dono do projeto vê todos os membros; membro vê o próprio registro.
CREATE POLICY "View project members" ON public.project_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_project_owner(project_id, auth.uid()));

-- Remover: dono remove qualquer membro; membro pode sair sozinho.
CREATE POLICY "Delete project members" ON public.project_members
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()) OR user_id = auth.uid());
-- INSERT/UPDATE acontecem apenas via RPCs SECURITY DEFINER abaixo (gate de plano pago).

-- 5. Estender RLS de user_projects: membros ativos acessam SOMENTE os projetos convidados
CREATE POLICY "Members can view shared projects" ON public.user_projects
  FOR SELECT TO authenticated
  USING (public.is_active_project_member(id, auth.uid()));

CREATE POLICY "Editors can update shared projects" ON public.user_projects
  FOR UPDATE TO authenticated
  USING (public.is_active_project_editor(id, auth.uid()))
  WITH CHECK (public.is_active_project_editor(id, auth.uid()));

-- 6. get_user_projects: incluir projetos compartilhados ativos
CREATE OR REPLACE FUNCTION public.get_user_projects()
RETURNS SETOF public.user_projects
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.user_projects p
  WHERE p.user_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.project_members m
       WHERE m.project_id = p.id AND m.user_id = auth.uid() AND m.status = 'active'
     )
  ORDER BY p.last_edited_at DESC, p.updated_at DESC, p.created_at DESC;
$$;

-- 7. Convidar membro (gate: dono precisa ser pago). Se o e-mail já é usuário pago,
--    ativa na hora; senão fica pendente até o convidado se cadastrar e virar pago.
CREATE OR REPLACE FUNCTION public.invite_project_member(
  p_project uuid,
  p_email text,
  p_role text DEFAULT 'editor'
)
RETURNS public.project_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := auth.uid();
  invitee_id uuid;
  invitee_paid boolean := false;
  result public.project_members;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.is_project_owner(p_project, owner_id) THEN
    RAISE EXCEPTION 'not_owner';
  END IF;
  IF NOT public.user_has_active_paid_plan(owner_id) THEN
    RAISE EXCEPTION 'owner_not_paid';
  END IF;
  IF p_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  SELECT u.id INTO invitee_id FROM auth.users u WHERE lower(u.email) = lower(p_email) LIMIT 1;
  IF invitee_id IS NOT NULL THEN
    IF invitee_id = owner_id THEN
      RAISE EXCEPTION 'cannot_invite_self';
    END IF;
    invitee_paid := public.user_has_active_paid_plan(invitee_id);
  END IF;

  INSERT INTO public.project_members (project_id, invited_email, user_id, role, status, invited_by, accepted_at)
  VALUES (
    p_project,
    lower(p_email),
    CASE WHEN invitee_paid THEN invitee_id ELSE NULL END,
    p_role,
    CASE WHEN invitee_paid THEN 'active' ELSE 'pending' END,
    owner_id,
    CASE WHEN invitee_paid THEN now() ELSE NULL END
  )
  ON CONFLICT (project_id, lower(invited_email)) DO UPDATE
    SET role = EXCLUDED.role,
        user_id = COALESCE(project_members.user_id, EXCLUDED.user_id),
        status = CASE WHEN EXCLUDED.user_id IS NOT NULL THEN 'active' ELSE project_members.status END,
        accepted_at = CASE WHEN EXCLUDED.user_id IS NOT NULL THEN COALESCE(project_members.accepted_at, now()) ELSE project_members.accepted_at END
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_project_member(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_project_member(uuid, text, text) TO authenticated, service_role;

-- 8. Reivindicar convites pendentes ao entrar (só ativa se o convidado for pago)
CREATE OR REPLACE FUNCTION public.claim_project_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  claimed integer := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT public.user_has_active_paid_plan(uid) THEN
    RETURN 0;
  END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  IF uemail IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.project_members m
  SET user_id = uid, status = 'active', accepted_at = now()
  WHERE lower(m.invited_email) = lower(uemail)
    AND m.status = 'pending'
    AND (m.user_id IS NULL OR m.user_id = uid);
  GET DIAGNOSTICS claimed = ROW_COUNT;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_project_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_project_invites() TO authenticated, service_role;
