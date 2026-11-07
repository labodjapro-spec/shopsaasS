import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/push/fcm-subscribe
 * Enregistre ou met à jour le token FCM d'un appareil Android/iOS.
 * Appelé par l'app Capacitor au démarrage.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const fcmToken = typeof body?.fcmToken === 'string' ? body.fcmToken.trim() : ''
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.slice(0, 80) : null
    const platform = typeof body?.platform === 'string' ? body.platform : 'android'

    if (!fcmToken || fcmToken.length < 10) {
      return NextResponse.json({ error: 'Token FCM invalide.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Upsert dans la table web_push_subscriptions avec un marqueur FCM
    // On réutilise la même table mais avec endpoint = "fcm:<token>"
    const endpoint = `fcm:${fcmToken}`
    const payload = {
      user_id: user.id,
      endpoint,
      p256dh: 'fcm',      // marqueur pour distinguer FCM des abonnements Web Push
      auth: 'fcm',
      device_id: deviceId,
      user_agent: platform,
      updated_at: new Date().toISOString(),
    }

    // Supprimer l'ancien token de cet appareil si deviceId connu
    if (deviceId) {
      await admin.from('web_push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
        .eq('p256dh', 'fcm')
    }

    const { error } = await admin.from('web_push_subscriptions').upsert(payload, { onConflict: 'endpoint' })
    if (error) {
      console.error('[push/fcm-subscribe] save failed:', error.message)
      return NextResponse.json({ error: 'Impossible d\'enregistrer cet appareil.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/fcm-subscribe] error:', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
