-- LeadsGeeks CRM · initial schema
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to run once on an empty project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
create type user_role as enum ('admin', 'lead', 'cs', 'backend', 'sales');
create type account_status as enum ('Signed', 'Onboarding', 'Active', 'On hold', 'Past due', 'Churned');
create type approval_state as enum ('approved', 'pending', 'rejected');
create type site_owner as enum ('us', 'client', 'agency');
create type backend_specialty as enum ('SEO', 'GBP', 'Ads', 'Website', 'GHL');
create type check_status as enum ('have', 'requested', 'pending', 'denied', 'removed', 'none');
create type note_kind as enum ('note', 'request');
create type request_status as enum ('open', 'done');

-- ---------------------------------------------------------------- profiles
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'cs',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A profile row is created for every auth user; role/name come from invite metadata.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cs')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- helpers (security definer so RLS policies can call them)
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() = 'admin', false)
$$;

create or replace function sees_all() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('admin', 'lead'), false)
$$;

-- ---------------------------------------------------------------- accounts
create table accounts (
  id uuid primary key default gen_random_uuid(),
  business text not null,
  industry text not null,
  industry_other text,
  status account_status not null default 'Signed',
  phone text, email text, website text, gbp_url text,
  street text, city text, state char(2), zip text,
  platform text not null default 'WordPress',
  built_by site_owner not null default 'us',  built_by_name text,
  hosted_by site_owner not null default 'us', hosted_by_name text,
  domain_by site_owner not null default 'client', domain_by_name text,
  services text[] not null default '{}',
  service_other text,
  cs_id uuid references profiles (id),
  lead_id uuid references profiles (id),
  sales_id uuid references profiles (id),
  client_since date not null default current_date,
  approval approval_state not null default 'pending',
  approval_requested_by uuid references profiles (id),
  approval_requested_at timestamptz,
  approval_decided_by uuid references profiles (id),
  approval_decided_at timestamptz,
  approval_reason text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on accounts (cs_id);
create index on accounts (lead_id);
create index on accounts (status);

create table account_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  name text not null,
  title text,
  phone text,
  email text,
  is_primary boolean not null default false
);
create index on account_contacts (account_id);

create table account_backend (
  account_id uuid not null references accounts (id) on delete cascade,
  user_id uuid not null references profiles (id),
  specialty backend_specialty not null,
  primary key (account_id, user_id, specialty)
);
create index on account_backend (user_id);

-- is the signed-in user on this account's team (CS owner, team lead or backend)?
create or replace function on_team(acc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a where a.id = acc and (a.cs_id = auth.uid() or a.lead_id = auth.uid())
  ) or exists (
    select 1 from account_backend b where b.account_id = acc and b.user_id = auth.uid()
  )
$$;

-- can the signed-in user see this account at all?
create or replace function can_see(acc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sees_all() or on_team(acc) or exists (
    select 1 from accounts a where a.id = acc and a.sales_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------- access checklist
create table checklist_items (
  account_id uuid not null references accounts (id) on delete cascade,
  item_key text not null,
  status check_status not null default 'pending',
  note text not null default '',
  external_link text not null default '',
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  primary key (account_id, item_key)
);

-- stored client logins (the built-in vault). Password is AES-256-GCM ciphertext; the key lives in the app's env.
create table checklist_logins (
  account_id uuid not null references accounts (id) on delete cascade,
  item_key text not null,
  login_url text not null default '',
  username text not null default '',
  password_ciphertext text not null default '',
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  primary key (account_id, item_key)
);

create table login_reveals (
  id bigserial primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  item_key text not null,
  user_id uuid not null references profiles (id),
  action text not null, -- 'opened the login page' | 'revealed the password' | 'copied the username' | 'copied the password'
  at timestamptz not null default now()
);
create index on login_reveals (account_id, at desc);

-- ---------------------------------------------------------------- reports
create table reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  month date not null, -- first day of the month covered
  file_path text not null, -- path inside the 'reports' storage bucket
  file_name text not null,
  uploaded_by uuid references profiles (id),
  uploaded_at timestamptz not null default now(),
  unique (account_id, month)
);

-- ---------------------------------------------------------------- billing (CS + admin only)
create table billing (
  account_id uuid primary key references accounts (id) on delete cascade,
  mrr numeric(10,2) not null default 0,
  billing_day int not null default 1 check (billing_day between 1 and 28),
  method text not null default 'Card',
  started_on date,
  updated_at timestamptz not null default now()
);

create table upsells (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  name text not null,
  amount numeric(10,2) not null,
  recurring boolean not null default false,
  sold_on date not null default current_date,
  sold_by uuid references profiles (id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  month date not null,
  amount numeric(10,2) not null,
  collected_on date not null default current_date,
  collected_by uuid references profiles (id),
  note text,
  unique (account_id, month)
);

-- ---------------------------------------------------------------- notes, requests, change log, notifications
create table notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  author uuid not null references profiles (id),
  body text not null,
  kind note_kind not null default 'note',
  assignee uuid references profiles (id),
  due_on date,
  status request_status,
  done_at timestamptz,
  reply text,
  pinned boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notes (account_id, created_at desc);
create index on notes (assignee) where status = 'open';

create table change_log (
  id bigserial primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  by uuid references profiles (id),
  area text not null,
  text text not null,
  from_value text not null default '',
  to_value text not null default '',
  at timestamptz not null default now()
);
create index on change_log (account_id, at desc);

create table notifications (
  id bigserial primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  text text not null,
  account_id uuid references accounts (id) on delete cascade,
  read boolean not null default false,
  at timestamptz not null default now()
);
create index on notifications (user_id, read, at desc);

create table app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- updated_at
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger accounts_touch before update on accounts for each row execute function touch_updated_at();
create trigger billing_touch before update on billing for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- row level security
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table account_contacts enable row level security;
alter table account_backend enable row level security;
alter table checklist_items enable row level security;
alter table checklist_logins enable row level security;
alter table login_reveals enable row level security;
alter table reports enable row level security;
alter table billing enable row level security;
alter table upsells enable row level security;
alter table payments enable row level security;
alter table notes enable row level security;
alter table change_log enable row level security;
alter table notifications enable row level security;
alter table app_settings enable row level security;

-- profiles: everyone signed in sees the team list; only admins change roles; you may edit your own name.
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_admin_write on profiles for all to authenticated using (is_admin()) with check (is_admin());
create policy profiles_self_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));

