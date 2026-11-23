# 02 — Architecture and data flow

## Layering

```text
  UI (src/components/*, all client components)
        │  reads via hooks, calls exported functions
        ▼
  External-store modules (src/lib/*)
  store.ts     auth.ts     sync.ts     toast.ts     notify.ts
        │  useSyncExternalStore + module-level state + listener sets
        ▼
  Persistence / IO
  idb.ts (IndexedDB)   localStorage cursors   supabase/client.ts   fetch(/api/…)
        │
        ▼
  Server (src/app/... routes, src/proxy.ts, supabase/schema.sql)
```

Rule of thumb: **components never touch IndexedDB, Supabase or `fetch` directly.** They call functions from `src/lib/` and subscribe with a `useX()` hook. `Search.tsx` is a small exception — it owns its own transient query cache and fetches `/api/tmdb/search`, but still writes through `addItem()` / `createPreview()`.

## The in-memory store (`src/lib/store.ts`)

- Module-level `Map<string, Item>` for items, a plain object for `eps` (`Record<string, EpData>`), and an immutable `snap` rebuilt by `emit()`.
- `useStore()` is a thin `useSyncExternalStore` wrapper; server snapshot is the same object.
- `getSnapshot()` exists for imperative, non-React readers (`refresh.ts`, `notify.ts`, `App.tsx`).
- Two listener sets: `listeners` (re-render on any state change) and `changeListeners` (**local user edits only**, used to schedule cloud sync). Remote applies deliberately do not fire `changeListeners`.
- `emit()` filters out `deleted` and `preview` items, so the UI only ever sees visible library items. `allItemsRaw()` is the unfiltered version used by sync.

Every mutator funnels through `commit(item, touch = true)`, which:
1. bumps `updatedAt` to `max(Date.now(), old.updatedAt + 1)` so a re-add is never rejected by Supabase's last-write-wins trigger;
2. promotes a `preview` item into a persisted one on its first real change;
3. persists to IndexedDB, emits a render, and (only for local changes) notifies sync.

## Write path (a tap on "watch episode")

```text
Detail/Library.tsx → toggleEpisode() / quickWatch()
  → setWatched() → withAutoStatus() → commit()
  → idbPut("items", …)        (fire-and-forget, tracked in idb.pendingWrites)
  → emit()                    (UI re-render)
  → changeListeners           → sync.ts debounces 2.5 s → syncNow()
```

Status can change automatically: watching a first episode moves `planned → watching`; finishing the last aired episode of a movie or a non-ongoing show moves to `completed`. `saveTitle()` can move a `completed` show back to `watching` when TMDB reports new episodes for a returning series.

## Sync engine (`src/lib/sync.ts`)

`syncNow()` is serialized: if a sync is already running it sets `again = true` and returns the in-flight promise; the loop runs once more after it finishes. `startAutoSync()` is idempotent and registers triggers once.

Each `runOnce()`:

1. **Preconditions** — configured? online? signed in? Otherwise sets status `unconfigured` / `offline` / `signed-out`.
2. **Claim the cache** — `claimLocalData(userId)` compares `tracker:owner` with the current user id. First sign-in adopts the local library; a different account calls `resetLocalData()` (bumps `epoch`, flushes in-flight IndexedDB writes, clears stores, resets memory) before pulling its own data. This is what prevents one user's library being uploaded to another account.
3. **Pull first** — pages through `tracked_items` with `.gt("server_ts", pageCursor)`, ordered ascending, 500 rows at a time, starting at `since − 5_000_000` µs (a small overlap for clock/commit races). Rows are collected into a `Map<itemId, Item>` keyed by the `data` JSON.
4. **Re-check the account** after the request; if it changed mid-flight, abort without applying.
5. **Apply remote** — `applyRemote()` keeps rows whose `updatedAt` is newer than the local copy, writes them to IndexedDB **before** advancing the `since` cursor, then updates memory and emits. A failed write therefore retries instead of silently dropping rows.
6. **Push** — upload only local items with `updatedAt > pushed` **and** newer than the cloud copy just read, in batches of 500, using `upsert(..., { onConflict: "user_id,item_id" })`. The `pushed` cursor is set to `pushStarted - 1` so edits made during the upload are picked up next time.
7. **Finish** — set `tracker:synced-at:<uid>` and status `idle` with a timestamp. Any error becomes `error` (or `offline`).

