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
const MAX_RELEASE_SPEED = 8; // px/ms
/** Only the freshest segment counts: a 100 ms average dulls a flick that
 *  accelerates right before lift. */
const VELOCITY_WINDOW_MS = 50;
/** Coalesced touch streams can produce sub-millisecond samples; ignore them. */
const MIN_SAMPLE_DT_MS = 8;
/** How long a glide interrupted by a new touch keeps influencing its release. */
const RESIDUAL_DECAY_MS = 150;
/**
 * Native scrollers coast with exponential friction, then snap with a spring.
 * iOS UIScrollView's normal deceleration rate corresponds to ~325 ms; that
 * keeps ~95% of the finger's speed in the first frame instead of braking from
 * frame one (which is what a fixed ease-to-distance does).
 */
const FLING_TAU_MS = 325;
/** Critically damped snap, expressed as a rate per millisecond. */
const SNAP_OMEGA = 0.05;
/** Hand off to the snap before the fling can overshoot its column. */
const FLING_STOP_SPEED = 0.05;
const MAX_FLING_MS = 400;
const MAX_SNAP_MS = 380;

type DragState = {
  x: number;
  y: number;
  /** Painted offset at touchdown (nonzero when a glide was interrupted). */
  origin: number;
  delta: number;
  samples: { x: number; t: number }[];
  /** Velocity the interrupted glide handed to this gesture (px/ms). */
  residual: number;
  downT: number;
};

/**
 * Release velocity in px/ms (signed) from the freshest usable pointer segment
 * ending at the lift. Averaging a longer window under-reports a flick that
 * accelerates at the end; a finger that paused before lifting naturally
 * reports ~0 because its last sample has the same x at a later t.
 */
