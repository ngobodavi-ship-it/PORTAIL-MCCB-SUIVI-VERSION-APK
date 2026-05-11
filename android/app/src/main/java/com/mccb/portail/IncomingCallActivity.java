package com.mccb.portail;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class IncomingCallActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Réveiller le téléphone et passer par-dessus le verrouillage
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        setContentView(R.layout.activity_incoming_call);

        String callId = getIntent().getStringExtra("callId");
        String callerName = getIntent().getStringExtra("callerName");

        TextView callerView = findViewById(R.id.caller_name);
        callerView.setText(callerName != null ? callerName : "Media Contact");

        Button btnAccept = findViewById(R.id.btn_accept);
        Button btnReject = findViewById(R.id.btn_reject);

        btnAccept.setOnClickListener(v -> {
            CallNotificationHelper.cancelCall(this);
            String url = "https://ngobodavi-ship-it.github.io/PORTAIL-MCCB-SUIVI-VERSION-APK/?call=" + callId + "&autoanswer=1";
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.putExtra("url", url);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(mainIntent);
            finish();
        });

        btnReject.setOnClickListener(v -> {
            CallNotificationHelper.cancelCall(this);
            finish();
        });
    }
}