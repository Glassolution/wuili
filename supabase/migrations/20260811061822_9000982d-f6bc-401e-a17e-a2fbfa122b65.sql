set local request.jwt.claims = '{"role":"service_role"}';
update public.affiliates set is_active = true, updated_at = now() where user_id = 'f1f4958b-30f0-43ee-a989-7a68e4418e47';