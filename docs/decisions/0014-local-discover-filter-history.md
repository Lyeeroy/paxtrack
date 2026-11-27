# 0014 — Discover filter history in localStorage

- Date: 2026-11-27
- Status: accepted

## Context

The filter drawers shared a footer with a "Reset" button and a "Done" close button. Users wanted to get back to a filter set they had used before without rebuilding it, and to keep a favourite set around. This is purely local browser state: it must not enter the library store, IndexedDB or Supabase sync.

## Decision

- Only the **Discover** drawer changes: its "Done" button becomes **History**. The Search drawer keeps "Done", because its filters apply to already-loaded rows and are not a reusable query.
- `src/lib/filter-history.ts` is a small module-level `useSyncExternalStore` over `localStorage` under `tracker:discover-filter-history`, following the pattern used by `auth.ts` and `links.ts`. Reads are guarded for SSR and corrupt data; writes degrade gracefully when storage is unavailable.
- Every non-empty Discover filter set is recorded when the drawer closes. Entries are keyed by `discoverCacheKey()`, so reusing a set moves the same entry to the top instead of duplicating it. The eight most recent unstarred entries are kept; starred entries are never trimmed.
- The History view overlays the filter controls without removing them from layout, so Base UI's measured drawer height stays fixed ([ADR 0013](./0013-drawer-replaces-sheet.md)). Tapping a row applies that filter set and closes the drawer; a 44 px star button toggles "pinned" without applying; a `Badge`-styled "Clear history" button wipes the list. Summaries wrap to two lines instead of truncating early. The footer has Reset + History in the filter view and only Back in the history view — there is no Done button.

## Consequences

- Users can recover a previous query in one tap, and star a set to keep it beyond the recent cap.
- History is per browser and per origin. It is not exported, synced or cleared by account switches, which is the intended boundary for a convenience feature.
- The stored filter objects are re-normalized on load, so an old or hand-edited entry can never inject invalid genre ids or date ranges into the API request.
- Adding another filter drawer later should reuse `FilterDrawer`'s optional `footerAction` rather than duplicating the chrome; it will need its own history key if the feature is wanted there too.
