"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bottom-pull gesture for loading the next page.
 *
 * Follows the mechanics of Android's SwipeRefreshLayout and the common web
 * pull-to-refresh hook: a touch-slop gate, damped travel (the content gives a
 * little, then gets harder), an arc that stays empty for the first 40% of the
 * pull and fills to 80% at the trigger, and a spinner held until loading ends.
 * It arms the moment an ACTIVE touch reaches the document bottom, so the same
 * finger can keep dragging and reveal the circle. Scroll momentum cannot
 * trigger it because there is no finger down once a fling starts.
 */
const TOUCH_SLOP = 8;
/** Asymptotic maximum content travel (px). */
const MAX_PULL = 140;
/** How quickly travel approaches the maximum. */
const DAMPING = 0.6;
/** Finger travel past the bottom needed to trigger a load (px). */
const TRIGGER_DY = 120;
/** Rows can grow a few px after scrolling (hydration/images); still count as bottom. */
const BOTTOM_TOLERANCE = 64;
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
    /** Pointer Y at the moment the document hit the bottom. */
    let bottomY = 0;
    let reachedBottom = false;
    let visual = false;
    let raw = 0;
    let mouse = false;

    const atBottom = () => {
      const doc = document.scrollingElement ?? document.documentElement;
      return doc.scrollTop + window.innerHeight >= doc.scrollHeight - BOTTOM_TOLERANCE;
    };

    const begin = (y: number) => {
      bottomY = y;
      reachedBottom = false;
      visual = false;
      raw = 0;
      collapsing.current = false;
    };

    const resetVisual = () => {
      el.style.transform = "translate3d(0, 0, 0)";
      arcRef.current?.setAttribute("stroke-dashoffset", "100");
      if (indicatorRef.current) indicatorRef.current.style.opacity = "0";
      visual = false;
      raw = 0;
    };

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

    // Scrolling down to the end moves the finger UP. Once the document is at
    // the bottom, keep going UP to expose the indicator below the list.
    const move = (y: number, e: Event) => {
      if (!reachedBottom) {
        if (!atBottom()) return;
        reachedBottom = true;
        bottomY = y;
      }
      const dy = bottomY - y;
      if (dy <= TOUCH_SLOP) {
        if (visual) resetVisual();
        // Scrolled back away from the bottom: hand control to the browser.
        if (!atBottom()) reachedBottom = false;
        return;
      }
      visual = true;
      el.style.transition = "none";
      raw = dy;
      el.style.transform = `translate3d(0, -${damped(dy).toFixed(1)}px, 0)`;
      paint(dy);
      // Only cancel the browser's own overscroll once the gesture is ours.
      if (e.cancelable) e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) move(e.touches[0].clientY, e);
    };
    const onMouseMove = (e: MouseEvent) => move(e.clientY, e);

    const detach = () => {
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", end);
    };

    const end = () => {
      detach();
      if (!visual) return;
      const shouldTrigger = raw >= TRIGGER_DY && !disabledRef.current;
      raw = 0;
      visual = false;
      reachedBottom = false;
      mouse = false;
      if (shouldTrigger) {
        // Hold at the trigger while the caller loads, like a refresh spinner.
        el.style.transition = `transform ${RETURN_MS}ms ${RETURN_EASE}`;
        el.style.transform = `translate3d(0, -${damped(TRIGGER_DY).toFixed(1)}px, 0)`;
        paint(TRIGGER_DY);
        setLoading(true);
        triggerRef.current();
      } else {
        collapse();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || e.touches.length !== 1) return;
      begin(e.touches[0].clientY);
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      el.addEventListener("touchend", end);
      el.addEventListener("touchcancel", end);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (disabledRef.current || e.button !== 0) return;
      begin(e.clientY);
      mouse = true;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", end);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    return () => {
      detach();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("mousedown", onMouseDown);
      if (mouse) window.removeEventListener("mouseup", end);
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
