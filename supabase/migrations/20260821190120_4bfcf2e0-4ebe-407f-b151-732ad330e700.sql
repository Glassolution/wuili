
create or replace function public.ml_variation_backfill_candidates(p_limit int default 50, p_offset int default 0)
returns table(publication_id uuid, user_id uuid, email text, ml_item_id text, title text, price numeric, variants jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.user_id, pr.email, p.ml_item_id, p.title, p.price, c.variants
  from user_publications p
  join catalog_products c on c.external_id = p.catalog_product_id
  left join profiles pr on pr.user_id = p.user_id
  where p.ml_item_id is not null
    and p.status = 'active'
    and p.variation_group_id is null
    and jsonb_typeof(c.variants) = 'array'
    and (
      select count(distinct v->>'value')
      from jsonb_array_elements(c.variants) v
      where lower(coalesce(v->>'name','')) <> 'compra'
    ) > 1
  order by p.published_at desc
  limit p_limit offset p_offset
$$;

revoke all on function public.ml_variation_backfill_candidates(int,int) from public, anon, authenticated;
grant execute on function public.ml_variation_backfill_candidates(int,int) to service_role;
