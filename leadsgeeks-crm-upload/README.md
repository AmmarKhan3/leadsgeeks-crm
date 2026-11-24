# LeadsGeeks CRM

Internal CRM for the customer success and backend teams: client accounts, access checklist with a built-in login vault, monthly reports, month-to-month billing, notes and requests, change log. Role-based (Admin, Team Lead, Customer Success, Backend, Sales).

Stack: Next.js (App Router, server actions) · Supabase (Postgres with row level security, Auth, Storage) · Tailwind · Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase keys and an encryption key
npm run dev
```

## First-time setup

1. **Supabase**: follow `supabase/README.md` (run the migration, turn off public sign-ups, invite the first admin).
2. **Encryption key** for stored client logins: `openssl rand -base64 32` → `LOGIN_ENCRYPTION_KEY`. Keep a copy somewhere safe; without it stored passwords cannot be read.
3. **Vercel**: import this GitHub repository, add every variable from `.env.example`, deploy. Set `NEXT_PUBLIC_APP_URL` to the deployed URL and add `<url>/auth/callback` to Supabase's redirect list.

## How permissions work

Every table has row level security policies (see `supabase/migrations/0001_init.sql`). The screens hide what a role cannot do, but the database is what enforces it:

- Admin and Team Lead see every account. CS, Backend and Sales see only accounts they are on.
- Billing tables are readable only by admins and the account's CS owner.
- Stored logins (`checklist_logins`) are readable only by admins and the account team. The password column holds AES-256-GCM ciphertext; decryption happens in a server action (`revealLogin`) that checks the team rule again and writes a row to `login_reveals`.
- Private notes are visible only to their author.

## Folder map

- `src/app/(app)/…` signed-in screens (dashboard, accounts, account page with tabs, new account, team, settings, import, inbox)
- `src/app/login`, `src/app/reset-password`, `src/app/auth/callback` sign-in flow
- `src/proxy.ts` session refresh and redirect to login
- `src/lib/constants.ts` industries, statuses, services, checklist groups (mirrors the approved prototype)
- `src/lib/crypto.ts` login encryption
- `supabase/migrations` database schema and policies
