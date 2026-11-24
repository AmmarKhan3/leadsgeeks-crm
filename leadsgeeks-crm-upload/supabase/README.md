# Database setup

1. Create a Supabase project (free tier is fine). Region: US.
2. Open **SQL Editor → New query**, paste the whole of `migrations/0001_init.sql`, run it once.
3. **Authentication → Providers**: keep Email enabled, turn **off** "Allow new users to sign up" (admins invite people from the Team page).
4. **Authentication → URL configuration**: set Site URL to the app's URL and add `<app-url>/auth/callback` to the redirect list.
5. **Project Settings → API**: copy the project URL, the anon key and the service role key into the app's environment variables (see `.env.example` in the project root).
6. First admin: **Authentication → Users → Invite user** with your email. After you accept, run in the SQL editor:

```sql
update profiles set role = 'admin' where email = 'you@leadsgeeks.ai';
```

Everyone after that is invited from the CRM's Team page.
