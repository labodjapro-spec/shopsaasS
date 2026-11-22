import { requirePerm } from '@/lib/context'
import { can } from '@/lib/permissions'
import { getDateBounds } from '@/lib/date-range'
import { formatMoney } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { DateRange } from '@/app/dashboard/DateRange'
import ComptaCharts from './ComptaCharts'

const STATUS_COLORS: Record<string, string> = {
  new:         '#8b5cf6',
  confirmed:   '#10b981',
  unreachable: '#f97316',
  scheduled:   '#3b82f6',
  shipped:     '#f59e0b',
  delivered:   '#22c55e',
  cancelled:   '#ef4444',
  returned:    '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  new:         'Nouvelles',
  confirmed:   'Confirmées',
  unreachable: 'Injoignables',
  scheduled:   'Programmées',
  shipped:     'Expédiées',
  delivered:   'Livrées',
  cancelled:   'Annulées',
  returned:    'Retournées',
}

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const { range = '30d', from, to } = await searchParams
  const { supabase, store } = await requirePerm('analytics.read')

  const { start, end } = getDateBounds(range, from, to)

  // Charger toutes les commandes de la période
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, status, created_at, markets(currency)')
    .eq('store_id', store.id)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true })

  const allOrders = (orders ?? []) as any[]
  const currency = allOrders[0]?.markets?.currency ?? 'XOF'

  // ── Métriques globales ──
  const totalRevenue = allOrders
    .filter(o => ['confirmed', 'scheduled', 'shipped', 'delivered'].includes(o.status))
    .reduce((s, o) => s + (Number(o.total) || 0), 0)

  const totalOrders = allOrders.length
  const deliveredOrders = allOrders.filter(o => o.status === 'delivered')
  const cancelledOrders = allOrders.filter(o => o.status === 'cancelled')
  const avgOrderValue = totalOrders > 0
    ? allOrders.reduce((s, o) => s + (Number(o.total) || 0), 0) / totalOrders
    : 0
  const deliveryRate = totalOrders > 0
    ? Math.round((deliveredOrders.length / totalOrders) * 100)
    : 0
  const cancellationRate = totalOrders > 0
    ? Math.round((cancelledOrders.length / totalOrders) * 100)
    : 0

  // ── Stats par statut ──
  const byStatus = Object.keys(STATUS_LABELS).map(key => ({
    key,
    label: STATUS_LABELS[key],
    color: STATUS_COLORS[key],
    count: allOrders.filter(o => o.status === key).length,
    total: allOrders.filter(o => o.status === key).reduce((s, o) => s + (Number(o.total) || 0), 0),
  })).filter(s => s.count > 0)

  // ── Évolution par jour ──
  const dayMap = new Map<string, { date: string; revenue: number; count: number; delivered: number; cancelled: number }>()
  for (const o of allOrders) {
    const day = o.created_at.slice(0, 10)
    if (!dayMap.has(day)) dayMap.set(day, { date: day, revenue: 0, count: 0, delivered: 0, cancelled: 0 })
    const d = dayMap.get(day)!
    d.count++
    if (['confirmed', 'scheduled', 'shipped', 'delivered'].includes(o.status)) d.revenue += Number(o.total) || 0
    if (o.status === 'delivered') d.delivered++
    if (o.status === 'cancelled') d.cancelled++
  }
  const dailyData = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  // ── Top jours ──
  const topDays = [...dailyData].sort((a, b) => b.revenue - a.revenue).slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Comptabilité" subtitle="Analyse financière de ta boutique" />
        <DateRange align="right" />
      </div>

      {/* ── KPIs principaux ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Chiffre d\'affaires actif',
            value: formatMoney(totalRevenue, currency),
            note: 'Confirmées, programmées, expédiées, livrées',
            gradient: 'from-violet-500 to-violet-700',
            bg: 'bg-violet-50',
            text: 'text-violet-700',
            small: true,
          },
          {
            label: 'Commandes reçues',
            value: String(totalOrders),
            note: 'Toutes commandes confondues',
            gradient: 'from-emerald-500 to-emerald-700',
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
            small: false,
          },
          {
            label: 'Panier moyen',
            value: formatMoney(avgOrderValue, currency),
            note: 'Moyenne par commande',
            gradient: 'from-amber-500 to-orange-600',
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            small: true,
          },
          {
            label: 'Taux de livraison',
            value: `${deliveryRate}%`,
            note: `${deliveredOrders.length} livrées · ${cancellationRate}% annulées`,
            gradient: 'from-sky-500 to-blue-600',
            bg: 'bg-sky-50',
            text: 'text-sky-700',
            small: false,
          },
        ].map((kpi, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm`}>
            <div className={`absolute -right-4 -top-4 size-20 rounded-full bg-gradient-to-br opacity-10 ${kpi.gradient}`} />
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{kpi.label}</p>
            <p className={`mt-2 font-black tracking-tight ${kpi.text} ${kpi.small ? 'text-2xl' : 'text-4xl'}`}>
              {kpi.value}
            </p>
            <p className="mt-1.5 text-xs text-zinc-400">{kpi.note}</p>
          </div>
        ))}
      </div>

      {/* ── Graphes ── */}
      <ComptaCharts
        dailyData={dailyData}
        byStatus={byStatus}
        currency={currency}
      />

      {/* ── Répartition par statut ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="font-bold text-zinc-900">Répartition par statut</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Nombre de commandes et montant total pour chaque statut</p>
        </div>
        <div className="divide-y divide-zinc-50">
          {byStatus.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zinc-400">Aucune commande sur cette période</p>
          ) : (
            byStatus.map(s => (
              <div key={s.key} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full shrink-0" style={{ background: s.color }} />
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{s.label}</p>
                    <p className="text-xs text-zinc-400">{s.count} commande{s.count > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-zinc-900">{formatMoney(s.total, currency)}</p>
                  <p className="text-xs text-zinc-400">
                    {totalOrders > 0 ? Math.round((s.count / totalOrders) * 100) : 0}%
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Top jours ── */}
      {topDays.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="font-bold text-zinc-900">Meilleurs jours</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Jours avec le chiffre d'affaires le plus élevé</p>
          </div>
          <div className="divide-y divide-zinc-50">
            {topDays.map((d, i) => (
              <div key={d.date} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`flex size-8 items-center justify-center rounded-xl text-sm font-black text-white ${
                    i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-zinc-400' : 'bg-orange-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long'
                      })}
                    </p>
                    <p className="text-xs text-zinc-400">{d.count} commande{d.count > 1 ? 's' : ''} · {d.delivered} livrée{d.delivered > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <p className="text-sm font-black text-violet-700">{formatMoney(d.revenue, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
