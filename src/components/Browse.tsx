"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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

/** Column gap and artwork travel; the gap must match the column margin in the markup. */
const GAP = 10;
const ART_SHIFT = 14;
// Hoisted so memoized rows don't see a new style object on every parent render.
const ART_STYLE: CSSProperties = { transform: "translate3d(var(--px, 0px), 0, 0)" };

/**
 * Settle animation for the dots' tap jump: ~400 ms with a gentle ease-out, the
 * way other apps settle a horizontal pager. The app-wide 160 ms tab snap read as
 * an instant jump. Drag releases use the same curve, with the duration scaled by
 * travel.
 */
const SNAP_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SNAP_TRANSITION = `400ms ${SNAP_EASE}`;
/**
 * A flick is projected forward by its release velocity, the way UIScrollView
 * predicts its resting offset before a pager snaps to a page. On release the
 * projection is capped to one column (like scroll-snap-stop: always), so a fast
 * flick advances exactly one column; this factor only sets how quickly it
 * saturates.
 */
const MOMENTUM_MS = 220;
const MIN_SNAP_MS = 180;
const MAX_SNAP_MS = 320;
const SNAP_SPEED = 1.6; // px per ms; snap duration = travel / this, clamped
/** Velocity comes from the last 100 ms only, so an earlier fast swipe can't leak in. */
const VELOCITY_WINDOW_MS = 100;
/** A pause this long before release means the finger came to rest — no momentum. */
const HOLD_MS = 80;

type DragState = {
  x: number;
  y: number;
  delta: number;
  samples: { x: number; t: number }[];
};

/** Release velocity in px/ms (signed) from the recent pointer samples. */
function releaseVelocity(samples: { x: number; t: number }[], releaseT: number): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (releaseT - last.t > HOLD_MS) return 0;
  const first = samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<DragState | null>(null);
  const moved = useRef(false);
  const overscrolled = useRef(false);
  const suppressClick = useRef(false);
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

  // Column position and artwork offset are written straight to the DOM: no
  // React re-render per pointer move. delta is the live finger displacement.
  const paintAt = (index: number, delta = 0) => {
    const track = trackRef.current;
    if (!track) return;
    const s = step();
    track.style.transform = `translate3d(${(-index * s + delta).toFixed(1)}px, 0, 0)`;
    for (let i = 0; i < SHELVES.length; i++) {
      const col = colRefs.current[i];
      if (!col) continue;
      const pos = Math.max(-1, Math.min(1, i - index - delta / (s || 1)));
      col.style.setProperty("--px", `${(pos * ART_SHIFT).toFixed(1)}px`);
    }
  };
  const paint = (delta = 0) => paintAt(active, delta);

  useEffect(() => {
    paint();
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    // The tab is hidden with display:none when inactive, so columns measure 0
    // then. Repaint when it becomes visible again, not just on window resize.
    const viewport = viewportRef.current;
    const observer = viewport ? new ResizeObserver(onResize) : null;
    if (viewport) observer?.observe(viewport);
    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paint reads refs and current active
  }, [active, loading]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // No pointer capture: it retargets the following click to the viewport and
    // taps on a row's buttons would never fire. Touch already captures implicitly.
    e.currentTarget.setAttribute("data-dragging", "true");
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      delta: 0,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    };
    moved.current = false;
    overscrolled.current = false;
    suppressClick.current = false;
    if (trackRef.current) trackRef.current.style.transition = "none";
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || overscrolled.current) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!moved.current) {
      if (Math.abs(dx) <= 8 || Math.abs(dx) <= Math.abs(dy)) return;
      moved.current = true;
    }
    // Never reveal a blank track beyond the first or last column.
    let delta = dx;
    if (active === 0) delta = Math.min(delta, 0);
    if (active === SHELVES.length - 1) delta = Math.max(delta, 0);
    const over = dx - delta;
    if (Math.abs(over) > 32) {
      overscrolled.current = true;
      onOverscroll?.(over > 0 ? -1 : 1);
      return;
    }
    d.delta = delta;
    paint(delta);
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    // Keep the last ~100 ms, but retain the sample just before the cutoff so
    // velocity still has two points when the window is sparse.
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS;
    while (d.samples.length > 2 && d.samples[1].t < cutoff) d.samples.shift();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    suppressClick.current = !!d && Math.abs(d.delta) > 12;
    drag.current = null;
    viewportRef.current?.setAttribute("data-dragging", "false");
    if (!d || overscrolled.current) {
      if (trackRef.current) trackRef.current.style.transition = "";
      paint();
      return;
    }
    const s = step();
    // Project where the flick would coast to, then pick the nearest column. The
    // momentum part is capped to one column so a fast release advances one step
    // instead of slamming several columns away; the finger's own displacement is
    // not capped, so a deliberate multi-column drag can still cross several.
    const rawProjected = releaseVelocity(d.samples, e.timeStamp) * MOMENTUM_MS;
    const projected = s > 0 ? Math.max(-s, Math.min(s, rawProjected)) : 0;
    let columns = s > 0 ? Math.round(-(d.delta + projected) / s) : 0;
    // A deliberate drag past the old distance threshold moves one column even
    // when the finger slowed to a stop before release (velocity is then zero).
    if (columns === 0 && projected * d.delta >= 0 && Math.abs(d.delta) > Math.min(70, s / 4)) {
      columns = d.delta < 0 ? 1 : -1;
    }
    const next = Math.max(0, Math.min(SHELVES.length - 1, active + columns));
    // Travel length sets the duration, so a multi-column flick moves at roughly
    // the same speed as a short snap instead of teleporting to the target.
    const travel = Math.abs((active - next) * s - d.delta);
    const duration = Math.max(MIN_SNAP_MS, Math.min(MAX_SNAP_MS, Math.round(travel / SNAP_SPEED)));
    // The track was set to "none" on drag start; restore a transition before
    // painting the target so the position change animates instead of jumping.
    if (trackRef.current) trackRef.current.style.transition = `${duration}ms ${SNAP_EASE}`;
    if (next !== active) {
      paintAt(next);
      setActive(next);
    } else {
      paint();
    }
  };

  const cancelDrag = () => {
    drag.current = null;
    overscrolled.current = false;
    suppressClick.current = false;
    viewportRef.current?.setAttribute("data-dragging", "false");
    if (trackRef.current) trackRef.current.style.transition = "";
    paint();
  };

  // Dots are the tap fallback: use the fixed settle, not a leftover flick duration.
  const jumpTo = (index: number) => {
    if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
    paintAt(index);
    setActive(index);
  };

  const openFromRow = useCallback(
    (id: string, preview?: Item) => {
      if (suppressClick.current) return;
      onOpen(id, preview);
    },
    [onOpen],
  );

  return (
    <div className="pt-3">
      <div
        ref={viewportRef}
        data-swipe
        data-dragging="false"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        className="browse-viewport touch-pan-y overflow-hidden select-none"
        role="group"
        aria-label="Browse categories"
      >
        <div
          ref={trackRef}
          className="browse-track flex pl-4 will-change-transform transition-transform duration-[160ms] ease-out"
        >
          {SHELVES.map((s, index) => {
            const list = data[s.key];
            return (
              <div
                key={s.key}
                ref={(el) => {
                  colRefs.current[index] = el;
                }}
                className="mr-2.5 w-[82%] shrink-0"
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
                        className="browse-art"
                        style={ART_STYLE}
                      />
                    );
                  })
                ) : (
                  <p className="py-8 text-xs text-faint">Nothing to show right now</p>
                )}
              </div>
            );
          })}
        </div>
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
