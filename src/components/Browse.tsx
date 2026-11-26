"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { discoverCacheKey, discoverQuery, filtersActive, type DiscoverFilters } from "@/lib/discover";
import type { Item, SearchResult } from "@/lib/types";
import {
  flattenPages,
  nextSharedPage,
  pageLimit,
  sharedDepth,
  uniqueResults,
  UNLIMITED_PAGES,
  type PagedResults,
} from "@/lib/paged";
import MediaRow from "./MediaRow";
import PullUpToLoad from "./PullUpToLoad";
import { Empty } from "./ui";

type Category = "discover" | "trending" | "popular" | "top-rated" | "in-cinema";

const SHELVES: { key: Category; label: string; hint: string }[] = [
  { key: "discover", label: "Discover", hint: "Fresh finds" },
  { key: "trending", label: "Trending", hint: "This week" },
  { key: "popular", label: "Popular", hint: "Most watched" },
  { key: "top-rated", label: "Top rated", hint: "Best rated" },
  { key: "in-cinema", label: "In cinema", hint: "Now playing" },
];

type Column = { category: Category; key: string; query: string };

/** Page slots per column, kept across search-query changes and tab switches. */
const cache = new Map<string, PagedResults>();
/** One request per column:page, shared by the pull and the button. */
const inflight = new Map<string, Promise<void>>();

/** Column margin; must match `mr-2.5` in the markup. */
const GAP = 10;

function keyOf(key: string, page: number) {
  return `${key}:${page}`;
}

/**
 * Discover gets its own cache key per filter set so changing a filter never
 * refetches (or lengthens) the four untouched columns.
 */
