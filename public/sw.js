/**
 * Service Worker for مدیریت مالی پروژه‌های شخصی (PWA)
 * VERSION must be bumped on every deploy that changes this file or precache entries.
 */

const VERSION = '1.0.0';
const APP_PREFIX = 'pfm';
const BASE = '/';

const CACHE = {
  precache: `${APP_PREFIX}-precache-${VERSION}`,
  assets: `${APP_PREFIX}-assets-${VERSION}`,
  pages: `${APP_PREFIX}-pages-${VERSION}`,
  images: `${APP_PREFIX}-images-v1`,
};

const OFFLINE_URL = BASE + 'offline.html';
const APP_SHELL_URL = BASE + 'index.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  APP_SHELL_URL,
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'css/pwa.css',
  BASE + 'js/pwa.js',
  BASE + 'fonts/Vazirmatn-Regular.woff2',
  BASE + 'fonts/Vazirmatn-Bold.woff2',
];

const RESPECT_NO_STORE = true;
const NAV_TIMEOUT_MS = 4000;
const MAX_ENTRIES = { pages: 20, images: 50 };

// ───────────── Lifecycle ─────────────
self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

async function precache() {
  const cache = await caches.open(CACHE.precache);
  await Promise.all(PRECACHE_URLS.map(async (url) => {
    try {
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok || response.redirected) {
        console.warn(`[SW] precache skip: ${url} (${response.status})`);
        return;
      }
      await cache.put(url, response);
    } catch (e) {
      console.warn(`[SW] precache failed: ${url}`, e.message);
    }
  }));
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const current = new Set(Object.values(CACHE));
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(`${APP_PREFIX}-`) && !current.has(name))
      .map(name => caches.delete(name)));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ───────────── Routing ─────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (request.headers.has('range')) return;

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // No cross-origin caching (Iran profile: self-host everything)

  // sw.js itself: never cache
  if (url.pathname === BASE + 'sw.js') return;

  // Page navigations → SPA: Network First with App Shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(page(event));
    return;
  }

  // Static files
  switch (request.destination) {
    case 'style':
    case 'script':
    case 'worker':
      event.respondWith(isFingerprinted(url)
        ? cacheFirst(event, CACHE.assets)
        : staleWhileRevalidate(event, CACHE.assets));
      return;
    case 'font':
      event.respondWith(cacheFirst(event, CACHE.assets));
      return;
    case 'image':
      event.respondWith(cacheFirst(event, CACHE.images, {
        maxEntries: MAX_ENTRIES.images,
        fallback: imagePlaceholder,
      }));
      return;
  }
});

// ───────────── Strategies ─────────────
async function page(event) {
  const { request } = event;

  const network = (async () => {
    const response = (await event.preloadResponse) || (await fetch(request));
    if (isCacheable(response)) {
      event.waitUntil(putInCache(CACHE.pages, request, response.clone(), MAX_ENTRIES.pages));
    }
    return response;
  })();
  event.waitUntil(network.catch(() => {}));

  const cached = await caches.match(request);

  if (cached && NAV_TIMEOUT_MS > 0) {
    const timeout = new Promise(resolve => setTimeout(resolve, NAV_TIMEOUT_MS));
    const winner = await Promise.race([network, timeout]).catch(() => undefined);
    return winner || cached;
  }

  try {
    return await network;
  } catch {
    // SPA fallback: serve index.html from precache, or offline page
    const appShell = await caches.match(APP_SHELL_URL);
    if (appShell) return appShell;
    return offlinePage();
  }
}

async function cacheFirst(event, cacheName, { maxEntries, fallback } = {}) {
  const { request } = event;
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      event.waitUntil(putInCache(cacheName, request, response.clone(), maxEntries));
    }
    return response;
  } catch {
    return fallback ? fallback(request) : Response.error();
  }
}

async function staleWhileRevalidate(event, cacheName, { maxEntries } = {}) {
  const { request } = event;
  const network = fetch(request)
    .then(response => {
      if (isCacheable(response)) {
        event.waitUntil(putInCache(cacheName, request, response.clone(), maxEntries));
      }
      return response;
    })
    .catch(() => undefined);
  event.waitUntil(network);

  const cached = (await (await caches.open(cacheName)).match(request)) || (await caches.match(request));
  return cached || (await network) || Response.error();
}

// ───────────── Helpers ─────────────
function isCacheable(response) {
  if (!response || !response.ok || response.status === 206) return false;
  if (response.type !== 'basic' && response.type !== 'cors') return false;
  if (response.redirected) return false;
  if (RESPECT_NO_STORE && /no-store/i.test(response.headers.get('Cache-Control') || '')) return false;
  if ((response.headers.get('Vary') || '').trim() === '*') return false;
  return true;
}

function isFingerprinted(url) {
  if (['v', 'ver', 'id', 'hash'].some(key => url.searchParams.has(key))) return true;
  const hash = url.pathname.match(/[.-]([A-Za-z0-9_]{8,})\.(?:m?js|css)$/)?.[1];
  return Boolean(hash) && (/\d/.test(hash) || (/[a-z]/.test(hash) && /[A-Z]/.test(hash)));
}

async function putInCache(cacheName, request, response, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
    if (maxEntries) {
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)));
    }
  } catch (error) {
    console.warn('[SW] cache write skipped:', error?.message);
  }
}

async function offlinePage() {
  const cached = await caches.match(OFFLINE_URL);
  if (cached) return cached;
  return new Response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>آفلاین</title><h1>اتصال برقرار نیست</h1></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function imagePlaceholder() {
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#1a2d4d"/></svg>',
    { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' } },
  );
}
