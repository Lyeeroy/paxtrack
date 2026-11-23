# Tracker

A small, offline-first episode tracker for anime, TV shows and movies. Your library lives in the browser first, so it keeps working without a connection. Sign in with a Supabase account to back it up and sync it across devices.

## Features

- Track TV/anime episodes and movies with a next-up queue
- Release calendar, watch history and per-title progress
- Works offline (IndexedDB + service worker) and installs as a PWA
- Optional release-day notifications
- Username/password accounts by default (email mode optional) and multi-device sync through Supabase
- Row Level Security: the database only ever returns your own library
- Local-only mode when Supabase is not configured
- Metadata and artwork from TMDB

## Stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- [Supabase](https://supabase.com/) Auth + Postgres for accounts and sync
- [TMDB](https://www.themoviedb.org/) for search and metadata
- Vercel for hosting; Supabase provides the backend (no server for you to run)

## Requirements

- Node.js 20.9 or newer
- A free Supabase project
- A TMDB API key (v3)

## 1. Clone and install

```bash
git clone <your-repo-url> tracker
cd tracker
npm install
```

## 2. Create a Supabase project

Create a project at [database.new](https://database.new/) and wait for it to finish provisioning.

## 3. Create the database table

1. Open your project in the Supabase dashboard.
2. Go to **SQL Editor** and create a new query.
3. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.

The script creates:

- `public.tracked_items`, one row per title per user
- a trigger that assigns the server-side sync cursor (`server_ts`)
- a trigger that rejects stale writes, so two devices syncing at once still resolve last-write-wins
- an index for incremental pulls
- Row Level Security policies that restrict every operation to the signed-in user

You do **not** need a database password or connection string in the app. The browser talks to Supabase through the public API, and RLS enforces access. Never put the service role key in a `NEXT_PUBLIC_*` variable.

## 4. Configure authentication

There are two auth modes. Pick one before you invite users — an account created in one mode signs in with that mode's identifier.

### Username mode (default)

Users pick a username (3–20 characters, starting with a letter) and a password. No email is collected, no confirmation is needed, and no email is sent.

Supabase Auth always signs in with an email address, so the app derives a private, non-deliverable address from the username (`<username>@users.example.com`) and stores the username in `user_metadata`. Nobody needs to know or receive that address.

In the Supabase dashboard, open **Authentication → Sign In / Providers → Email** and turn **Confirm email** off. Otherwise Supabase will demand an email confirmation that username mode cannot complete.

Password reset is not available in this mode because there is no email to send a link to; the reset screen says so.

### Email mode (opt-in)

Set `NEXT_PUBLIC_AUTH_MODE=email` in `.env.local` and on Vercel. Users then sign up with a real email address, and Supabase handles confirmation and password-reset emails.

- Leave **Confirm email** on under **Authentication → Sign In / Providers → Email**.
- Configure SMTP under **Authentication → Emails → SMTP Settings** for production; Supabase's built-in sender is heavily rate-limited.
- In **Authentication → URL Configuration**, set **Site URL** to your deployed origin and add the matching **Redirect URLs**, for example `https://<your-domain>/**`. Add `http://localhost:3000/**` for local development. The app passes the current origin as the redirect target on sign-up and reset, so every origin you sign in from must be allowlisted.

If a confirmation email contains `redirect_to=http://localhost:3000`, the Site URL is still localhost. Fix it there and request a new email.

### Customize the auth emails (email mode only)

The email content itself is controlled by Supabase, not by this repo. Edit subjects and HTML under **Authentication → Emails → Templates**. To make the link point at your own domain instead of Supabase's verify endpoint, use this in the **Confirm signup** template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Confirm email address</a>
```

And in the **Reset password** template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset">Choose a new password</a>
```

`/auth/confirm` is a route in this app: it verifies the token on the server, writes the session cookie, then redirects to `next`. You can keep the default `{{ .ConfirmationURL }}` links if you prefer — just make sure Site URL and Redirect URLs are correct. The **in-app** sign-in form is React code in `src/components/CloudSync.tsx` if you want to restyle that.

## 5. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

```dotenv
TMDB_API_KEY=your_tmdb_v3_api_key
NEXT_PUBLIC_AUTH_MODE=username
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

`NEXT_PUBLIC_AUTH_MODE` is optional: unset means `username`. Set it to `email` to use email/password sign-in with confirmation and reset emails.

Find the Supabase values under **Project Settings → API Keys**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Publishable key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Older projects can use the legacy anon key instead:

```dotenv
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Both keys are public and safe to ship to the browser. If both are present, the publishable key is used.

`TMDB_API_KEY` is server-only. It is used by the `/api/tmdb/*` route handlers and is never sent to the browser.

The app does not use the database password, connection strings, service-role/secret key, or JWT secret. There is no reason to add those to Vercel, and they must never be prefixed with `NEXT_PUBLIC_`.

## 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Open **Settings → Cloud sync** to create an account or sign in. Until you do, the app stays local-only on that device.

Without Supabase variables the app still runs in local-only mode: everything works on this device, and Settings explains that cloud sync is not configured.

## Deploy to Vercel

1. Push the project to GitHub, GitLab or Bitbucket.
2. In [Vercel](https://vercel.com/new), import the repository. Vercel detects Next.js automatically; no custom build command or `vercel.json` is needed.
3. Add these environment variables for **Production**, **Preview** and **Development**:
   - `TMDB_API_KEY`
   - `NEXT_PUBLIC_AUTH_MODE` — omit or set to `username` for the default; use `email` for email/password accounts
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy.
5. In Supabase, turn **Confirm email** off for username mode (or leave it on for email mode). For email mode also set **Authentication → URL Configuration**:
   - **Site URL**: `https://your-project.vercel.app`
   - **Redirect URLs**: add `https://your-project.vercel.app/**`
6. If you changed environment variables after deploying, trigger a new deployment so they take effect.

**Note:** Next.js only exposes variables that start with `NEXT_PUBLIC_` to the browser. The Supabase Vercel integration may add `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` *without* that prefix — those alone are not enough. Add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` explicitly (or `NEXT_PUBLIC_SUPABASE_ANON_KEY` for an older project) and redeploy. `NEXT_PUBLIC_*` values are baked into the build, so a redeploy is required after changing them.

To make auth work on Vercel preview deployments, add your preview domain pattern to the redirect allowlist, for example `https://*-your-team.vercel.app/**`. Otherwise preview builds will still run, but email confirmation and password-reset links will only work on the production domain.

That is the whole deployment: a Next.js app on Vercel plus a Supabase project. There is no separate sync server, database proxy or worker to deploy.

## How sync works

- The UI reads from an IndexedDB cache, so it opens instantly and works offline.
- Signing in enables Supabase sync. Each title is stored in `tracked_items` as a JSON payload keyed by `(user_id, item_id)`.
- On each sync the client **pulls first**, applies last-write-wins per title using the item's `updatedAt`, and only then uploads local items that are new or newer than the cloud copy.
- The database also enforces last-write-wins: an upload that is older than the stored row is ignored, so two devices pushing at the same time cannot overwrite a newer edit.
- The server assigns `server_ts` on every write. The client uses it as a cursor to pull only changes it has not seen, with a small overlap for clock/commit races.
- Sync runs on sign-in, 2.5 seconds after a local change, when the browser comes back online, and when the tab becomes visible.
- The first account used in a browser adopts any existing local library. Signing in as a different account clears the on-device cache before pulling that account's library, so one user's data can never be uploaded to another account.
- Signing out stops syncing but leaves the local library available for offline use.
- RLS is the security boundary. Even if someone calls the Supabase API directly, they can only read and write rows whose `user_id` matches their authenticated user.

### Switching from the old sync-key version

This version replaces the old custom Postgres sync key with Supabase accounts. The old unscoped entries (`tracker:key`, `tracker:last`, `tracker:pushed`, `tracker:synced-at`) are removed automatically. Existing local items are uploaded to the first account that signs in on that browser.

Data that only ever lived in the old server-side sync vault is not migrated automatically. If you still have a device with that library cached, open the updated app on it and sign in before clearing site data; its local copy will be uploaded to your new account.

## Data and privacy

- Your library is stored in your browser's IndexedDB and, when signed in, in your Supabase project.
- TMDB requests go through this app's server routes so the API key stays private.
- There is no analytics or third-party tracking in the app.
- Settings → **Export backup (JSON)** downloads a local copy of your library at any time.

## Project structure

```text
src/app/                 Next.js routes and pages
  api/tmdb/              Server-side TMDB search and title metadata
  auth/callback/         Supabase auth code exchange (default email links)
  auth/confirm/          Server-side email verification (custom email links)
  auth/reset/            Choose-a-new-password screen
src/components/          UI (library, detail, settings, cloud sync, ...)
src/lib/                 Local store, sync, auth, TMDB client, helpers
src/lib/supabase/        Browser and server Supabase clients
src/proxy.ts             Refreshes Supabase auth cookies on navigation
supabase/schema.sql      Database table, trigger and RLS policies
public/sw.js             Offline service worker
```

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

## Troubleshooting

**"Cloud sync isn't configured"**
Add the Supabase variables to `.env.local` (or to Vercel), then restart the dev server or redeploy.

**"Username must start with a letter" / "That username is taken"**
Usernames are 3–20 characters: a letter, then letters, numbers or underscores. A taken username means that internal address is already registered — sign in or choose another.

**Sign-up says confirmation is required (username mode)**
Turn **Confirm email** off under **Authentication → Sign In / Providers → Email** in Supabase. Username mode has no inbox to confirm with. The account was already created, so you can sign in once confirmation is off.

**"Confirm your email first" (email mode)**
Check your inbox for the confirmation link. For local development you can disable email confirmation in Supabase as described above.

**"Too many emails sent"**
Supabase's built-in email sender is heavily rate-limited. Configure custom SMTP under **Authentication → Emails → SMTP Settings**, or use a different account for testing.

**The confirmation or reset link opens an error page**
Make sure the current origin is listed under **Authentication → URL Configuration → Redirect URLs**. Links opened in a different browser than the one that requested them can also fail because the PKCE verifier is stored in that browser.

**TMDB requests fail**
Check that `TMDB_API_KEY` is set on the server/Vercel and that the key is a v3 API key.

**"Sync failed: Could not find the table 'public.tracked_items' in the schema cache" (PGRST205)**

1. In the Supabase dashboard, select the project whose ref matches your `NEXT_PUBLIC_SUPABASE_URL` (the part before `.supabase.co`).
2. Open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. Make sure it finishes without errors.
3. Check that the table exists by running `select * from public.tracked_items limit 1;` — it should return no rows and no error.
4. Back in the app, open **Settings → Cloud sync → Sync now**.

If the table already existed but the error persists, the PostgREST schema cache is stale. Run this in the SQL Editor, then retry sync:

```sql
notify pgrst, 'reload schema';
```

The setup script ends with that same reload, so re-running it also refreshes the cache. A common cause is running the script against a local CLI project or a different Supabase project than the one in your Vercel environment variables.

**"Sync failed" or "new row violates row-level security policy"**
Make sure `supabase/schema.sql` ran without errors, the Supabase variables point to the same project, and you are signed in. Sign out and back in if the session is stale.

**The library is empty on a new device**
Sign in with the same account and wait for the status in **Settings → Cloud sync** to show a recent sync. The first sync pulls the whole library.

**Sync stops working after a while**
Free Supabase projects pause after a period of inactivity. Open the Supabase dashboard and restore the project, then use **Settings → Cloud sync → Sync now**.

## License

This project is intended to be open source. Add a `LICENSE` file with the license you want to use (MIT and Apache-2.0 are common choices) before publishing your fork.
