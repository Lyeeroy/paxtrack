import { useSyncExternalStore } from "react";
import { idbGetAll, idbPut, idbPutMany } from "./idb";
import { flatEps, statsFor } from "./episodes";
import type { EpData, Item, SearchResult, Status, TitlePayload } from "./types";

export interface Snapshot {
  items: Item[];
  eps: Record<string, EpData>;
  ready: boolean;
}

const items = new Map<string, Item>();
let epsObj: Record<string, EpData> = {};
let snap: Snapshot = { items: [], eps: {}, ready: false };
const listeners = new Set<() => void>();
const changeListeners = new Set<() => void>();
let initP: Promise<void> | null = null;

function emit() {
  snap = { items: [...items.values()].filter((i) => !i.deleted), eps: epsObj, ready: snap.ready };
  listeners.forEach((l) => l());
}

export function useStore(): Snapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snap,
    () => snap,
  );
}

export function getSnapshot() {
  return snap;
}

/** Subscribe to local (user-driven) changes, used to schedule cloud sync. */
export function onLocalChange(cb: () => void) {
  changeListeners.add(cb);
  return () => {
    changeListeners.delete(cb);
  };
}

export function initStore(): Promise<void> {
  if (!initP) {
    initP = (async () => {
      try {
        const [its, eps] = await Promise.all([idbGetAll<Item>("items"), idbGetAll<EpData>("eps")]);
        its.forEach((i) => items.set(i.id, i));
        epsObj = Object.fromEntries(eps.map((e) => [e.id, e]));
        navigator.storage?.persist?.().catch(() => {});
      } catch (e) {
        console.error("idb init failed", e);
      }
      snap = { ...snap, ready: true };
      emit();
    })();
  }
  return initP;
}

function commit(item: Item, touch = true) {
  const next = touch ? { ...item, updatedAt: Date.now() } : item;
  items.set(next.id, next);
  idbPut("items", next).catch(() => {});
  emit();
  if (touch) changeListeners.forEach((l) => l());
}

export function getItem(id: string) {
  return items.get(id);
}

/** Apply items pulled from the cloud (last-write-wins). Returns true if anything changed. */
export function applyRemote(remote: Item[]): boolean {
  const changed: Item[] = [];
  for (const r of remote) {
    const l = items.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) {
      items.set(r.id, r);
      changed.push(r);
    }
  }
  if (changed.length) {
    idbPutMany("items", changed).catch(() => {});
    emit();
  }
  return changed.length > 0;
}

export function allItemsRaw(): Item[] {
  return [...items.values()];
}

export function saveTitle(id: string, p: TitlePayload) {
  const item = items.get(id);
  if (!item) return;
  if (p.type === "tv") {
    const data: EpData = { id, seasons: p.seasons };
    epsObj = { ...epsObj, [id]: data };
    idbPut("eps", data).catch(() => {});
  }
  let next: Item = {
    ...item,
    title: p.title || item.title,
    poster: p.poster ?? item.poster,
    anime: p.anime,
    tvStatus: p.status,
    releaseDate: p.releaseDate ?? item.releaseDate,
    refreshedAt: Date.now(),
  };
  // New episodes appeared for a finished show: pick it back up.
  const st = statsFor(next, epsObj[id]);
  const ongoing = isOngoing(next);
  if (next.status === "completed" && next.type === "tv" && st.watched < st.total && ongoing) {
    next = { ...next, status: "watching" };
    commit(next);
  } else {
    commit(next, false);
  }
}

function isOngoing(i: Item) {
  return i.tvStatus === "Returning Series" || i.tvStatus === "In Production" || i.tvStatus === "Planned";
}

export function addItem(r: SearchResult, status: Status): Item {
  const id = `${r.type}-${r.tmdbId}`;
  const existing = items.get(id);
  const now = Date.now();
  const item: Item = existing
    ? { ...existing, deleted: false, status }
    : {
        id,
        tmdbId: r.tmdbId,
        type: r.type,
        title: r.title,
        poster: r.poster,
        anime: r.anime,
        status,
        watched: {},
        addedAt: now,
        updatedAt: now,
      };
  commit(item);
  return item;
}

export function removeItem(id: string) {
  const item = items.get(id);
  if (!item) return;
  commit({ ...item, deleted: true, watched: {} });
}

export function setStatus(id: string, status: Status) {
  const item = items.get(id);
  if (!item || item.status === status) return;
  commit({ ...item, status });
}

function withAutoStatus(item: Item): Item {
  const st = statsFor(item, epsObj[item.id]);
  let status = item.status;
  if (st.watched > 0 && status === "planned") status = "watching";
  if (st.total > 0 && st.watched >= st.total && (item.type === "movie" || !isOngoing(item))) status = "completed";
  else if (status === "completed" && st.watched < st.total) status = item.type === "movie" ? "planned" : "watching";
  return status === item.status ? item : { ...item, status };
}

function setWatched(id: string, fn: (w: Record<string, number>) => void) {
  const item = items.get(id);
  if (!item) return;
  const watched = { ...item.watched };
  fn(watched);
  commit(withAutoStatus({ ...item, watched }));
}

export function toggleEpisode(id: string, key: string) {
  setWatched(id, (w) => {
    if (w[key]) delete w[key];
    else w[key] = Date.now();
  });
}

export function markUpTo(id: string, key: string) {
  const eps = flatEps(epsObj[id]);
  const idx = eps.findIndex((e) => e.key === key);
  if (idx < 0) return;
  const now = Date.now();
  setWatched(id, (w) => {
    for (let i = 0; i <= idx; i++) if (!w[eps[i].key]) w[eps[i].key] = now;
  });
}

export function unmarkFrom(id: string, key: string) {
  const eps = flatEps(epsObj[id]);
  const idx = eps.findIndex((e) => e.key === key);
  if (idx < 0) return;
  setWatched(id, (w) => {
    for (let i = idx; i < eps.length; i++) delete w[eps[i].key];
  });
}

export function setSeason(id: string, season: number, on: boolean) {
  const eps = flatEps(epsObj[id]).filter((e) => e.s === season);
  const now = Date.now();
  setWatched(id, (w) => {
    for (const e of eps) {
      if (on) {
        if (!w[e.key]) w[e.key] = now;
      } else delete w[e.key];
    }
  });
}

/** +1: mark the next aired episode (or the movie) as watched. */
export function markNext(id: string): boolean {
  const item = items.get(id);
  if (!item) return false;
  if (item.type === "movie") {
    if (item.watched.m) return false;
    toggleEpisode(id, "m");
    return true;
  }
  const st = statsFor(item, epsObj[id]);
  if (!st.next) return false;
  toggleEpisode(id, st.next.key);
  return true;
}

/** -1: unmark the furthest watched episode. */
export function unmarkLast(id: string): boolean {
  const item = items.get(id);
  if (!item) return false;
  if (item.type === "movie") {
    if (!item.watched.m) return false;
    toggleEpisode(id, "m");
    return true;
  }
  const eps = flatEps(epsObj[id]);
  for (let i = eps.length - 1; i >= 0; i--) {
    if (item.watched[eps[i].key]) {
      toggleEpisode(id, eps[i].key);
      return true;
    }
  }
  return false;
}
