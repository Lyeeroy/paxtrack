import { useSyncExternalStore } from "react";
import { idbClear, idbFlush, idbGetAll, idbPut, idbPutIfNewer, idbPutMany } from "./idb";
import { flatEps, statsFor } from "./episodes";
import type { Backup, EpData, Item, SearchResult, Status, TitlePayload } from "./types";

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
// Bumped whenever the on-device library is replaced (account switch). Async
// work that started before the switch must not write into the new library.
let epoch = 0;

function emit() {
  snap = { items: [...items.values()].filter((i) => !i.deleted && !i.preview), eps: epsObj, ready: snap.ready };
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
  // Keep the timestamp strictly newer than the current copy, so a re-add is
  // never rejected by Supabase's last-write-wins rule (updated_at <= old one).
  const next = touch ? { ...item, updatedAt: Math.max(Date.now(), item.updatedAt + 1) } : item;
  if (next.preview && touch) {
    // First real change promotes a preview into a persisted library item.
    const permanent = { ...next };
    delete permanent.preview;
    items.set(permanent.id, permanent);
    idbPut("items", permanent).catch(() => {});
    emit();
    changeListeners.forEach((l) => l());
    return;
  }
  items.set(next.id, next);
  if (!next.preview) idbPut("items", next).catch(() => {});
  emit();
  if (touch && !next.preview) changeListeners.forEach((l) => l());
}

/**
 * Wipe the on-device cache. Used when a different account signs in on this
 * browser so one user's library can never be uploaded to another account.
 */
export async function resetLocalData() {
  epoch += 1;
  await idbFlush();
  await Promise.all([idbClear("items"), idbClear("eps"), idbClear("kv")]);
  items.clear();
  epsObj = {};
  snap = { items: [], eps: {}, ready: true };
  listeners.forEach((l) => l());
}

/** Increments when the local library is replaced; stale async work must stop. */
export function getStoreEpoch() {
  return epoch;
}

export function getItem(id: string) {
  return items.get(id);
}

/** Apply items pulled from the cloud (last-write-wins). Returns true if anything changed. */
export async function applyRemote(remote: Item[]): Promise<boolean> {
  const changed: Item[] = [];
  for (const r of remote) {
    const l = items.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) changed.push(r);
  }
  if (!changed.length) return false;

  // Persist before advancing the sync cursor. If IndexedDB rejects, the sync
  // fails and retries instead of silently losing the pulled rows on reload.
  await idbPutIfNewer("items", changed);

  let applied = false;
  for (const r of changed) {
    const l = items.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) {
      items.set(r.id, r);
      applied = true;
    }
  }
  if (applied) emit();
  return applied;
}

export function allItemsRaw(): Item[] {
  return [...items.values()].filter((i) => !i.preview);
}

export function allEpsRaw(): EpData[] {
  return Object.values(epsObj);
}

export function createBackup(): Backup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: allItemsRaw().filter((i) => !i.deleted),
    eps: allEpsRaw(),
  };
}

export interface MergePlan {
  add: number;
  replace: number;
  keep: number;
}

type BackupDecision = keyof MergePlan;

function watchedCount(item: Item): number {
  return Object.keys(item.watched).length;
}

/**
 * The version with more watched episodes wins, regardless of timestamps. On a
 * tie the backup wins, since that is the file the user chose to restore.
 */
function backupDecision(incoming: Item): BackupDecision {
  const local = items.get(incoming.id);
  if (!local || local.deleted || local.preview) return "add";
  return watchedCount(incoming) >= watchedCount(local) ? "replace" : "keep";
}

export function planBackupMerge(incomingItems: Item[]): MergePlan {
  const plan: MergePlan = { add: 0, replace: 0, keep: 0 };
  for (const item of incomingItems) {
    if (item.deleted || item.preview) continue;
    plan[backupDecision(item)]++;
  }
  return plan;
}

/**
 * Merge a backup into the local library using watched progress, not timestamps.
 * Titles only in the backup are added, titles only in the library are kept, and
 * matching titles take the version with more watched episodes (backup on ties).
 * Applied titles get a fresh `updatedAt`: sync skips items older than its push
 * cursor, and Supabase rejects cloud writes older than the stored row, so the
 * old backup timestamp could never reach the cloud.
 */
export async function importBackup(incomingItems: Item[], incomingEps: EpData[]): Promise<{ added: number; replaced: number; eps: number }> {
  const now = Date.now();
  const writes: Item[] = [];
  const appliedIds = new Set<string>();
  let added = 0;
  let replaced = 0;

  for (const item of incomingItems) {
    if (item.deleted || item.preview) continue;
    const decision = backupDecision(item);
    if (decision === "keep") continue;
    writes.push({ ...item, deleted: false, preview: false, updatedAt: now });
    appliedIds.add(item.id);
    if (decision === "add") added++;
    else replaced++;
  }

  // Apply the backup's episode lists to restored titles so their watched keys
  // still line up; fill other missing lists, but never overwrite a local one
  // for a title we are keeping.
  const epsWrites: EpData[] = [];
  for (const ep of incomingEps) {
    if (appliedIds.has(ep.id) || !epsObj[ep.id]) epsWrites.push(ep);
  }

  if (writes.length || epsWrites.length) {
    // Persist before touching memory, as applyRemote does, so a failed write
    // cannot leave the in-memory library claiming data that was never stored.
    await Promise.all([idbPutMany("items", writes), idbPutMany("eps", epsWrites)]);
    for (const item of writes) items.set(item.id, item);
    if (epsWrites.length) epsObj = { ...epsObj, ...Object.fromEntries(epsWrites.map((ep) => [ep.id, ep])) };
    emit();
    // Let auto-sync push the restored titles to the cloud on the next run.
    if (writes.length) changeListeners.forEach((l) => l());
  }

  return { added, replaced, eps: epsWrites.length };
}

/** Open a search result in the detail view without adding it to the library. */
export function createPreview(r: SearchResult): Item {
  const id = `${r.type}-${r.tmdbId}`;
  const existing = items.get(id);
  // A removed title stays in the map as a deleted tombstone. Reopening it from
  // search must produce a fresh preview, otherwise edits keep it hidden forever.
  if (existing && !existing.deleted) return existing;
  const now = Date.now();
  const item: Item = {
    id,
    tmdbId: r.tmdbId,
    type: r.type,
    title: r.title,
    poster: r.poster,
    anime: r.anime,
    status: "planned",
    watched: {},
    addedAt: now,
    updatedAt: now,
    preview: true,
  };
  items.set(id, item);
  return item;
}

/** Forget an unmodified preview when its detail view closes. */
export function discardPreview(id: string) {
  const item = items.get(id);
  if (item?.preview) items.delete(id);
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
  if (item.preview) {
    items.delete(id);
    emit();
    return;
  }
  commit({ ...item, deleted: true, watched: {} });
}

export function setStatus(id: string, status: Status) {
  const item = items.get(id);
  if (!item || (item.status === status && !item.preview)) return;
  // Tapping a status in a preview is how a removed title gets added back.
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
