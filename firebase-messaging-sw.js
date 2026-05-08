// ═══════════════════════════════════════════════════════════════════
//  firebase-messaging-sw.js
//  Service Worker pour Firebase Cloud Messaging (FCM)
//  Doit être placé À LA RACINE du domaine (ex: https://exemple.com/firebase-messaging-sw.js)
//  Servi avec Content-Type: application/javascript
// ═══════════════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ⚠️ Cette config DOIT être identique à celle d'index.html
firebase.initializeApp({
  apiKey:            "AIzaSyDg3Fydp5aBtYT8iuCKTZB981MYkHPamlA",
  authDomain:        "portail-mccb-new.firebaseapp.com",
  databaseURL:       "https://portail-mccb-new-default-rtdb.firebaseio.com",
  projectId:         "portail-mccb-new",
  storageBucket:     "portail-mccb-new.firebasestorage.app",
  messagingSenderId: "65482272143",
  appId:             "1:65482272143:web:d341598f18e8fd49086ffa"
});

const messaging = firebase.messaging();

// ═══════════════════════════════════════════════════════════════════
//  RÉCEPTION D'UN PUSH QUAND L'APP EST FERMÉE / EN ARRIÈRE-PLAN
// ═══════════════════════════════════════════════════════════════════
// Quand l'app est ouverte (foreground), c'est onMessage() dans index.html
// qui prend le relais. Ici on gère seulement le background.
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW-FCM] 📩 Push reçu en background:', payload);

  const data = payload.data || {};
  const isAppel = data.type === 'appel_entrant';

  const title = (payload.notification && payload.notification.title)
              || (isAppel ? '📞 Appel entrant' : 'Notification');

  const body  = (payload.notification && payload.notification.body)
              || (isAppel ? (data.callerName || 'Media Contact') + ' vous appelle'
                          : '');

  const options = {
    body: body,
    icon: '/icon-192.png',           // adapte au chemin réel de ton icône
    badge: '/icon-192.png',
    tag: data.callId || 'mccb-notif', // un seul appel à la fois (évite empilement)
    renotify: true,
    requireInteraction: isAppel,      // l'appel reste affiché jusqu'à interaction
    vibrate: isAppel ? [300, 100, 300, 100, 300] : [200],
    data: data                        // transmis au handler de clic ci-dessous
  };

  return self.registration.showNotification(title, options);
});

// ═══════════════════════════════════════════════════════════════════
//  CLIC SUR LA NOTIFICATION → OUVRIR L'APP / FOCUS SUR L'ONGLET
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};

  // URL de l'app — adapte si ton portail vit sur un chemin spécifique
  const targetUrl = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Si un onglet de l'app est déjà ouvert → focus + on lui passe le callId
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.postMessage({
            type: 'FCM_NOTIFICATION_CLICK',
            callId: data.callId || null,
            callerName: data.callerName || null,
            payload: data
          });
          return client.focus();
        }
      }
      // Sinon → ouvre une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ═══════════════════════════════════════════════════════════════════
//  ACTIVATION IMMÉDIATE (utile lors d'un déploiement de nouvelle version)
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('install', function(event) {
  self.skipWaiting();
});
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
