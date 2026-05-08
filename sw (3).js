// ═══════════════════════════════════════════════════════════════════
// Service Worker - Media Contact Congo Brazza
// Cache l'app + notifications push via Firebase + OneSignal Web Push
// ═══════════════════════════════════════════════════════════════════

// ═══ ONESIGNAL : Importer le SDK OneSignal en premier ═══
// Cela permet à OneSignal de gérer les vraies notifications push natives
// (pop-up sur écran de verrouillage, sonnerie même app fermée).
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ═══ FIREBASE CLOUD MESSAGING (FCM) ═══
// Pour les data messages (déclenchent push event même app fermée)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDg3Fydp5aBtYT8iuCKTZB981MYkHPamlA",
  authDomain: "portail-mccb-new.firebaseapp.com",
  projectId: "portail-mccb-new",
  storageBucket: "portail-mccb-new.firebasestorage.app",
  messagingSenderId: "65482272143",
  appId: "1:65482272143:web:d341598f18e8fd49086ffa"
});

// ═══ Handler PUSH : reçoit les data messages FCM même app fermée ═══
// C'est CE handler qui réveille Chrome et affiche la notif d'appel
self.addEventListener('push', function(event) {
  console.log('[SW] 🔔 Push event reçu !');
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    try { data = { body: event.data.text() }; } catch(e2) {}
  }

  // Si c'est un data message FCM avec un appel
  const isAppel = data.type === 'appel_entrant' || (data.data && data.data.type === 'appel_entrant');
  const payload = data.data || data;
  const callId = payload.callId || payload.dossier_id || payload.appelId || '';
  const callerName = payload.callerName || payload.mc_nom || payload.agent_nom || 'Appelant';

  if (isAppel || callId) {
    // Notification d'appel entrant style WhatsApp (au mieux possible pour PWA)
    const titre = '📞 Appel vidéo entrant';
    const body = callerName + '\n\n📞 Touchez pour décrocher';

    const options = {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      image: './icon-512.png',
      vibrate: [500, 300, 500, 300, 500, 300, 500, 300, 500, 300, 500, 300],
      requireInteraction: true,
      tag: 'appel-' + callId,
      renotify: true,
      silent: false,
      timestamp: Date.now(),
      data: {
        url: './?call=' + callId,
        callId: callId,
        callerName: callerName,
        type: 'appel_entrant'
      },
      actions: [
        { action: 'decrocher', title: '✅ Décrocher' },
        { action: 'refuser', title: '❌ Refuser' }
      ]
    };

    event.waitUntil(self.registration.showNotification(titre, options));
    return;
  }

  // Notification générique
  if (data.title || data.body) {
    const options = {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: data
    };
    event.waitUntil(self.registration.showNotification(data.title || 'MCCB', options));
  }
});

const CACHE_VERSION = 'v6';
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
  const mcNom = appel.mc_nom || 'Media Contact';
  const titre = '📞 Appel vidéo entrant';
  const body = mcNom + '\n\n📞 Appel vidéo en cours...\n👇 Touchez pour décrocher';

  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    image: './icon-512.png',
    // ═══ Vibration STYLE APPEL TÉLÉPHONE (boucle longue, intense) ═══
    vibrate: [
      500, 300, 500, 300, 500, 300, 500, 300, 500, 300,
      500, 300, 500, 300, 500, 300, 500, 300, 500, 300
    ],
    requireInteraction: true, // ne se ferme pas automatiquement
    tag: 'appel-' + appelId,
    renotify: true,           // re-déclenche son+vibration à chaque réémission
    silent: false,             // FORCE le son (pas silencieux)
    timestamp: Date.now(),     // horodate la notif
    data: {
      url: './?appel=' + appelId,
      appelId: appelId,
      type: 'appel_entrant',
      mc_nom: mcNom,
      timestamp: Date.now()
    },
    actions: [
      { action: 'decrocher', title: '✅ DÉCROCHER', icon: './icon-192.png' },
      { action: 'refuser', title: '❌ REFUSER', icon: './icon-192.png' }
    ]
  };

  self.registration.showNotification(titre, options);

  // ═══ Re-émettre la notification toutes les 3s pour effet "sonnerie continue" ═══
  // Le 'tag' garantit qu'on remplace la notif existante (pas de doublons)
  // 'renotify' force le son+vibration à chaque réémission
  let reemissions = 0;
  const maxReemissions = 10; // sonnerie pendant ~30s
  const timerReemission = setInterval(function() {
    reemissions++;
    if (reemissions >= maxReemissions) {
      clearInterval(timerReemission);
      return;
    }
    // Vérifier si l'utilisateur a déjà répondu
    self.registration.getNotifications({ tag: 'appel-' + appelId }).then(function(notifs) {
      if (notifs.length === 0) {
        // L'utilisateur a fermé/répondu → on arrête
        clearInterval(timerReemission);
        return;
      }
      // Re-émettre pour relancer son + vibration
      self.registration.showNotification(titre, options);
    });
  }, 3000);

  console.log('[SW] 📞 Notification appel envoyée (boucle):', appelId);
}

// ── Clic sur notification ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action; // 'decrocher', 'refuser', ou '' (clic sur la notif elle-même)
  const callId = data.callId || data.appelId || '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si refus, juste fermer
      if (action === 'refuser') {
        if (data.appelId && self.waAgent) {
          const url = FIREBASE_URL + '/appels_attente/' + encodeURIComponent(self.waAgent) + '/' + data.appelId + '/refuse.json';
          fetch(url, { method: 'PUT', body: 'true' }).catch(function(){});
        }
        if (callId) {
          fetch(FIREBASE_URL + '/videoCall/' + callId + '/statut.json', {
            method: 'PUT', body: '"refuse"'
          }).catch(function(){});
        }
        return;
      }

      // Décrocher ou clic simple → ouvrir l'app SUR LA PAGE D'APPEL
      const targetUrl = './?call=' + callId + '&autoanswer=1';

      // Si l'app est déjà ouverte, focus dessus + envoyer le callId
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            action: action || 'open',
            callId: callId,
            appelId: data.appelId,
            autoAnswer: action === 'decrocher'
          });
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre sur ?call=xxx
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

console.log('[SW] Service Worker v' + CACHE_VERSION + ' chargé (avec surveillance appels)');
