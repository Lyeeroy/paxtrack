"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkNotifications, notificationsEnabled, registerPeriodic } from "@/lib/notify";
import { refreshStale } from "@/lib/refresh";
import { getSnapshot, initStore, useStore } from "@/lib/store";
import { startAutoSync } from "@/lib/sync";
import { dismissToast, useToast } from "@/lib/toast";
import Detail from "./Detail";
import History from "./History";
import Library from "./Library";
import Search from "./Search";
import Settings from "./Settings";
import Upcoming from "./Upcoming";
import { IconCalendar, IconHistory, IconLibrary, IconSearch, IconSettings } from "./ui";

const TABS = [
  { id: "library", label: "Library", Icon: IconLibrary },
  { id: "upcoming", label: "Upcoming", Icon: IconCalendar },
  { id: "search", label: "Search", Icon: IconSearch },
  { id: "history", label: "History", Icon: IconHistory },
  { id: "settings", label: "Settings", Icon: IconSettings },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Toaster() {
  const t = useToast();
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 flex justify-center px-4">
      <div
        key={t.id}
        role="status"
        aria-live="polite"
        className="anim-up pointer-events-auto flex max-w-sm items-center gap-3 rounded-full border border-line bg-raised py-1 pl-4 pr-1.5 text-[13px] shadow-lg"
      >
        <span className="truncate py-2">{t.msg}</span>
        {t.undo ? (
          <button
            onClick={() => {
              t.undo?.();
              dismissToast();
            }}
            className="h-9 shrink-0 rounded-full px-3 text-[13px] font-medium text-accent active:bg-black"
          >
            Undo
          </button>
        ) : (
          <span className="w-2" />
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { items, eps, ready } = useStore();
  const [tab, setTab] = useState<Tab>("library");
  const [detailId, setDetailId] = useState<string | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);

  // ---- boot: local DB -> sync -> background refresh -> notifications
  useEffect(() => {
    let alive = true;
    const run = async () => {
      await refreshStale();
      if (!alive) return;
      const s = getSnapshot();
      void checkNotifications(s.items, s.eps);
    };
    initStore().then(() => {
      if (!alive) return;
      startAutoSync();
      void run();
      if (notificationsEnabled()) void registerPeriodic();
    });
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onVis = () => {
      if (document.visibilityState === "visible" && getSnapshot().ready) void run();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, []);

  // ---- detail view lives on the history stack so system back / edge swipe closes it
  const open = useCallback((id: string) => {
    window.history.pushState({ detail: id }, "");
    setDetailId(id);
  }, []);
  const close = useCallback(() => {
    if (window.history.state?.detail) window.history.back();
    else setDetailId(null);
  }, []);
  useEffect(() => {
    const onPop = () => setDetailId(window.history.state?.detail ?? null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const detail = detailId ? items.find((i) => i.id === detailId) : undefined;
  useEffect(() => {
    if (detailId && ready && !detail) close();
  }, [detailId, detail, ready, close]);

  // ---- swipe between tabs
  const go = (dir: 1 | -1) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const n = TABS[i + dir];
    if (n) setTab(n.id);
  };

  return (
    <div className="min-h-dvh bg-black">
      <main
        className="mx-auto min-h-dvh max-w-xl pb-[calc(env(safe-area-inset-bottom)+80px)]"
        aria-hidden={!!detail}
        onPointerDown={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest("[data-swipe],input,textarea")) {
            swipe.current = null;
            return;
          }
          swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - s.t < 700) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (swipe.current = null)}
        style={{ touchAction: "pan-y" }}
      >
        {!ready ? null : (
          <div key={tab} className="anim-up">
            {tab === "library" ? <Library items={items} eps={eps} onOpen={open} goSearch={() => setTab("search")} /> : null}
            {tab === "upcoming" ? <Upcoming items={items} eps={eps} onOpen={open} /> : null}
            {tab === "search" ? <Search items={items} onOpen={open} /> : null}
            {tab === "history" ? <History items={items} eps={eps} onOpen={open} /> : null}
            {tab === "settings" ? <Settings /> : null}
          </div>
        )}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-black pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-xl">
          {TABS.map(({ id, label, Icon }) => (
            <li key={id} className="flex-1">
              <button
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] ${tab === id ? "text-accent" : "text-faint active:text-dim"}`}
              >
                <Icon className="h-[22px] w-[22px]" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {detail ? <Detail key={detail.id} item={detail} data={eps[detail.id]} onClose={close} /> : null}
      <Toaster />
    </div>
  );
}
