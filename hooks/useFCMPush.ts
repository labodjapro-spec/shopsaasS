'use client'

/**
 * Hook useFCMPush
 * Active les notifications FCM natives quand l'app tourne dans Capacitor (APK Android).
 * En mode navigateur classique (Vercel/web), ce hook ne fait rien — le Web Push existant prend le relai.
 */

import { useEffect } from 'react'

// Vérifie si on est dans Capacitor (app Android installée)
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
}

export function useFCMPush() {
  useEffect(() => {
    if (!isCapacitor()) return // On est sur le web — pas besoin de FCM ici

    let cancelled = false

    async function setupFCM() {
      try {
        // Import dynamique — uniquement chargé dans l'APK Capacitor
        const { PushNotifications } = await import('@capacitor/push-notifications')

        // Demande la permission Android 13+
        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') {
          console.warn('[FCM] Permission refusée')
          return
        }

        // Enregistre l'appareil auprès de Firebase
        await PushNotifications.register()

        // Écoute le token FCM généré
        PushNotifications.addListener('registration', async (token) => {
          if (cancelled) return
          console.log('[FCM] Token reçu:', token.value)

          // Génère un deviceId stable depuis le token
          const deviceId = `fcm-${token.value.slice(-16)}`

          try {
            await fetch('/api/push/fcm-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fcmToken: token.value,
                deviceId,
                platform: 'android',
              }),
            })
            console.log('[FCM] Token enregistré sur le serveur ✅')
          } catch (err) {
            console.error('[FCM] Erreur enregistrement token:', err)
          }
        })

        // Erreur d'enregistrement
        PushNotifications.addListener('registrationError', (err) => {
          console.error('[FCM] Erreur registration:', err)
        })

        // Notification reçue quand l'app est OUVERTE (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[FCM] Notification reçue (foreground):', notification)
          // Le toast in-app existant s'affiche automatiquement via Supabase Realtime
        })

        // Notification cliquée depuis le centre de notifications
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[FCM] Notification cliquée:', action)
          // Ouvre la page des commandes si dispo
          if (typeof window !== 'undefined') {
            window.location.href = '/dashboard/orders'
          }
        })
      } catch (err) {
        console.error('[FCM] Setup échoué:', err)
      }
    }

    void setupFCM()
    return () => { cancelled = true }
  }, [])
}
