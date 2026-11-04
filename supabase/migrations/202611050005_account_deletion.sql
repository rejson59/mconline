-- ACCOUNT DB: do not prevent the account site's existing account-deletion flow.
-- 001 already contains CASCADE for fresh deployments.
alter table public.mconline_worlds drop constraint mconline_worlds_owner_fkey;
alter table public.mconline_worlds add constraint mconline_worlds_owner_fkey foreign key(owner) references public.community_users(id) on delete cascade;
