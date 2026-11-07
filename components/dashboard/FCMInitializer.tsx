'use client'

/**
 * FCMInitializer — composant client léger qui active les notifications FCM
 * uniquement quand l'app tourne dans Capacitor (APK Android).
 * Sur le web normal (Vercel), il ne fait rien du tout.
 */
import { useFCMPush } from '@/hooks/useFCMPush'

export default function FCMInitializer() {
  useFCMPush()
  return null // aucun rendu visuel
}
