-- Add CJ + ML tracking columns to user_publications
alter table user_publications
  add column if not exists cj_product_id text,
  add column if not exists cj_variant_id  text,
  add column if not exists ml_item_id     text;

-- Index for fast lookup by ML item ID (used in ml-orders-webhook)
create index if not exists idx_user_publications_ml_item_id
  on user_publications (ml_item_id)
  where ml_item_id is not null;
