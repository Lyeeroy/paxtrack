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
- Media type is an explicit toggle, not a preset: no type is selected by default (the home Discover column keeps the plain TV feed), and the other controls stay disabled until TV or Movies is picked because genre ids differ between them. Tapping the selected type clears every filter and restores the five columns. Search's four-way Type `ToggleGroup` likewise clears back to "All" when the active segment is tapped again.
- Genre is a multi-select `Combobox` with chips. Every picked genre must match, so ids are joined with commas into TMDB's `with_genres` (comma = AND, pipe = OR). Selection order is sorted before it reaches the cache key and the request.
- Filter changes apply immediately with no Apply button. Segmented `ToggleGroup`s (type, minimum rating), multi-select/filterable `Combobox`es (genre, language, library) and a chevron pull-from-top gesture all commit on selection; single-value comboboxes clear their displayed text when tapped so typing starts fresh. The release-year range is a two-thumb shadcn `Slider` from 1990 to next year; either endpoint at its bound means an open-ended range, so the stored values stay empty until a thumb actually moves. The footer is always rendered with "Reset filters" disabled when no filter is active, alongside a "Done" close action. Keeping the control rows and footer at a fixed height stops Base UI from resizing the content-sized drawer when a filter changes.
- Filtered Discover has **no page cap**: the browse route passes TMDB's `totalPages` through and pagination uses `UNLIMITED_PAGES` from `paged.ts`. Search results are uncapped the same way — the search route no longer clamps `page` or `totalPages` to 500. The default five Browse columns keep their 5-page cap and 500-page clamp.

## Consequences

- Filtered Discover is no longer one column among five, so the equal-length question only applies when no filter is active; ADR 0010 still holds for that default view.
- Each distinct filter combination occupies memory in the module-level page cache for the session. Combinations are bounded by what the user actually tries, and pages are only fetched while the user keeps pulling.
- TMDB discover responses are cached for an hour by the existing `tmdb()` helper, so rapid filter tweaks do not hammer upstream.
- The unified header icon turns green whenever the relevant filter set is active, so the current mode is visible without opening the sheet. Typing or clearing the query closes the sheet and switches which filter set the icon controls.
