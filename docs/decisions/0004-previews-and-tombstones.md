# 0004 — Previews and soft-delete tombstones

- Date: 2026-11-23 (recorded from the existing implementation)
- Status: accepted

## Context

Two UX problems share one solution. Opening a title from search should let a user inspect it before committing it to their library. Removing a title must still tell other devices to remove it — simply deleting the local row would let the next sync pull it straight back from the cloud.

## Decision

`Item` carries two flags (`src/lib/types.ts`):

- `preview: true` — created by `createPreview()` when a search result is opened. It lives only in memory; `emit()` filters it from the UI's item list, and `discardPreview()` drops it when the detail view closes without changes. The first real change promotes it to a persisted item in `commit()`.
- `deleted: true` — a tombstone. `removeItem()` marks the item deleted and clears its `watched` map instead of deleting the row. The tombstone is filtered from the UI but kept in IndexedDB and uploaded to Supabase (`deleted` column), so other devices learn about the removal.

`emit()` filters both flags out of the visible snapshot; `allItemsRaw()` keeps previews out but retains tombstones for sync. Re-opening a removed title from search creates a fresh preview (`createPreview()` ignores an existing tombstone), and tapping a status is how it is added back.

## Consequences

- Search can be opened without polluting the library, and deletions propagate across devices with no separate delete endpoint.
- Tombstones accumulate in storage; the app accepts this as a small cost for correctness.
- Any new code that reads items must decide explicitly whether it wants the visible snapshot (`useStore`/`getSnapshot`) or the sync-facing raw list (`allItemsRaw`).
- Treating `deleted` as a hard delete, or persisting previews on open, would break cross-device removal and the preview UX respectively.
