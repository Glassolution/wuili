ALTER TABLE public.dropship_orders
  ALTER COLUMN status SET DEFAULT 'aguardando_dados_cliente';

UPDATE public.dropship_orders SET status = 'aguardando_dados_cliente' WHERE status = 'pending';

ALTER TABLE public.dropship_orders
  ADD CONSTRAINT dropship_orders_status_check CHECK (status IN (
    'aguardando_dados_cliente',
    'dados_completos',
    'verificando_disponibilidade',
    'pix_gerado',
    'reservando_fornecedor',
    'reservado_aguardando_pagamento',
    'pagamento_confirmado',
    'finalizando_fornecedor',
    'pedido_concluido',
    'rastreio_pendente',
    'rastreio_disponivel',
    'cancelamento_pendente',
    'cancelado',
    'falha_reserva',
    'falha_finalizacao',
    'expirado'
  ));