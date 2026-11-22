import { addDays, flatEps, todayStr } from "./episodes";
import { kvGet, kvSet } from "./idb";
import type { EpData, Item } from "./types";

const K = "tracker:notif";

export function notificationsSupported() {
  return typeof Notification !== "undefined" && "serviceWorker" in navigator;
}

export function notificationsEnabled() {
  try {
    return notificationsSupported() && Notification.permission === "granted" && localStorage.getItem(K) === "1";
  } catch {
    return false;
  }
}

export async function setNotificationsEnabled(on: boolean): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (!on) {
    localStorage.setItem(K, "0");
    return false;
  }
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") {
    localStorage.setItem(K, "0");
    return false;
  }
  localStorage.setItem(K, "1");
  registerPeriodic();
  return true;
}

export async function registerPeriodic() {
  try {
    const reg = await navigator.serviceWorker.ready;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ps = (reg as any).periodicSync;
    if (ps) await ps.register("check-releases", { minInterval: 12 * 3600_000 });
  } catch {
    /* unsupported or denied */
  }
}

export interface ReleaseEvent {
  id: string;
  title: string;
  body: string;
}

/** Releases that happened today or in the last two days. */
export function dueReleases(items: Item[], eps: Record<string, EpData>): ReleaseEvent[] {
  const today = todayStr();
  const from = addDays(today, -2);
  const out: ReleaseEvent[] = [];
  for (const it of items) {
    if (it.deleted || (it.status !== "watching" && it.status !== "planned")) continue;
    if (it.type === "movie") {
      if (it.releaseDate && it.releaseDate >= from && it.releaseDate <= today && !it.watched.m) {
        out.push({ id: `${it.id}:m`, title: it.title, body: it.releaseDate === today ? "Releases today" : "Now available" });
      }
      continue;
    }
    for (const e of flatEps(eps[it.id])) {
      if (e.air && e.air >= from && e.air <= today && !it.watched[e.key]) {
        out.push({
          id: `${it.id}:${e.key}`,
          title: it.title,
          body: `S${e.s} E${e.e} ${e.air === today ? "airs today" : "is out"}`,
        });
      }
    }
  }
  return out;
}

export async function checkNotifications(items: Item[], eps: Record<string, EpData>) {
  if (!notificationsEnabled()) return;
  try {
    const seen = new Set((await kvGet<string[]>("notified")) ?? []);
    const fresh = dueReleases(items, eps).filter((r) => !seen.has(r.id));
    if (!fresh.length) return;
    const reg = await navigator.serviceWorker.ready;
    if (fresh.length > 3) {
      await reg.showNotification("New releases", {
        body: `${fresh.length} new episodes are out`,
        tag: "releases",
        icon: "/icon",
      });
    } else {
      for (const r of fresh) {
        await reg.showNotification(r.title, { body: r.body, tag: r.id, icon: "/icon" });
      }
    }
    fresh.forEach((r) => seen.add(r.id));
    await kvSet("notified", [...seen].slice(-600));
  } catch {
    /* ignore */
  }
}
