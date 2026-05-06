-- Garante deduplicação por (user_id, ml_item_id) e ativa realtime para a tabela
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_publications_user_id_ml_item_id_key'
      AND conrelid = 'public.user_publications'::regclass
  ) THEN
    -- Remove duplicatas remanescentes antes de aplicar a constraint
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY user_id, ml_item_id
        ORDER BY created_at ASC NULLS LAST, published_at ASC NULLS LAST, id ASC
      ) AS rn
      FROM public.user_publications
      WHERE ml_item_id IS NOT NULL
    )
    DELETE FROM public.user_publications p
    USING ranked r
    WHERE p.id = r.id AND r.rn > 1;

    ALTER TABLE public.user_publications
      ADD CONSTRAINT user_publications_user_id_ml_item_id_key UNIQUE (user_id, ml_item_id);
  END IF;
END $$;

-- Ativa replica identity full e realtime
ALTER TABLE public.user_publications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_publications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_publications;
  END IF;
END $$;