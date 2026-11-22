import { useSyncExternalStore } from "react";
import { allItemsRaw, applyRemote, onLocalChange } from "./store";
import type { Item } from "./types";

const K_KEY = "tracker:key";
const K_LAST = "tracker:last"; // server time of last pull
const K_PUSHED = "tracker:pushed"; // client time of last push
const K_TIME = "tracker:synced-at";

export interface SyncState {
  status: "idle" | "syncing" | "error" | "offline";
  at: number;
}

let state: SyncState = { status: "idle", at: 0 };
const listeners = new Set<() => void>();
function setState(s: Partial<SyncState>) {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function getSyncKey(): string | null {
  try {
    return localStorage.getItem(K_KEY);
  } catch {
    return null;
  }
}

export function normalizeKey(k: string) {
  return k.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function formatKey(k: string) {
  return k.match(/.{1,4}/g)?.join("-") ?? k;
}

export function ensureSyncKey(): string {
  let k = getSyncKey();
  if (!k) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    k = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    localStorage.setItem(K_KEY, k);
  }
  return k;
}

/** Link this device to an existing vault. Everything local is pushed and everything remote pulled. */
export function linkKey(raw: string): boolean {
  const k = normalizeKey(raw);
  if (k.length < 16) return false;
  localStorage.setItem(K_KEY, k);
  localStorage.setItem(K_LAST, "0");
  localStorage.setItem(K_PUSHED, "0");
  return true;
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await runOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function runOnce() {
  const key = getSyncKey();
  if (!key) return;
  if (!navigator.onLine) {
    setState({ status: "offline" });
    return;
  }
  setState({ status: "syncing" });
  try {
    const started = Date.now();
    const pushed = Number(localStorage.getItem(K_PUSHED) ?? 0);
    const since = Number(localStorage.getItem(K_LAST) ?? 0);
    const outgoing = allItemsRaw().filter((i) => i.updatedAt > pushed);
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, since, items: outgoing }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { items: Item[]; serverTime: number };
    applyRemote(data.items);
    localStorage.setItem(K_PUSHED, String(started));
    localStorage.setItem(K_LAST, String(data.serverTime));
    const at = Date.now();
    localStorage.setItem(K_TIME, String(at));
    setState({ status: "idle", at });
  } catch {
    setState({ status: navigator.onLine ? "error" : "offline" });
  }
}

let started = false;
/** Wire up automatic syncing: on change (debounced), on reconnect, on foreground. */
export function startAutoSync() {
  if (started) return;
  started = true;
  const at = Number(localStorage.getItem(K_TIME) ?? 0);
  if (at) setState({ at });
  let t: ReturnType<typeof setTimeout> | undefined;
  onLocalChange(() => {
    clearTimeout(t);
    t = setTimeout(() => void syncNow(), 2500);
  });
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  ensureSyncKey();
  void syncNow();
}
