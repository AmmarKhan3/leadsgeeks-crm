# Database setup

The schema lives in `migrations/` and is applied to the Supabase project in order. `0001_init.sql` creates every table, the row level security policies and the private `reports` bucket; `0002_hardening.sql` locks down the helper functions and makes the first profile ever created an admin.

For the live project these migrations have already been applied. Any future schema change goes in a new numbered file here and is applied to the project the same way (Supabase MCP `apply_migration` or the SQL Editor), so this folder stays the source of truth.

Dashboard settings that are not SQL (see `../SETUP.md` section 2 and 4):

- Authentication → Providers → Email: "Allow new users to sign up" **off**. Admins invite people from the CRM's Team page.
- Authentication → URL configuration: Site URL = the app URL; add `<app-url>/auth/callback` to the redirect list.
- Project Settings → API Keys: project URL, `anon` key and `service_role` key go into the app's environment variables (see `../.env.example`).
