ALTER TABLE public.orders REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='store_orders') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.store_orders';
  END IF;
END $$;
ALTER TABLE public.store_orders REPLICA IDENTITY FULL;