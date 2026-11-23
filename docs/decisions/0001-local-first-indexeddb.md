# 0001 — Local-first IndexedDB cache

- Date: 2026-11-23 (recorded from the existing implementation)
- Status: accepted

## Context

The app is meant to work offline and open instantly, including on cheap phones with flaky connections. A server-authoritative model would make every tap depend on a network round trip and would leave an empty screen offline. Supabase is optional in this deployment — the app must be fully usable with no env vars at all.

## Decision

The browser is the source of truth for reading and writing. `src/lib/store.ts` holds the library in memory, backed by IndexedDB (`src/lib/idb.ts`, database `tracker`, stores `items`/`eps`/`kv`). The UI reads through `useSyncExternalStore`, so changes are visible immediately and persist without waiting for the cloud. Supabase is a backup/sync layer layered on top, not the primary database.

A custom ~1 KB IndexedDB wrapper is used instead of adding a dependency.

## Consequences

- The app opens instantly and works fully offline; the service worker caches the shell and posters.
- All code that touches the library must respect persistence ordering (write to IDB before mutating memory or advancing cursors) and the epoch/flush rules on account switch.
- Conflict resolution happens client-side on pull and is reinforced by the database; see [0002](./0002-last-write-wins-sync.md).
- A browser can hold only one account's cache at a time, hence `tracker:owner` and `resetLocalData()`.
- Adding a state-management or IDB library would duplicate existing machinery and is therefore discouraged (the "replicant" rule).
