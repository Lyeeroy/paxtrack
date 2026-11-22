import type { EpData, Item } from "./types";

export interface Ep {
  s: number;
  e: number;
  name: string;
  air: string | null;
  key: string;
}

export function todayStr(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

const cache = new WeakMap<EpData, Ep[]>();

export function flatEps(data: EpData | undefined): Ep[] {
  if (!data) return [];
  let r = cache.get(data);
  if (!r) {
    r = [];
    for (const s of [...data.seasons].sort((a, b) => a.n - b.n)) {
      for (const ep of s.eps) r.push({ s: s.n, e: ep.e, name: ep.name, air: ep.air, key: `${s.n}x${ep.e}` });
    }
    cache.set(data, r);
  }
  return r;
}

export interface Stats {
  watched: number;
  aired: number;
  total: number;
  progress: number; // 0..1
  /** next aired, unwatched episode */
  next: Ep | null;
  /** next episode that has not aired yet */
  upcoming: Ep | null;
  /** number of aired and unwatched episodes */
  backlog: number;
  lastAiredIdx: number;
}

export function formatEp(ep: { s: number; e: number }): string {
  return `S${ep.s} E${ep.e}`;
}

export function statsFor(item: Item, data: EpData | undefined, today = todayStr()): Stats {
  if (item.type === "movie") {
    const w = item.watched.m ? 1 : 0;
    const released = !item.releaseDate || item.releaseDate <= today;
    return {
      watched: w,
      aired: released ? 1 : 0,
      total: 1,
      progress: w,
      next: null,
      upcoming: null,
      backlog: released && !w ? 1 : 0,
      lastAiredIdx: 0,
    };
  }
  const eps = flatEps(data);
  let last = -1;
  for (let i = eps.length - 1; i >= 0; i--) {
    const a = eps[i].air;
    if (a && a <= today) {
      last = i;
      break;
    }
  }
  let watched = 0;
  let next: Ep | null = null;
  let backlog = 0;
  for (let i = 0; i < eps.length; i++) {
    const w = !!item.watched[eps[i].key];
    if (w) watched++;
    else if (i <= last) {
      backlog++;
      if (!next) next = eps[i];
    }
  }
  const upcoming = eps.slice(last + 1).find((e) => e.air) ?? null;
  const aired = last + 1;
  const denom = aired > 0 ? aired : eps.length;
  return {
    watched,
    aired,
    total: eps.length,
    progress: denom ? Math.min(1, watched / denom) : 0,
    next,
    upcoming,
    backlog,
    lastAiredIdx: last,
  };
}

export function relDay(date: string, today = todayStr()): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diff > 0 && diff < 7) return `${new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" })}`;
  return label;
}
