import { getSnapshot, getStoreEpoch, saveTitle } from "./store";
import type { CastMember, Item, TitlePayload, WatchInfo } from "./types";

const inflight = new Map<string, Promise<boolean>>();

/** Descriptive metadata shown in the info drawer. Session-only; never persisted. */
export interface TitleInfo {
  overview: string | null;
  genres: string[];
  voteAverage: number | null;
  runtime: number | null;
  imdbId: string | null;
  cast: CastMember[];
  watch: WatchInfo | null;
}

const infoCache = new Map<string, { info: TitleInfo; at: number }>();
const infoInflight = new Map<string, Promise<TitleInfo | null>>();
const INFO_TTL = 24 * 3600_000;

function cacheInfo(id: string, p: TitlePayload) {
  infoCache.set(id, {
    info: {
      overview: p.overview ?? null,
      genres: p.genres ?? [],
      voteAverage: p.voteAverage ?? null,
      runtime: p.runtime ?? null,
      imdbId: p.imdbId ?? null,
      cast: p.cast ?? [],
      watch: p.watch ?? null,
    },
    at: Date.now(),
  });
}

/** Metadata already loaded this session (the detail refresh seeds this cache). */
export function cachedInfo(id: string): TitleInfo | null {
  const c = infoCache.get(id);
  if (!c) return null;
  if (Date.now() - c.at > INFO_TTL) {
    infoCache.delete(id);
    return null;
  }
  return c.info;
}

/** Load descriptive metadata on demand; concurrent opens share one request. */
export function loadInfo(item: Item): Promise<TitleInfo | null> {
  const cached = cachedInfo(item.id);
  if (cached) return Promise.resolve(cached);
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve(null);
  const pending = infoInflight.get(item.id);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(`/api/tmdb/title?type=${item.type}&id=${item.tmdbId}`);
      if (!res.ok) return null;
      const data = (await res.json()) as TitlePayload;
      cacheInfo(item.id, data);
      return cachedInfo(item.id);
    } catch {
      return null;
    } finally {
      infoInflight.delete(item.id);
    }
  })();
  infoInflight.set(item.id, p);
  return p;
}

export function refreshItem(item: Item): Promise<boolean> {
  const startedEpoch = getStoreEpoch();
  // Include the epoch so a request from a previous account cannot block the
  // same title from refreshing after an account switch.
  const key = `${startedEpoch}:${item.id}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(`/api/tmdb/title?type=${item.type}&id=${item.tmdbId}`);
      if (!res.ok) return false;
      const data = (await res.json()) as TitlePayload;
      // The local library was replaced while this request was in flight.
      if (getStoreEpoch() !== startedEpoch) return false;
      cacheInfo(item.id, data);
      saveTitle(item.id, data);
      return true;
    } catch {
      return false;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Refresh metadata for active titles that have gone stale. Cheap no-op while offline. */
export async function refreshStale(maxAge = 6 * 3600_000) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const startedEpoch = getStoreEpoch();
  const now = Date.now();
  const { items, eps } = getSnapshot();
  const due = items.filter((i) => {
    if (i.status === "dropped") return false;
    const missing = i.type === "tv" && !eps[i.id];
    if (missing) return true;
    if (i.status === "completed" && i.tvStatus !== "Returning Series" && i.releaseDate !== undefined) return false;
    return !i.refreshedAt || now - i.refreshedAt > maxAge;
  });
  // small concurrency pool: friendly to budget devices & rate limits
  const queue = [...due];
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      if (getStoreEpoch() !== startedEpoch) return;
      await refreshItem(it);
    }
  };
  await Promise.all([worker(), worker()]);
}
