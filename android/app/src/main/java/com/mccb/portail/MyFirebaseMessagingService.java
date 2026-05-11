package com.mccb.portail;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FCM_MCCB";

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "New FCM token: " + token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        Log.d(TAG, "Data: " + data.toString());

        String type = data.get("type");
        String callId = data.get("callId");
        String callerName = data.get("callerName");

        if ("appel_entrant".equals(type) && callId != null) {

            // 1. Reveiller l ecran (WakeLock)
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "MCCB:CallWakeLock"
                );
                wl.acquire(15000);
                Log.d(TAG, "WakeLock acquired");
            } catch (Exception e) {
                Log.e(TAG, "WakeLock error: " + e.getMessage());
            }

            // 2. Lancer IncomingCallActivity en plein ecran
            try {
                Intent intent = new Intent(this, IncomingCallActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                intent.putExtra("callId", callId);
                intent.putExtra("callerName", callerName != null ? callerName : "Media Contact");
                startActivity(intent);
                Log.d(TAG, "IncomingCallActivity started");
            } catch (Exception e) {
                Log.e(TAG, "Activity launch error: " + e.getMessage());
            }

            // 3. Notification CALL_STYLE backup
            try {
                CallNotificationHelper.showIncomingCall(
                    this,
                    callId,
                    callerName != null ? callerName : "Media Contact"
                );
                Log.d(TAG, "Notification shown");
            } catch (Exception e) {
                Log.e(TAG, "Notification error: " + e.getMessage());
            }
        }
    }
}
