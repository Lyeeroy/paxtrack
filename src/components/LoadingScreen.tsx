"use client";

import { useEffect, useRef, useState } from "react";

// The store is usually ready almost instantly. Keep the splash up just long
// enough for the cube to draw once so it never flashes for a single frame.
const MIN_VISIBLE_MS = 650;

export default function LoadingScreen({ ready }: { ready: boolean }) {
  const startedAt = useRef(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  // Capture the mount time in an effect so render stays pure. This effect runs
  // before the one below, including when the store is already ready at mount.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!ready || gone) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
    const id = window.setTimeout(() => setLeaving(true), wait);
    return () => window.clearTimeout(id);
  }, [ready, gone]);

  if (gone) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`splash fixed inset-0 z-[60] flex flex-col items-center justify-center bg-brand text-black ${leaving ? "splash-leave" : ""}`}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && leaving) setGone(true);
      }}
    >
      {/* Paths mirror src/app/icon.svg; pathLength=100 normalises the draw. */}
      <svg className="splash-mark" viewBox="0 0 64 64" width={96} height={96} aria-hidden="true">
        <circle className="splash-halo" cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
        <circle cx="32" cy="32" r="30" fill="currentColor" />
        <g className="splash-box text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
          <path className="splash-edge splash-edge-a" pathLength={100} d="M32 16 L46.8 24 L46.8 40 L32 48 L17.2 40 L17.2 24 Z" />
          <path className="splash-edge splash-edge-b" pathLength={100} d="M32 32 L17.2 24 M32 32 L46.8 24 M32 32 L32 48" />
        </g>
      </svg>
      <span className="mt-7 text-[11px] font-semibold uppercase tracking-[0.35em] text-black/70">Tracker</span>
      <span className="mt-3 block h-0.5 w-16 overflow-hidden rounded-full bg-black/20">
        <span className="splash-bar block h-full w-[40%] rounded-full bg-black/70" />
      </span>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