Why pull before push: pushing first could overwrite a newer cloud copy with stale local data. The database reinforces this with its own last-write-wins trigger.

## Auth (`src/lib/auth.ts`, `src/lib/supabase/*`)

- Two modes from `NEXT_PUBLIC_AUTH_MODE`. Username mode derives a private, non-deliverable email (`<username>@users.example.com`) and stores the username in `user_metadata`; email mode uses real addresses and Supabase emails.
- `getBrowserClient()` is created lazily so the app runs with no Supabase env vars. The server client is per-request via `cookies()` from `next/headers`.
- `onAuthChange()` fires only on real sign-in/out events, not token refreshes; that is what triggers sync.
- `/auth/callback` exchanges a PKCE code; `/auth/confirm` verifies a token hash from a custom email template. Both use `safeNext()` to force same-origin relative redirects and `publicOrigin()` to honour Vercel's forwarded host. All redirect responses are `no-store`.
- `src/proxy.ts` (Next.js 16's renamed middleware) refreshes auth cookies on navigation. It never blocks the page on failure — RLS is the security boundary, so the worst case is being signed out.

## Metadata flow (`src/app/api/tmdb/*`)

- `GET /api/tmdb/search?q=…` proxies `/search/multi`, or `/trending/all/week` when `q` is empty; maps TMDB results to `SearchResult` and marks anime via `isAnime()` (genre 16 + Japanese language/origin).
- `GET /api/tmdb/title?type=&id=` proxies movie or TV details. For TV it fetches seasons in chunks of 15 via `append_to_response`, returning the full `TitlePayload` including every episode's air date.
- `src/lib/tmdb-server.ts` holds the only code that reads `TMDB_API_KEY` and calls TMDB, with `fetch(..., { next: { revalidate } })`. The key never reaches the browser.
- `refresh.ts` refreshes stale items (default 6 h) with a 2-worker queue, deduplicating in-flight requests by `epoch:itemId`. `Detail.tsx` refreshes the opened title when its data is missing or older than 1 h.

## Notifications — two paths, keep them in sync

1. **In-page** — `src/lib/notify.ts`, called from `App.tsx` boot and on visibility/online events. Reads the in-memory snapshot and shows notifications via `navigator.serviceWorker.ready`.
2. **Background** — `public/sw.js` `periodicsync` handler (Chromium, tag `check-releases`, min interval 12 h). It opens IndexedDB itself and re-implements the same "releases in the last two days" logic in plain JS.

Both deduplicate through the `kv` store key `notified` (capped at 600 ids) and use the same `item:key` event ids. **If you change release-detection rules, change both files.**

## Service worker caching (`public/sw.js`)

- `SHELL` (`shell-v4`) caches `/` and other same-origin assets; bump it when icons change.
- `STATIC` caches `/_next/static/*` cache-first; `IMAGES` caches `image.tmdb.org` posters cache-first, trimmed to 400 entries.
- `/api/*` is deliberately not cached — data lives in IndexedDB.
- Navigations are network-first with the cached shell as fallback; other same-origin requests are stale-while-revalidate.
- Registered only when `NODE_ENV === "production"`.

## Backup import/export

- `createBackup()` writes `{ version: 1, exportedAt, items, eps }`; `parseBackup()` accepts that plus older `{ items }`-only files, validates fields, caps size at 10 MB and resolves duplicate ids newest-wins.
- `planBackupMerge()` previews add/replace/keep counts. The merge rule is **watched-episode count, not timestamp**: the side with more watched episodes wins, ties go to the backup. Applied items get a fresh `updatedAt` so sync can push them (an old backup timestamp would be rejected by the cloud).
- Episode lists from the backup are applied to restored titles and used to fill missing lists, but never overwrite a local list for a kept title.