function releaseVelocity(
  samples: { x: number; t: number }[],
  releaseX: number,
  releaseT: number,
): number {
  const pts = [...samples, { x: releaseX, t: releaseT }];
  if (pts.length < 2) return 0;
  const cutoff = releaseT - VELOCITY_WINDOW_MS;
  let first: { x: number; t: number } | null = null;
  // Newest usable sample first: inside the window, but old enough to measure.
  for (let i = pts.length - 2; i >= 0; i--) {
    const p = pts[i];
    if (releaseT - p.t < MIN_SAMPLE_DT_MS) continue;
    if (p.t >= cutoff) {
      first = p;
      break;
    }
    if (!first) first = p; // sparse stream: newest sample older than the window
  }
  if (!first) return 0;
  const dt = releaseT - first.t;
  if (dt < MIN_SAMPLE_DT_MS) return 0;
  const v = (releaseX - first.x) / dt;
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
  /** Index the DOM transform is based on. It commits synchronously so a flick
   *  that interrupts a glide still advances the page; React `active` only
   *  drives the dots. */
  const base = useRef(0);
  /** Column an in-flight glide is heading to. */
  const target = useRef<number | null>(null);
  /** Current velocity of the in-flight glide, handed to the next gesture. */
  const glideV = useRef(0);
  /** Painted delta relative to `base` (only nonzero mid-drag/mid-glide). */
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
  const paint = (delta = 0) => paintAt(base.current, delta);

  /** Commit a page and the transform relative to it in one synchronous write. */
  const settleAt = (index: number, delta = 0) => {
    base.current = index;
    offset.current = delta;
    paintAt(index, delta);
  };

  /** Stop the rAF without committing a page (used on unmount). */
  const stopGlide = () => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    target.current = null;
    glideV.current = 0;
  };

  /**
   * Interrupting a glide commits its target as the new base immediately and
   * returns the velocity it had at that instant. Fast repeated flicks therefore
   * advance a page each time (instead of re-targeting a stale `active`) and
   * inherit the leftover momentum instead of restarting from zero.
   */
  const interruptGlide = (): number => {
    if (raf.current === null) return 0;
    const v = glideV.current;
    const next = target.current ?? base.current;
    stopGlide();
    // Rebase the current painted offset onto the committed page so the track
    // does not jump when the base changes.
    const delta = offset.current + (next - base.current) * step();
    settleAt(next, delta);
    setActive(next);
    viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
    return v;
  };

  useEffect(() => {
    const repaint = () => {
      // Never overwrite a live drag or glide with a resting transform.
      if (drag.current || raf.current !== null) return;
      paint();
      offset.current = 0;
    };
    repaint();
    const onResize = () => {
      interruptGlide();
      if (!drag.current) {
        paint();
        offset.current = 0;
      }
    };
    window.addEventListener("resize", onResize);
    // The tab is hidden with display:none when inactive, so columns measure 0
    // then. Repaint when it becomes visible again, not just on window resize.
    const viewport = viewportRef.current;
    const observer = viewport ? new ResizeObserver(onResize) : null;
    if (viewport) observer?.observe(viewport);
    return () => {
      stopGlide();
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paint/interruptGlide read refs and current active
  }, [active, loading]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Grabbing the track mid-glide commits that glide's page and inherits its
    // velocity, so the finger picks up the motion instead of restarting it.
    const residual = interruptGlide();
    const from = offset.current;
    // No pointer capture: it retargets the following click to the viewport and
    // taps on a row's buttons would never fire. Touch already captures implicitly.
    e.currentTarget.setAttribute("data-dragging", "true");
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      origin: from,
      delta: from,
      samples: [{ x: e.clientX, t: e.timeStamp }],
      residual,
      downT: e.timeStamp,
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
    // Never reveal a blank track beyond the first or last column. The offset
    // grabbed from an interrupted glide is the starting point, not zero.
    const raw = d.origin + dx;
    let delta = raw;
    if (base.current === 0) delta = Math.min(delta, 0);
    if (base.current === SHELVES.length - 1) delta = Math.max(delta, 0);
    const over = raw - delta;
    if (Math.abs(over) > 32) {
      overscrolled.current = true;
      onOverscroll?.(over > 0 ? -1 : 1);
      return;
    }
    d.delta = delta;
    paint(delta);
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    // Keep the freshest samples, retaining the one just before the cutoff so
    // velocity still has two points when the touch stream is sparse.
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS;
    while (d.samples.length > 2 && d.samples[1].t < cutoff) d.samples.shift();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    suppressClick.current = !!d && Math.abs(d.delta - d.origin) > 12;
    drag.current = null;
    viewportRef.current?.setAttribute("data-dragging", "false");
    if (!d || overscrolled.current) {
      interruptGlide();
      if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
      viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
      settleAt(base.current, 0);
      return;
    }
    const s = step();
    const finger = releaseVelocity(d.samples, e.clientX, e.timeStamp);
    // A glide this touch interrupted keeps a little of its speed, decaying over
    // ~150 ms, so rapid flicks feel continuous instead of restarting from zero.
    // A stationary finger (a tap) never inherits it.
    const carry = moved.current
      ? d.residual * Math.max(0, 1 - (e.timeStamp - d.downT) / RESIDUAL_DECAY_MS)
      : 0;
    const release = Math.max(
      -MAX_RELEASE_SPEED,
      Math.min(MAX_RELEASE_SPEED, finger + carry),
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A flick is capped to one column: a hard flick lands on the same page as
    // a soft one, it just starts at the finger's real speed instead of being
    // dulled by a fixed ease. Velocity wins over displacement, so a last-moment
    // counter-flick still reverses the page.
    let columns = 0;
    // The cap applies to the *momentum*, not to a finger that physically
    // dragged across more than one column: that keeps its real distance.
    const movedBy = d.delta - d.origin;
    const deliberateMulti = s > 0 && Math.abs(movedBy) > s * 1.5;
    if (!deliberateMulti && Math.abs(release) >= MIN_FLICK_SPEED) {
      columns = release < 0 ? 1 : -1;
    } else {
      columns = s > 0 ? Math.round(-d.delta / s) : 0;
      if (columns === 0 && Math.abs(movedBy) > Math.min(70, s / 4)) {
        columns = movedBy < 0 ? 1 : -1;
      }
    }
    const next = Math.max(0, Math.min(SHELVES.length - 1, base.current + columns));
    const to = (base.current - next) * s;
    const disp = to - d.delta;

    if (
      next !== base.current &&
      !reduced &&
      Math.abs(release) >= MIN_FLICK_SPEED &&
      Math.abs(disp) >= 1
    ) {
      // Native scrollers coast with exponential friction first, then hand the
      // still-live velocity to a critically damped snap. A fixed ease-to-
      // distance brakes from frame one and reads as much slower than the finger.
      stopGlide();
      const from = d.delta;
      // The artwork rows are repainted by paint() every frame, so their CSS
      // transition must be off during the fling or they lag behind the track.
      if (trackRef.current) trackRef.current.style.transition = "none";
      viewportRef.current?.style.setProperty("--browse-settle-ms", "0ms");
      target.current = next;
      glideV.current = release;
      const flingStart = performance.now();
      let phase: "fling" | "spring" = "fling";
      let phaseStart = flingStart;
      let y0 = 0;
      let springC = 0;
      const finish = () => {
        raf.current = null;
        target.current = null;
        glideV.current = 0;
        settleAt(next, 0);
        viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
        setActive(next);
      };
      const frame = (now: number) => {
        const u = Math.max(now - phaseStart, 0);
        let p: number;
        let v: number;
        if (phase === "fling") {
          const decay = Math.exp(-u / FLING_TAU_MS);
          p = from + release * FLING_TAU_MS * (1 - decay);
          v = release * decay;
          const remaining = to - p;
          const crossed =
            Math.abs(p - from) > Math.abs(disp) && Math.sign(p - from) === Math.sign(disp);
          if (
            crossed ||
            (remaining * v >= 0 && Math.abs(remaining) <= Math.abs(v) / SNAP_OMEGA) ||
            Math.abs(v) < FLING_STOP_SPEED ||
            u > MAX_FLING_MS
          ) {
            if (crossed) p = to;
            phase = "spring";
            phaseStart = now;
            y0 = p - to;
            // Carry the live speed, capped so the spring cannot overshoot the
            // column when the fling hands over early.
            const carryV = crossed
              ? 0
              : Math.sign(v) * Math.min(Math.abs(v), SNAP_OMEGA * Math.abs(remaining));
            springC = carryV + SNAP_OMEGA * y0;
            v = carryV;
          }
        } else {
          const decay = Math.exp(-SNAP_OMEGA * u);
          const envelope = y0 + springC * u;
          p = to + envelope * decay;
          v = (springC - SNAP_OMEGA * envelope) * decay;
          if (u > MAX_SNAP_MS || (Math.abs(p - to) < 0.2 && Math.abs(v) < 0.02)) {
            finish();
            return;
          }
        }
        paint(p);
        offset.current = p;
        glideV.current = v;
        raf.current = requestAnimationFrame(frame);
      };
      raf.current = requestAnimationFrame(frame);
      return;
    }

    // No flick velocity, reduced motion, or no page change: keep the fixed
    // settle so a stopped finger still moves a page but never glides.
    stopGlide();
    if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
    viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
    settleAt(next, 0);
    setActive(next);
  };

  const cancelDrag = () => {
    interruptGlide();
    drag.current = null;
    overscrolled.current = false;
    suppressClick.current = false;
    viewportRef.current?.setAttribute("data-dragging", "false");
    // No release speed on a cancelled gesture: fall back to the fixed settle.
    viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
    if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
    settleAt(base.current, 0);
  };

  // Dots are the tap fallback: use the fixed settle, not an in-flight glide.
  const jumpTo = (index: number) => {
    interruptGlide();
    viewportRef.current?.style.setProperty("--browse-settle-ms", "400ms");
    if (trackRef.current) trackRef.current.style.transition = SNAP_TRANSITION;
    settleAt(index, 0);
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
