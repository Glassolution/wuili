
-- Remove linhas órfãs que não têm produto correspondente (evita falha na FK)
DELETE FROM public.collection_products cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_products p WHERE p.id::text = cp.product_id
);

-- Converte product_id de text para uuid
ALTER TABLE public.collection_products
  ALTER COLUMN product_id TYPE uuid USING product_id::uuid;

-- Cria a foreign key para catalog_products (necessária para o select aninhado do PostgREST)
ALTER TABLE public.collection_products
  ADD CONSTRAINT collection_products_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.catalog_products(id) ON DELETE CASCADE;
