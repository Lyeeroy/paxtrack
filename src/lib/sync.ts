import { useSyncExternalStore } from "react";
import { getCurrentUser, onAuthChange } from "./auth";
import { refreshStale } from "./refresh";
import { allItemsRaw, applyRemote, onLocalChange, resetLocalData } from "./store";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";
import type { Item } from "./types";

const PUSH_BATCH = 500;
const PULL_PAGE = 500;
// Server timestamps are microseconds. Re-read a few seconds on every pull so
// rows written in the same clock tick can never be skipped.
const PULL_OVERLAP_US = 5_000_000;

const OWNER_KEY = "tracker:owner";
const PUSHED_PREFIX = "tracker:pushed:";
const SINCE_PREFIX = "tracker:since:";
const AT_PREFIX = "tracker:synced-at:";

export type SyncStatus = "idle" | "syncing" | "error" | "offline" | "signed-out" | "unconfigured";

export interface SyncState {
  status: SyncStatus;
  at: number;
}

interface TrackedRow {
  data: Item;
  server_ts: number;
}

let state: SyncState = { status: "idle", at: 0 };
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
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

/**
 * A browser can only hold one account's cache at a time. The first account to
 * sign in adopts any existing local library; a different account clears it
 * before pulling its own data.
 */
async function claimLocalData(userId: string) {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner === userId) {
    // If the IndexedDB cache was cleared outside the app but the localStorage
    // cursor survived, force a full pull instead of resuming from the cursor.
    const since = Number(localStorage.getItem(SINCE_PREFIX + userId) ?? 0);
    if (allItemsRaw().length === 0 && Number.isFinite(since) && since > 0) {
      localStorage.removeItem(PUSHED_PREFIX + userId);
      localStorage.removeItem(SINCE_PREFIX + userId);
    }
    return;
  }

  if (owner) {
    await resetLocalData();
    localStorage.removeItem(PUSHED_PREFIX + userId);
    localStorage.removeItem(SINCE_PREFIX + userId);
    localStorage.removeItem(AT_PREFIX + userId);
  } else {
    // First sign-in on this browser: adopt the local library and do a full sync.
    localStorage.removeItem(PUSHED_PREFIX + userId);
    localStorage.removeItem(SINCE_PREFIX + userId);
    localStorage.removeItem(AT_PREFIX + userId);
  }

  localStorage.setItem(OWNER_KEY, userId);
}

async function runOnce() {
  if (!isSupabaseConfigured) {
    setState({ status: "unconfigured" });
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState({ status: "offline" });
    return;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      setState({ status: "signed-out", at: 0 });
      return;
    }

    setState({ status: "syncing" });
    await claimLocalData(user.id);

    const pushedKey = PUSHED_PREFIX + user.id;
    const sinceKey = SINCE_PREFIX + user.id;
    const atKey = AT_PREFIX + user.id;
    const pushedRaw = Number(localStorage.getItem(pushedKey) ?? 0);
    const sinceRaw = Number(localStorage.getItem(sinceKey) ?? 0);
    const pushed = Number.isFinite(pushedRaw) ? pushedRaw : 0;
    const since = Number.isFinite(sinceRaw) ? sinceRaw : 0;

    // Pull first so last-write-wins can resolve local/remote conflicts before
    // anything is uploaded. Pushing first could overwrite a newer cloud copy
    // with stale local data.
    let pageCursor = Math.max(0, since - PULL_OVERLAP_US);
    let cursor = since;
    const remote = new Map<string, Item>();

    for (;;) {
      const { data, error } = await getSupabase()
        .from("tracked_items")
        .select("data, server_ts")
        .eq("user_id", user.id)
        .gt("server_ts", pageCursor)
        .order("server_ts", { ascending: true })
        .limit(PULL_PAGE);
      if (error) throw error;

      const rows = (data ?? []) as TrackedRow[];
      if (!rows.length) break;

      for (const row of rows) {
        const ts = Number(row.server_ts);
        if (Number.isFinite(ts)) {
          pageCursor = Math.max(pageCursor, ts);
          cursor = Math.max(cursor, ts);
        }
        if (row.data && typeof row.data.id === "string") remote.set(row.data.id, row.data);
      }
      if (rows.length < PULL_PAGE) break;
    }

    // The account may have changed while the request was in flight. Never
    // apply one user's rows after another user has signed in.
    const current = await getCurrentUser();
    if (current?.id !== user.id) return;

    if (remote.size) {
      if (await applyRemote([...remote.values()])) void refreshStale();
    }
    localStorage.setItem(sinceKey, String(cursor));

    // Upload only local items that are new or newer than the cloud copy we
    // just read. Pulled cloud rows are already up to date and stay untouched.
    const outgoing = allItemsRaw().filter((i) => {
      if (i.updatedAt <= pushed) return false;
      const cloud = remote.get(i.id);
      return !cloud || i.updatedAt > cloud.updatedAt;
    });
    // Any edit made while the upload is in flight must be picked up by the
    // next sync, so record a cursor just before the upload starts.
    const pushStarted = Date.now();
    if (outgoing.length) {
      const rows = outgoing.map((i) => ({
        user_id: user.id,
        item_id: i.id,
        data: i,
        updated_at: i.updatedAt,
        deleted: !!i.deleted,
      }));
      for (let i = 0; i < rows.length; i += PUSH_BATCH) {
        const { error } = await getSupabase()
          .from("tracked_items")
          .upsert(rows.slice(i, i + PUSH_BATCH), { onConflict: "user_id,item_id" });
        if (error) throw error;
      }
      localStorage.setItem(pushedKey, String(Math.max(0, pushStarted - 1)));
    }

    const at = Date.now();
    localStorage.setItem(atKey, String(at));
    setState({ status: "idle", at });
  } catch (e) {
    console.error("sync failed", e);
    setState({ status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error" });
  }
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

/** Remove keys from the old custom sync-key backend. */
function migrateLegacyKeys() {
  for (const key of ["tracker:key", "tracker:last", "tracker:pushed", "tracker:synced-at"]) {
    localStorage.removeItem(key);
  }
}

let started = false;
/** Wire up automatic syncing: on auth change, local change, reconnect and foreground. */
export function startAutoSync() {
  if (started) return;
  started = true;
  migrateLegacyKeys();

  onAuthChange(() => {
    setState({ at: 0 });
    void syncNow();
  });

  let t: ReturnType<typeof setTimeout> | undefined;
  onLocalChange(() => {
    clearTimeout(t);
    t = setTimeout(() => void syncNow(), 2500);
  });
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });

  void syncNow();
}
