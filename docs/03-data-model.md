# 03 — Data model and storage keys

All domain types live in `src/lib/types.ts`. There is no ORM and no database client in the browser other than the small IndexedDB wrapper.

## Core types

### `Item` — one tracked title

Defined in `src/lib/types.ts`.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | `${type}-${tmdbId}`, e.g. `tv-1396`. Primary key everywhere. |
| `tmdbId` | `number` | TMDB id. |
| `type` | `"tv" \| "movie"` | Drives almost every branch in the UI. |
| `title`, `poster` | `string`, `string \| null` | Cached TMDB display data. Poster is a path, not a URL. |
| `anime` | `boolean` | Genre/language heuristic from TMDB; only used for the label and search. |
| `status` | `Status` | `watching` / `planned` / `completed` / `dropped`. |
| `watched` | `Record<string, number>` | Map of episode key → watched timestamp in ms. Movies use the key `"m"`; TV uses `"1x5"` (`season x episode`). Presence = watched. |
| `releaseDate` | `string \| null` | `YYYY-MM-DD`, used for movies and "ongoing?" checks. |
| `tvStatus` | `string` | Raw TMDB status. `Returning Series` / `In Production` / `Planned` count as ongoing. |
| `addedAt`, `updatedAt` | `number` | Epoch ms. `updatedAt` is the last-write-wins token. |
| `refreshedAt` | `number` | Epoch ms of last metadata refresh. |
| `deleted` | `boolean` | Soft-delete tombstone. Filtered from the UI but kept in storage/sync. |
| `preview` | `boolean` | Opened from search only. Not persisted until the first real change; discarded when the detail view closes. |

### Other types

- `EpData` — `{ id, seasons: { n, eps: { e, name, air }[] }[] }`. Stored separately from `Item` because a full episode list is large and rarely changes. `air` is `YYYY-MM-DD` or `null` (TBA).
- `SearchResult` — lightweight TMDB search row (`tmdbId`, `type`, `title`, `year`, `poster`, `anime`).
- `TitlePayload` — the full metadata response used by `saveTitle()`. Its optional `overview`, `genres`, `voteAverage` and `runtime` fields are descriptive extras for the info sheet: they are injected into an in-memory cache by `refresh.ts` (`cachedInfo` / `loadInfo`) and are **not** copied onto `Item`, so they are never persisted or synced. The TMDB title route returns them for both movies and TV (TV runtime is the episode runtime).
- `Backup` — `{ version: 1, exportedAt, items, eps }`.
- `Ep` (derived, `episodes.ts`) — flattened episode with `key` (`${s}x${e}`) plus `s`, `e`, `name`, `air`. `flatEps()` memoizes per `EpData` object with a `WeakMap`.
- `Stats` (derived, `episodes.ts`) — `watched`, `aired`, `total`, `progress`, `next`, `upcoming`, `backlog`, `lastAiredIdx`. Computed from the item + episode data + today; never stored.

## IndexedDB — database `tracker`, version 1

Opened in `src/lib/idb.ts`. Three object stores, all keyed by `id`:

| Store | Value | Written by |
| --- | --- | --- |
| `items` | `Item` (including tombstones) | `store.ts` via `idbPut` / `idbPutMany` / `idbPutIfNewer` |
| `eps` | `EpData` | `store.ts` (`saveTitle`, `importBackup`) |
| `kv` | `{ id, v }` | `kvSet` — currently only `notified` (notification dedupe ids) |

Important behaviours:

- `idbPutIfNewer()` reads and writes inside **one transaction**, so a cloud pull cannot overwrite a local edit that lands while it is being applied.
- All write helpers register their promise in `pendingWrites`; `idbFlush()` waits for them. This is used before clearing stores on an account switch.
- `navigator.storage.persist()` is requested at boot so the browser is less likely to evict the library.

## localStorage keys

| Key | Meaning |
| --- | --- |
| `tracker:owner` | User id whose library this browser currently holds. |
| `tracker:pushed:<uid>` | Millisecond cursor: local edits up to this time have been uploaded. |
| `tracker:since:<uid>` | Microsecond `server_ts` cursor: remote rows up to this point have been pulled. |
| `tracker:synced-at:<uid>` | Last successful sync time, displayed in Settings. |
| `tracker:notif` | `"1"` when release notifications are enabled by the user. |
| `tracker:customLinks` | JSON array of URL **templates** added from the info drawer's Links page (global; not part of backups). Each is expanded on use so `{season}`/`{episode}` follow current library progress (see `src/lib/links.ts`). |
| legacy: `tracker:key`, `tracker:last`, `tracker:pushed`, `tracker:synced-at` | Removed at `startAutoSync()`; from the old custom sync-key backend. |

Note the **unit mismatch**: `updatedAt`/`pushed`/`synced-at` are epoch **milliseconds** from JavaScript; `server_ts`/`since` are epoch **microseconds** from Postgres (`extract(epoch from clock_timestamp()) * 1000000`). Never compare them directly.

## Supabase — `public.tracked_items`

Defined in `supabase/schema.sql` (idempotent; safe to re-run).

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` FK → `auth.users` | Part of primary key; set from `auth.uid()` via RLS. |
| `item_id` | `text` | The `Item.id`. |
| `data` | `jsonb` | The entire `Item` JSON, including `watched`, `deleted`, etc. |
| `updated_at` | `bigint` | Client's `Item.updatedAt` (ms). Conflict-resolution token. |
| `server_ts` | `bigint` | Server-assigned microseconds, set by a trigger on every insert/update. Pull cursor. |
| `deleted` | `boolean` | Mirrors the `Item.deleted` tombstone. |

- Primary key `(user_id, item_id)`; index `(user_id, server_ts)` for incremental pulls.
- Trigger `tracked_items_server_ts` refreshes `server_ts` on every write so other devices can see the row.
- Trigger `tracked_items_lww` returns `null` when `new.updated_at <= old.updated_at`, i.e. a stale upsert is silently ignored instead of overwriting a newer edit.
- RLS policies restrict select/insert/update/delete to `auth.uid() = user_id`; `anon` has no privileges at all. The script ends with `notify pgrst, 'reload schema'` to avoid PGRST205 after first run.

## Backup format

`createBackup()` produces the `Backup` shape above with pretty-printed JSON. `parseBackup()` accepts current and older `{ items }`-only files, validates every field, rejects files over 10 MB, and deduplicates ids newest-wins. Merge decisions are made in `planBackupMerge()` / `importBackup()` using watched counts, not timestamps (see [02-architecture.md](./02-architecture.md#backup-importexport)).
