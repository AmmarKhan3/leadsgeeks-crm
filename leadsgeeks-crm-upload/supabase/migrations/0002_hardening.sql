-- LeadsGeeks CRM · hardening after the Supabase security advisor
-- 1. Helper functions are for row level security policies only: not callable from the public API by anonymous
--    visitors, and the auth trigger not callable by anyone.
-- 2. touch_updated_at gets a fixed search_path.
-- 3. The very first profile created becomes admin, so the first invited person can set up the team without SQL.

revoke execute on function my_role() from public, anon;
revoke execute on function is_admin() from public, anon;
revoke execute on function sees_all() from public, anon;
revoke execute on function on_team(uuid) from public, anon;
revoke execute on function can_see(uuid) from public, anon;
revoke execute on function billing_ok(uuid) from public, anon;
revoke execute on function handle_new_user() from public, anon, authenticated;

alter function touch_updated_at() set search_path = public;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case
      when not exists (select 1 from profiles) then 'admin'::user_role
      else coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cs')
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;
