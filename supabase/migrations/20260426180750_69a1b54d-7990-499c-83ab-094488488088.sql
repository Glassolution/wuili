-- Adicionar colunas para fulfillment manual via CJ
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cj_product_id text,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

-- Trigger para criar notificação quando um novo pedido chegar
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    NEW.user_id,
    'Novo pedido recebido! 🎉',
    COALESCE(NEW.buyer_name, 'Cliente') || ' comprou ' || COALESCE(NEW.product_title, 'um produto'),
    'order',
    jsonb_build_object('order_id', NEW.id, 'sale_price', NEW.sale_price, 'platform', NEW.platform)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order();

-- Habilitar realtime para orders e notifications
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;