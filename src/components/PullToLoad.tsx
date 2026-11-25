"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bottom-pull gesture for loading the next page.
 *
 * Follows the mechanics of Android's SwipeRefreshLayout and the common web
 * pull-to-refresh hook: a touch-slop gate, damped travel (the content gives a
 * little, then gets harder), an arc that stays empty for the first 40% of the
 * pull and fills to 80% at the trigger, and a spinner held until loading ends.
 * It only arms on a FRESH touch that starts at the document bottom — scroll
 * momentum carrying the user there does not count.
 */
const TOUCH_SLOP = 8;
/** Asymptotic maximum content travel (px). */
const MAX_PULL = 140;
/** How quickly travel approaches the maximum. */
const DAMPING = 0.6;
/** Finger travel needed to trigger a load (px). */
const TRIGGER_DY = 120;
/** Ignore a touch this soon after the last scroll event (ms). */
const MOMENTUM_GUARD_MS = 140;
const RETURN_MS = 180;
const RETURN_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

function damped(dy: number): number {
  return MAX_PULL * (1 - Math.exp((-DAMPING * dy) / MAX_PULL));
}

export default function PullToLoad({
  children,
  onTrigger,
  disabled,
  busy,
}: {
  children: ReactNode;
  onTrigger: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const arcRef = useRef<SVGCircleElement | null>(null);
  const disabledRef = useRef(disabled);
  const triggerRef = useRef(onTrigger);
  const lastScroll = useRef(0);
  const collapsing = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    disabledRef.current = disabled;
    triggerRef.current = onTrigger;
  }, [disabled, onTrigger]);

  const collapse = () => {
    const el = contentRef.current;
    const indicator = indicatorRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (el) {
      el.style.transition = reduced ? "none" : `transform ${RETURN_MS}ms ${RETURN_EASE}`;
      el.style.transform = "translate3d(0, 0, 0)";
    }
    if (indicator) {
      indicator.style.transition = reduced ? "none" : "opacity 140ms linear";
      indicator.style.opacity = "0";
    }
    collapsing.current = true;
    setLoading(false);
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let startY = 0;
    let raw = 0;
    let armed = false;

    const paint = (dy: number) => {
      const p = Math.max(0, Math.min(1, dy / TRIGGER_DY));
      // Android's curve: nothing until 40%, then up to an 80% full circle.
      const adjusted = Math.max(p - 0.4, 0) * (5 / 3);
      const arc = Math.min(0.8, adjusted * 0.8);
      arcRef.current?.setAttribute("stroke-dashoffset", String(100 - arc * 100));
      const indicator = indicatorRef.current;
      if (indicator) {
        indicator.style.opacity = String(0.3 + 0.7 * p);
        indicator.style.transform = `translateX(-50%) scale(${(0.6 + 0.4 * p).toFixed(3)})`;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      if (!armed) {
        if (dy <= TOUCH_SLOP) return;
        armed = true;
        if (el) el.style.transition = "none";
      }
      if (dy <= 0) {
        if (el) el.style.transform = "translate3d(0, 0, 0)";
        paint(0);
        raw = 0;
        return;
      }
      raw = dy;
      if (el) el.style.transform = `translate3d(0, ${damped(dy).toFixed(1)}px, 0)`;
      paint(dy);
      // Only cancel the browser's own overscroll once the gesture is ours.
      if (e.cancelable) e.preventDefault();
    };

    const detach = () => {
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };

    const onEnd = () => {
      detach();
      if (!armed) return;
      armed = false;
      const shouldTrigger = raw >= TRIGGER_DY && !disabledRef.current;
      raw = 0;
      if (shouldTrigger) {
        // Hold at the trigger while the caller loads, like a refresh spinner.
        if (el) {
          el.style.transition = `transform ${RETURN_MS}ms ${RETURN_EASE}`;
          el.style.transform = `translate3d(0, ${damped(TRIGGER_DY).toFixed(1)}px, 0)`;
        }
        paint(TRIGGER_DY);
        setLoading(true);
        triggerRef.current();
      } else {
        collapse();
      }
    };

    const onStart = (e: TouchEvent) => {
      if (disabledRef.current || e.touches.length !== 1) return;
      const doc = document.scrollingElement ?? document.documentElement;
      const atBottom = doc.scrollTop + window.innerHeight >= doc.scrollHeight - 2;
      if (!atBottom || Date.now() - lastScroll.current < MOMENTUM_GUARD_MS) return;
      startY = e.touches[0].clientY;
      raw = 0;
      armed = false;
      collapsing.current = false;
      el.addEventListener("touchmove", onMove, { passive: false });
      el.addEventListener("touchend", onEnd);
      el.addEventListener("touchcancel", onEnd);
    };

    const onScroll = () => {
      lastScroll.current = Date.now();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      detach();
      el.removeEventListener("touchstart", onStart);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // The caller flips `busy` off when loading finishes (or fails): collapse.
  useEffect(() => {
    if (loading && !busy && !collapsing.current) collapse();
  }, [loading, busy]);

  return (
    <>
      <div ref={contentRef} className="will-change-transform">
        {children}
      </div>
      <div
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none fixed left-1/2 z-30 opacity-0"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 92px)" }}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-lg shadow-black/50">
          <svg viewBox="0 0 40 40" className={`h-9 w-9 ${loading ? "animate-spin" : ""}`}>
            <g transform="rotate(-90 20 20)">
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-line)" strokeWidth="3" />
              <circle
                ref={arcRef}
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset="100"
              />
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
