// Fic Workbench service worker.
// Pages are network-first (so updates show up on the next load, with no version number to remember) and fall back to the cache when offline or slow.
// Only same-origin GET requests are handled; calls to OpenRouter / TokenReply are never touched.
const CACHE = "fic-workbench-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];
const SLOW_MS = 3000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined));
  e.respondWith(new Promise(resolve => {
    let settled = false;
    const done = r => { if (!settled && r) { settled = true; resolve(r); } };
    const slow = setTimeout(() => fromCache().then(done), SLOW_MS);
    fetch(req).then(res => {
      clearTimeout(slow);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      if (!settled) { settled = true; resolve(res); }
    }).catch(() => { clearTimeout(slow); fromCache().then(r => { if (!settled) { settled = true; resolve(r || Response.error()); } }); });
  }));
});
