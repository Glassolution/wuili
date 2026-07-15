
-- 1) Storage: remover políticas amplas de listagem em buckets públicos.
-- Arquivos continuam acessíveis por URL pública direta (não usa storage.objects SELECT).
DROP POLICY IF EXISTS "Public read product-images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read assets bucket" ON storage.objects;

-- 2) Revogar EXECUTE público de funções SECURITY DEFINER usadas apenas por triggers.
REVOKE EXECUTE ON FUNCTION public.prevent_self_admin_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Revogar de anon funções que só fazem sentido para usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_help_feed_authors(uuid[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_help_feed_authors(uuid[]) TO authenticated;

-- get_trending_products é chamada por qualquer visitante do catálogo; mantém anon+authenticated.
REVOKE EXECUTE ON FUNCTION public.get_trending_products(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trending_products(text, text, text, integer, integer) TO anon, authenticated;

-- 3) collection_products: adicionar política de UPDATE escopada ao dono da coleção.
CREATE POLICY "collection_products_update_own"
  ON public.collection_products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_products.collection_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_products.collection_id
        AND c.user_id = auth.uid()
    )
  );

-- 4) affiliate_conversions: nega explicitamente INSERT/UPDATE/DELETE a clientes autenticados.
CREATE POLICY "affiliate_conversions_no_client_insert"
  ON public.affiliate_conversions FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY "affiliate_conversions_no_client_update"
  ON public.affiliate_conversions FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "affiliate_conversions_no_client_delete"
  ON public.affiliate_conversions FOR DELETE TO authenticated
  USING (false);

-- 5) aliexpress_sync_log: nega explicitamente escrita direta por clientes.
CREATE POLICY "aliexpress_sync_log_no_client_insert"
  ON public.aliexpress_sync_log FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY "aliexpress_sync_log_no_client_update"
  ON public.aliexpress_sync_log FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "aliexpress_sync_log_no_client_delete"
  ON public.aliexpress_sync_log FOR DELETE TO authenticated
  USING (false);

-- 6) realtime.messages: nega broadcast/presence a qualquer usuário (app não usa canais privados).
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "realtime_deny_all" ON realtime.messages';
    EXECUTE 'CREATE POLICY "realtime_deny_all" ON realtime.messages FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)';
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN NULL;
  END;
END $$;
