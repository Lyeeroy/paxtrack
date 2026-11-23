// Tiny promise wrapper around IndexedDB (no dependencies, ~1KB).
let dbp: Promise<IDBDatabase> | null = null;

// Track in-flight writes so an account switch can wait for them before
// clearing the cache. Otherwise a stale write could land after the clear and
// leak the previous account's items into the next account's library.
const pendingWrites = new Set<Promise<unknown>>();

function track<T>(promise: Promise<T>): Promise<T> {
  pendingWrites.add(promise);
  void promise
    .finally(() => pendingWrites.delete(promise))
    .catch(() => {});
  return promise;
}

export async function idbFlush(): Promise<void> {
  while (pendingWrites.size) {
    await Promise.allSettled([...pendingWrites]);
  }
}

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open("tracker", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("items", { keyPath: "id" });
        db.createObjectStore("eps", { keyPath: "id" });
        db.createObjectStore("kv", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result as T[]);
    r.onerror = () => reject(r.error);
  });
}

export async function idbPut(store: string, value: unknown): Promise<void> {
  const db = await open();
  return track(
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }),
  );
}

/** Put many values in one transaction (used by a full backup restore). */
export async function idbPutMany(store: string, values: unknown[]): Promise<void> {
  if (!values.length) return;
  const db = await open();
  return track(
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      values.forEach((value) => os.put(value));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }),
  );
}

/**
 * Write items only when they are newer than the copy already in IndexedDB.
 * The read and write happen in one transaction, so a cloud pull can never
 * overwrite a local edit that lands while the pull is being applied.
 */
export async function idbPutIfNewer<T extends { id: string; updatedAt: number }>(
  store: string,
  values: T[],
): Promise<void> {
  if (!values.length) return;
  const db = await open();
  return track(
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      values.forEach((value) => {
        const req = os.get(value.id);
        req.onsuccess = () => {
          const existing = req.result as T | undefined;
          if (!existing || value.updatedAt > existing.updatedAt) os.put(value);
        };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }),
  );
}

export async function idbClear(store: string): Promise<void> {
  const db = await open();
  return track(
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }),
  );
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db.transaction("kv").objectStore("kv").get(key);
    r.onsuccess = () => resolve(r.result?.v as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function kvSet(key: string, v: unknown): Promise<void> {
  return idbPut("kv", { id: key, v });
}
