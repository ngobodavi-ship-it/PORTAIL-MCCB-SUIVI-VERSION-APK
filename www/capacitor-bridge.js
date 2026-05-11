// ═══════════════════════════════════════════════════════════════════
// CAPACITOR BRIDGE V3 — Intercepte le moment où Firebase reçoit un waAgent
// ═══════════════════════════════════════════════════════════════════
(function() {

  function afficherDebug(message, couleur) {
    let badge = document.getElementById('capacitor-debug-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'capacitor-debug-badge';
      badge.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;padding:8px 12px;font-size:11px;font-family:monospace;color:#fff;text-align:center;font-weight:bold;';
      document.body.appendChild(badge);
    }
    badge.style.background = couleur;
    badge.textContent = message;
  }

  const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  if (!isCapacitor) {
    console.log('[BRIDGE] Mode web/PWA — pas d\'action');
    return;
  }

  console.log('[BRIDGE V3] 🔥 Mode natif Android');

  let _tokenNatif = null;
  let _waAgentDetecte = null;

  // ─── Sauvegarder dans Firebase quand on a token + waAgent ───
  async function sauverTokenNatif() {
    if (!_tokenNatif || !_waAgentDetecte) return;

    try {
      const waClean = String(_waAgentDetecte).replace(/[^0-9]/g, '');
      if (!waClean) return;

      // Utiliser fetch direct vers Firebase Realtime Database REST API
      const dbUrl = 'https://portail-mccb-new-default-rtdb.firebaseio.com/fcm_tokens/' + waClean + '.json';
      const response = await fetch(dbUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: _tokenNatif,
          wa_agent: _waAgentDetecte,
          type: 'capacitor_native',
          updated_at: Date.now()
        })
      });

      if (response.ok) {
        afficherDebug('✅ TOKEN NATIF SAUVÉ pour ' + waClean + ' (' + _tokenNatif.substring(0, 15) + '...)', '#2E7D32');
        console.log('[BRIDGE V3] ✅ Token natif sauvé Firebase pour', waClean);
      } else {
        afficherDebug('❌ Erreur Firebase: ' + response.status, '#D32F2F');
      }
    } catch (e) {
      afficherDebug('❌ Sauvegarde: ' + e.message, '#D32F2F');
      console.error('[BRIDGE V3]', e);
    }
  }

  // ─── Hook : surveiller les inputs téléphone du formulaire ───
  function surveillerFormulaire() {
    document.addEventListener('input', function(e) {
      const target = e.target;
      if (!target || !target.value) return;

      const val = String(target.value).replace(/[^0-9]/g, '');

      // Numéro CG/africain typique : 8-12 chiffres
      if (val.length >= 8 && val.length <= 13) {
        // Vérifier si c'est probablement un numéro WhatsApp
        const placeholder = (target.placeholder || '').toLowerCase();
        const name = (target.name || '').toLowerCase();
        const id = (target.id || '').toLowerCase();
        const tout = placeholder + ' ' + name + ' ' + id;

        if (tout.includes('whats') || tout.includes('phone') || tout.includes('tel') || tout.includes('agent') || tout.includes('numero') || tout.includes('numero')) {
          if (val !== _waAgentDetecte) {
            _waAgentDetecte = val;
            console.log('[BRIDGE V3] 📱 waAgent détecté via formulaire:', val);
            afficherDebug('📱 waAgent détecté: ' + val + ' (sauvegarde...)', '#1976D2');
            sauverTokenNatif();
          }
        }
      }
    });
  }

  // ─── Hook : intercepter window.envoyerNotifAppelFCM (côté MC) ───
  function hookerEnvoyerNotif() {
    const original = window.envoyerNotifAppelFCM;
    if (typeof original !== 'function') return false;

    window.envoyerNotifAppelFCM = function(waAgent, callerName, dossierId) {
      console.log('[BRIDGE V3] 🎣 envoyerNotifAppelFCM intercepté, waAgent:', waAgent);
      _waAgentDetecte = waAgent;
      sauverTokenNatif();
      return original.apply(this, arguments);
    };
    return true;
  }

  // ─── Démarrage ───
  document.addEventListener('DOMContentLoaded', async function() {
    afficherDebug('🔵 BRIDGE V3: Démarrage...', '#1976D2');

    try {
      await new Promise(r => setTimeout(r, 1000));

      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      if (!PushNotifications) {
        afficherDebug('❌ Plugin PushNotifications introuvable', '#D32F2F');
        return;
      }

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') {
        afficherDebug('❌ Permission refusée', '#D32F2F');
        return;
      }

      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        _tokenNatif = token.value;
        console.log('[BRIDGE V3] ✅ Token natif:', _tokenNatif.substring(0, 25));
        afficherDebug('🟢 TOKEN NATIF reçu (saisie ton numéro WhatsApp...)', '#388E3C');
        window._fcmToken = _tokenNatif;

        // Activer la surveillance du formulaire
        surveillerFormulaire();

        // Tenter de hooker la fonction MC après un délai
        setTimeout(() => hookerEnvoyerNotif(), 2000);
      });

      PushNotifications.addListener('registrationError', (error) => {
        afficherDebug('❌ Erreur registration: ' + JSON.stringify(error), '#D32F2F');
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[BRIDGE V3] 📩 Notif reçue:', notification);
        const data = notification.data || {};
        if (data.type === 'appel_entrant' && data.callId) {
          window.dispatchEvent(new CustomEvent('appel_entrant_natif', { detail: data }));
        }
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data || {};
        if (data.type === 'appel_entrant' && data.callId) {
          window.location.href = '/?call=' + data.callId + '&autoanswer=1';
        }
      });

    } catch (e) {
      afficherDebug('❌ Erreur: ' + e.message, '#D32F2F');
    }
  });

})();