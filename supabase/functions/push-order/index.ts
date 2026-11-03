import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

// Version visible in the diagnostic so you can check that Supabase runs the latest code.
const FUNCTION_VERSION = 'push-order v2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-hook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_DEVICES_PER_USER = 3

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
  try {
    const host = new URL(endpoint).hostname
    if (host.includes('fcm.googleapis.com')) return 'Android / Chrome (FCM)'
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

async function sendToAll(
  applicationServer: webpush.ApplicationServer,
  rows: SubscriptionRow[],
  payload: string,
  topic: string,
) {
  const results: DeviceResult[] = []
  const expiredIds: string[] = []
  await Promise.all(rows.map(async (row) => {
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
      results.push({ id: row.id, service, ok: true, status: 201 })
    } catch (error) {
      if (error instanceof webpush.PushMessageError) {
        const status = error.response.status
        const detail = (await error.response.text().catch(() => '')).slice(0, 300)
        // 404 and 410 both mean the browser dropped this subscription.
        if (status === 404 || status === 410) expiredIds.push(row.id)
        console.error('[push-order] push service refused:', status, detail)
        results.push({ id: row.id, service, ok: false, status, detail })
      } else {
        const detail = error instanceof Error ? error.message : String(error)
        console.error('[push-order] send failed:', detail)
        results.push({ id: row.id, service, ok: false, detail })
      }
    }
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

  // ── Test mode: send a test notification to one user's devices ──────────
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
      title: 'Test ShopSaaS ✅',
      body: 'Si tu vois ce message, les notifications marchent sur cet appareil.',
      url: '/dashboard/settings#application',
      tag: `push-test-${Date.now()}`,
      test: true,
    })
    const { results, expiredIds } = await sendToAll(applicationServer, devices, payload, 'push-test')
    if (expiredIds.length) await supabase.from('web_push_subscriptions').delete().in('id', expiredIds)
    return json({
      sent: results.filter(r => r.ok).length,
      expired: expiredIds.length,
      devices: results,
      vapidPublicKey,
    })
  }

  // ── Normal mode: a new order was created ───────────────────────────────
  const storeId = typeof body?.storeId === 'string' ? body.storeId : ''
  const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
  if (!storeId || !orderId) return json({ error: 'storeId and orderId are required.' }, 400)

  const { error: dispatchError } = await supabase
    .from('order_push_dispatches')
    .insert({ order_id: orderId })
  if (dispatchError) {
    if (dispatchError.code === '23505') return json({ sent: 0, skipped: true })
    console.warn('[push-order] dispatch lock failed:', dispatchError.message)
  }

  const [{ data: order, error: orderError }, { data: store }, { data: members, error: memberError }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, store_id, order_number, total, customer_name, markets(currency)')
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
    return permissions.includes('*') || permissions.includes('orders.read') ? [member.user_id] : []
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
  const payload = JSON.stringify({
    title: 'Nouvelle commande',
    body: `${customer}\n${order.order_number} · ${amount}\n${storeName}`,
    url: `/dashboard/orders/${order.id}`,
    tag: `order-${order.id}`,
    orderId: order.id,
    customer,
    orderNumber: order.order_number,
    amount,
    currency,
    storeName,
    total,
  })

  const { results, expiredIds } = await sendToAll(
    applicationServer,
    limitDevices(subscriptions as SubscriptionRow[]),
    payload,
    `order-${order.id}`.slice(0, 32),
  )
  if (expiredIds.length) await supabase.from('web_push_subscriptions').delete().in('id', expiredIds)

  return json({ sent: results.filter(r => r.ok).length, expired: expiredIds.length, devices: results })
})
