"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { initAuth } from "@/lib/auth";
import { checkNotifications, notificationsEnabled, registerPeriodic } from "@/lib/notify";
import { refreshStale } from "@/lib/refresh";
import { discardPreview, getSnapshot, getStoreEpoch, initStore, removeItem, useStore } from "@/lib/store";
import { startAutoSync } from "@/lib/sync";
import { dismissToast, haptic, showToast, useToast } from "@/lib/toast";
import type { Item } from "@/lib/types";
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

// useLayoutEffect in the browser (no first-paint flash), no-op warning on the server.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function Toaster() {
  const t = useToast();
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-50 flex justify-center px-4">
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
  // Search is the heavy tab (up to 5x20 result rows or many loaded pages).
  // Mount it on first visit, then hide it instead of re-mounting on every
  // tab switch — otherwise returning to it blocks the commit for ~1 s.
  const [searchMounted, setSearchMounted] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navList = useRef<HTMLUListElement | null>(null);
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const highlight = useRef<HTMLSpanElement | null>(null);
  const highlightPlaced = useRef(false);

  // ---- boot: local DB -> sync -> background refresh -> notifications
  useEffect(() => {
    let alive = true;
    const run = async () => {
      await refreshStale();
      if (!alive) return;
      const epoch = getStoreEpoch();
      const s = getSnapshot();
      void checkNotifications(s.items, s.eps, epoch);
    };
    initStore().then(() => {
      if (!alive) return;
      startAutoSync();
      void initAuth();
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

  // ---- one green pill slides to the active tab; measured so it works at any width
  useIsoLayoutEffect(() => {
    const ul = navList.current;
    const pill = highlight.current;
    const button = tabButtons.current[TABS.findIndex((entry) => entry.id === tab)];
    if (!ul || !pill || !button) return;

    const place = () => {
      if (!highlightPlaced.current) pill.style.transition = "none";
      pill.style.transform = `translateX(${button.offsetLeft}px)`;
      pill.style.width = `${button.offsetWidth}px`;
      if (!highlightPlaced.current) {
        void pill.offsetWidth; // commit the start position before enabling motion
        pill.style.transition = "";
        highlightPlaced.current = true;
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(ul);
    return () => observer.disconnect();
  }, [tab]);

  // ---- detail view lives on the history stack so system back / edge swipe closes it
  const open = useCallback((id: string, preview?: Item) => {
    window.history.pushState({ detail: id, preview }, "");
    setDetailId(id);
    setPreviewItem(preview ?? null);
    setInfoOpen(false);
  }, []);
  // The info sheet is a history entry too: the first system back closes the
  // sheet, the second closes the detail view. The Sheet starts its own exit on
  // the same tick; no parent timer to drift out of sync with the animation.
  const openInfo = useCallback(() => {
    if (!detailId || infoOpen) return;
    window.history.pushState({ detail: detailId, preview: previewItem, info: true }, "");
    setInfoOpen(true);
  }, [detailId, previewItem, infoOpen]);
  const closeInfo = useCallback(() => {
    if (window.history.state?.info) window.history.back();
    else setInfoOpen(false);
  }, []);
  const close = useCallback(() => {
    if (infoOpen) {
      closeInfo();
      return;
    }
    if (detailId) discardPreview(detailId);
    if (window.history.state?.detail) window.history.back();
    else {
      setDetailId(null);
      setPreviewItem(null);
    }
  }, [detailId, infoOpen, closeInfo]);
  // Tapping the active status removes the title but keeps the detail open as an
  // untracked preview, so another status can add it back without leaving here.
  const untrack = useCallback((item: Item) => {
    // Set the preview before mutating the store: removal drops the item from
    // the snapshot, so without this the auto-close effect would fire first.
    setPreviewItem({ ...item, deleted: false, preview: true, watched: {} });
    removeItem(item.id);
    showToast(`${item.title} removed`);
    haptic(8);
  }, []);
  useEffect(() => {
    const onPop = () => {
      const state = window.history.state as { detail?: string; preview?: Item; info?: boolean } | null;
      setDetailId(state?.detail ?? null);
      setPreviewItem(state?.preview ?? null);
      setInfoOpen(!!state?.info);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const detail = detailId ? items.find((i) => i.id === detailId) ?? (previewItem?.id === detailId ? previewItem : undefined) : undefined;
  useEffect(() => {
    // A detail view must close when its item disappears (for example, when it
    // was deleted on another device).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (detailId && ready && !detail) close();
  }, [detailId, detail, ready, close]);

  // ---- swipe between tabs
  const go = (dir: 1 | -1) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const n = TABS[i + dir];
    if (!n) return;
    if (n.id === "search") setSearchMounted(true);
    setTab(n.id);
  };

  // Re-tapping the active Search tab jumps to the input and opens the keyboard.
  // Focus must happen inside the click handler so mobile treats it as a user gesture.
  const selectTab = (id: Tab) => {
    if (id === "search" && tab === "search") {
      window.scrollTo(0, 0);
      searchInput.current?.focus();
      return;
    }
    if (id === "search") setSearchMounted(true);
    setTab(id);
  };

  return (
    <div className="min-h-dvh bg-black">
      <main
        className="mx-auto min-h-dvh max-w-xl pb-[calc(env(safe-area-inset-bottom)+96px)]"
        aria-hidden={!!detail}
        inert={!!detail}
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
        style={{ touchAction: "pan-x pan-y" }}
      >
        {!ready ? null : (
          <>
            <div key={tab} className="anim-up">
              {tab === "library" ? <Library items={items} eps={eps} onOpen={open} goSearch={() => selectTab("search")} /> : null}
              {tab === "upcoming" ? <Upcoming items={items} eps={eps} onOpen={open} /> : null}
              {tab === "history" ? <History items={items} eps={eps} onOpen={open} /> : null}
              {tab === "settings" ? <Settings /> : null}
            </div>
            {searchMounted ? (
              <div
                className={tab === "search" ? "anim-up" : "hidden"}
                aria-hidden={tab !== "search"}
                inert={tab !== "search"}
              >
                <Search items={items} onOpen={open} inputRef={searchInput} onSwipeTab={go} />
              </div>
            ) : null}
          </>
        )}
      </main>

      <nav
        aria-label="Main"
        aria-hidden={!!detail}
        inert={!!detail}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]"
      >
        <ul
          ref={navList}
          className="pointer-events-auto relative flex w-full items-center gap-0.5 rounded-full border border-line bg-raised/80 p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:w-auto"
        >
          <span
            ref={highlight}
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-0 w-0 rounded-full bg-accent/15 transition-[transform,width] duration-200 ease-out"
          />
          {TABS.map(({ id, label, Icon }, index) => {
            const active = tab === id;
            return (
              <li key={id} className="min-w-0 flex-1 sm:flex-none">
                <button
                  ref={(node) => { tabButtons.current[index] = node; }}
                  onClick={() => selectTab(id)}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={`relative z-10 flex h-11 w-full items-center justify-center rounded-full px-2 transition-[color,transform] duration-200 active:scale-95 sm:w-[72px] ${
                    active ? "text-accent" : "text-faint hover:text-dim"
                  }`}
                >
                  <Icon className="h-[21px] w-[21px] shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {detail ? (
        <Detail
          key={detail.id}
          item={detail}
          data={eps[detail.id]}
          infoOpen={infoOpen}
          onOpenInfo={openInfo}
          onCloseInfo={closeInfo}
          onClose={close}
          onUntrack={untrack}
        />
      ) : null}
      <Toaster />
    </div>
  );
}
