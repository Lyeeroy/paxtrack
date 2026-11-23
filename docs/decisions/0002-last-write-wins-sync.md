# 0002 — Last-write-wins, pull-before-push sync

- Date: 2026-11-23 (recorded from the existing implementation)
- Status: accepted

## Context

Multiple devices can edit the same title while offline and then reconnect. There is no server-side application logic beyond Postgres triggers, and no dedicated sync service to arbitrate conflicts. The app needs a deterministic rule that converges without user intervention.

## Decision

Use **last-write-wins per title**, keyed by `Item.updatedAt` (epoch ms):

1. On sync, **pull first** with a server-assigned microsecond cursor (`server_ts`), then apply remote rows only when their `updatedAt` is newer than the local copy.
2. Push only local items newer than both the push cursor and the cloud copy just read.
3. The database enforces the same rule with a trigger that ignores upserts whose `updated_at` is not strictly greater than the stored row.
4. `commit()` bumps `updatedAt` to `max(Date.now(), old + 1)` so re-adds are never rejected by that trigger.

A 5-second overlap on the pull cursor covers same-tick writes; a pushed cursor set just before upload covers edits made during the upload.

## Consequences

- Two devices pushing simultaneously converge; the newer edit wins and the older one is ignored rather than overwriting.
- Reordering pull/push, advancing cursors before persistence, or narrowing the overlap can cause silent data loss — not just a stale UI.
- Clock skew between devices is not solved beyond the strict-greater comparison; the design accepts that as a reasonable trade-off for this app.
- Backup restore deliberately uses a *different* rule (watched-episode count) because an old timestamp in a backup file would otherwise be rejected by sync.
