import Link from 'next/link'
import { requirePerm } from '@/lib/context'
import { Card, PageHeader } from '@/components/ui'
import { DateRange } from '../DateRange'
import { getDateBounds } from '@/lib/date-range'
import { ShoppingBag } from 'lucide-react'
import { StatusFilter } from './StatusFilter'
import { OrdersTable } from './OrdersTable'
import { resolveOrderScheduledAt } from '@/lib/orders/scheduled'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; range?: string; from?: string; to?: string }>
}) {
  const { status, range = '7d', from, to } = await searchParams
  const { supabase, store } = await requirePerm('orders.read')

  let query = supabase
    .from('orders')
    .select('*, markets(currency)')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { start, end } = getDateBounds(range, from, to)
  query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())

  const { data } = await query
  const rawOrders = (data ?? []) as any[]

  // Enrich scheduled orders with their scheduled_at timestamp (from column or order_events)
  const scheduledIds = rawOrders.filter((o) => o.status === 'scheduled').map((o) => o.id)
  const eventsByOrder = new Map<string, any[]>()
  if (scheduledIds.length > 0) {
    const { data: schedEvents } = await supabase
      .from('order_events')
      .select('order_id, event_type, note, created_at')
      .in('order_id', scheduledIds)
      .eq('event_type', 'Statut : Programmée')
      .order('created_at', { ascending: false })

    for (const ev of schedEvents ?? []) {
      const list = eventsByOrder.get(ev.order_id) ?? []
      list.push(ev)
      eventsByOrder.set(ev.order_id, list)
    }
  }

  const orders = rawOrders.map((o) => {
    if (o.status !== 'scheduled') return o
    const { scheduledAt } = resolveOrderScheduledAt(o, eventsByOrder.get(o.id))
    return { ...o, scheduled_at: scheduledAt }
  })

  return (
    <>
      <PageHeader
        title="Commandes"
        subtitle={`${orders.length} commande${orders.length === 1 ? '' : 's'} · paiement à la livraison`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <DateRange compact align="left" />
        <StatusFilter />
      </div>

      <Card className="overflow-hidden p-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center">
              <ShoppingBag className="size-7 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-500">Aucune commande sur cette période</p>
            <p className="text-xs text-zinc-400">Essayez d&apos;élargir la période ou de changer le filtre</p>
            <Link href="/dashboard/orders" className="text-xs text-violet-600 hover:underline mt-1">
              Voir toutes les commandes
            </Link>
          </div>
        ) : (
          <OrdersTable orders={orders} />
        )}
      </Card>
    </>
  )
}
