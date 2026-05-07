// ═══════════════════════════════════════════════════════════════════
// Service Worker - Media Contact Congo Brazza
// Cache l'application + gestion intelligente des mises à jour
// ═══════════════════════════════════════════════════════════════════

// ⚠️ Incrémenter cette version à chaque déploiement majeur pour forcer la MAJ
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'mccb-' + CACHE_VERSION;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Installation : pré-charger l'app dans le cache ──
self.addEventListener('install', function(event) {
  console.log('[SW] Installation v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE).catch(function(err) {
        console.warn('[SW] Cache partiel:', err);
      });
    })
  );
  // ✨ Plus de skipWaiting() automatique — l'agent décide quand activer
});

// ── Activation : nettoyer les anciens caches ──
self.addEventListener('activate', function(event) {
  console.log('[SW] Activation v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('mccb-')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ── Message du client : permet de "forcer" l'activation d'une nouvelle version ──
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch : Network-first avec fallback cache ──
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.includes('metered.ca') ||
      url.includes('cloudflare.com') ||
      url.includes('jsdelivr.net')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache).catch(function(){});
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) return cachedResponse;
          return new Response('Hors ligne — connexion requise', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

// ── Notifications push ──
self.addEventListener('push', function(event) {
  let data = { title: 'Media Contact', body: 'Nouvelle notification' };
  try {
    if (event.data) data = event.data.json();
  } catch(e) {}

  const options = {
    body: data.body || 'Nouvelle notification',
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    vibrate: [400, 200, 400, 200, 400],
    requireInteraction: true,
    tag: data.tag || 'mccb-notif',
    renotify: true,
    silent: false,
    data: data.url || './'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Media Contact', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data || './');
      }
    })
  );
});

console.log('[SW] Service Worker v' + CACHE_VERSION + ' chargé');
