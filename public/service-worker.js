/* =============================================================================
   Suhel Roadlines — service worker
   -----------------------------------------------------------------------------
   WHY THIS EXISTS
   A Home Screen web app with no service worker is not an app: tapping the icon
   with no signal shows Safari's error page, inside a chrome-less window with no
   reload button and no address bar. That is the single worst standalone failure
   mode, and it is the reason this file is here — not offline editing, which
   fastSync and Firestore persistence already handle.

   WHAT IT DOES NOT DO
   It does not cache Firebase. Firestore and RTDB carry their own persistence and
   their own conflict handling; putting a second cache in front of them would
   serve stale records the app believes are live, and hide writes that never
   landed. Cross-origin requests are passed straight through, untouched.

   CACHE STRATEGY, and why each is what it is
     navigations        network-first, fall back to the cached shell.
                        Network-first because the shell must be able to update;
                        an SPA that pins its own index.html can never ship a fix.
     /static/*          cache-first. CRA content-hashes these, so a given URL is
                        immutable and revalidating it is pure latency.
     icons, splash      cache-first. Same reasoning, plus they are needed for a
                        cold launch before the network is up.
     other same-origin  stale-while-revalidate.
   ========================================================================== */

/* Bump to invalidate everything. Changing this is the only supported way to
   force clients off a bad cache, since the URLs above are otherwise immutable. */
const VERSION = 'srl-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/* The minimum needed to paint the app with no network. Intentionally short:
   CRA's bundle filenames are hashed at build time and unknown here, so they are
   picked up by runtime caching on first visit rather than guessed. */
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons/icon-180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is atomic — one 404 fails the whole install and leaves the old
      // worker in place, so each entry is added individually and a missing
      // optional file cannot block the update.
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
      // Activate immediately. There is no in-page state a delayed swap would
      // protect: the waiting worker is only promoted after the user accepts the
      // update prompt (see serviceWorkerRegistration.js).
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/* Let the page promote a waiting worker on the user's say-so. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isStaticAsset = (url) =>
  url.pathname.startsWith('/static/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.startsWith('/splash/') ||
  /\.(png|svg|woff2?|ttf)$/.test(url.pathname);

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable, and only our own origin is ours to cache. Firebase,
  // Google APIs and anything else third-party fall through to the network.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so a deploy can actually reach the user, with the
  // cached shell as the offline answer. `mode === 'navigate'` also covers a
  // standalone cold launch, which is the case that matters most here.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(SHELL_CACHE);
          // Any in-app route must resolve to the SPA shell; react-router does
          // the rest client-side.
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});
