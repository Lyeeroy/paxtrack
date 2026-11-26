"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/toast";

type IconProps = { className?: string };
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconLibrary = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
export const IconCalendar = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </svg>
);
export const IconSearch = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const IconHistory = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4.5l3 1.5" />
  </svg>
);
export const IconSettings = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);
export const IconFilterList = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </svg>
);
export const IconPlus = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconCheck = ({ className }: IconProps) => (
  <svg {...base} className={className} strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconBack = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);
export const IconClose = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconDownload = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);
export const IconCopy = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);
export const IconUpload = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export function posterUrl(path: string | null, w: 92 | 154 | 185 = 154) {
  return path ? `https://image.tmdb.org/t/p/w${w}${path}` : null;
}

export function Poster({ path, title, w = 44, h = 64 }: { path: string | null; title: string; w?: number; h?: number }) {
  // A 92 px TMDB image is plenty for the 32–44 px list thumbnails; w154 is for
  // the detail hero. Smaller files mean less decode work while scrolling.
  const src = posterUrl(path, w <= 60 ? 92 : 154);
  return (
    <div className="shrink-0 overflow-hidden rounded-md bg-raised" style={{ width: w, height: h }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={w} height={h} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-faint" aria-hidden>
          {title.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label ?? "Progress"}
      className="h-[3px] w-full overflow-hidden rounded-full bg-line"
    >
      <div className="h-full origin-left rounded-full bg-accent transition-transform duration-300" style={{ transform: `scaleX(${value})`, width: "100%" }} />
    </div>
  );
}

export function TypeTag({ anime, type }: { anime: boolean; type: "tv" | "movie" }) {
  return <span className="text-[10px] font-medium uppercase tracking-wider text-faint">{anime ? "Anime" : type === "tv" ? "TV" : "Movie"}</span>;
}

export function ScreenHeader({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <header className="flex items-end justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+16px)]">
      <div>
        <h1 className="text-[26px] font-semibold leading-none tracking-tight">{title}</h1>
        {sub ? <p className="mt-1.5 text-xs text-dim">{sub}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-8 py-20 text-center">
      <p className="text-[15px] text-dim">{title}</p>
      {hint ? <p className="mt-1.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

/**
 * Horizontal swipe gesture row. Drag is applied straight to the DOM (no React
 * re-renders while dragging) so it stays at 60fps on low-end devices.
 */
export function SwipeRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel,
  leftLabel,
  className = "",
}: {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  className?: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const bgR = useRef<HTMLDivElement>(null);
  const bgL = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 0, y: 0, id: -1, lock: 0, dx: 0, dragged: false });
  const THRESH = 72;

  const reset = () => {
    const c = content.current;
    if (c) {
      c.style.transition = "transform 180ms ease-out";
      c.style.transform = "";
    }
    if (bgR.current) bgR.current.style.opacity = "0";
    if (bgL.current) bgL.current.style.opacity = "0";
  };

  return (
    <div data-swipe className={`relative overflow-hidden ${className}`}>
      {onSwipeRight ? (
        <div ref={bgR} aria-hidden className="absolute inset-0 flex items-center bg-accent/15 px-5 text-sm font-medium text-accent opacity-0">
          {rightLabel}
        </div>
      ) : null}
      {onSwipeLeft ? (
        <div ref={bgL} aria-hidden className="absolute inset-0 flex items-center justify-end bg-warn/15 px-5 text-sm font-medium text-warn opacity-0">
          {leftLabel}
        </div>
      ) : null}
      <div
        ref={content}
        className="swipe-y relative bg-black"
        onClickCapture={(e) => {
          if (st.current.dragged) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, lock: 0, dx: 0, dragged: false };
        }}
        onPointerMove={(e) => {
          const s = st.current;
          if (s.id !== e.pointerId || s.lock === 2) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!s.lock) {
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              s.lock = 1;
              content.current?.setPointerCapture(e.pointerId);
              if (content.current) content.current.style.transition = "none";
            } else if (Math.abs(dy) > 10) s.lock = 2;
            return;
          }
          let d = dx;
          if ((d > 0 && !onSwipeRight) || (d < 0 && !onSwipeLeft)) d = 0;
          s.dx = d;
          s.dragged = true;
          const shown = Math.sign(d) * Math.min(Math.abs(d), 130);
          if (content.current) content.current.style.transform = `translate3d(${shown}px,0,0)`;
          const o = String(Math.min(1, Math.abs(d) / THRESH));
          if (bgR.current) bgR.current.style.opacity = d > 0 ? o : "0";
          if (bgL.current) bgL.current.style.opacity = d < 0 ? o : "0";
        }}
        onPointerUp={(e) => {
          const s = st.current;
          if (s.id !== e.pointerId) return;
          if (s.lock === 1) {
            if (s.dx > THRESH) {
              haptic();
              onSwipeRight?.();
            } else if (s.dx < -THRESH) {
              haptic();
              onSwipeLeft?.();
            }
            reset();
            setTimeout(() => (st.current.dragged = false), 60);
          }
          st.current.id = -1;
        }}
        onPointerCancel={() => {
          st.current.id = -1;
          st.current.dragged = false;
          reset();
        }}
      >
        {children}
      </div>
    </div>
  );
}

