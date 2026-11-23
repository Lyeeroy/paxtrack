"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { haptic } from "@/lib/toast";
import { IconCheck } from "./ui";

type Phase = "idle" | "pulling" | "ready" | "refreshing" | "done";

const THRESHOLD = 90;
const R = 18;
const CIRC = 2 * Math.PI * R;

/**
 * Pull-down-from-top gesture for a scroll container.
 *
 * The gesture state lives here rather than in the parent, so a drag only
 * re-renders this small indicator — never the whole tab tree. Touch events
 * (with a non-passive touchmove) let us take over the vertical drag at scroll
 * top without the native browser refresh stealing it; mouse drag works too.
 */
export default function PullToRefresh({
  target,
  onRefresh,
  enabled = true,
}: {
  target: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const callback = useRef(onRefresh);
  const active = useRef(enabled);

  useEffect(() => {
    callback.current = onRefresh;
    active.current = enabled;
  });

  useEffect(() => {
    const el = target.current;
    if (!el) return;

    const s = {
      id: -1,
      x: 0,
      y: 0,
      scroll: 0,
      pulling: false,
      ready: false,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    let mouseBound = false;

    const clear = () => {
      setProgress(0);
      setPhase("idle");
    };

    const begin = (id: number, x: number, y: number) => {
      if (!active.current || s.id !== -1 || window.scrollY > 0) return;
      s.id = id;
      s.x = x;
      s.y = y;
      s.scroll = window.scrollY;
      s.pulling = false;
      s.ready = false;
    };

    const move = (x: number, y: number, prevent?: () => void) => {
      if (s.id === -1) return;
      const dy = y - s.y;
      const dx = x - s.x;
      if (!s.pulling) {
        if (dy <= 8 || dy <= Math.abs(dx) * 1.25) return;
        if (window.scrollY > s.scroll + 2) {
          s.id = -1;
          clear();
          return;
        }
        s.pulling = true;
        setPhase("pulling");
      }
      if (window.scrollY > s.scroll + 2) {
        s.id = -1;
        clear();
        return;
      }
      prevent?.();
      const p = Math.min(1, Math.max(0, dy / THRESHOLD));
      setProgress(p);
      if (p >= 1) {
        if (!s.ready) {
          s.ready = true;
          setPhase("ready");
          haptic();
        }
      } else {
        s.ready = false;
        setPhase("pulling");
      }
    };

    const end = (id: number) => {
      if (s.id !== id) return;
      const fire = s.pulling && s.ready;
      s.id = -1;
      s.pulling = false;
      if (!fire) {
        clear();
        return;
      }
      haptic();
      setProgress(1);
      setPhase("refreshing");
      void Promise.resolve(callback.current())
        .catch(() => {})
        .finally(() => {
          setPhase("done");
          haptic();
          s.timer = setTimeout(() => {
            s.timer = undefined;
            clear();
          }, 650);
        });
    };

    const cancel = () => {
      if (s.id === -1) return;
      s.id = -1;
      s.pulling = false;
      s.ready = false;
      clear();
    };

    const onTS = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if ((t.target as HTMLElement | null)?.closest("input,textarea,select,[contenteditable]")) return;
      begin(t.identifier, t.clientX, t.clientY);
    };
    const onTM = (e: TouchEvent) => {
      const t = Array.from(e.touches).find((x) => x.identifier === s.id);
      if (!t) return;
      move(t.clientX, t.clientY, () => {
        if (e.cancelable) e.preventDefault();
      });
    };
    const onTE = (e: TouchEvent) => {
      if (Array.from(e.changedTouches).some((t) => t.identifier === s.id)) end(s.id);
    };
    const onTC = (e: TouchEvent) => {
      if (Array.from(e.changedTouches).some((t) => t.identifier === s.id)) cancel();
    };

    const unbindMouse = () => {
      window.removeEventListener("pointermove", onPM);
      window.removeEventListener("pointerup", onPU);
      window.removeEventListener("pointercancel", onPC);
      mouseBound = false;
    };
    const onPM = (e: PointerEvent) => {
      if (e.pointerId === s.id) move(e.clientX, e.clientY);
    };
    const onPU = (e: PointerEvent) => {
      if (e.pointerId !== s.id) return;
      unbindMouse();
      end(e.pointerId);
    };
    const onPC = (e: PointerEvent) => {
      if (e.pointerId !== s.id) return;
      unbindMouse();
      cancel();
    };
    const onPD = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if ((e.target as HTMLElement | null)?.closest("input,textarea,select,[contenteditable]")) return;
      begin(e.pointerId, e.clientX, e.clientY);
      if (s.id === e.pointerId && !mouseBound) {
        mouseBound = true;
        window.addEventListener("pointermove", onPM);
        window.addEventListener("pointerup", onPU);
        window.addEventListener("pointercancel", onPC);
      }
    };

    el.addEventListener("touchstart", onTS, { passive: true });
    el.addEventListener("touchmove", onTM, { passive: false });
    el.addEventListener("touchend", onTE, { passive: true });
    el.addEventListener("touchcancel", onTC, { passive: true });
    el.addEventListener("pointerdown", onPD);

    return () => {
      el.removeEventListener("touchstart", onTS);
      el.removeEventListener("touchmove", onTM);
      el.removeEventListener("touchend", onTE);
      el.removeEventListener("touchcancel", onTC);
      el.removeEventListener("pointerdown", onPD);
      unbindMouse();
      if (s.timer) clearTimeout(s.timer);
    };
  }, [target]);

  const activePhase = phase !== "idle";
  const spinning = phase === "refreshing";
  const full = phase === "ready" || phase === "done";
  const dash = spinning ? `${(CIRC * 0.22).toFixed(1)} ${CIRC.toFixed(1)}` : CIRC.toFixed(1);
  const offset = spinning ? 0 : CIRC * (1 - progress);
  const drop = Math.min(40, progress * 40);

  return (
    <div
      aria-hidden={!activePhase}
      className={`pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+10px)] z-40 transition-opacity duration-150 ${
        activePhase ? "opacity-100" : "opacity-0"
      }`}
      style={{ transform: `translateX(-50%) translateY(${drop}px) scale(${0.72 + progress * 0.28})` }}
    >
      <div
        role="progressbar"
        aria-label="Pull to refresh"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className={`relative h-11 w-11 ${spinning ? "animate-spin" : ""} ${full ? "drop-shadow-[0_0_10px_rgba(74,222,128,0.7)]" : ""}`}
      >
        <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
          <circle cx="22" cy="22" r={R} fill="none" stroke="#1c1c1f" strokeWidth="3" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke="#4ade80"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={dash}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-75"
          />
        </svg>
        {full ? (
          <span className="absolute inset-0 flex items-center justify-center text-accent">
            <IconCheck className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {phase === "ready" ? "Release to refresh" : phase === "refreshing" ? "Refreshing…" : phase === "done" ? "Refreshed" : ""}
      </span>
    </div>
  );
}
