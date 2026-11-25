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
 * Fixed settle for the dots' tap jump and for releases with no flick velocity:
 * ~400 ms with a gentle ease-out. Flick releases instead hand their measured
 * velocity to a rAF glide (see endDrag), which a fixed CSS ease cannot do
 * without throwing away speed at the first frame.
 */
const SNAP_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const SNAP_TRANSITION = `400ms ${SNAP_EASE}`;
/** Below this the finger is too slow for an inertial glide; snap instead. */
const MIN_FLICK_SPEED = 0.15; // px/ms
/** Sparse pointer samples can report absurd speeds; keep the glide sane. */
const MAX_RELEASE_SPEED = 4; // px/ms
/** Velocity comes from the last 100 ms only, so an earlier fast swipe can't leak in. */
const VELOCITY_WINDOW_MS = 100;
/** A glide never drags on; fast flicks finish sooner because they cover the
 * distance at higher speed. (No minimum: clamping the duration up would make
 * the Hermite curve reverse direction in its last frames.) */
const MAX_GLIDE_MS = 420;

type DragState = {
  x: number;
  y: number;
  delta: number;
  samples: { x: number; t: number }[];
};

/**
 * Release velocity in px/ms (signed) from a STRICT recent window. The lift is
 * appended as a sample so a short flick still has two points and a finger that
 * paused before lifting naturally reports ~0 (same x, later t) — no hold timer.
 */
function releaseVelocity(
  samples: { x: number; t: number }[],
  releaseX: number,
  releaseT: number,
): number {
  const pts = [...samples, { x: releaseX, t: releaseT }];
  if (pts.length < 2) return 0;
  const cutoff = releaseT - VELOCITY_WINDOW_MS;
  let first = pts.length - 1;
  while (first > 0 && pts[first - 1].t >= cutoff) first--;
  // Sparse streams: fall back to the previous sample rather than divide by zero.
  if (first === pts.length - 1) first--;
  const last = pts[pts.length - 1];
  const dt = last.t - pts[first].t;
  if (dt <= 0) return 0;
  const v = (last.x - pts[first].x) / dt;
  return Math.max(-MAX_RELEASE_SPEED, Math.min(MAX_RELEASE_SPEED, v));
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
  const raf = useRef<number | null>(null);
  /** Painted delta relative to the current active column (only nonzero mid-glide). */
  const offset = useRef(0);
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

  /** Every path that interrupts a glide must stop it in one place. */
  const cancelGlide = () => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  };

  useEffect(() => {
    cancelGlide();
    paint();
    offset.current = 0;
    const onResize = () => {
      cancelGlide();
      paint();
      offset.current = 0;
    };
    window.addEventListener("resize", onResize);
    // The tab is hidden with display:none when inactive, so columns measure 0
    // then. Repaint when it becomes visible again, not just on window resize.
    const viewport = viewportRef.current;
    const observer = viewport ? new ResizeObserver(onResize) : null;
    if (viewport) observer?.observe(viewport);
    return () => {
      cancelGlide();
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paint/cancelGlide read refs and current active
  }, [active, loading]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Grabbing the track mid-glide must pick it up where it is visually, not
    // where the previous gesture started.
    cancelGlide();
    const from = offset.current;
    paint(from);
    // No pointer capture: it retargets the following click to the viewport and
    // taps on a row's buttons would never fire. Touch already captures implicitly.
    e.currentTarget.setAttribute("data-dragging", "true");
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      delta: from,
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
      cancelGlide();
      if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
      viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
      paint();
      offset.current = 0;
      return;
    }
    const s = step();
    const release = releaseVelocity(d.samples, e.clientX, e.timeStamp);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A flick is capped to one column: a hard flick lands on the same page as
    // a soft one, it just starts at the finger's real speed instead of being
    // dulled by a fixed ease. Velocity wins over displacement, so a last-moment
    // counter-flick still reverses the page.
    let columns = 0;
    // The cap applies to the *momentum*, not to a finger that physically
    // dragged across more than one column: that keeps its real distance.
    const deliberateMulti = s > 0 && Math.abs(d.delta) > s * 1.5;
    if (!deliberateMulti && Math.abs(release) >= MIN_FLICK_SPEED) {
      columns = release < 0 ? 1 : -1;
    } else {
      columns = s > 0 ? Math.round(-d.delta / s) : 0;
      if (columns === 0 && Math.abs(d.delta) > Math.min(70, s / 4)) {
        columns = d.delta < 0 ? 1 : -1;
      }
    }
    const next = Math.max(0, Math.min(SHELVES.length - 1, active + columns));
    const to = (active - next) * s;
    const disp = to - d.delta;

    if (
      next !== active &&
      !reduced &&
      Math.abs(release) >= MIN_FLICK_SPEED &&
      Math.abs(disp) >= 1
    ) {
      // Cubic Hermite from the finger's velocity to rest, landing exactly on
      // the target column. A fixed CSS ease cannot do this: its launch slope
      // plus a minimum duration throws away speed on exactly the fast flicks
      // that should feel fastest.
      cancelGlide();
      const from = d.delta;
      const T = Math.min(MAX_GLIDE_MS, (2 * Math.abs(disp)) / Math.abs(release));
      const c3 = (release * T - 2 * disp) / (T * T * T);
      const c2 = (3 * disp) / (T * T) - (2 * release) / T;
      // The artwork rows are repainted by paint() every frame, so their CSS
      // transition must be off during the glide or they lag behind the track.
      if (trackRef.current) trackRef.current.style.transition = "none";
      viewportRef.current?.style.setProperty("--browse-settle-ms", "0ms");
      const start = performance.now();
      const frame = (now: number) => {
        const u = Math.min(Math.max(now - start, 0), T);
        const p = from + release * u + c2 * u * u + c3 * u * u * u;
        paint(p);
        offset.current = p;
        if (u < T) {
          raf.current = requestAnimationFrame(frame);
          return;
        }
        raf.current = null;
        paint(to);
        offset.current = 0;
        viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
        setActive(next);
      };
      raf.current = requestAnimationFrame(frame);
      return;
    }

    // No flick velocity, reduced motion, or no page change: keep the fixed
    // settle so a stopped finger still moves a page but never glides.
    cancelGlide();
    if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
    viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
    if (next !== active) {
      paintAt(next);
      setActive(next);
    } else {
      paint();
    }
    offset.current = 0;
  };

  const cancelDrag = () => {
    cancelGlide();
    drag.current = null;
    overscrolled.current = false;
    suppressClick.current = false;
    viewportRef.current?.setAttribute("data-dragging", "false");
    // No release speed on a cancelled gesture: fall back to the fixed settle.
    viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
    if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
    paint();
    offset.current = 0;
  };

  // Dots are the tap fallback: use the fixed settle, not an in-flight glide.
  const jumpTo = (index: number) => {
    cancelGlide();
    viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
    if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
    paintAt(index);
    offset.current = 0;
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
