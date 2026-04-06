/**
 * Service Worker for Passdown PWA
 * Enables offline functionality — cache local assets, network-first for CDN/AI
 */

const CACHE_NAME = 'passdown-v4';

// Local assets to pre-cache on install
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/print.css',
  './js/core/config.js',
  './js/core/store.js',
  './js/core/search.js',
  './js/core/ai-service.js',
  './js/core/file-converter.js',
  './js/shared/ui.js',
  './js/shared/icons.js',
  './js/shared/markdown.js',
  './js/components/app.js',
  './js/components/dashboard.js',
  './js/components/capture.js',
  './js/components/entry-list.js',
  './js/components/stakeholder-map.js',
  './js/components/calendar-view.js',
  './js/components/narrative.js',
  './js/components/verification.js',
  './js/components/search-panel.js',
  './js/components/start-here.js',
  './js/components/ai-chat.js',
  './js/components/export-import.js',
  './js/components/settings.js',
  './js/components/print-view.js',
  './js/components/file-drop-zone.js',
  './js/components/federation.js',
  './js/components/analytics.js',
  './js/core/webllm-service.js',
  './js/core/olf-export.js',
  './js/core/file-converter.js',
  './data/olf/schema.json',
  './data/prompts/standard.json',
  './data/prompts/occfield-specific.json',
  './data/templates/occfield-manager.json',
  './data/templates/branch-chief.json',
  './data/templates/general.json',
  './assets/icon-192.svg',
  './assets/icon-512.svg',
];

// CDN assets to cache on first use (network-first, then cache fallback)
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'unpkg.com',
  'esm.sh',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];

// Firebase/Google hosts — never cache (need fresh auth tokens)
const NO_CACHE_HOSTS = [
  'www.gstatic.com',
  'firebasestorage.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'generativelanguage.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'accounts.google.com',
];

// ─── Install: pre-cache local assets ─────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching local assets');
        return cache.addAll(LOCAL_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ──────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch: smart routing ───────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Firebase/Google auth/AI requests
  if (NO_CACHE_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // CDN assets: cache-first with network update (stale-while-revalidate)
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Local assets: network-first with cache fallback (always gets fresh code when online)
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Offline: serve from cache
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        // Last resort: serve index.html for HTML requests
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
