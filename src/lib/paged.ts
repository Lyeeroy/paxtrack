import type { SearchResult } from "@/lib/types";

/** Browse stops after this many pages per column (100 titles at 20/page). */
export const BROWSE_PAGE_CAP = 5;

/** Pages stored by number so late responses never append out of order. */
export interface PagedResults {
  pages: Record<number, SearchResult[]>;
  totalPages: number;
}

/** TMDB can repeat a title across pages; keep ids unique in the rendered list. */
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
export function pageLimit(paged: PagedResults | undefined, cap = BROWSE_PAGE_CAP): number {
  if (!paged) return 0;
  const loaded = Object.keys(paged.pages).reduce((max, key) => Math.max(max, Number(key)), 0);
  return Math.min(cap, paged.totalPages || loaded);
}

/** Flatten page slots in order, stopping at the first gap so rows never jump ahead. */
export function flattenPages(paged: PagedResults | undefined, cap = BROWSE_PAGE_CAP): SearchResult[] {
  if (!paged) return [];
  const limit = pageLimit(paged, cap);
  const list: SearchResult[] = [];
  for (let page = 1; page <= limit; page++) {
    const rows = paged.pages[page];
    if (!rows) break;
    if (rows.length) list.push(...rows);
  }
  return uniqueResults(list);
}

/** First missing page in order, or null when the column has everything it will show. */
export function nextPage(paged: PagedResults | undefined, cap = BROWSE_PAGE_CAP): number | null {
  if (!paged) return null;
  const limit = pageLimit(paged, cap);
  if (!limit) return null;
  for (let page = 1; page <= limit; page++) {
    if (!paged.pages[page]) return page;
  }
  return null;
}

/** Highest page any column has loaded; drives Browse catch-up. */
export function deepestPage(cache: Map<string, PagedResults>): number {
  let max = 0;
  for (const paged of cache.values()) {
    for (const key of Object.keys(paged.pages)) max = Math.max(max, Number(key));
  }
  return max;
}
