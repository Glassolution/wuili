CREATE OR REPLACE FUNCTION public.catalog_products_enforce_anatel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t text := lower(public.unaccent(coalesce(NEW.title,'')));
BEGIN
  -- Aparelhos de radiofrequência que o ML exige homologação Anatel (celular, smartwatch, roteador, modem, drone).
  IF t ~ '(smartphone|smartwatch|smart watch|smart band|smartband|mi band|redmi watch|amazfit|haylou|relogio smart|roteador|modem 4g|^drone|celular caterpillar|positivo p[0-9]+ dual)'
     AND t !~ '(pulseira|suporte|capa|pelicula|carregador|cabo|anemometro|garrafa|caneta|protetor)' THEN
    NEW.is_blocked := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS catalog_products_anatel ON public.catalog_products;
CREATE TRIGGER catalog_products_anatel BEFORE INSERT OR UPDATE ON public.catalog_products
FOR EACH ROW EXECUTE FUNCTION public.catalog_products_enforce_anatel();

UPDATE public.catalog_products SET is_blocked = is_blocked WHERE is_blocked = false;