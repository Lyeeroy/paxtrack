"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Item, SearchResult } from "@/lib/types";
import Browse from "./Browse";
import MediaRow from "./MediaRow";
import PullToLoad from "./PullToLoad";
import { Empty, IconSearch, ScreenHeader } from "./ui";

interface SearchPage {
  results: SearchResult[];
  page: number;
  totalPages: number;
}

/** One entry per query: the accumulated pages, so returning to a tab restores every loaded result. */
const cache = new Map<string, SearchPage>();
let lastQuery = "";

/** TMDB can repeat a title across pages; keep ids unique in the rendered list. */
function uniqueResults(list: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const id = `${r.type}-${r.tmdbId}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

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

  const tracked = new Map(items.map((i) => [i.id, i]));

  return (
    <div>
      <ScreenHeader title="Search" />
      <div className="px-4 pb-3 pt-1">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 text-dim focus-within:ring-1 focus-within:ring-accent/60">
          <IconSearch className="h-5 w-5 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Anime, TV shows, movies"
            aria-label="Search titles"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-faint"
          />
        </label>
      </div>

      {!q.trim() ? (
        <Browse items={items} onOpen={onOpen} onOverscroll={onSwipeTab} />
      ) : (
        <>
          {state === "offline" ? <Empty title="You're offline" hint="Search needs a connection. Your library works offline." /> : null}
          {state === "error" ? <Empty title="Couldn't reach TMDB" hint="Try again in a moment." /> : null}
          {state === "loading" && !results.length ? <Empty title="Searching…" /> : null}
          {state === "idle" && !results.length ? <Empty title="No results" /> : null}

          <PullToLoad
            onTrigger={() => void loadMore()}
            disabled={loadingMore || !results.length || page >= totalPages}
            busy={loadingMore}
          >
            <ul>
              {results.map((r) => {
                const id = `${r.type}-${r.tmdbId}`;
                return (
                  <li key={id} className="cv px-4">
                    <MediaRow result={r} have={tracked.get(id)} onOpen={onOpen} />
                  </li>
                );
              })}
            </ul>

            {results.length > 0 && page < totalPages ? (
              <div className="px-4 py-6 text-center">
                {loadingMore ? (
                  <p role="status" className="text-xs text-faint">
                    Loading more…
                  </p>
                ) : (
                  <button
                    onClick={() => void loadMore()}
                    className="h-10 rounded-full bg-surface px-4 text-[13px] text-dim active:bg-raised"
                  >
                    Load more
                  </button>
                )}
              </div>
            ) : null}
          </PullToLoad>
        </>
      )}
    </div>
  );
}
