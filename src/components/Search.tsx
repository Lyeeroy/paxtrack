"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  DEFAULT_DISCOVER_FILTERS,
  filtersActive as discoverFiltersActive,
  type DiscoverFilters,
} from "@/lib/discover";
import type { Item, SearchResult } from "@/lib/types";
import { uniqueResults } from "@/lib/paged";
import Browse from "./Browse";
import { DiscoverFilterSheet } from "./DiscoverFilters";
import MediaRow from "./MediaRow";
import PullUpToLoad from "./PullUpToLoad";
import { DEFAULT_FILTERS, filtersActive, matchesFilters, SearchFilterSheet, type SearchFilterState } from "./SearchFilters";
import { Empty, IconClose, IconFilterList, IconSearch, ScreenHeader } from "./ui";

interface SearchPage {
  results: SearchResult[];
  page: number;
  totalPages: number;
}

/** One entry per query: the accumulated pages, so returning to a tab restores every loaded result. */
const cache = new Map<string, SearchPage>();
let lastQuery = "";

export default function Search({
  items,
  onOpen,
  inputRef,
  onSwipeTab,
}: {
  items: Item[];
  onOpen: (id: string, preview?: Item) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onSwipeTab?: (dir: 1 | -1) => void;
}) {
  const cached = cache.get(lastQuery.trim());
  const [q, setQ] = useState(lastQuery);
  const [results, setResults] = useState<SearchResult[]>(cached?.results ?? []);
  const [page, setPage] = useState(cached?.page ?? 0);
  const [totalPages, setTotalPages] = useState(cached?.totalPages ?? 0);
  const [state, setState] = useState<"idle" | "loading" | "error" | "offline">("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  // Search filters apply to loaded rows only; Discover filters change the feed
  // and turn the Browse carousel into a single full-width result list.
  const [filters, setFilters] = useState<SearchFilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [discoverFilters, setDiscoverFilters] = useState<DiscoverFilters>(DEFAULT_DISCOVER_FILTERS);
  const [discoverFilterOpen, setDiscoverFilterOpen] = useState(false);
  const browsing = !q.trim();
  const headerFilterActive = browsing ? discoverFiltersActive(discoverFilters) : filtersActive(filters);
  const closeSheets = () => {
    setFilterOpen(false);
    setDiscoverFilterOpen(false);
  };
  const seq = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    lastQuery = q;
    const key = q.trim();
    const id = ++seq.current;
    const hit = key ? cache.get(key) : undefined;
    /* eslint-disable react-hooks/set-state-in-effect -- restore cache / clear stale results synchronously before the debounced fetch */
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setResults(hit?.results ?? []);
    setPage(hit?.page ?? 0);
    setTotalPages(hit?.totalPages ?? 0);
    setState("idle");
    /* eslint-enable react-hooks/set-state-in-effect */
    // An empty query shows the Browse columns, not a vertical trending list.
    if (!key || hit) return;
    const t = setTimeout(
      async () => {
        if (!navigator.onLine) {
          setState("offline");
          return;
        }
        setState("loading");
        try {
          const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(key)}&page=1`);
          if (!res.ok) throw new Error();
          const data = (await res.json()) as SearchPage;
          if (id !== seq.current) return;
          const next = { results: uniqueResults(data.results), page: data.page, totalPages: data.totalPages };
          cache.set(key, next);
          setResults(next.results);
          setPage(next.page);
          setTotalPages(next.totalPages);
          setState("idle");
        } catch {
          if (id === seq.current) setState("error");
        }
      },
      // Shorter than the old 350 ms: on a first visit the user otherwise
      // waits debounce + fetch before anything displays.
      200,
    );
    return () => clearTimeout(t);
  }, [q]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const key = q.trim();
    const current = cache.get(key);
    if (!current || !current.totalPages || current.page >= current.totalPages) return;
    const nextPage = current.page + 1;
    const id = seq.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(key)}&page=${nextPage}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SearchPage;
      if (id !== seq.current) return;
      const next = {
        results: uniqueResults([...current.results, ...data.results]),
        page: data.page,
        totalPages: data.totalPages,
      };
      cache.set(key, next);
      setResults(next.results);
      setPage(next.page);
      setTotalPages(next.totalPages);
    } catch {
      /* Keep the Load more control so the user can retry. */
    } finally {
      if (id === seq.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [q]);

  const openFiltersFromPull = useCallback(async () => {
    if (browsing) setDiscoverFilterOpen(true);
    else setFilterOpen(true);
  }, [browsing]);

  const tracked = new Map(items.map((i) => [i.id, i]));
  // Pulling loads raw pages; if filters hide everything the user can still pull
  // for more, so canPull deliberately uses the unfiltered count.
  const visibleResults = results.filter((r) => matchesFilters(r, tracked.get(`${r.type}-${r.tmdbId}`), filters));
  const canPull = results.length > 0 && page < totalPages && state === "idle" && !loadingMore;

  return (
    <div>
      {/* Pull down from the top: the whole Search screen lifts, chevron opens filters. */}
      <PullUpToLoad
        canLoad={!filterOpen && !discoverFilterOpen}
        onLoad={openFiltersFromPull}
        resetKey={`${browsing ? "browse" : "results"}:${filterOpen || discoverFilterOpen ? "open" : "closed"}`}
        direction="down"
        actionLabel="open filters"
        busyLabel="Opening filters"
        indicator="chevron"
        allowTyping
      >
      <ScreenHeader
        title="Search"
        right={
          <button
            type="button"
            onClick={() => (browsing ? setDiscoverFilterOpen(true) : setFilterOpen(true))}
            aria-label={browsing ? "Discover filters" : "Search filters"}
            aria-haspopup="dialog"
            aria-expanded={browsing ? discoverFilterOpen : filterOpen}
            className={`-mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-raised ${
              headerFilterActive ? "text-accent" : "text-dim hover:text-fg"
            }`}
          >
            <IconFilterList className="h-5 w-5 translate-y-[5px]" />
          </button>
        }
      />
      <div className="px-4 pb-3 pt-1">
        <label className="flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-surface px-3 text-dim focus-within:ring-1 focus-within:ring-accent/60">
          <IconSearch className="h-5 w-5 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              closeSheets();
            }}
            placeholder="Anime, TV shows, movies"
            aria-label="Search titles"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-faint"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                closeSheets();
                // Keep the keyboard up so the next query needs no extra tap.
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="-mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-dim active:bg-raised hover:text-fg"
            >
              <IconClose className="h-5 w-5" />
            </button>
          ) : null}
        </label>
      </div>

      {browsing ? (
        <Browse items={items} onOpen={onOpen} onOverscroll={onSwipeTab} discoverFilters={discoverFilters} />
      ) : (
        <PullUpToLoad canLoad={canPull} onLoad={loadMore}>
          {state === "offline" ? <Empty title="You're offline" hint="Search needs a connection. Your library works offline." /> : null}
          {state === "error" ? <Empty title="Couldn't reach TMDB" hint="Try again in a moment." /> : null}
          {state === "loading" && !results.length ? <Empty title="Searching…" /> : null}
          {state === "idle" && !results.length ? <Empty title="No results" /> : null}
          {state === "idle" && results.length && !visibleResults.length ? (
            <Empty title="No matches" hint="Try changing your filters." />
          ) : null}

          <ul>
            {visibleResults.map((r) => {
              const id = `${r.type}-${r.tmdbId}`;
              return (
                <li key={id} className="cv px-4">
                  <MediaRow result={r} have={tracked.get(id)} onOpen={onOpen} />
                </li>
              );
            })}
          </ul>

          {results.length > 0 && page < totalPages ? (
            <div className="hidden px-4 py-6 text-center sm:block">
              {loadingMore ? (
                <p role="status" className="text-xs text-faint">
                  Loading more…
                </p>
              ) : (
                <button
                  data-pull-allow-click
                  onClick={() => void loadMore()}
                  className="h-10 rounded-full bg-surface px-4 text-[13px] text-dim active:bg-raised"
                >
                  Load more
                </button>
              )}
            </div>
          ) : null}
        </PullUpToLoad>
      )}
      </PullUpToLoad>

      <SearchFilterSheet
        open={filterOpen && !browsing}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        subtitle={`${visibleResults.length} of ${results.length} shown`}
      />
      <DiscoverFilterSheet
        open={discoverFilterOpen && browsing}
        onClose={() => setDiscoverFilterOpen(false)}
        filters={discoverFilters}
        onChange={setDiscoverFilters}
      />
    </div>
  );
}
