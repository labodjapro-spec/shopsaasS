import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

// Version visible in the diagnostic so you can check that Supabase runs the latest code.
const FUNCTION_VERSION = 'push-order v3.0-fcm'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-hook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_DEVICES_PER_USER = 5 // augmenté pour couvrir web + app Android

type SubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  updated_at: string
}

type DeviceResult = {
  id: string
  service: string
  ok: boolean
  status?: number
  detail?: string
}

function json(body: unknown, status = 200) {
  return Response.json({ version: FUNCTION_VERSION, ...(body as object) }, { status, headers: corsHeaders })
}

function serviceName(endpoint: string) {
  if (endpoint.startsWith('fcm:')) return 'Android natif (FCM)'
  try {
    const host = new URL(endpoint).hostname
    if (host.includes('fcm.googleapis.com')) return 'Android / Chrome (FCM Web Push)'
    if (host.includes('mozilla.com')) return 'Firefox'
    if (host.includes('apple.com')) return 'iPhone / Safari'
    if (host.includes('windows.com')) return 'Windows / Edge'
    return host
  } catch {
    return 'inconnu'
  }
}

function limitDevices(rows: SubscriptionRow[]) {
  const perUserCount = new Map<string, number>()
  const unique = new Map<string, SubscriptionRow>()
  for (const row of rows) {
    const already = perUserCount.get(row.user_id) ?? 0
    if (already >= MAX_DEVICES_PER_USER) continue
    if (unique.has(row.endpoint)) continue
    unique.set(row.endpoint, row)
    perUserCount.set(row.user_id, already + 1)
  }
  return [...unique.values()]
}

/** Envoie via Web Push standard (Chrome, Firefox, Safari...) */
async function sendWebPush(
  applicationServer: webpush.ApplicationServer,
  row: SubscriptionRow,
  payload: string,
  topic: string,
): Promise<DeviceResult> {
  const service = serviceName(row.endpoint)
  try {
    const subscriber = applicationServer.subscribe({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    })
    await subscriber.pushTextMessage(payload, {
      urgency: webpush.Urgency.High,
      ttl: 60 * 60 * 24,
      topic,
    })
    return { id: row.id, service, ok: true, status: 201 }
  } catch (error) {
    if (error instanceof webpush.PushMessageError) {
      const status = error.response.status
      const detail = (await error.response.text().catch(() => '')).slice(0, 300)
      console.error('[push-order] web push refused:', status, detail)
      return { id: row.id, service, ok: false, status, detail }
    }
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[push-order] web push failed:', detail)
    return { id: row.id, service, ok: false, detail }
  }
}

