package com.mccb.portail;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String callId = intent.getStringExtra("callId");

        CallNotificationHelper.cancelCall(context);

        if ("ACCEPT_CALL".equals(action)) {
            Intent callIntent = new Intent(context, IncomingCallActivity.class);
            callIntent.putExtra("callId", callId);
            callIntent.putExtra("callerName", "Media Contact");
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(callIntent);
        }
    }
}