const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)"; // keep in sync with --ease-sheet in globals.css
const SHEET_OPEN_MS = 260; // keep in sync with .anim-sheet in globals.css
const SHEET_CLOSE_MS = 200;
const SHEET_SNAP_MS = 200;
const SHEET_CLOSE_VELOCITY = 0.35; // px/ms — a flick, not a slow drag
const SHEET_SCROLL_LOCK_MS = 120; // don't turn the end of a scroll into a dismiss
const SHEET_DETENT_MS = 200; // resize between collapsed and expanded
const SHEET_DETENT_MIN = 48; // min travel before a resize is committed

type SheetPhase = "closed" | "opening" | "open" | "closing";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Current translateY of an element, including an in-flight CSS animation. */
function translateY(el: HTMLElement) {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return 0;
  try {
    return new DOMMatrixReadOnly(transform).m42;
  } catch {
    return 0;
  }
}

type SheetDragMode = "dismiss" | "expand" | "collapse";

type SheetDrag = {
  id: number;
  startX: number;
  startY: number;
  baseY: number;
  baseH: number;
  collapsedH: number;
  expandedH: number;
  fromChrome: boolean;
  mode: SheetDragMode | null;
  active: boolean;
  points: { dy: number; t: number }[];
};

function expandedHeight() {
  return Math.round(window.innerHeight);
}

/** Natural (content-driven) height, capped by the caller's maxHeight. */
function measureCollapsed(el: HTMLElement, maxHeight: string) {
  const prevH = el.style.height;
  const prevMax = el.style.maxHeight;
  el.style.height = "auto";
  el.style.maxHeight = maxHeight;
  const h = el.offsetHeight;
  el.style.height = prevH;
  el.style.maxHeight = prevMax;
  return h;
}

export type SheetProps = {
  open: boolean;
  /** Must set `open` to false (or pop the matching history entry). */
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxHeight?: string;
};

