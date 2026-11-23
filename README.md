# Tracker

A small, offline-first episode tracker for anime, TV shows and movies. Your library lives in the browser first, so it keeps working without a connection. Sign in with a Supabase account to back it up and sync it across devices.

## Features

- Track TV/anime episodes and movies with a next-up queue
- Release calendar, watch history and per-title progress
- Works offline (IndexedDB + service worker) and installs as a PWA
- Optional release-day notifications
- Email/password accounts and multi-device sync through Supabase
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

In the Supabase dashboard, open **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` while developing
- **Redirect URLs**: add `http://localhost:3000/**`

The app uses email/password sign-in. Confirmation and password-reset links land on `/auth/callback`, which exchanges the code for a session and then forwards to the app.

Email auth is enabled by default. For quick local development you can turn off **Confirm email** under **Authentication → Sign In / Providers → Email** so new accounts can sign in immediately. For a real deployment, leave confirmation on and configure your own SMTP provider under **Authentication → Emails → SMTP Settings**; Supabase's built-in email service is rate-limited and not meant for production traffic.

## 5. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

```dotenv
TMDB_API_KEY=your_tmdb_v3_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Find the Supabase values under **Project Settings → API Keys**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Publishable key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Older projects can use the legacy anon key instead:

```dotenv
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Both keys are public and safe to ship to the browser. If both are present, the publishable key is used.

`TMDB_API_KEY` is server-only. It is used by the `/api/tmdb/*` route handlers and is never sent to the browser.

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
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy.
5. Back in Supabase, update **Authentication → URL Configuration**:
   - **Site URL**: `https://your-project.vercel.app`
   - **Redirect URLs**: add `https://your-project.vercel.app/**`
6. If you changed environment variables after deploying, trigger a new deployment so they take effect.

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
  auth/callback/         Supabase auth code exchange
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

**"Confirm your email first"**
Check your inbox for the confirmation link. For local development you can disable email confirmation in Supabase as described above.

**"Too many emails sent"**
Supabase's built-in email sender is heavily rate-limited. Configure custom SMTP under **Authentication → Emails → SMTP Settings**, or use a different account for testing.

**The confirmation or reset link opens an error page**
Make sure the current origin is listed under **Authentication → URL Configuration → Redirect URLs**. Links opened in a different browser than the one that requested them can also fail because the PKCE verifier is stored in that browser.

**TMDB requests fail**
Check that `TMDB_API_KEY` is set on the server/Vercel and that the key is a v3 API key.

**"Sync failed" or "new row violates row-level security policy"**
Make sure `supabase/schema.sql` ran without errors, the Supabase variables point to the same project, and you are signed in. Sign out and back in if the session is stale.

**The library is empty on a new device**
Sign in with the same account and wait for the status in **Settings → Cloud sync** to show a recent sync. The first sync pulls the whole library.

**Sync stops working after a while**
Free Supabase projects pause after a period of inactivity. Open the Supabase dashboard and restore the project, then use **Settings → Cloud sync → Sync now**.

## License

This project is intended to be open source. Add a `LICENSE` file with the license you want to use (MIT and Apache-2.0 are common choices) before publishing your fork.
