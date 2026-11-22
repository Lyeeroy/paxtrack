import { flatEps, formatEp, statsFor } from "./episodes";
import { toggleEpisode } from "./store";
import { showToast } from "./toast";
import type { EpData, Item } from "./types";

export function quickWatch(item: Item, data: EpData | undefined) {
  const st = statsFor(item, data);
  const key = item.type === "movie" ? (item.watched.m || !st.aired ? null : "m") : st.next?.key;
  if (!key) {
    showToast(item.type === "movie" ? "Nothing to mark" : st.upcoming ? "You're all caught up" : "No new episodes");
    return;
  }
  const label = key === "m" ? "Watched" : formatEp(st.next!) + " watched";
  toggleEpisode(item.id, key);
  showToast(`${item.title} · ${label}`, () => toggleEpisode(item.id, key));
}

export function quickUnwatch(item: Item, data: EpData | undefined) {
  let key: string | null = null;
  if (item.type === "movie") key = item.watched.m ? "m" : null;
  else {
    const eps = flatEps(data);
    for (let i = eps.length - 1; i >= 0; i--) {
      if (item.watched[eps[i].key]) {
        key = eps[i].key;
        break;
      }
    }
  }
  if (!key) {
    showToast("Nothing to undo");
    return;
  }
  const k = key;
  toggleEpisode(item.id, k);
  showToast(`${item.title} · ${k === "m" ? "Unwatched" : "Removed " + k.replace("x", " E").replace(/^/, "S")}`, () =>
    toggleEpisode(item.id, k),
  );
}
