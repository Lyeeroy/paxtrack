"use client";

import { useEffect, useRef, useState } from "react";
import { refreshItem } from "@/lib/refresh";
import { addItem, createPreview } from "@/lib/store";
import { haptic, showToast } from "@/lib/toast";
import type { Item, SearchResult, Status } from "@/lib/types";
import { Empty, IconCheck, IconSearch, Poster, ScreenHeader, TypeTag } from "./ui";

const cache = new Map<string, SearchResult[]>();
let lastQuery = "";

export default function Search({ items, onOpen }: { items: Item[]; onOpen: (id: string, preview?: Item) => void }) {
  const [q, setQ] = useState(lastQuery);
  const [results, setResults] = useState<SearchResult[]>(cache.get(lastQuery.trim()) ?? []);
  const [state, setState] = useState<"idle" | "loading" | "error" | "offline">("idle");
  const seq = useRef(0);

  useEffect(() => {
    lastQuery = q;
    const key = q.trim();
    const hit = cache.get(key);
    if (hit) {
      /* eslint-disable react-hooks/set-state-in-effect -- show cached results without a loading flash */
      setResults(hit);
      setState("idle");
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(
      async () => {
        if (!navigator.onLine) {
          setState("offline");
          return;
        }
        setState("loading");
        try {
          const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(key)}`);
          if (!res.ok) throw new Error();
          const data = (await res.json()) as { results: SearchResult[] };
          if (id !== seq.current) return;
          cache.set(key, data.results);
          setResults(data.results);
          setState("idle");
        } catch {
          if (id === seq.current) setState("error");
        }
      },
      key ? 350 : 0,
    );
    return () => clearTimeout(t);
  }, [q]);

  const tracked = new Map(items.map((i) => [i.id, i]));

  const add = (r: SearchResult, status: Status) => {
    haptic();
    const item = addItem(r, status);
    showToast(`${r.title} · added to ${status === "watching" ? "Watching" : "Planned"}`);
    void refreshItem(item);
  };

  const openDetails = (r: SearchResult) => {
    const id = `${r.type}-${r.tmdbId}`;
    onOpen(id, tracked.get(id) ? undefined : createPreview(r));
  };

  return (
    <div>
      <ScreenHeader title="Search" />
      <div className="px-4 pb-3 pt-1">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 text-dim focus-within:ring-1 focus-within:ring-accent/60">
          <IconSearch className="h-5 w-5 shrink-0" />
          <input
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
        {!q.trim() && results.length ? <p className="mt-3 text-[11px] uppercase tracking-wider text-faint">Trending this week</p> : null}
      </div>

      {state === "offline" ? <Empty title="You're offline" hint="Search needs a connection. Your library works offline." /> : null}
      {state === "error" ? <Empty title="Couldn't reach TMDB" hint="Try again in a moment." /> : null}
      {state === "loading" && !results.length ? <Empty title="Searching…" /> : null}
      {state === "idle" && q.trim() && !results.length ? <Empty title="No results" /> : null}

      <ul>
        {results.map((r) => {
          const id = `${r.type}-${r.tmdbId}`;
          const have = tracked.get(id);
          return (
            <li key={id} className="cv flex items-center gap-3 border-b border-line/60 px-4 py-2.5">
              <button onClick={() => openDetails(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${r.title}, open details`}>
                <Poster path={r.poster} title={r.title} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{r.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-dim">
                    <TypeTag anime={r.anime} type={r.type} />
                    <span>{r.year}</span>
                  </p>
                </div>
              </button>
              {have && !have.deleted ? (
                <button onClick={() => openDetails(r)} aria-label={`${r.title} is in your library`} className="flex h-10 items-center gap-1 rounded-full px-3 text-xs text-accent">
                  <IconCheck className="h-4 w-4" /> Added
                </button>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => add(r, "planned")}
                    aria-label={`Add ${r.title} to planned`}
                    className="h-10 rounded-full border border-line px-3 text-xs text-dim active:bg-raised"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => add(r, "watching")}
                    aria-label={`Start watching ${r.title}`}
                    className="h-10 rounded-full bg-accent px-3.5 text-xs font-semibold text-black active:opacity-80"
                  >
                    Watch
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
