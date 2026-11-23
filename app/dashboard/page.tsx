import Link from 'next/link'
import { ArrowUpRight, Package, ShoppingBag, Users, TrendingUp, Globe2, BarChart3, Star, Zap } from 'lucide-react'
import { requireStore } from '@/lib/context'
import { can } from '@/lib/permissions'
import { formatMoney } from '@/lib/utils'
import { Card, PageHeader, buttonClass } from '@/components/ui'
import { DateRange } from './DateRange'
import { getDateBounds } from '@/lib/date-range'

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

    const [markets, products, members, orders, todayOrders] = await Promise.all([
      supabase.from('markets').select('id, currency').eq('store_id', store.id).eq('active', true).limit(1),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('status', 'active'),
      supabase.from('store_members').select('user_id, roles(name)', { count: 'exact' }).eq('store_id', store.id),
      supabase.from('orders').select('id, total, status, customer_name, lines, created_at').eq('store_id', store.id)
        .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false }),
      supabase.from('orders').select('id, total, status').eq('store_id', store.id)
        .gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
    ])

    const currency = String(markets.data?.[0]?.currency ?? 'XOF').trim()
    const allOrders = (orders.data ?? []) as any[]
    const todayRows = (todayOrders.data ?? []) as any[]

    // KPIs
    const totalOrders = allOrders.length
    const activeRevenue = allOrders
      .filter(o => ['confirmed', 'scheduled', 'shipped', 'delivered'].includes(o.status))
      .reduce((s, o) => s + (Number(o.total) || 0), 0)
    const newOrders = allOrders.filter(o => o.status === 'new').length
    const todayRevenue = todayRows.reduce((s, o) => s + (Number(o.total) || 0), 0)
    const todayCount = todayRows.length

    // Évolution CA par jour (mini sparkline)
    const dayMap = new Map<string, number>()
    for (const o of allOrders) {
      const day = (o.created_at as string).slice(0, 10)
      if (['confirmed', 'scheduled', 'shipped', 'delivered'].includes(o.status)) {
        dayMap.set(day, (dayMap.get(day) ?? 0) + (Number(o.total) || 0))
      }
    }
    const sparkData = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)

    // Top produits
    const productCount = new Map<string, { name: string; count: number; revenue: number }>()
    for (const o of allOrders) {
      if (!Array.isArray(o.lines)) continue
      for (const line of o.lines) {
        const name = line.title || line.product_title || 'Produit'
        const qty = Number(line.quantity) || 1
        const rev = (Number(line.price) || 0) * qty
        const existing = productCount.get(name) ?? { name, count: 0, revenue: 0 }
        existing.count += qty
        existing.revenue += rev
        productCount.set(name, existing)
      }
    }
    const topProducts = Array.from(productCount.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Dernières commandes
    const recentOrders = allOrders.slice(0, 5)

    const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
      new:         { label: 'Nouvelle',    cls: 'bg-violet-100 text-violet-700' },
      confirmed:   { label: 'Confirmée',   cls: 'bg-emerald-100 text-emerald-700' },
      unreachable: { label: 'Injoignable', cls: 'bg-orange-100 text-orange-700' },
      scheduled:   { label: 'Programmée',  cls: 'bg-blue-100 text-blue-700' },
      shipped:     { label: 'Expédiée',    cls: 'bg-amber-100 text-amber-700' },
      delivered:   { label: 'Livrée',      cls: 'bg-green-100 text-green-700' },
      cancelled:   { label: 'Annulée',     cls: 'bg-zinc-100 text-zinc-600' },
      returned:    { label: 'Retournée',   cls: 'bg-red-100 text-red-600' },
    }

    // Sparkline SVG
    function Sparkline({ data, color }: { data: number[]; color: string }) {
      if (data.length < 2) return null
      const max = Math.max(...data, 1)
      const W = 80; const H = 28
      const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * H}`).join(' ')
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-7 opacity-70">
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }

    return (
      <>
        {refus && (
          <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
            Tu n&apos;as pas accès à cette page avec ton rôle actuel.
          </p>
        )}

        {/* Header + DateRange */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
              {firstName ? `${firstName}` : 'Bonjour'} 👋
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Vue d&apos;ensemble · <span className="font-semibold text-zinc-700">{store.name}</span></p>
          </div>
          <DateRange />
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          {[
            {
              label: 'Commandes reçues',
              value: String(totalOrders),
              note: 'Sur la période sélectionnée',
              sub: `${newOrders} en attente de confirmation`,
              icon: ShoppingBag,
              gradient: 'from-violet-500 to-violet-700',
              iconBg: 'bg-violet-100 text-violet-700',
              accent: 'text-violet-700',
              border: 'border-violet-100',
              href: '/dashboard/orders',
              sparkColor: '#7c3aed',
            },
            {
              label: 'CA actif',
              value: formatMoney(activeRevenue, currency),
              note: 'Confirmées, programmées, expédiées, livrées',
              sub: null,
              icon: TrendingUp,
              gradient: 'from-emerald-500 to-emerald-700',
              iconBg: 'bg-emerald-100 text-emerald-700',
              accent: 'text-emerald-700',
              border: 'border-emerald-100',
              href: '/dashboard/comptabilite',
              sparkColor: '#10b981',
            },
            {
              label: "Aujourd'hui",
              value: formatMoney(todayRevenue, currency),
              note: `${todayCount} commande${todayCount !== 1 ? 's' : ''} · tous statuts`,
              sub: null,
              icon: Globe2,
              gradient: 'from-rose-500 to-rose-700',
              iconBg: 'bg-rose-100 text-rose-700',
              accent: 'text-rose-700',
              border: 'border-rose-100',
              href: '/dashboard/orders?range=today',
              sparkColor: '#f43f5e',
            },
            {
              label: 'Produits actifs',
              value: String(products.count ?? 0),
              note: `${members.count ?? 0} membre${(members.count ?? 0) > 1 ? 's' : ''} dans l'équipe`,
              sub: null,
              icon: Package,
              gradient: 'from-amber-500 to-orange-600',
              iconBg: 'bg-amber-100 text-amber-700',
              accent: 'text-amber-700',
              border: 'border-amber-100',
              href: '/dashboard/products',
              sparkColor: '#f59e0b',
            },
          ].map((kpi, i) => {
            const Icon = kpi.icon
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className={`metric-card dash-fade-up dash-card-${i + 1} relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${kpi.border}`}
              >
                <div className={`absolute -right-4 -top-4 size-20 rounded-full bg-gradient-to-br opacity-10 ${kpi.gradient}`} />
                <div className="flex items-start justify-between mb-3">
                  <div className={`inline-flex size-11 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                    <Icon className="size-5" />
                  </div>
                  <Sparkline data={sparkData} color={kpi.sparkColor} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{kpi.label}</p>
                <p className={`mt-1 font-black tracking-tight text-2xl ${kpi.accent}`}>{kpi.value}</p>
                <p className="mt-1.5 text-xs text-zinc-400">{kpi.note}</p>
                {kpi.sub && <p className="mt-1 text-xs font-semibold text-violet-600">{kpi.sub}</p>}
              </Link>
            )
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          {/* Top produits */}
          {topProducts.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-amber-500" />
                  <h2 className="font-bold text-zinc-900">Top produits</h2>
                </div>
                <Link href="/dashboard/products" className="text-xs font-semibold text-violet-600 hover:text-violet-800">
                  Voir tout →
                </Link>
              </div>
              <div className="divide-y divide-zinc-50">
                {topProducts.map((p, i) => {
                  const maxRev = topProducts[0].revenue
                  const pct = maxRev > 0 ? Math.round((p.revenue / maxRev) * 100) : 0
                  return (
                    <div key={p.name} className="flex items-center gap-3 px-5 py-3">
                      <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${
                        i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-zinc-400' : 'bg-orange-300'
                      }`}>{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{p.name}</p>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                          <div className="h-1.5 rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-black text-zinc-800">{formatMoney(p.revenue, currency)}</p>
                        <p className="text-[10px] text-zinc-400">{p.count} vendu{p.count > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dernières commandes */}
          {recentOrders.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-violet-500" />
                  <h2 className="font-bold text-zinc-900">Dernières commandes</h2>
                </div>
                <Link href="/dashboard/orders" className="text-xs font-semibold text-violet-600 hover:text-violet-800">
                  Voir tout →
                </Link>
              </div>
              <div className="divide-y divide-zinc-50">
                {recentOrders.map((o: any) => {
                  const badge = STATUS_BADGE[o.status] ?? { label: o.status, cls: 'bg-zinc-100 text-zinc-600' }
                  return (
                    <Link
                      key={o.id}
                      href={`/dashboard/orders/${o.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{o.customer_name}</p>
                        <p className="text-[11px] text-zinc-400">{new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                      <span className="shrink-0 text-sm font-black text-zinc-700">{formatMoney(Number(o.total) || 0, currency)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Lien vers comptabilité */}
        {can(permissions, 'analytics.read') && (
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-zinc-900">Analyse financière complète</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Graphes d&apos;évolution, répartition par statut, meilleurs jours, taux de livraison.
                </p>
              </div>
              <Link
                href="/dashboard/comptabilite"
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition"
              >
                <BarChart3 className="size-4" />
                Comptabilité
              </Link>
            </div>
          </div>
        )}
      </>
    )
  }

  /* ── Vue équipe ── */
  return (
    <>
      {refus && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
          Tu n&apos;as pas accès à cette page avec ton rôle actuel.
        </p>
      )}
      <PageHeader title={`Bonjour${firstName ? `, ${firstName}` : ''}`} subtitle={store.name} />
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