/**
 * Reusable modal bottom sheet. The parent owns `open` and (in the detail view)
 * the history entry; this component owns the enter/exit motion, drag-to-dismiss,
 * the collapsed/expanded detents, scrim fade, focus trap and close button.
 *
 * Dismissal starts the exit immediately; the parent's `onClose` runs in the
 * same tick, so history and the closing animation never drift apart. A drag is
 * only picked up from the sheet chrome, or from content that is scrolled to the
 * top, so it can never swallow a downward content scroll. Dragging up from the
 * chrome expands the sheet to the top of the screen; dragging down from there
 * returns it to the default height. Each gesture moves one detent.
 *
 * Keep the exit path in one place (here) rather than adding timers in parents.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, maxHeight = "78dvh" }: SheetProps) {
  const [rendered, setRendered] = useState(open);
  const [expanded, setExpanded] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const phase = useRef<SheetPhase>(open ? "opening" : "closed");
  const drag = useRef<SheetDrag | null>(null);
  const lastScrollAt = useRef(0);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelAnim = useRef<Animation | null>(null);
  const backdropAnim = useRef<Animation | null>(null);
  const heightAnim = useRef<Animation | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(
    () => () => {
      panelAnim.current?.cancel();
      backdropAnim.current?.cancel();
      heightAnim.current?.cancel();
      if (suppressTimer.current) clearTimeout(suppressTimer.current);
    },
    [],
  );

  /** Stop the CSS entrance in place and hand its current offset back. */
  const stopIntro = useCallback(() => {
    const p = panel.current;
    let y = 0;
    if (p) {
      y = translateY(p);
      if (p.classList.contains("anim-sheet")) {
        p.classList.remove("anim-sheet");
        p.style.transform = y ? `translate3d(0,${y}px,0)` : "";
      }
    }
    const b = backdrop.current;
    if (b && b.classList.contains("anim-fade")) {
      const opacity = Number.parseFloat(getComputedStyle(b).opacity);
      b.classList.remove("anim-fade");
      b.style.opacity = Number.isFinite(opacity) ? String(opacity) : "1";
    }
    return y;
  }, []);

  const animatePanel = useCallback((from: number, to: number, ms: number, done?: () => void) => {
    const el = panel.current;
    if (!el) return;
    panelAnim.current?.cancel();
    panelAnim.current = null;
    if (ms <= 0) {
      el.style.transform = to ? `translate3d(0,${to}px,0)` : "";
      done?.();
      return;
    }
    const anim = el.animate(
      [
        { transform: `translate3d(0,${from}px,0)` },
        { transform: to ? `translate3d(0,${to}px,0)` : "translate3d(0,0,0)" },
      ],
      { duration: ms, easing: SHEET_EASE, fill: "both" },
    );
    panelAnim.current = anim;
    anim.onfinish = () => {
      if (panelAnim.current === anim) panelAnim.current = null;
      el.style.transform = to ? `translate3d(0,${to}px,0)` : "";
      anim.cancel();
      done?.();
    };
  }, []);

  const animateBackdrop = useCallback((to: number, ms: number) => {
    const el = backdrop.current;
    if (!el) return;
    backdropAnim.current?.cancel();
    backdropAnim.current = null;
    const current = Number.parseFloat(getComputedStyle(el).opacity);
    if (ms <= 0) {
      el.style.opacity = String(to);
      return;
    }
    const anim = el.animate([{ opacity: Number.isFinite(current) ? current : to }, { opacity: to }], {
      duration: ms,
      easing: SHEET_EASE,
      fill: "both",
    });
    backdropAnim.current = anim;
    anim.onfinish = () => {
      if (backdropAnim.current === anim) backdropAnim.current = null;
      el.style.opacity = String(to);
      anim.cancel();
    };
  }, []);

  const animateHeight = useCallback((from: number, to: number, ms: number, done?: () => void) => {
    const el = panel.current;
    if (!el) return;
    heightAnim.current?.cancel();
    heightAnim.current = null;
    if (ms <= 0) {
      el.style.height = `${to}px`;
      done?.();
      return;
    }
    const anim = el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: ms,
      easing: SHEET_EASE,
      fill: "both",
    });
    heightAnim.current = anim;
    anim.onfinish = () => {
      if (heightAnim.current === anim) heightAnim.current = null;
      el.style.height = `${to}px`;
      anim.cancel();
      done?.();
    };
  }, []);

  /** Commit a detent: DOM style first, then React state so they cannot fight. */
  const setDetent = useCallback((isExpanded: boolean, h?: number) => {
    const el = panel.current;
    if (el) {
      el.style.maxHeight = isExpanded ? "100dvh" : maxHeight;
      el.style.height = h === undefined ? (isExpanded ? "100dvh" : "") : `${h}px`;
    }
    setExpanded(isExpanded);
  }, [maxHeight]);

  const beginClose = useCallback(
    (notify: boolean) => {
      if (phase.current === "closing" || phase.current === "closed") return;
      const el = panel.current;
      if (!el) {
        phase.current = "closed";
        setExpanded(false);
        setRendered(false);
        return;
      }
      phase.current = "closing";
      stopIntro();
      heightAnim.current?.cancel();
      heightAnim.current = null;
      const from = translateY(el);
      const ms = reducedMotion() ? 0 : SHEET_CLOSE_MS;
      animatePanel(from, el.offsetHeight, ms, () => {
        phase.current = "closed";
        setExpanded(false);
        setRendered(false);
      });
      animateBackdrop(0, ms);
      if (notify) onCloseRef.current();
    },
    [animateBackdrop, animatePanel, stopIntro],
  );

  const beginOpen = useCallback(() => {
    if (phase.current === "opening" || phase.current === "open") return;
    setExpanded(false);
    if (!panel.current || phase.current === "closed") {
      phase.current = "opening";
      setRendered(true);
      return;
    }
    phase.current = "opening";
    stopIntro();
    const from = translateY(panel.current);
    const ms = reducedMotion() ? 0 : SHEET_OPEN_MS;
    animatePanel(from, 0, ms, () => {
      if (phase.current === "opening") phase.current = "open";
    });
    animateBackdrop(1, ms);
  }, [animateBackdrop, animatePanel, stopIntro]);

  useEffect(() => {
    if (open) beginOpen();
    else beginClose(false);
  }, [open, beginOpen, beginClose]);

  useEffect(() => {
    if (!rendered) return;
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus({ preventScroll: true });

    const focusables = () => {
      const el = panel.current;
      if (!el) return [] as HTMLElement[];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.getClientRects().length > 0);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase.current === "closing" || phase.current === "closed") return;
        e.preventDefault();
        e.stopPropagation();
        beginClose(true);
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // A modal sheet owns focus; a stray programmatic focus must come back.
    const onFocusIn = (e: FocusEvent) => {
      if (phase.current === "closing" || phase.current === "closed") return;
      const el = panel.current;
      if (el && !el.contains(e.target as Node)) el.focus({ preventScroll: true });
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = bodyOverflow;
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [rendered, beginClose]);

  // A touch pan on a scroll container is owned by the browser: without this,
  // the browser starts scrolling and fires pointercancel before the drag can
  // activate. Preventing the default only for a downward gesture that starts
  // at the top keeps native scrolling everywhere else.
  useEffect(() => {
    if (!rendered) return;
    const el = panel.current;
    if (!el) return;
    let start: { x: number; y: number; inScroller: boolean; interactive: boolean } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      const touch = e.touches[0];
      const target = e.target as HTMLElement;
      start = {
        x: touch.clientX,
        y: touch.clientY,
        inScroller: !!scroll.current?.contains(target),
        interactive: !!target.closest(
          "button, a, input, textarea, select, [contenteditable='true'], [role='slider'], [role='switch']",
        ),
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1 || !start.inScroller || start.interactive) return;
      if (!drag.current) return;
      const scroller = scroll.current;
      if (!scroller || scroller.scrollTop > 0) return;
      const touch = e.touches[0];
      const dy = touch.clientY - start.y;
      const dx = touch.clientX - start.x;
      if (dy > 6 && Math.abs(dy) > Math.abs(dx)) e.preventDefault();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [rendered]);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase.current !== "open" && phase.current !== "opening") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [contenteditable='true'], [role='slider'], [role='switch']")) return;
    const scroller = scroll.current;
    if (scroller?.contains(target)) {
      // Content that is scrolled down owns the gesture. Never steal it: that
      // was the bug that made the sheet impossible to scroll back up.
      if (scroller.scrollTop > 0) return;
      if (performance.now() - lastScrollAt.current < SHEET_SCROLL_LOCK_MS) return;
    }
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseY: 0,
      baseH: 0,
      collapsedH: 0,
      expandedH: 0,
      fromChrome: !scroller?.contains(target),
      mode: null,
      active: false,
      points: [],
    };
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = panel.current;
    if (!d || !el || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        drag.current = null;
        return;
      }
      // Each gesture moves one detent: down dismisses (or collapses from the
      // top), up from the chrome expands. Up from content stays with scrolling.
      let mode: SheetDragMode | null = null;
      if (dy > 0) mode = expanded ? "collapse" : "dismiss";
      else if (d.fromChrome && !expanded) mode = "expand";
      if (!mode) {
        drag.current = null;
        return;
      }
      d.mode = mode;
      d.active = true;
      d.baseY = stopIntro();
      d.baseH = el.offsetHeight;
      d.expandedH = expandedHeight();
      d.collapsedH = mode === "collapse" ? measureCollapsed(el, maxHeight) : d.baseH;
      if (mode === "expand") el.style.maxHeight = "100dvh";
      if (phase.current === "opening") phase.current = "open";
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer can already be gone on a fast flick.
      }
    }
    e.preventDefault();
    const now = performance.now();
    d.points.push({ dy, t: now });
    while (d.points.length > 2 && now - d.points[0].t > 120) d.points.shift();

    if (d.mode === "dismiss") {
      const y = Math.max(0, d.baseY + dy);
      el.style.transform = `translate3d(0,${y}px,0)`;
      const height = el.offsetHeight || 1;
      if (backdrop.current) backdrop.current.style.opacity = String(Math.max(0, 1 - y / height));
    } else if (d.mode === "expand") {
      el.style.height = `${Math.min(d.expandedH, Math.max(d.baseH, d.baseH - dy))}px`;
    } else {
      el.style.height = `${Math.min(d.baseH, Math.max(d.collapsedH, d.baseH - dy))}px`;
    }
  };

  const snapBack = (from: number) => {
    const ms = reducedMotion() ? 0 : SHEET_SNAP_MS;
    animatePanel(from, 0, ms);
    animateBackdrop(1, ms);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active || !d.mode) return;
    e.preventDefault();
    const el = panel.current;
    const now = performance.now();
    const last = d.points[d.points.length - 1];
    const first = d.points.find((p) => now - p.t <= 120) ?? d.points[0];
    let velocity = 0;
    if (last && first && now - last.t <= 100) {
      const dt = last.t - first.t;
      if (dt > 0) velocity = Math.max(0, Math.min(3, Math.abs(last.dy - first.dy) / dt));
    }
    const ms = reducedMotion() ? 0 : SHEET_DETENT_MS;

    if (d.mode === "dismiss") {
      const y = el ? translateY(el) : 0;
      if (cancelled) {
        snapBack(y);
      } else {
        const height = el?.offsetHeight || 1;
        // Distance OR speed. A short fast flick should dismiss; a slow quarter
        // drag should too. A fixed 72 px threshold felt sticky and accidental.
        const threshold = Math.min(Math.max(height * 0.25, 64), 180);
        if (y > threshold || velocity > SHEET_CLOSE_VELOCITY) {
          haptic();
          beginClose(true);
        } else {
          snapBack(y);
        }
      }
    } else if (d.mode === "expand") {
      const h = el?.offsetHeight ?? d.baseH;
      const travel = h - d.baseH;
      const threshold = Math.min(Math.max((d.expandedH - d.baseH) * 0.25, SHEET_DETENT_MIN), 180);
      if (!cancelled && (travel > threshold || velocity > SHEET_CLOSE_VELOCITY)) {
        haptic();
        if (el) el.style.maxHeight = "100dvh";
        animateHeight(h, d.expandedH, ms, () => setDetent(true, d.expandedH));
      } else {
        animateHeight(h, d.baseH, ms, () => setDetent(false));
      }
    } else {
      const h = el?.offsetHeight ?? d.baseH;
      const travel = d.baseH - h;
      const threshold = Math.min(Math.max((d.baseH - d.collapsedH) * 0.25, SHEET_DETENT_MIN), 180);
      if (!cancelled && (travel > threshold || velocity > SHEET_CLOSE_VELOCITY)) {
        haptic();
        animateHeight(h, d.collapsedH, ms, () => setDetent(false));
      } else {
        animateHeight(h, d.baseH, ms, () => setDetent(true, d.expandedH));
      }
    }

    suppressClick.current = true;
    if (suppressTimer.current) clearTimeout(suppressTimer.current);
    suppressTimer.current = setTimeout(() => {
      suppressClick.current = false;
      suppressTimer.current = null;
    }, 350);
  };

  if (!rendered || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[45]">
      <div
        ref={backdrop}
        aria-hidden
        onClick={() => {
          if (suppressClick.current) return;
          beginClose(true);
        }}
        className="anim-fade absolute inset-0 touch-none bg-black/70"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          if (e.target === panel.current && phase.current === "opening") phase.current = "open";
        }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={(e) => finishDrag(e)}
        onPointerCancel={(e) => finishDrag(e, true)}
        className="anim-sheet outline-none absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col overflow-hidden rounded-t-2xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+12px)]"
        style={{ maxHeight: expanded ? "100dvh" : maxHeight, height: expanded ? "100dvh" : undefined }}
      >
        {expanded ? <div aria-hidden className="h-[env(safe-area-inset-top)] shrink-0" /> : null}
        <div className="shrink-0 cursor-grab touch-none px-3 pt-2.5 active:cursor-grabbing">
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line" />
          <div className="mt-1 flex items-start gap-2 px-1 pb-2">
            <div className="min-w-0 flex-1 pt-1.5">
              <h2 id={titleId} className="truncate text-[16px] font-semibold leading-tight">
                {title}
              </h2>
              {subtitle ? (
                <p id={subtitleId} className="mt-0.5 truncate text-xs text-dim">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => beginClose(true)}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-dim active:bg-raised hover:text-fg"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div
          ref={scroll}
          data-sheet-scroll
          onScroll={() => {
            lastScrollAt.current = performance.now();
          }}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
        {footer ? <div className="shrink-0 touch-none border-t border-line/70 px-4 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
