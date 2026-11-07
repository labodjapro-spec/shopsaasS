package com.shopsa.dashboard;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Service FCM pour ShopSa Dashboard.
 * Crée une notification système (pastille + son + vibration) dans TOUS les cas :
 * - App ouverte (foreground)
 * - App en arrière-plan (background)
 * - App fermée (killed)
 *
 * Remplace le MessagingService de Capacitor qui ne crée pas de notification système.
 */
public class ShopSaFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG          = "ShopSaFCM";
    private static final String CHANNEL_ID   = "shopsa_orders";
    private static final String CHANNEL_NAME = "Nouvelles commandes";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "Message FCM reçu, data=" + remoteMessage.getData());

        String title = "ShopSa";
        String body  = "Nouvelle commande reçue";

        // 1. Lire depuis le champ notification (messages notification+data)
        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null)
                title = remoteMessage.getNotification().getTitle();
            if (remoteMessage.getNotification().getBody() != null)
                body  = remoteMessage.getNotification().getBody();
        }
        // 2. Override avec les données data (messages data-only ou champs supplémentaires)
        if (remoteMessage.getData().containsKey("title"))
            title = remoteMessage.getData().get("title");
        if (remoteMessage.getData().containsKey("body"))
            body  = remoteMessage.getData().get("body");

        // 3. Toujours créer une notification système (pastille + son)
        sendNotification(title, body, remoteMessage);

        // 4. Passer aussi au plugin Capacitor pour le JavaScript (si l'app est ouverte)
        try {
            com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Exception e) {
            Log.d(TAG, "Plugin Capacitor non actif (app fermée), OK");
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "Nouveau token FCM: " + token);
        // Passer au plugin Capacitor pour qu'il mette à jour le token côté JS
        try {
            com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.onNewToken(token);
        } catch (Exception e) {
            Log.d(TAG, "Plugin Capacitor non actif, le token sera envoyé au prochain démarrage");
        }
    }

    private void sendNotification(String title, String body, RemoteMessage remoteMessage) {
        // Créer le canal (requis Android 8+)
        NotificationManager notificationManager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Alertes de nouvelles commandes ShopSa");
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setShowBadge(true);
            notificationManager.createNotificationChannel(channel);
        }

        // Intent pour ouvrir l'app quand on clique sur la notification
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        // Passer l'URL de la commande si disponible
        String url = remoteMessage.getData().get("url");
        if (url != null) {
            intent.putExtra("url", url);
        }

        int flags = PendingIntent.FLAG_ONE_SHOT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // ID unique par notification pour ne pas écraser les précédentes
        int notifId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, notifId, intent, flags
        );

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        // Construire un texte enrichi si on a les infos de commande
        String customer = remoteMessage.getData().get("customer");
        String amount   = remoteMessage.getData().get("amount");
        String bigText  = body;
        if (customer != null && amount != null) {
            bigText = "👤 " + customer + "\n💰 " + amount;
            String storeName = remoteMessage.getData().get("storeName");
            if (storeName != null) bigText += "\n🏪 " + storeName;
        }

        NotificationCompat.Builder notificationBuilder =
            new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setNumber(1) // pastille avec chiffre
                .setContentIntent(pendingIntent);

        Log.d(TAG, "Affichage notification système: " + title + " - " + body);
        notificationManager.notify(notifId, notificationBuilder.build());
    }
}
