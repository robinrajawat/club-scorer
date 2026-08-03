// Cricket Scorer service worker
//
// Goal: once the app has loaded successfully, a refresh should still work
// with no network (or a flaky connection at the ground) — cricket clubs
// don't always have great signal.
//
// Strategy, deliberately conservative:
//   - The app page itself (index.html): network-first, falling back to the
//     cached copy if the network fails. This means you always get the
//     latest version when online, and the last-successfully-loaded version
//     when offline.
//   - Versioned CDN assets (React, ReactDOM, Firebase SDK, Google Fonts):
//     cache-first, since these URLs are pinned to specific versions and
//     won't change under us.
//   - Everything else — most importantly every Firestore/Firebase Auth
//     call — is left completely untouched. Scoring data must always go to
//     the real network; caching it would be actively wrong.
//
// Bump CACHE_NAME on any meaningful change so old caches get cleaned up.
const CACHE_NAME = "cricket-scorer-v1";

const SHELL_ASSET_PATTERNS = [
  /unpkg\.com\/react@/,
  /unpkg\.com\/react-dom@/,
  /gstatic\.com\/firebasejs\//,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // Only ever handle GET requests for known, safe-to-cache things. Anything
  // else (in particular every POST/PATCH/etc, and any request we don't
  // explicitly recognize) is left completely alone — no respondWith call
  // means the browser handles it exactly as if this worker didn't exist.
  if (req.method !== "GET") return;

  const url = req.url;
  const isShellAsset = SHELL_ASSET_PATTERNS.some(p => p.test(url));
  const isPageDocument = req.mode === "navigate" || url.endsWith("/") || url.endsWith("/index.html");

  if (isShellAsset) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  if (isPageDocument) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Firestore, Firebase Auth, and anything else not matched above: untouched.
});
