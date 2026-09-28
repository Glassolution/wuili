CREATE TABLE public.pending_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id text,
  title text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  seller_ready_at timestamptz,
  published_at timestamptz,
  ml_item_id text,
  permalink text,
  reminder_1d_at timestamptz,
  reminder_3d_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pending_publications_status_idx ON public.pending_publications (status, created_at);
CREATE INDEX pending_publications_user_idx ON public.pending_publications (user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_publications TO authenticated;
GRANT ALL ON public.pending_publications TO service_role;

ALTER TABLE public.pending_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve seus anuncios pendentes"
  ON public.pending_publications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuario cria seus anuncios pendentes"
  ON public.pending_publications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario atualiza seus anuncios pendentes"
  ON public.pending_publications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario apaga seus anuncios pendentes"
  ON public.pending_publications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin ve anuncios pendentes"
  ON public.pending_publications FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER pending_publications_set_updated_at
  BEFORE UPDATE ON public.pending_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();