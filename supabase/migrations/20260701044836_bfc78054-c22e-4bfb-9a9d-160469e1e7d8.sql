GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_products TO authenticated;
GRANT ALL ON public.collection_products TO service_role;