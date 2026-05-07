// ═══════════════════════════════════════════════════════════════════
// Service Worker - Media Contact Congo Brazza
// Cache l'app + notifications push via Firebase Realtime Database
// ═══════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v3';
const CACHE_NAME = 'mccb-' + CACHE_VERSION;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const FIREBASE_URL = 'https://portail-mccb-new-default-rtdb.firebaseio.com';

// ── Installation ──
self.addEventListener('install', function(event) {
  console.log('[SW] Installation v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE).catch(function(err) {
        console.warn('[SW] Cache partiel:', err);
      });
    })
  );
});

// ── Activation ──
self.addEventListener('activate', function(event) {
  console.log('[SW] Activation v' + CACHE_VERSION);
  event.waitUntil(
    Promise.all([
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('mccb-')) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
  // Démarrer la surveillance Firebase à l'activation
  _demarrerSurveillanceAppels();
});

// ── Message du client ──
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Quand le client donne son numéro WA → on commence à surveiller
  if (event.data && event.data.type === 'SET_WA_AGENT') {
    self.waAgent = event.data.waAgent;
    console.log('[SW] WhatsApp agent reçu:', self.waAgent);
    _demarrerSurveillanceAppels();
  }
  // Stop surveillance (déconnexion)
  if (event.data && event.data.type === 'STOP_SURVEILLANCE') {
    _arreterSurveillanceAppels();
  }
});

// ── Fetch : Network-first ──
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
          return new Response('Hors ligne', { status: 503 });
        });
      })
  );
});

// ═══════════════════════════════════════════════════════════════════
// SURVEILLANCE DES APPELS ENTRANTS via Firebase Realtime DB
// ═══════════════════════════════════════════════════════════════════
let _surveillanceTimer = null;
let _dernierAppelId = null;

function _demarrerSurveillanceAppels() {
  if (_surveillanceTimer) clearInterval(_surveillanceTimer);
  if (!self.waAgent) {
    // Récupérer waAgent depuis le cache si pas encore fourni
    return;
  }
  console.log('[SW] Démarrage surveillance appels pour', self.waAgent);
  // Vérifier toutes les 8 secondes (compromis batterie/réactivité)
  _surveillanceTimer = setInterval(_verifierAppelsEnAttente, 8000);
  _verifierAppelsEnAttente(); // immédiat
}

function _arreterSurveillanceAppels() {
  if (_surveillanceTimer) {
    clearInterval(_surveillanceTimer);
    _surveillanceTimer = null;
    console.log('[SW] Surveillance arrêtée');
  }
}

function _verifierAppelsEnAttente() {
  if (!self.waAgent) return;

  // Récupérer les appels en attente pour cet agent depuis Firebase
  const url = FIREBASE_URL + '/appels_attente/' + encodeURIComponent(self.waAgent) + '.json';
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(appels) {
      if (!appels || typeof appels !== 'object') return;

      // Trouver l'appel le plus récent non encore notifié
      const ids = Object.keys(appels);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const appel = appels[id];
        if (!appel || appel.notifie === true) continue;
        // Ignorer les appels trop vieux (>30s) ou trop récents (déjà notifiés en JS)
        const age = Date.now() - (appel.timestamp || 0);
        if (age > 30000) continue;
        if (id === _dernierAppelId) continue;

        // Vérifier si l'app est déjà ouverte
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(function(clients) {
            const appOuverteVisible = clients.some(function(c) {
              return c.visibilityState === 'visible' && c.focused;
            });
            if (!appOuverteVisible) {
              // App pas visible → afficher notification système
              _afficherNotificationAppel(appel, id);
              _dernierAppelId = id;
              // Marquer comme notifié dans Firebase
              fetch(url + '/' + id + '/notifie.json', {
                method: 'PUT',
                body: 'true'
              }).catch(function(){});
            }
          });
      }
    })
    .catch(function(err) {
      // Silence pour ne pas spammer
    });
}

function _afficherNotificationAppel(appel, appelId) {
  const titre = '📞 Appel vidéo entrant';
  const body = (appel.mc_nom ? appel.mc_nom + ' vous appelle.' : 'Un agent Media Contact vous appelle.') +
               '\nTouchez pour décrocher.';

  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    image: './icon-512.png',
    vibrate: [400, 200, 400, 200, 400, 200, 400, 200, 400],
    requireInteraction: true,
    tag: 'appel-' + appelId,
    renotify: true,
    silent: false,
    data: {
      url: './',
      appelId: appelId,
      type: 'appel_entrant'
    },
    actions: [
      { action: 'decrocher', title: '✅ Décrocher' },
      { action: 'refuser', title: '❌ Refuser' }
    ]
  };

  self.registration.showNotification(titre, options);
  console.log('[SW] 📞 Notification appel envoyée:', appelId);
}

// ── Clic sur notification ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action; // 'decrocher', 'refuser', ou '' (clic sur la notif elle-même)

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si refus, juste fermer
      if (action === 'refuser') {
        // Marquer comme refusé dans Firebase
        if (data.appelId && self.waAgent) {
          const url = FIREBASE_URL + '/appels_attente/' + encodeURIComponent(self.waAgent) + '/' + data.appelId + '/refuse.json';
          fetch(url, { method: 'PUT', body: 'true' }).catch(function(){});
        }
        return;
      }

      // Décrocher ou clic simple → ouvrir l'app
      // Si l'app est déjà ouverte, focus dessus
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            action: action || 'open',
            appelId: data.appelId
          });
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(data.url || './');
      }
    })
  );
});

console.log('[SW] Service Worker v' + CACHE_VERSION + ' chargé (avec surveillance appels)');
