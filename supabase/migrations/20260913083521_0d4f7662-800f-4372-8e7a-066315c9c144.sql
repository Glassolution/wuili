create or replace function public.get_catalog_product_popularity(p_id text)
returns table(publications_count integer, sellers_count integer, recent_count integer, percentile integer)
language sql
stable
security definer
set search_path = public
as $$
with counts as (
  select catalog_product_id,
         count(*)::int as c,
         count(distinct user_id)::int as s,
         count(*) filter (where created_at > now() - interval '30 days')::int as r
  from public.user_publications
  where catalog_product_id is not null
  group by catalog_product_id
), me as (
  select * from counts where catalog_product_id = p_id
)
select
  coalesce((select c from me), 0),
  coalesce((select s from me), 0),
  coalesce((select r from me), 0),
  coalesce((
    select round(100.0 * (select count(*) from counts where c < coalesce((select c from me), 0))
      / nullif((select count(*) from counts), 0))::int
  ), 0);
$$;

grant execute on function public.get_catalog_product_popularity(text) to authenticated, anon, service_role;