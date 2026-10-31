'use client'

import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/utils'

const ROW_STYLES: Record<string, { row: string; text: string; sub: string; badge: string }> = {
  new:         { row: 'bg-white hover:bg-zinc-50 border-b border-zinc-100',   text: 'text-zinc-900 font-semibold', sub: 'text-zinc-400',  badge: 'bg-zinc-100 text-zinc-700' },
  confirmed:   { row: 'bg-emerald-600 hover:bg-emerald-700', text: 'text-white font-semibold', sub: 'text-emerald-200', badge: 'bg-white/20 text-white' },
  unreachable: { row: 'bg-orange-500 hover:bg-orange-600',   text: 'text-white font-semibold', sub: 'text-orange-100',  badge: 'bg-white/20 text-white' },
  scheduled:   { row: 'bg-blue-600 hover:bg-blue-700',       text: 'text-white font-semibold', sub: 'text-blue-200',    badge: 'bg-white/20 text-white' },
  shipped:     { row: 'bg-amber-500 hover:bg-amber-600',     text: 'text-white font-semibold', sub: 'text-amber-100',   badge: 'bg-white/20 text-white' },
  delivered:   { row: 'bg-green-600 hover:bg-green-700',     text: 'text-white font-semibold', sub: 'text-green-100',   badge: 'bg-white/20 text-white' },
  cancelled:   { row: 'bg-red-600 hover:bg-red-700',         text: 'text-white font-semibold', sub: 'text-red-200',     badge: 'bg-white/20 text-white' },
  returned:    { row: 'bg-zinc-500 hover:bg-zinc-600',        text: 'text-white font-semibold', sub: 'text-zinc-300',    badge: 'bg-white/20 text-white' },
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle',
  confirmed: 'Confirmée',
  unreachable: 'Injoignable',
  scheduled: 'Programmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  returned: 'Retournée',
}

const STATUS_BADGES: Record<string, string> = {
  new: 'bg-violet-100 text-violet-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  unreachable: 'bg-orange-100 text-orange-800',
  scheduled: 'bg-blue-100 text-blue-800',
  shipped: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-zinc-100 text-zinc-700',
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_city: string | null
  total: number
  status: string
  created_at: string
  markets: { currency: string } | null
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const openOrder = (id: string) => router.push(`/dashboard/orders/${id}`)

  return (
    <>
      <div className="divide-y divide-zinc-100 md:hidden">
        {orders.map(order => {
          const style = ROW_STYLES[order.status] ?? ROW_STYLES.new
          return (
            <button
              key={order.id}
              type="button"
              onClick={() => openOrder(order.id)}
              className={`block w-full p-4 text-left transition focus:outline-none ${style.row}`}
              aria-label={`Commande ${order.order_number}, ${order.customer_name}, ${STATUS_LABELS[order.status] ?? order.status}, ${formatMoney(order.total, order.markets?.currency ?? 'XOF')}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-extrabold ${style.text}`}>{order.order_number}</p>
                  <p className={`mt-1 truncate text-sm font-semibold ${style.text}`}>{order.customer_name}</p>
                </div>
                <p className={`shrink-0 text-right text-sm font-black ${style.text}`}>
                  {formatMoney(order.total, order.markets?.currency ?? 'XOF')}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style.badge}`}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
                <span className={`text-xs ${style.sub}`}>{order.customer_phone}</span>
              </div>
              <div className={`mt-2 flex items-center justify-between gap-3 text-xs ${style.sub}`}>
                <span className="truncate">{order.customer_city || 'Ville non indiquée'}</span>
                <time className="shrink-0">
                  {new Date(order.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </time>
              </div>
            </button>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Commande</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Client</th>
              <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">Ville</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Statut</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const style = ROW_STYLES[order.status] ?? ROW_STYLES.new
              return (
                <tr key={order.id} className={`${style.row} cursor-pointer transition-colors`} onClick={() => openOrder(order.id)}>
                  <td className="px-5 py-4">
                    <p className={`font-bold ${style.text}`}>{order.order_number}</p>
                    <p className={`mt-0.5 text-xs ${style.sub}`}>
                      {new Date(order.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className={`font-semibold ${style.text}`}>{order.customer_name}</p>
                    <p className={`mt-0.5 text-xs ${style.sub}`}>{order.customer_phone}</p>
                  </td>
                  <td className={`hidden px-5 py-4 lg:table-cell ${style.sub}`}>{order.customer_city || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className={`px-5 py-4 text-right font-bold ${style.text}`}>
                    {formatMoney(order.total, order.markets?.currency ?? 'XOF')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
