import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-hook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_DEVICES_PER_USER = 3

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  const expectedSecret = Deno.env.get('PUSH_HOOK_SECRET')
  if (!expectedSecret || request.headers.get('x-push-hook-secret') !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidJson = Deno.env.get('VAPID_KEYS_JSON')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  if (!supabaseUrl || !serviceRoleKey || !vapidJson || !vapidSubject) {
    return Response.json({ error: 'Push function secrets are not configured.' }, { status: 500, headers: corsHeaders })
  }

  const body = await request.json().catch(() => null)
  const storeId = typeof body?.storeId === 'string' ? body.storeId : ''
  const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
  if (!storeId || !orderId) {
    return Response.json({ error: 'storeId and orderId are required.' }, { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: dispatchError } = await supabase
    .from('order_push_dispatches')
    .insert({ order_id: orderId })
  if (dispatchError) {
    if (dispatchError.code === '23505') return Response.json({ sent: 0, skipped: true }, { headers: corsHeaders })
    console.warn('[push-order] dispatch lock failed:', dispatchError.message)
  }

  const [{ data: order, error: orderError }, { data: store }, { data: members, error: memberError }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, store_id, order_number, total, customer_name, markets(currency)')
      .eq('id', orderId)
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase.from('stores').select('name').eq('id', storeId).maybeSingle(),
    supabase
      .from('store_members')
      .select('user_id, roles(permissions)')
      .eq('store_id', storeId),
  ])

  if (orderError || !order) return Response.json({ error: 'Order not found.' }, { status: 404, headers: corsHeaders })
  if (memberError) return Response.json({ error: 'Could not resolve order viewers.' }, { status: 500, headers: corsHeaders })

  const eligibleUserIds = (members ?? []).flatMap((member: any) => {
    const role = Array.isArray(member.roles) ? member.roles[0] : member.roles
    const permissions = Array.isArray(role?.permissions) ? role.permissions : []
    return permissions.includes('*') || permissions.includes('orders.read') ? [member.user_id] : []
  })
  if (!eligibleUserIds.length) return Response.json({ sent: 0 }, { headers: corsHeaders })

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('web_push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, updated_at')
    .in('user_id', eligibleUserIds)
    .order('updated_at', { ascending: false })
  if (subscriptionError) {
    return Response.json({ error: 'Could not load push subscriptions.' }, { status: 500, headers: corsHeaders })
  }
  if (!subscriptions?.length) return Response.json({ sent: 0 }, { headers: corsHeaders })

  const perUserCount = new Map<string, number>()
  const unique = new Map<string, (typeof subscriptions)[number]>()
  for (const row of subscriptions) {
    const already = perUserCount.get(row.user_id) ?? 0
    if (already >= MAX_DEVICES_PER_USER) continue
    if (unique.has(row.endpoint)) continue
    unique.set(row.endpoint, row)
    perUserCount.set(row.user_id, already + 1)
  }

  let vapidKeys: webpush.ExportedVapidKeys
  try {
    vapidKeys = JSON.parse(vapidJson)
  } catch {
    return Response.json({ error: 'VAPID_KEYS_JSON is invalid JSON.' }, { status: 500, headers: corsHeaders })
  }

  const applicationServer = await webpush.ApplicationServer.new({
    contactInformation: vapidSubject,
    vapidKeys: await webpush.importVapidKeys(vapidKeys),
  })
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

  let sent = 0
  const expiredIds: string[] = []
  await Promise.all([...unique.values()].map(async (row) => {
    try {
      const subscriber = applicationServer.subscribe({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      })
      await subscriber.pushTextMessage(payload, {
        urgency: webpush.Urgency.High,
        ttl: 60 * 60 * 24,
        topic: `order-${order.id}`.slice(0, 32),
      })
      sent += 1
    } catch (error) {
      if (error instanceof webpush.PushMessageError && error.isGone()) expiredIds.push(row.id)
      else console.error('[push-order] send failed:', error)
    }
  }))

  if (expiredIds.length) {
    await supabase.from('web_push_subscriptions').delete().in('id', expiredIds)
  }

  return Response.json({ sent, expired: expiredIds.length }, { headers: corsHeaders })
})
