create table public.refund_identity_blocks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email','pix')),
  identity_hash text not null,
  source_user_id uuid,
  created_at timestamptz not null default now(),
  unique (kind, identity_hash)
);
alter table public.refund_identity_blocks enable row level security;
revoke all on public.refund_identity_blocks from anon, authenticated;
grant all on public.refund_identity_blocks to service_role;
create policy "Admins leem bloqueios de reembolso" on public.refund_identity_blocks
  for select to authenticated using (public.is_admin());
grant select on public.refund_identity_blocks to authenticated;

create or replace function public.refund_normalize_email(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when split_part(lower(trim(p)),'@',2) in ('gmail.com','googlemail.com')
      then replace(split_part(split_part(lower(trim(p)),'@',1),'+',1),'.','') || '@gmail.com'
    else split_part(split_part(lower(trim(p)),'@',1),'+',1) || '@' || split_part(lower(trim(p)),'@',2)
  end
$$;

insert into public.refund_identity_blocks (kind, identity_hash, source_user_id)
select distinct on (h) 'email', h, user_id from (
  select r.user_id, encode(extensions.digest(public.refund_normalize_email(p.email),'sha256'),'hex') h
  from public.refund_requests r join public.profiles p on p.user_id = r.user_id
  where lower(r.status) = 'processed' and p.email is not null and p.email <> ''
) s on conflict do nothing;

insert into public.refund_identity_blocks (kind, identity_hash, source_user_id)
select distinct on (h) 'pix', h, user_id from (
  select r.user_id, encode(extensions.digest(lower(regexp_replace(p.pix_key,'\s','','g')),'sha256'),'hex') h
  from public.refund_requests r join public.profiles p on p.user_id = r.user_id
  where lower(r.status) = 'processed' and coalesce(p.pix_key,'') <> ''
) s on conflict do nothing;