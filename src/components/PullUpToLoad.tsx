"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/toast";

/** Finger travel that starts the gesture and completes the ring. */
const SLOP = 8;
const TRIGGER = 96;
/** Content follows the finger at a damped rate, capped so the page never runs away. */
const LIFT_RATIO = 0.55;
const MAX_LIFT = 120;
const SPRING_MS = 180;
const RING_RADIUS = 19;
const RING = 2 * Math.PI * RING_RADIUS;
/** The detail ring rolls in from above the viewport over this distance. */
const ROLL_DISTANCE = 120;
const ROLL_DEGREES_PER_PX = 2.6;

function hiddenTransform(down: boolean) {
  return down ? `translate(-50%, -${ROLL_DISTANCE}px) rotate(0deg) scale(0.8)` : "translate(-50%, 0) scale(0.8)";
}

function atBottom() {
  const doc = document.documentElement;
  return window.scrollY + window.innerHeight >= doc.scrollHeight - 2;
}

function atTop(scrollRef: RefObject<HTMLElement | null> | undefined) {
  const el = scrollRef?.current;
  return el ? el.scrollTop <= 1 : window.scrollY <= 1;
}

function isTyping() {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

type Drag = {
  x: number;
  y: number;
  scroll: number;
  claimed: boolean;
  raw: number;
  progress: number;
  aria: number;
};

/**
 * Phone-first "pull up at the bottom" loader. The page must already be at the
 * bottom; continuing the upward drag takes over the scroll, lifts the content
 * and fills a ring. Releasing past the threshold calls `onLoad`.
 *
 * React touch handlers are passive, so the move listener is attached natively
 * with `passive: false` — without it `preventDefault()` cannot stop the scroll.
 */
export default function PullUpToLoad({
  canLoad,
  onLoad,
  resetKey,
  className,
  direction = "up",
  scrollRef,
  actionLabel = "load more",
  busyLabel = "Loading more",
  children,
}: {
  canLoad: boolean;
  onLoad: () => Promise<void>;
  /** Changing this (tab/column/query) cancels any in-progress pull. */
  resetKey?: string | number;
  className?: string;
  /** `up` pulls from the document bottom; `down` pulls from a scroll container's top. */
  direction?: "up" | "down";
  /** Scroll container for `down`; defaults to the document. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Used in the progressbar's aria labels. */
  actionLabel?: string;
  busyLabel?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const busyRef = useRef(false);
  const suppressUntil = useRef(0);
  const aliveRef = useRef(true);
  const springTimer = useRef<number | undefined>(undefined);
  const loadToken = useRef(0);
  const canLoadRef = useRef(canLoad);
  const onLoadRef = useRef(onLoad);
  const directionRef = useRef(direction);
  const scrollRefRef = useRef(scrollRef);
  const labelsRef = useRef({ actionLabel, busyLabel });
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- the portal needs the DOM */
  useEffect(() => {
    aliveRef.current = true;
    setMounted(true);
    return () => {
      aliveRef.current = false;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    canLoadRef.current = canLoad;
    onLoadRef.current = onLoad;
    directionRef.current = direction;
    scrollRefRef.current = scrollRef;
    labelsRef.current = { actionLabel, busyLabel };
  });

  const clearSpring = useCallback(() => {
    if (springTimer.current !== undefined) {
      window.clearTimeout(springTimer.current);
      springTimer.current = undefined;
    }
  }, []);

  const clearIndicator = useCallback(() => {
    const ind = indicatorRef.current;
    if (ind) {
      ind.style.transition = "";
      ind.style.visibility = "hidden";
      ind.style.opacity = "0";
      ind.style.transform = hiddenTransform(directionRef.current === "down");
    }
    const ring = ringRef.current;
    if (ring) ring.style.strokeDashoffset = String(RING);
  }, []);

  const reset = useCallback(() => {
    clearSpring();
    loadToken.current += 1;
    drag.current = null;
    busyRef.current = false;
    const el = rootRef.current;
    if (el) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.willChange = "";
      delete el.dataset.pulling;
    }
    clearIndicator();
  }, [clearIndicator, clearSpring]);

  const springBack = useCallback(
    (immediate: boolean) => {
      clearSpring();
      const el = rootRef.current;
      const ind = indicatorRef.current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!el || immediate || reduced) {
        reset();
        if (aliveRef.current) setBusy(false);
        return;
      }
      el.style.transition = `transform ${SPRING_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.transform = "translate3d(0, 0, 0)";
      if (ind) {
        ind.style.transition = `opacity 140ms ease-out, transform ${SPRING_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        ind.style.opacity = "0";
        ind.style.transform = hiddenTransform(directionRef.current === "down");
      }
      springTimer.current = window.setTimeout(() => {
        springTimer.current = undefined;
        if (!aliveRef.current) return;
        reset();
        setBusy(false);
      }, SPRING_MS + 20);
    },
    [clearSpring, reset],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const isDown = () => directionRef.current === "down";
    const scrollPos = () =>
      isDown() ? (scrollRefRef.current?.current?.scrollTop ?? window.scrollY) : window.scrollY;
    const atEdge = () => (isDown() ? atTop(scrollRefRef.current) : atBottom());

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || busyRef.current || !canLoadRef.current) return;
      if (isTyping() || !atEdge()) return;
      const t = e.touches[0];
      drag.current = {
        x: t.clientX,
        y: t.clientY,
        scroll: scrollPos(),
        claimed: false,
        raw: 0,
        progress: 0,
        aria: -1,
      };
    };

    const onMove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d) return;
      if (e.touches.length !== 1) {
        reset();
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - d.x;
      const dy = t.clientY - d.y;

      const down = isDown();
      if (!d.claimed) {
        // A fling still settling into the edge, or a drag away from it, is not ours.
        if (Math.abs(scrollPos() - d.scroll) > 1 || (down ? dy <= 0 : dy >= 0)) return;
        if (Math.abs(dy) < SLOP || Math.abs(dx) > Math.abs(dy)) return;
        if (!atEdge()) {
          drag.current = null;
          return;
        }
        // A short page still shows the header above this wrapper; sliding it up
        // would put content under the search field. Use the button there instead.
        if (!down && el.getBoundingClientRect().top > 0) return;
        d.claimed = true;
        // The user caught the content mid-spring: cancel its cleanup timer.
        clearSpring();
        el.style.willChange = "transform";
        el.style.transition = "none";
        el.dataset.pulling = "true";
        const ind = indicatorRef.current;
        if (ind) {
          ind.style.transition = "none";
          ind.style.visibility = "visible";
        }
      }

      if (e.cancelable) e.preventDefault();
      // Turning the gesture horizontal hands it back to the carousel/tab swipe.
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        springBack(true);
        return;
      }
      if (Math.abs(scrollPos() - d.scroll) > 1) {
        springBack(true);
        return;
      }

      const raw = Math.max(0, down ? dy : -dy);
      const progress = Math.min(1, Math.max(0, (raw - SLOP) / (TRIGGER - SLOP)));
      d.raw = raw;
      d.progress = progress;

      const lift = Math.min(MAX_LIFT, raw * LIFT_RATIO);
      el.style.transform = `translate3d(0, ${down ? lift : -lift}px, 0)`;

      const ring = ringRef.current;
      if (ring) ring.style.strokeDashoffset = String(RING * (1 - progress));

      const ind = indicatorRef.current;
      if (ind) {
        const opacity = Math.min(1, Math.max(0, (raw - SLOP) / 24));
        const scale = 0.8 + 0.2 * opacity;
        ind.style.transform = down
          ? `translate(-50%, ${-ROLL_DISTANCE * (1 - progress)}px) rotate(${Math.min(raw, TRIGGER) * ROLL_DEGREES_PER_PX}deg) scale(${scale})`
          : `translate(-50%, 0) scale(${scale})`;
        const aria = Math.round(progress * 4) * 25;
        if (aria !== d.aria) {
          d.aria = aria;
          const bar = ind.querySelector('[role="progressbar"]');
          bar?.setAttribute("aria-valuenow", String(aria));
          const { actionLabel } = labelsRef.current;
          bar?.setAttribute("aria-label", progress >= 1 ? `Release to ${actionLabel}` : `Pull to ${actionLabel}`);
        }
      }
    };

    const onEnd = (e: TouchEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.claimed) return;
      const t = e.changedTouches[0];
      if (t) {
        const raw = Math.max(0, isDown() ? t.clientY - d.y : d.y - t.clientY);
        d.progress = Math.min(1, Math.max(0, (raw - SLOP) / (TRIGGER - SLOP)));
      }
      suppressUntil.current = Date.now() + 350;
      if (d.progress >= 1 && canLoadRef.current && !busyRef.current) {
        haptic(10);
        busyRef.current = true;
        const token = ++loadToken.current;
        // The spinner starts upright at the resting spot, not mid-roll.
        const ind = indicatorRef.current;
        if (ind && isDown()) {
          ind.style.transition = `transform ${SPRING_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          ind.style.transform = "translate(-50%, 0) rotate(0deg) scale(1)";
        }
        if (aliveRef.current) setBusy(true);
        void onLoadRef
          .current()
          .catch(() => {
            /* Keep the Load more fallback so the user can retry. */
          })
          .finally(() => {
            // A tab/column change reset the pull while this request was running.
            if (token !== loadToken.current) return;
            busyRef.current = false;
            if (aliveRef.current) springBack(false);
          });
      } else {
        springBack(false);
      }
    };

    const onCancel = () => springBack(true);

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [clearSpring, reset, springBack]);

  // A pull that turns into a tap must not open the row that moved under the finger.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (Date.now() >= suppressUntil.current) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-pull-allow-click]")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    reset();
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- a tab/column/query change cancels the pull */
    setBusy(false);
  }, [resetKey, reset]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") springBack(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [springBack]);

  // Search is hidden (not unmounted) on a tab switch. The portal lives on body,
  // so it must hide itself when its own subtree is no longer rendered.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) springBack(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [springBack]);

  return (
    <div ref={rootRef} className={className}>
      {children}
      {mounted
        ? createPortal(
            <div ref={indicatorRef} className={`pull-indicator ${direction === "down" ? "pull-indicator-top" : ""}`}>
              {busy ? (
                <div
                  role="progressbar"
                  aria-label={busyLabel}
                  aria-valuetext={busyLabel}
                  className="h-11 w-11 animate-spin rounded-full border-[3px] border-line border-t-accent"
                />
              ) : (
                <svg
                  viewBox="0 0 44 44"
                  role="progressbar"
                  aria-label={`Pull to ${actionLabel}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={0}
                  className="h-11 w-11 -rotate-90"
                >
                  <circle cx="22" cy="22" r={RING_RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="3" />
                  <circle
                    ref={ringRef}
                    cx="22"
                    cy="22"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING}
                    strokeDashoffset={RING}
                  />
                </svg>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
