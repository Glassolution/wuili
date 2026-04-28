-- Keep only one publication row per Mercado Livre item for each user.
-- Older duplicate rows were created when both the frontend and ml-publish
-- Edge Function inserted into user_publications during the same publish flow.
with ranked_publications as (
  select
    id,
    row_number() over (
      partition by user_id, ml_item_id
      order by created_at asc nulls last, published_at asc nulls last, id asc
    ) as row_number
  from public.user_publications
  where ml_item_id is not null
)
delete from public.user_publications publications
using ranked_publications ranked
where publications.id = ranked.id
  and ranked.row_number > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_publications_user_id_ml_item_id_key'
      and conrelid = 'public.user_publications'::regclass
  ) then
    alter table public.user_publications
      add constraint user_publications_user_id_ml_item_id_key
      unique (user_id, ml_item_id);
  end if;
end $$;
