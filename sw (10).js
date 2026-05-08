// ═══════════════════════════════════════════════════════════════════
// SERVICE WORKER (FCM + Appels) — VERSION GITHUB PAGES
// Hébergé sur : ngobodavi-ship-it.github.io/PORTAIL-MCCB-SUIVI-VERSION-APK/
// ═══════════════════════════════════════════════════════════════════

// Base path GitHub Pages
const BASE_PATH = '/PORTAIL-MCCB-SUIVI-VERSION-APK';

// 🔥 IMPORT FIREBASE
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// 🔥 CONFIG FIREBASE
firebase.initializeApp({
  apiKey: "AIzaSyDg3Fydp5aBtYT8iuCKTZB981MYkHPamlA",
  authDomain: "portail-mccb-new.firebaseapp.com",
  projectId: "portail-mccb-new",
  storageBucket: "portail-mccb-new.firebasestorage.app",
  messagingSenderId: "65482272143",
  appId: "1:65482272143:web:d341598f18e8fd49086ffa"
});

const messaging = firebase.messaging();

console.log('[SW] ✅ Service Worker chargé v3 (GitHub Pages)');

// ═══════════════════════════════════════════════════════════════════
// 🔔 RÉCEPTION PUSH FCM EN BACKGROUND
// ═══════════════════════════════════════════════════════════════════
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] 📩 Push reçu en background:', payload);

  const data = payload.data || {};
  const callId = data.callId || '';
  const callerName = data.callerName || 'Appel entrant';
  const type = data.type || '';

  // 📞 SI C'EST UN APPEL ENTRANT
  if (type === 'appel_entrant' && callId) {
    const options = {
      body: callerName + ' vous appelle — Touchez pour répondre',
      icon: BASE_PATH + '/icon-192.png',
      badge: BASE_PATH + '/icon-192.png',
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

  // 🔔 NOTIF CLASSIQUE
  const title = (payload.notification && payload.notification.title) || data.title || 'MCCB';
  const body  = (payload.notification && payload.notification.body)  || data.body  || '';

  return self.registration.showNotification(title, {
    body: body,
    icon: BASE_PATH + '/icon-192.png',
    badge: BASE_PATH + '/icon-192.png'
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

  if (action === 'reject') {
    console.log('[SW] ❌ Appel refusé');
    return;
  }

  // ⚠️ URL avec le bon path GitHub Pages
  const url = BASE_PATH + '/?call=' + callId + '&autoanswer=1';

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
