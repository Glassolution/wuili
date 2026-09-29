-- As políticas existentes de UPDATE/DELETE são RESTRICTIVE e não havia nenhuma PERMISSIVE,
-- então nenhuma edição/exclusão passava (nem de admin). Libera somente para admins.
CREATE POLICY support_messages_admin_update
  ON public.support_messages FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY support_messages_admin_delete
  ON public.support_messages FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));