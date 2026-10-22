# Tambola Night

Live Tambola (Housie) web app: Next.js 15 + Supabase (Postgres) + Gmail/SMTP e-mails.

## How it works

1. **Buy tickets** - players fill your Google Form (details + payment screenshot), choosing 1-3 tickets.
2. **Host registers player** - after checking the payment, the host opens `/admin` and adds the player
   (name, e-mail, number of tickets). The app generates a unique ID (`acc001`, `acc002`, ... `acc1000`),
   creates unique valid tickets, stores them in Supabase and e-mails them from the central address.
3. **Play** - on game day players log in at `/` with their User ID and see their tickets.
   The host draws numbers at `/admin`; every player's screen updates automatically (and speaks the number).
   Players tap numbers to cross them. The server validates each cross: a number that has not been
   called gives the popup **"Acha Acha Achaaa!"**.

## Setup

### 1. Supabase
1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste [supabase/schema.sql](supabase/schema.sql) and run it.
3. Copy the **Project URL** and **service_role** key (Project Settings > API).

### 2. Environment
```
copy .env.example .env.local
```
Fill in all values (see comments in the file). For Gmail, enable 2-step verification and create an
App Password for `SMTP_PASS`; set `SMTP_USER`/`MAIL_FROM` to your central address (replace the dummy `abcd@gmail.com`).
Set `NEXT_PUBLIC_GOOGLE_FORM_URL` to your form link and `APP_URL` to the hosted URL.

### 3. Run locally
```
npm install
npm run dev
```
Open http://localhost:3000. Host console: http://localhost:3000/admin.

### 4. Push to GitHub
```
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```
`.env.local` is git-ignored, so no secrets are pushed.

### 5. Deploy (Vercel)
1. In Vercel: **Add New > Project**, import the GitHub repo (framework: Next.js, defaults are fine).
2. Add these Environment Variables (Production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_GOOGLE_FORM_URL`,
   `NEXT_PUBLIC_TICKET_PRICE`, `APP_URL` (your Vercel URL), `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASS`. Do NOT set `LOCAL_DB`.
3. Deploy. After the first deploy, set `APP_URL` to the final URL and redeploy.
(`NEXT_PUBLIC_*` variables are baked in at build time.)

## Security notes
- The Supabase service-role key is used only in server code (API routes). RLS is enabled on all tables with
  no policies, so the public anon key cannot access data.
- Admin and player sessions are signed tokens kept per browser tab (sessionStorage), so you can log in as the
  host and several different players in separate tabs/windows of the same browser. Closing a tab logs it out.
- Crossing is validated server-side: the number must be on the player's own ticket and already called.
- Change `ADMIN_PASSWORD` and `SESSION_SECRET` before going live.