function columnsFor(filters: DiscoverFilters): Column[] {
  const discoverKey = discoverCacheKey(filters);
  const discoverQueryString = new URLSearchParams(discoverQuery(filters)).toString();
  return SHELVES.map((s) =>
    s.key === "discover"
      ? { category: s.key, key: discoverKey, query: discoverQueryString }
      : { category: s.key, key: s.key, query: `category=${s.key}` },
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line/60 py-2.5">
          <div className="h-16 w-11 shrink-0 rounded-md bg-surface" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-surface" />
            <div className="h-2.5 w-1/2 rounded bg-surface" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function Browse({
  items,
  onOpen,
  onOverscroll,
  discoverFilters,
}: {
  items: Item[];
  onOpen: (id: string, preview?: Item) => void;
  /** Drag past the first/last column moves to the adjacent tab instead. */
  onOverscroll?: (dir: 1 | -1) => void;
  /** Active Discover filters: a non-default set turns the carousel into one full-width list. */
  discoverFilters: DiscoverFilters;
}) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [active, setActive] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const tracked = new Map(items.map((i) => [i.id, i]));
  const columns = useMemo(() => columnsFor(discoverFilters), [discoverFilters]);
  const firstLoad = useRef(true);

  /** Fetch one page, deduping every caller through the same promise. */
  const loadPage = useCallback(
    async (column: Column, page: number) => {
      if (cache.get(column.key)?.pages[page]) return;
      const id = keyOf(column.key, page);
      const running = inflight.get(id);
      if (running) return running;
      const task = (async () => {
        try {
          const res = await fetch(`/api/tmdb/browse?${column.query}&page=${page}`);
          if (!res.ok) throw new Error();
          const json = (await res.json()) as {
            results: SearchResult[];
            page: number;
            totalPages: number;
          };
          const current = cache.get(column.key) ?? { pages: {}, totalPages: 0 };
          cache.set(column.key, {
            pages: { ...current.pages, [json.page]: uniqueResults(json.results) },
            totalPages: json.totalPages,
          });
        } catch {
          /* Leave the slot empty so the next pull/button retries this page. */
        } finally {
          inflight.delete(id);
          bump();
        }
      })();
      inflight.set(id, task);
      bump();
      return task;
    },
    [bump],
  );

  // First page for every column. Cached columns skip the request entirely;
  // a filter change debounces briefly so typing a year is one request.
  useEffect(() => {
    const delay = firstLoad.current ? 0 : 200;
    firstLoad.current = false;
    const t = setTimeout(() => {
      for (const column of columns) {
        if (!cache.get(column.key)?.pages[1]) void loadPage(column, 1);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [columns, loadPage]);

  const step = () => (colRefs.current[0]?.offsetWidth ?? 0) + GAP;

  // The browser owns the fling and the snap, so all this needs is the current
  // page for the dots. No pointer handlers, no rAF, no velocity estimation.
  const onScroll = () => {
    const vp = viewportRef.current;
    const s = step();
    if (!vp || s <= 0) return;
    const index = Math.max(0, Math.min(SHELVES.length - 1, Math.round(vp.scrollLeft / s)));
    setActive((prev) => (prev === index ? prev : index));
  };

  const jumpTo = (index: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Snap-stop: always can trap a programmatic multi-column jump at the first
    // page. Relax it for this scroll and restore it when the scroll ends.
    const cols = Array.from(vp.querySelectorAll<HTMLElement>("[data-snap-col]"));
    cols.forEach((c) => (c.style.scrollSnapStop = "normal"));
    let done = false;
    const restore = () => {
      if (done) return;
      done = true;
      cols.forEach((c) => (c.style.scrollSnapStop = ""));
      vp.removeEventListener("scrollend", restore);
      window.clearTimeout(timer);
    };
    const timer = window.setTimeout(restore, 800);
    vp.addEventListener("scrollend", restore);
    vp.scrollTo({ left: index * step(), behavior: reduced ? "auto" : "smooth" });
    if (reduced) restore();
    setActive(index);
  };

  // Native scrolling handles the rubber band at the ends; only the tab change
  // needs to be delegated, and only for a deliberate horizontal flick there.
  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touch.current;
    touch.current = null;
    const vp = viewportRef.current;
    if (!start || !vp) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) <= 70 || Math.abs(dx) <= Math.abs(dy) * 2) return;
    if (vp.scrollLeft <= 1 && dx > 0) onOverscroll?.(-1);
    else if (vp.scrollLeft >= vp.scrollWidth - vp.clientWidth - 1 && dx < 0) onOverscroll?.(1);
  };

  const openFromRow = useCallback(
    (id: string, preview?: Item) => {
      onOpen(id, preview);
    },
    [onOpen],
  );

  // All columns request the same next page, but a filtered Discover can have
  // fewer total pages: it simply stops there instead of freezing the others.
  // Each column reveals the pages it actually has, never a gap.
  const shelves = columns.map((c) => cache.get(c.key));
  // The four unfiltered columns stay in lockstep; filtered Discover reveals its
  // own committed pages because its total page count can be shorter.
  const staticDepth = sharedDepth(shelves.slice(1));
  const next = nextSharedPage(shelves);
  const loading = next !== null && columns.some((c) => inflight.has(keyOf(c.key, next)));
  const canPull = next !== null && !loading;
  const filterOn = filtersActive(discoverFilters);

  /** One pull/button press loads the same next page for every column that has one. */
  const loadShared = useCallback(async () => {
    const page = nextSharedPage(columns.map((c) => cache.get(c.key)));
    if (page === null) return;
    await Promise.all(
      columns
        .filter((c) => {
          const shelf = cache.get(c.key);
          return !shelf?.pages[page] && (!shelf?.totalPages || shelf.totalPages >= page);
        })
        .map((c) => loadPage(c, page)),
    );
  }, [columns, loadPage]);

  // With filters on, Discover is the only thing on screen: one plain result
  // list instead of the five-column carousel.
  const discoverColumn = columns.find((c) => c.category === "discover")!;
  const discoverShelf = cache.get(discoverColumn.key);
  // No app-side page cap: pull keeps going until TMDB says the feed is done.
  const discoverList = flattenPages(discoverShelf, UNLIMITED_PAGES);
  const discoverNext = nextSharedPage([discoverShelf], UNLIMITED_PAGES);
  const discoverLoading = discoverNext !== null && inflight.has(keyOf(discoverColumn.key, discoverNext));
  const loadDiscover = useCallback(async () => {
    const column = columns.find((c) => c.category === "discover")!;
    const page = nextSharedPage([cache.get(column.key)], UNLIMITED_PAGES);
    if (page === null) return;
    await loadPage(column, page);
  }, [columns, loadPage]);

  if (filterOn) {
    return (
      <PullUpToLoad canLoad={discoverNext !== null && !discoverLoading} onLoad={loadDiscover} resetKey={discoverColumn.key}>
        <div className="pt-1">
          <p className="px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-faint">Discover · filtered</p>
          {!discoverShelf?.pages[1] ? (
            <div className="px-4">
              <SkeletonRows count={6} />
            </div>
          ) : discoverList.length ? (
            <ul>
              {discoverList.map((r, i) => {
                const id = `${r.type}-${r.tmdbId}`;
                return (
                  <li key={`${i}-${id}`} className="cv px-4">
                    <MediaRow result={r} have={tracked.get(id)} onOpen={openFromRow} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No matches" hint="Try changing your filters." />
          )}
          {discoverNext !== null && discoverShelf?.pages[1] ? (
            <div className="hidden px-4 py-6 text-center sm:block">
              {discoverLoading ? (
                <p role="status" className="text-xs text-faint">
                  Loading more…
                </p>
              ) : (
                <button
                  data-pull-allow-click
                  onClick={() => void loadDiscover()}
                  className="h-10 rounded-full bg-surface px-4 text-[13px] text-dim active:bg-raised"
                >
                  Load more
                </button>
              )}
            </div>
          ) : null}
        </div>
      </PullUpToLoad>
    );
  }

  return (
    <PullUpToLoad canLoad={canPull} onLoad={loadShared} resetKey={active}>
      <div className="pt-3">
        <div
          ref={viewportRef}
          data-swipe
          className="browse-viewport no-scrollbar flex snap-x snap-mandatory scroll-pl-4 select-none overflow-x-auto overscroll-x-contain"
          style={{ touchAction: "pan-x pan-y" }}
          onScroll={onScroll}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="group"
          aria-label="Browse categories"
        >
          <div className="w-4 shrink-0" aria-hidden />
          {SHELVES.map((s, index) => {
            const shelf = cache.get(columns[index].key);
            const list = flattenPages(shelf, s.key === "discover" ? pageLimit(shelf) : staticDepth);
            const initial = !shelf?.pages[1];
            return (
              <div
                key={s.key}
                data-snap-col
                ref={(el) => {
                  colRefs.current[index] = el;
                }}
                className="mr-2.5 w-[82%] shrink-0 snap-start snap-always"
              >
                <div className="flex items-baseline justify-between pb-2 pr-3">
                  <h2 className="text-[11px] font-medium uppercase tracking-wider text-faint">{s.label}</h2>
                  <span className="text-[10px] text-faint">{s.hint}</span>
                </div>
                {initial ? (
                  <SkeletonRows count={6} />
                ) : list.length ? (
                  list.map((r, index) => {
                    const id = `${r.type}-${r.tmdbId}`;
                    // TMDB repeats titles across pages, so the id alone is not
                    // unique here. Pages only append, making the position stable.
                    return <MediaRow key={`${index}-${id}`} result={r} have={tracked.get(id)} onOpen={openFromRow} />;
                  })
                ) : (
                  <p className="py-8 text-xs text-faint">Nothing to show right now</p>
                )}
                {/* Equal skeletons in every column while the shared page arrives. */}
                {loading && !initial ? <SkeletonRows count={6} /> : null}
              </div>
            );
          })}
          {/* Lets the last column align to the scrollport start under snap. */}
          <div className="w-[18%] shrink-0" aria-hidden />
        </div>

        {/* One control for all columns, outside the carousel — no per-column buttons. */}
        {next !== null ? (
          <div className="hidden px-4 py-3 text-center sm:block">
            {loading ? (
              <p role="status" className="text-xs text-faint">
                Loading more…
              </p>
            ) : (
              <button
                data-pull-allow-click
                onClick={() => void loadShared()}
                className="h-10 rounded-full bg-surface px-4 text-[13px] text-dim active:bg-raised"
              >
                Load more
              </button>
            )}
          </div>
        ) : null}

        <div className="browse-dots pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] z-20 flex justify-center py-3">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-sm">
            {SHELVES.map((s, i) => (
              <button
                key={s.key}
                onClick={() => jumpTo(i)}
                aria-label={`Show ${s.label}`}
                aria-current={i === active ? "true" : undefined}
                className={`h-1.5 rounded-full transition-all duration-150 ${i === active ? "w-4 bg-accent" : "w-1.5 bg-faint"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </PullUpToLoad>
  );
}
