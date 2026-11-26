# 0010 — Balanced Browse pagination

- Date: 2026-11-26
- Status: accepted

## Context

After [ADR 0009](./0009-deliberate-bottom-pull-pagination.md), a pull loaded the active column's next page and prefetched the next column. That made the column the user happened to be browsing much longer than the others: Trending could show 100 rows while Discover still showed 20. TMDB returns exactly 20 results per page for every category, so the imbalance was entirely client-side page scheduling, not upstream data.

TMDB also repeats a small number of titles between pages (about 10 of 100 in Trending at the time). Dropping those repeats to dedupe globally shortened some columns by a few rows, which was visible as ragged column ends.

## Decision

- Every pull (and the single “Load more” pill shown from `sm` up) fetches the **same next page for all five columns** in parallel. No column can be advanced on its own.
- Columns render only the depth **all five have committed** (`sharedDepth()` in `src/lib/paged.ts`), and show equal skeletons while the shared page is in flight. A slow or failed response therefore holds every column at the previous page instead of creating a gap.
- Deduplication is **per page**, not across pages. A repeated title from TMDB stays visible; matching row counts matter more than hiding an upstream data quirk.
- The cap remains 5 pages / 100 titles per column. At the cap the pull is disabled and the global button is removed. There are no per-column buttons or “No more in {label}” lines.

## Consequences

- All columns now end at exactly the same row count (100 at the cap). A repeated title can appear twice in a column; that is TMDB data, not a client bug. Rows are keyed by page position because `type-tmdbId` is no longer unique across the flattened list.
- Each pull issues up to five requests at once instead of one. They are deduped per `category:page`, so repeated pulls or rapid tab switches never double-fetch a page.
- A column with a lower TMDB `totalPages` simply stops; `nextSharedPage()` skips it and the other columns cap at the same depth.
- Reintroducing per-column loads or a global cross-page dedupe would recreate the ragged columns this ADR fixes.
