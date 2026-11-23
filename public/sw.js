/* Offline-first service worker: app shell + poster cache + background release checks. */
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const IMAGES = `images-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add("/")).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keep = [SHELL, STATIC, IMAGES];
      for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Posters: cache-first
  if (url.hostname === "image.tmdb.org") {
    e.respondWith(
      caches.open(IMAGES).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === "opaque") {
            c.put(req, res.clone());
            trim(IMAGES, 400);
          }
          return res;
        } catch {
          return Response.error();
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // data lives in IndexedDB

  // Hashed build assets: cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations: network first, fall back to cached shell
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && url.pathname === "/") (await caches.open(SHELL)).put("/", res.clone());
          return res;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Everything else (icons, manifest): stale-while-revalidate
  e.respondWith(
    caches.open(SHELL).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req)
        .then((res) => {
          if (res.ok) c.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});

/* ---------- background release checks (Periodic Background Sync, Chromium) ---------- */
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("tracker", 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function all(db, store) {
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function one(db, store, key) {
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function checkReleases() {
  const db = await idb();
  const [items, eps, notified] = await Promise.all([all(db, "items"), all(db, "eps"), one(db, "kv", "notified")]);
  const seen = new Set((notified && notified.v) || []);
  const today = ymd(new Date());
  const from = ymd(new Date(Date.now() - 2 * 86400000));
  const epMap = new Map(eps.map((e) => [e.id, e]));
  const fresh = [];
  for (const it of items) {
    if (it.deleted || (it.status !== "watching" && it.status !== "planned")) continue;
    if (it.type === "movie") {
      const id = `${it.id}:m`;
      if (it.releaseDate && it.releaseDate >= from && it.releaseDate <= today && !it.watched.m && !seen.has(id))
        fresh.push({ id, title: it.title, body: it.releaseDate === today ? "Releases today" : "Now available" });
      continue;
    }
    const d = epMap.get(it.id);
    if (!d) continue;
    for (const s of d.seasons)
      for (const e of s.eps) {
        const key = `${s.n}x${e.e}`;
        const id = `${it.id}:${key}`;
        if (e.air && e.air >= from && e.air <= today && !it.watched[key] && !seen.has(id))
          fresh.push({ id, title: it.title, body: `S${s.n} E${e.e} ${e.air === today ? "airs today" : "is out"}` });
      }
  }
  if (!fresh.length) return;
  if (fresh.length > 3) {
    await self.registration.showNotification("New releases", {
      body: `${fresh.length} new episodes are out`,
      tag: "releases",
      icon: "/icon",
    });
  } else {
    for (const r of fresh) await self.registration.showNotification(r.title, { body: r.body, tag: r.id, icon: "/icon" });
  }
  fresh.forEach((r) => seen.add(r.id));
  await new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put({ id: "notified", v: [...seen].slice(-600) });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "check-releases") e.waitUntil(checkReleases().catch(() => {}));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("/");
    }),
  );
});
