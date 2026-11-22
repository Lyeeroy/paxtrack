import { getSnapshot, saveTitle } from "./store";
import type { Item, TitlePayload } from "./types";

const inflight = new Map<string, Promise<boolean>>();

export function refreshItem(item: Item): Promise<boolean> {
  const existing = inflight.get(item.id);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(`/api/tmdb/title?type=${item.type}&id=${item.tmdbId}`);
      if (!res.ok) return false;
      const data = (await res.json()) as TitlePayload;
      saveTitle(item.id, data);
      return true;
    } catch {
      return false;
    } finally {
      inflight.delete(item.id);
    }
  })();
  inflight.set(item.id, p);
  return p;
}

/** Refresh metadata for active titles that have gone stale. Cheap no-op while offline. */
export async function refreshStale(maxAge = 6 * 3600_000) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
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
    for (let it = queue.shift(); it; it = queue.shift()) await refreshItem(it);
  };
  await Promise.all([worker(), worker()]);
}
