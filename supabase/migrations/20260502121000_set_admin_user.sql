alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

update public.profiles p
set
  role = 'admin',
  updated_at = now()
from auth.users u
where p.user_id = u.id
  and lower(u.email) = lower('xavierluisfelipe12@gmail.com');
