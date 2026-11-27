"use client";

import { useRef, type ReactNode } from "react";
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
