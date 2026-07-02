
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own collections" ON public.collections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own collections" ON public.collections
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own collections" ON public.collections
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own collections" ON public.collections
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.collection_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, product_id)
);

CREATE INDEX idx_collection_products_collection ON public.collection_products(collection_id);

GRANT SELECT, INSERT, DELETE ON public.collection_products TO authenticated;
GRANT ALL ON public.collection_products TO service_role;

ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own collection products" ON public.collection_products
  FOR SELECT TO authenticated USING (
    collection_id IN (SELECT id FROM public.collections WHERE user_id = auth.uid())
  );
CREATE POLICY "Users insert own collection products" ON public.collection_products
  FOR INSERT TO authenticated WITH CHECK (
    collection_id IN (SELECT id FROM public.collections WHERE user_id = auth.uid())
  );
CREATE POLICY "Users delete own collection products" ON public.collection_products
  FOR DELETE TO authenticated USING (
    collection_id IN (SELECT id FROM public.collections WHERE user_id = auth.uid())
  );
