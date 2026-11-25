"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import type { Item, SearchResult } from "@/lib/types";
import MediaRow from "./MediaRow";

type Category = "discover" | "trending" | "popular" | "top-rated" | "in-cinema";

const SHELVES: { key: Category; label: string; hint: string }[] = [
  { key: "discover", label: "Discover", hint: "Fresh finds" },
  { key: "trending", label: "Trending", hint: "This week" },
  { key: "popular", label: "Popular", hint: "Most watched" },
  { key: "top-rated", label: "Top rated", hint: "Best rated" },
  { key: "in-cinema", label: "In cinema", hint: "Now playing" },
];

/** Accumulated results per category, reused when the user returns to the Search tab. */
const cache = new Map<Category, SearchResult[]>();

/** Column margin; must match `mr-2.5` in the markup. */
const GAP = 10;

export default function Browse({
  items,
  onOpen,
  onOverscroll,
}: {
  items: Item[];
  onOpen: (id: string, preview?: Item) => void;
  /** Drag past the first/last column moves to the adjacent tab instead. */
  onOverscroll?: (dir: 1 | -1) => void;
}) {
  const [data, setData] = useState<Record<Category, SearchResult[]>>(() => {
    const initial = {} as Record<Category, SearchResult[]>;
    for (const s of SHELVES) initial[s.key] = cache.get(s.key) ?? [];
    return initial;
  });
  const [loading, setLoading] = useState(() => SHELVES.some((s) => !cache.has(s.key)));
  const [active, setActive] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const tracked = new Map(items.map((i) => [i.id, i]));

  useEffect(() => {
    const missing = SHELVES.filter((s) => !cache.has(s.key));
    if (!missing.length) return;
    let alive = true;
    void Promise.all(
      missing.map(async (s) => {
        try {
          const res = await fetch(`/api/tmdb/browse?category=${s.key}`);
          if (!res.ok) return;
          const json = (await res.json()) as { results: SearchResult[] };
          cache.set(s.key, json.results);
        } catch {
          /* Offline: the column stays empty and can retry on the next mount. */
        }
      }),
    ).then(() => {
      if (!alive) return;
      const next = {} as Record<Category, SearchResult[]>;
      for (const s of SHELVES) next[s.key] = cache.get(s.key) ?? [];
      setData(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

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

  return (
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
          const list = data[s.key];
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
              {loading && !list.length ? (
                Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-line/60 py-2.5">
                    <div className="h-16 w-11 shrink-0 rounded-md bg-surface" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-surface" />
                      <div className="h-2.5 w-1/2 rounded bg-surface" />
                    </div>
                  </div>
                ))
              ) : list.length ? (
                list.map((r) => {
                  const id = `${r.type}-${r.tmdbId}`;
                  return (
                    <MediaRow
                      key={id}
                      result={r}
                      have={tracked.get(id)}
                      onOpen={openFromRow}
                    />
                  );
                })
              ) : (
                <p className="py-8 text-xs text-faint">Nothing to show right now</p>
              )}
            </div>
          );
        })}
        {/* Lets the last column align to the scrollport start under snap. */}
        <div className="w-[18%] shrink-0" aria-hidden />
      </div>

      <div className="pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] z-20 flex justify-center py-3">
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
  );
}
