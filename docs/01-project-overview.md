# 01 — Project overview

## What this app is

**Tracker** is a small, offline-first episode tracker for anime, TV shows and movies. The library lives in the browser first (IndexedDB), so the app keeps working without a connection. Signing in with a Supabase account optionally backs it up and syncs it across devices. Metadata and artwork come from TMDB through this app's own server routes.

It is a mobile-first single-page PWA: one `max-w-xl` column, a fixed bottom tab bar, and a detail view that slides over the current screen. There is no router-driven navigation inside the app — tabs are React state.

## Stack (pinned in `package.json`)

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16.4.6, App Router |
| UI | React 19.2.6, TypeScript 5.9.3 (strict) |
| Styling | Tailwind CSS 4.1.17 via `@tailwindcss/postcss` |
| Backend | Supabase Auth + Postgres (`@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.119.2) |
| Metadata | TMDB v3 API, called only from server route handlers |
| Local storage | IndexedDB through a tiny in-house promise wrapper (no dependency) |
| Offline | Service worker in `public/sw.js`, PWA manifest in `src/app/manifest.ts` |
| Hosting | Vercel (no separate sync server) |

Requirements: Node 20.9+, a Supabase project (optional — local-only mode works without it) and a TMDB v3 API key (required for search/metadata).

## The shape of the code

```text
src/app/                     Route Handlers and route files (server-side)
  api/tmdb/search/route.ts   Search + weekly trending (TMDB proxy, paginated via ?page=)
  api/tmdb/browse/route.ts   Five browse columns (Discover/Trending/Popular/Top rated/In cinema)
  api/tmdb/title/route.ts    Title metadata + full episode lists
  auth/callback/route.ts     PKCE code → session cookie
  auth/confirm/route.ts      Custom email-template token verification
  auth/reset/page.tsx        "Choose a new password" screen
  auth/error/page.tsx        Sign-in link failure screen
  page.tsx                   Renders <App /> — the whole app is client-side
  layout.tsx / manifest.ts / globals.css / icon.svg / apple-icon.tsx
src/components/              All UI, every file "use client"
  App.tsx                    Shell, tab state, boot sequence, detail navigation
  Library / Detail / Search / Browse / Upcoming / History / Settings / CloudSync
  ui.tsx                     Icons and shared primitives (Poster, Progress, SwipeRow, …)
src/lib/                     State and side effects
  store.ts                   In-memory library + IndexedDB persistence (the source of truth)
  idb.ts                     IndexedDB wrapper
  sync.ts                    Supabase push/pull engine and status
  auth.ts / auth-config.ts   Auth state, username↔email mapping, mode switch
  episodes.ts                Episode flattening, stats, date helpers
  backup.ts / refresh.ts / notify.ts / actions.ts / toast.ts
  supabase/{client,server,config}.ts
src/proxy.ts                 Refreshes Supabase auth cookies on navigation (formerly middleware)
supabase/schema.sql          Table, triggers, indexes and RLS policies
public/sw.js                 Offline caching + background release checks
```

## Boot sequence

`App.tsx` owns startup. Everything below happens once on mount, in this order:

1. `initStore()` loads `items` and `eps` from IndexedDB into memory and calls `navigator.storage.persist()`.
2. `startAutoSync()` wires up sync triggers (auth change, local change with a 2.5 s debounce, `online`, tab visible) and runs an initial sync.
3. `initAuth()` subscribes to Supabase auth events and reads the persisted session.
4. `refreshStale()` re-fetches metadata for active titles older than ~6 hours (2-worker pool).
5. `checkNotifications()` runs for releases in the last two days; `registerPeriodic()` asks for Chromium periodic sync if already enabled.

Separately, on mount, `/sw.js` is registered in production only. The UI renders nothing until `store.ready` is true, so it never flashes an empty library.

## Configuration surface

- `TMDB_API_KEY` — server-only, read in `src/lib/tmdb-server.ts`.
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — both public; RLS is the security boundary. Empty means local-only mode.
- `NEXT_PUBLIC_AUTH_MODE` — `username` (default) or `email`. See `src/lib/auth-config.ts`.

Copy `.env.example` to `.env.local` to start. Never add a service-role key or any secret without `NEXT_PUBLIC_` that the browser would need.

## Where to start for a given task

| Task | Read first |
| --- | --- |
| Adding/changing a library action (watch, status, remove) | `src/lib/store.ts`, `src/lib/actions.ts` |
| Changing sync behaviour | `src/lib/sync.ts`, `supabase/schema.sql` |
| Auth / account UI | `src/lib/auth.ts`, `src/components/CloudSync.tsx` |
| A new screen or UI primitive | `src/components/App.tsx`, `src/components/ui.tsx` |
| Episode maths, dates, "next up" | `src/lib/episodes.ts` |
| Offline / notifications | `public/sw.js`, `src/lib/notify.ts` |
| A Next.js API question | `node_modules/next/dist/docs/` (version-matched; see root `AGENTS.md`) |

## Read next

- [02-architecture.md](./02-architecture.md) — how the pieces talk to each other.
- [03-data-model.md](./03-data-model.md) — every stored field and cursor.
- [04-conventions.md](./04-conventions.md) — how we write code here.
- [05-gotchas.md](./05-gotchas.md) — traps that cost time.
