import type { SearchResult } from "@/lib/types";

/** Default Browse columns stop after this many pages (100 titles at 20/page). */
export const BROWSE_PAGE_CAP = 5;

/** Filtered Discover follows TMDB's own page count instead of an app-side cap. */
export const UNLIMITED_PAGES = Infinity;

/** Pages stored by number so late responses never append out of order. */
export interface PagedResults {
  pages: Record<number, SearchResult[]>;
  totalPages: number;
}

/** TMDB can repeat a title within a page; keep those ids unique. */
export function uniqueResults(list: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const id = `${r.type}-${r.tmdbId}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Last page this app will show for a column, bounded by TMDB and the cap. */
export function pageLimit(
  paged: PagedResults | undefined,
  cap = BROWSE_PAGE_CAP,
): number {
  if (!paged) return 0;
  const loaded = Object.keys(paged.pages).reduce(
    (max, key) => Math.max(max, Number(key)),
    0,
  );
  return Math.min(cap, paged.totalPages || loaded);
}

/**
 * Flatten page slots in order, stopping at the first gap so rows never jump
 * ahead. Duplicates across pages are kept on purpose: TMDB repeats a handful
 * of titles between pages, and dropping them would make one column shorter
 * than the others even though every column loaded the same pages.
 */
export function flattenPages(
  paged: PagedResults | undefined,
  cap = BROWSE_PAGE_CAP,
): SearchResult[] {
  if (!paged) return [];
  const limit = pageLimit(paged, cap);
  const list: SearchResult[] = [];
  for (let page = 1; page <= limit; page++) {
    const rows = paged.pages[page];
    if (!rows) break;
    list.push(...rows);
  }
  return list;
}

/** Highest page committed in every column; the only depth safe to render. */
export function sharedDepth(
  paged: (PagedResults | undefined)[],
  cap = BROWSE_PAGE_CAP,
): number {
  let depth = 0;
  while (depth < cap && paged.every((p) => !!p?.pages[depth + 1])) depth += 1;
  return depth;
}

/** First page any column still needs, or null when none is fetchable. */
export function nextSharedPage(
  paged: (PagedResults | undefined)[],
  cap = BROWSE_PAGE_CAP,
): number | null {
  // Bound the scan even with an unlimited cap: TMDB's reported total, or one
  // page past what is already loaded when it has not reported a total yet.
  const knownTotal = paged.reduce((max, s) => Math.max(max, s?.totalPages ?? 0), 0);
  const loaded = paged.reduce(
    (max, s) =>
      Object.keys(s?.pages ?? {}).reduce((m, key) => Math.max(m, Number(key)), max),
    0,
  );
  const ceiling = Math.min(cap, Math.max(knownTotal, loaded + 1));
  for (let page = 1; page <= ceiling; page++) {
    if (
      paged.some((shelf) => {
        if (shelf?.pages[page]) return false;
        // A column TMDB says is shorter than this page is already finished.
        return !shelf?.totalPages || shelf.totalPages >= page;
      })
    ) {
      return page;
    }
  }
  return null;
}