-- accounts: visibility by role; create = admin, lead, cs; edit = anyone on the team or admin/lead; delete = admin.
create policy accounts_read on accounts for select to authenticated using (can_see(id));
create policy accounts_insert on accounts for insert to authenticated with check (my_role() in ('admin', 'lead', 'cs'));
create policy accounts_update on accounts for update to authenticated using (sees_all() or on_team(id)) with check (sees_all() or on_team(id));
create policy accounts_delete on accounts for delete to authenticated using (is_admin());

create policy contacts_read on account_contacts for select to authenticated using (can_see(account_id));
create policy contacts_write on account_contacts for all to authenticated using (sees_all() or on_team(account_id)) with check (sees_all() or on_team(account_id));

create policy backend_read on account_backend for select to authenticated using (can_see(account_id));
create policy backend_write on account_backend for all to authenticated using (sees_all()) with check (sees_all());

create policy checklist_read on checklist_items for select to authenticated using (can_see(account_id));
create policy checklist_write on checklist_items for all to authenticated using (sees_all() or on_team(account_id)) with check (sees_all() or on_team(account_id));

-- logins: only admins and the account team may read or write; sales never. Ciphertext only; decryption happens server-side.
create policy logins_rw on checklist_logins for all to authenticated using (is_admin() or on_team(account_id)) with check (is_admin() or on_team(account_id));
create policy reveals_read on login_reveals for select to authenticated using (is_admin() or on_team(account_id));
create policy reveals_insert on login_reveals for insert to authenticated with check (user_id = auth.uid() and (is_admin() or on_team(account_id)));

create policy reports_read on reports for select to authenticated using (can_see(account_id));
create policy reports_write on reports for all to authenticated using (is_admin() or (my_role() = 'backend' and on_team(account_id))) with check (is_admin() or (my_role() = 'backend' and on_team(account_id)));

-- billing: admin or the CS owner only.
create or replace function billing_ok(acc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from accounts a where a.id = acc and a.cs_id = auth.uid())
$$;
create policy billing_rw on billing for all to authenticated using (billing_ok(account_id)) with check (billing_ok(account_id));
create policy upsells_rw on upsells for all to authenticated using (billing_ok(account_id)) with check (billing_ok(account_id));
create policy payments_rw on payments for all to authenticated using (billing_ok(account_id)) with check (billing_ok(account_id));

-- notes: team notes visible to anyone who can see the account; private notes only to their author.
create policy notes_read on notes for select to authenticated using (can_see(account_id) and (not is_private or author = auth.uid()));
create policy notes_insert on notes for insert to authenticated with check (author = auth.uid() and can_see(account_id) and my_role() <> 'sales');
create policy notes_update on notes for update to authenticated using (can_see(account_id) and (not is_private or author = auth.uid()) and my_role() <> 'sales');
create policy notes_delete on notes for delete to authenticated using (author = auth.uid() or is_admin());

create policy changes_read on change_log for select to authenticated using (can_see(account_id));
create policy changes_insert on change_log for insert to authenticated with check (can_see(account_id));

create policy notif_own on notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on notifications for update to authenticated using (user_id = auth.uid());
create policy notif_insert on notifications for insert to authenticated with check (true);

create policy settings_read on app_settings for select to authenticated using (true);
create policy settings_admin on app_settings for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- storage: private bucket for report PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

-- object path = <account_id>/<yyyy-mm>.pdf ; first folder is the account id
create policy reports_bucket_read on storage.objects for select to authenticated
  using (bucket_id = 'reports' and can_see((storage.foldername(name))[1]::uuid));
create policy reports_bucket_write on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (is_admin() or (my_role() = 'backend' and on_team((storage.foldername(name))[1]::uuid))));
create policy reports_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reports' and is_admin());
