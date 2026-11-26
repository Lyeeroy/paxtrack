# 0012 — Filtered Discover keeps its own cache lane

- Date: 2026-11-26
- Status: accepted

## Context

Discover is one of the five Search-landing columns and was a fixed `/discover/tv?sort_by=popularity.desc` feed. Users wanted to narrow it by genre, original language, minimum rating, a release-year range and TV vs movie. Those fields are not in `SearchResult`, so they cannot be filtered client-side; they have to reach TMDB's `/discover/movie` or `/discover/tv` endpoint.

[ADR 0010](./0010-balanced-browse-pagination.md) deliberately keeps all five columns at one shared depth so a pull grows them together. A filtered Discover has a different, usually shorter `totalPages`, so forcing it through `sharedDepth()` would freeze the other four columns the moment a filter reduces Discover to one page. Refetching every column on each filter tap would also throw away the user's loaded pages in the other four columns.

## Decision

- `src/lib/discover.ts` is the single source for filter shape, validation, cache key and TMDB params. The browser sends only whitelisted values to `/api/tmdb/browse`; the route re-validates them with the same normalizer before calling TMDB, so a crafted query cannot inject arbitrary parameters.
- Discover's cache key includes the normalized filter set (`discover:type:genre:language:rating:from:to`). Changing a filter creates a fresh page-1 slot instead of overwriting the default feed, so returning to a previous filter combination is instant and the other columns never refetch.
- A single filter icon in the Search screen header serves both modes: it opens Discover filters while the search input is empty, and Search filters once a query is typed. An icon inside the Discover column header was rejected — it was easy to miss and made the column header busy.
- While any Discover filter is active, the five-column carousel is replaced by one full-width `MediaRow` list of Discover results, paginated by the same pull plus the `sm` "Load more" fallback. Clearing the filters restores the original five columns with their cached pages untouched. The four unfiltered columns keep their shared depth; Discover reveals its own committed pages via `pageLimit()` and stops when its `totalPages` is exhausted.
- Filter changes apply immediately with no Apply button. Chips and the language select commit on tap; year inputs keep a short draft so a partially typed year is not erased, then debounce. A "Reset filters" action appears only while a filter is active.
- Filtered Discover has **no page cap**: the browse route passes TMDB's `totalPages` through and pagination uses `UNLIMITED_PAGES` from `paged.ts`. Search results are uncapped the same way — the search route no longer clamps `page` or `totalPages` to 500. The default five Browse columns keep their 5-page cap and 500-page clamp.

## Consequences

- Filtered Discover is no longer one column among five, so the equal-length question only applies when no filter is active; ADR 0010 still holds for that default view.
- Each distinct filter combination occupies memory in the module-level page cache for the session. Combinations are bounded by what the user actually tries, and pages are only fetched while the user keeps pulling.
- TMDB discover responses are cached for an hour by the existing `tmdb()` helper, so rapid filter tweaks do not hammer upstream.
- The unified header icon turns green whenever the relevant filter set is active, so the current mode is visible without opening the sheet. Typing or clearing the query closes the sheet and switches which filter set the icon controls.
