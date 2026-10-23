// Offline support: the app shell, terrain grids and any map tiles you have already viewed keep
// working without a connection (useful for analog missions with poor connectivity).
//
// The shell is always fetched fresh when there is a connection, so a new version of the app is never
// held back by an old copy. Hashed files in /assets/ never change, so those are served from the cache.
const VERSION = 'marswalk-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const TILE_CACHE = `${VERSION}-tiles`;
const MAX_TILES = 600;
const TILE_HOSTS = ['trek.nasa.gov', 'astro.arcgis.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(['/data/dem/index.json', '/data/dem/global.i16z']))
      .catch(() => {}) // a missing file must not stop the new version installing
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackUrl || request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  if (cached) { fresh.catch(() => {}); return cached; }
  return fresh;
}

async function cacheFirstTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') {
    cache.put(request, res.clone());
    trimCache(TILE_CACHE, MAX_TILES);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirstTile(request).catch(() => Response.error()));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Never touch the service worker itself, the dev server's files, or anything that is not the app
  if (url.pathname === '/sw.js' || /^\/(src|@vite|@react-refresh|@id|@fs|node_modules)\//.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request).catch(() => Response.error()));
  } else {
    event.respondWith(staleWhileRevalidate(request).catch(() => Response.error()));
  }
});
