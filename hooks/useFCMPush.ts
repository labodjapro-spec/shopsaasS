'use client'

/**
 * Hook useFCMPush
 * Active les notifications FCM natives quand l'app tourne dans Capacitor (APK Android).
 * En mode navigateur classique (Vercel/web), ce hook ne fait rien — le Web Push existant prend le relai.
 *
 * Foreground : crée une notification locale via @capacitor/local-notifications
 *              pour afficher la bannière heads-up même app ouverte.
 * Background/killed : FCM affiche automatiquement la notification système.
 */

import { useEffect } from 'react'

function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
}

export function useFCMPush() {
  useEffect(() => {
    if (!isCapacitor()) return

    let cancelled = false

    async function setupFCM() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const { LocalNotifications } = await import('@capacitor/local-notifications')

        // Demander la permission pour les notifications locales aussi
        await LocalNotifications.requestPermissions()

        // Créer le canal de notification haute priorité (Android 8+)
        await LocalNotifications.createChannel({
          id: 'shopsa_orders_v2',
          name: 'Nouvelles commandes',
          description: 'Alertes commandes ShopSa — priorité haute',
          importance: 5, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'default',
          vibration: true,
        })

        // Permission push
        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') {
          console.warn('[FCM] Permission refusée')
          return
        }

        await PushNotifications.register()

        // Token FCM → envoyer au serveur
        PushNotifications.addListener('registration', async (token) => {
          if (cancelled) return
          const deviceId = `fcm-${token.value.slice(-16)}`
          try {
            await fetch('/api/push/fcm-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fcmToken: token.value, deviceId, platform: 'android' }),
            })
          } catch (err) {
            console.error('[FCM] Erreur enregistrement token:', err)
          }
        })

        PushNotifications.addListener('registrationError', (err) => {
          console.error('[FCM] Erreur registration:', err)
        })

        // ── FOREGROUND : afficher une vraie notification locale heads-up ──
        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          if (cancelled) return
          const title = notification.title || 'Nouvelle commande'
          const body = notification.body || ''
          const data = (notification.data as Record<string, string>) || {}

          // Construire un texte enrichi
          const customer = data.customer || ''
          const amount = data.amount || ''
          const bigBody = customer && amount
            ? `👤 ${customer}\n💰 ${amount}`
            : body

          try {
            await LocalNotifications.schedule({
              notifications: [{
                id: Math.floor(Math.random() * 2147483647),
                title,
                body: bigBody,
                channelId: 'shopsa_orders_v2',
                sound: 'default',
                actionTypeId: '',
                extra: data,
                // Afficher immédiatement
                schedule: { at: new Date(Date.now() + 100) },
              }],
            })
          } catch (e) {
            console.error('[FCM] LocalNotification failed:', e)
          }
        })

        // Clic sur la notification → ouvrir la commande
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const url = (action.notification.data as any)?.url
          if (url && typeof window !== 'undefined') {
            window.location.href = url
          } else if (typeof window !== 'undefined') {
            window.location.href = '/dashboard/orders'
          }
        })

        // Clic sur notification locale
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          const url = action.notification.extra?.url
          if (url && typeof window !== 'undefined') {
            window.location.href = url
          } else if (typeof window !== 'undefined') {
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
