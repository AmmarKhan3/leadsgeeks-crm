# Going live: what to create, in order

Do these in order. Never paste a key or password into chat; every secret goes into `.env.local` on your Mac or into Vercel's environment variables.

## 1. GitHub (code home)

Pick one.

**A. GitHub CLI (easiest).** Install from https://cli.github.com, then in Terminal:

```bash
gh auth login
```

Choose GitHub.com, HTTPS, Yes, Login with a web browser. Then tell Claude "logged in" and it creates the private repo `AmmarKhan3/leadsgeeks-crm` and pushes.

**B. By hand.** On github.com: New repository, name `leadsgeeks-crm`, Private, no README. Create a token at github.com/settings/tokens (classic, scope `repo`). Then in Terminal (username `AmmarKhan3`, password = the token):

```bash
git -C "/Users/syedusmanrizvi/LeadsGeeks CRM/crm" remote add origin https://github.com/AmmarKhan3/leadsgeeks-crm.git
git -C "/Users/syedusmanrizvi/LeadsGeeks CRM/crm" push -u origin main
```

## 2. Supabase (database, logins, report files)

1. https://supabase.com → New project. Name `leadsgeeks-crm`, region US East, pick a strong database password and store it in your password manager (you rarely need it again).
2. SQL Editor → New query → paste all of `supabase/migrations/0001_init.sql` → Run.
3. Authentication → Providers → Email: turn **off** "Allow new users to sign up".
4. Authentication → Users → Invite user → your own email. Open the email, set a password.
5. SQL Editor, run:
   ```sql
   update profiles set role = 'admin', name = 'Ammar Khan' where email = 'YOUR-EMAIL';
   ```
6. Project Settings → API: you will copy three values into Vercel in step 4: Project URL, `anon` key, `service_role` key.

## 3. Encryption key for stored client logins

In Terminal:

```bash
openssl rand -base64 32
```

Copy the output somewhere safe (password manager). This is `LOGIN_ENCRYPTION_KEY`. If it is lost, every stored client password becomes unreadable.

## 4. Vercel (hosting)

1. https://vercel.com → Sign up with GitHub → Add New Project → import `leadsgeeks-crm`.
2. Before clicking Deploy, open Environment Variables and add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `LOGIN_ENCRYPTION_KEY` | output of step 3 |
| `NEXT_PUBLIC_APP_URL` | `https://leadsgeeks-crm.vercel.app` for now; your custom domain later |
| `SLACK_WEBHOOK_URL` | leave empty until step 6 |

3. Deploy. Copy the URL Vercel gives you.
4. Back in Supabase → Authentication → URL Configuration: Site URL = that Vercel URL; Redirect URLs: add `https://<vercel-url>/auth/callback`.
5. Open the Vercel URL, sign in with the email and password from step 2.4. You are the admin. Invite the team from the Team page.

## 5. Custom domain (optional, later)

Vercel → Project → Settings → Domains → add `crm.leadsgeeks.ai`, then add the CNAME it shows at your DNS provider. Update `NEXT_PUBLIC_APP_URL` and the Supabase Site URL to the new address.

## 6. Slack (optional)

In Slack: Apps → Incoming Webhooks → Add to Slack → pick the channel (for example #client-updates) → copy the webhook URL into Vercel as `SLACK_WEBHOOK_URL` → Redeploy. The CRM then posts new accounts, requests, approvals and report uploads there.

## 7. Import your clients

Fill in `LeadsGeeks client import template.xlsx` (one row per client; team names must match the people you invited), then Admin → Import in the CRM.
