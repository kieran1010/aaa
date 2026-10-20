/*
 * sw.js — offline support for the installed app (PWA).
 *
 * The app shell (index.html + calc/calculators.js) is NETWORK-FIRST: when
 * online, every launch gets the latest version, so a corrected dose reaches
 * users immediately. If the network fails, or has not answered within
 * NETWORK_TIMEOUT_MS, the copy saved on the device is used instead.
 *
 * The two shell files are a matched pair — index.html destructures names from
 * calculators.js — so they are only ever cached together (refreshShell), and a
 * page served from the cache is also given the cached calculators.js, never a
 * newer one from the network.
 *
 * Images and icons are CACHE-FIRST and downloaded at install. Replacing an
 * image under the same filename needs a CACHE_VERSION bump to reach installed
 * copies. calc/pwa.test.js checks IMAGES against what index.html references.
 */
'use strict';

const CACHE_VERSION = 'vantage-v3';
const NETWORK_TIMEOUT_MS = 3000;

const HTML_KEY = '/';
const JS_KEY = '/calc/calculators.js';
const SHELL = [HTML_KEY, JS_KEY];

const STATIC = [
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-96.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

const IMAGES = [
  '/images/adductor_anat.jpg',
  '/images/adductor_probe.jpg',
  '/images/adductor_us.jpg',
  '/images/axillary_anat.jpg',
  '/images/axillary_probe.jpg',
  '/images/axillary_us.jpg',
  '/images/consent-header.jpg',
  '/images/esp_anat.jpg',
  '/images/esp_probe.jpg',
  '/images/esp_us.jpg',
  '/images/femoral_anat.jpg',
  '/images/femoral_probe.jpg',
  '/images/femoral_us.jpg',
  '/images/gastric-anatomy.png',
  '/images/gastric-antral-appearances.jpg',
  '/images/gastric-antrum.png',
  '/images/gastric-positioning.png',
  '/images/isb_anat.jpg',
  '/images/isb_probe.jpg',
  '/images/isb_us.jpg',
  '/images/moon-photo-watermark.png',
  '/images/popliteal_anat.jpg',
  '/images/popliteal_probe.jpg',
  '/images/popliteal_us.jpg',
  '/images/rectus_anat.jpg',
  '/images/rectus_probe.jpg',
  '/images/rectus_us.jpg',
  '/images/tte-views-1.png',
];

// Pages that were served the cached shell: clientId -> the cached
// calculators.js captured at that moment, so the page gets its matching copy
// even if a background refresh replaces the cache meanwhile.
const cachedClients = new Map();

const fresh = url => fetch(url, { cache: 'no-cache' }).then(r => {
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r;
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Shell and icons must all arrive or the install fails (and is retried on
    // the next visit). Images are best effort; any that fail are fetched and
    // cached the first time they are viewed online.
    await cache.addAll([...SHELL, ...STATIC].map(u => new Request(u, { cache: 'reload' })));
    await Promise.allSettled(IMAGES.map(u => fresh(u).then(r => cache.put(u, r))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE_VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Fetch both shell files and cache them together, or not at all.
async function refreshShell(htmlResponse) {
  const js = await fresh(JS_KEY);
  const cache = await caches.open(CACHE_VERSION);
  await Promise.all([cache.put(HTML_KEY, htmlResponse), cache.put(JS_KEY, js)]);
}

async function handleNavigation(event) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(HTML_KEY);
  const network = fresh(event.request.url);
  if (!cached) return network;

  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  const response = await Promise.race([network.catch(() => null), timeout]);
  if (response) {
    event.waitUntil(refreshShell(response.clone()).catch(() => {}));
    return response;
  }

  // Offline or too slow: serve the saved pair, and keep the network attempt
  // going so the next launch has the latest version.
  cachedClients.set(event.resultingClientId, await cache.match(JS_KEY));
  event.waitUntil(network.then(r => refreshShell(r)).catch(() => {}));
  return cached;
}

async function handleCalculators(event) {
  const snapshot = cachedClients.get(event.clientId);
  if (snapshot) return snapshot.clone();
  // The page itself came from the network, so the network is answering: no
  // timeout here, the cache is only for a failed request.
  try {
    return await fresh(event.request.url);
  } catch (e) {
    return (await caches.match(JS_KEY)) || Response.error();
  }
}

async function handleCacheFirst(request, key) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(key, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(handleNavigation(event));
  } else if (url.pathname === JS_KEY) {
    event.respondWith(handleCalculators(event));
  } else if (url.pathname.startsWith('/images/') || STATIC.includes(url.pathname)) {
    event.respondWith(handleCacheFirst(req, url.pathname));
  }
});

// The page asks whether it is running from the saved copy (for its badge).
self.addEventListener('message', event => {
  if (event.data === 'vantage:source?' && event.source) {
    event.source.postMessage({ type: 'vantage:source', cached: cachedClients.has(event.source.id) });
  }
});
