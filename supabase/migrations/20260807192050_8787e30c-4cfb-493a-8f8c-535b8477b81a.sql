ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

GRANT DELETE ON TABLE public.support_messages TO authenticated;

DROP POLICY IF EXISTS admin_only_edit_messages ON public.support_messages;
CREATE POLICY admin_only_edit_messages
  ON public.support_messages
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS admin_only_delete_messages ON public.support_messages;
CREATE POLICY admin_only_delete_messages
  ON public.support_messages
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));