/** Envoie via FCM HTTP v1 API (tokens fcm:<token> stockés par l'APK Capacitor) */
async function sendFCM(
  fcmToken: string,
  row: SubscriptionRow,
  title: string,
  body: string,
  data: Record<string, string>,
  fcmServiceAccountJson: string,
  projectId: string,
): Promise<DeviceResult> {
  const service = 'Android natif (FCM)'
  try {
    // Obtenir un access token OAuth2 depuis le service account
    const serviceAccount = JSON.parse(fcmServiceAccountJson)
    const now = Math.floor(Date.now() / 1000)
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claimSet = btoa(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }))

    // Signer le JWT avec la clé privée RSA
    const pemKey = serviceAccount.private_key
    const keyData = pemKey
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\n/g, '')
    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signingInput = `${header}.${claimSet}`
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput),
    )
    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`

    // Échange le JWT contre un access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return { id: row.id, service, ok: false, detail: `OAuth error: ${JSON.stringify(tokenData)}` }
    }

    // Envoyer la notification FCM
    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            data,
            android: {
              priority: 'high',
              notification: {
                channel_id: 'shopsa_orders',
                sound: 'default',
                default_vibrate_timings: true,
                notification_priority: 'PRIORITY_HIGH',
                visibility: 'PUBLIC',
              },
            },
          },
        }),
      },
    )
    const fcmData = await fcmRes.json()
    if (!fcmRes.ok) {
      return { id: row.id, service, ok: false, status: fcmRes.status, detail: JSON.stringify(fcmData) }
    }
    return { id: row.id, service, ok: true, status: 200 }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[push-order] FCM send failed:', detail)
    return { id: row.id, service, ok: false, detail }
  }
}

async function sendToAll(
  applicationServer: webpush.ApplicationServer,
  rows: SubscriptionRow[],
  payload: string,
  topic: string,
  notifTitle: string,
  notifBody: string,
  notifData: Record<string, string>,
  fcmServiceAccountJson: string,
  projectId: string,
) {
  const results: DeviceResult[] = []
  const expiredIds: string[] = []

  await Promise.all(rows.map(async (row) => {
    // Token FCM natif (APK Capacitor) — format "fcm:<token>"
    if (row.endpoint.startsWith('fcm:') && row.p256dh === 'fcm') {
      const fcmToken = row.endpoint.slice(4)
      const result = await sendFCM(fcmToken, row, notifTitle, notifBody, notifData, fcmServiceAccountJson, projectId)
      results.push(result)
      return
    }

    // Web Push standard (navigateur)
    const result = await sendWebPush(applicationServer, row, payload, topic)
    results.push(result)
    if (result.status === 404 || result.status === 410) expiredIds.push(row.id)
  }))

  return { results, expiredIds }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const expectedSecret = Deno.env.get('PUSH_HOOK_SECRET')?.trim()
  const receivedSecret = request.headers.get('x-push-hook-secret')?.trim()
  if (!expectedSecret) return json({ error: 'PUSH_HOOK_SECRET missing in Supabase secrets.', code: 'missing_hook_secret' }, 500)
  if (receivedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized', code: 'bad_hook_secret' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const vapidJson = Deno.env.get('VAPID_KEYS_JSON')?.trim()
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')?.trim()
  // Service account Firebase (optionnel — seulement nécessaire si des APKs sont enregistrés)
  const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')?.trim() ?? ''
  const fcmProjectId = Deno.env.get('FCM_PROJECT_ID')?.trim() ?? 'shopsa-f92d6'

  if (!supabaseUrl || !serviceRoleKey || !vapidJson || !vapidSubject) {
    return json({
      error: 'Push function secrets are not configured.',
      code: 'missing_vapid_secrets',
      missing: [
        !vapidJson && 'VAPID_KEYS_JSON',
        !vapidSubject && 'VAPID_SUBJECT',
      ].filter(Boolean),
    }, 500)
  }

  let applicationServer: webpush.ApplicationServer
  let vapidPublicKey = ''
  try {
    const exported = JSON.parse(vapidJson) as webpush.ExportedVapidKeys
    const keys = await webpush.importVapidKeys(exported)
    applicationServer = await webpush.ApplicationServer.new({ contactInformation: vapidSubject, vapidKeys: keys })
    vapidPublicKey = (await webpush.exportApplicationServerKey(keys)).trim()
  } catch (error) {
    return json({
      error: 'VAPID_KEYS_JSON is invalid. Copy the full line from PUSH-VALUES.txt again.',
      code: 'invalid_vapid_json',
      detail: error instanceof Error ? error.message : String(error),
    }, 500)
  }

  const body = await request.json().catch(() => null)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Test mode ──────────────────────────────────────────────────────────
  if (body?.mode === 'test') {
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    if (!userId) return json({ error: 'userId is required.' }, 400)

    const { data: rows, error } = await supabase
      .from('web_push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) return json({ error: 'Could not load push subscriptions.', code: 'db_error', detail: error.message }, 500)

    const devices = limitDevices((rows ?? []) as SubscriptionRow[])
    if (!devices.length) return json({ sent: 0, devices: [], vapidPublicKey })

    const payload = JSON.stringify({
      title: 'Test ShopSa ✅',
      body: 'Notifications natives actives sur cet appareil.',
      url: '/dashboard/settings#application',
      tag: `push-test-${Date.now()}`,
      test: true,
    })
    const { results, expiredIds } = await sendToAll(
      applicationServer, devices, payload, 'push-test',
      'Test ShopSa ✅', 'Notifications natives actives sur cet appareil.',
      { test: 'true', url: '/dashboard/settings#application' },
      fcmServiceAccountJson, fcmProjectId,
    )
    if (expiredIds.length) await supabase.from('web_push_subscriptions').delete().in('id', expiredIds)
    return json({ sent: results.filter(r => r.ok).length, expired: expiredIds.length, devices: results, vapidPublicKey })
  }

  // ── Normal mode ────────────────────────────────────────────────────────
  const storeId = typeof body?.storeId === 'string' ? body.storeId : ''
  const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
  const isReminder = body?.kind === 'scheduled_reminder'
  const extraNote = typeof body?.note === 'string' ? body.note.trim() : ''
  if (!storeId || !orderId) return json({ error: 'storeId and orderId are required.' }, 400)

  if (!isReminder) {
    const { error: dispatchError } = await supabase
      .from('order_push_dispatches')
      .insert({ order_id: orderId })
    if (dispatchError) {
      if (dispatchError.code === '23505') return json({ sent: 0, skipped: true })
      console.warn('[push-order] dispatch lock failed:', dispatchError.message)
    }
  }

  const [{ data: order, error: orderError }, { data: store }, { data: members, error: memberError }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, store_id, order_number, total, customer_name, customer_city, customer_address, markets(currency)')
      .eq('id', orderId)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase.from('stores').select('name, owner_id').eq('id', storeId).maybeSingle(),
    supabase
      .from('store_members')
      .select('user_id, roles(permissions)')
      .eq('store_id', storeId),
  ])

  if (orderError || !order) return json({ error: 'Order not found.' }, 404)
  if (memberError) return json({ error: 'Could not resolve order viewers.' }, 500)

  const memberUserIds = (members ?? []).flatMap((member: any) => {
    const role = Array.isArray(member.roles) ? member.roles[0] : member.roles
    const permissions = Array.isArray(role?.permissions) ? role.permissions : []
    return permissions.includes('*') || permissions.includes('orders.read') || permissions.includes('orders.ship')
      ? [member.user_id]
      : []
  })
  const eligibleUserIds = [...new Set([
    ...memberUserIds,
    ...(store?.owner_id ? [store.owner_id] : []),
  ])]
  if (!eligibleUserIds.length) return json({ sent: 0, reason: 'no_eligible_members' })

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('web_push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, updated_at')
    .in('user_id', eligibleUserIds)
    .order('updated_at', { ascending: false })
  if (subscriptionError) return json({ error: 'Could not load push subscriptions.' }, 500)
  if (!subscriptions?.length) return json({ sent: 0, reason: 'no_subscriptions' })

  const currency = String((order.markets as any)?.currency ?? '')
  const total = Number(order.total) || 0
  const storeName = String(store?.name ?? 'Boutique')
  const customer = String(order.customer_name || 'Client').trim()
  const amount = `${total.toLocaleString('fr-FR')} ${currency}`.trim()
  const locationText = [order.customer_city, order.customer_address].filter(Boolean).join(' · ')

  const notifTitle = isReminder ? '🚚 Livraison programmée maintenant !' : 'Nouvelle commande'
  const notifBody = isReminder
    ? `${customer} · ${order.order_number} (${amount})\n${locationText ? `📍 ${locationText}\n` : ''}${extraNote ? `📝 ${extraNote}` : storeName}`.trim()
    : `${customer} · ${order.order_number} · ${amount}`

  const notifData: Record<string, string> = {
    orderId: order.id,
    orderNumber: order.order_number,
    customer,
    amount,
    currency,
    storeName,
    url: `/dashboard/orders/${order.id}`,
    ...(isReminder ? { reminder: 'true', note: extraNote } : {}),
  }

  const payload = JSON.stringify(
    isReminder
      ? {
          title: notifTitle,
          body: notifBody,
          url: `/dashboard/orders/${order.id}`,
          tag: `delivery-reminder-${order.id}`,
          ...notifData,
          reminder: true,
          total,
        }
      : {
          title: notifTitle,
          body: notifBody,
          url: `/dashboard/orders/${order.id}`,
          tag: `order-${order.id}`,
          ...notifData,
          total,
        },
  )

  const topic = (isReminder ? `rem-${order.id}` : `order-${order.id}`).slice(0, 32)
  const { results, expiredIds } = await sendToAll(
    applicationServer,
    limitDevices(subscriptions as SubscriptionRow[]),
    payload,
    topic,
    notifTitle,
    notifBody,
    notifData,
    fcmServiceAccountJson,
    fcmProjectId,
  )
  if (expiredIds.length) await supabase.from('web_push_subscriptions').delete().in('id', expiredIds)

  return json({ sent: results.filter(r => r.ok).length, expired: expiredIds.length, devices: results })
})
