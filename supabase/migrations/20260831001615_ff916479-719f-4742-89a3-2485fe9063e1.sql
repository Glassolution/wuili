CREATE TABLE public.dropship_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_reference TEXT,
  carrier TEXT,
  tracking_code TEXT,
  tracking_url TEXT,
  shipping_address JSONB,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_dropship_orders_user_id ON public.dropship_orders(user_id);
CREATE INDEX idx_dropship_orders_status ON public.dropship_orders(status);
CREATE INDEX idx_dropship_orders_tracking_code ON public.dropship_orders(tracking_code);

GRANT SELECT ON public.dropship_orders TO authenticated;
GRANT ALL ON public.dropship_orders TO service_role;

ALTER TABLE public.dropship_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem seus proprios pedidos"
  ON public.dropship_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE TABLE public.dropship_order_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.dropship_orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'status_change',
  previous_status TEXT,
  new_status TEXT,
  actor TEXT NOT NULL DEFAULT 'worker',
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_dropship_order_events_order_id ON public.dropship_order_events(order_id);

GRANT SELECT ON public.dropship_order_events TO authenticated;
GRANT ALL ON public.dropship_order_events TO service_role;

ALTER TABLE public.dropship_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem eventos dos seus pedidos"
  ON public.dropship_order_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dropship_orders o
      WHERE o.id = dropship_order_events.order_id
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE TRIGGER update_dropship_orders_updated_at
  BEFORE UPDATE ON public.dropship_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();