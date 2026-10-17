-- Pedidos cancelados/reembolsados no Mercado Livre nunca ficavam como
-- 'cancelado' em dropship_orders: o update de cancelamento grava
-- cancel_reason/refund_required/refund_status, que não existiam no banco,
-- então falhava em silêncio e o pedido seguia disponível para compra.

ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS refund_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_error text,
  ADD COLUMN IF NOT EXISTS c7drop_cancelled_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dropship_orders_refund_status_check'
      AND conrelid = 'public.dropship_orders'::regclass
  ) THEN
    ALTER TABLE public.dropship_orders
      ADD CONSTRAINT dropship_orders_refund_status_check
      CHECK (refund_status IN ('not_required', 'pending', 'requested', 'succeeded', 'failed'));
  END IF;
END $$;

-- Fecha os pedidos que já foram cancelados/reembolsados no ML mas ficaram
-- abertos. Só mexe em pedidos que ainda não tocaram o fornecedor nem foram
-- pagos; os demais seguem pelo fluxo de cancelamento_pendente.
WITH cancelled AS (
  UPDATE public.dropship_orders d
  SET status = 'cancelado',
      cancel_reason = CASE o.status
        WHEN 'refunded' THEN 'Pedido reembolsado no Mercado Livre'
        ELSE 'Pedido cancelado no Mercado Livre'
      END,
      refund_required = false,
      refund_status = 'not_required',
      updated_at = now()
  FROM public.orders o
  WHERE o.platform = 'mercadolivre'
    AND o.status IN ('cancelled', 'refunded')
    AND d.ml_order_id = COALESCE(o.ml_order_id, o.external_order_id)::text
    AND d.status IN ('aguardando_dados_cliente', 'dados_completos', 'verificando_disponibilidade')
    AND COALESCE(lower(d.payment_status), 'pending') NOT IN ('paid', 'approved', 'confirmed')
  RETURNING d.id, o.status AS ml_status
)
INSERT INTO public.dropship_order_events (order_id, event_type, new_status, actor, message, metadata)
SELECT id,
       'ml_order_cancelled',
       'cancelado',
       'migration',
       'Pedido cancelado no Mercado Livre fechado retroativamente.',
       jsonb_build_object('ml_status', ml_status)
FROM cancelled;

-- Os alertas repetidos de limpeza desses pedidos não precisam mais de ação.
UPDATE public.dropship_worker_alerts a
SET resolved_at = now()
FROM public.dropship_orders d
WHERE a.order_id = d.id
  AND a.code = 'ml_cancelled_cleanup_required'
  AND a.resolved_at IS NULL
  AND d.status = 'cancelado';

NOTIFY pgrst, 'reload schema';
