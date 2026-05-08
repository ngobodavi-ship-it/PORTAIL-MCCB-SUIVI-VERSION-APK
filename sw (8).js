// ═══════════════════════════════════════════════════════════════════
// SERVICE WORKER UNIQUE (FCM + Appels entrants)
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

console.log('[SW] ✅ Service Worker chargé');

// ═══════════════════════════════════════════════════════════════════
// 🔔 RÉCEPTION PUSH (APP FERMÉE)
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('push', function(event) {
  console.log('[SW] 🔔 Push reçu');

  let data = {};

  try {
    data = event.data.json();
  } catch (e) {
    console.log('[SW] Erreur parsing data');
  }

  const payload = data.data || data;

  const callId = payload.callId || '';
  const callerName = payload.callerName || 'Appel entrant';
  const type = payload.type || '';

  // 📞 SI C'EST UN APPEL
  if (type === 'appel_entrant' && callId) {

    const options = {
      body: callerName + " vous appelle",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'call-' + callId,
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 300, 500, 300, 500],
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

    event.waitUntil(
      self.registration.showNotification('📞 Appel vidéo entrant', options)
    );

    return;
  }

  // 🔔 NOTIF CLASSIQUE
  if (payload.title) {
    event.waitUntil(
      self.registration.showNotification(payload.title, {
        body: payload.body || '',
        icon: '/icon-192.png'
      })
    );
  }
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

  // ✅ OUVRIR LA PAGE APPEL.HTML AVEC L'APPEL
  const url = '/appel.html?call=' + callId + '&autoanswer=1';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientsArr) {

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

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ═══════════════════════════════════════════════════════════════════
// ⚡ ACTIVER DIRECTEMENT
// ═══════════════════════════════════════════════════════════════════
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
