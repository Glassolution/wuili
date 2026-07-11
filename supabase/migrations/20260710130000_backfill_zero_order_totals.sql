DO $$
DECLARE
  zero_before bigint;
  eligible_before bigint;
  updated_rows bigint;
  zero_after bigint;
BEGIN
  SELECT count(*)
    INTO zero_before
    FROM public.orders
   WHERE total_amount = 0;

  SELECT count(*)
    INTO eligible_before
    FROM public.orders
   WHERE total_amount = 0
     AND sale_price IS NOT NULL
     AND sale_price > 0
     AND quantity IS NOT NULL
     AND quantity > 0;

  UPDATE public.orders
     SET total_amount = sale_price * quantity
   WHERE total_amount = 0
     AND sale_price IS NOT NULL
     AND sale_price > 0
     AND quantity IS NOT NULL
     AND quantity > 0;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  SELECT count(*)
    INTO zero_after
    FROM public.orders
   WHERE total_amount = 0;

  RAISE NOTICE 'orders.total_amount backfill: zero_before=%, eligible=%, updated=%, zero_after=%',
    zero_before, eligible_before, updated_rows, zero_after;
END
$$;
