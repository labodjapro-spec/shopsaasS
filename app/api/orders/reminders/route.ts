import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrderScheduledAt } from '@/lib/orders/scheduled'
import { dispatchScheduledReminderPush } from '@/lib/push/dispatch-order-push'

async function processDueScheduledOrders(req: NextRequest) {
  const admin = createAdminClient()
  const hookSecret = process.env.PUSH_HOOK_SECRET?.trim()
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secretHeader = req.headers.get('x-push-hook-secret')?.trim()

  const isCronAuthorized =
    Boolean(hookSecret && (secretHeader === hookSecret || authHeader === hookSecret)) ||
    Boolean(cronSecret && authHeader === cronSecret)

  let scopedStoreIds: string[] | null = null

  if (!isCronAuthorized) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ dueReminders: [], upcoming: [] }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const requestedIds = (searchParams.get('store_ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const [{ data: members }, { data: owned }] = await Promise.all([
      admin.from('store_members').select('store_id').eq('user_id', user.id),
      admin.from('stores').select('id').eq('owner_id', user.id),
    ])

    const allowed = new Set<string>([
      ...(members ?? []).map((r: { store_id: string }) => r.store_id),
      ...(owned ?? []).map((r: { id: string }) => r.id),
    ])

    scopedStoreIds = requestedIds.length
      ? requestedIds.filter((id) => allowed.has(id))
      : [...allowed]

    if (!scopedStoreIds.length) {
      return NextResponse.json({ dueReminders: [], upcoming: [] })
    }
  }

  let ordersQuery = admin
    .from('orders')
    .select('*, markets(currency)')
    .eq('status', 'scheduled')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (scopedStoreIds) {
    ordersQuery = ordersQuery.in('store_id', scopedStoreIds)
  }

  const { data: scheduledOrders, error: ordersError } = await ordersQuery
  if (ordersError || !scheduledOrders?.length) {
    return NextResponse.json({ dueReminders: [], upcoming: [] })
  }

  const orderIds = scheduledOrders.map((o: any) => o.id)
  const { data: events } = await admin
    .from('order_events')
    .select('order_id, event_type, note, created_at')
    .in('order_id', orderIds)
    .in('event_type', ['Statut : Programmée', 'Rappel livraison envoyé'])
    .order('created_at', { ascending: false })

  const eventsByOrder = new Map<string, any[]>()
  for (const ev of events ?? []) {
    const list = eventsByOrder.get(ev.order_id) ?? []
    list.push(ev)
    eventsByOrder.set(ev.order_id, list)
  }

  const nowMs = Date.now()
  const dueReminders: any[] = []
  const upcoming: Array<{
    id: string
    order_number: string
    customer_name: string
    scheduledAt: string
    note: string
  }> = []

  for (const order of scheduledOrders as any[]) {
    const orderEvents = eventsByOrder.get(order.id) ?? []
    const { scheduledAt, cleanNote, reminderSent } = resolveOrderScheduledAt(order, orderEvents)
    if (!scheduledAt) continue

    const targetMs = new Date(scheduledAt).getTime()
    if (Number.isNaN(targetMs)) continue

    if (reminderSent || order.reminder_sent_at) {
      continue
    }

    if (targetMs <= nowMs) {
      // Mark reminder as sent immediately so no parallel caller sends it twice
      const nowIso = new Date().toISOString()
      await admin.from('order_events').insert({
        order_id: order.id,
        store_id: order.store_id,
        event_type: 'Rappel livraison envoyé',
        note: cleanNote ? `Livraison prévue : ${cleanNote}` : 'Notification de rappel envoyée',
      })
      await admin
        .from('orders')
        .update({ reminder_sent_at: nowIso } as Record<string, unknown>)
        .eq('id', order.id)

      // Clear any previous creation dispatch lock so even legacy push-order v1 sends the push
      await admin.from('order_push_dispatches').delete().eq('order_id', order.id)
      await dispatchScheduledReminderPush(String(order.store_id), String(order.id), cleanNote)

      dueReminders.push({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_city: order.customer_city || '',
        customer_address: order.customer_address || '',
        total: Number(order.total) || 0,
        currency: order.markets?.currency ?? 'XOF',
        scheduledAt,
        note: cleanNote,
      })
    } else {
      upcoming.push({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        scheduledAt,
        note: cleanNote,
      })
    }
  }

  return NextResponse.json({ dueReminders, upcoming })
}

export async function GET(req: NextRequest) {
  try {
    return await processDueScheduledOrders(req)
  } catch (err: any) {
    console.error('[orders/reminders] GET error:', err?.message)
    return NextResponse.json({ dueReminders: [], upcoming: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    return await processDueScheduledOrders(req)
  } catch (err: any) {
    console.error('[orders/reminders] POST error:', err?.message)
    return NextResponse.json({ dueReminders: [], upcoming: [] }, { status: 500 })
  }
}
