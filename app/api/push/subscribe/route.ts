import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_DEVICES_PER_USER = 3

function allowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return [
      'fcm.googleapis.com',
      'push.services.mozilla.com',
      'web.push.apple.com',
      'wns.windows.com',
      'notify.windows.com',
    ].some(domain => host === domain || host.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

function hasOrderPermission(row: any) {
  const role = Array.isArray(row?.roles) ? row.roles[0] : row?.roles
  const permissions = Array.isArray(role?.permissions) ? role.permissions : []
  return permissions.includes('*') || permissions.includes('orders.read')
}

async function userCanReadOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const [{ data: memberships }, { data: ownedStores }] = await Promise.all([
    supabase
      .from('store_members')
      .select('store_id, roles(permissions)')
      .eq('user_id', userId),
    admin
      .from('stores')
      .select('id')
      .eq('owner_id', userId)
      .limit(1),
  ])
  if ((ownedStores ?? []).length > 0) return true
  return (memberships ?? []).some(hasOrderPermission)
}

async function pruneDevices(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: rows } = await admin
    .from('web_push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  const extraIds = (rows ?? []).slice(MAX_DEVICES_PER_USER).map((row: { id: string }) => row.id)
  if (extraIds.length) await admin.from('web_push_subscriptions').delete().in('id', extraIds)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const admin = createAdminClient()
    if (!(await userCanReadOrders(supabase, admin, user.id))) {
      return NextResponse.json({ error: 'Tu n’as pas accès aux commandes.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const subscription = body?.subscription
    const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint.trim() : ''
    const p256dh = typeof subscription?.keys?.p256dh === 'string' ? subscription.keys.p256dh.trim() : ''
    const auth = typeof subscription?.keys?.auth === 'string' ? subscription.keys.auth.trim() : ''
    const deviceId = typeof body?.deviceId === 'string' && body.deviceId.length <= 80 ? body.deviceId.trim() : null
    const userAgent = typeof body?.userAgent === 'string' ? body.userAgent.slice(0, 300) : null
    if (!allowedPushEndpoint(endpoint) || !p256dh || !auth) {
      return NextResponse.json({ error: 'Abonnement push invalide.' }, { status: 400 })
    }

    if (deviceId) {
      await admin.from('web_push_subscriptions').delete().eq('user_id', user.id).eq('device_id', deviceId)
    }

    const payload = {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      device_id: deviceId,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    }
    let { error } = await admin.from('web_push_subscriptions').upsert(payload, { onConflict: 'endpoint' })
    if (error) {
      await admin.from('web_push_subscriptions').delete().eq('user_id', user.id)
      const inserted = await admin.from('web_push_subscriptions').insert(payload)
      error = inserted.error
    }
    if (error) {
      console.error('[push/subscribe] save failed:', error.message)
      return NextResponse.json({ error: 'Impossible d’enregistrer cet appareil.' }, { status: 500 })
    }

    await pruneDevices(admin, user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[push/subscribe] error:', error)
    return NextResponse.json({ error: 'Erreur lors de l’activation des notifications.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : ''
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
    if (!allowedPushEndpoint(endpoint) && !deviceId) {
      return NextResponse.json({ error: 'Abonnement push invalide.' }, { status: 400 })
    }

    const admin = createAdminClient()
    let query = admin.from('web_push_subscriptions').delete().eq('user_id', user.id)
    if (allowedPushEndpoint(endpoint)) query = query.eq('endpoint', endpoint)
    else query = query.eq('device_id', deviceId)
    const { error } = await query
    if (error) return NextResponse.json({ error: 'Impossible de retirer cet appareil.' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[push/subscribe] delete failed:', error)
    return NextResponse.json({ error: 'Erreur lors du retrait de cet appareil.' }, { status: 500 })
  }
}
