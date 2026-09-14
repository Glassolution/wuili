-- Keep support ticket activity aligned with the latest message timestamp.

create or replace function public.touch_support_ticket_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.touch_support_ticket_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
     set updated_at = new.created_at
   where id = new.ticket_id;

  return new;
end;
$$;
