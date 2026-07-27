/**
 * Offline shell for Omias Pocket.
 *
 * The queue in localStorage already means a tap survives having no signal — but only if the page
 * loads at all. Without this, opening the app in a substation basement or a lift gives the
 * browser's offline error, and the whole point (capture wherever Dan actually is) is lost at the
 * first step. So the shell is cached and served from the phone; only GitHub needs the network.
 *
 * Stale-while-revalidate, not cache-first: cache-first would pin the phone to whatever version it
 * first saw, and a bug fix would never arrive. This serves instantly from cache and quietly
 * replaces it in the background, so the next open is current.
 *
 * api.github.com is never cached. A stale snapshot is worse than no snapshot — the page already
 * keeps its own copy in localStorage and says how old it is.
 */
const CACHE = "pocket-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg", "./icon.png", "./icon-maskable.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((hit) => {
      const live = fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => hit); // offline: whatever is cached, or a genuine failure if nothing is
      return hit || live;
    }),
  );
});
