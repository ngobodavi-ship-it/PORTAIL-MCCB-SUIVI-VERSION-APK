// ═══════════════════════════════════════════════════════════════════
// SERVICE WORKER UNIQUE (FCM + Appels entrants) — VERSION CORRIGÉE
// ═══════════════════════════════════════════════════════════════════

// 🔥 IMPORT FIREBASE
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// 🔥 CONFIG FIREBASE (identique à index.html)
firebase.initializeApp({
  apiKey: "AIzaSyDg3Fydp5aBtYT8iuCKTZB981MYkHPamlA",
  authDomain: "portail-mccb-new.firebaseapp.com",
  projectId: "portail-mccb-new",
  storageBucket: "portail-mccb-new.firebasestorage.app",
  messagingSenderId: "65482272143",
  appId: "1:65482272143:web:d341598f18e8fd49086ffa"
});

// 🔥 INITIALISATION MESSAGING
const messaging = firebase.messaging();

console.log('[SW] ✅ Service Worker chargé v2');

// ═══════════════════════════════════════════════════════════════════
// 🔔 RÉCEPTION PUSH FCM (APP EN ARRIÈRE-PLAN OU FERMÉE)
// ═══════════════════════════════════════════════════════════════════
// IMPORTANT : on utilise onBackgroundMessage de Firebase, PAS addEventListener('push')
// car Firebase intercepte les push avant le listener natif
// ═══════════════════════════════════════════════════════════════════
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] 📩 Push FCM reçu en background:', payload);

  // Le payload peut contenir data (custom) et/ou notification (titre/corps)
  const data = payload.data || {};
  const callId = data.callId || '';
  const callerName = data.callerName || 'Appel entrant';
  const type = data.type || '';

  // 📞 SI C'EST UN APPEL ENTRANT
  if (type === 'appel_entrant' && callId) {
    const options = {
      body: callerName + ' vous appelle — Touchez pour répondre',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'call-' + callId,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [500, 300, 500, 300, 500, 300, 500],
      data: {
        callId: callId,
        callerName: callerName,
        type: type
      },
      actions: [
        { action: 'accept', title: '✅ Répondre' },
        { action: 'reject', title: '❌ Refuser' }
      ]
    };

    return self.registration.showNotification('📞 Appel vidéo entrant', options);
  }

  // 🔔 NOTIF CLASSIQUE (autres types)
  const title = (payload.notification && payload.notification.title) || data.title || 'MCCB';
  const body  = (payload.notification && payload.notification.body)  || data.body  || '';

  return self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  });
});

// ═══════════════════════════════════════════════════════════════════
// 👆 CLIC NOTIFICATION
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  const callId = data.callId || '';
  const action = event.action;

  // ❌ REFUSER
  if (action === 'reject') {
    console.log('[SW] ❌ Appel refusé');
    return;
  }

  // ✅ OUVRIR L'APP AVEC L'APPEL
  const url = '/?call=' + callId + '&autoanswer=1';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientsArr) {

      // Si une fenêtre MCCB est déjà ouverte → la focus + envoyer le callId
      for (let client of clientsArr) {
        if ('focus' in client) {
          client.postMessage({
            type: 'INCOMING_CALL',
            callId: callId,
            autoAnswer: true
          });
          return client.focus();
        }
      }

      // Sinon ouvrir l'app
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ═══════════════════════════════════════════════════════════════════
// 📨 MESSAGE DEPUIS LA PAGE
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('message', function(event) {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'SET_WA_AGENT') {
    self._waAgent = event.data.waAgent;
    console.log('[SW] WaAgent reçu:', self._waAgent);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ⚡ LIFECYCLE
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('install', function(event) {
  console.log('[SW] Install');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activate');
  event.waitUntil(self.clients.claim());
});
