import Link from 'next/link'
import { ArrowUpRight, Globe2, Package, ShoppingBag, Users, TrendingUp } from 'lucide-react'
import { requireStore } from '@/lib/context'
import { can } from '@/lib/permissions'
import { storeUrl, formatMoney } from '@/lib/utils'
import { Card, PageHeader, buttonClass } from '@/components/ui'
import { DateRange } from './DateRange'
import { getDateBounds } from '@/lib/date-range'

/* ── Couleurs par métrique ── */
const METRIC_STYLES = [
  {
    icon: ShoppingBag,
    gradient: 'from-violet-500 to-violet-700',
    iconBg: 'bg-violet-100 text-violet-700',
    accent: 'text-violet-700',
    border: 'border-violet-100',
  },
  {
    icon: TrendingUp,
    gradient: 'from-emerald-500 to-emerald-700',
    iconBg: 'bg-emerald-100 text-emerald-700',
    accent: 'text-emerald-700',
    border: 'border-emerald-100',
  },
  {
    icon: Package,
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-100 text-amber-700',
    accent: 'text-amber-700',
    border: 'border-amber-100',
  },
  {
    icon: Users,
    gradient: 'from-sky-500 to-blue-600',
    iconBg: 'bg-sky-100 text-sky-700',
    accent: 'text-sky-700',
    border: 'border-sky-100',
  },
  {
    icon: Globe2,
    gradient: 'from-rose-500 to-rose-700',
    iconBg: 'bg-rose-100 text-rose-700',
    accent: 'text-rose-700',
    border: 'border-rose-100',
  },
]

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ refus?: string; range?: string; from?: string; to?: string }>
}) {
  const { refus, range = '7d', from, to } = await searchParams
  const { supabase, store, permissions, user } = await requireStore()
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? '').split(' ')[0]

  const isManager = can(permissions, 'products.write') || can(permissions, 'team.write')

  if (isManager) {
    const { start, end } = getDateBounds(range, from, to)
    const { start: todayStart, end: todayEnd } = getDateBounds('today')
    const statusStats = [
      { key: 'new', label: 'Nouvelles', dot: 'bg-violet-500', tint: 'bg-violet-50', value: 'text-violet-800', count: 0, total: 0 },
      { key: 'confirmed', label: 'Confirmées', dot: 'bg-emerald-500', tint: 'bg-emerald-50', value: 'text-emerald-800', count: 0, total: 0 },
      { key: 'unreachable', label: 'Injoignables', dot: 'bg-orange-500', tint: 'bg-orange-50', value: 'text-orange-800', count: 0, total: 0 },
      { key: 'scheduled', label: 'Programmées', dot: 'bg-blue-500', tint: 'bg-blue-50', value: 'text-blue-800', count: 0, total: 0 },
      { key: 'shipped', label: 'Expédiées', dot: 'bg-amber-500', tint: 'bg-amber-50', value: 'text-amber-800', count: 0, total: 0 },
      { key: 'delivered', label: 'Livrées', dot: 'bg-green-600', tint: 'bg-green-50', value: 'text-green-800', count: 0, total: 0 },
      { key: 'cancelled', label: 'Annulées', dot: 'bg-red-500', tint: 'bg-red-50', value: 'text-red-800', count: 0, total: 0 },
      { key: 'returned', label: 'Retournées', dot: 'bg-zinc-500', tint: 'bg-zinc-100', value: 'text-zinc-800', count: 0, total: 0 },
    ]
    const statsByStatus = new Map(statusStats.map(item => [item.key, item]))
    const [markets, products, members, orders, todayOrders] = await Promise.all([
      supabase.from('markets').select('id, currency', { count: 'exact' }).eq('store_id', store.id).eq('active', true).limit(1),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('status', 'active'),
      supabase
        .from('store_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('store_id', store.id),
      supabase
        .from('orders')
        .select('id, total, status, markets(currency)')
        .eq('store_id', store.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .range(0, 999),
      supabase
        .from('orders')
        .select('id, total, status')
        .eq('store_id', store.id)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .range(0, 999),
    ])

    let allOrdersCount = 0
    let activeOrderValue = 0
    let currency = String(markets.data?.[0]?.currency ?? 'XOF').trim()
    const completedOrActiveStatuses = new Set(['confirmed', 'scheduled', 'shipped', 'delivered'])
    const aggregateOrders = (rows: any[]) => {
      allOrdersCount += rows.length
      for (const order of rows) {
        if (!markets.data?.[0]?.currency && order.markets?.currency) currency = String(order.markets.currency).trim()
        const status = statsByStatus.get(order.status)
        if (status) {
          status.count += 1
          status.total += Number(order.total) || 0
        }
        if (completedOrActiveStatuses.has(order.status)) activeOrderValue += Number(order.total) || 0
      }
    }
    let orderRows = (orders.data ?? []) as any[]
    aggregateOrders(orderRows)
    let orderOffset = 1000
    while (!orders.error && orderRows.length === 1000) {
      const { data: nextRows, error } = await supabase
        .from('orders')
        .select('id, total, status, markets(currency)')
        .eq('store_id', store.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .range(orderOffset, orderOffset + 999)
      if (error || !nextRows?.length) break
      orderRows = nextRows as any[]
      aggregateOrders(orderRows)
      orderOffset += 1000
    }

    // Chiffre du jour brut : somme de toutes les commandes créées aujourd'hui,
    // quel que soit leur état (livrées, en cours, annulées, retournées, etc.).
    let todayOrdersCount = 0
    let todayGrossRevenue = 0
    const addTodayRows = (rows: any[]) => {
      todayOrdersCount += rows.length
      todayGrossRevenue += rows.reduce((sum: number, order: any) => sum + (Number(order.total) || 0), 0)
    }
    let todayRows = (todayOrders.data ?? []) as any[]
    addTodayRows(todayRows)
    let todayOffset = 1000
    while (!todayOrders.error && todayRows.length === 1000) {
      const { data: nextRows, error } = await supabase
        .from('orders')
        .select('id, total, status')
        .eq('store_id', store.id)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .range(todayOffset, todayOffset + 999)
      if (error || !nextRows?.length) break
      todayRows = nextRows as any[]
      addTodayRows(todayRows)
      todayOffset += 1000
    }

    const orderParams = new URLSearchParams({ range })
    if (from) orderParams.set('from', from)
    if (to) orderParams.set('to', to)
    const orderHref = (status: string) => `/dashboard/orders?${new URLSearchParams({ ...Object.fromEntries(orderParams), status }).toString()}`

    const metrics = [
      {
        label: 'Commandes',
        value: String(allOrdersCount),
        note: 'Sur la période sélectionnée',
        ...METRIC_STYLES[0],
      },
      {
        label: 'Valeur des commandes actives',
        value: formatMoney(activeOrderValue, currency),
        note: 'Confirmées, programmées, expédiées ou livrées',
        ...METRIC_STYLES[1],
        smallValue: true,
      },
      {
        label: 'Produits actifs',
        value: String(products.count ?? 0),
        note: 'Prêts à être vendus',
        ...METRIC_STYLES[2],
      },
      {
        label: 'Membres',
        value: String(members.count ?? 0),
        note: 'Accès à la boutique',
        hideOnMobile: true,
        ...METRIC_STYLES[3],
      },
      {
        label: 'Commandes du jour',
        value: formatMoney(todayGrossRevenue, currency),
        note: `${todayOrdersCount} commande${todayOrdersCount === 1 ? '' : 's'} · montant brut, tous statuts`,
        ...METRIC_STYLES[4],
        smallValue: true,
      },
    ]

    return (
      <>
        {refus && (
          <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
            Tu n&apos;as pas accès à cette page avec ton rôle actuel.
          </p>
        )}

        {/* ── Header ── */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
            {firstName ? `${firstName}` : 'Bonjour'} 👋
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Vue d&apos;ensemble de ta boutique</p>
        </div>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-zinc-700">Résumé de la boutique</p>
          <DateRange />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric, i) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.label}
                className={`metric-card dash-fade-up dash-card-${i + 1} relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ${metric.border} ${(metric as any).hideOnMobile ? 'hidden sm:block' : ''}`}
              >
                {/* Fond décoratif */}
                <div
                  className={`absolute -right-4 -top-4 size-20 rounded-full bg-gradient-to-br opacity-10 ${metric.gradient}`}
                />
                <div
                  className={`absolute -bottom-6 -right-2 size-16 rounded-full bg-gradient-to-br opacity-6 ${metric.gradient}`}
                />

                {/* Icône */}
                <div className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl ${metric.iconBg}`}>
                  <Icon className="size-5" />
                </div>

                {/* Label */}
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{metric.label}</p>

                {/* Valeur */}
                <p className={`dash-count mt-1 font-bold tracking-tight ${metric.accent} ${(metric as any).smallValue ? 'text-2xl' : 'text-4xl'}`}>
                  {metric.value}
                </p>

                {/* Note */}
                <p className="mt-2 text-xs text-zinc-400">{metric.note}</p>
              </div>
            )
          })}
        </div>

        {can(permissions, 'orders.read') && (
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Commandes par statut</h2>
                <p className="mt-1 text-sm text-zinc-500">Montant total et nombre de commandes sur la période. Clique une carte pour ouvrir la liste filtrée.</p>
              </div>
              <Link href={orderHref('')} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900">
                Voir toutes les commandes <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statusStats.map(status => (
                <Link
                  key={status.key}
                  href={orderHref(status.key)}
                  className={`group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500`}
                  aria-label={`${status.label}: ${status.count} commandes, ${formatMoney(status.total, currency)}. Ouvrir les commandes ${status.label.toLowerCase()}.`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                      <span className={`size-2.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                    <span className={`rounded-lg px-2 py-1 text-xs font-bold ${status.tint} ${status.value}`}>
                      {status.count}
                    </span>
                  </div>
                  <p className={`mt-3 text-xl font-bold tracking-tight ${status.value}`}>
                    {formatMoney(status.total, currency)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {status.count === 1 ? '1 commande' : `${status.count} commandes`} · ouvrir la liste
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </>
    )
  }

  /* ── Vue équipe (non-manager) ── */
  return (
    <>
      {refus && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
          Tu n&apos;as pas accès à cette page avec ton rôle actuel.
        </p>
      )}
      <PageHeader
        title={`Bonjour${firstName ? `, ${firstName}` : ''}`}
        subtitle={store.name}
      />
      <Card>
        <h2 className="font-semibold">Bienvenue dans l&apos;équipe</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tu retrouves dans le menu les pages auxquelles ton rôle te donne accès.
        </p>
        {can(permissions, 'orders.read') && (
          <Link href="/dashboard/orders" className={buttonClass('primary', 'mt-4')}>
            Ouvrir les commandes
          </Link>
        )}
      </Card>
    </>
  )
}
