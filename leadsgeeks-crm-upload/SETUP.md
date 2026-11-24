# Going live: what to create, in order

Do these in order. Never paste a key or password into chat; every secret goes into Vercel's environment variables (Project → Settings → Environment Variables).

## 1. GitHub (code home) — done

The code lives in the private repository `AmmarKhan3/leadsgeeks-crm`. The app itself sits in the `leadsgeeks-crm-upload` folder of that repository (remember this folder name for step 4). Changes are made and pushed from Claude cloud sessions; nothing needs to be installed on your Mac.

## 2. Supabase (database, logins, report files)

Already done through the Supabase connection: the project `leadsgeeks-crm` exists (US East) and both migrations in `supabase/migrations` have been applied, so every table, permission rule and the private `reports` bucket are in place. The first person who accepts an invite automatically becomes admin.

Still to do in the Supabase dashboard (https://supabase.com/dashboard, project `leadsgeeks-crm`):

1. Authentication → Sign In / Providers → Email: turn **off** "Allow new users to sign up". Save.
2. Authentication → Users → Add user → Send invitation → your own email. Open the email and set a password. You are now the admin.
3. Project Settings → API Keys: you will copy the `anon` (public) key and the `service_role` (secret) key into Vercel in step 4. The project URL is `https://jhsjmlpsylqusxhbiohi.supabase.co`.

## 3. Encryption key for stored client logins

You need 32 random bytes encoded as base64 (a string of 44 characters ending in `=`). No Terminal needed: in the Supabase SQL Editor run this and copy the single value it returns:

```sql
select encode(gen_random_bytes(32), 'base64');
```

Copy the output somewhere safe (password manager). This is `LOGIN_ENCRYPTION_KEY`. If it is lost, every stored client password becomes unreadable.

## 4. Vercel (hosting)

1. https://vercel.com → Sign up with GitHub → Add New Project → import `leadsgeeks-crm`.
2. On the import screen, under **Root Directory**, click Edit and choose `leadsgeeks-crm-upload`. Vercel should then detect Next.js automatically. This step is required; without it the deploy fails because the app is not at the top of the repository.
3. Before clicking Deploy, open Environment Variables and add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `LOGIN_ENCRYPTION_KEY` | output of step 3 |
| `NEXT_PUBLIC_APP_URL` | `https://leadsgeeks-crm.vercel.app` for now; your custom domain later |
| `SLACK_WEBHOOK_URL` | leave empty until step 6 |

4. Deploy. Copy the URL Vercel gives you.
5. Back in Supabase → Authentication → URL Configuration: Site URL = that Vercel URL; Redirect URLs: add `https://<vercel-url>/auth/callback`.
6. Open the Vercel URL, sign in with the email and password from step 2.2. You are the admin. Invite the team from the Team page.

## 5. Custom domain (optional, later)

Vercel → Project → Settings → Domains → add `crm.leadsgeeks.ai`, then add the CNAME it shows at your DNS provider. Update `NEXT_PUBLIC_APP_URL` and the Supabase Site URL to the new address.

## 6. Slack (optional)

In Slack: Apps → Incoming Webhooks → Add to Slack → pick the channel (for example #client-updates) → copy the webhook URL into Vercel as `SLACK_WEBHOOK_URL` → Redeploy. The CRM then posts new accounts, requests, approvals and report uploads there.

## 7. Import your clients

Fill in `LeadsGeeks client import template.xlsx` (one row per client; team names must match the people you invited), then Admin → Import in the CRM.
