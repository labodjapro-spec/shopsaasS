package com.shopsa.dashboard;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.List;

/**
 * Service FCM pour ShopSa Dashboard.
 * - Background / killed : crée une notification système heads-up directement.
 * - Foreground : passe le message à Capacitor JS qui crée une LocalNotification
 *   (évite les doublons).
 */
public class ShopSaFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG          = "ShopSaFCM";
    private static final String CHANNEL_ID   = "shopsa_orders_v2";
    private static final String CHANNEL_NAME = "Nouvelles commandes";

    /** Retourne true si l'app est visible à l'écran (foreground) */
    private boolean isAppInForeground() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
        if (processes == null) return false;
        String pkg = getPackageName();
        for (ActivityManager.RunningAppProcessInfo info : processes) {
            if (info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                    && info.processName.equals(pkg)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "Message FCM reçu, foreground=" + isAppInForeground());

        String title = "ShopSa";
        String body  = "Nouvelle commande reçue";

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null)
                title = remoteMessage.getNotification().getTitle();
            if (remoteMessage.getNotification().getBody() != null)
                body  = remoteMessage.getNotification().getBody();
        }
        if (remoteMessage.getData().containsKey("title"))
            title = remoteMessage.getData().get("title");
        if (remoteMessage.getData().containsKey("body"))
            body  = remoteMessage.getData().get("body");

        if (isAppInForeground()) {
            // App ouverte → Capacitor JS crée une LocalNotification (heads-up propre)
            try {
                com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
                Log.d(TAG, "Foreground : délégué à Capacitor JS");
            } catch (Exception e) {
                // Capacitor non dispo → fallback notification système
                sendNotification(title, body, remoteMessage);
            }
        } else {
            // App fermée ou en arrière-plan → notification système directe
            sendNotification(title, body, remoteMessage);
            // Notifier aussi Capacitor (pour le badge)
            try {
                com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "Nouveau token FCM: " + token);
        try {
            com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.onNewToken(token);
        } catch (Exception ignored) {}
    }

    private void sendNotification(String title, String body, RemoteMessage remoteMessage) {
        NotificationManager notificationManager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Alertes commandes ShopSa");
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setLightColor(0xFF7C3AED);
            channel.setShowBadge(true);
            notificationManager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        String url = remoteMessage.getData().get("url");
        if (url != null) intent.putExtra("url", url);

        int flags = PendingIntent.FLAG_ONE_SHOT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            flags |= PendingIntent.FLAG_IMMUTABLE;

        int notifId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, notifId, intent, flags);

        String customer  = remoteMessage.getData().get("customer");
        String amount    = remoteMessage.getData().get("amount");
        String storeName = remoteMessage.getData().get("storeName");
        String bigText   = body;
        if (customer != null && amount != null) {
            bigText = "👤 " + customer + "\n💰 " + amount;
            if (storeName != null) bigText += "\n🏪 " + storeName;
        }

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder =
            new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFF7C3AED)                          // fond violet du rond
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
                .setAutoCancel(true)
                .setSound(soundUri)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setNumber(1)
                .setContentIntent(pendingIntent);

        notificationManager.notify(notifId, builder.build());
    }
}
