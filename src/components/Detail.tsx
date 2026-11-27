"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quickWatch } from "@/lib/actions";
import { flatEps, formatEp, relDay, statsFor, todayStr, type Ep } from "@/lib/episodes";
import { cachedInfo, loadInfo, refreshItem, type TitleInfo } from "@/lib/refresh";
import { markUpTo, removeItem, setSeason, setStatus, toggleEpisode, unmarkFrom } from "@/lib/store";
import { haptic, showToast } from "@/lib/toast";
import type { EpData, Item, Status } from "@/lib/types";
import InfoDrawer from "./InfoDrawer";
import PullUpToLoad from "./PullUpToLoad";
import { IconBack, IconCheck, Poster, Progress, SwipeRow, TypeTag } from "./ui";

const STATUSES: { id: Status; label: string }[] = [
  { id: "watching", label: "Watching" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

const EpRow = memo(function EpRow({ id, ep, watched, aired }: { id: string; ep: Ep; watched: boolean; aired: boolean }) {
  return (
    <li className="cv border-b border-line/60">
      <SwipeRow
        onSwipeRight={() => {
          markUpTo(id, ep.key);
          showToast(`Marked up to ${formatEp(ep)}`);
        }}
        onSwipeLeft={() => {
          unmarkFrom(id, ep.key);
          showToast(`Cleared from ${formatEp(ep)}`);
        }}
        rightLabel="Mark all up to here"
        leftLabel="Clear from here"
      >
        <button
          onClick={() => {
            haptic(8);
            toggleEpisode(id, ep.key);
          }}
          aria-pressed={watched}
          aria-label={`${formatEp(ep)} ${ep.name}${ep.air ? ", " + ep.air : ""}${watched ? ", watched" : ""}`}
          className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface ${aired ? "" : "opacity-50"}`}
        >
          <span className="w-8 shrink-0 text-center text-xs tabular-nums text-faint">{ep.e}</span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[14px] ${watched ? "text-dim" : "text-fg"}`}>{ep.name}</span>
            <span className="block text-[11px] text-faint">{ep.air ? (aired ? relDay(ep.air) : `Airs ${relDay(ep.air)}`) : "TBA"}</span>
          </span>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
              watched ? "border-accent bg-accent text-black" : "border-line text-transparent"
            }`}
          >
            <IconCheck className="h-3.5 w-3.5" />
          </span>
        </button>
      </SwipeRow>
    </li>
  );
});

export default function Detail({
  item,
  data,
  infoOpen,
  onOpenInfo,
  onCloseInfo,
  onClose,
  onUntrack,
}: {
  item: Item;
  data: EpData | undefined;
  infoOpen: boolean;
  onOpenInfo: () => void;
  onCloseInfo: () => void;
  onClose: () => void;
  onUntrack: (item: Item) => void;
}) {
  const [season, setSeasonSel] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [confirmUntrack, setConfirmUntrack] = useState(false);
  const [info, setInfo] = useState<TitleInfo | null>(() => cachedInfo(item.id));
  const [infoResolved, setInfoResolved] = useState(() => !!info);
  const edge = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const today = todayStr();

  useEffect(() => {
    const stale = !item.refreshedAt || Date.now() - item.refreshedAt > 3600_000;
    if ((item.type === "tv" && !data) || stale) void refreshItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    if (!infoOpen || info) return;
    let alive = true;
    void loadInfo(item).then((r) => {
      if (!alive) return;
      if (r) setInfo(r);
      setInfoResolved(true);
    });
    return () => {
      alive = false;
    };
  }, [infoOpen, info, item]);

  const openInfoFromPull = useCallback(async () => {
    onOpenInfo();
  }, [onOpenInfo]);

  const st = useMemo(() => statsFor(item, data, today), [item, data, today]);
  const eps = useMemo(() => flatEps(data), [data]);
  const seasons = useMemo(() => [...new Set(eps.map((e) => e.s))], [eps]);
  const current = season ?? st.next?.s ?? st.upcoming?.s ?? seasons[seasons.length - 1] ?? 1;
  const list = useMemo(() => eps.filter((e) => e.s === current), [eps, current]);
  const seasonDone = list.length > 0 && list.every((e) => item.watched[e.key]);
  // {season}/{episode} in the Links page track the library's up-next position.
  // When there is no next episode, stay in the displayed season at the first
  // unwatched entry (or the last one if the season is already complete).
  const linkSeason = st.next?.s ?? current;
  const lastWatchedE = list.filter((e) => item.watched[e.key]).map((e) => e.e).pop() ?? 0;
  const lastE = list.length ? list[list.length - 1].e : 0;
  const linkEpisode = st.next?.e ?? list.find((e) => !item.watched[e.key])?.e ?? Math.min(lastWatchedE + 1 || 1, lastE || 1);

  const meta = [
    item.type === "movie" ? (item.releaseDate ? item.releaseDate.slice(0, 4) : "") : st.total ? `${st.total} episodes` : "",
    item.tvStatus ?? "",
  ].filter(Boolean);

  return (
    <div
      ref={scrollRef}
      className={`anim-slide fixed inset-0 z-40 bg-black ${infoOpen ? "overflow-hidden" : "overflow-y-auto"}`}
      role="dialog"
      aria-label={item.title}
      aria-hidden={infoOpen || undefined}
      onPointerDownCapture={(e) => {
        if ((e.target as HTMLElement).closest("[data-swipe]")) return;
        if (e.clientX < 24) {
          edge.current = { x: e.clientX, y: e.clientY };
          e.stopPropagation();
        } else edge.current = null;
      }}
      onPointerUp={(e) => {
        const s = edge.current;
        edge.current = null;
        if (s && e.clientX - s.x > 70 && Math.abs(e.clientY - s.y) < 60) onClose();
      }}
    >
      <PullUpToLoad
        canLoad={!infoOpen}
        onLoad={openInfoFromPull}
        resetKey={infoOpen ? "open" : "closed"}
        direction="down"
        scrollRef={scrollRef}
        actionLabel="open details"
        busyLabel="Opening details"
        indicator="chevron"
      >
        <div className="mx-auto max-w-xl pb-[calc(env(safe-area-inset-bottom)+32px)]">
          <div className="sticky top-0 z-10 flex items-center bg-black/90 px-2 pt-[env(safe-area-inset-top)]">
            <button onClick={onClose} aria-label="Back" className="flex h-12 w-12 items-center justify-center rounded-full text-fg active:bg-surface">
              <IconBack />
            </button>
            <p className="min-w-0 flex-1 truncate pr-4 text-sm text-dim">{item.title}</p>
          </div>
  
          <div className="flex gap-4 px-4 pt-2">
            <button
              onClick={onOpenInfo}
              aria-haspopup="dialog"
              aria-expanded={infoOpen}
              aria-label={`Details for ${item.title}`}
              className="shrink-0 rounded-md active:opacity-80"
            >
              <Poster path={item.poster} title={item.title} w={80} h={120} />
            </button>
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="text-xl font-semibold leading-tight">
                <button onClick={onOpenInfo} aria-haspopup="dialog" aria-expanded={infoOpen} className="max-w-full truncate text-left active:opacity-80">
                  {item.title}
                </button>
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-dim">
                <TypeTag anime={item.anime} type={item.type} />
                {meta.map((m) => (
                  <span key={m}>· {m}</span>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-faint">Tap for details · drag up to expand</p>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-dim">
                  <span>{item.type === "movie" ? (item.watched.m ? "Watched" : "Not watched") : `${st.watched} / ${st.aired || st.total} watched`}</span>
                  <span className="tabular-nums">{Math.round(st.progress * 100)}%</span>
                </div>
                <Progress value={st.progress} label="Watch progress" />
              </div>
            </div>
          </div>
  
          <div role="radiogroup" aria-label="Status" className="mt-5 grid grid-cols-4 gap-1 px-4">
            {STATUSES.map((s) => {
              const active = !item.preview && item.status === s.id;
              const armed = active && confirmUntrack;
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    if (active && st.watched > 0 && !confirmUntrack) {
                      setConfirmUntrack(true);
                      setTimeout(() => setConfirmUntrack(false), 3000);
                      return;
                    }
                    setConfirmUntrack(false);
                    if (active) onUntrack(item);
                    else setStatus(item.id, s.id);
                  }}
                  className={`h-10 rounded-lg text-[13px] ${
                    armed ? "bg-danger/15 text-danger" : active ? "bg-fg font-medium text-black" : "bg-surface text-dim active:bg-raised"
                  }`}
                >
                  {armed ? "Tap again" : s.label}
                </button>
              );
            })}
          </div>
          {confirmUntrack && st.watched > 0 ? (
            <p role="status" className="px-4 pt-2 text-center text-xs text-danger">
              Removing this title deletes your watch history
              {item.type === "movie" ? "" : ` · ${st.watched} episode${st.watched === 1 ? "" : "s"} watched`}. Tap the active status again to confirm.
            </p>
          ) : null}
  
          <div className="px-4 pt-3">
            {item.type === "movie" ? (
              <button
                onClick={() => toggleEpisode(item.id, "m")}
                className={`h-12 w-full rounded-xl text-[15px] font-semibold active:opacity-80 ${item.watched.m ? "bg-surface text-accent" : "bg-accent text-black"}`}
              >
                {item.watched.m ? "Watched · tap to undo" : "Mark as watched"}
              </button>
            ) : (
              <button
                onClick={() => quickWatch(item, data)}
                disabled={!st.next}
                className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-black active:opacity-80 disabled:bg-surface disabled:font-normal disabled:text-dim"
              >
                {!data
                  ? "Loading episodes…"
                  : st.next
                    ? `Watch ${formatEp(st.next)}`
                    : st.upcoming?.air
                      ? `Next: ${formatEp(st.upcoming)} · ${relDay(st.upcoming.air)}`
                      : "All caught up"}
              </button>
            )}
          </div>
  
          {item.type === "tv" ? (
            <>
              {seasons.length ? (
                <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Seasons">
                  {seasons.map((n) => (
                    <button
                      key={n}
                      role="tab"
                      aria-selected={n === current}
                      onClick={() => setSeasonSel(n)}
                      className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] ${n === current ? "bg-raised text-fg" : "text-dim active:bg-surface"}`}
                    >
                      Season {n}
                    </button>
                  ))}
                </div>
              ) : null}
  
              {list.length ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between px-4 pb-1 pt-2">
                    <p className="text-[11px] uppercase tracking-wider text-faint">
                      {list.filter((e) => item.watched[e.key]).length} / {list.length}
                    </p>
                    <button onClick={() => setSeason(item.id, current, !seasonDone)} className="h-9 rounded-full px-3 text-xs text-accent active:bg-surface">
                      {seasonDone ? "Clear season" : "Mark season watched"}
                    </button>
                  </div>
                  <ul>
                    {list.map((e) => (
                      <EpRow key={e.key} id={item.id} ep={e} watched={!!item.watched[e.key]} aired={!!e.air && e.air <= today} />
                    ))}
                  </ul>
                  <p className="px-6 pt-4 text-center text-[11px] text-faint">Tap to toggle · swipe → mark up to here · ← clear from here</p>
                </div>
              ) : data ? (
                <p className="px-6 py-10 text-center text-sm text-dim">No episode data yet.</p>
              ) : (
                <p className="px-6 py-10 text-center text-sm text-dim">Episodes load when you&apos;re online.</p>
              )}
            </>
          ) : null}
  
          <div className="px-4 pt-10">
            <button
              onClick={() => {
                if (!confirm) {
                  setConfirm(true);
                  setTimeout(() => setConfirm(false), 3000);
                  return;
                }
                removeItem(item.id);
                showToast(`${item.title} removed`);
                onClose();
              }}
              className={`h-11 w-full rounded-xl text-sm active:bg-surface ${confirm ? "bg-danger/15 text-danger" : "text-faint"}`}
            >
              {confirm ? "Tap again to remove" : "Remove from library"}
            </button>
          </div>
        </div>
      </PullUpToLoad>

      <InfoDrawer
        item={item}
        info={info}
        infoResolved={infoResolved}
        open={infoOpen}
        onClose={onCloseInfo}
        season={linkSeason}
        episode={linkEpisode}
      />
    </div>
  );
}
